import os
from git import Repo

def clone_and_checkout(repository_url, repository_branch, destination_directory):
    repo = Repo.clone_from(repository_url, destination_directory, depth=1, sparse=True)
    repo.git.checkout(repository_branch)

    tree = repo.head.commit.tree

    for entry in tree.traverse():
        if entry.type == 'blob' and entry.path.endswith(".cs"):
            print(entry.path)

if __name__ == "__main__":
    repository_url = "https://github.com/gpowala/TestFarm.git"
    repository_branch = "main"
    destination_directory = "C:/repos/temp"

    clone_and_checkout(repository_url, repository_branch, destination_directory)

    os.removedirs(destination_directory)
