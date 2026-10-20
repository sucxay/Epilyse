import sys
from pathlib import Path

# Add the project root to sys.path so that `backend.app...` imports
# resolve correctly no matter which directory pytest is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent))
