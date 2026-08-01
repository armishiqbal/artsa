import sys
import os
from pathlib import Path

# Setup paths
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.run_campaign import run_campaign

if __name__ == "__main__":
    print("🧠 Starting ARTSA Backend Red-Teaming Engine...")
    run_campaign()
