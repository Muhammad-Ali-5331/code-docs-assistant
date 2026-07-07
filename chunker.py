from langchain_text_splitters import RecursiveCharacterTextSplitter
def create_chunks(documents):
    """ Create chunks from documents using RecursiveCharacterTextSplitter. 
    Allow chunk size of 1000 characters with an overlap of 200 characters. 
    Split the documents into chunks and return the list of chunks (Document objects). """

    print(f"Creating chunks from {len(documents)} documents...")
    
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(documents)

    print(f"Created {len(chunks)} chunks.")

    return chunks