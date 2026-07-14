import os
import stat
import shutil
from git import Repo
from langchain_community.document_loaders import TextLoader

def remove_readonly(func, path, exc_info):
    """Clear the readonly bit and reattempt the removal."""
    os.chmod(path, stat.S_IWRITE)
    func(path)

def clone_repo(repo_url, clone_path="target_repo"):
    """Clone a Git repository to a specified path, removing the existing directory if it exists."""
    if os.path.exists(clone_path):
        print(f"Removing existing directory: {clone_path}")
        shutil.rmtree(clone_path, onexc=remove_readonly)
    print(f"Cloning repository from {repo_url} to {clone_path}....")
    Repo.clone_from(repo_url, clone_path)
    print(f"Repository cloned successfully to {clone_path}")
    return clone_path

def load_code_files(repo_path):
    """Load code files from the cloned repository, ignoring certain directories and file types."""
    documents = []
    to_ignore = {
        '.git', '.svn', '.hg', '.idea', '.vscode', '.vs',
        '__pycache__', 'venv', 'env', '.venv', '.env',
        'site-packages', '.pytest_cache', '.mypy_cache', '.tox',
        'node_modules', 'dist', 'build', '.next', '.nuxt',
        'out', '.cache', '.parcel-cache', 'coverage',
        'target', '.gradle', 'gradle', '.settings', 'bin',
        'obj', 'packages',
        'ios', 'android', 'macos', 'windows', 'linux',
        '.dart_tool', '.pub-cache', 'Pods',
        '.terraform', 'vendor', 'logs', 'tmp', 'temp',
        '.DS_Store', 'egg-info', '.eggs'
    }
    allowed_extensions = {
        '.md', '.txt', '.rst', '.adoc',
        '.json', '.yml', '.yaml', '.xml', '.toml', '.ini', '.env.example', '.cfg',
        '.html', '.css', '.scss', '.sass', '.less',
        '.py', '.pyi',
        '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
        '.java', '.kt', '.kts', '.scala', '.groovy',
        '.c', '.cpp', '.h', '.hpp', '.cs',
        '.dart', '.swift',
        '.go', '.rs',
        '.rb', '.php', '.sh', '.bash', '.ps1',
        '.sql',
    }
    for dirpath, dirnames, filenames in os.walk(repo_path):
        dirnames[:] = [d for d in dirnames if d not in to_ignore]
        print(f"Processing directory: {dirpath}")
        for filename in filenames:
            if filename.startswith('.'):
                continue
            _, ext = os.path.splitext(filename)
            if ext in allowed_extensions:
                file_path = os.path.join(dirpath, filename)
                try:
                    loader = TextLoader(file_path=file_path, encoding='utf-8')
                    document = loader.load()
                    for doc in document:
                        doc.metadata["source"] = file_path
                    documents.extend(document)
                except Exception as e:
                    print(f"Skipping {file_path}: {e}")
    return documents