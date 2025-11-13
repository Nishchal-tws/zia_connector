import requests
import os
import json
import time
from typing import Optional
from config import settings

# Use /tmp directory for serverless environments (Vercel, AWS Lambda, etc.)
# In serverless, only /tmp is writable
# For local development on Windows, use current directory
if os.name == 'nt':  # Windows
    TOKEN_FILE = "amplifi_token.json"
else:  # Unix-like (Linux, macOS, Vercel)
    TOKEN_FILE = "/tmp/amplifi_token.json"


class AmplifiService:
    """
    Amplifi service: authenticates using username/password and forwards queries
    to an existing chat session.
    """
    def __init__(self):
        self.base_url = settings.AMPLIFI_API_URL
        self.username = settings.AMPLIFI_USERNAME
        self.password = settings.AMPLIFI_PASSWORD

        # Normalize chat sources and validate configuration
        self._chat_source_aliases = {
            "crm": "crm",
            "zoho_crm": "crm",
            "zoho crm": "crm",
            "mail": "mail",
            "zoho_mail": "mail",
            "zoho mail": "mail",
        }

        self.chat_configs = {
            "crm": {
                "chat_app_id": settings.AMPLIFI_CRM_CHAT_APP_ID,
                "chat_session_id": settings.AMPLIFI_CRM_CHAT_SESSION_ID,
            },
            "mail": {
                "chat_app_id": settings.AMPLIFI_MAIL_CHAT_APP_ID,
                "chat_session_id": settings.AMPLIFI_MAIL_CHAT_SESSION_ID,
            },
        }

        missing_values = [
            key for source, config in self.chat_configs.items()
            for key, value in (
                (f"{source}_chat_app_id", config.get("chat_app_id")),
                (f"{source}_chat_session_id", config.get("chat_session_id")),
            )
            if not value
        ]

        if missing_values:
            raise ValueError(
                "Missing Amplifi chat configuration values: "
                + ", ".join(missing_values)
            )

        # Initialize token file if it doesn't exist (handle permission errors gracefully)
        try:
            if not os.path.exists(TOKEN_FILE):
                # Ensure directory exists
                os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
                with open(TOKEN_FILE, 'w') as f:
                    json.dump({}, f)
        except (OSError, PermissionError) as e:
            # In some serverless environments, file creation might fail
            # We'll handle this gracefully and just skip caching
            print(f"⚠️  Warning: Could not create token file at {TOKEN_FILE}: {e}")
            print("⚠️  Token caching will be disabled. Tokens will be fetched on each request.")
        
        print("✅ AmplifiService Initialized")

    def _get_amplifi_access_token(self) -> str:
        """
        Retrieves a valid Amplifi access token using USERNAME/PASSWORD.
        Returns the access_token (UUID) which is required for chat endpoints.
        """
        current_time = int(time.time())

        if os.path.exists(TOKEN_FILE):
            try:
                with open(TOKEN_FILE, 'r') as f:
                    token_data = json.load(f)
                if token_data and token_data.get('access_token') and token_data.get('expires_at', 0) > current_time + 60:
                    # Use access_token (UUID) for RAG endpoints
                    return token_data.get('access_token')
            except json.JSONDecodeError:
                pass  # Token file is corrupt

        print("AMPLIFI SERVICE: Logging in with username/password to get new access token...")
        
        token_url = f"{self.base_url}/api/v2/login/access-token"
        
        # Critical fix: Include grant_type field
        payload = {
            "grant_type": "password",
            "username": self.username,
            "password": self.password,
        }
        
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        try:
            response = requests.post(token_url, data=payload, headers=headers)
            response.raise_for_status() 
            new_token_data = response.json()
            
            if "access_token" not in new_token_data:
                raise Exception("Login successful but no 'access_token' in response.")

            expires_in = new_token_data.get('expires_in', 3600)
            new_token_data['expires_at'] = current_time + expires_in
            
            # Try to save token to file (may fail in some serverless environments)
            try:
                os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
                with open(TOKEN_FILE, 'w') as f:
                    json.dump(new_token_data, f, indent=4)
                print("AMPLIFI SERVICE: User Access Token saved.")
            except (OSError, PermissionError) as e:
                # If file write fails, continue without caching
                print(f"⚠️  Warning: Could not save token to file: {e}")
            
            # Return access_token (UUID) - this is what chat endpoints need
            return new_token_data.get('access_token')
        
        except requests.exceptions.HTTPError as e:
            try:
                error_detail = e.response.text
            except Exception:
                error_detail = str(e)
            print(f"Error getting Amplifi user token: {error_detail}")
            raise Exception(f"Failed to get Amplifi user token: {e}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            raise Exception(f"Failed to get Amplifi user token: {e}")

    def _resolve_chat_config(self, chat_source: Optional[str]) -> dict:
        """
        Resolve the chat configuration for the requested source.
        Defaults to CRM if no source provided for backward compatibility.
        """
        if not chat_source:
            normalized = "crm"
        else:
            normalized = chat_source.strip().lower()
            normalized = self._chat_source_aliases.get(normalized, normalized)

        if normalized not in self.chat_configs:
            valid_sources = ", ".join(sorted(self.chat_configs.keys()))
            raise ValueError(
                f"Invalid chat source '{chat_source}'. "
                f"Supported values: {valid_sources}"
            )

        return self.chat_configs[normalized]

    def get_amplifi_response(self, query: str, chat_source: Optional[str] = None) -> dict:
        """
        Calls the Amplifi chat endpoint to get the response from the AI.
        
        """
        access_token = self._get_amplifi_access_token()
        chat_config = self._resolve_chat_config(chat_source)
        
        url = f"{self.base_url}/api/v2/chat"
        print(f"CONNECTOR -> Calling Amplifi chat endpoint: {url}")

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "accept": "application/json"
        }
        
        payload = {
            "chat_app_id": chat_config["chat_app_id"],
            "chat_session_id": chat_config["chat_session_id"],
            "query": query
        }
        print(f"CONNECTOR -> Request Payload: {json.dumps(payload)}")
        
        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            error_message = f"Failed to get response from Amplifi chat endpoint. Status: {e.response.status_code}"
            
            # Try to get more detailed error information
            try:
                error_details = e.response.json()
                error_message += f", Details: {json.dumps(error_details, indent=2)}"
                print(f"ERROR: Full error response: {json.dumps(error_details, indent=2)}")
            except:
                # If JSON parsing fails, use raw text
                if e.response.text:
                    error_message += f", Response: {e.response.text[:500]}"
                    print(f"ERROR: Raw response text: {e.response.text[:500]}")
            
            print(f"ERROR: {error_message}")
            raise Exception(error_message)
        except requests.exceptions.RequestException as e:
            print(f"ERROR: Network or general request error when calling Amplifi chat endpoint: {e}")
            raise Exception(f"Network or general request error: {e}")

    def test_connection(self) -> dict:
        """
        Test the connection by getting an access token.
        Returns token information for verification.
        """
        try:
            token = self._get_amplifi_access_token()
            return {
                "status": "success",
                "message": "Successfully connected to Amplifi",
                "token_preview": f"{token[:50]}...",
                "token_length": len(token),
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
            }
