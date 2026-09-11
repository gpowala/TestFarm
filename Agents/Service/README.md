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

Use a python.org (or equivalent) installation, installed **for all users** so that `py` is on the PATH of the account the service runs under. The Microsoft Store build of Python starts through an app execution alias, so the real interpreter is created by a broker rather than as a direct child and never joins the watchdog's job object — leftover test processes would then survive a stop.

## Configuration

[config.json](config.json), read from the folder this script lives in:

```json
{
    "Executor": {
        "Dir": "../Executor",
        "PythonExe": "py",
        "Args": ["run.py"],
        "Username": "",
        "Password": "",
        "LogonType": "interactive",
        "LoadUserProfile": true
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
| `Executor.PythonExe` | Interpreter used for the Executor. `py` (the Windows launcher) by default — it is looked up through the normal executable search when the Executor is started, so it must be on the PATH of the service's logon account. Set an explicit `python.exe` path to pin a specific interpreter. |
| `Executor.Args` | Command line for the Executor. `--stop-event <name>` is appended automatically. |
| `Executor.Username` | Account the Executor runs as. Empty (the default) means it runs as the service's own logon account. See [Running the Executor as a specific user](#running-the-executor-as-a-specific-user). |
| `Executor.Password` | Password for `Executor.Username`. Ignored when the username is empty. |
| `Executor.LogonType` | `interactive` (default), `batch`, `service` or `network`. Picks the Win32 logon type used for `Executor.Username`. |
| `Executor.LoadUserProfile` | Load the target user's registry profile before starting the Executor. Keep it `true` unless the account has no profile. |
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

By default the service runs as **LocalSystem**, which has its own environment: no per-user `PATH`, no loaded user profile, no mapped drives, and no access to per-user tool installs. The Executor inherits that environment. If the test/install commands it runs need tools that only exist on a specific user's `PATH` or profile, either configure the service to log on as that user (Services.msc → *TestFarm Watchdog* → Properties → **Log On** tab → *This account*), or keep the service as LocalSystem and let it start the Executor under that user — see the next section.

## Running the Executor as a specific user

Set `Executor.Username` and `Executor.Password` in [config.json](config.json) and the watchdog will log that account on and start `run.py` under it, with the account's own environment block (per-user `PATH`, `%APPDATA%`, `%USERPROFILE%`, ...). The watchdog service itself keeps running as its own account.

```json
"Executor": {
    "Dir": "../Executor",
    "PythonExe": "py",
    "Args": ["run.py"],
    "Username": "MYDOMAIN\\testfarm",
    "Password": "...",
    "LogonType": "interactive",
    "LoadUserProfile": true
}
```

`Username` accepts `DOMAIN\user`, `user@domain.com` or a bare local user name.

Requirements for the target account:

- The rights matching `LogonType`: **Allow log on locally** for `interactive`, **Log on as a batch job** for `batch` (`secpol.msc` → *Local Policies* → *User Rights Assignment*). `batch` is the better fit for an unattended account; use `interactive` if that right is the one already granted.
- Read/execute access to the `Agents` folder and write access to whatever the tests touch.
- `Executor.PythonExe` must be resolvable from the **service's** `PATH`, not the target user's — the executable search still happens in the watchdog's context. If `py` only exists in the target user's per-user install, set `Executor.PythonExe` to a full `python.exe` path.

> **Security**: the password is stored in clear text. Never commit a real one — keep the value empty in git and fill it in only on the deployed machine, then lock the file down:
>
> ```powershell
> icacls config.json /inheritance:r /grant "SYSTEM:(F)" "Administrators:(F)"
> ```
>
> If that is not acceptable, leave `Username` empty and change the service's own logon account instead.

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
- **`Could not start "py"` in the watchdog log**: the Python launcher is not on the PATH of the account the service runs under — typically because Python was installed *just for me* rather than for all users. Reinstall Python for all users, add the launcher to the system PATH, or set `Executor.PythonExe` to a full `python.exe` path.
- **`ModuleNotFoundError` when the service starts**: the interpreter running the Executor does not have the requirements installed. Install them with the same `py` the service will use, or pin `Executor.PythonExe` to an explicit `python.exe`. For the watchdog's own imports, check the service host with `Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\TestFarmWatchdog' | Select-Object ImagePath`, then `py watchdog.py remove` and reinstall from the correct interpreter.
- **`Could not start the executor as "<user>"` in the watchdog log**: the logon failed. Win32 error `1326` is a wrong user name or password, `1385` means the account lacks the user right required by `Executor.LogonType` (try `batch` and grant *Log on as a batch job*), `1327` means blank passwords are not allowed for that account, `1314` means the account **the service itself runs as** lacks *Replace a process level token* / *Adjust memory quotas for a process* — run the service as LocalSystem, or grant those rights.
- **Executor restarts in a loop**: `testfarm_executor.log` holds the actual error. The watchdog backs off to `CrashLoopBackoffSeconds` after `CrashLoopMaxFastExits` fast exits, so restarts get sparse rather than stopping.
- **Host stays online in TestFarm after a stop**: the Executor did not shut down within `GracefulStopTimeoutSeconds` and was killed. Raise the timeout, or check `testfarm_executor.log` for what it was busy with.
- **Test processes survive a service stop**: verify you are not running the Microsoft Store build of Python — processes started through its app execution alias never join the watchdog's job object.
- **"Another TestFarm Watchdog instance is already running"**: the service and a foreground `py watchdog.py run` are both active. Stop one of them.
