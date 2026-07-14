from langchain_groq import ChatGroq
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv
import os

load_dotenv()

def build_qa_chain(vectorstore):
    """Build a question-answering chain for the given vectorstore."""

    print("Building QA chain...")

    # Initialize the LLM and the retriever
    llm = ChatGroq(
        model="llama-3.1-8b-instant",
        api_key=os.getenv("GROQ_API_KEY")
    )

    # Create a retriever from the vectorstore with a specified number of documents to retrieve (k=5)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
    system_prompt = (
    "You are CodeChat, an AI assistant that helps developers understand codebases.\n"
    "You are NOT a person. You are NOT the repository's author.\n"
    "You analyze and explain code — nothing else.\n\n"
    "You are a code assistant. You ONLY answer questions about the provided codebase.\n\n"
    "STRICT RULES:\n"
    "- If the question is NOT about the code, files, or project in the context, respond EXACTLY with: "
    "'I can only answer questions about this codebase. Please ask something related to the codebase.'\n"
    "- Do NOT answer general knowledge, geography, math, or off-topic questions.\n"
    "- If the context is empty or irrelevant to the question, say you couldn't find relevant code.\n\n"
    "Formatting rules:\n"
    "- Use Markdown formatting (bold, bullet points) where it improves clarity.\n"
    "- Use bullet points only for lists of distinct items/features, not for every sentence.\n"
    "- Use emojis sparingly, only where they add clarity — do not overuse them.\n"
    "- Keep the response concise and well-structured.\n\n"
    "Context: {context}"
    )
    
    # Create a chat prompt template that combines the system prompt and the user's question. 
    # The template allows for dynamic insertion of the user's question into the prompt.
    chat_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("user", "{input}"),
        ]
    )

    # Create a chain that processes the retrieved documents and generates an answer based on the combined context and user question.
    chain = create_stuff_documents_chain(
        llm=llm, 
        prompt=chat_prompt
    )

    # Combine the retriever and the chain into a retrieval chain for RAG application
    # It connects the retriever to the chain, allowing the model to retrieve relevant documents and then use them to answer questions.
    rag_chain = create_retrieval_chain(
        retriever=retriever,
        combine_docs_chain=chain
    )
    
    print("QA chain built successfully.")
    
    return rag_chain


def ask_question(rag_chain, query):
    """Ask a question using the RAG chain and return the answer."""
    print(f"Asking question: {query}")
    response = rag_chain.invoke({"input": query})
    return response["answer"]