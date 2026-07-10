# 🧠 Code Repository for Question Answering Chain
This project is designed to create a question-answering chain using a vector store and a large language model. The chain is built by cloning a GitHub repository, loading code files, creating chunks, and generating a vector store. The vector store is then used to build a Retrieval-Augmented Generation (RAG) chain, which combines the capabilities of a large language model with a retriever that fetches relevant documents from the vector store.

## 🚀 Features
- Clones a GitHub repository and loads code files from it
- Creates chunks from the loaded code files using a text splitter
- Builds a vector store from the chunks
- Constructs a RAG chain using the vector store and a large language model
- Provides a question-answering interface using the RAG chain
- Supports multiple routes for rendering the home page, processing a repository, asking a question, and stopping the RAG chain

## 🛠️ Tech Stack
- **Frontend:** Flask
- **Backend:** Python
- **Database:** Vector store (Chroma)
- **AI Tools:** Langchain, Langchain Ollama, Langchain Classic
- **Build Tools:** Git
- **Dependencies:** 
  - langchain
  - langchain-community
  - langchain-ollama
  - langchain-classic
  - langchain-text-splitters
  - chromadb

## 📦 Installation
To install the required dependencies, run the following command:
```bash
pip install -r requirements.txt
```
This will install all the necessary libraries and their versions specified in the `requirements.txt` file.

## 💻 Usage
To run the application, execute the following command:
```bash
python flask_app.py
```
This will start the Flask web application, and you can access it through your web browser.

## 📂 Project Structure
```markdown
.
├── chunker.py
├── flask_app.py
├── main.py
├── qa_chain.py
├── repo_loader.py
├── requirements.txt
├── vector_store.py
```

## 🤝 Contributing
To contribute to this project, please fork the repository and submit a pull request with your changes. Make sure to follow the standard professional guidelines for commit messages and code formatting.

## 📝 License
This project is licensed under the MIT License. See the LICENSE file for more information.

## 📬 Contact
For any questions or concerns, please contact us at [malitariq5324@gmail.com](mailto:malitariq5324@gmail.com).

## 💖 Thanks Message
We would like to thank all the contributors and users of this project for their support and feedback. This project is constantly evolving, and we appreciate your help in making it better.
