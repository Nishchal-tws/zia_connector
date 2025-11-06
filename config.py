from pydantic_settings import BaseSettings, SettingsConfigDict
import os

# Build config dict conditionally
_config_dict = {"extra": "ignore"}
if os.path.exists(".env"):
    # Only load .env file if it exists (for local development)
    # In Vercel, environment variables are set directly
    _config_dict["env_file"] = ".env"
    _config_dict["env_file_encoding"] = "utf-8"

class Settings(BaseSettings):
    """
    Loads all settings from environment variables.
    In Vercel, these come from the environment variables set in the dashboard.
    For local development, they can come from a .env file.
    """
    model_config = SettingsConfigDict(**_config_dict)

    # --- AMPLIFI SETTINGS ---
    AMPLIFI_API_URL: str
    AMPLIFI_USERNAME: str
    AMPLIFI_PASSWORD: str
    AMPLIFI_CHAT_APP_ID: str
    AMPLIFI_CHAT_SESSION_ID: str

    # --- MONGODB SETTINGS ---
    MONGODB_URL: str
    DATABASE_NAME: str = "zia_amplifi_db"

    # --- JWT SETTINGS ---
    SECRET_KEY: str  # Should be a random secret key
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

# Create a single, importable instance of the settings
settings = Settings()