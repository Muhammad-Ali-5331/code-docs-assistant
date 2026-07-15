from flask import Flask, render_template, request, jsonify,send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from repo_loader import clone_repo, load_code_files
from chunker import create_chunks
from vector_store import create_vectorstore,load_existing_vectorstore
from qa_chain import build_qa_chain, ask_question
from firestore_helpers import create_project, get_user_projects,save_chat, get_user_project,get_project_chats,delete_user_project,find_existing_project,MAX_FREE_PROJECTS
from clerk_backend_api import Clerk, AuthenticateRequestOptions
from functools import wraps
import httpx,os,shutil,time,gc,stat

clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
app = Flask(__name__)

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],  # global default
    storage_uri="memory://",
)

rag_chains = dict()  # Initialize as an empty dictionary to hold RAG chains for different users/projects

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        httpx_request = httpx.Request(
            method=request.method,
            url=request.url,
            headers=dict(request.headers),
        )

        try:
            request_state = clerk.authenticate_request(
                httpx_request,
                AuthenticateRequestOptions()
            )

            if not request_state.is_signed_in:
                return jsonify({"error": "Not signed in"}), 401

            request.clerk_user_id = request_state.payload.get("sub")

        except Exception as e:
            return jsonify({"error": f"Invalid or expired token: {str(e)}"}), 401

        return f(*args, **kwargs)
    return decorated

def safe_rmtree(path, retries=8, delay=0.5):
    """Try to delete a folder, retrying briefly in case a file handle (e.g., Chroma's SQLite) hasn't released yet."""
    def force_remove_readonly(func, path, exc_info):
        """Force remove read-only files on Windows (common with .git folders)."""
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass
    for attempt in range(retries):
        try:
            shutil.rmtree(path, onexc=force_remove_readonly)
            return
        except FileNotFoundError:
            return 
        except Exception as e:
            time.sleep(delay)

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"status": "error", "message": "Too many requests. Please slow down and try again in a while."}), 429

@app.route('/favicon.ico')
def favicon():
    """Serve the favicon.ico file from the static directory."""
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/login')
@limiter.limit("20 per hour")
def login(): 
    """Render the login page."""
    return render_template("login.html")

@app.route("/")
def home():
    """Render the home page."""
    return render_template("index.html")

@app.route("/open_project/<project_id>",methods=["POST"])
@require_auth
def openProjects(project_id):
    try:
        clerk_user_id = request.clerk_user_id
        doc = get_user_project(clerk_user_id,project_id)
        if doc.exists:
            data = doc.to_dict()
            chroma_path = data["chroma_path"]
            vectorStore_obj = load_existing_vectorstore(chroma_path)
            rag_chains[(clerk_user_id,project_id)] = {
                "chain": build_qa_chain(vectorStore_obj),
                "vectorstore": vectorStore_obj
            }
            chat_list = get_project_chats(clerk_user_id,project_id)
            return jsonify({"status":"success","chats":chat_list})
        else: 
            return jsonify({"status": "error", "message": f"Failed to retrieve user or project information - No project exists."}), 400

    except Exception as e:
        return jsonify({"status": "error", "message": f"Failed to retrieve user or project information: {str(e)}"}), 400

@app.route("/projects")
@require_auth
def projects():
    clerk_id = request.clerk_user_id
    documents = get_user_projects(clerk_id) # Fetch the user's projects from Firestore
    
    result = [] # Initialize an empty list to hold the project details
    
    for doc in documents:
        data = doc.to_dict()
        result.append({
            "project_id":doc.id,
            "repo_url": data["repo_url"],
            "created_at": data["created_at"].isoformat(),  # Convert datetime to ISO format string
        })
    return jsonify({"status":"success","projects":result})

@app.route("/projects/<project_id>", methods=["DELETE"])
@require_auth
def delete_project(project_id):
    """Delete a project for the authenticated user. 
    This includes removing the project from Firestore, deleting the cloned repository folder, and deleting the Chroma vector store folder.
    """
    clerk_user_id = request.clerk_user_id
    
    if (clerk_user_id, project_id) in rag_chains:
        entry = rag_chains.pop((clerk_user_id, project_id))
        try:
            entry["vectorstore"]._client.close()  # closes the SQLite handle
        except Exception: 
            pass

    delete_user_project(clerk_user_id,project_id) # Delete the project and its data from Firestore
    
    chroma_path = f"chroma_db_{clerk_user_id}_{project_id}"
    target_repo_path = f"target_repo_{clerk_user_id}_{project_id}"

    gc.collect()
    time.sleep(0.5)

    safe_rmtree(target_repo_path)  # Delete the cloned repository folder
    safe_rmtree(chroma_path)  # Delete the chroma folder if it exists
    
    return jsonify({"status": "success"})
@app.route("/process_repo", methods=["POST"])
@require_auth
@limiter.limit("3 per hour; 10 per day")
def process_repo():
    """Process the repository URL provided by the user. 
    This includes cloning the repo, loading code files, creating chunks, creating a vector store, and building a RAG chain."""
    try:
        clerk_user_id = request.clerk_user_id
        data = request.json
        repo_url = data.get("repo_url")

        # Check if the project already exists for the user
        existing_project_id = find_existing_project(clerk_user_id, repo_url)
        if existing_project_id is not None:
            # If the project already exists, return a response indicating that the repo is already indexed
            return jsonify({ "status": "exists", "project_id": existing_project_id, "message": "This repo is already indexed. Opening existing project." })
        
        # If the project does not exist, create a new project
        result = create_project(clerk_user_id, repo_url)
        if result is None: return jsonify({"status": "error", "message": f"User has reached the limit of {MAX_FREE_PROJECTS} projects."}), 403
        
        # Unpack the result tuple into project_id and chroma_path
        project_id, chroma_path = result

        # Clone the repository into a unique directory based on the user ID and project ID to avoid conflicts
        clone_path = f"target_repo_{clerk_user_id}_{project_id}"
        clone_repo(repo_url, clone_path)

        # Load code files
        code_files = load_code_files(clone_path)

        # Create chunks
        chunks = create_chunks(code_files)

        # Create vector store
        vectorstore = create_vectorstore(chunks, persist_directory=chroma_path)

        # Build RAG chain and store it in the global dictionary
        rag_chains[(clerk_user_id, project_id)] = {
            "chain": build_qa_chain(vectorstore),
            "vectorstore": vectorstore
        }
        return jsonify({"status": "success", "project_id": project_id})
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/ask", methods=["POST"])
@require_auth
@limiter.limit("15 per hour")
def ask():
    """Handle a question asked by the user for a specific project."""
    try:
        clerk_user_id = request.clerk_user_id
        data = request.json

        project_id = data.get("project_id")
        question = data.get("question")

        # Validate that both project_id and question are provided in the request
        if not project_id or not question:
            return jsonify({"status": "error", "message": "Missing project_id or question in the request."}), 400
        
        # Retrieve the current RAG chain for the user and project from the global dictionary
        curr_rag_chain = rag_chains.get((clerk_user_id, project_id))

        # Validate that the RAG chain exists for the given user and project
        if curr_rag_chain is None:
            return jsonify({"status": "error", "message": "Session expired for this project. Please reopen it."}), 400
        
        # Check if the user wants to stop the session
        if question.lower() == "stop":
            return jsonify({"status": "stopped"})
        
        # Ask the question using the RAG chain,save the chat, and return the answer
        answer = ask_question(curr_rag_chain["chain"], question)
        save_chat(clerk_user_id, project_id, question, answer)
        return jsonify({"answer": answer})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Failed to retrieve user or project information: {str(e)}"}), 400

@app.route("/stop", methods=["POST"])
@require_auth
def stop():
    """Stop the current RAG chain for the user and project."""
    return jsonify({"status": "stopped"})

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port)