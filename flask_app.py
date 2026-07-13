from flask import Flask, render_template, request, jsonify,send_from_directory
from repo_loader import clone_repo, load_code_files
from chunker import create_chunks
from vector_store import create_vectorstore,load_existing_vectorstore
from qa_chain import build_qa_chain, ask_question
from firestore_helpers import create_project, get_user_projects,save_chat, get_user_project,get_project_chats,delete_user_project,MAX_FREE_PROJECTS
from clerk_backend_api import Clerk, AuthenticateRequestOptions
from functools import wraps
import httpx
import time
import os
import shutil

clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
app = Flask(__name__)

rag_chains = dict()  # Initialize as an empty dictionary to hold RAG chains for different users/projects
last_active_project = dict()  # Initialize as an empty dictionary to hold the last active project for each user

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

@app.route('/favicon.ico')
def favicon():
    """Serve the favicon.ico file from the static directory."""
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/login')
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
            rag_chains[(clerk_user_id,project_id)] = build_qa_chain(vectorStore_obj)
            last_active_project[clerk_user_id] = project_id
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
    clerk_user_id = request.clerk_user_id
    delete_user_project(clerk_user_id,project_id)
    chroma_path = f"chroma_db_{clerk_user_id}_{project_id}"
    target_repo_path = f"target_repo_{clerk_user_id}_{project_id}"
    shutil.rmtree(target_repo_path, ignore_errors=True)  # Delete the cloned repository folder
    shutil.rmtree(chroma_path, ignore_errors=True)  # Delete the chroma folder if it exists
    if (clerk_user_id, project_id) in rag_chains:
        del rag_chains[(clerk_user_id, project_id)]
    return jsonify({"status": "success"})
@app.route("/process_repo", methods=["POST"])
@require_auth
def process_repo():
    """Process the repository URL provided by the user. 
    This includes cloning the repo, loading code files, creating chunks, creating a vector store, and building a RAG chain."""
    try:
        clerk_user_id = request.clerk_user_id
        data = request.json
        repo_url = data.get("repo_url")
        result = create_project(clerk_user_id, repo_url)
        if result is None: return jsonify({"status": "error", "message": f"User has reached the limit of {MAX_FREE_PROJECTS} projects."}), 403
        
        # Unpack the result tuple into project_id and chroma_path
        project_id, chroma_path = result

        # Clone the repository into a unique directory based on the user ID and project ID
        clone_path = f"target_repo_{clerk_user_id}_{project_id}"
        clone_repo(repo_url, clone_path)

        # Load code files
        code_files = load_code_files(clone_path)

        # Create chunks
        chunks = create_chunks(code_files)

        # Create vector store
        vectorstore = create_vectorstore(chunks, persist_directory=chroma_path)

        # Build RAG chain and store it in the global dictionary
        rag_chains[(clerk_user_id, project_id)] = build_qa_chain(vectorstore)

        # Update the last active project for the user
        last_active_project[clerk_user_id] = project_id

        return jsonify({"status": "success", "project_id": project_id})
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/ask", methods=["POST"])
@require_auth
def ask():
    try:
        clerk_user_id = request.clerk_user_id
        project_id = last_active_project.get(clerk_user_id)
        if project_id is None:
            return jsonify({"status": "error", "message": "No active project found for the user."}), 400
        curr_rag_chain = rag_chains.get((clerk_user_id, project_id))
        if curr_rag_chain is None:
            return jsonify({"status": "error", "message": "RAG chain not found for the specified user and project."}), 400
        data = request.json
        question = data.get("question")
        if question.lower() == "stop":
            return jsonify({"status": "stopped"})
        answer = ask_question(curr_rag_chain, question)
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
    app.run(debug=True,use_reloader=False)