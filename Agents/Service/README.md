# TestFarm Watchdog

A deliberately small Windows Service whose only responsibility is to keep exactly **one** TestFarm Executor instance alive.

It does not contain any TestFarm logic. It starts the Executor exactly the way you start it by hand during development:

```powershell
py run.py
```

so a grid machine runs the same code path as a developer machine, and updating the Executor is nothing more than `git pull` + a service restart.

## Why a separate service

Hosting the Executor itself as a Windows Service meant hosting it inside pywin32's generic `pythonservice.exe`, which required registering pywin32's DLLs, adding a per-service `PYTHONPATH` registry value, and keeping the service's `ImagePath` interpreter in sync with wherever the dependencies were installed. Every Executor update risked breaking that setup.

The watchdog avoids all of it:

- It registers itself with `ImagePath = "<python.exe>" "<...>\watchdog.py"` (via `_exe_name_` / `_exe_args_`), so the interpreter you install from is baked into the service and the script itself is the entry point — no `pythonservice.exe`, no `PYTHONPATH` registry value.
- The Executor runs as a plain child process with `cwd` set to `Executor/`, so `Executor/` lands on `sys.path` automatically.
- The watchdog itself is tiny and effectively frozen, so only the Executor changes over time.

## What it does

- Starts one Executor child process and waits for it.
- Puts the child in a Win32 Job Object with `KILL_ON_JOB_CLOSE`, so every process the Executor leaves behind dies with it.
- Captures the child's stdout/stderr into a rotating log file.
- Restarts the child if it exits, with a back-off if it keeps exiting immediately (crash loop).
- On service stop, signals the Executor through a named Win32 event so it can set its host `Offline` and unregister from the TestFarm API, and only hard-kills the process tree if it does not finish in time.
- Refuses to run twice (named mutex), so you cannot end up with two Executors on one machine.

## Prerequisites

Same interpreter and dependencies as the Executor — see [../README.md](../README.md). The watchdog itself only needs `pywin32`, which is already in `Agents/requirements.txt`.

Use a python.org (or equivalent) installation. The Microsoft Store build of Python starts through an app execution alias, so the real interpreter is created by a broker rather than as a direct child and never joins the watchdog's job object — leftover test processes would then survive a stop. The watchdog logs a warning if it detects this.

## Configuration

[config.json](config.json), read from the folder this script lives in:

```json
{
    "Executor": {
        "Dir": "../Executor",
        "PythonExe": "py",
        "Args": ["run.py"]
    },
    "Watchdog": {
        "RestartDelaySeconds": 15,
        "GracefulStopTimeoutSeconds": 120,
        "CrashLoopThresholdSeconds": 30,
        "CrashLoopMaxFastExits": 3,
        "CrashLoopBackoffSeconds": 300
    },
    "Logging": {
        "LogDir": "C:/logs/testfarm",
        "MaxLogSizeMb": 10,
        "BackupCount": 5
    }
}
```

| Setting | Meaning |
| --- | --- |
| `Executor.Dir` | Executor folder, relative to this folder (or absolute). Becomes the child's working directory. |
| `Executor.PythonExe` | Interpreter used for the Executor. `py` (the Windows launcher) by default; set an explicit `python.exe` path to pin a specific interpreter. The watchdog logs which interpreter `py` actually resolved to at startup. |
| `Executor.Args` | Command line for the Executor. `--stop-event <name>` is appended automatically. |
| `RestartDelaySeconds` | Delay before restarting an Executor that exited. |
| `GracefulStopTimeoutSeconds` | How long to wait for the Executor to unregister its host and exit before killing its process tree. Must comfortably exceed the longest acceptable test run you are willing to wait for on shutdown. |
| `CrashLoopThresholdSeconds` | An Executor that lives shorter than this counts as a fast exit. |
| `CrashLoopMaxFastExits` | Number of consecutive fast exits that triggers the back-off. |
| `CrashLoopBackoffSeconds` | Restart delay used once a crash loop is detected. |
| `Logging.LogDir` | Folder for the watchdog log and the captured Executor output. |

## Installing

Open the terminal **as Administrator**. The interpreter `py` resolves to is written into the service's `ImagePath`, so activate the venv first if the Executor's dependencies live in one.

```powershell
cd Service
.\install.bat
```

That is equivalent to:

```powershell
py watchdog.py --startup auto install
py watchdog.py start
```

To run under a specific account (see *Log on account* below), pass the credentials through:

```powershell
.\install.bat --username .\testfarm --password <password>
```

## Managing

```powershell
py watchdog.py start
py watchdog.py stop
py watchdog.py restart
py watchdog.py remove

# or the standard Windows tools
Start-Service TestFarmWatchdog
Stop-Service TestFarmWatchdog
Restart-Service TestFarmWatchdog
```

`.\uninstall.bat` stops and removes the service.

If you move or rename the folder, re-run the install — the script path is stored in the service `ImagePath`.

### Log on account

By default the service runs as **LocalSystem**, which has its own environment: no per-user `PATH`, no loaded user profile, no mapped drives, and no access to per-user tool installs. The Executor inherits that environment. If the test/install commands it runs need tools that only exist on a specific user's `PATH` or profile, configure the service to log on as that user (Services.msc → *TestFarm Watchdog* → Properties → **Log On** tab → *This account*), rather than trying to replicate the environment for LocalSystem.

## Running in the foreground

To validate the whole setup without installing anything:

```powershell
py watchdog.py run
```

Watchdog logs go to the console, Executor output still goes to its log file. `Ctrl+C` triggers the same graceful shutdown the service does.

## Logs

Both files live in `Logging.LogDir` and rotate by size:

| File | Contents |
| --- | --- |
| `testfarm_watchdog.log` | Watchdog decisions: starts, exits, restarts, back-offs, shutdown. |
| `testfarm_executor.log` | Everything the Executor writes to stdout/stderr, with a banner line per start. |

In foreground mode the watchdog log goes to the console instead.

## Updating the Executor

```powershell
git pull
Restart-Service TestFarmWatchdog
```

The service registration is untouched; the next Executor start simply picks up the new code. If `requirements.txt` changed, re-run `requirements_install.bat` against the same interpreter first.

## Troubleshooting

- **Service will not start / stops immediately**: read `testfarm_watchdog.log` first. Startup failures (missing `config.json`, missing `Executor` folder, missing interpreter) are logged there and to the Windows Event Log.
- **`ModuleNotFoundError` when the service starts**: the interpreter running the Executor does not have the requirements installed. The watchdog logs the one it resolved at startup (`Executor interpreter: py -> ...`); install the requirements there, or pin `Executor.PythonExe` to an explicit `python.exe`. For the watchdog's own imports, check the service host with `Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\TestFarmWatchdog' | Select-Object ImagePath`, then `py watchdog.py remove` and reinstall from the correct interpreter.
- **Executor restarts in a loop**: `testfarm_executor.log` holds the actual error. The watchdog backs off to `CrashLoopBackoffSeconds` after `CrashLoopMaxFastExits` fast exits, so restarts get sparse rather than stopping.
- **Host stays online in TestFarm after a stop**: the Executor did not shut down within `GracefulStopTimeoutSeconds` and was killed. Raise the timeout, or check `testfarm_executor.log` for what it was busy with.
- **Test processes survive a service stop**: verify you are not running the Microsoft Store build of Python (the watchdog warns about this at startup) — processes started through its app execution alias never join the watchdog's job object.
- **"Another TestFarm Watchdog instance is already running"**: the service and a foreground `py watchdog.py run` are both active. Stop one of them.
