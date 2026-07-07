from langchain_ollama import ChatOllama
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
def build_qa_chain(vectorstore):
    """Build a question-answering chain for the given vectorstore."""

    # Initialize the LLM and the retriever
    llm = ChatOllama(model="llama3")

    # Create a retriever from the vectorstore with a specified number of documents to retrieve (k=5)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
    
    # Define a system prompt that instructs the model to be a helpful code assistant. The prompt includes a placeholder for context, 
    # which will be filled with relevant information retrieved from the vectorstore.
    system_prompt = "You are a helpful code assistant. Use the following context to answer the question: {context}"
    
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
        combine_documents_chain=chain
    )
    return rag_chain


def ask_question(rag_chain, query):
    """Ask a question using the RAG chain and return the answer."""
    response = rag_chain.invoke({"input": query})
    return response["answer"]