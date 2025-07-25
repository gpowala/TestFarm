from datetime import datetime
from dataclasses import dataclass
from typing import Optional, Dict, Union, BinaryIO
import requests
from urllib.parse import urljoin
import socket
import psutil
import os

from test_farm_service_config import Config, GridConfig, TestFarmApiConfig

__all__ = [
    'ArtifactDefinition',
    'Artifact',
    'Repository',
    'Test',
    'TestRun',
    'TestResult',
    'Host',
    'get_artifact',
    'get_next_job',
    'get_scheduled_test',
    'get_scheduled_benchmark',
    'register_host',
    'unregister_host',
    'update_host_status',
    'complete_test',
    'complete_benchmark',
    'upload_diff'
]

@dataclass
class ArtifactDefinition:
    id: int
    name: str
    install_script: str
    tags: Optional[list]

    @staticmethod
    def from_dict(data: dict) -> 'ArtifactDefinition':
        return ArtifactDefinition(
            id=data['Id'],
            name=data['Name'],
            install_script=data['InstallScript'],
            tags=data['Tags'] if 'Tags' in data and data['Tags'] else []
        )

@dataclass
class Artifact:
    id: int
    artifact_definition: ArtifactDefinition
    build_id: int
    build_name: str
    repository: str
    branch: str
    revision: str
    work_item_url: Optional[str]
    build_page_url: Optional[str]
    tags: Optional[list]

    @staticmethod
    def from_dict(data: dict) -> 'Artifact':
        return Artifact(
            id=data['Id'],
            artifact_definition=ArtifactDefinition.from_dict(data['ArtifactDefinition']),
            build_id=data['BuildId'],
            build_name=data['BuildName'],
            repository=data['Repository'],
            branch=data['Branch'],
            revision=data['Revision'],
            work_item_url=data['WorkItemUrl'],
            build_page_url=data['BuildPageUrl'],
            tags=data['Tags'] if 'Tags' in data and data['Tags'] else []
        )

@dataclass
class Host:
    id: int
    grid_id: int
    type: str
    status: str
    hostname: str
    cores: int
    ram: Optional[int]
    creation_timestamp: datetime
    last_update_timestamp: datetime
    
    @staticmethod
    def from_dict(data: dict) -> 'Host':
        return Host(
            id=data['Id'],
            grid_id=data['GridId'],
            type=data['Type'],
            status=data['Status'],
            hostname=data['Hostname'],
            cores=data['Cores'],
            ram=data['RAM'],
            creation_timestamp=datetime.fromisoformat(data['CreationTimestamp'].replace('Z', '+00:00')),
            last_update_timestamp=datetime.fromisoformat(data['LastUpdateTimestamp'].replace('Z', '+00:00'))
        )

@dataclass
class Repository:
    id: int
    name: str
    url: str
    user: str
    token: str
    is_active: bool

    @staticmethod
    def from_dict(data: dict) -> 'Repository':
        return Repository(
            id=data['Id'],
            name=data['Name'],
            url=data['Url'],
            user=data['User'],
            token=data['Token'],
            is_active=data['IsActive']
        )
    
@dataclass
class MicroJob:
    id: int
    type: str
    status: str
    grid_name: str
    run_id: int
    result_id: int

    @staticmethod
    def from_dict(data: dict) -> 'MicroJob':
        return MicroJob(
            id=data['Id'],
            type=data['Type'],
            status=data['Status'],
            grid_name=data['GridName'],
            run_id=data['RunId'],
            result_id=data['ResultId']
        )

@dataclass
class Test:
    id: int
    repository_name: str
    suite_name: str
    path: str
    name: str
    owner: str
    creation_timestamp: datetime

    @staticmethod
    def from_dict(data: dict) -> 'Test':
        return Test(
            id=data['Id'],
            repository_name=data['RepositoryName'],
            suite_name=data['SuiteName'],
            path=data['Path'],
            name=data['Name'],
            owner=data['Owner'],
            creation_timestamp=datetime.fromisoformat(data['CreationTimestamp'].replace('Z', '+00:00'))
        )
    
@dataclass
class Benchmark:
    id: int
    repository_name: str
    suite_name: str
    path: str
    name: str
    owner: str
    creation_timestamp: datetime

    @staticmethod
    def from_dict(data: dict) -> 'Benchmark':
        return Benchmark(
            id=data['Id'],
            repository_name=data['RepositoryName'],
            suite_name=data['SuiteName'],
            path=data['Path'],
            name=data['Name'],
            owner=data['Owner'],
            creation_timestamp=datetime.fromisoformat(data['CreationTimestamp'].replace('Z', '+00:00'))
        )

@dataclass
class TestRun:
    id: int
    repository_name: str
    suite_name: str
    name: str
    grid_name: str
    artifacts: list
    overall_creation_timestamp: datetime
    overall_status: str

    @staticmethod
    def from_dict(config: Config, data: dict) -> 'TestRun':
        artifacts_ids = data['Artifacts'] if 'Artifacts' in data and data['Artifacts'] else []

        artifacts = []
        for artifact_id in artifacts_ids:
            artifact = get_artifact(config, artifact_id)
            if artifact:
                artifacts.append(artifact)

        return TestRun(
            id=data['Id'],
            repository_name=data['RepositoryName'],
            suite_name=data['SuiteName'],
            name=data['Name'],
            grid_name=data['GridName'],
            artifacts=artifacts,
            overall_creation_timestamp=datetime.fromisoformat(data['OverallCreationTimestamp'].replace('Z', '+00:00')),
            overall_status=data['OverallStatus']
        )
    
@dataclass
class BenchmarkRun:
    id: int
    repository_name: str
    suite_name: str
    name: str
    grid_name: str
    artifacts: list
    overall_creation_timestamp: datetime
    overall_status: str

    @staticmethod
    def from_dict(config: Config, data: dict) -> 'BenchmarkRun':
        artifacts_ids = data['Artifacts'] if 'Artifacts' in data and data['Artifacts'] else []

        artifacts = []
        for artifact_id in artifacts_ids:
            artifact = get_artifact(config, artifact_id)
            if artifact:
                artifacts.append(artifact)

        return BenchmarkRun(
            id=data['Id'],
            repository_name=data['RepositoryName'],
            suite_name=data['SuiteName'],
            name=data['Name'],
            grid_name=data['GridName'],
            artifacts=artifacts,
            overall_creation_timestamp=datetime.fromisoformat(data['OverallCreationTimestamp'].replace('Z', '+00:00')),
            overall_status=data['OverallStatus']
        )

@dataclass
class TestResult:
    id: int
    test_run_id: int
    test_id: int
    status: str
    execution_start_timestamp: datetime
    test_run: TestRun
    test: Test
    repository: Repository

    # optional fields, not present until the test is completed
    execution_end_timestamp: Optional[datetime]
    execution_output: Optional[str]

    @staticmethod
    def from_dict(config: Config, data: dict) -> 'TestResult':
        return TestResult(
            id=data['Id'],
            test_run_id=data['TestRunId'],
            test_id=data['TestId'],
            status=data['Status'],
            execution_start_timestamp=datetime.fromisoformat(data['ExecutionStartTimestamp'].replace('Z', '+00:00')),
            test_run=TestRun.from_dict(config, data['TestRun']),
            test=Test.from_dict(data['Test']),
            repository=Repository.from_dict(data['Repository']),

            # optional fields
            execution_end_timestamp=datetime.fromisoformat(data['ExecutionEndTimestamp'].replace('Z', '+00:00')) if data['ExecutionEndTimestamp'] else None,
            execution_output=data['ExecutionOutput'] if data['ExecutionOutput'] else None,
        )
   
@dataclass
class BenchmarkResultJson:
    ############################################################################
    # This class is used to serialize the result of a benchmark execution to JSON.
    # It is not used to deserialize the data back from JSON.
    ############################################################################
    events: list
    metrics: list
    
    @dataclass
    class Event:
        name: str
        timestamp: str
    
    @dataclass
    class ProcessMetrics:
        cpu_percent: float = 0
        cpu_times_user: float = 0
        cpu_times_system: float = 0
        cpu_times_total: float = 0
        memory_rss: int = 0
        memory_vms: int = 0
        memory_percent: float = 0
        num_threads: int = 0
        fd_handle_count: int = 0
        io_read_count: int = 0
        io_write_count: int = 0
        io_read_bytes: int = 0
        io_write_bytes: int = 0
        network_bytes_sent: int = 0
        network_bytes_recv: int = 0
        network_packets_sent: int = 0
        network_packets_recv: int = 0
        network_connections: int = 0
        context_switches: int = 0
    
    @dataclass
    class SystemMetrics:
        cpu_percent: float = 0
        memory_total: int = 0
        memory_available: int = 0
        memory_used: int = 0
        memory_percent: float = 0
    
    @dataclass
    class Metric:
        timestamp: str
        elapsed_time: float = 0
        process: 'BenchmarkResultJson.ProcessMetrics' = None
        system: 'BenchmarkResultJson.SystemMetrics' = None
    
    @staticmethod
    def from_dict(data: dict) -> 'BenchmarkResultJson':
        result = BenchmarkResultJson()
        result.events = [BenchmarkResultJson.Event(name=e['name'], timestamp=e['timestamp']) for e in data.get('events', [])]

        result.metrics = []
        for m in data.get('metrics', []):
            process_data = m.get('process', {})
            system_data = m.get('system', {})
            
            process = BenchmarkResultJson.ProcessMetrics(
                cpu_percent=process_data['cpu_percent'],
                cpu_times_user=process_data['cpu_times_user'],
                cpu_times_system=process_data['cpu_times_system'],
                cpu_times_total=process_data['cpu_times_total'],
                memory_rss=process_data['memory_rss'],
                memory_vms=process_data['memory_vms'],
                memory_percent=process_data['memory_percent'],
                num_threads=process_data['num_threads'],
                fd_handle_count=process_data['fd_handle_count'],
                io_read_count=process_data['io_read_count'],
                io_write_count=process_data['io_write_count'],
                io_read_bytes=process_data['io_read_bytes'],
                io_write_bytes=process_data['io_write_bytes'],
                network_bytes_sent=process_data['network_bytes_sent'],
                network_bytes_recv=process_data['network_bytes_recv'],
                network_packets_sent=process_data['network_packets_sent'],
                network_packets_recv=process_data['network_packets_recv'],
                network_connections=process_data['network_connections'],
                context_switches=process_data['context_switches']
            )
            
            system = BenchmarkResultJson.SystemMetrics(
                cpu_percent=system_data['cpu_percent'],
                memory_total=system_data['memory_total'],
                memory_available=system_data['memory_available'],
                memory_used=system_data['memory_used'],
                memory_percent=system_data['memory_percent']
            )
            
            metric = BenchmarkResultJson.Metric(
                timestamp=m['timestamp'],
                elapsed_time=m['elapsed_time'],
                process=process,
                system=system
            )
            
            result.metrics.append(metric)
            
        return result
    
@dataclass
class BenchmarkResult:
    id: int
    benchmarks_run_id: int
    benchmark_id: int
    status: str
    execution_start_timestamp: datetime
    benchmark_run: BenchmarkRun
    benchmark: Benchmark
    repository: Repository

    # optional fields, not present until the benchmark is completed
    execution_end_timestamp: Optional[datetime]
    results: Optional[str]

    @staticmethod
    def from_dict(config: Config, data: dict) -> 'BenchmarkResult':
        return BenchmarkResult(
            id=data['Id'],
            benchmarks_run_id=data['BenchmarksRunId'],
            benchmark_id=data['BenchmarkId'],
            status=data['Status'],
            execution_start_timestamp=datetime.fromisoformat(data['ExecutionStartTimestamp'].replace('Z', '+00:00')),
            benchmark_run=data['BenchmarkRun'],
            benchmark=Benchmark.from_dict(data['Benchmark']),
            repository=Repository.from_dict(data['Repository']),

            # optional fields
            execution_end_timestamp=datetime.fromisoformat(data['ExecutionEndTimestamp'].replace('Z', '+00:00')) if data['ExecutionEndTimestamp'] else None,
            results=data['Results'] if data['Results'] else None,
        )

def get_artifact(config: Config, artifact_id: int) -> Optional[Artifact]:
    response = requests.get(
        url=urljoin(config.test_farm_api.base_url, "artifact"),
        params={'id': artifact_id},
        timeout=config.test_farm_api.timeout
    )
    
    if response.ok:
        return Artifact.from_dict(response.json())
    else:
        return None

def get_next_job(config: Config) -> Optional[MicroJob]:
    response = requests.get(
        url = urljoin(config.test_farm_api.base_url, "get-next-job"),
        params = {'GridName': config.grid.name},
        timeout = config.test_farm_api.timeout
    )

    return MicroJob.from_dict(response.json()) if response.ok else None

def get_scheduled_test(config: Config, job: MicroJob) -> Optional[TestResult]:
    response = requests.get(
        url = urljoin(config.test_farm_api.base_url, "get-scheduled-test"),
        params = {'TestResultId': job.result_id},
        timeout = config.test_farm_api.timeout
    )
    
    return TestResult.from_dict(config, response.json()) if response.ok else None

def get_scheduled_benchmark(config: Config, job: MicroJob) -> Optional[BenchmarkResult]:
    response = requests.get(
        url = urljoin(config.test_farm_api.base_url, "get-scheduled-benchmark"),
        params = {'BenchmarkResultId': job.result_id},
        timeout = config.test_farm_api.timeout
    )

    return BenchmarkResult.from_dict(config, response.json()) if response.ok else None

def get_system_info(config: Config) -> Dict[str, any]:
    hostname = socket.gethostname()
    ram_gb = round(psutil.virtual_memory().total / (1024 * 1024 * 1024))  # Convert to GB
    cpu_cores = psutil.cpu_count(logical=False)  # Physical cores
    
    return {
        "Hostname": hostname,
        "RAM": ram_gb,
        "Cores": cpu_cores,
        "Type": "tests"
    }

def register_host(config: Config) -> Host:
    url = urljoin(config.test_farm_api.base_url, "register-host")
    system_info = get_system_info(config)
    payload = { "GridName": config.grid.name, **system_info }

    response = requests.post(
        url=url,
        json=payload,
        timeout=config.test_farm_api.timeout
    )
    
    if response.ok:
        # print(response.json())
        return Host.from_dict(response.json())
    else:
        raise RuntimeError(f"Failed to register host with status code: {response.status_code} and message: {response.reason}")

def unregister_host(host: Host, config: Config):
    url = urljoin(config.test_farm_api.base_url, "unregister-host")

    response = requests.get(
        url=url,
        params={"Id": host.id},
        timeout=config.test_farm_api.timeout
    )
    
    if not response.ok:
        raise RuntimeError(f"Failed to unregister host with status code: {response.status_code} and message: {response.reason}")

def update_host_status(status: str, host: Host, config: Config):
    url = urljoin(config.test_farm_api.base_url, "update-host-status")
    payload = { "Id": host.id, "Status": status }

    response = requests.post(
        url=url,
        json=payload,
        timeout=config.test_farm_api.timeout
    )
    
    if not response.ok:
        raise RuntimeError(f"Failed to update host status with status code: {response.status_code} and message: {response.reason}")
    
def complete_test(test_result: TestResult, status: str, execution_output: str, config: Config):
    url = urljoin(config.test_farm_api.base_url, "complete-test")
    
    payload = {
        "TestResultId": test_result.id, 
        "Status": status, 
        "ExecutionOutput": execution_output
    }
    
    response = requests.post(
        url=url,
        json=payload,
        timeout=config.test_farm_api.timeout
    )
    
    if not response.ok:
        raise RuntimeError(f"Failed to complete test result with status code: {response.status_code} and message: {response.reason}")
    
def complete_benchmark(benchmark_result: BenchmarkResult, result: BenchmarkResultJson, config: Config):
    url = urljoin(config.test_farm_api.base_url, "complete-benchmark")
    
    payload = {
        "BenchmarkResultId": benchmark_result.id,
        "Result": result
    }
    
    response = requests.post(
        url=url,
        json=payload,
        timeout=config.test_farm_api.timeout
    )
    
    if not response.ok:
        raise RuntimeError(f"Failed to complete benchmark result with status code: {response.status_code} and message: {response.reason}")

def upload_diff(test_result: TestResult, name: str, status: str, config: Config, report_file_path: Optional[str] = None):
    url = urljoin(config.test_farm_api.base_url, "upload-diff")
    
    form_data = {
        'TestResultId': str(test_result.id),
        'Name': name,
        'Status': status
    }
    
    files = {}
    
    if report_file_path and os.path.exists(report_file_path):
        files = {
            'report': (os.path.basename(report_file_path), 
                      open(report_file_path, 'rb'), 
                      'application/octet-stream')
        }
    
    response = requests.post(
        url=url,
        data=form_data,
        files=files,
        timeout=config.test_farm_api.timeout
    )
    
    if files and 'report' in files:
        files['report'][1].close()
    
    if not response.ok:
        raise RuntimeError(f"Failed to upload diff with status code: {response.status_code} and message: {response.reason}")
    
def upload_temp_dir_archive(test_result: TestResult, config: Config, archive_file_path: str = None):
    url = urljoin(config.test_farm_api.base_url, "upload-temp-dir-archive")
    
    form_data = {
        'TestResultId': str(test_result.id)
    }
    
    files = {}
    
    if archive_file_path and os.path.exists(archive_file_path):
        files = {
            'archive': (os.path.basename(archive_file_path), 
                      open(archive_file_path, 'rb'), 
                      'application/octet-stream')
        }
    
    response = requests.post(
        url=url,
        data=form_data,
        files=files,
        timeout=config.test_farm_api.timeout
    )
    
    if files and 'archive' in files:
        files['archive'][1].close()
    
    if not response.ok:
        raise RuntimeError(f"Failed to upload temp dir archive with status code: {response.status_code} and message: {response.reason}")
