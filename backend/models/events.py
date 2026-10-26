"""
MatchCast AI - Match Event Models
Defines Pydantic models for raw and ingested match events and match data.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


class Position(BaseModel):
    """Pitch coordinate representation (standardized 0-100 grid)."""

    x: float = Field(..., description="Pitch X coordinate: 0 (defending goal) to 100 (attacking goal)")
    y: float = Field(..., description="Pitch Y coordinate: 0 (left sideline) to 100 (right sideline)")


class MatchEvent(BaseModel):
    """Individual match event recorded during gameplay."""

    event_id: str = Field(..., description="Unique event identifier")
    minute: int = Field(..., ge=0, le=130, description="Match minute")
    second: int = Field(default=0, ge=0, le=59, description="Match second")
    type: str = Field(
        ...,
        description="Core event type: pass, shot, pressure, tackle, interception, foul, card, goal, clearance, save, block, recovery",
    )
    subtype: Optional[str] = Field(
        default=None,
        description="Sub-categorization: open_play, set_piece, corner, cross, penalty, direct_free_kick, yellow, red",
    )
    team: str = Field(..., description="Team name performing the action")
    player: str = Field(..., description="Player name performing the action")
    player_number: Optional[int] = Field(default=None, description="Shirt number of the player")
    position: Optional[Position] = Field(default=None, description="Start coordinates of the event")
    end_position: Optional[Position] = Field(default=None, description="End coordinates of the event")
    recipient: Optional[str] = Field(default=None, description="Recipient player name for passes/crosses")
    success: Optional[bool] = Field(default=None, description="Whether the action succeeded")
    xG: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Calculated Expected Goals value for shots")
    outcome: Optional[str] = Field(
        default=None,
        description="Outcome description: goal, saved, blocked, off_target, post, complete, incomplete, won, lost",
    )
    body_part: Optional[str] = Field(
        default=None,
        description="Body part used: right_foot, left_foot, head, other",
    )
    under_pressure: Optional[bool] = Field(
        default=False,
        description="Whether the active player was pressured by opponents",
    )
    progressive: Optional[bool] = Field(
        default=False,
        description="Whether pass/carry advanced play significantly towards opponent goal",
    )
    description: Optional[str] = Field(
        default=None,
        description="Human-readable tactical description of the event action",
    )
    additional: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Additional custom attributes or context for this event",
    )


class MatchData(BaseModel):
    """Complete match structure including metadata, formations, and event stream."""

    match_id: str = Field(..., description="Unique identifier for the match")
    home_team: str = Field(..., description="Name of the home team")
    away_team: str = Field(..., description="Name of the away team")
    home_formation: str = Field(default="4-3-3", description="Starting tactical formation of home team")
    away_formation: str = Field(default="4-2-3-1", description="Starting tactical formation of away team")
    events: List[MatchEvent] = Field(default_factory=list, description="Chronological sequence of match events")

    @model_validator(mode="after")
    def auto_normalize_team_labels(self) -> "MatchData":
        """Map generic 'home'/'away' event labels onto the real team names (in place)."""
        mapping = {"home": self.home_team, "away": self.away_team}
        for ev in self.events:
            if ev.team:
                ev.team = mapping.get(ev.team.strip().lower(), ev.team)
        return self

    def normalize_team_labels(self) -> "MatchData":
        return self.auto_normalize_team_labels()
