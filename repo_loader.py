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

    to_ignore = {'.git', 'node_modules', '__pycache__', 'venv', '.idea', '.vscode', 'dist', 'build'}
    allowed_extensions = {'.py', '.md', '.js', '.ts', '.java', '.txt', '.json', '.html', '.css', '.yml', '.yaml', '.xml'}
    documents = []

    # Loop through all files in the repository
    for dirpath, dirnames, filenames in os.walk(repo_path):
        # Skip Directories that are in the ignore list
        dirnames[:] = [d for d in dirnames if d not in to_ignore]
        print(f"Processing directory: {dirpath}") 
        for filename in filenames:
            if filename.startswith('.'):
                continue  # Skip hidden files
            _, ext = os.path.splitext(filename)
            # Check if the file extension is in the allowed list
            if ext in allowed_extensions:
                file_path = os.path.join(dirpath, filename)
                try:
                    loader = TextLoader(file_path=file_path, encoding='utf-8')
                    document = loader.load()
                    for doc in document:
                        # Add metadata for the source file path
                        doc.metadata["source"] = file_path
                    documents.extend(document)
                except Exception as e:
                    print(f"Skipping {file_path}: {e}")
    return documents
if __name__ == "__main__":
    test_repo_url = "https://github.com/Muhammad-Ali-5331/skills-code-with-codespaces"
    path = clone_repo(test_repo_url)
    documents = load_code_files(path)
    print(f"Loaded {len(documents)} documents from the repository.")