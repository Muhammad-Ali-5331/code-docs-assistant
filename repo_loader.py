import zipfile
import requests
import os
import shutil
from langchain_community.document_loaders import TextLoader

def clone_repo(repo_url, clone_path="target_repo"):
    """Clone a Git repository to a specified path, removing the existing directory if it exists."""
    if os.path.exists(clone_path):
        print(f"Removing existing directory: {clone_path}")
        shutil.rmtree(clone_path, ignore_errors=True)
    parts = repo_url.rstrip("/").rstrip(".git").split("/")
    owner, repo_name = parts[-2], parts[-1]
    zip_path = f"{clone_path}_temp.zip"
    for branch in ["main", "master","dev","develop","development","release","prod","production","trunk","stable","default","staging"]:
        zip_url = f"https://github.com/{owner}/{repo_name}/archive/{branch}.zip"
        response = requests.get(zip_url,stream=True)
        if response.status_code == 200:
            with open(zip_path, "wb") as f:
               for chunk in response.iter_content(chunk_size=8192):
                   f.write(chunk)
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(".")
            extracted_folder = f"{repo_name}-{branch}"
            os.rename(extracted_folder, clone_path)
            os.remove(zip_path)
            print(f"Repository downloaded and extracted to {clone_path}")
            return clone_path
    raise Exception(f"Could not download repo (tried main/master branches): {repo_url}")

def load_code_files(repo_path):
    """Load code files from the cloned repository, ignoring certain directories and file types."""

    documents = []
    # Define directories to ignore
    to_ignore = {
    # Audio
    ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a",

    # Video
    ".mp4", ".avi", ".mov", ".mkv", ".webm", ".wmv",

    # Fonts
    ".ttf", ".otf", ".woff", ".woff2", ".eot",

    # Archives
    ".zip", ".rar", ".7z", ".tar", ".gz", ".xz", ".bz2",

    # Executables
    ".exe", ".dll", ".so", ".dylib", ".bin", ".class",
    
    # Image extensions
    ".png", ".jpg", ".jpeg", ".gif",".bmp",".webp", ".svg",".ico",".tif", ".tiff", ".avif", ".heic",
    
    # Version control & IDE
    '.git', '.svn', '.hg', '.idea', '.vscode', '.vs',
    
    # Python
    '__pycache__', 'venv', 'env', '.venv', '.env', 
    'site-packages', '.pytest_cache', '.mypy_cache', '.tox',
    
    # JavaScript / Node / Frontend
    'node_modules', 'dist', 'build', '.next', '.nuxt', 
    'out', '.cache', '.parcel-cache', 'coverage',
    
    # Java / Kotlin / Android
    'target', '.gradle', 'gradle', '.settings', 'bin',
    
    # C# / .NET
    'obj', 'packages',
    
    # Flutter / Dart / Mobile (jo tumne pehle dekha tha)
    'ios', 'android', 'macos', 'windows', 'linux', 
    '.dart_tool', '.pub-cache', 'Pods',
    
    # Rust
    'target',  # already covered above, no duplicate needed
    
    # General
    '.terraform', 'vendor', 'logs', 'tmp', 'temp',
    '.DS_Store', 'egg-info', '.eggs'
    }
    
    # Define allowed file extensions
    allowed_extensions = {
    # Documentation
    '.md', '.txt', '.rst', '.adoc',
    
    # Config / Data
    '.json', '.yml', '.yaml', '.xml', '.toml', '.ini', '.env.example', '.cfg',
    
    # Web
    '.html', '.css', '.scss', '.sass', '.less',
    
    # Python
    '.py', '.pyi',
    
    # JavaScript / TypeScript
    '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
    
    # JVM Languages
    '.java', '.kt', '.kts', '.scala', '.groovy',
    
    # C-family
    '.c', '.cpp', '.h', '.hpp', '.cs',
    
    # Mobile
    '.dart', '.swift',
    
    # Systems languages
    '.go', '.rs',
    
    # Scripting
    '.rb', '.php', '.sh', '.bash', '.ps1',
    
    # Database
    '.sql',
}
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