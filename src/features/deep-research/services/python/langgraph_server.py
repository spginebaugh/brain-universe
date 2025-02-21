import os
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env file in the same directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
logger.info(f"Loading environment from: {env_path}")
load_dotenv(env_path)

def setup_environment():
    """Set up environment variables and validate they exist"""
    required_env_vars = ['TAVILY_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing_vars)}")

    # Print loaded API keys (first few characters only for security)
    for var in required_env_vars:
        value = os.getenv(var, '')
        logger.info(f"{var} loaded: {value[:8]}...")
        # Explicitly set environment variables
        os.environ[var] = value

    return True

# Set up environment before importing packages that need it
setup_environment()

# Now we can safely import the required packages
from langgraph.checkpoint.memory import MemorySaver
from open_deep_research.graph import builder

# Initialize the graph
memory = MemorySaver()
graph = builder.compile(checkpointer=memory)

if __name__ == "__main__":
    import subprocess
    import sys
    
    logger.info("Starting LangGraph Studio UI...")
    
    # Configure the server to allow CORS from our Next.js app
    subprocess.run([
        sys.executable, "-m", "langgraph_cli", "dev",
        "--host", "0.0.0.0",
        "--port", "2024",
        "--allow-origins", "http://localhost:3000",
        "--allow-credentials", "true",
        "--allow-methods", "*",
        "--allow-headers", "*"
    ]) 