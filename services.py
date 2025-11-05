import requests
import os
import json
import time
from config import settings


TOKEN_FILE = "amplifi_token.json"


class AmplifiService:
    """
    Amplifi service: authenticates using username/password and forwards queries
    to an existing chat session.
    """
    def __init__(self):
        self.base_url = settings.AMPLIFI_API_URL
        self.username = settings.AMPLIFI_USERNAME
        self.password = settings.AMPLIFI_PASSWORD
        self.chatapp_id = settings.AMPLIFI_CHAT_APP_ID
        self.chat_session_id = settings.AMPLIFI_CHAT_SESSION_ID
        
        if not os.path.exists(TOKEN_FILE):
            with open(TOKEN_FILE, 'w') as f:
                json.dump({}, f)
        
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
            
            with open(TOKEN_FILE, 'w') as f:
                json.dump(new_token_data, f, indent=4)
            
            print("AMPLIFI SERVICE: User Access Token saved.")
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

    def get_amplifi_response(self, query: str) -> dict:
        """
        Calls the Amplifi chat endpoint to get the response from the AI.
        
        """
        access_token = self._get_amplifi_access_token()
        
        url = f"{self.base_url}/api/v2/chat"
        print(f"CONNECTOR -> Calling Amplifi chat endpoint: {url}")

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "accept": "application/json"
        }
        
        payload = {
            "chat_app_id": self.chatapp_id,
            "chat_session_id": self.chat_session_id,
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
