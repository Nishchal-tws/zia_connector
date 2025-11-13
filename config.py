from pydantic_settings import BaseSettings, SettingsConfigDict
import os

# Build config dict conditionally
_config_dict = {"extra": "ignore"}
if os.path.exists(".env"):
    # Only load .env file if it exists (for local development)
    # In production environments (e.g., Vercel), variables are set directly
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
    AMPLIFI_CRM_CHAT_APP_ID: str
    AMPLIFI_CRM_CHAT_SESSION_ID: str
    AMPLIFI_MAIL_CHAT_APP_ID: str
    AMPLIFI_MAIL_CHAT_SESSION_ID: str

    # --- MONGODB SETTINGS ---
    MONGODB_URL: str
    DATABASE_NAME: str = "zia_amplifi_db"

    # --- JWT SETTINGS ---
    SECRET_KEY: str  # Should be a random secret key
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days


# Create a single, importable instance of the settings
# Wrap in try-except to provide helpful error messages if env vars are missing
_settings_instance = None
_settings_error = None

try:
    _settings_instance = Settings()
except Exception as e:
    import sys

    _settings_error = e
    error_msg = f"""
    ⚠️  Configuration Error: Failed to load settings.

    This usually means required environment variables are missing.

    Required environment variables:
    - MONGODB_URL
    - SECRET_KEY
    - AMPLIFI_API_URL
    - AMPLIFI_USERNAME
    - AMPLIFI_PASSWORD
    - AMPLIFI_CRM_CHAT_APP_ID
    - AMPLIFI_CRM_CHAT_SESSION_ID
    - AMPLIFI_MAIL_CHAT_APP_ID
    - AMPLIFI_MAIL_CHAT_SESSION_ID

    Error details: {str(e)}

    Please ensure all environment variables are set in your deployment environment.
    """
    print(error_msg, file=sys.stderr)
    # Don't raise here - instead create a proxy that will raise when accessed
    # This allows the module to be imported, but will fail when settings are actually used


# Create a proxy object that will raise a helpful error when accessed
class SettingsProxy:
    def __getattr__(self, name):
        if _settings_error:
            raise RuntimeError(
                f"Settings not initialized. Configuration error: {str(_settings_error)}\n"
                "Please check that all required environment variables are configured."
            ) from _settings_error
        return getattr(_settings_instance, name)


settings = _settings_instance if _settings_instance else SettingsProxy()
