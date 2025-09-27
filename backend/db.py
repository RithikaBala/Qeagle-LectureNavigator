# db.py
import motor.motor_asyncio
import asyncio
import ssl

# MongoDB Atlas configuration
DATABASE_NAME = "lecture_project_db"

# Connection string with new cluster URL and SSL parameters
MONGO_URI = "mongodb+srv://RithikaB:rithika2206@cluster0.kcjkp7t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true"

# Create async MongoDB client instance with minimal configuration
client = motor.motor_asyncio.AsyncIOMotorClient(
    MONGO_URI,
    connect=True
)

# Get database handle
db = client[DATABASE_NAME]

async def test_connection():
    try:
        print("Attempting to connect to MongoDB...")
        # Test the connection
        await client.admin.command("ping")
        print("✅ MongoDB connection successful!")
        # List databases to verify permissions
        databases = await client.list_database_names()
        print(f"Available databases: {databases}")
        return True
    except Exception as e:
        print(f"❌ MongoDB Connection Error: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print("Please check:")
        print("1. Your IP is whitelisted")
        print("2. Username and password are correct")
        print("3. Network connectivity to MongoDB Atlas")
        return False

# Run connection test
if __name__ == "__main__":
    print("Starting MongoDB connection test...")
    asyncio.run(test_connection())
    print("Connection test completed.")
