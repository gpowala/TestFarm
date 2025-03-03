import win32serviceutil
import sys

from test_farm_windows_service import TestFarmWindowsService

# def clone_and_checkout(repository_url, repository_branch, destination_directory):
#     repo = Repo.clone_from(repository_url, destination_directory, depth=1, sparse=True)
#     repo.git.checkout(repository_branch)

#     tree = repo.head.commit.tree

#     for entry in tree.traverse():
#         if entry.type == 'blob' and entry.path.endswith(".cs"):
#             print(entry.path)

if __name__ == "__main__":
    isDebugModeOn = len(sys.argv) > 1 and sys.argv[1] == "debug";
    
    # repository_url = "https://github.com/gpowala/TestFarm.git"
    # repository_branch = "main"
    # destination_directory = "C:/repos/temp"

    if isDebugModeOn:
        service = TestFarmWindowsService()
        service.SvcDoRun()
    else:
        win32serviceutil.HandleCommandLine(TestFarmWindowsService)
