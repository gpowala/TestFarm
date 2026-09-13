import json
import os
from dataclasses import dataclass
from typing import List

__all__ = [
    'Config',
    'GridConfig',
    'LoggingConfig',
    'TestFarmApiConfig'
]

@dataclass
class TestFarmApiConfig:
    base_url: str
    timeout: int

@dataclass
class GridConfig:
    name: str
    capabilities: List[str]

@dataclass
class LoggingConfig:
    log_dir: str
    log_file: str
    max_log_size_bytes: int
    backup_count: int

    @property
    def log_path(self) -> str:
        return os.path.join(self.log_dir, self.log_file)

@dataclass
class Config:
    test_farm_api: TestFarmApiConfig
    grid: GridConfig
    logging: LoggingConfig

    @staticmethod
    def load_config(config_path: str) -> 'Config':
        with open(config_path, 'r') as f:
            config_data = json.load(f)

        api_config = TestFarmApiConfig(
            base_url=config_data['TestFarmApi']['BaseUrl'],
            timeout=config_data['TestFarmApi']['Timeout']
        )

        grid_config = GridConfig(
            name=config_data['Grid']['name'],
            capabilities=config_data['Grid']['capabilities']
        )

        logging_data = config_data.get('Logging', {})

        logging_config = LoggingConfig(
            log_dir=logging_data.get('LogDir', 'C:/logs/testfarm'),
            log_file=logging_data.get('LogFile', 'testfarm_executor.log'),
            max_log_size_bytes=int(logging_data.get('MaxLogSizeMb', 10)) * 1024 * 1024,
            backup_count=int(logging_data.get('BackupCount', 5))
        )

        return Config(
            test_farm_api=api_config,
            grid=grid_config,
            logging=logging_config
        )
