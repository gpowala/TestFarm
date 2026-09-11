import argparse
import logging
import threading

import win32event

from test_farm_windows_service import TestFarmWindowsService


def watch_stop_event(stop_event_name: str, executor: TestFarmWindowsService):
    """Ask the processing loop to finish once the TestFarm Watchdog signals its stop event."""
    try:
        stop_event = win32event.OpenEvent(win32event.SYNCHRONIZE, False, stop_event_name)
    except Exception as e:
        logging.error(f"Could not open stop event \"{stop_event_name}\": {e}")
        return

    win32event.WaitForSingleObject(stop_event, win32event.INFINITE)

    logging.info(f"Stop event \"{stop_event_name}\" signalled.")
    executor.request_stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="run.py", description="Runs the TestFarm executor.")
    parser.add_argument(
        "--stop-event",
        default=None,
        help="Name of a Win32 event that requests a graceful shutdown when signalled (used by the TestFarm Watchdog).",
    )
    args = parser.parse_args()

    executor = TestFarmWindowsService()

    if args.stop_event:
        threading.Thread(target=watch_stop_event, args=(args.stop_event, executor), daemon=True).start()

    try:
        executor.run()
    except KeyboardInterrupt:
        executor.request_stop()
    finally:
        executor.shutdown_host()
