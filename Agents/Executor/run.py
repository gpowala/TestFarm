import win32serviceutil
import sys

from test_farm_windows_service import TestFarmWindowsService

if __name__ == "__main__":
    isDebugModeOn = len(sys.argv) > 1 and sys.argv[1] == "debug";

    if isDebugModeOn:
        service = TestFarmWindowsService()
        service.SvcDoRun()
    else:
        win32serviceutil.HandleCommandLine(TestFarmWindowsService)
