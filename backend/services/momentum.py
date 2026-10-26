"""
MatchCast AI - Momentum Service
Calculates rolling 5-minute momentum index and detects tactical momentum swings.
"""

from __future__ import annotations

from collections import deque
from typing import Deque, Dict, List, Optional, Tuple
from backend.models.events import MatchEvent
from backend.models.match_state import MomentumStats


class MomentumTracker:
    """
    Stateful rolling window tracker calculating momentum indices for home and away teams.
    Window length: 5 minutes.
    """

    def __init__(self, window_minutes: int = 5, swing_threshold: float = 20.0) -> None:
        self.window_minutes = window_minutes
        self.swing_threshold = swing_threshold
        self.events: Deque[MatchEvent] = deque()
        self.history: List[Tuple[int, float, float]] = []  # (minute, home_score, away_score)
        self.last_home_momentum: float = 50.0
        self.last_away_momentum: float = 50.0

    def add_event(self, event: MatchEvent) -> None:
        """Add a match event to the internal history queue."""
        self.events.append(event)

    def prune_old_events(self, current_minute: int) -> None:
        """Retain only events occurring within the rolling window."""
        cutoff_minute = max(0, current_minute - self.window_minutes)
        while self.events and self.events[0].minute < cutoff_minute:
            self.events.popleft()

    def calculate_rolling_momentum(
        self,
        current_minute: int,
        home_team: str,
        away_team: str,
    ) -> MomentumStats:
        """
        Compute momentum scores (0-100) for both teams based on active window events:
        - Possession and pass volume (extra weight for final third entries x >= 65)
        - Shots and xG threat
        - Pressures and high defensive actions
        """
        self.prune_old_events(current_minute)

        # Base neutral prior to prevent volatility with low sample size
        raw_home: float = 10.0
        raw_away: float = 10.0

        for ev in self.events:
            is_home = (ev.team.strip().lower() in ("home", home_team.strip().lower()))
            weight = 0.0

            ev_type = (ev.type or "").lower()
            ev_outcome = (ev.outcome or "").lower()
            is_success = ev.success if ev.success is not None else True

            if ev_type == "pass":
                if is_success:
                    weight += 1.0
                    # Final third pass bonus
                    if ev.position and ev.position.x >= 65.0:
                        weight += 1.5
                    if ev.progressive:
                        weight += 1.0
                else:
                    weight -= 0.5
            elif ev_type == "shot":
                weight += 4.0
                if ev.xG:
                    weight += ev.xG * 12.0
                if ev_outcome == "goal":
                    weight += 8.0
            elif ev_type in ("pressure", "tackle", "interception"):
                weight += 1.5
                if ev.position and ev.position.x >= 55.0:
                    # High pressing turnover bonus
                    weight += 1.0
            elif ev_type == "corner":
                weight += 2.0
            elif ev_type == "foul":
                weight -= 1.0

            if is_home:
                raw_home = max(1.0, raw_home + weight)
            else:
                raw_away = max(1.0, raw_away + weight)

        total = raw_home + raw_away
        home_pct = round((raw_home / total) * 100.0, 1)
        away_pct = round(100.0 - home_pct, 1)

        # Calculate momentum swing compared to window anchor (5 minutes prior or baseline)
        anchor_home = 50.0
        cutoff = max(0, current_minute - self.window_minutes)
        for min_stamp, h_score, _ in self.history:
            if min_stamp <= cutoff:
                anchor_home = h_score
            else:
                break

        delta = round(home_pct - anchor_home, 1)

        # Determine qualitative swing status
        swing = "NEUTRAL"
        if delta >= self.swing_threshold:
            swing = "SWING_TO_HOME"
        elif delta <= -self.swing_threshold:
            swing = "SWING_TO_AWAY"
        elif home_pct >= 65.0:
            swing = "HOME_DOMINANT"
        elif away_pct >= 65.0:
            swing = "AWAY_DOMINANT"

        # Record snapshot
        self.history.append((current_minute, home_pct, away_pct))
        self.last_home_momentum = home_pct
        self.last_away_momentum = away_pct

        return MomentumStats(
            home=home_pct,
            away=away_pct,
            swing=swing,
            delta=delta,
        )

    def reset(self) -> None:
        """Reset internal state for a new match session."""
        self.events.clear()
        self.history.clear()
        self.last_home_momentum = 50.0
        self.last_away_momentum = 50.0
