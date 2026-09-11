# TestFarm Executor Agent

Console application that registers a host with the TestFarm API and executes scheduled tests and benchmarks.

On a grid machine it is kept alive by the [TestFarm Watchdog](Service/README.md) — a tiny Windows Service whose only job is to run exactly one Executor instance and restart it if it exits. The Executor itself is never installed as a service, so it always runs through the same code path you use during development.

## Prerequisites

- Windows with Python 3.x installed — use a python.org (or equivalent) installation **for all users** (so `py` is on the service account's PATH), **not** the Microsoft Store build, whose app execution alias breaks process-tree cleanup
- Administrator access (required to install/start/stop a Windows service)
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

### Installing globally instead (no venv)

If you'd rather install directly against the system/global Python on the server, just run `requirements_install.bat` **without** activating a venv first — it installs into whichever interpreter `py` resolves to and locates the right `Scripts` directory automatically, so the `pywin32_postinstall.py` step still works unchanged. Everything else (`py run.py`, installing the watchdog) goes through `py` as well, so the packages and the service registration stay consistent.

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
    }
}
```

The Executor logs to the console; where that output ends up on a grid machine is decided by the watchdog's `LogDir` (see [Service/README.md](Service/README.md)). Make sure the account the Executor runs under (`LocalSystem` by default, inherited from the watchdog service) has write access to that folder and to whatever repository/temp/work directories are resolved by the `testfarmutils` package.

## Running it directly

This is how the Executor is always started — by hand during development, and by the watchdog on a grid machine. From an activated venv, in `Executor/`:

```powershell
cd Executor
py run.py
```

Logs are printed to the console. Stop with `Ctrl+C`; the host is set `Offline` and unregistered on the way out.

`run.py` also accepts `--stop-event <name>`: the name of a Win32 event that requests the same graceful shutdown when signalled. The watchdog creates that event and passes it in; you never need it manually.

## Running unattended (TestFarm Watchdog)

On a grid machine the Executor is supervised by the **TestFarm Watchdog** Windows Service, which starts a single `py run.py`, restarts it if it exits, and shuts it down gracefully when the service stops.

```powershell
cd Service
.\install.bat
```

See [Service/README.md](Service/README.md) for configuration, log locations, and troubleshooting.

Updating the Executor is then just:

```powershell
git pull
Restart-Service TestFarmWatchdog
```

### Migrating from the old "TestFarm" service

Earlier versions installed the Executor itself as a Windows Service hosted by pywin32's `pythonservice.exe`. That is gone — `run.py` no longer has `install`/`start`/`stop`/`remove` commands, and the executor class is a plain Python class. If a machine still has the old service registered, remove it before installing the watchdog so two Executors never run side by side:

```powershell
# as Administrator
Stop-Service TestFarm -ErrorAction SilentlyContinue
sc.exe delete TestFarm
```

### Log on account

By default the watchdog service runs as **LocalSystem**, which has its own environment: no per-user `PATH`, no loaded user profile, no mapped drives, and no access to per-user tool installs — and the Executor inherits it. If the test/install commands executed by the Executor (`execute_command`) need tools that only exist on a specific user's `PATH` or profile, set `Executor.RunAs` in [Service/config.json](Service/config.json):

- `"console"` — run the Executor as the user currently logged on, in their own session. This is the closest match to running `py run.py` yourself, and needs no stored password.
- `"user"` — run it as a fixed account from `Executor.Username` / `Executor.Password`.

Leave the service itself as LocalSystem — both modes need its privileges. See [Service/README.md](Service/README.md#choosing-the-account-the-executor-runs-as) for the details and the password-handling warning.

## Logs

When supervised by the watchdog, everything the Executor prints is captured into the rotating `testfarm_executor.log` in the watchdog's `LogDir`, next to the watchdog's own `testfarm_watchdog.log`. The Executor has no log configuration of its own — it always writes to the console.

## Troubleshooting

- **Executor keeps restarting**: read `testfarm_executor.log` — it holds the Executor's own output. Watchdog-level problems (bad paths, crash-loop back-off) are in `testfarm_watchdog.log`. See [Service/README.md](Service/README.md#troubleshooting).
- **`ModuleNotFoundError` for a dependency (e.g. `git`, `py7zr`, `testfarmutils`)**: the interpreter `py` picks for the watchdog service is not the one `requirements_install.bat` installed into. Install the requirements with the same `py`, or pin `Executor.PythonExe` in [Service/config.json](Service/config.json) to an explicit `python.exe`.
- **Can't reach dependencies**: check the log for errors reaching the TestFarm API or cloning repositories, and confirm the service's logon account has the required network and filesystem permissions.
- **Test/install commands fail only when running under the service (work fine when started by hand)**: LocalSystem doesn't have your interactive user's `PATH`, profile, or mapped drives — any tool installed per-user (e.g. a per-user Python/`dotnet`/`node` install) is invisible to it. Configure the service's **Log On** account (see above) to run as the same user whose environment the commands rely on.
- **Config not found**: `config.json` must remain alongside `test_farm_windows_service.py` in `Executor/` — its path is resolved relative to that file, not the current working directory.
