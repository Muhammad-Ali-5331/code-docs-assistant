from langchain_text_splitters import RecursiveCharacterTextSplitter
def create_chunks(documents):
    """ Create chunks from documents using RecursiveCharacterTextSplitter. 
    Allow chunk size of 1000 characters with an overlap of 200 characters. 
    Split the documents into chunks and return the list of chunks (Document objects). """

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    return splitter.split_documents(documents)