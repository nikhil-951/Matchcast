"""
MatchCast AI - Services
Core analytical and replay services: xG modeling, momentum calculation, and match playback.
"""

from backend.services.xg_model import (
    calculate_distance_to_goal,
    calculate_shot_angle_degrees,
    calculate_xg,
)
from backend.services.momentum import MomentumTracker
from backend.services.match_playback import MatchPlaybackEngine

__all__ = [
    "calculate_distance_to_goal",
    "calculate_shot_angle_degrees",
    "calculate_xg",
    "MomentumTracker",
    "MatchPlaybackEngine",
]
