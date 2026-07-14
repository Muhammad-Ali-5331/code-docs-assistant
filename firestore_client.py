"""Firebase Firestore Client"""

import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

firebase_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
cred_dict = json.loads(firebase_json)
cred = credentials.Certificate(cred_dict)

firebase_admin.initialize_app(cred)

db = firestore.client()