import os
import json
import psutil
import subprocess
import time
import sys
import json
from datetime import datetime
from threading import Thread, Event
import statistics
import platform

from testfarm_agents_utils import expand_magic_variables

__all__ = [
    "reset_bench_iter",
    "get_bench_iter",
    "incr_bench_iter",
    "remove_benchmark_process_file",
    "ProcessMonitor"
]


def reset_bench_iter():
    benchmark_process_file = expand_magic_variables(f"$__TF_TEMP_DIR__/benchmark_process.testfarm")
    
    data = {"current_iteration": 0}
    with open(benchmark_process_file, 'w') as f:
        json.dump(data, f, indent=2)


def get_bench_iter() -> int:
    benchmark_process_file = expand_magic_variables(f"$__TF_TEMP_DIR__/benchmark_process.testfarm")

    with open(benchmark_process_file, 'r') as f:
        data = json.load(f)

    return data.get("current_iteration", 0)


def incr_bench_iter():
    benchmark_process_file = expand_magic_variables(f"$__TF_TEMP_DIR__/benchmark_process.testfarm")

    with open(benchmark_process_file, 'r') as f:
        data = json.load(f)

    data["current_iteration"] = data.get("current_iteration", 0) + 1

    with open(benchmark_process_file, 'w') as f:
        json.dump(data, f, indent=2)


def remove_benchmark_process_file():
    benchmark_process_file = expand_magic_variables(f"$__TF_TEMP_DIR__/benchmark_process.testfarm")
    
    if os.path.exists(benchmark_process_file):
        os.remove(benchmark_process_file)
    else:
        raise FileNotFoundError(f"Benchmark process file {benchmark_process_file} does not exist.")

class ProcessMonitor:
    def __init__(self, command, timeout=900, interval=1.0):
        self.command = command
        self.timeout = timeout
        self.interval = interval
        self.stop_event = Event()
        self.metrics = []
        self.process = None
        self.start_time = None
        self.end_time = None
        self.result = None
        
        # Detect operating system
        self.is_windows = platform.system().lower() == 'windows'
        self.is_linux = platform.system().lower() == 'linux'
        self.is_macos = platform.system().lower() == 'darwin'
        
        print(f"Detected OS: {platform.system()} ({platform.release()})")
        
        # Initialize network baseline
        self._last_net_io = None
        self._baseline_net_io = None
        
    def start_target_process(self):
        try:
            if self.is_windows:
                # Windows-specific process creation
                self.process = subprocess.Popen(
                    self.command,
                    # shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
            else:
                # Unix-like process creation
                self.process = subprocess.Popen(
                    self.command,
                    # shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
            
            self.start_time = datetime.now()
            print(f"Started process (PID: {self.process.pid}): {self.command}")
            return True
        except Exception as e:
            print(f"Failed to start process: {e}")
            return False
        
    def monitor_process(self):
        if not self.process:
            return
            
        try:
            # Get psutil process object
            ps_process = psutil.Process(self.process.pid)

            # CRITICAL FIX: Initialize CPU percent baseline
            # First call always returns 0.0, but establishes baseline
            ps_process.cpu_percent()
            
            # Small delay to ensure baseline is set
            time.sleep(0.1)
            
            while not self.stop_event.is_set() and self.process.poll() is None:
                try:
                    # Get current timestamp
                    timestamp = time.time()
                    
                    # CPU usage (percent)
                    cpu_percent = ps_process.cpu_percent()
                    
                    # CPU times (user and system time in seconds)
                    cpu_times = ps_process.cpu_times()
                    
                    # Memory usage
                    memory_info = ps_process.memory_info()
                    memory_percent = ps_process.memory_percent()
                    
                    # I/O counters
                    io_counters = ps_process.io_counters()
                    
                    # Network I/O counters (system-wide, filtered by connections)
                    network_io = self.get_network_io_for_process(ps_process)
                    
                    # Number of threads
                    num_threads = ps_process.num_threads()
                    
                    # File descriptors (Unix) or Handles (Windows)
                    fd_handle_count = self.get_fd_handle_count(ps_process)
                    
                    # Network connections
                    num_connections = self.get_connection_count(ps_process)
                    
                    # Context switches (if available)
                    context_switches = self.get_context_switches(ps_process)
                    
                    # System-wide CPU and memory
                    system_cpu = psutil.cpu_percent()
                    system_memory = psutil.virtual_memory()
                    
                    # Normalize CPU percentage to 0-100% range
                    cpu_count = psutil.cpu_count()
                    normalized_cpu_percent = min(100.0, cpu_percent / cpu_count) if cpu_count > 0 else cpu_percent
                    
                    # Record metrics
                    metric = {
                        'timestamp': timestamp,
                        'elapsed_time': timestamp - time.mktime(self.start_time.timetuple()),
                        'process': {
                            'cpu_percent': normalized_cpu_percent,
                            'cpu_percent_raw': cpu_percent,  # Keep original value for reference
                            'cpu_times_user': cpu_times.user,
                            'cpu_times_system': cpu_times.system,
                            'cpu_times_total': cpu_times.user + cpu_times.system,
                            'memory_rss': memory_info.rss,  # Resident Set Size
                            'memory_vms': memory_info.vms,  # Virtual Memory Size
                            'memory_percent': memory_percent,
                            'num_threads': num_threads,
                            'fd_handle_count': fd_handle_count,
                            'fd_handle_type': 'handles' if self.is_windows else 'file_descriptors',
                            'io_read_count': io_counters.read_count,
                            'io_write_count': io_counters.write_count,
                            'io_read_bytes': io_counters.read_bytes,
                            'io_write_bytes': io_counters.write_bytes,
                            'network_bytes_sent': network_io['bytes_sent'],
                            'network_bytes_recv': network_io['bytes_recv'],
                            'network_packets_sent': network_io['packets_sent'],
                            'network_packets_recv': network_io['packets_recv'],
                            'network_connections': num_connections,
                            'context_switches': context_switches,
                        },
                        'system': {
                            'cpu_percent': system_cpu,
                            'memory_total': system_memory.total,
                            'memory_available': system_memory.available,
                            'memory_used': system_memory.used,
                            'memory_percent': system_memory.percent,
                        }
                    }
                    
                    self.metrics.append(metric)
                    
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    # Process might have ended or access denied
                    break
                
                time.sleep(self.interval)
                
        except Exception as e:
            print(f"Error during monitoring: {e}")
    
    def wait_for_process(self):
        if self.process:
            try:
                self.process.wait(timeout=self.timeout)
                self.end_time = datetime.now()
                self.stop_event.set()
            except KeyboardInterrupt:
                print("Keyboard interrupt: terminating process...")

                if self.is_windows:
                    self.process.terminate()
                    try:
                        self.process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        self.process.kill()
                else:
                    self.process.terminate()
                    try:
                        self.process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        self.process.kill()
                self.end_time = datetime.now()
                self.stop_event.set()
                raise
            except subprocess.TimeoutExpired:
                print("Timeout expired: terminating process...")
                self.process.kill()

    def run(self):
        if not self.start_target_process():
            return False
        
        monitor_thread = Thread(target=self.monitor_process)
        monitor_thread.start()
        
        self.wait_for_process()
        
        monitor_thread.join()
        
        print(f"Process completed (exit code: {self.process.returncode})")
        
        stdout, stderr = self.process.communicate()

        self.result = {
            'stdout': stdout,
            'stderr': stderr,
            'exit_code': self.process.returncode
        }

        return self.result
    
    def kill(self):
        if self.process and self.process.poll() is None:
            self.process.kill()
            self.stop_event.set()

    def generate_report(self):
        if not self.metrics:
            print("No metrics collected!")
            return
        
        duration = (self.end_time - self.start_time).total_seconds()

        # Extract metric series for analysis
        cpu_values = [m['process']['cpu_percent'] for m in self.metrics if m['process']['cpu_percent']]
        cpu_times_user = [m['process']['cpu_times_user'] for m in self.metrics]
        cpu_times_system = [m['process']['cpu_times_system'] for m in self.metrics]
        cpu_times_total = [m['process']['cpu_times_total'] for m in self.metrics]
        memory_rss = [m['process']['memory_rss'] for m in self.metrics]
        memory_percent = [m['process']['memory_percent'] for m in self.metrics]
        io_read_bytes = [m['process']['io_read_bytes'] for m in self.metrics]
        io_write_bytes = [m['process']['io_write_bytes'] for m in self.metrics]
        network_bytes_sent = [m['process']['network_bytes_sent'] for m in self.metrics]
        network_bytes_recv = [m['process']['network_bytes_recv'] for m in self.metrics]
        
        # Calculate statistics
        report = {
            'summary': {
                'command': self.command,
                'start_time': self.start_time.isoformat(),
                'end_time': self.end_time.isoformat(),
                'stdout': self.result['stdout'],
                'stderr': self.result['stderr'],
                'exit_code': self.result['exit_code'],
                'duration_seconds': duration,
                'samples_collected': len(self.metrics),
                'monitoring_interval': self.interval,
                'operating_system': {
                    'system': platform.system(),
                    'release': platform.release(),
                    'version': platform.version(),
                    'machine': platform.machine(),
                    'processor': platform.processor(),
                    'cpu_count_logical': psutil.cpu_count(),
                    'cpu_count_physical': psutil.cpu_count(logical=False)
                },
            },
            'cpu': {
                'max_percent': max(cpu_values) if cpu_values else 0,
                'avg_percent': statistics.mean(cpu_values) if cpu_values else 0,
                'min_percent': min(cpu_values) if cpu_values else 0,
                'total_user_time': max(cpu_times_user) if cpu_times_user else 0,
                'total_system_time': max(cpu_times_system) if cpu_times_system else 0,
                'total_cpu_time': max(cpu_times_total) if cpu_times_total else 0,
                'cpu_efficiency': (max(cpu_times_total) / duration * 100) if duration > 0 and cpu_times_total else 0,
            },
            'memory': {
                'max_rss_bytes': max(memory_rss),
                'max_rss_mb': max(memory_rss) / (1024 * 1024),
                'avg_rss_bytes': statistics.mean(memory_rss),
                'avg_rss_mb': statistics.mean(memory_rss) / (1024 * 1024),
                'max_percent': max(memory_percent),
                'avg_percent': statistics.mean(memory_percent),
            },
            'io': {
                'total_read_bytes': max(io_read_bytes) - min(io_read_bytes) if io_read_bytes else 0,
                'total_write_bytes': max(io_write_bytes) - min(io_write_bytes) if io_write_bytes else 0,
                'total_read_mb': (max(io_read_bytes) - min(io_read_bytes)) / (1024 * 1024) if io_read_bytes else 0,
                'total_write_mb': (max(io_write_bytes) - min(io_write_bytes)) / (1024 * 1024) if io_write_bytes else 0,
            },
            'network': {
                'total_bytes_sent': max(network_bytes_sent) - min(network_bytes_sent) if network_bytes_sent else 0,
                'total_bytes_recv': max(network_bytes_recv) - min(network_bytes_recv) if network_bytes_recv else 0,
                'total_sent_mb': (max(network_bytes_sent) - min(network_bytes_sent)) / (1024 * 1024) if network_bytes_sent else 0,
                'total_recv_mb': (max(network_bytes_recv) - min(network_bytes_recv)) / (1024 * 1024) if network_bytes_recv else 0,
                'max_connections': max([m['process']['network_connections'] for m in self.metrics]) if self.metrics else 0,
                'avg_connections': statistics.mean([m['process']['network_connections'] for m in self.metrics]) if self.metrics else 0,
            },
            'process_info': {
                'max_threads': max([m['process']['num_threads'] for m in self.metrics]),
                'avg_threads': statistics.mean([m['process']['num_threads'] for m in self.metrics]),
                'max_fd_handles': max([m['process']['fd_handle_count'] for m in self.metrics if m['process']['fd_handle_count'] is not None]) if any(m['process']['fd_handle_count'] is not None for m in self.metrics) else 0,
                'avg_fd_handles': statistics.mean([m['process']['fd_handle_count'] for m in self.metrics if m['process']['fd_handle_count'] is not None]) if any(m['process']['fd_handle_count'] is not None for m in self.metrics) else 0,
                'fd_handle_type': 'handles' if self.is_windows else 'file_descriptors',
                'max_connections': max([m['process']['network_connections'] for m in self.metrics]) if self.metrics else 0,
                'avg_connections': statistics.mean([m['process']['network_connections'] for m in self.metrics]) if self.metrics else 0,
                'total_context_switches': sum([m['process']['context_switches']['voluntary'] + m['process']['context_switches']['involuntary'] for m in self.metrics]) if self.metrics else 0,
            }
        }
        
        return report
    
    def save_detailed_data(self, filename):
        data = {
            'summary': self.generate_report(),
            'metrics': self.metrics
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        
        print(f"Detailed data saved to: {filename}")
    
    def get_network_io_for_process(self, ps_process):
        """Get network I/O statistics for the process"""
        try:
            # Get current system-wide network I/O
            current_net_io = psutil.net_io_counters()
            
            if current_net_io is None:
                return {
                    'bytes_sent': 0,
                    'bytes_recv': 0,
                    'packets_sent': 0,
                    'packets_recv': 0
                }
            
            # Initialize baseline on first call
            if self._baseline_net_io is None:
                self._baseline_net_io = current_net_io
                self._last_net_io = current_net_io
                return {
                    'bytes_sent': 0,
                    'bytes_recv': 0,
                    'packets_sent': 0,
                    'packets_recv': 0
                }
            
            # Calculate delta since baseline (approximate process usage)
            # Note: This is system-wide, not process-specific, but gives an indication
            # of network activity during the process lifetime
            delta_sent = max(0, current_net_io.bytes_sent - self._baseline_net_io.bytes_sent)
            delta_recv = max(0, current_net_io.bytes_recv - self._baseline_net_io.bytes_recv)
            delta_packets_sent = max(0, current_net_io.packets_sent - self._baseline_net_io.packets_sent)
            delta_packets_recv = max(0, current_net_io.packets_recv - self._baseline_net_io.packets_recv)
            
            self._last_net_io = current_net_io
            
            return {
                'bytes_sent': delta_sent,
                'bytes_recv': delta_recv,
                'packets_sent': delta_packets_sent,
                'packets_recv': delta_packets_recv
            }
            
        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError):
            return {
                'bytes_sent': 0,
                'bytes_recv': 0,
                'packets_sent': 0,
                'packets_recv': 0
            }
    
    def get_fd_handle_count(self, ps_process):
        """Get file descriptor count (Unix) or handle count (Windows)"""
        try:
            if self.is_windows:
                # Windows: Get handle count
                return ps_process.num_handles()
            else:
                # Unix-like: Get file descriptor count
                return ps_process.num_fds()
        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError):
            return None
    
    def get_connection_count(self, ps_process):
        """Get number of network connections for the process"""
        try:
            connections = ps_process.net_connections()
            return len(connections)
        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError):
            return 0
    
    def get_context_switches(self, ps_process):
        """Get context switch information for the process"""
        try:
            ctx_switches = ps_process.num_ctx_switches()
            return {
                'voluntary': ctx_switches.voluntary,
                'involuntary': ctx_switches.involuntary
            }
        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError):
            return {
                'voluntary': 0,
                'involuntary': 0
            }