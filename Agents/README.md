# TestFarm Executor Agent

Console application that registers a host with the TestFarm API and executes scheduled tests and benchmarks.

On a grid machine it is kept alive by a [Windows scheduled task](Task/README.md) that runs exactly one Executor instance as a dedicated account and restarts it whenever it stops. The Executor is never installed as a service, so a grid machine runs the same `run.py` code path you use during development.

## Prerequisites

- Windows with Python 3.x installed **for all users** — a per-user install is registered only under the installing account's `HKCU` and is invisible to the account the grid machine runs the Executor as. Avoid the Microsoft Store build, whose app execution alias breaks process-tree cleanup.
- Administrator access on grid machines (required to register the scheduled task)
- Git available on `PATH` (used both for cloning test repositories and for diff generation)
- Network access to the TestFarm API and to the git repositories under test

## Setup

Run from the repository root (`Agents/`):

```powershell
# 1. Create the virtual environment (leaves you in a shell with it activated)
.\venv_create.bat

# 2. Install dependencies (also registers pywin32's DLLs for this interpreter)
.\requirements_install.bat
```

In a new terminal later, re-activate it with `.venv\Scripts\activate`.

On a grid machine the venv must live **outside any user profile** — a checkout under `C:\Users\<you>\...` can never be read by the task account. Never install requirements with `pip install --user`; those packages land in your own `%APPDATA%` and are invisible to it.

### Installing globally instead (no venv)

If you'd rather install directly against the system/global Python, run `requirements_install.bat` **without** activating a venv first — it installs into whichever interpreter `py` resolves to and locates the right `Scripts` directory automatically, so the `pywin32_postinstall.py` step still works unchanged.

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
    "Storage": {
        "Repositories": "C:/temp_repositories"
    },
    "Logging": {
        "LogDir": "C:/logs/testfarm",
        "LogFile": "testfarm_executor.log",
        "MaxLogSizeMb": 10,
        "BackupCount": 5
    }
}
```

Make sure the account the Executor runs under has write access to `Logging.LogDir` and to whatever repository/temp/work directories are resolved by the `testfarmutils` package.

## Running it directly

This is how the Executor is always started — by hand during development, and by the scheduled task on a grid machine. From an activated venv, in `Executor/`:

```powershell
cd Executor
py run.py
```

Output goes to the console *and* to the rotating log file configured above. Stop with `Ctrl+C`; the host is set `Offline` and unregistered on the way out.

## Running unattended (scheduled task)

On a grid machine the Executor runs as a scheduled task under a dedicated account, started at boot and restarted automatically whenever it exits:

```powershell
# elevated
cd Task
.\install.ps1 -Username DOMAIN\svc_account
```

See [Task/README.md](Task/README.md) for prerequisites, parameters, restart behaviour, and troubleshooting.

Updating the Executor is then:

```powershell
git pull
Stop-ScheduledTask  -TaskName "TestFarm Executor"
Start-ScheduledTask -TaskName "TestFarm Executor"
```

Note that Task Scheduler **terminates** the Executor rather than asking it to shut down, so on a stop or reboot the host is not unregistered and stays visible in the grid until it times out.

### Migrating from the old services

Two earlier hosting mechanisms are gone:

- **`TestFarm`** — the Executor installed as a Windows Service inside pywin32's `pythonservice.exe`. `run.py` no longer has `install`/`start`/`stop`/`remove` commands, and the executor class is a plain Python class.
- **`TestFarmWatchdog`** — a small supervisor service that spawned `run.py` and signalled it through a named stop event. `run.py` no longer accepts `--stop-event`.

Remove whichever is still registered before installing the scheduled task, so two Executors never run side by side:

```powershell
# as Administrator
Stop-Service TestFarm -ErrorAction SilentlyContinue
sc.exe delete TestFarm

Stop-Service TestFarmWatchdog -ErrorAction SilentlyContinue
sc.exe delete TestFarmWatchdog
```

### Log on account

The Executor runs as whatever account the scheduled task is registered with. Pick one whose environment matches what the test/install commands executed by the Executor (`execute_command`) actually need — a tool installed per-user (a per-user Python, `dotnet`, `node`) or a mapped drive is invisible to any other account.

The password is prompted for at install time and stored by Windows in LSA; it is never written into this repository.

## Logs

Everything the Executor prints goes to the console and to the rotating `Logging.LogFile` in `Logging.LogDir`, capped at `MaxLogSizeMb` with `BackupCount` older files kept.

Under the scheduled task a second file, `testfarm_executor.startup.log`, sits next to it and captures stderr — failures that happen before logging is configured (a bad `config.json`, a missing dependency) can only surface there.

## Troubleshooting

- **Executor keeps restarting**: read `testfarm_executor.log` — it holds the Executor's own output. Task-level problems are in `testfarm_executor.startup.log` and the task's `Last Run Result`. See [Task/README.md](Task/README.md#troubleshooting).
- **`ModuleNotFoundError` for a dependency (e.g. `git`, `py7zr`, `testfarmutils`)**: the interpreter the task runs is not the one the requirements were installed into. Install them into the `.venv` the task points at.
- **Can't reach dependencies**: check the log for errors reaching the TestFarm API or cloning repositories, and confirm the task's account has the required network and filesystem permissions.
- **Test/install commands fail only when running unattended (work fine when started by hand)**: the task account doesn't have your interactive user's `PATH`, profile, or mapped drives. Register the task with the account whose environment the commands rely on.
- **Config not found**: `config.json` must remain alongside `test_farm_windows_service.py` in `Executor/` — its path is resolved relative to that file, not the current working directory.
