from repo_loader import clone_repo, load_code_files
from chunker import create_chunks
from vector_store import create_vectorstore
from qa_chain import build_qa_chain, ask_question
import uuid

if __name__ == "__main__":
    try:
        repo_url = input("Enter the GitHub repository URL: ")
        session_id = uuid.uuid4().hex[:8]
        clone_path = f"target_repo_{session_id}"
        chroma_path = f"chroma_db_{session_id}"

        local_path = clone_repo(repo_url, clone_path=clone_path)
        code_files = load_code_files(local_path)
        print(f"Total files loaded: {len(code_files)}")

        chunks = create_chunks(code_files)
        vectorStore = create_vectorstore(chunks, persist_directory=chroma_path)
        ragModel = build_qa_chain(vectorStore)

        print("Setup complete! Ready to answer questions.\n")

        while True:
            user_query = input("Ask a question (or type 'exit' to quit): ")
            if user_query.lower() == 'exit':
                break
            answer = ask_question(ragModel, user_query)
            print(f"Answer: {answer}")

    except KeyboardInterrupt:
        print("\nExiting...")
    except Exception as e:
        import traceback
        traceback.print_exc()