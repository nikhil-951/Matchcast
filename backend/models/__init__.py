"""
MatchCast AI - Domain Models
Exports all core Pydantic data schemas for match events, live states, and pundit outputs.
"""

from backend.models.events import MatchData, MatchEvent, Position
from backend.models.match_state import (
    KeyMoment,
    MatchState,
    MomentumStats,
    PossessionStats,
    PressingStats,
    Score,
    XgTotals,
)
from backend.models.panel_output import (
    MatchPersonality,
    PanelAnswer,
    PanelDebate,
    PunditComment,
    TacticalInsight,
)

__all__ = [
    "Position",
    "MatchEvent",
    "MatchData",
    "Score",
    "PossessionStats",
    "XgTotals",
    "MomentumStats",
    "PressingStats",
    "KeyMoment",
    "MatchState",
    "PunditComment",
    "TacticalInsight",
    "PanelDebate",
    "PanelAnswer",
    "MatchPersonality",
]
