# In: schemas.py
# This is the fully updated file

from pydantic import BaseModel, EmailStr
from typing import Optional

# --- Chat API ---
class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    answer: str
    contexts: Optional[list] = None

# --- Authentication API ---
class UserSignup(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: str
    email: str
    username: str

class TokenData(BaseModel):
    email: Optional[str] = None