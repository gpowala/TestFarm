# TestFarm Executor Agent

Windows Service that registers a host with the TestFarm API and executes scheduled tests and benchmarks.

## Prerequisites

- Windows with Python 3.x installed
- Administrator access (required to install/start/stop a Windows service)
- Git available on `PATH` (used both for cloning test repositories and for diff generation)
- Network access to the TestFarm API and to the git repositories under test

## Setup

Run from the repository root (`Agents/`):

```powershell
# 1. Create the virtual environment
.\venv_create.bat

# 2. Activate it
.\venv_start.bat

# 3. Install dependencies
.\requirements_install.bat

# 4. Register pywin32's DLLs for this venv (required for the service host to load)
python .venv\Scripts\pywin32_postinstall.py -install
```

## Configuration

Edit [Executor/config.json](Executor/config.json) before running:

```json
{
    "Grid": {
        "name": "<your grid name>",
        "capabilities": ["tests", "benchmarks"]
    },
    "TestFarmApi": {
        "BaseUrl": "<your TestFarm API base URL>",
        "Timeout": 60
    },
    "Logging": {
        "LogDir": "C:/logs/testfarm"
    }
}
```

Make sure the account the service runs under (`LocalSystem` by default) has write access to `LogDir` and to whatever repository/temp/work directories are resolved by the `testfarmutils` package.

## Running in debug mode (no service install)

Useful to validate configuration and connectivity before installing the service. From an activated venv, in `Executor/`:

```powershell
cd Executor
python run.py debug
```

Logs are printed to the console. Stop with `Ctrl+C`.

## Installing and managing the Windows service

Open the terminal **as Administrator**, with the venv activated, from `Executor/`:

```powershell
# Install the service (registers "TestFarm" in the SCM)
python run.py install

# Start
python run.py start

# Stop
python run.py stop

# Uninstall
python run.py remove
```

Equivalent standard Windows tools also work once installed: `services.msc`, `sc start TestFarm`, `sc stop TestFarm`.

## Logs

Once running as a real service, logging goes to the rotating log file at the `LogDir` configured in [Executor/config.json](Executor/config.json) (e.g. `C:\logs\testfarm\testfarm_service.log`) rather than the console.

## Troubleshooting

- **Service fails to start immediately after install**: verify `pywin32_postinstall.py -install` was run for the venv being used; missing pywin32 DLL registration is a common cause.
- **Service starts then stops / can't reach dependencies**: check the log file for errors reaching the TestFarm API or cloning repositories, and confirm the service's logon account has the required network and filesystem permissions.
- **Config not found**: `config.json` must remain alongside `test_farm_windows_service.py` in `Executor/` — its path is resolved relative to that file, not the current working directory.
