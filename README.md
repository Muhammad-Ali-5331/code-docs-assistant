# 🤖 CodeChat — AI-Powered Codebase Assistant

CodeChat lets you point at any public GitHub repository and ask questions about its code in plain English. It clones the repo, indexes it using Retrieval-Augmented Generation (RAG), and answers your questions with context pulled directly from the source files — complete with source citations.

**🔗 Live Demo:** [code-docs-assistant-production.up.railway.app](https://code-docs-assistant-production.up.railway.app)

![Status](https://img.shields.io/badge/status-active-success)
![Python](https://img.shields.io/badge/python-3.13-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- 🔍 **Instant Codebase Indexing** — paste any public GitHub repo URL and it's cloned, chunked, and embedded in seconds
- 💬 **Context-Aware Chat** — ask questions about the code and get accurate, source-grounded answers via RAG
- 🗂️ **Project History** — every indexed repo becomes a saved project with full chat history you can revisit anytime
- 🔐 **Authentication** — secure sign-in/sign-up powered by Clerk, with per-user session isolation
- 🚦 **Usage Limits & Rate Limiting** — free tier caps projects per user and rate-limits API calls to prevent abuse
- 🗑️ **Project Management** — delete indexed projects on demand, with automatic cleanup of vector stores and cloned repos
- ⚡ **Fast Inference** — powered by Groq's LLaMA 3 for near-instant responses
- 🎨 **Polished UI** — smooth animations, typewriter-style responses, live "thinking" indicators, and a fully responsive mobile layout
- ⏹️ **Stoppable Responses** — cancel an in-progress answer without breaking your session
- 🩺 **Health Check Endpoint** — lightweight `/health` route for uptime monitoring

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Flask (Python), Gunicorn |
| **AI / RAG** | LangChain, Groq (LLaMA 3), HuggingFace Inference API (embeddings) |
| **Vector Store** | ChromaDB |
| **Auth** | Clerk |
| **Database** | Firebase Firestore |
| **Repo Fetching** | GitPython |
| **Rate Limiting** | Flask-Limiter |
| **Frontend** | Vanilla JavaScript, CSS (no framework) |
| **Deployment** | Docker on Railway |
| **CI/CD** | GitHub Actions (tests on PR, automated releases on tag push) |

---

## 🏗️ Architecture

```
User → Clerk (Auth) → Flask Backend
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        Firestore      GitPython      Groq API
        (projects,    (clone repo)   (LLaMA 3
         chats)             │         inference)
                             ▼
                    Chunking + Embedding
                       (HF Inference API)
                             │
                             ▼
                        ChromaDB
                    (vector storage)
```

**Flow:** A user submits a repo URL → the backend clones it → source files are chunked and embedded via HuggingFace's hosted Inference API → embeddings are stored in ChromaDB → when a question is asked, relevant chunks are retrieved and passed to Groq's LLaMA 3 model → the answer is streamed back and saved to Firestore for future reference.

---

## 🚀 Getting Started (Local Setup)

### Prerequisites
- Python 3.13+
- Git
- Accounts for: [Clerk](https://clerk.com), [Groq](https://console.groq.com), [Firebase](https://console.firebase.google.com), [Hugging Face](https://huggingface.co)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/Muhammad-Ali-5331/code-docs-assistant.git
   cd code-docs-assistant
   ```

2. Create a virtual environment and install dependencies
   ```bash
   python -m venv rag-env
   rag-env\Scripts\activate      # Windows
   source rag-env/bin/activate   # macOS/Linux
   pip install -r requirements.txt
   ```

3. Set up environment variables — create a `.env` file in the project root:
   ```
   GROQ_API_KEY=your_groq_api_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   HF_API_TOKEN=your_huggingface_api_token
   FIREBASE_CREDENTIALS_JSON=your_firebase_service_account_json
   ```
   > **Note:** `firestore_client.py` reads the Firebase service account as a JSON string
   > from `FIREBASE_CREDENTIALS_JSON`, not a file path — make sure your `.env` value is
   > the full JSON content (as a single-line string), not a path to a file.

4. Run the app
   ```bash
   python flask_app.py
   ```
   Visit `http://127.0.0.1:5000`

### CLI Mode (No Web UI)
For quick testing without the web interface:
```bash
python cli.py
```

---

## 🐳 Deployment (Docker + Railway)

This project ships with a `Dockerfile` for reliable, reproducible deployments (includes `git` for repo cloning, which some platform-native builders omit).

1. Push the repo to GitHub
2. Create a new Railway project → deploy from GitHub repo
3. Railway auto-detects the `Dockerfile`
4. Set the following environment variables in Railway's dashboard:
   - `GROQ_API_KEY`
   - `CLERK_SECRET_KEY`
   - `HF_API_TOKEN`
   - `FIREBASE_CREDENTIALS_JSON` (paste the full service account JSON as a single value)
5. Deploy — Railway will build the image and expose a public URL

> **Note:** By default, the filesystem is ephemeral — indexed repos and vector stores won't survive a restart unless a [Railway Volume](https://docs.railway.com/volumes) is attached.

### Keeping the free-tier deployment awake

Railway's free plan requires serverless mode, which scales the container to zero after ~10 minutes of inactivity. A `/health` endpoint is included for use with an uptime monitor (e.g. [UptimeRobot](https://uptimerobot.com)) pinging every 5 minutes to keep it warm.

⚠️ This is a workaround, not a permanent fix — it works against the platform's intended idle-scaling behavior and will consume free-tier usage/compute allocation faster. For real production uptime, upgrading to a paid Railway plan (which allows disabling serverless mode) is the correct long-term approach.

---

## 📂 Project Structure

```
.
├── flask_app.py            # Main Flask application & API routes
├── cli.py                  # Standalone CLI version (no auth/web UI)
├── repo_loader.py          # Clones repos & loads source files
├── chunker.py               # Splits documents into chunks
├── vector_store.py          # Creates/loads Chroma vector stores
├── qa_chain.py              # Builds the RAG chain (Groq + retriever)
├── firestore_client.py      # Firebase initialization
├── firestore_helpers.py     # Firestore CRUD (projects, chats, limits)
├── templates/                # HTML templates (index, login)
├── static/                   # CSS & JavaScript
├── Dockerfile
├── requirements.txt
├── requirements-dev.txt      # Dev/test-only dependencies
└── .env                      # Local environment variables (not committed)
```

---

## 🔒 Security

- All API routes are protected by Clerk-verified authentication (JWT-based, verified server-side via `clerk-backend-api`)
- Per-user, per-project data isolation — no cross-user data leakage
- Rate limiting on all endpoints, with stricter limits on resource-intensive routes (repo indexing, chat)
- Private repository detection with graceful error handling
- Secrets managed exclusively via environment variables — never committed to source control

---

## 🗺️ Roadmap

- [ ] Persistent storage via Railway Volumes ([tracking issue](https://github.com/Muhammad-Ali-5331/code-docs-assistant/issues))
- [ ] Support for branch selection (beyond `main`/`master`)
- [ ] Streaming responses (token-by-token)
- [ ] Paid tiers with higher project/chat limits
- [ ] Expand test coverage beyond core logic

---

## 📝 License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

## 📬 Contact

Questions or feedback? Reach out at [me](mailto:malitariq5324@gmail.com)
