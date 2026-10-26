"""
MatchCast AI - Live Match State Models
Tracks real-time statistical aggregates, running xG, momentum, and phases.
"""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field
from backend.models.events import MatchEvent
from backend.models.data_story import (
    AttackingZonesStats,
    SetPieceThreatStats,
    GoalkeeperEfficiencyStats,
    DataStory,
)


class Score(BaseModel):
    """Current match score."""

    home: int = Field(default=0, ge=0, description="Home team goals")
    away: int = Field(default=0, ge=0, description="Away team goals")


class PossessionStats(BaseModel):
    """Possession percentage distribution (0-100%)."""

    home: float = Field(default=50.0, ge=0.0, le=100.0, description="Home possession percentage")
    away: float = Field(default=50.0, ge=0.0, le=100.0, description="Away possession percentage")


class XgTotals(BaseModel):
    """Cumulative expected goals totals."""

    home: float = Field(default=0.0, ge=0.0, description="Cumulative home xG")
    away: float = Field(default=0.0, ge=0.0, description="Cumulative away xG")


class MomentumStats(BaseModel):
    """Rolling momentum metrics (0-100 scale per team)."""

    home: float = Field(default=50.0, ge=0.0, le=100.0, description="Home momentum score")
    away: float = Field(default=50.0, ge=0.0, le=100.0, description="Away momentum score")
    swing: Optional[str] = Field(
        default="NEUTRAL",
        description="Momentum description: NEUTRAL, HOME_DOMINANT, AWAY_DOMINANT, SWING_TO_HOME, SWING_TO_AWAY",
    )
    delta: Optional[float] = Field(
        default=0.0,
        description="Change in momentum differential over the last 5 minutes",
    )


class PressingStats(BaseModel):
    """Pressing intensity and defensive action index."""

    home: float = Field(default=0.0, ge=0.0, description="Home pressing intensity rate")
    away: float = Field(default=0.0, ge=0.0, description="Away pressing intensity rate")
    home_pressures_count: int = Field(default=0, ge=0, description="Home total pressure actions")
    away_pressures_count: int = Field(default=0, ge=0, description="Away total pressure actions")


class TeamDetailedStats(BaseModel):
    """Granular football metrics for one club."""

    shots: int = Field(default=0, ge=0, description="Total shot attempts")
    shots_on_target: int = Field(default=0, ge=0, description="Shots directed on goal")
    total_passes: int = Field(default=0, ge=0, description="Total passes attempted")
    completed_passes: int = Field(default=0, ge=0, description="Successful passes completed")
    pass_accuracy: float = Field(default=0.0, ge=0.0, le=100.0, description="Pass completion rate percentage")
    fouls: int = Field(default=0, ge=0, description="Fouls committed")
    yellow_cards: int = Field(default=0, ge=0, description="Yellow cards received")
    red_cards: int = Field(default=0, ge=0, description="Red cards received")
    corners: int = Field(default=0, ge=0, description="Corners awarded")
    tackles_won: int = Field(default=0, ge=0, description="Tackles and defensive recoveries won")


class DetailedStats(BaseModel):
    """Home and Away detailed match statistics."""

    home: TeamDetailedStats = Field(default_factory=TeamDetailedStats)
    away: TeamDetailedStats = Field(default_factory=TeamDetailedStats)


class KeyMoment(BaseModel):
    """Crucial match inflection point flagged for pundit reaction."""

    minute: int = Field(..., ge=0, description="Match minute of the key moment")
    second: int = Field(default=0, ge=0, le=59, description="Match second of the key moment")
    description: str = Field(..., description="Summary narrative of the key moment")
    importance: str = Field(..., description="Urgency / Significance: HIGH, MEDIUM, LOW")
    event_id: Optional[str] = Field(default=None, description="Triggering event ID if applicable")
    team: Optional[str] = Field(default=None, description="Team associated with the key moment")
    type: Optional[str] = Field(default=None, description="Type: goal, penalty, red_card, high_xg_chance, momentum_swing, etc.")


class MatchState(BaseModel):
    """Complete snapshot of live match state sent to clients."""

    match_id: str = Field(default="live_match", description="Identifier of the active match")
    home_team: str = Field(default="Home Team", description="Name of the home team")
    away_team: str = Field(default="Away Team", description="Name of the away team")
    minute: int = Field(default=0, ge=0, description="Current match minute")
    second: int = Field(default=0, ge=0, le=59, description="Current match second")
    score: Score = Field(default_factory=Score, description="Current score")
    control_index: float = Field(default=50.0, ge=0.0, le=100.0, description="Control Index percentage (Control vs Chaos)")
    chaos_index: float = Field(default=50.0, ge=0.0, le=100.0, description="Chaos Index percentage")
    game_rhythm: str = Field(default="Balanced Tactical Chess Match", description="Live game rhythm description")
    possession: PossessionStats = Field(default_factory=PossessionStats, description="Live possession %")
    xg_totals: XgTotals = Field(default_factory=XgTotals, description="Cumulative xG totals")
    momentum: MomentumStats = Field(default_factory=MomentumStats, description="Rolling momentum stats")
    pressing_intensity: PressingStats = Field(
        default_factory=PressingStats, description="Pressing intensity stats"
    )
    events_processed: int = Field(default=0, ge=0, description="Total events ingested so far")
    key_moments: List[KeyMoment] = Field(
        default_factory=list, description="Historical list of key moments"
    )
    current_phase: str = Field(
        default="FIRST_HALF",
        description="Match phase: FIRST_HALF, HALF_TIME, SECOND_HALF, FULL_TIME",
    )
    status: Optional[str] = Field(
        default="live",
        description="Frontend status mapping: not_started, live, half_time, full_time",
    )
    is_paused: Optional[bool] = Field(default=False, description="Whether replay is paused")
    xg: Optional[XgTotals] = Field(default=None, description="Frontend alias for xg_totals")
    detailed_stats: DetailedStats = Field(
        default_factory=DetailedStats, description="Comprehensive home/away match statistics"
    )
    attacking_zones: AttackingZonesStats = Field(
        default_factory=AttackingZonesStats, description="Left/Central/Right attacking third channel effectiveness"
    )
    set_piece_threat: SetPieceThreatStats = Field(
        default_factory=SetPieceThreatStats, description="Corners and free kicks cumulative danger rating"
    )
    keeper_efficiency: GoalkeeperEfficiencyStats = Field(
        default_factory=GoalkeeperEfficiencyStats, description="Synthetic goals prevented and shot stopping"
    )
    latest_story: Optional[DataStory] = Field(
        default=None, description="Most recently discovered tactical data story"
    )
    active_stories: List[DataStory] = Field(
        default_factory=list, description="All discovered tactical storylines for this match"
    )
    last_event: Optional[MatchEvent] = Field(
        default=None, description="Most recently processed match event"
    )
