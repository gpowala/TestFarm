import logging

from test_farm_windows_service import TestFarmWindowsService


if __name__ == "__main__":
    executor = TestFarmWindowsService()

    try:
        executor.run()
    except KeyboardInterrupt:
        executor.request_stop()
    except Exception:
        # stdout is discarded when running unattended, so make sure the failure reaches the log file.
        logging.exception("TestFarm Executor terminated with an unhandled error.")
        raise
    finally:
        executor.shutdown_host()
