"""
MatchCast AI - Data Story & Advanced Analytics Models
Defines structured schemas for discovered data stories, attacking zone effectiveness,
set-piece threat indices, and goalkeeper efficiency metrics.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ChannelStats(BaseModel):
    """Metrics for an individual attacking channel (Left, Central, Right)."""

    entries: int = Field(default=0, ge=0, description="Entries into attacking third via this channel")
    box_entries: int = Field(default=0, ge=0, description="Penetrations into the 18-yard box from this channel")
    shots: int = Field(default=0, ge=0, description="Shots originating in or generated through this channel")
    xg: float = Field(default=0.0, ge=0.0, description="Cumulative xG generated through this channel")


class TeamAttackingZones(BaseModel):
    """Left, Central, and Right channel attacking third breakdown for one team."""

    left: ChannelStats = Field(default_factory=ChannelStats, description="Left wing channel (y < 33.3)")
    central: ChannelStats = Field(default_factory=ChannelStats, description="Central corridor & half-spaces (33.3 <= y <= 66.7)")
    right: ChannelStats = Field(default_factory=ChannelStats, description="Right wing channel (y > 66.7)")


class AttackingZonesStats(BaseModel):
    """Comparative attacking third channel effectiveness for home and away."""

    home: TeamAttackingZones = Field(default_factory=TeamAttackingZones)
    away: TeamAttackingZones = Field(default_factory=TeamAttackingZones)


class TeamSetPieceThreat(BaseModel):
    """Set piece danger and execution metrics for one club."""

    corners_taken: int = Field(default=0, ge=0, description="Total corners taken")
    free_kicks_taken: int = Field(default=0, ge=0, description="Direct/indirect free kicks in attacking half")
    shots_generated: int = Field(default=0, ge=0, description="Shots directly resulting from set pieces")
    goals_scored: int = Field(default=0, ge=0, description="Goals scored from set-piece deliveries")
    cumulative_xg: float = Field(default=0.0, ge=0.0, description="Total xG created from set pieces")
    threat_index: float = Field(default=0.0, ge=0.0, le=100.0, description="Normalized set-piece threat score (0-100)")


class SetPieceThreatStats(BaseModel):
    """Comparative set-piece threat for home and away."""

    home: TeamSetPieceThreat = Field(default_factory=TeamSetPieceThreat)
    away: TeamSetPieceThreat = Field(default_factory=TeamSetPieceThreat)


class GoalkeeperMetrics(BaseModel):
    """Descriptive shot-stopping efficiency (synthetic estimate)."""

    player_name: str = Field(default="Goalkeeper", description="Goalkeeper name")
    team: str = Field(default="", description="Team name")
    saves: int = Field(default=0, ge=0, description="Saves made on shots on target")
    goals_conceded: int = Field(default=0, ge=0, description="Goals conceded")
    shots_on_target_faced: int = Field(default=0, ge=0, description="Total shots on target faced")
    xg_on_target_faced: float = Field(default=0.0, ge=0.0, description="Cumulative xG of on-target shots faced")
    goals_prevented: float = Field(
        default=0.0,
        description="xG on target faced minus goals conceded (positive indicates above-average shot stopping)",
    )


class GoalkeeperEfficiencyStats(BaseModel):
    """Goalkeeper performance metrics for home and away goalkeepers."""

    home: GoalkeeperMetrics = Field(default_factory=GoalkeeperMetrics)
    away: GoalkeeperMetrics = Field(default_factory=GoalkeeperMetrics)


class DataStory(BaseModel):
    """
    A concrete tactical storyline discovered deterministically from match data.
    Provides verifiable proof, metrics, and event IDs to AI pundits and broadcast cards.
    """

    story_id: str = Field(..., description="Unique deterministic story ID (e.g. 'story_turning_point_m63')")
    story_type: str = Field(
        ...,
        description="turning_point | finishing_woes | smash_and_grab | super_sub | midfield_metronome | territorial_collapse | tactical_shift",
    )
    title: str = Field(..., description="Snappy broadcast headline title")
    description: str = Field(..., description="Fact-checked summary explanation")
    team: Optional[str] = Field(default=None, description="Primary team associated with story")
    player: Optional[str] = Field(default=None, description="Primary player associated with story if individual")
    minute: int = Field(..., ge=0, description="Match clock minute when story triggered")
    second: int = Field(default=0, ge=0, le=59, description="Match clock second")
    evidence_event_ids: List[str] = Field(
        default_factory=list, description="Authoritative event IDs serving as empirical proof"
    )
    metrics: Dict[str, Any] = Field(
        default_factory=dict, description="Key numerical measurements validating the story"
    )
    confidence: float = Field(default=0.95, ge=0.0, le=1.0, description="Algorithmic confidence rating")
    category: str = Field(default="tactical", description="tactical | momentum | individual | set_piece")
