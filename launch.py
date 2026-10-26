"""
MatchCast AI - Unified Local Launcher
Starts the full-stack MatchCast AI application (Backend + Frontend) and opens your browser.
"""

import sys
import webbrowser
from pathlib import Path

# Add project root to path
_root = Path(__file__).resolve().parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import uvicorn
from backend.main import app

def main():
    print("=" * 60)
    print("⚽ MatchCast AI — Premier League AI Pundit Panel")
    print("=" * 60)
    print("Backend & Agents: Ready")
    print("Frontend UI:      Ready (dist/)")
    print("Server URL:       http://localhost:8000")
    print("=" * 60)
    print("\nOpening MatchCast AI in your default browser...")
    webbrowser.open("http://localhost:8000")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)

if __name__ == "__main__":
    main()
