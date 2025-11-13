from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
from contextlib import asynccontextmanager
import uvicorn
import os
from datetime import timedelta, datetime

from schemas import (
    QueryRequest, QueryResponse, 
    UserSignup, UserLogin, Token, UserResponse
)
from services import AmplifiService
from database import connect_to_mongo, close_mongo_connection, get_users_collection
from auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, get_current_user_email
)
from config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        await connect_to_mongo()
    except Exception as e:
        print(f"Warning: MongoDB connection failed in lifespan: {e}")
        # In serverless, connection will be established on first request
    yield
    # Shutdown - Note: In serverless, this may not always run
    try:
        await close_mongo_connection()
    except Exception:
        pass

app = FastAPI(
    title="Amplifi Connector",
    description="Authenticated proxy to Amplifi.",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware to allow frontend requests
# Supports both same-domain (Vercel) and separate deployment (Render + Vercel)
FRONTEND_URL = os.getenv("FRONTEND_URL", "")
VERCEL_URL = os.getenv("VERCEL_URL", "")  # Vercel automatically sets this (for same-domain deployment)

# Build allowed origins list
ALLOWED_ORIGINS = [
    "http://localhost:3000",  # Local development
]

# Add explicit frontend URL if set (for separate deployment: Render + Vercel)
if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL)
    # Also add without protocol if needed
    if FRONTEND_URL.startswith("https://"):
        ALLOWED_ORIGINS.append(FRONTEND_URL.replace("https://", "http://"))
    elif FRONTEND_URL.startswith("http://"):
        ALLOWED_ORIGINS.append(FRONTEND_URL.replace("http://", "https://"))

# Add Vercel URL if it exists (for same-domain deployment)
if VERCEL_URL:
    ALLOWED_ORIGINS.extend([
        f"https://{VERCEL_URL}",
        f"http://{VERCEL_URL}",
    ])

# For separate deployment, if FRONTEND_URL is not set, allow all origins
# This ensures it works immediately, but you should set FRONTEND_URL in Render for security
if not FRONTEND_URL:
    # Allow all origins if FRONTEND_URL is not set (works for testing)
    # TODO: Set FRONTEND_URL in Render environment variables for production
    ALLOWED_ORIGINS = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Defer AmplifiService instantiation to avoid errors if settings aren't loaded
_amplifi_service = None

def get_amplifi_service():
    global _amplifi_service
    if _amplifi_service is None:
        try:
            _amplifi_service = AmplifiService()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize AmplifiService: {str(e)}. Check environment variables."
            )
    return _amplifi_service

@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    """
    Simple health check endpoint to verify the server is running.
    This endpoint works even if settings aren't fully configured.
    """
    health_status = {
        "status": "ok",
        "message": "Server is running",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Check if settings are loaded
    try:
        from config import _settings_instance
        if _settings_instance is None:
            health_status["settings"] = "not_configured"
            health_status["warning"] = "Environment variables may be missing. Check Render settings."
        else:
            health_status["settings"] = "configured"
    except Exception:
        health_status["settings"] = "unknown"
    
    return health_status

@app.get("/api/v1/test/connection", tags=["Test"])
async def test_connection(
    amplifi: AmplifiService = Depends(get_amplifi_service)
):
    """
    Test the connection to Amplifi by getting an access token.
    """
    try:
        result = amplifi.test_connection()
        if result["status"] == "success":
            return result
        else:
            raise HTTPException(status_code=500, detail=result["message"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection test failed: {e}")

# --- Authentication Endpoints ---
@app.post("/api/v1/auth/signup", response_model=UserResponse, tags=["Authentication"])
async def signup(user_data: UserSignup):
    """
    Create a new user account.
    """
    try:
        users_collection = await get_users_collection()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connection failed: {str(e)}"
        )
    
    try:
        # Check if user already exists
        existing_user = await users_collection.find_one({"email": user_data.email})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        existing_username = await users_collection.find_one({"username": user_data.username})
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        user_dict = {
            "email": user_data.email,
            "username": user_data.username,
            "hashed_password": hashed_password,
            "created_at": str(datetime.utcnow())
        }
        
        result = await users_collection.insert_one(user_dict)
        user_dict["id"] = str(result.inserted_id)
        
        return UserResponse(
            id=user_dict["id"],
            email=user_dict["email"],
            username=user_dict["username"]
        )
    except HTTPException:
        # Re-raise HTTP exceptions (like validation errors)
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

@app.post("/api/v1/auth/login", response_model=Token, tags=["Authentication"])
async def login(user_data: UserLogin):
    """
    Login and get JWT token.
    """
    users_collection = await get_users_collection()
    
    # Find user by email
    user = await users_collection.find_one({"email": user_data.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    if not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer")

@app.get("/api/v1/auth/me", response_model=UserResponse, tags=["Authentication"])
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information.
    """
    return UserResponse(
        id=str(current_user["_id"]),
        email=current_user["email"],
        username=current_user["username"]
    )

@app.post("/api/v1/query", response_model=QueryResponse, tags=["Chat"])
async def handle_query(
    request: QueryRequest,
    amplifi: AmplifiService = Depends(get_amplifi_service),
    current_user_email: str = Depends(get_current_user_email)
):
    """
    Send user's query to Amplifi for an existing chat session.
    Requires authentication.
    """
    try:
        amplifi_response = amplifi.get_amplifi_response(
            request.query,
            request.chat_source,
        )
        
        # Extract the answer from the response
        # Response structure: {"responses": [{"response": "..."}], "contexts": [...]}
        answer = "No answer found."
        if "responses" in amplifi_response and isinstance(amplifi_response["responses"], list) and len(amplifi_response["responses"]) > 0:
            answer = amplifi_response["responses"][0].get("response", "No answer found.")
        elif "pydantic_message" in amplifi_response and isinstance(amplifi_response["pydantic_message"], list) and len(amplifi_response["pydantic_message"]) > 0:
            model_response = amplifi_response["pydantic_message"][0].get("model_response", {})
            answer = model_response.get("content", "No answer found.")
        elif "answer" in amplifi_response:
            answer = amplifi_response["answer"]
        elif "response" in amplifi_response:
            answer = amplifi_response["response"]
        
        # Extract contexts if available
        contexts = amplifi_response.get("contexts")

        return QueryResponse(
            answer=answer,
            contexts=contexts
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process query: {e}")

# --- Main Entrypoint to Run the Server ---
if __name__ == "__main__":
    import os
    port = int(os.getenv("PORT", 8001))
    print(f"Starting Amplifi Connector Server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
