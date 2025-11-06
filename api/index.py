"""
Vercel serverless function entry point for FastAPI
This file is required for Vercel to recognize the API routes
"""
import sys
import os
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
    # Wrap FastAPI app with Mangum for serverless compatibility
    # lifespan="off" because we handle connections per request in serverless
    handler = Mangum(app, lifespan="off")
except Exception as e:
    # Log the error for debugging in Vercel
    import traceback
    error_msg = f"""
    ========================================
    FAILED TO IMPORT APPLICATION
    ========================================
    Error: {str(e)}
    
    Traceback:
    {traceback.format_exc()}
    
    Python Path: {sys.path}
    Current Directory: {os.getcwd()}
    Root Directory: {root_dir}
    ========================================
    """
    print(error_msg, file=sys.stderr)
    # Create a minimal error handler that returns a proper error response
    from mangum import Mangum
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    error_app = FastAPI()
    
    @error_app.get("/{full_path:path}")
    @error_app.post("/{full_path:path}")
    @error_app.put("/{full_path:path}")
    @error_app.delete("/{full_path:path}")
    async def error_handler(full_path: str):
        return JSONResponse(
            status_code=500,
            content={
                "detail": f"Server initialization failed: {str(e)}",
                "error": "Check server logs for details. This usually means environment variables are missing or there's an import error."
            }
        )
    
    handler = Mangum(error_app, lifespan="off")
