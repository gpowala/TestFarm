import os
import json
from git import Repo
import requests
from datetime import datetime
from dataclasses import dataclass
from typing import Optional, List
from urllib.parse import urljoin
import time
import win32serviceutil
import win32event
import logging
import sys
import subprocess
import difflib
import chardet
import sys
import py7zr
import shutil
from testfarm_agents_utils import *
from testfarm_benchmarks_utils import *

from test_farm_tests import DiffPair, TestCase, BenchmarkCase
from test_farm_api import get_artifact, get_next_job, get_scheduled_test, get_scheduled_benchmark, register_host, unregister_host, update_host_status, complete_test, complete_benchmark, upload_diff, upload_benchmark_results, upload_temp_dir_archive, Repository, MicroJob
from test_farm_service_config import Config, GridConfig, TestFarmApiConfig
from logging.handlers import RotatingFileHandler

class TestFarmWindowsService(win32serviceutil.ServiceFramework):
    _svc_name_ = "TestFarm"
    _svc_display_name_ = "TestFarm Windows Service"
    _svc_description_ = "TestFarm tests and benchmarks executing service."

    def __init__(self, args):
        self._isDebugModeOn = False
        self.setup()
        
        super().__init__(args)
        self.create_win32_event()

    def __init__(self):
        self._isDebugModeOn = True
        self.setup()

    def setup(self):
        self._running = False
        self._host = None
        self._config = None

        self.setup_config()
        self.setup_logging() 

    def create_win32_event(self):
        if not self._isDebugModeOn:
            self._hWaitStop = win32event.CreateEvent(None, 0, 0, None)

    def set_win32_event(self):
        if not self._isDebugModeOn:
            assert self._hWaitStop is not None, "Win32 event must be initialized before setting it."
            win32event.SetEvent(self._hWaitStop)

    def setup_config(self):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(script_dir, 'config.json')
        self._config = Config.load_config(config_path)

    def setup_logging(self):
        assert self._config is not None, "Configuration must be initialized before setting up logging."

        os.makedirs(self._config.logging.log_dir, exist_ok=True)
        
        log_file = os.path.join(self._config.logging.log_dir, "testfarm_service.log")
        
        if self._isDebugModeOn:
            log_handler = logging.StreamHandler(sys.stdout)
            logging.info("Debug mode: logging to console")
        else:
            log_handler = RotatingFileHandler(
            filename=log_file,
            maxBytes=10*1024*1024,
            backupCount=5,
            )
        log_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)
        
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
            
        root_logger.addHandler(log_handler)
        
        logging.info(f"Logging initialized to: {log_file}")

    def clone_repository(self, repository: Repository) -> str:
        logging.info(f"Fetching {repository.name} tests repository...")

        local_repository_dir = expand_magic_variables(f"$__TF_TESTS_REPOS_DIR__/{repository.name}")

        if not os.path.exists(local_repository_dir):
            os.makedirs(local_repository_dir, exist_ok=True)

        connection_string = f"https://{repository.user}:{repository.token}@{repository.url.replace('https://', '')}"

        if os.path.exists(os.path.join(local_repository_dir, ".git")):
            logging.info(f"Repository already exists. Pulling latest changes...")
            
            repo = Repo(local_repository_dir)
            
            origin = repo.remotes.origin
            origin.set_url(connection_string)
            origin.pull()
            
            logging.info(f"Successfully pulled latest changes")
        else:
            logging.info(f"Repository does not exist. Cloning new repository...")

            Repo.clone_from(connection_string, local_repository_dir)
            
            logging.info(f"Successfully cloned new repository")

        return local_repository_dir

    def SvcStop(self):
        self._running = False
        win32event.SetEvent(self._hWaitStop)

        logging.info("TestFarm service is stopping...")
        
        if self._host:
            try:
                logging.info(f"TestFarm service is stopping on host: {self._host.hostname}")
                
                update_host_status("Offline", self._host, self._config)
                logging.info(f"Host {self._host.hostname} status set to \"Offline\"")
                
                unregister_host(self._host, self._config)
                logging.info(f"Host {self._host.hostname} successfully unregistered")
            except Exception as e:
                logging.error(f"Error during host shutdown: {e}")

    def install_artifacts(self, artifacts):
        if artifacts is None or len(artifacts) == 0:
            logging.info("No artifacts to install.")
            return 0
        
        overall_exit_code = -1

        for artifact in artifacts:
            try:
                logging.info(f"Preparing install script for artifact: {artifact.artifact_definition.name} (Build Name: {artifact.build_name} Build ID: {artifact.build_id})")

                script_path = expand_magic_variables("$__TF_TEMP_DIR__/artifact_install_script.py")

                with open(script_path, 'w') as script_file:
                    script_file.write(artifact.artifact_definition.install_script)

                logging.info(f"Executing install script: {script_path}")
                exit_code = os.system(f"python {script_path} --build {artifact.build_id} --hostname {self._host.hostname} --timeout 60")
                
                if exit_code != 0:
                    logging.error(f"Install script failed with exit code {exit_code}")
                    overall_exit_code = exit_code
                else:
                    logging.info("Install script executed successfully")
                    overall_exit_code = 0

            except Exception as e:
                logging.error(f"Error executing artifact install script: {e}")
                overall_exit_code = -1

            finally:
                if os.path.exists(script_path):
                    try:
                        os.remove(script_path)
                    except:
                        break

        return overall_exit_code

    def SvcDoRun(self):
        assert self._config is not None, "Configuration must be initialized before service startup."

        logging.info(f"TestFarm service is starting for grid: {self._config.grid.name}")
        logging.info(f"TestFarm API URL: {self._config.test_farm_api.base_url}")

        logging.info(f"Magic variables:\n{stringify_magic_variables()}")

        self._host = register_host(self._config)
        assert self._host is not None, "Host must be initialized upon service startup."
        logging.info(f"Host registered successfully with hostname: {self._host.hostname} and id: {self._host.id}")

        update_host_status("Waiting for tests...", self._host, self._config)
        logging.info(f"Host {self._host.hostname} status set to \"Waiting for tests...\"")
        
        self._running = True
        logging.info(f"Processing loop started.")

        current_test_run_id = -1

        while self._running:
            try:
                job = get_next_job(self._config)
                if job and job.type == "test":
                    test = get_scheduled_test(self._config, job)

                    if not test:
                        logging.warning(f"No scheduled test found for job: {job.id}")
                        continue

                    self.cleanup_temp_dir()

                    logging.info(f"Received test: {test.test.name} (ID: {test.id})")
                    local_repository_dir = self.clone_repository(test.repository)
                    
                    test_description_file = f"{local_repository_dir}/{test.test.path}/test.testfarm"
                    logging.info(f"Looking for test description under {test_description_file}...")
                    
                    if not os.path.exists(test_description_file):
                        raise FileNotFoundError(f"Test description file does not exist: {test_description_file}")

                    logging.info(f"Found test description file: {test_description_file}")

                    test_case = TestCase.from_file(test_description_file)

                    if current_test_run_id != test.test_run.id:
                        update_host_status("Installing artifacts...", self._host, self._config)
                        logging.info(f"Installing artifacts for test run: {test.test_run.name} (ID: {test.test_run.id})")

                        if self.install_artifacts(test.test_run.artifacts) != 0:
                            update_host_status("Failed to install artifacts", self._host, self._config)
                            logging.error(f"Artifact installation failed for test run: {test.test_run.name} (ID: {test.test_run.id})")

                            complete_test(test, "failed", self.read_execution_output(test_case), self._config)
                            logging.info("Test FAILED!")

                            self.cleanup_temp_dir()
                            continue
                        else:
                            logging.info("Artifacts installation succeeded.")
                            current_test_run_id = test.test_run.id

                            self.cleanup_temp_dir()

                    update_host_status("Running test...", self._host, self._config)

                    env = os.environ.copy()
                    env["PYTHONPATH"] = f"{local_repository_dir};{env.get('PYTHONPATH', '')}"
                    logging.debug(f"env: {env}")

                    new_working_dir = os.path.dirname(test_description_file)
                    logging.debug(f"cwd: {new_working_dir}")
                    
                    for pre_bench_step in test_case.pre_steps:
                        expanded_pre_step = expand_magic_variables(pre_bench_step)
                        logging.info(f"Executing pre-step: {expanded_pre_step}")

                        self.execute_command(expanded_pre_step, env, new_working_dir)

                    expanded_benchmark_command = expand_magic_variables(test_case.command)    
                    logging.info(f"Executing test command: {expanded_benchmark_command}")

                    self.execute_command(expanded_benchmark_command, env, new_working_dir)
                        
                    for post_step in test_case.post_steps:
                        expanded_post_step = expand_magic_variables(post_step)
                        logging.info(f"Executing post-step: {expanded_post_step}")

                        self.execute_command(expanded_post_step, env, new_working_dir)

                    test_passed = True

                    for diff in test_case.diffs:
                        diff_name = os.path.splitext(os.path.basename(diff.gold))[0]

                        gold_file = f"{new_working_dir}/{diff.gold}"
                        if not os.path.exists(gold_file):
                            test_passed = False
                            upload_diff(test, diff_name, "no gold file", self._config)

                            logging.info(f"Gold file {gold_file} not found!")
                            continue
                        
                        new_file = expand_magic_variables(diff.new)
                        if not os.path.exists(new_file):
                            test_passed = False
                            upload_diff(test, diff_name, "no new file", self._config)

                            logging.info(f"New file {new_file} not found!")
                            continue

                        report_file = expand_magic_variables(f"$__TF_WORK_DIR__/{diff_name}.html")
                        self.generate_html_diff(gold_file, new_file, report_file, diff.encoding)

                        # Check if the diff report is not empty
                        if os.path.getsize(report_file) > 0:
                            logging.info(f"Differences found in {diff.gold} vs {diff.new}")
                            logging.info(f"HTML difference report generated: {report_file}")
                            test_passed = False
                            upload_diff(test, diff_name, "failed", self._config, report_file)
                        else:
                            logging.info(f"No differences found in {diff.gold} vs {diff.new}")
                            upload_diff(test, diff_name, "passed", self._config)

                    # Archive temp directory contents
                    temp_dir = expand_magic_variables("$__TF_WORK_DIR__")
                    archive_path = expand_magic_variables(f"$__TF_TEMP_DIR__/result_temp_archive.7z")
                    logging.info(f"Archiving contents of {temp_dir} to {archive_path}")
                    
                    try:
                        with py7zr.SevenZipFile(archive_path, mode='w') as archive:
                            for root, dirs, files in os.walk(temp_dir):
                                for file in files:
                                    file_path = os.path.join(root, file)
                                    archive_name = os.path.relpath(file_path, temp_dir)
                                    archive.write(file_path, archive_name)

                        upload_temp_dir_archive(test, self._config, archive_path)
                        logging.info(f"Successfully created archive at {archive_path} and uploaded")
                    except Exception as e:
                        logging.error(f"Failed to create or upload archive: {e}")

                    if test_passed:
                        logging.info("Test PASSED! Publishing results...")
                        complete_test(test, "passed", self.read_execution_output(test_case), self.read_atomic_results(test_case), self._config)
                    else:
                        logging.info("Test FAILED! Publishing results...")
                        complete_test(test, "failed", self.read_execution_output(test_case), self.read_atomic_results(test_case), self._config)

                    logging.info("Test completed.")

                elif job and job.type == "bench":
                    benchmark = get_scheduled_benchmark(self._config, job)

                    if not benchmark:
                        logging.warning(f"No scheduled benchmark found for job: {job.id}")
                        continue

                    self.cleanup_temp_dir()

                    logging.info(f"Received benchmark: {benchmark.benchmark.name} (ID: {benchmark.id})")
                    local_repository_dir = self.clone_repository(benchmark.repository)

                    benchmark_description_file = f"{local_repository_dir}/{benchmark.benchmark.path}/benchmark.testfarm"
                    logging.info(f"Looking for benchmark description under {benchmark_description_file}...")

                    if not os.path.exists(benchmark_description_file):
                        raise FileNotFoundError(f"Benchmark description file does not exist: {benchmark_description_file}")

                    logging.info(f"Found benchmark description file: {benchmark_description_file}")

                    benchmark_case = BenchmarkCase.from_file(benchmark_description_file)

                    #TODO: Implement common current run ID or switch completelly to installed artifacts recognition.
                    if current_test_run_id != benchmark.benchmark_run.id:
                        update_host_status("Installing artifacts...", self._host, self._config)
                        logging.info(f"Installing artifacts for benchmark run: {benchmark.benchmark_run.name} (ID: {benchmark.benchmark_run.id})")

                        if self.install_artifacts(benchmark.benchmark_run.artifacts) != 0:
                            update_host_status("Failed to install artifacts", self._host, self._config)
                            logging.error(f"Artifact installation failed for benchmark run: {benchmark.benchmark_run.name} (ID: {benchmark.benchmark_run.id})")

                            complete_test(benchmark, "failed", self.read_execution_output(benchmark_case), self._config)
                            logging.info("Benchmark FAILED!")

                            self.cleanup_temp_dir()
                            continue
                        else:
                            logging.info("Artifacts installation succeeded.")
                            current_test_run_id = benchmark.benchmark_run.id

                            self.cleanup_temp_dir()

                    update_host_status("Running benchmark...", self._host, self._config)

                    env = os.environ.copy()
                    env["PYTHONPATH"] = f"{local_repository_dir};{env.get('PYTHONPATH', '')}"
                    logging.debug(f"env: {env}")

                    new_working_dir = os.path.dirname(benchmark_description_file)
                    logging.debug(f"cwd: {new_working_dir}")

                    for pre_bench_step in benchmark_case.pre_bench_steps:
                        expanded_pre_step = expand_magic_variables(pre_bench_step)
                        logging.info(f"Executing pre-bench-step: {expanded_pre_step}")

                        self.execute_command(expanded_pre_step, env, new_working_dir)

                    for iteration in range(benchmark_case.iterations):
                        logging.info(f"Starting iteration {iteration + 1} of {benchmark_case.iterations}")

                        for pre_iter_step in benchmark_case.pre_iter_steps:
                            expanded_pre_iter_step = expand_magic_variables(pre_iter_step)
                            logging.info(f"Executing pre-iter-step: {expanded_pre_iter_step}")

                            self.execute_command(expanded_pre_iter_step, env, new_working_dir)

                        expanded_benchmark_command = expand_magic_variables(benchmark_case.command)
                        logging.info(f"Executing test command: {expanded_benchmark_command}")

                        self.execute_command(expanded_benchmark_command, env, new_working_dir)

                        for post_iter_step in benchmark_case.post_iter_steps:
                            expanded_post_iter_step = expand_magic_variables(post_iter_step)
                            logging.info(f"Executing post-iter-step: {expanded_post_iter_step}")

                            self.execute_command(expanded_post_iter_step, env, new_working_dir)

                        logging.info(f"Iteration {iteration + 1} of {benchmark_case.iterations} completed")

                        incr_bench_iter()

                    for post_bench_step in benchmark_case.post_bench_steps:
                        expanded_post_step = expand_magic_variables(post_bench_step)
                        logging.info(f"Executing post-bench-step: {expanded_post_step}")

                        self.execute_command(expanded_post_step, env, new_working_dir)

                    logging.info("Benchmark finished! Publishing results...")

                    complete_benchmark(benchmark, self._config)

                    expanded_results = expand_magic_variables(benchmark_case.results)
                    upload_benchmark_results(benchmark, self._config, expanded_results)

                    # test_passed = True

                    # for diff in test_case.diffs:
                    #     diff_name = os.path.splitext(os.path.basename(diff.gold))[0]

                    #     gold_file = f"{new_working_dir}/{diff.gold}"
                    #     if not os.path.exists(gold_file):
                    #         test_passed = False
                    #         upload_diff(test, diff_name, "no gold file", self._config)

                    #         logging.info(f"Gold file {gold_file} not found!")
                    #         continue
                        
                    #     new_file = expand_magic_variables(diff.new)
                    #     if not os.path.exists(new_file):
                    #         test_passed = False
                    #         upload_diff(test, diff_name, "no new file", self._config)

                    #         logging.info(f"New file {new_file} not found!")
                    #         continue

                    #     report_file = expand_magic_variables(f"$__TF_WORK_DIR__/{diff_name}.html")
                    #     self.generate_html_diff(gold_file, new_file, report_file, diff.encoding)

                    #     # Check if the diff report is not empty
                    #     if os.path.getsize(report_file) > 0:
                    #         logging.info(f"Differences found in {diff.gold} vs {diff.new}")
                    #         logging.info(f"HTML difference report generated: {report_file}")
                    #         test_passed = False
                    #         upload_diff(test, diff_name, "failed", self._config, report_file)
                    #     else:
                    #         logging.info(f"No differences found in {diff.gold} vs {diff.new}")
                    #         upload_diff(test, diff_name, "passed", self._config)

                    # Archive temp directory contents
                    # temp_dir = expand_magic_variables("$__TF_WORK_DIR__")
                    # archive_path = expand_magic_variables(f"$__TF_TEMP_DIR__/result_temp_archive.7z")
                    # logging.info(f"Archiving contents of {temp_dir} to {archive_path}")
                    
                    # try:
                    #     with py7zr.SevenZipFile(archive_path, mode='w') as archive:
                    #         for root, dirs, files in os.walk(temp_dir):
                    #             for file in files:
                    #                 file_path = os.path.join(root, file)
                    #                 archive_name = os.path.relpath(file_path, temp_dir)
                    #                 archive.write(file_path, archive_name)

                    #     upload_temp_dir_archive(test, self._config, archive_path)
                    #     logging.info(f"Successfully created archive at {archive_path} and uploaded")
                    # except Exception as e:
                    #     logging.error(f"Failed to create or upload archive: {e}")

                    # complete_test(test, "passed", self.read_execution_output(test_case), self._config)
                    # if test_passed:
                    #     logging.info("Test PASSED! Publishing results...")
                    #     complete_test(test, "passed", self.read_execution_output(test_case), self._config)
                    # else:
                    #     logging.info("Test FAILED! Publishing results...")
                    #     complete_test(test, "failed", self.read_execution_output(test_case), self._config)

                    logging.info("Benchmark completed.")
                else:
                    time.sleep(60)
            except Exception as e:
                logging.error(f"Error processing test: {e}")
            finally:
                update_host_status("Waiting for tests...", self._host, self._config)
                logging.info(f"Host {self._host.hostname} status set to \"Waiting for tests...\"")
        
        logging.info("TestFarm service has stopped.")

    def cleanup_temp_dir(self):
        temp_dir = expand_magic_variables("$__TF_WORK_DIR__")
        logging.info(f"Cleaning up temp directory: {temp_dir}")
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                logging.info(f"Removed existing temp directory")
            except Exception as e:
                logging.error(f"Error cleaning up temp directory: {e}")

        try:
            os.makedirs(temp_dir, exist_ok=True)
            logging.info(f"Created empty temp directory at {temp_dir}")
        except Exception as e:
            logging.error(f"Failed to create temp directory: {e}")
    
    def execute_command(self, command: str, env: str, cwd: str) -> None:
        try:
            subprocess.run(command, shell=True, check=True, 
                          env=env, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Command execution failed! Exit code: {e.returncode}\n"
                         f"stdout: {e.stdout.decode('utf-8', errors='replace')}\n"
                         f"stderr: {e.stderr.decode('utf-8', errors='replace')}")
        except FileNotFoundError:
            raise RuntimeError(f"Command not found or could not be executed!")
        except Exception as e:
            raise RuntimeError(f"Command execution failed! Details: {e}")
        
    def read_execution_output(self, test_case: TestCase) -> str:
        output_file_path = expand_magic_variables(test_case.output)

        if os.path.exists(output_file_path):
            try:
                with open(output_file_path, 'r', encoding='utf-8', errors='replace') as output_file:
                    return output_file.read()
            except Exception as e:
                raise RuntimeError(f"Error reading execution output file {output_file_path}: {e}")
        else:
            raise RuntimeError(f"Execution output file not found: {output_file_path}")
        
    def read_atomic_results(self, test_case: TestCase) -> str:
        if not test_case.atomic_results:
            return ""
        
        atomic_results_file_path = expand_magic_variables(test_case.atomic_results)

        if os.path.exists(atomic_results_file_path):
            try:
                print(f"Reading atomic results file: {atomic_results_file_path}")
                with open(atomic_results_file_path, 'r', encoding='utf-8', errors='replace') as atomic_results_file:
                    return atomic_results_file.read()
            except Exception as e:
                raise RuntimeError(f"Error reading atomic results file {atomic_results_file_path}: {e}")
        else:
            return ""

    def detect_encoding(self, file_path):
        with open(file_path, 'rb') as f:
            raw_data = f.read()
            result = chardet.detect(raw_data)
        return result['encoding'] if result['encoding'] else 'utf-8'  # Default to UTF-8 if unknown

    def generate_html_diff(self, gold_file: str, new_file: str, report_file: str, encoding: str):
        # gold_encoding = self.detect_encoding(gold_file)
        # new_encoding = self.detect_encoding(new_file)
        
        with open(gold_file, 'r', encoding=encoding, errors='replace') as f1, open(new_file, 'r', encoding=encoding, errors='replace') as f2:
            gold_content = f1.readlines()
            new_content = f2.readlines()

        differ = difflib.unified_diff(gold_content, new_content, fromfile=gold_file, tofile=new_file, lineterm='', n=10)
        
        diff_lines = list(differ)
        diff_lines = [line for line in diff_lines if not line.startswith('---') and not line.startswith('+++')]

        if not diff_lines:
            open(report_file, 'w').close()
            return

        html_content = f"""
            <html>
                <head>
                    <title>File Differences [Gold File: {gold_file} vs New File: {new_file}]</title>
                    <style>
                        body {{ font-family: Arial, sans-serif; margin: 20px; }}
                        table {{ width: 100%; border: 1px solid #ddd; }}
                        th, td {{ padding: 2px; font-family: monospace; white-space: pre; }}
                        th {{ background-color: #f4f4f4; }}
                        .added {{ background-color: #d4fcbc; }} /* Green */
                        .removed {{ background-color: #ffdddd; }} /* Red */
                        .context {{ background-color: #f8f8f8; }} /* Gray */
                        .view-buttons {{ margin-bottom: 15px; }}
                        .view-buttons button {{ padding: 8px 15px; margin-right: 10px; cursor: pointer; }}
                        .active-view {{ background-color: #007bff; color: white; border: none; }}
                        .inactive-view {{ background-color: #f8f8f8; border: 1px solid #ddd; }}
                        .hidden {{ display: none; }}
                    </style>
                    <script>
                        function switchView(viewName) {{
                            // Hide all views
                            document.getElementById('side-by-side-view').classList.add('hidden');
                            document.getElementById('unified-view').classList.add('hidden');
                            
                            // Show selected view
                            document.getElementById(viewName).classList.remove('hidden');
                            
                            // Update button styles
                            if (viewName === 'side-by-side-view') {{
                                document.getElementById('side-by-side-btn').classList.add('active-view');
                                document.getElementById('side-by-side-btn').classList.remove('inactive-view');
                                document.getElementById('unified-btn').classList.add('inactive-view');
                                document.getElementById('unified-btn').classList.remove('active-view');
                            }} else {{
                                document.getElementById('unified-btn').classList.add('active-view');
                                document.getElementById('unified-btn').classList.remove('inactive-view');
                                document.getElementById('side-by-side-btn').classList.add('inactive-view');
                                document.getElementById('side-by-side-btn').classList.remove('active-view');
                            }}
                        }}
                    </script>
                </head>
                <body>
                    <h2>File Difference Report</h2>
                    <div class="view-buttons">
                        <button id="side-by-side-btn" class="active-view" onclick="switchView('side-by-side-view')">Side by Side View</button>
                        <button id="unified-btn" class="inactive-view" onclick="switchView('unified-view')">Unified View</button>
                    </div>
                    
                    <div id="side-by-side-view">
                        <table>
                            <tr><th>Gold File: {gold_file}</th><th>New File: {new_file}</th></tr>
        """
        
        # Process lines for side-by-side view
        line_size_limit = 5000

        left_side = []
        right_side = []

        identical_lines = []
        
        for line in diff_lines:
            if line.startswith('-'):
                self.append_identical_lines(left_side, right_side, identical_lines)

                left_side.append(f'<td class="removed">- {line[1:].rstrip()}</td>')
                right_side.append('<td></td>')
            elif line.startswith('+'):
                self.append_identical_lines(left_side, right_side, identical_lines)

                left_side.append('<td></td>')
                right_side.append(f'<td class="added">+ {line[1:].rstrip()}</td>')
            else:
                identical_lines.append(line)

            line_size_limit = line_size_limit - 1
            if line_size_limit <= 0:
                left_side.append(f'<td class="context">... diff content is limited to {5000} ...</td>')
                right_side.append(f'<td class="context">... diff content is limited to {5000} ...</td>')
                break

        self.append_identical_lines(left_side, right_side, identical_lines)

        # Add side-by-side rows
        for left, right in zip(left_side, right_side):
            html_content += f"<tr>{left}{right}</tr>\n"

        # Close the side-by-side table and start unified view
        html_content += """
                        </table>
                    </div>
                    
                    <div id="unified-view" class="hidden">
                        <table>
                            <tr><th>Unified Diff View</th></tr>
        """
        
        # Process lines for unified view
        for line in diff_lines:
            if line.startswith('-'):
                html_content += f'<tr><td class="removed">- {line[1:].rstrip()}</td></tr>\n'
            elif line.startswith('+'):
                html_content += f'<tr><td class="added">+ {line[1:].rstrip()}</td></tr>\n'
            else:
                html_content += f'<tr><td class="context">{line}</td></tr>\n'

        # Close the unified table and finish the HTML
        html_content += """
                        </table>
                    </div>
                </body>
            </html>
        """

        with open(report_file, 'w', encoding='utf-8', errors='replace') as f:
            f.write(html_content)

    def append_identical_lines(self, left_side, right_side, identical_lines):
        if len(identical_lines) > 0 and len(identical_lines) < 10:
            for line in identical_lines:
                left_side.append(f'<td class="context">{line}</td>')
                right_side.append(f'<td class="context">{line}</td>')
        elif len(identical_lines) >= 10:
            for i in range(5):
                left_side.append(f'<td class="context">{identical_lines[i]}</td>')
                right_side.append(f'<td class="context">{identical_lines[i]}</td>')
                    
            left_side.append(f'<td class="context">... {len(identical_lines) - 10} more identical lines ...</td>')
            right_side.append(f'<td class="context">... {len(identical_lines) - 10} more identical lines ...</td>')
                    
            for i in range(len(identical_lines) - 5, len(identical_lines)):
                left_side.append(f'<td class="context">{identical_lines[i]}</td>')
                right_side.append(f'<td class="context">{identical_lines[i]}</td>')

        identical_lines.clear()
