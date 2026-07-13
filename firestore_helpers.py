from firestore_client import db
from datetime import datetime
import uuid
MAX_FREE_PROJECTS = 3  # Maximum number of free projects allowed per user
def count_user_projects(clerk_user_id):
    """Count the number of projects for a given user."""

    projects = db.collection("users").document(clerk_user_id).collection("projects") # Get the projects sub-collection for the user
    documents = projects.get() # Fetch all documents in the projects sub-collection
    return len(documents) # Return the count of documents (projects)

def create_project(clerk_user_id, repo_url, chroma_path):
    """Create a new project for the user if they have less than 3 projects."""
    projects_count = count_user_projects(clerk_user_id) # Count the number of existing projects for the user
    if projects_count >= MAX_FREE_PROJECTS:
        return None  # User has reached the limit of 3 projects
    project_id = uuid.uuid4().hex[:8]  # Generate a new project ID

    # Save the new project details in Firestore under the user's projects sub-collection
    projects = db.collection("users").document(clerk_user_id).collection("projects").document(project_id)
    projects.set({
        "repo_url": repo_url,
        "created_at": datetime.utcnow(),
        "chroma_path": chroma_path
    })
    return project_id

def save_chat(clerk_user_id, project_id, question, answer):
    """Save a chat (question and answer) for a specific project of a user."""
    chats_collection = db.collection("users").document(clerk_user_id).collection("projects").document(project_id).collection("chats")
    chat_data = {
        "question": question,
        "answer": answer,
        "timestamp": datetime.utcnow()
    }
    chats_collection.add(chat_data)

def get_project_chats(clerk_user_id, project_id):
    """Retrieve all chats for a specific project of a user."""
    chats_collection = db.collection("users").document(clerk_user_id).collection("projects").document(project_id).collection("chats")
    chats = chats_collection.order_by("timestamp").get()  # Fetch all chat documents ordered by timestamp
    dict_chats = dict()  # Initialize an empty dictionary to store chat data
    for chat in chats:
        dict_chats[chat.id] = chat.to_dict() # Convert each chat document to a dictionary and store in dict_chats
    return dict_chats  # Return the dictionary containing all chats for the project