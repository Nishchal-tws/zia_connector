# Zia Amplifi Connector

A modern, full-stack chat application that connects to Amplifi's AI-powered chat service. Features user authentication, multi-session chat management, and interactive data visualizations.

## 🚀 Features

- **User Authentication**: Secure signup/login with JWT tokens and MongoDB
- **Multi-Session Chat**: Manage multiple chat conversations with a sidebar
- **Interactive Visualizations**: Render Plotly charts and graphs from Amplifi responses
- **Markdown Support**: Clean markdown rendering in chat messages
- **Persistent Storage**: User-specific chat history stored in localStorage
- **Modern UI**: Responsive design with a clean, intuitive interface

## 📋 Prerequisites

- Python 3.8+
- Node.js 14+ and npm
- MongoDB Atlas account (or local MongoDB instance)
- Amplifi API credentials
- ngrok (for exposing local backend)

## 🛠️ Installation

### Backend Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd zia_amplifi_connector
   ```

2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment**:
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - Linux/Mac:
     ```bash
     source venv/bin/activate
     ```

4. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Create a `.env` file** in the root directory:
   ```env
   # Amplifi API Configuration
   AMPLIFI_API_URL=https://your-amplifi-api-url.com
   AMPLIFI_USERNAME=your_username
   AMPLIFI_PASSWORD=your_password
   AMPLIFI_CHAT_APP_ID=your_chat_app_id
   AMPLIFI_CHAT_SESSION_ID=your_chat_session_id

   # MongoDB Atlas Configuration
   MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   DATABASE_NAME=zia_amplifi_db

   # JWT Secret Key (generate a random secret key)
   # Generate one using: python -c "import secrets; print(secrets.token_urlsafe(32))"
   SECRET_KEY=your-secret-key-here-change-this-to-a-random-string
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=10080
   ```

6. **Generate a secret key**:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
   Copy the output and set it as `SECRET_KEY` in your `.env` file.

### Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend/zia
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create a `.env` file** in `frontend/zia/`:
   ```env
   REACT_APP_API_URL=https://your-ngrok-url.ngrok-free.dev
   ```

## 🚀 Running the Application

### Backend

1. **Start ngrok** (in a separate terminal):
   ```bash
   ngrok http 8000
   ```
   Copy the HTTPS URL (e.g., `https://xxxxx.ngrok-free.dev`)

2. **Update frontend `.env`** with the ngrok URL

3. **Start the FastAPI server**:
   ```bash
   python main.py
   ```
   The server will run on `http://localhost:8000`

### Frontend

1. **Navigate to frontend directory**:
   ```bash
   cd frontend/zia
   ```

2. **Start the React development server**:
   ```bash
   npm start
   ```
   The app will open at `http://localhost:3000`

## 📁 Project Structure

```
zia_amplifi_connector/
├── main.py                 # FastAPI application entry point
├── config.py              # Configuration settings
├── database.py            # MongoDB connection and utilities
├── auth.py                # Authentication and JWT handling
├── schemas.py             # Pydantic models for request/response
├── services.py            # Amplifi API service
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables (create this)
│
├── frontend/
│   └── zia/
│       ├── src/
│       │   ├── App.js     # Main React component
│       │   ├── App.css    # Main styles
│       │   ├── Login.js   # Authentication component
│       │   ├── Auth.css   # Authentication styles
│       │   └── index.js   # React entry point
│       ├── public/
│       │   └── index.html
│       └── package.json
│
└── README.md              # This file
```

## 🔌 API Endpoints

### Authentication

- `POST /api/v1/auth/signup` - Register a new user
  - Request body: `{ "email": "user@example.com", "username": "username", "password": "password" }`
  - Response: `{ "access_token": "token", "token_type": "bearer" }`

- `POST /api/v1/auth/login` - Login with email and password
  - Request body: `{ "email": "user@example.com", "password": "password" }`
  - Response: `{ "access_token": "token", "token_type": "bearer" }`

- `GET /api/v1/auth/me` - Get current user information
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "id": "...", "email": "...", "username": "..." }`

### Chat

- `POST /api/v1/query` - Send a query to Amplifi
  - Headers: `Authorization: Bearer <token>`
  - Request body: `{ "query": "your question here" }`
  - Response: `{ "answer": "...", "contexts": [...] }`

### Test

- `GET /api/v1/test/connection` - Test Amplifi connection

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt password hashing
- **CORS Protection**: Configured for cross-origin requests
- **Environment Variables**: Sensitive data stored in `.env` files

## 🎨 Frontend Features

### Chat Interface
- **Sidebar Navigation**: Manage multiple chat sessions
- **Auto-Titling**: Chats automatically named based on first message
- **Visualization Rendering**: Interactive Plotly charts and graphs
- **Markdown Support**: Clean formatting of markdown content
- **Responsive Design**: Works on desktop and mobile devices

### User Management
- **Persistent Sessions**: Chats saved per user in localStorage
- **User Isolation**: Each user has separate chat storage
- **Session Management**: Automatic logout on token expiration

## 🐛 Troubleshooting

### Backend Issues

**"email-validator is not installed"**
```bash
pip install email-validator
```

**"MongoDB connection failed"**
- Check your `MONGODB_URL` in `.env`
- Ensure MongoDB Atlas IP whitelist includes your IP (or `0.0.0.0/0` for testing)

**"bcrypt errors"**
- Ensure bcrypt is installed: `pip install bcrypt`
- If using passlib, uninstall it: `pip uninstall passlib`

### Frontend Issues

**"Unexpected token '<'"**
- This usually means ngrok is returning HTML instead of JSON
- Ensure `ngrok-skip-browser-warning: 'true'` header is included in requests
- Check that your ngrok URL is correct

**"CORS errors"**
- Verify backend CORS settings allow your frontend origin
- Check that ngrok URL matches the one in frontend `.env`

**"401 Unauthorized"**
- Token may have expired, try logging in again
- Check that token is being sent in Authorization header

## 📝 Configuration

### Backend Configuration (`config.py`)

All configuration is loaded from environment variables:
- `AMPLIFI_API_URL`: Amplifi API endpoint
- `AMPLIFI_USERNAME`: Amplifi username
- `AMPLIFI_PASSWORD`: Amplifi password
- `AMPLIFI_CHAT_APP_ID`: Amplifi chat app ID
- `AMPLIFI_CHAT_SESSION_ID`: Amplifi chat session ID
- `MONGODB_URL`: MongoDB connection string
- `DATABASE_NAME`: MongoDB database name
- `SECRET_KEY`: JWT secret key (generate randomly)
- `ALGORITHM`: JWT algorithm (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Token expiration time

### Frontend Configuration

- `REACT_APP_API_URL`: Backend API URL (ngrok URL)

## 🔄 Development

### Adding New Features

1. **Backend**: Add new endpoints in `main.py`
2. **Frontend**: Add new components in `frontend/zia/src/`
3. **Styling**: Update CSS files as needed

### Database Schema

**Users Collection**:
```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "username": "username",
  "hashed_password": "bcrypt_hash",
  "created_at": "datetime"
}
```

## 📄 License

This project is proprietary software.

## 🤝 Contributing

This is a private project. For issues or questions, contact the development team.

## 📞 Support

For support or questions:
- Check the troubleshooting section above
- Review backend logs for error details
- Check browser console for frontend errors

---

**Note**: Remember to keep your `.env` files secure and never commit them to version control. Add them to `.gitignore`.

