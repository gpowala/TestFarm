from datetime import datetime
from dataclasses import dataclass
from typing import Optional, Dict, Union, BinaryIO
import requests
from urllib.parse import urljoin
import socket
import psutil
import os
import codecs

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
    'get_next_test',
    'register_host',
    'unregister_host',
    'update_host_status',
    'complete_test',
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
            install_script=data['InstallScript'].encode('utf-8').decode('unicode_escape'),
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
class TestRun:
    id: int
    repository_name: str
    suite_name: str
    name: str
    grid_name: str
    creation_timestamp: datetime
    artifacts: Optional[list]

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
            creation_timestamp=datetime.fromisoformat(data['CreationTimestamp'].replace('Z', '+00:00')),
            artifacts=artifacts
        )

@dataclass
class TestResult:
    id: int
    test_run_id: int
    test_id: int
    status: str
    execution_start_timestamp: datetime
    execution_end_timestamp: Optional[datetime]
    execution_output: Optional[str]
    test_run: TestRun
    test: Test
    repository: Repository

    @staticmethod
    def from_dict(config: Config, data: dict) -> 'TestResult':
        return TestResult(
            id=data['Id'],
            test_run_id=data['TestRunId'],
            test_id=data['TestId'],
            status=data['Status'],
            execution_start_timestamp=datetime.fromisoformat(data['ExecutionStartTimestamp'].replace('Z', '+00:00')),
            execution_end_timestamp=datetime.fromisoformat(data['ExecutionEndTimestamp'].replace('Z', '+00:00')) if data['ExecutionEndTimestamp'] else None,
            execution_output=data['ExecutionOutput'],
            test_run=TestRun.from_dict(config, data['TestRun']),
            test=Test.from_dict(data['Test']),
            repository=Repository.from_dict(data['Repository'])
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

def get_next_test(config: Config) -> Optional[TestResult]:
    response = requests.get(
        url = urljoin(config.test_farm_api.base_url, "get-next-test"),
        params = {'GridName': config.grid.name},
        timeout = config.test_farm_api.timeout
    )
    
    return TestResult.from_dict(config, response.json()) if response.ok else None

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
