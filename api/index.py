"""
Vercel serverless function entry point for FastAPI
This file is required for Vercel to recognize the API routes
"""
from mangum import Mangum
from main import app

# Wrap FastAPI app with Mangum for serverless compatibility
# lifespan="off" because we handle connections per request in serverless
handler = Mangum(app, lifespan="off")
