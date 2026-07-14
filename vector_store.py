from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
import os
# Create the embedding model using HugginFaceEmbeddings with the specified model
_embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
def create_vectorstore(chunks, persist_directory="./chroma_db"):
    """Create a Chroma vector store from the given chunks and persist it to the specified directory.
    If the persist directory does not exist, it will be created."""

    print(f"Starting embedding creation for {len(chunks)} chunks...")
    print("This may take a while depending on chunk count...")

    # Check if the persist directory exists, if not, create it
    if not os.path.exists(persist_directory):
        os.makedirs(persist_directory)
    
    # Create the Chroma vector store from the documents (chunks) and the embedding model 
    # and persist it to the specified directory
    vectorStore = Chroma.from_documents(
        documents=chunks,
        embedding=_embedding_model,
        persist_directory=persist_directory
    )

    print(f"Vector store created and persisted to {persist_directory}")
    
    return vectorStore # return the vector store object for further use

def load_existing_vectorstore(persist_directory):
    """Load an already-existing Chroma vector store from disk (no new documents)."""
    return Chroma(persist_directory=persist_directory,embedding_function=_embedding_model)