from flask import Flask, render_template, request, jsonify
from repo_loader import clone_repo, load_code_files
from chunker import create_chunks
from vector_store import create_vectorstore
from qa_chain import build_qa_chain, ask_question

app = Flask(__name__)

# Global variable to hold the RAG chain
rag_chain = None

@app.route("/")
def home():
    """Render the home page."""
    return render_template("index.html")

@app.route("/process_repo", methods=["POST"])
def process_repo():
    """Process the GitHub repository URL provided by the user.""" 
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
def ask():
    """Handle the question asked by the user."""
    data = request.json
    question = data.get("question")
    answer = ask_question(rag_chain, question)
    return jsonify({"answer": answer})

if __name__ == "__main__":
    app.run(debug=True,use_reloader=False)