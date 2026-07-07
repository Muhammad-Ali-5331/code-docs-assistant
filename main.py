from repo_loader import clone_repo, load_code_files
from chunker import create_chunks
from vector_store import create_vectorstore
from qa_chain import build_qa_chain, ask_question
if __name__ == "__main__":
    repo_url = input("Enter the GitHub repository URL: ")
    local_path = clone_repo(repo_url)
    code_files = load_code_files(local_path)
    chunks = create_chunks(code_files)
    vectorStore = create_vectorstore(chunks)
    ragModel = build_qa_chain(vectorStore)
    while True:
        user_query = input("Ask a question (or type 'exit' to quit): ")
        if user_query.lower() == 'exit':
            break
        answer = ask_question(ragModel, user_query)
        print(f"Answer: {answer}")