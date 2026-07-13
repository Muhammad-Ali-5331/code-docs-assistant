from firestore_client import db
from datetime import datetime
import uuid

MAX_FREE_PROJECTS = 3  # Maximum number of free projects allowed per user

def get_user_projects(clerk_user_id):
    projects = db.collection("users").document(clerk_user_id).collection("projects") # Get the projects sub-collection for the user
    return projects.get()

def get_user_project(clerk_user_id,project_id):
    project = db.collection("users").document(clerk_user_id).collection("projects").document(project_id).get()
    return project


def count_user_projects(clerk_user_id):
    """Count the number of projects for a given user."""
    return len(get_user_projects(clerk_user_id)) # Return the count of documents (projects)

def create_project(clerk_user_id, repo_url):
    """Create a new project for the user if they have less than 3 projects."""
    projects_count = count_user_projects(clerk_user_id) # Count the number of existing projects for the user
    if projects_count >= MAX_FREE_PROJECTS:
        return None  # User has reached the limit of 3 projects
    
    new_project_id = uuid.uuid4().hex[:8]  # Generate a new project ID
    final_chroma_path = f"chroma_db_{clerk_user_id}_{new_project_id}"  # Define the path for Chroma data
    
    # Save the new project details in Firestore under the user's projects sub-collection
    new_project = db.collection("users").document(clerk_user_id).collection("projects").document(new_project_id)
    new_project.set({
        "repo_url": repo_url,
        "created_at": datetime.utcnow(),
        "chroma_path": final_chroma_path
    })
    return (new_project_id, final_chroma_path)  # Return the new project ID and Chroma path

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
    results = []
    for chat in chats:
        chat_dict = chat.to_dict()
        chat_dict["timestamp"] = chat_dict["timestamp"].isoformat()  # Convert timestamp to ISO format string
        results.append(chat_dict)
    return results

def delete_user_project(clerk_user_id, project_id):
    """Delete a specific project for a user. This includes deleting all associated chats and the project document itself."""
    project_ref = db.collection("users").document(clerk_user_id).collection("projects").document(project_id)
    for chat in project_ref.collection("chats").get():  # Fetch all chat documents in the project's chats sub-collection
        chat.reference.delete()  # Delete each chat document in the project's chats sub-collection
    project_ref.delete()  # Delete the project document from Firestore