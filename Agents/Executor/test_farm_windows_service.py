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
from testfarm_agents_utils import *

from test_farm_api import get_next_test, register_host, unregister_host, update_host_status, Host, Repository
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
        local_repository_dir = expand_magic_variables(f"$__TF_TESTS_REPOS_DIR__/{repository.name}")

        if not os.path.exists(local_repository_dir):
            os.makedirs(local_repository_dir, exist_ok=True)

        connection_string = f"https://{repository.user}:{repository.token}@{repository.url.replace('https://', '')}"
        Repo.clone_from(connection_string, local_repository_dir)

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

    def SvcDoRun(self):
        assert self._config is not None, "Configuration must be initialized before service startup."

        logging.info(f"TestFarm service is starting for grid: {self._config.grid.name}")
        logging.info(f"TestFarm API URL: {self._config.test_farm_api.base_url}")

        self._host = register_host(self._config)
        assert self._host is not None, "Host must be initialized upon service startup."
        logging.info(f"Host registered successfully with hostname: {self._host.hostname} and id: {self._host.id}")

        update_host_status("Waiting for tests...", self._host, self._config)
        logging.info(f"Host {self._host.hostname} status set to \"Waiting for tests...\"")
        
        self._running = True
        logging.info(f"Processing loop started.")

        while self._running:
            try:
                test = get_next_test(self._config)
                if test:
                    logging.info(f"Received test: {test.test.name} (ID: {test.id})")

                    logging.info(f"Cloning {test.repository.name} tests repository...")
                    local_repository_dir = self.clone_repository(test.repository)
                    
                    logging.info(f"Repository cloned to {local_repository_dir}. Looking for test description...")

                    # env = os.environ.copy()
                    # env["PYTHONPATH"] = f"{local_repository_dir}:{env.get('PYTHONPATH', '')}"

                    # new_working_dir = "/path/to/new/working/directory"
                    # process = subprocess.Popen(["python", "-c", "import sys; print(sys.path)"], env=env, cwd=new_working_dir)
                    # process.wait()

                    # update_host_status(self._host, status, self._config)
                    
                    update_host_status(f"Executing {test.test.name} test", self._host, self._config)
                    
                update_host_status("Waiting for tests...", self._host, self._config)
                logging.info(f"Host {self._host.hostname} status set to \"Waiting for tests...\"")
            except requests.RequestException as e:
                logging.error(f"Error fetching or processing test: {e}")

            time.sleep(60)
        
        logging.info("TestFarm service has stopped.")