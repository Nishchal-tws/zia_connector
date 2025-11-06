from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None

db = Database()

async def connect_to_mongo():
    """Create database connection"""
    # If already connected, reuse connection
    if db.client is not None:
        try:
            await db.client.admin.command('ping')
            return db.client
        except Exception:
            # Connection lost, reconnect
            db.client = None
    
    try:
        db.client = AsyncIOMotorClient(settings.MONGODB_URL)
        # Test the connection
        await db.client.admin.command('ping')
        logger.info("✅ Connected to MongoDB")
        return db.client
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        raise

async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()
        logger.info("✅ Disconnected from MongoDB")

async def get_database():
    """Get database instance, ensuring connection is established"""
    # Ensure connection is established (important for serverless)
    if db.client is None:
        try:
            await connect_to_mongo()
        except Exception as e:
            logger.error(f"Failed to establish MongoDB connection: {e}")
            raise
    return db.client[settings.DATABASE_NAME]

async def get_users_collection():
    """Get users collection, ensuring connection is established"""
    database = await get_database()
    return database.users

