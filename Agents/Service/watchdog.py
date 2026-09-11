"""TestFarm Watchdog.

A deliberately small Windows Service whose only responsibility is to keep
exactly one TestFarm Executor instance alive. The Executor itself is started
the same way it is started by hand during development:

    py run.py

so nothing about the Executor's hosting model changes between a developer
machine and a grid machine, and updating the Executor is just a `git pull`
plus a service restart.
"""

import json
import logging
import msvcrt
import os
import signal
import subprocess
import sys
import time
import threading
from logging.handlers import RotatingFileHandler

import pywintypes
import servicemanager
import win32api
import win32con
import win32event
import win32job
import win32process
import win32profile
import win32security
import win32service
import win32serviceutil
import win32ts
import winerror

SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SERVICE_DIR, "config.json")

WATCHDOG_LOG_NAME = "testfarm_watchdog.log"
EXECUTOR_LOG_NAME = "testfarm_executor.log"

SINGLETON_MUTEX_NAME = "Global\\TestFarmWatchdogSingleton"
STOP_EVENT_PREFIX = "TestFarmExecutorStop"

LOGON_TYPES = {
    "interactive": win32security.LOGON32_LOGON_INTERACTIVE,
    "batch": win32security.LOGON32_LOGON_BATCH,
    "service": win32security.LOGON32_LOGON_SERVICE,
    "network": win32security.LOGON32_LOGON_NETWORK,
}

RUN_AS_SERVICE = "service"
RUN_AS_CONSOLE = "console"
RUN_AS_USER = "user"
RUN_AS_MODES = (RUN_AS_SERVICE, RUN_AS_CONSOLE, RUN_AS_USER)

# A process that cannot reach a window station fails during DLL initialisation with
# STATUS_DLL_INIT_FAILED, long before Python runs - so nothing lands in the executor log.
STATUS_DLL_INIT_FAILED = -1073741502

WINSTA_ACCESS = (
    win32con.WINSTA_ACCESSCLIPBOARD
    | win32con.WINSTA_ACCESSGLOBALATOMS
    | win32con.WINSTA_CREATEDESKTOP
    | win32con.WINSTA_ENUMDESKTOPS
    | win32con.WINSTA_ENUMERATE
    | win32con.WINSTA_EXITWINDOWS
    | win32con.WINSTA_READATTRIBUTES
    | win32con.WINSTA_READSCREEN
    | win32con.WINSTA_WRITEATTRIBUTES
    | win32con.DELETE
    | win32con.READ_CONTROL
    | win32con.WRITE_DAC
    | win32con.WRITE_OWNER
)

DESKTOP_ACCESS = (
    win32con.DESKTOP_CREATEMENU
    | win32con.DESKTOP_CREATEWINDOW
    | win32con.DESKTOP_ENUMERATE
    | win32con.DESKTOP_HOOKCONTROL
    | win32con.DESKTOP_JOURNALPLAYBACK
    | win32con.DESKTOP_JOURNALRECORD
    | win32con.DESKTOP_READOBJECTS
    | win32con.DESKTOP_SWITCHDESKTOP
    | win32con.DESKTOP_WRITEOBJECTS
    | win32con.DELETE
    | win32con.READ_CONTROL
    | win32con.WRITE_DAC
    | win32con.WRITE_OWNER
)


class WatchdogConfig:
    def __init__(self, config_data: dict):
        executor = config_data.get("Executor", {})
        watchdog = config_data.get("Watchdog", {})
        logging_config = config_data.get("Logging", {})

        self.executor_dir = os.path.abspath(os.path.join(SERVICE_DIR, executor.get("Dir", "../Executor")))
        self.executor_python = executor.get("PythonExe") or "py"
        self.executor_args = list(executor.get("Args", ["run.py"]))

        self.executor_username = (executor.get("Username") or "").strip()
        self.executor_password = executor.get("Password") or ""
        self.executor_logon_type = (executor.get("LogonType") or "interactive").strip().lower()
        self.executor_load_user_profile = bool(executor.get("LoadUserProfile", True))

        run_as = (executor.get("RunAs") or "").strip().lower()
        if not run_as:
            # Back-compat: credentials alone used to be enough to opt into "run as user".
            run_as = RUN_AS_USER if self.executor_username else RUN_AS_SERVICE
        self.executor_run_as = run_as

        self.restart_delay_seconds = int(watchdog.get("RestartDelaySeconds", 15))
        self.graceful_stop_timeout_seconds = int(watchdog.get("GracefulStopTimeoutSeconds", 120))
        self.crash_loop_threshold_seconds = int(watchdog.get("CrashLoopThresholdSeconds", 30))
        self.crash_loop_max_fast_exits = int(watchdog.get("CrashLoopMaxFastExits", 3))
        self.crash_loop_backoff_seconds = int(watchdog.get("CrashLoopBackoffSeconds", 300))

        self.log_dir = logging_config.get("LogDir", "C:/logs/testfarm")
        self.max_log_size_bytes = int(logging_config.get("MaxLogSizeMb", 10)) * 1024 * 1024
        self.backup_count = int(logging_config.get("BackupCount", 5))

    @staticmethod
    def load(config_path: str = CONFIG_PATH) -> "WatchdogConfig":
        with open(config_path, "r") as config_file:
            return WatchdogConfig(json.load(config_file))


def rotate_file(file_path: str, max_bytes: int, backup_count: int):
    if not os.path.exists(file_path) or os.path.getsize(file_path) < max_bytes:
        return

    for index in range(backup_count, 0, -1):
        source = file_path if index == 1 else f"{file_path}.{index - 1}"
        destination = f"{file_path}.{index}"

        if os.path.exists(source):
            if os.path.exists(destination):
                os.remove(destination)
            os.replace(source, destination)


def split_username(value: str):
    """Splits "DOMAIN\\user", "user@domain" or a bare local user name into (domain, user)."""
    if "\\" in value:
        domain, _, username = value.partition("\\")
        return domain, username

    if "@" in value:
        return None, value

    return ".", value


def duplicate_as_inheritable(handle):
    current_process = win32api.GetCurrentProcess()
    return win32api.DuplicateHandle(
        current_process, handle, current_process, 0, True, win32con.DUPLICATE_SAME_ACCESS
    )


def find_interactive_session_id():
    """Session of the user logged on at the console, falling back to any active session (RDP)."""
    session_id = win32ts.WTSGetActiveConsoleSessionId()

    if session_id not in (0, 0xFFFFFFFF):
        return session_id

    for session in win32ts.WTSEnumerateSessions(win32ts.WTS_CURRENT_SERVER_HANDLE):
        if session["State"] == win32ts.WTSActive and session["SessionId"] != 0:
            return session["SessionId"]

    return None


def acquire_console_session_token():
    """Primary token of the interactive user - the same scope you get in their own shell."""
    session_id = find_interactive_session_id()
    if session_id is None:
        raise RuntimeError("No interactive session is available - nobody is logged on to this machine.")

    session_token = win32ts.WTSQueryUserToken(session_id)
    try:
        token = win32security.DuplicateTokenEx(
            session_token,
            win32security.SecurityImpersonation,
            win32con.MAXIMUM_ALLOWED,
            win32security.TokenPrimary,
            None,
        )
    finally:
        win32api.CloseHandle(session_token)

    return token, session_id


def describe_token_user(token) -> str:
    sid = win32security.GetTokenInformation(token, win32security.TokenUser)[0]
    name, domain, _ = win32security.LookupAccountSid(None, sid)
    return f"{domain}\\{name}" if domain else name


def grant_user_object_access(handle, sid, access: int, inheritable: bool):
    descriptor = win32security.GetUserObjectSecurity(handle, win32security.DACL_SECURITY_INFORMATION)
    dacl = descriptor.GetSecurityDescriptorDacl()

    if inheritable:
        dacl.AddAccessAllowedAceEx(
            win32security.ACL_REVISION_DS,
            win32security.CONTAINER_INHERIT_ACE
            | win32security.INHERIT_ONLY_ACE
            | win32security.OBJECT_INHERIT_ACE,
            access,
            sid,
        )

    dacl.AddAccessAllowedAceEx(win32security.ACL_REVISION_DS, win32security.NO_PROPAGATE_INHERIT_ACE, access, sid)

    descriptor.SetSecurityDescriptorDacl(1, dacl, 0)
    win32security.SetUserObjectSecurity(handle, win32security.DACL_SECURITY_INFORMATION, descriptor)


def grant_window_station_access(sid):
    """Without this the spawned process dies with STATUS_DLL_INIT_FAILED (0xC0000142).

    A service lives in session 0, whose window station and desktop only grant access to the
    service account. Any process started there under different credentials cannot initialise
    user32.dll until its SID is added to both DACLs.
    """
    previous_station = win32service.GetProcessWindowStation()
    station = win32service.OpenWindowStation(
        "WinSta0", False, win32con.READ_CONTROL | win32con.WRITE_DAC
    )

    try:
        grant_user_object_access(station, sid, WINSTA_ACCESS, inheritable=True)

        # OpenDesktop resolves against the calling process's window station, so we have to
        # switch to WinSta0 for the lookup and switch straight back.
        station.SetProcessWindowStation()
        try:
            desktop = win32service.OpenDesktop(
                "default",
                0,
                False,
                win32con.READ_CONTROL
                | win32con.WRITE_DAC
                | win32con.DESKTOP_READOBJECTS
                | win32con.DESKTOP_WRITEOBJECTS,
            )
            try:
                grant_user_object_access(desktop, sid, DESKTOP_ACCESS, inheritable=False)
            finally:
                desktop.CloseDesktop()
        finally:
            previous_station.SetProcessWindowStation()
    finally:
        station.CloseWindowStation()


class UserProcess:
    """A `subprocess.Popen`-shaped wrapper around a process started with CreateProcessAsUser."""

    def __init__(self, process_handle, pid: int, command, token, profile):
        self._process_handle = process_handle
        self._token = token
        self._profile = profile
        self._command = command
        self.pid = pid

    def poll(self):
        if win32event.WaitForSingleObject(self._process_handle, 0) != win32event.WAIT_OBJECT_0:
            return None
        return win32process.GetExitCodeProcess(self._process_handle)

    def wait(self, timeout=None):
        milliseconds = win32event.INFINITE if timeout is None else int(timeout * 1000)

        if win32event.WaitForSingleObject(self._process_handle, milliseconds) != win32event.WAIT_OBJECT_0:
            raise subprocess.TimeoutExpired(self._command, timeout)

        return win32process.GetExitCodeProcess(self._process_handle)

    def close(self):
        if self._profile is not None:
            try:
                win32profile.UnloadUserProfile(self._token, self._profile)
            except Exception as error:
                logging.warning(f"Could not unload the user profile: {error}")
            self._profile = None

        for handle_name in ("_process_handle", "_token"):
            handle = getattr(self, handle_name)
            if handle is not None:
                win32api.CloseHandle(handle)
                setattr(self, handle_name, None)


class TestFarmWatchdogService(win32serviceutil.ServiceFramework):
    _svc_name_ = "TestFarmWatchdog"
    _svc_display_name_ = "TestFarm Watchdog"
    _svc_description_ = "Keeps a single TestFarm Executor instance running."

    # Host the service directly in python.exe instead of pywin32's generic pythonservice.exe.
    # The interpreter used at install time is baked into the service ImagePath, and the script
    # itself is the entry point, so no PYTHONPATH registry value and no DLL registration are needed.
    # This has to be a concrete interpreter rather than the `py` launcher: the SCM needs the
    # process it starts to be the one hosting the service, and `py` only spawns a child.
    _exe_name_ = sys.executable
    _exe_args_ = f'"{os.path.abspath(__file__)}"'

    def __init__(self, args=None):
        self._foreground = args is None
        self._stop = threading.Event()
        self._config = None
        self._singleton_mutex = None

        try:
            self._config = WatchdogConfig.load()
        except Exception as error:
            if not self._foreground:
                servicemanager.LogErrorMsg(f"TestFarm Watchdog failed to load {CONFIG_PATH}: {error}")
            raise

        if not self._foreground:
            super().__init__(args)

    def setup_logging(self):
        os.makedirs(self._config.log_dir, exist_ok=True)

        if self._foreground:
            log_handler = logging.StreamHandler(sys.stdout)
        else:
            log_handler = RotatingFileHandler(
                filename=os.path.join(self._config.log_dir, WATCHDOG_LOG_NAME),
                maxBytes=self._config.max_log_size_bytes,
                backupCount=self._config.backup_count,
            )

        log_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))

        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)

        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)

        root_logger.addHandler(log_handler)

    def report_stop_pending(self):
        if self._foreground:
            return

        wait_hint_ms = (self._config.graceful_stop_timeout_seconds + 30) * 1000
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING, waitHint=wait_hint_ms)

    def SvcStop(self):
        self.report_stop_pending()
        self._stop.set()
        logging.info("Stop requested - TestFarm Watchdog is shutting down...")

    def SvcDoRun(self):
        self.setup_logging()

        try:
            logging.info("TestFarm Watchdog is starting...")
            logging.info(f"Executor directory: {self._config.executor_dir}")
            logging.info(f"Executor command: {self._config.executor_python} {' '.join(self._config.executor_args)}")
            if self._config.executor_run_as == RUN_AS_USER:
                logging.info(
                    f"Executor runs as: {self._config.executor_username} "
                    f"(logon type: {self._config.executor_logon_type})"
                )
            elif self._config.executor_run_as == RUN_AS_CONSOLE:
                logging.info("Executor runs as: the user logged on interactively.")
            else:
                logging.info("Executor runs as: the account this service runs under.")

            self._singleton_mutex = acquire_singleton_mutex()
            if self._singleton_mutex is None:
                raise RuntimeError("Another TestFarm Watchdog instance is already running - aborting.")

            self.validate_executor()

            self.supervise()
        except Exception:
            logging.exception("TestFarm Watchdog terminated with an unhandled error.")
            raise
        finally:
            logging.info("TestFarm Watchdog has stopped.")

    def validate_executor(self):
        if self._config.executor_run_as not in RUN_AS_MODES:
            raise ValueError(
                f"Unsupported Executor.RunAs \"{self._config.executor_run_as}\" - "
                f"expected one of {', '.join(RUN_AS_MODES)}."
            )

        if self._config.executor_run_as == RUN_AS_USER and not self._config.executor_username:
            raise ValueError("Executor.RunAs is \"user\" but Executor.Username is empty.")

        if not os.path.isdir(self._config.executor_dir):
            raise FileNotFoundError(f"Executor directory not found: {self._config.executor_dir}")

        entry_point = os.path.join(self._config.executor_dir, self._config.executor_args[0])
        if not os.path.isfile(entry_point):
            raise FileNotFoundError(f"Executor entry point not found: {entry_point}")

        # The interpreter is deliberately not resolved here: `py` is looked up by the normal
        # executable search when the Executor is started, exactly like typing it in a shell.

    def supervise(self):
        stop_event, stop_event_name = self.create_stop_event()

        consecutive_fast_exits = 0

        while not self._stop.is_set():
            win32event.ResetEvent(stop_event)

            started_at = time.monotonic()
            exit_code = self.run_executor(stop_event, stop_event_name)
            uptime_seconds = time.monotonic() - started_at

            if self._stop.is_set():
                break

            if exit_code == STATUS_DLL_INIT_FAILED:
                logging.error(
                    "The executor process was killed during DLL initialisation (0xC0000142), so it never "
                    "produced any output. This almost always means the account it runs as has no access to "
                    "the window station it was started on."
                )

            if uptime_seconds < self._config.crash_loop_threshold_seconds:
                consecutive_fast_exits += 1
            else:
                consecutive_fast_exits = 0

            restart_delay_seconds = self._config.restart_delay_seconds

            if consecutive_fast_exits >= self._config.crash_loop_max_fast_exits:
                restart_delay_seconds = self._config.crash_loop_backoff_seconds
                logging.warning(
                    f"Executor exited {consecutive_fast_exits} times within "
                    f"{self._config.crash_loop_threshold_seconds}s - backing off."
                )

            logging.info(
                f"Executor exited with code {exit_code} after {uptime_seconds:.0f}s - "
                f"restarting in {restart_delay_seconds}s..."
            )

            self._stop.wait(restart_delay_seconds)

    def create_stop_event(self):
        """The stop event has to live in the global namespace.

        In `console` mode the Executor runs in the interactive session, so a session-local
        event created here (session 0) would be invisible to it.
        """
        base_name = f"{STOP_EVENT_PREFIX}_{os.getpid()}"
        security = self.stop_event_security()

        try:
            return win32event.CreateEvent(security, True, False, f"Global\\{base_name}"), f"Global\\{base_name}"
        except pywintypes.error as error:
            # Creating global objects needs SeCreateGlobalPrivilege, which a non-elevated
            # foreground run does not have. Session-local is fine there.
            logging.warning(
                f"Could not create a global stop event ({error.strerror}) - falling back to a session-local one."
            )
            return win32event.CreateEvent(security, True, False, base_name), base_name

    def stop_event_security(self):
        """Lets the executor open the stop event when it runs as another user.

        The default DACL only covers the service account, so an executor started under
        different credentials could never see a graceful stop request. Authenticated users
        get SYNCHRONIZE only - enough to wait on the event, not enough to signal it.
        """
        if self._config.executor_run_as == RUN_AS_SERVICE:
            return None

        token = win32security.OpenProcessToken(win32api.GetCurrentProcess(), win32con.TOKEN_QUERY)
        try:
            owner_sid = win32security.GetTokenInformation(token, win32security.TokenUser)[0]
        finally:
            win32api.CloseHandle(token)

        authenticated_users_sid = win32security.ConvertStringSidToSid("S-1-5-11")

        dacl = win32security.ACL()
        dacl.AddAccessAllowedAce(win32security.ACL_REVISION, win32con.GENERIC_ALL, owner_sid)
        dacl.AddAccessAllowedAce(win32security.ACL_REVISION, win32con.SYNCHRONIZE, authenticated_users_sid)

        descriptor = win32security.SECURITY_DESCRIPTOR()
        descriptor.SetSecurityDescriptorDacl(1, dacl, 0)

        attributes = win32security.SECURITY_ATTRIBUTES()
        attributes.SECURITY_DESCRIPTOR = descriptor

        return attributes

    def run_executor(self, stop_event, stop_event_name: str):
        command = [self._config.executor_python] + self._config.executor_args + ["--stop-event", stop_event_name]

        executor_log_path = os.path.join(self._config.log_dir, EXECUTOR_LOG_NAME)
        rotate_file(executor_log_path, self._config.max_log_size_bytes, self._config.backup_count)

        job = self.create_job_object()
        process = None
        log_file = None

        try:
            log_file = open(executor_log_path, "a", encoding="utf-8", errors="replace")
            log_file.write(f"\n===== Executor started by TestFarm Watchdog at {time.strftime('%Y-%m-%d %H:%M:%S')} =====\n")
            log_file.flush()

            logging.info(f"Starting executor: {' '.join(command)}")

            process = self.start_executor(command, log_file)

            self.assign_to_job_object(job, process.pid)
            logging.info(f"Executor started with PID {process.pid}. Output goes to {executor_log_path}")

            exit_code = self.wait_for_executor(process)
            if exit_code is not None:
                return exit_code

            return self.stop_executor(process, stop_event, job)
        except FileNotFoundError:
            logging.error(
                f"Could not start \"{self._config.executor_python}\" - it is not on the PATH of the account this "
                "service runs under. Install the Python launcher for all users, or set Executor.PythonExe in "
                f"{CONFIG_PATH} to a full path."
            )
            return None
        except pywintypes.error as error:
            logging.error(
                f"Could not start the executor in \"{self._config.executor_run_as}\" mode: "
                f"{error.strerror} (win32 error {error.winerror})"
            )
            return None
        except Exception:
            logging.exception("Failed to run the executor.")
            return None
        finally:
            # Closing the job handle kills anything the executor left behind.
            if job is not None:
                win32api.CloseHandle(job)
            if process is not None:
                if process.poll() is None:
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        logging.warning(f"Executor PID {process.pid} is still running after the job object was closed.")
                if hasattr(process, "close"):
                    process.close()
            if log_file is not None:
                log_file.close()

    def start_executor(self, command, log_file):
        run_as = self._config.executor_run_as

        if run_as == RUN_AS_SERVICE:
            return subprocess.Popen(
                command,
                cwd=self._config.executor_dir,
                stdin=subprocess.DEVNULL,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW,
                close_fds=True,
            )

        if run_as == RUN_AS_CONSOLE:
            token, session_id = acquire_console_session_token()
            label = f"{describe_token_user(token)} (interactive session {session_id})"
            return self.start_executor_with_token(command, log_file, token, None, label)

        if run_as == RUN_AS_USER:
            token, profile = self.logon_configured_user()
            return self.start_executor_with_token(
                command, log_file, token, profile, self._config.executor_username
            )

        raise ValueError(
            f"Unsupported Executor.RunAs \"{run_as}\" - expected one of {', '.join(RUN_AS_MODES)}."
        )

    def logon_configured_user(self):
        logon_type = LOGON_TYPES.get(self._config.executor_logon_type)
        if logon_type is None:
            raise ValueError(
                f"Unsupported Executor.LogonType \"{self._config.executor_logon_type}\" - "
                f"expected one of {', '.join(sorted(LOGON_TYPES))}."
            )

        domain, username = split_username(self._config.executor_username)

        token = win32security.LogonUser(
            username,
            domain,
            self._config.executor_password,
            logon_type,
            win32security.LOGON32_PROVIDER_DEFAULT,
        )

        profile = None

        try:
            # The session 0 window station does not grant this account anything by default,
            # which would kill the executor during DLL initialisation.
            sid = win32security.GetTokenInformation(token, win32security.TokenUser)[0]
            try:
                grant_window_station_access(sid)
            except pywintypes.error as error:
                logging.warning(
                    f"Could not grant \"{self._config.executor_username}\" access to the service window "
                    f"station ({error.strerror}) - the executor may fail to start."
                )

            if self._config.executor_load_user_profile:
                profile = win32profile.LoadUserProfile(token, {"UserName": username})
        except Exception:
            win32api.CloseHandle(token)
            raise

        return token, profile

    def start_executor_with_token(self, command, log_file, token, profile, label: str):
        stdin_handle = None
        stdout_handle = None

        try:
            # Give the executor the target user's environment (per-user PATH, %APPDATA%, ...),
            # which is the whole point of running it under another account.
            environment = win32profile.CreateEnvironmentBlock(token, False)

            with open(os.devnull, "rb") as devnull:
                stdin_handle = duplicate_as_inheritable(msvcrt.get_osfhandle(devnull.fileno()))
            stdout_handle = duplicate_as_inheritable(msvcrt.get_osfhandle(log_file.fileno()))

            startup_info = win32process.STARTUPINFO()
            startup_info.dwFlags = win32con.STARTF_USESTDHANDLES
            startup_info.lpDesktop = "winsta0\\default"
            startup_info.hStdInput = stdin_handle
            startup_info.hStdOutput = stdout_handle
            startup_info.hStdError = stdout_handle

            process_handle, thread_handle, pid, _ = win32process.CreateProcessAsUser(
                token,
                None,
                subprocess.list2cmdline(command),
                None,
                None,
                True,
                subprocess.CREATE_NO_WINDOW | win32con.CREATE_UNICODE_ENVIRONMENT,
                environment,
                self._config.executor_dir,
                startup_info,
            )

            win32api.CloseHandle(thread_handle)
            logging.info(f"Executor is running as {label}.")

            user_process = UserProcess(process_handle, pid, command, token, profile)
            token, profile = None, None

            return user_process
        finally:
            for handle in (stdin_handle, stdout_handle):
                if handle is not None:
                    win32api.CloseHandle(handle)
            if profile is not None:
                win32profile.UnloadUserProfile(token, profile)
            if token is not None:
                win32api.CloseHandle(token)

    def create_job_object(self):
        job = win32job.CreateJobObject(None, "")

        limits = win32job.QueryInformationJobObject(job, win32job.JobObjectExtendedLimitInformation)
        limits["BasicLimitInformation"]["LimitFlags"] |= win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        win32job.SetInformationJobObject(job, win32job.JobObjectExtendedLimitInformation, limits)

        return job

    def assign_to_job_object(self, job, pid: int):
        process_handle = None

        try:
            process_handle = win32api.OpenProcess(
                win32con.PROCESS_SET_QUOTA | win32con.PROCESS_TERMINATE, False, pid
            )
            win32job.AssignProcessToJobObject(job, process_handle)
        except Exception as error:
            logging.warning(f"Could not assign executor PID {pid} to a job object: {error}")
        finally:
            if process_handle is not None:
                win32api.CloseHandle(process_handle)

    def wait_for_executor(self, process):
        while True:
            exit_code = process.poll()
            if exit_code is not None:
                return exit_code

            if self._stop.is_set():
                return None

            time.sleep(1)

    def stop_executor(self, process, stop_event, job):
        logging.info(f"Signalling executor PID {process.pid} to stop gracefully...")
        win32event.SetEvent(stop_event)

        deadline = time.monotonic() + self._config.graceful_stop_timeout_seconds

        while time.monotonic() < deadline:
            exit_code = process.poll()
            if exit_code is not None:
                logging.info(f"Executor stopped gracefully with exit code {exit_code}.")
                return exit_code

            self.report_stop_pending()
            time.sleep(1)

        logging.warning(
            f"Executor did not stop within {self._config.graceful_stop_timeout_seconds}s - "
            f"terminating its process tree."
        )
        win32job.TerminateJobObject(job, 1)

        return None


def acquire_singleton_mutex():
    try:
        mutex = win32event.CreateMutex(None, True, SINGLETON_MUTEX_NAME)
        if win32api.GetLastError() == winerror.ERROR_ALREADY_EXISTS:
            return None
        return mutex
    except Exception:
        # Creating objects in the global namespace can be denied for non-elevated
        # accounts - single-instancing is a safety net, not a hard requirement.
        return True


def run_in_foreground():
    service = TestFarmWatchdogService()

    def handle_signal(signum, frame):
        service.SvcStop()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGBREAK, handle_signal)

    try:
        service.SvcDoRun()
    except Exception:
        return 1

    return 0


def main():
    if len(sys.argv) == 1:
        # No arguments means the Windows SCM launched us through the registered ImagePath.
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(TestFarmWatchdogService)
        servicemanager.StartServiceCtrlDispatcher()
    elif sys.argv[1] in ("run", "-debug"):
        # "run" is the documented foreground mode; "-debug" is what pywin32's own
        # `debug` command re-invokes this script with.
        sys.exit(run_in_foreground())
    else:
        win32serviceutil.HandleCommandLine(TestFarmWatchdogService)


if __name__ == "__main__":
    main()
