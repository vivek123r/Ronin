"""
Entry point for deployment. Ensures backend module is importable.
"""
import sys
import os

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn
from backend.api import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
