import sys
import os
from pathlib import Path

# Add backend and api-gateway directories to Python path automatically
API_GATEWAY_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = API_GATEWAY_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(API_GATEWAY_DIR) not in sys.path:
    sys.path.insert(0, str(API_GATEWAY_DIR))

import uvicorn

if __name__ == "__main__":
    print("🌐 Starting Standalone ARTSA API Gateway on http://localhost:8000 ...")
    uvicorn.run("gateway:app", host="127.0.0.1", port=8000, reload=True)
