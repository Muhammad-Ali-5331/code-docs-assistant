from flask import Flask, render_template, request, jsonify,send_from_directory
from repo_loader import clone_repo, load_code_files
from chunker import create_chunks
from vector_store import create_vectorstore
from qa_chain import build_qa_chain, ask_question
import httpx
from clerk_backend_api import Clerk, AuthenticateRequestOptions
from functools import wraps
import time
import os

clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
app = Flask(__name__)

# Global variable to hold the RAG chain
rag_chain = None

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
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/login')
def login(): 
    return render_template("login.html")

@app.route("/")
def home():
    """Render the home page."""
    return render_template("index.html")

@app.route("/process_repo", methods=["POST"])
@require_auth
def process_repo():
    """Process the GitHub repository URL provided by the user.""" 
    time.sleep(3)
    data = request.json
    URL = data.get("repo_url")
    local_path = clone_repo(URL)
    code_files = load_code_files(local_path)
    chunks = create_chunks(code_files)
    vectorstore = create_vectorstore(chunks)
    global rag_chain
    rag_chain = build_qa_chain(vectorstore)
    return jsonify({"status": "success"})

@app.route("/ask", methods=["POST"])
@require_auth
def ask():
    """Handle the question asked by the user."""
    time.sleep(3)
    data = request.json
    question = data.get("question")
    answer = ask_question(rag_chain, question)
    return jsonify({"answer": answer})

@app.route("/stop", methods=["POST"])
@require_auth
def stop():
    """Stop the RAG chain and clean up resources."""
    global rag_chain
    rag_chain = None
    return jsonify({"status": "stopped"})

if __name__ == "__main__":
    app.run(debug=True,use_reloader=False)