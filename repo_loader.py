import os
import stat
import shutil
from git import Repo

def remove_readonly(func, path, exc_info):
    os.chmod(path, stat.S_IWRITE)
    func(path)

def clone_repo(repo_url, clone_path="target_repo"):
    if os.path.exists(clone_path):
        print(f"Removing existing directory: {clone_path}")
        shutil.rmtree(clone_path, onexc=remove_readonly)
    print(f"Cloning repository from {repo_url} to {clone_path}....")
    Repo.clone_from(repo_url, clone_path)
    print(f"Repository cloned successfully to {clone_path}")
    return clone_path