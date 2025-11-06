"""
Vercel serverless function entry point for FastAPI
This file is required for Vercel to recognize the API routes
"""
import sys
from pathlib import Path

# Add parent directory to Python path to allow imports from root
# This MUST happen BEFORE importing main.py and other modules
root_dir = Path(__file__).parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# Now we can import from the root directory
try:
    from mangum import Mangum
    from main import app
except Exception as e:
    # Log the error for debugging in Vercel
    import traceback
    error_msg = f"Failed to import application: {str(e)}\n{traceback.format_exc()}"
    print(error_msg, file=sys.stderr)
    raise

# Wrap FastAPI app with Mangum for serverless compatibility
# lifespan="off" because we handle connections per request in serverless
handler = Mangum(app, lifespan="off")
