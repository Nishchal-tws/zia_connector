from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None

db = Database()

async def connect_to_mongo():
    """Create database connection with proper SSL/TLS configuration"""
    # If already connected, reuse connection
    if db.client is not None:
        try:
            await db.client.admin.command('ping')
            return db.client
        except Exception:
            # Connection lost, reconnect
            db.client = None

    try:
        # MongoDB Atlas connection with proper timeout settings
        # mongodb+srv:// automatically uses SSL/TLS, so we don't need to configure it explicitly
        mongo_url = settings.MONGODB_URL
        
        # Create client with appropriate timeout settings for cloud platforms
        db.client = AsyncIOMotorClient(
            mongo_url,
            serverSelectionTimeoutMS=30000,  # 30 second timeout
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
        )
        
        # Test the connection
        await db.client.admin.command('ping')
        logger.info("✅ Connected to MongoDB")
        return db.client
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Failed to connect to MongoDB: {error_msg}")
        
        # Provide helpful error messages
        if "SSL" in error_msg or "TLS" in error_msg or "handshake" in error_msg:
            logger.error("💡 SSL/TLS Error - This usually means:")
            logger.error("   1. MongoDB Atlas IP whitelist doesn't include Render's IP addresses")
            logger.error("   2. Go to MongoDB Atlas → Network Access → Add IP Address")
            logger.error("   3. For testing, you can use: 0.0.0.0/0 (allows all IPs)")
            logger.error("   4. For production, whitelist Render's specific IP ranges")
        elif "authentication" in error_msg.lower() or "auth" in error_msg.lower():
            logger.error("💡 Authentication Error - Check your MongoDB username and password in MONGODB_URL")
        elif "timeout" in error_msg.lower():
            logger.error("💡 Timeout Error - Check network connectivity and MongoDB Atlas cluster status")
        
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

