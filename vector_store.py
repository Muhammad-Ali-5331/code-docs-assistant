from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
import os
def create_vectorstore(chunks, persist_directory="./chroma_db"):
    # Check if the persist directory exists, if not, create it
    if not os.path.exists(persist_directory):
        os.makedirs(persist_directory)
    
    # Create the embedding model using OllamaEmbeddings with the specified model
    embedding_model = OllamaEmbeddings(model="nomic-embed-text")
    
    # Create the Chroma vector store from the documents (chunks) and the embedding model 
    # and persist it to the specified directory
    vectorStore = Chroma.from_documents(
        documents=chunks,
        embedding=embedding_model,
        persist_directory=persist_directory
    )
    return vectorStore # return the vector store object for further use