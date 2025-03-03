import json
from dataclasses import dataclass
from typing import List

__all__ = [
    'Config',
    'GridConfig',
    'TestFarmApiConfig',
    'LoggingConfig'
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
        
        logging_config = LoggingConfig(
            log_dir=config_data['Logging']['LogDir']
        )
        
        return Config(
            test_farm_api=api_config,
            grid=grid_config,
            logging=logging_config
        )