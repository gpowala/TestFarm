from datetime import datetime
from dataclasses import dataclass
from typing import Optional, Dict
import requests
from urllib.parse import urljoin
import socket
import psutil

from test_farm_service_config import Config, GridConfig, TestFarmApiConfig

__all__ = [
    'Repository',
    'Test',
    'TestRun',
    'TestResult',
    'Host',
    'get_next_test',
    'register_host',
    'unregister_host',
    'update_host_status'
]

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
    name: str
    owner: str
    creation_timestamp: datetime
    repository: Repository

    @staticmethod
    def from_dict(data: dict) -> 'Test':
        return Test(
            id=data['Id'],
            repository_name=data['RepositoryName'],
            suite_name=data['SuiteName'],
            name=data['Name'],
            owner=data['Owner'],
            creation_timestamp=datetime.fromisoformat(data['CreationTimestamp'].replace('Z', '+00:00')),
            repository=Repository.from_dict(data['Repository'])
        )

@dataclass
class TestRun:
    id: int
    repository_name: str
    suite_name: str
    name: str
    grid_name: str
    creation_timestamp: datetime

    @staticmethod
    def from_dict(data: dict) -> 'TestRun':
        return TestRun(
            id=data['Id'],
            repository_name=data['RepositoryName'],
            suite_name=data['SuiteName'],
            name=data['Name'],
            grid_name=data['GridName'],
            creation_timestamp=datetime.fromisoformat(data['CreationTimestamp'].replace('Z', '+00:00'))
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

    @staticmethod
    def from_dict(data: dict) -> 'TestResult':
        return TestResult(
            id=data['Id'],
            test_run_id=data['TestRunId'],
            test_id=data['TestId'],
            status=data['Status'],
            execution_start_timestamp=datetime.fromisoformat(data['ExecutionStartTimestamp'].replace('Z', '+00:00')),
            execution_end_timestamp=datetime.fromisoformat(data['ExecutionEndTimestamp'].replace('Z', '+00:00')) if data['ExecutionEndTimestamp'] else None,
            execution_output=data['ExecutionOutput'],
            test_run=TestRun.from_dict(data['TestRun']),
            test=Test.from_dict(data['Test'])
        )

def get_next_test(config: Config) -> Optional[TestResult]:
    response = requests.get(
        url = urljoin(config.test_farm_api.base_url, "tests/get-next-test"),
        params = {'GridName': config.grid.name},
        timeout = config.test_farm_api.timeout
    )
    
    return TestResult.from_dict(response.json()) if response.status_code == 200 else None

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
        params={"Id": host.Id},
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
