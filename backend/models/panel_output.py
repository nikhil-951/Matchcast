"""
MatchCast AI - Pundit Panel Output Models
Defines Pydantic models for pundit commentary, host synthesis, debates, and Q&A.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from backend.models.match_state import KeyMoment


class PunditComment(BaseModel):
    """Individual commentary from a specialized pundit persona."""

    id: str = Field(..., description="Unique comment identifier")
    name: str = Field(..., description="Pundit display name (e.g. The Tactician, The Passion Pundit, The Analyst)")
    persona: str = Field(..., description="Persona key: tactician, passion, analyst")
    comment: str = Field(..., description="Spoken commentary / debate argument")
    pundit_id: Optional[str] = Field(default=None, description="Pundit persona alias for frontend compatibility")
    answer: Optional[str] = Field(default=None, description="Comment alias for frontend Q&A compatibility")
    sentiment: str = Field(
        default="neutral",
        description="Sentiment: positive, critical, excited, concerned, incredulous, analytical, neutral",
    )
    confidence: float = Field(
        default=0.85, ge=0.0, le=1.0, description="Pundit conviction score (0.0 to 1.0)"
    )
    key_observation: Optional[str] = Field(
        default=None, description="Core technical observation or stat highlighted"
    )
    verification: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Claims extracted from this comment and checked against match data (verified / wrong / unsupported)",
    )

    def model_post_init(self, __context: Any) -> None:
        if not self.pundit_id:
            self.pundit_id = self.persona or self.id
        if not self.answer:
            self.answer = self.comment


class TacticalInsight(BaseModel):
    """Engineered tactical patterns and contextual narrative from Tactical Agent."""

    patterns: List[str] = Field(
        default_factory=list,
        description="Identified tactical patterns (e.g., Pressing Trap in Zone 14, Overloaded Left Half-space)",
    )
    momentum_swing: Optional[str] = Field(
        default=None, description="Detected momentum swing description"
    )
    pressing_summary: Optional[str] = Field(
        default=None, description="Summary of pressing triggers and turnovers"
    )
    passing_summary: Optional[str] = Field(
        default=None, description="Passing network metrics and progressive pass channels"
    )
    narrative_context: str = Field(
        ..., description="Cohesive synthesis of current tactical game state"
    )


class PanelDebate(BaseModel):
    """Host-orchestrated multi-pundit panel debate on a key moment."""

    moment_description: str = Field(..., description="Summary of the inciting event")
    importance: str = Field(
        default="HIGH", description="Assessed importance tier: HIGH, MEDIUM, LOW"
    )
    pundits: List[PunditComment] = Field(
        default_factory=list, description="Collection of individual pundit reactions"
    )
    agreement_score: float = Field(
        default=75.0,
        ge=0.0,
        le=100.0,
        description="Consensus index between pundits (0 to 100 scale)",
    )
    host_summary: str = Field(
        ..., description="Host closing synthesis and editorial wrap"
    )
    audience_mode: str = Field(
        default="fan",
        description="Audience framing mode: fan (casual), scout (deep technical), broadcaster (TV-ready)",
    )
    verification: Optional[Dict[str, Any]] = Field(
        default=None, description="Claim-check summary for this debate"
    )


class PanelAnswer(BaseModel):
    """Response to user interactive questioning routed through host and pundits."""

    question: str = Field(..., description="Original user prompt or tactical question")
    answers: List[PunditComment] = Field(
        default_factory=list, description="Pundit answers chosen by host"
    )
    host_summary: str = Field(
        ..., description="Host moderating remarks and conclusion"
    )
    audience_mode: str = Field(
        default="fan", description="Audience framing mode used"
    )
    verification: Optional[Dict[str, Any]] = Field(
        default=None, description="Claim-check summary for this answer"
    )


class MatchPersonality(BaseModel):
    """Full-time match personality and thematic characterization."""

    summary: str = Field(..., description="Comprehensive match narrative summary")
    tags: List[str] = Field(
        default_factory=list,
        description="Distinctive descriptive tags (e.g. 'Tactical Chess Match', 'Pressing Masterclass', 'Late Drama')",
    )
    key_moments: List[KeyMoment] = Field(
        default_factory=list, description="Definitive timeline of match-defining moments"
    )
    tactical_verdict: Optional[str] = Field(
        default=None, description="Strategic verdict on managers and tactical execution"
    )
