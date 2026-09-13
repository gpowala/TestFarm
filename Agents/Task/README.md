# TestFarm Executor scheduled task

Runs the Executor as a named account under Task Scheduler, started at boot and restarted
automatically whenever it stops.

Compared to hosting it in a Windows Service, the account password is stored by Windows in
LSA rather than anywhere in this repository, and there is no service registration to
maintain — updating the Executor is a `git pull` plus a task restart.

## Prerequisites

1. **Python installed for all users.** A per-user install is registered only under the
   installing account's `HKCU` and is invisible to the service account. Verify with:

   ```powershell
   reg query "HKLM\SOFTWARE\Python\PythonCore" /s /v InstallPath
   ```

2. **A virtual environment created from it**, somewhere outside any user profile (a
   checkout under `C:\Users\<you>\...` can never be read by another account):

   ```powershell
   C:\Python\python.exe -m venv C:\TestFarm\Agents\.venv
   C:\TestFarm\Agents\.venv\Scripts\python.exe -m pip install -r C:\TestFarm\Agents\requirements.txt
   ```

   Never use `pip install --user` — those packages land in *your* `%APPDATA%` and the task
   account cannot see them.

3. **Read access for the task account**, plus write access wherever the Executor works
   (artifacts, test workspaces, `Storage`):

   ```powershell
   icacls C:\Python   /grant "ACCSD\srv_mongoosevui:(OI)(CI)(RX)" /T
   icacls C:\TestFarm /grant "ACCSD\srv_mongoosevui:(OI)(CI)(RX)" /T
   ```

4. **The "Log on as a batch job" right** for the account (`secpol.msc` → Local Policies →
   User Rights Assignment). Registration usually grants this automatically; domain policy
   can strip it back.

## Installing

From an elevated PowerShell session:

```powershell
cd C:\TestFarm\Agents\Task
.\install.ps1 -Username ACCSD\srv_mongoosevui
```

The password is prompted for and handed straight to Task Scheduler; it is never written to
disk by these scripts.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `-TaskName` | `TestFarm Executor` | Name of the registered task. |
| `-Username` | *(required)* | Account the Executor runs as. |
| `-Password` | *(prompted)* | `SecureString`; prompted for when omitted. |
| `-PythonExe` | `..\.venv\Scripts\python.exe` | Interpreter. An absolute path, so nothing depends on `py` or the registry. |
| `-ExecutorDir` | `..\Executor` | Working directory for `run.py`. |
| `-RestartIntervalMinutes` | `5` | How often to re-launch the Executor when it is not running. |
| `-BootDelaySeconds` | `30` | Delay after boot, so the network is up before the Executor calls the TestFarm API. |
| `-NoStart` | *(off)* | Register the task without starting it. |

## How the restart works

Two independent mechanisms, because "restart on failure" alone is unreliable:

- A **repeating trigger** fires every `-RestartIntervalMinutes`. With *do not start a new
  instance*, the attempt is dropped while the Executor is alive and starts it when it is
  not — an unbounded restart loop with no counter to exhaust.
- **Restart on failure** (999 attempts, 1 per interval) covers a non-zero exit in between.

`ExecutionTimeLimit` is set to unlimited; the Task Scheduler default of *stop after 3 days*
would otherwise kill a long-running Executor.

## Logging

Logging is configured in the Executor's own [config.json](../Executor/config.json), not on
the command line:

```json
"Logging": {
    "LogDir": "C:/logs/testfarm",
    "LogFile": "testfarm_executor.log",
    "MaxLogSizeMb": 10,
    "BackupCount": 5
}
```

The Executor writes that file itself and rotates it by size, so it cannot grow without
bound. `install.ps1` reads `LogDir` from this file to grant the task account write access
to it — change the directory here and re-run the install.

A second file, `testfarm_executor.startup.log`, captures stderr. Anything that fails before
logging is configured (a bad `config.json`, a missing dependency) can only surface there, so
it is the first place to look when the log file itself is empty. It stays empty on a healthy
run.

## Managing

```powershell
Get-ScheduledTask -TaskName "TestFarm Executor" | Get-ScheduledTaskInfo
Start-ScheduledTask -TaskName "TestFarm Executor"
Stop-ScheduledTask  -TaskName "TestFarm Executor"
Get-Content C:\logs\testfarm\testfarm_executor.log -Tail 50 -Wait
```

To remove it:

```powershell
.\uninstall.ps1
```

## Updating the Executor

```powershell
git pull
Stop-ScheduledTask  -TaskName "TestFarm Executor"
Start-ScheduledTask -TaskName "TestFarm Executor"
```

If `requirements.txt` changed, install it into the same `.venv` first.

## Troubleshooting

- **Task never starts after a reboot**: the principal must be *run whether user is logged on
  or not*. `install.ps1` sets this by supplying a password; re-run it if the task was edited
  by hand.
- **`0x8007052E` (logon failure)**: wrong password, or the stored one expired. Re-run
  `install.ps1`. Accounts with a password-expiry policy will need this periodically.
- **Task reports success but nothing happens**: check the log file. `Last Run Result` of `0`
  only means `cmd.exe` started.
- **`ModuleNotFoundError`**: the requirements are not in the `.venv`, or were installed with
  `--user` into another account's profile. The traceback lands in
  `testfarm_executor.startup.log`.
- **Nothing in the log file**: check `testfarm_executor.startup.log` — the Executor probably
  failed before logging was configured. If both files are missing, the account lacks write
  access to `LogDir`; re-run `install.ps1`, which grants it.
- **Executor is killed mid-test**: check `ExecutionTimeLimit` is `PT0S` — an existing task
  edited in the GUI may have picked the 3-day default back up.

## Stopping behaviour

Task Scheduler terminates the Executor rather than asking it to shut down, so the host is
not unregistered from the grid on stop or reboot and stays visible until the grid times it
out. If that matters, the Executor needs to be hosted by something that can perform a
graceful stop.
