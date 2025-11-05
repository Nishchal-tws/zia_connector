# Zia Amplifi Connector - Complete Learning Guide

This guide explains all the core concepts, syntaxes, and technologies used in this project. Use it to understand the implementation details and prepare for presentations.

---

## 📚 Table of Contents

1. [Backend Architecture](#backend-architecture)
   - [FastAPI Framework](#fastapi-framework)
   - [Async Programming](#async-programming)
   - [Pydantic Models](#pydantic-models)
   - [MongoDB with Motor](#mongodb-with-motor)
   - [JWT Authentication](#jwt-authentication)
   - [Password Hashing](#password-hashing)
   - [CORS Configuration](#cors-configuration)
   - [Environment Variables](#environment-variables)

2. [Frontend Architecture](#frontend-architecture)
   - [React Hooks](#react-hooks)
   - [State Management](#state-management)
   - [localStorage](#localstorage)
   - [Fetch API](#fetch-api)
   - [Error Handling](#error-handling)
   - [Markdown Rendering](#markdown-rendering)
   - [Plotly Integration](#plotly-integration)

3. [Key Concepts Explained](#key-concepts-explained)
   - [Dependency Injection](#dependency-injection)
   - [Context Managers](#context-managers)
   - [JWT Token Flow](#jwt-token-flow)
   - [User Session Management](#user-session-management)

---

## 🎯 Backend Architecture

### FastAPI Framework

**What is FastAPI?**
FastAPI is a modern, fast web framework for building APIs with Python based on standard Python type hints.

**Key Syntax:**
```python
from fastapi import FastAPI, Depends, HTTPException, status

app = FastAPI(
    title="Amplifi Connector",
    description="Authenticated proxy to Amplifi.",
    version="1.0.0"
)

@app.get("/api/v1/endpoint")
async def my_endpoint():
    return {"message": "Hello World"}
```

**What we used:**
- `@app.get()`, `@app.post()` - Route decorators
- `async def` - Async route handlers
- `Depends()` - Dependency injection
- `HTTPException` - Error handling
- `status` - HTTP status codes

---

### Async Programming

**What is Async?**
Async programming allows your code to handle multiple operations concurrently without blocking. It's essential for I/O operations like database queries and API calls.

**Key Syntax:**
```python
# Async function definition
async def my_function():
    # Async operations
    result = await some_async_operation()
    return result

# Calling async functions
result = await my_function()
```

**In our project:**
```python
@app.post("/api/v1/auth/login")
async def login(user_data: UserLogin):
    # await is used for database operations
    user = await users_collection.find_one({"email": user_data.email})
    return {"access_token": token}
```

**Why use async?**
- Non-blocking I/O operations
- Better performance for concurrent requests
- Required for MongoDB Motor (async driver)

---

### Pydantic Models

**What is Pydantic?**
Pydantic is a data validation library that uses Python type annotations to validate data.

**Key Syntax:**
```python
from pydantic import BaseModel, EmailStr

class UserSignup(BaseModel):
    email: EmailStr  # Validates email format
    username: str
    password: str
```

**In our project (`schemas.py`):**
```python
from pydantic import BaseModel, EmailStr
from typing import Optional

# Request Models
class UserSignup(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Response Models
class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
```

**Benefits:**
- Automatic validation
- Type checking
- Auto-generated API documentation
- Error messages for invalid data

**How it works:**
```python
# FastAPI automatically validates request body
@app.post("/api/v1/auth/signup")
async def signup(user_data: UserSignup):  # Validates automatically
    # user_data.email is guaranteed to be a valid email
    # user_data.password is guaranteed to be a string
```

---

### MongoDB with Motor

**What is Motor?**
Motor is an async MongoDB driver for Python. It's the async version of PyMongo.

**Key Syntax:**
```python
from motor.motor_asyncio import AsyncIOMotorClient

# Connection
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client["database_name"]
collection = db["collection_name"]

# Async operations
result = await collection.find_one({"email": "user@example.com"})
await collection.insert_one({"name": "John"})
await collection.update_one({"email": "user@example.com"}, {"$set": {"name": "Jane"}})
```

**In our project (`database.py`):**
```python
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

# Global variables for connection
client: AsyncIOMotorClient = None
db = None

async def connect_to_mongo():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    print("✅ Connected to MongoDB Atlas")

async def close_mongo_connection():
    global client
    if client:
        client.close()
        print("❌ Disconnected from MongoDB Atlas")

def get_users_collection():
    if db is None:
        raise Exception("Database not connected")
    return db["users"]
```

**Database Operations (`main.py`):**
```python
# Find user
user = await users_collection.find_one({"email": email})

# Check if user exists
existing_user = await users_collection.find_one({"email": user_data.email})
if existing_user:
    raise HTTPException(status_code=400, detail="Email already registered")

# Insert new user
result = await users_collection.insert_one({
    "email": user_data.email,
    "username": user_data.username,
    "hashed_password": hashed_password,
    "created_at": datetime.utcnow()
})
```

**Key MongoDB Operations:**
- `find_one()` - Find a single document
- `insert_one()` - Insert a document
- `update_one()` - Update a document
- `delete_one()` - Delete a document
- `find()` - Find multiple documents (returns cursor)

---

### JWT Authentication

**What is JWT?**
JSON Web Tokens are a compact way to securely transmit information between parties. They consist of three parts: Header, Payload, and Signature.

**Structure:**
```
header.payload.signature
```

**In our project (`auth.py`):**
```python
from jose import jwt, JWTError
from datetime import datetime, timedelta
from config import settings

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT token"""
    to_encode = data.copy()
    
    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Add expiration to payload
    to_encode.update({"exp": expire})
    
    # Encode token with secret key
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
```

**Token Decoding:**
```python
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Verify and decode JWT token"""
    try:
        # Decode token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")  # Extract email from payload
        if email is None:
            raise credentials_exception
        return email
    except JWTError:
        raise credentials_exception  # Invalid token
```

**Token Flow:**
1. User logs in → Backend creates JWT with user email
2. Token sent to frontend → Stored in localStorage
3. Frontend sends token in header → `Authorization: Bearer <token>`
4. Backend validates token → Extracts user email
5. Request proceeds with authenticated user

**OAuth2PasswordBearer:**
```python
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# In route handler
async def protected_route(token: str = Depends(oauth2_scheme)):
    # FastAPI automatically extracts token from Authorization header
    # Format: Authorization: Bearer <token>
    return {"user": token}
```

---

### Password Hashing

**What is Password Hashing?**
Password hashing converts plain text passwords into irreversible hash values. This way, even if the database is compromised, passwords can't be read.

**Why Bcrypt?**
- Salted hashing (adds random data to each password)
- Computationally expensive (slows down brute force attacks)
- One-way function (can't reverse to get original password)

**In our project (`auth.py`):**
```python
import bcrypt

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    # Convert string to bytes
    if isinstance(password, str):
        password = password.encode('utf-8')
    
    # Generate salt (random data)
    salt = bcrypt.gensalt()
    
    # Hash password with salt
    hashed = bcrypt.hashpw(password, salt)
    
    # Return as string for storage
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        # Convert to bytes
        if isinstance(plain_password, str):
            plain_password = plain_password.encode('utf-8')
        if isinstance(hashed_password, str):
            hashed_password = hashed_password.encode('utf-8')
        
        # Compare password with hash
        return bcrypt.checkpw(plain_password, hashed_password)
    except Exception as e:
        return False
```

**Usage:**
```python
# During signup
hashed_password = get_password_hash(user_data.password)
await users_collection.insert_one({"hashed_password": hashed_password})

# During login
user = await users_collection.find_one({"email": email})
if verify_password(password, user["hashed_password"]):
    # Password correct
    return token
else:
    # Password incorrect
    raise HTTPException(401, "Invalid credentials")
```

---

### CORS Configuration

**What is CORS?**
Cross-Origin Resource Sharing (CORS) allows a web page to make requests to a different domain than the one serving the web page.

**Why needed?**
- Frontend runs on `http://localhost:3000`
- Backend runs on `https://xxxxx.ngrok-free.dev`
- Different origins require CORS

**In our project (`main.py`):**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (for ngrok)
    allow_credentials=False,  # Must be False when allow_origins is ["*"]
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
)
```

**Configuration Explained:**
- `allow_origins=["*"]` - Allows requests from any origin
- `allow_methods` - HTTP methods allowed
- `allow_headers` - Headers allowed in requests
- `expose_headers` - Headers frontend can read

---

### Environment Variables

**What are Environment Variables?**
Environment variables store configuration values outside of code. This keeps sensitive data (API keys, passwords) out of source code.

**In our project (`config.py`):**
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    
    # Amplifi settings
    AMPLIFI_API_URL: str
    AMPLIFI_USERNAME: str
    AMPLIFI_PASSWORD: str
    AMPLIFI_CHAT_APP_ID: str
    AMPLIFI_CHAT_SESSION_ID: str
    
    # MongoDB settings
    MONGODB_URL: str
    DATABASE_NAME: str = "zia_amplifi_db"  # Default value
    
    # JWT settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

settings = Settings()  # Create instance
```

**Usage:**
```python
from config import settings

# Access environment variables
db_url = settings.MONGODB_URL
secret_key = settings.SECRET_KEY
```

**`.env` file format:**
```env
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
SECRET_KEY=your-secret-key-here
```

---

### Context Managers (Lifespan Events)

**What are Context Managers?**
Context managers handle setup and teardown operations. In FastAPI, they're used for database connections.

**Old way (deprecated):**
```python
@app.on_event("startup")
async def startup():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown():
    await close_mongo_connection()
```

**New way (our project):**
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup code
    await connect_to_mongo()
    yield  # Application runs here
    # Shutdown code
    await close_mongo_connection()

app = FastAPI(lifespan=lifespan)
```

**Flow:**
1. `lifespan()` starts → Database connects
2. `yield` → Application runs
3. Application shuts down → Database disconnects

---

## 🎨 Frontend Architecture

### React Hooks

**What are React Hooks?**
Hooks are functions that let you use state and lifecycle features in functional components.

**useState Hook:**
```javascript
import { useState } from 'react';

function MyComponent() {
    // State variable and setter function
    const [count, setCount] = useState(0);
    
    // Update state
    const increment = () => {
        setCount(count + 1);  // Direct value
        setCount(prev => prev + 1);  // Function (safer)
    };
    
    return <div>{count}</div>;
}
```

**In our project (`App.js`):**
```javascript
const [user, setUser] = useState(null);  // Current user
const [token, setToken] = useState(null);  // JWT token
const [chats, setChats] = useState([]);  // All chat sessions
const [activeChatId, setActiveChatId] = useState(null);  // Active chat ID
const [input, setInput] = useState('');  // Input field value
const [loading, setLoading] = useState(false);  // Loading state
const [sidebarOpen, setSidebarOpen] = useState(true);  // Sidebar visibility
```

**useEffect Hook:**
```javascript
import { useEffect } from 'react';

useEffect(() => {
    // Runs after component mounts
    // Runs when dependencies change
}, [dependency1, dependency2]);  // Dependency array
```

**In our project:**
```javascript
// Load user on mount
useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
    }
}, []);  // Empty array = run only once on mount

// Save chats when they change
useEffect(() => {
    if (user && chats.length > 0) {
        const storageKey = `zia_chats_${user.email}`;
        localStorage.setItem(storageKey, JSON.stringify(chats));
    }
}, [chats, user]);  // Run when chats or user changes
```

**useRef Hook:**
```javascript
import { useRef } from 'react';

const messagesEndRef = useRef(null);

// Scroll to bottom
const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
};

// In JSX
<div ref={messagesEndRef} />
```

---

### State Management

**State Update Patterns:**

**1. Simple Update:**
```javascript
const [value, setValue] = useState(0);
setValue(5);  // Set to 5
```

**2. Update Based on Previous:**
```javascript
const [count, setCount] = useState(0);
setCount(prev => prev + 1);  // Increment by 1
```

**3. Update Array:**
```javascript
const [items, setItems] = useState([]);

// Add item
setItems([...items, newItem]);

// Update item
setItems(items.map(item => 
    item.id === id ? { ...item, name: 'New Name' } : item
));

// Remove item
setItems(items.filter(item => item.id !== id));
```

**In our project:**
```javascript
// Add message to chat
setChats(prev => prev.map(chat =>
    chat.id === activeChatId
        ? { ...chat, messages: [...chat.messages, newMessage] }
        : chat
));

// Create new chat
const createNewChat = () => {
    const newChat = {
        id: Date.now(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
};
```

---

### localStorage

**What is localStorage?**
localStorage is a browser API that stores data persistently in the browser. Data survives page refreshes and browser restarts.

**Key Syntax:**
```javascript
// Store data
localStorage.setItem('key', 'value');
localStorage.setItem('user', JSON.stringify(userObject));  // Objects must be stringified

// Retrieve data
const value = localStorage.getItem('key');
const user = JSON.parse(localStorage.getItem('user'));  // Parse JSON

// Remove data
localStorage.removeItem('key');

// Clear all
localStorage.clear();
```

**In our project:**
```javascript
// Store authentication
localStorage.setItem('auth_token', token);
localStorage.setItem('user', JSON.stringify(user));

// Store chats per user
const storageKey = `zia_chats_${user.email}`;
localStorage.setItem(storageKey, JSON.stringify(chats));

// Load on mount
const loadChatsFromStorage = () => {
    if (!user) return [];
    try {
        const storageKey = `zia_chats_${user.email}`;
        const stored = localStorage.getItem(storageKey);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        return [];
    }
};
```

**Important Notes:**
- localStorage only stores strings
- Objects must be JSON.stringify() before storing
- Use JSON.parse() when retrieving objects
- Data is domain-specific (localhost:3000 vs example.com)

---

### Fetch API

**What is Fetch API?**
Fetch API is a modern JavaScript interface for making HTTP requests. It's promise-based and cleaner than XMLHttpRequest.

**Basic Syntax:**
```javascript
fetch(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error(error));
```

**Async/Await Syntax (our project):**
```javascript
const sendMessage = async () => {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify({ query: messageContent }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // Use data
    } catch (error) {
        console.error('Error:', error);
    }
};
```

**Response Handling:**
```javascript
// Check status
if (!response.ok) {
    if (response.status === 401) {
        // Unauthorized - token expired
    }
    throw new Error(`HTTP error! status: ${response.status}`);
}

// Parse JSON
const data = await response.json();

// Check content type
const contentType = response.headers.get('content-type');
if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error('Server returned non-JSON response');
}
```

---

### Error Handling

**Try-Catch Block:**
```javascript
try {
    // Code that might throw error
    const response = await fetch(url);
    const data = await response.json();
} catch (error) {
    // Handle error
    console.error('Error:', error);
    setError(error.message);
}
```

**In our project:**
```javascript
const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        const response = await fetch(`${API_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify({ email, password }),
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Server returned non-JSON response`);
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Login failed');
        }

        const data = await response.json();
        // Success handling
    } catch (err) {
        setError(err.message);  // Display error to user
    } finally {
        setLoading(false);  // Always runs
    }
};
```

---

### Markdown Rendering

**What is Markdown?**
Markdown is a lightweight markup language for formatting text. It's commonly used in chat responses.

**In our project:**
```javascript
const formatMessage = (text) => {
    if (!text) return '';
    
    // Split into lines
    let lines = text.split('\n');
    let formatted = '';
    
    lines.forEach(line => {
        // Remove markdown headers (##, ###)
        if (line.startsWith('#')) {
            line = line.replace(/^#+\s*/, '');
            formatted += `<strong>${line}</strong><br>`;
        }
        // Handle bullet points
        else if (line.trim().startsWith('•')) {
            formatted += `<div class="bullet-point">${line}</div>`;
        }
        // Regular lines
        else {
            formatted += `<div class="regular-line">${line}</div>`;
        }
    });
    
    return formatted;
};
```

**Rendering in React:**
```javascript
<div 
    className="message-text"
    dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
/>
```

**Note:** `dangerouslySetInnerHTML` is used carefully - only with trusted content.

---

### Plotly Integration

**What is Plotly?**
Plotly is a JavaScript library for creating interactive charts and graphs.

**In our project:**
```javascript
// Parse HTML visualization from response
const parseMessage = (text) => {
    // Check if message contains HTML
    const htmlMatch = text.match(/<html[\s\S]*?<\/html>/i);
    
    if (htmlMatch) {
        const htmlContent = htmlMatch[0];
        const textBefore = text.substring(0, text.indexOf(htmlContent)).trim();
        const textAfter = text.substring(text.indexOf(htmlContent) + htmlContent.length).trim();
        
        return {
            text: textBefore || textAfter,
            html: htmlContent,
            hasVisualization: true
        };
    }
    
    return { text, html: null, hasVisualization: false };
};

// Render visualization component
const VisualizationRenderer = ({ html, messageIndex }) => {
    const containerRef = useRef(null);
    
    useEffect(() => {
        if (!html || !containerRef.current) return;
        
        // Wait for Plotly to load
        const waitForPlotly = () => {
            if (window.Plotly) {
                // Extract data and layout from script
                const scriptMatch = html.match(/var data = (\[.*?\]);/s);
                const layoutMatch = html.match(/var layout = (\{.*?\});/s);
                const divIdMatch = html.match(/id="([^"]+)"/);
                
                if (scriptMatch && layoutMatch && divIdMatch) {
                    const data = eval(`(${scriptMatch[1]})`);
                    const layout = eval(`(${layoutMatch[1]})`);
                    const divId = divIdMatch[1];
                    
                    // Create unique ID for this chart
                    const uniqueId = `plotly-${messageIndex}-${Date.now()}`;
                    containerRef.current.id = uniqueId;
                    
                    // Render plot
                    window.Plotly.newPlot(uniqueId, data, layout);
                }
            } else {
                setTimeout(waitForPlotly, 100);
            }
        };
        
        waitForPlotly();
    }, [html, messageIndex]);
    
    return <div ref={containerRef} className="visualization-container" />;
};
```

---

## 🔑 Key Concepts Explained

### Dependency Injection

**What is Dependency Injection?**
Dependency Injection is a design pattern where dependencies are provided to a function rather than created inside it.

**In FastAPI:**
```python
from fastapi import Depends

def get_database():
    return db

@app.get("/items")
async def get_items(db = Depends(get_database)):
    # db is injected by FastAPI
    return db.find_all()
```

**In our project:**
```python
def get_amplifi_service():
    return amplifi_service

@app.post("/api/v1/query")
async def query(
    request: QueryRequest,
    amplifi: AmplifiService = Depends(get_amplifi_service),
    user_email: str = Depends(get_current_user_email)
):
    # amplifi_service is injected
    # user_email is extracted from JWT token
    result = await amplifi.send_query(request.query)
    return result
```

**Benefits:**
- Easier testing (can mock dependencies)
- Better code organization
- Reusable components

---

### JWT Token Flow

**Complete Flow Diagram:**

```
1. User Login
   └─> POST /api/v1/auth/login
       └─> Verify email/password
           └─> Create JWT token
               └─> Return token to frontend

2. Frontend Stores Token
   └─> localStorage.setItem('auth_token', token)
       └─> Token saved in browser

3. Authenticated Request
   └─> Frontend sends request
       └─> Headers: { Authorization: 'Bearer <token>' }
           └─> Backend receives request
               └─> Extract token from header
                   └─> Decode token
                       └─> Verify signature
                           └─> Extract user email
                               └─> Process request

4. Token Expiration
   └─> Token expires (after 7 days)
       └─> Backend returns 401 Unauthorized
           └─> Frontend redirects to login
```

**Code Example:**
```python
# 1. Create token (login endpoint)
access_token = create_access_token(
    data={"sub": user["email"]},
    expires_delta=timedelta(minutes=10080)
)

# 2. Frontend stores token
localStorage.setItem('auth_token', access_token);

# 3. Send token with requests
fetch(API_URL, {
    headers: {
        'Authorization': `Bearer ${access_token}`
    }
})

# 4. Backend validates token
async def get_current_user_email(token: str = Depends(oauth2_scheme)):
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    return payload.get("sub")  # Returns email
```

---

### User Session Management

**How it works in our project:**

**1. Authentication State:**
```javascript
const [user, setUser] = useState(null);
const [token, setToken] = useState(null);
const [isAuthenticated, setIsAuthenticated] = useState(false);

// Load from localStorage on mount
useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
    }
}, []);
```

**2. Login Process:**
```javascript
const handleLogin = (userData, token) => {
    setUser(userData);
    setToken(token);
    setIsAuthenticated(true);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
};
```

**3. Logout Process:**
```javascript
const handleLogout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    
    // Clear user-specific chats
    if (user) {
        const storageKey = `zia_chats_${user.email}`;
        localStorage.removeItem(storageKey);
    }
};
```

**4. Protected Routes:**
```javascript
// Show login if not authenticated
if (!isAuthenticated || !token) {
    return <Login onLogin={handleLogin} />;
}

// Show chat interface if authenticated
return <ChatInterface />;
```

---

## 📝 Summary of Key Technologies

### Backend Stack:
1. **FastAPI** - Web framework
2. **Motor** - Async MongoDB driver
3. **Pydantic** - Data validation
4. **python-jose** - JWT handling
5. **bcrypt** - Password hashing
6. **pydantic-settings** - Environment variables

### Frontend Stack:
1. **React** - UI framework
2. **React Hooks** - State management
3. **Fetch API** - HTTP requests
4. **localStorage** - Client-side storage
5. **Plotly.js** - Data visualization
6. **CSS3** - Styling

### Key Patterns:
1. **Async/Await** - Asynchronous programming
2. **Dependency Injection** - FastAPI Depends
3. **JWT Authentication** - Token-based auth
4. **Context Managers** - Lifespan events
5. **State Management** - React Hooks
6. **Error Handling** - Try-catch blocks

---

## 🎓 Presentation Tips

### Key Points to Highlight:

1. **Architecture:**
   - Separation of concerns (Backend/Frontend)
   - RESTful API design
   - JWT authentication flow

2. **Security:**
   - Password hashing with bcrypt
   - JWT token security
   - Environment variables for secrets

3. **Performance:**
   - Async programming for I/O operations
   - Client-side state management
   - Efficient data storage

4. **User Experience:**
   - Multi-session chat management
   - Persistent storage
   - Interactive visualizations

5. **Scalability:**
   - MongoDB for user data
   - Stateless authentication
   - Modular code structure

---

## 🔍 Code Walkthrough

### Complete Request Flow:

```
1. User types message
   └─> handleKeyPress() triggered
       └─> sendMessage() called

2. Frontend sends request
   └─> fetch(API_URL, {
           method: 'POST',
           headers: {
               'Authorization': 'Bearer <token>'
           },
           body: JSON.stringify({ query: message })
       })

3. Backend receives request
   └─> FastAPI route handler
       └─> get_current_user_email() dependency
           └─> Validates JWT token
               └─> Extracts user email
                   └─> AmplifiService.send_query()
                       └─> Forwards to Amplifi API
                           └─> Returns response

4. Frontend receives response
   └─> parseMessage() extracts text and HTML
       └─> Updates chat state
           └─> Renders message and visualization
               └─> Scrolls to bottom
```

---

This guide covers all the core concepts and syntax used in the Zia Amplifi Connector project. Use it as a reference for understanding the codebase and preparing presentations.

