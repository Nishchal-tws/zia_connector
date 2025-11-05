from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Loads all settings from the .env file.
    """
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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