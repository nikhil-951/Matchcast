"""
MatchCast AI - Backend Package
Premier League AI Pundit Panel Backend
"""

import sys
from pathlib import Path

# Ensure backend package directory and its parent directory are on sys.path
_current_dir = Path(__file__).resolve().parent
_parent_dir = _current_dir.parent

for _p in [str(_parent_dir), str(_current_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)
