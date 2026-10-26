"""
MatchCast AI - Tactical Engine Agent
Combines rule-based pattern detection (momentum swings, pressing traps, channel overloads)
with Azure OpenAI LLM synthesis to produce structured TacticalInsight models.
"""

from __future__ import annotations

import json
import logging
from collections import deque
from typing import Deque, List, Optional, Tuple

from backend.config import get_openai_client, settings
from backend.models.events import MatchEvent
from backend.models.match_state import KeyMoment, MatchState
from backend.models.panel_output import TacticalInsight

logger = logging.getLogger(__name__)


def _classify_pitch_zone(x: float, y: float) -> str:
    """Classify 0-100 pitch coordinates into standard tactical zones."""
    # Thirds
    if x < 35.0:
        third = "Defensive Third"
    elif x < 65.0:
        third = "Middle Third"
    else:
        third = "Final Third"

    # Corridors
    if y < 33.0:
        corridor = "Left Flank"
    elif y > 67.0:
        corridor = "Right Flank"
    else:
        corridor = "Central Corridor"

    # Specific Zone 14 detection (central attacking third)
    if 65.0 <= x <= 85.0 and 33.0 <= y <= 67.0:
        return "Zone 14 (Central Edge of Box)"

    return f"{third} - {corridor}"


class TacticalAgent:
    """
    Tactical Engine Agent: Identifies tactical patterns via rule-based heuristics
    and enriches them with LLM-powered strategic synthesis.
    """

    def __init__(self) -> None:
        self.recent_events: Deque[MatchEvent] = deque()

    def update_history(self, event: MatchEvent) -> None:
        """Keep sliding buffer of events from the past 5 match minutes."""
        self.recent_events.append(event)
        cutoff = max(0, event.minute - 5)
        while self.recent_events and self.recent_events[0].minute < cutoff:
            self.recent_events.popleft()

    def detect_patterns(self, match_state: MatchState) -> Tuple[List[str], Optional[str], Optional[str], Optional[str]]:
        """
        Rule-based pattern detection:
        1. Pressing traps (3+ pressures in same zone within 2 minutes)
        2. Passing network imbalances (overloaded channels, midfield turnover clusters)
        3. Momentum swings
        """
        patterns: List[str] = []
        pressing_summary: Optional[str] = None
        passing_summary: Optional[str] = None
        momentum_swing_desc: Optional[str] = None

        # 1. Momentum Swings
        if match_state.momentum.swing in ("SWING_TO_HOME", "SWING_TO_AWAY"):
            dominant = match_state.home_team if match_state.momentum.swing == "SWING_TO_HOME" else match_state.away_team
            momentum_swing_desc = f"{dominant} sustained a +{abs(match_state.momentum.delta or 0):.1f}% momentum swing"
            patterns.append(f"Significant Momentum Shift: {dominant} asserting dominance")
        elif match_state.momentum.home >= 65.0:
            momentum_swing_desc = f"{match_state.home_team} in prolonged territorial control ({match_state.momentum.home}% momentum)"
            patterns.append(f"Territorial Monopoly: {match_state.home_team}")
        elif match_state.momentum.away >= 65.0:
            momentum_swing_desc = f"{match_state.away_team} in prolonged territorial control ({match_state.momentum.away}% momentum)"
            patterns.append(f"Territorial Monopoly: {match_state.away_team}")

        # 2. Pressing Traps
        pressure_zones: dict[str, int] = {}
        cutoff_2min = max(0, match_state.minute - 2)
        for ev in self.recent_events:
            if ev.minute >= cutoff_2min and (ev.type or "").lower() in ("pressure", "tackle", "interception"):
                if ev.position:
                    zone = _classify_pitch_zone(ev.position.x, ev.position.y)
                    pressure_zones[zone] = pressure_zones.get(zone, 0) + 1

        for zone, count in pressure_zones.items():
            if count >= 3:
                trap_str = f"High Pressing Trap active in {zone} ({count} aggressive actions in 2m)"
                patterns.append(trap_str)
                pressing_summary = trap_str
                break

        if not pressing_summary:
            p_home = match_state.pressing_intensity.home
            p_away = match_state.pressing_intensity.away
            if p_home > 2.0 or p_away > 2.0:
                more_aggressive = match_state.home_team if p_home >= p_away else match_state.away_team
                pressing_summary = f"{more_aggressive} operating with high-block counter-pressing intensity ({max(p_home, p_away):.1f} pressures/min)"

        # 3. Passing Network Distribution
        left_passes = 0
        right_passes = 0
        central_passes = 0
        midfield_turnovers = 0
        total_recent_passes = 0

        for ev in self.recent_events:
            if (ev.type or "").lower() == "pass":
                total_recent_passes += 1
                if ev.position:
                    if ev.position.y < 35.0:
                        left_passes += 1
                    elif ev.position.y > 65.0:
                        right_passes += 1
                    else:
                        central_passes += 1

                # Check midfield turnovers
                if ev.position and 35.0 <= ev.position.x <= 65.0 and ev.success is False:
                    midfield_turnovers += 1

        if total_recent_passes >= 6:
            if (left_passes / total_recent_passes) >= 0.60:
                channel_str = "Asymmetric Buildup: Overloading the Left Channel (60%+ pass share)"
                patterns.append(channel_str)
                passing_summary = channel_str
            elif (right_passes / total_recent_passes) >= 0.60:
                channel_str = "Asymmetric Buildup: Overloading the Right Channel (60%+ pass share)"
                patterns.append(channel_str)
                passing_summary = channel_str
            elif midfield_turnovers >= 2:
                turnover_str = f"Central Transition Vulnerability: {midfield_turnovers} midfield turnovers in last 5 mins"
                patterns.append(turnover_str)
                passing_summary = turnover_str

        if not passing_summary and total_recent_passes > 0:
            passing_summary = f"Balanced circulation across channels with {match_state.possession.home}% home possession"

        return patterns, momentum_swing_desc, pressing_summary, passing_summary

    async def analyze(
        self,
        match_state: MatchState,
        key_moment: Optional[KeyMoment] = None,
    ) -> TacticalInsight:
        """
        Synthesize rule-based pattern findings with Azure OpenAI LLM into TacticalInsight.
        Falls back to rule-based generation when LLM is unavailable.
        """
        patterns, mom_swing, press_summary, pass_summary = self.detect_patterns(match_state)
        client = get_openai_client()

        # If LLM client is not available, execute robust fallback synthesis
        if client is None:
            narrative = self._generate_fallback_narrative(
                match_state, key_moment, patterns, mom_swing, press_summary
            )
            return TacticalInsight(
                patterns=patterns,
                momentum_swing=mom_swing,
                pressing_summary=press_summary,
                passing_summary=pass_summary,
                narrative_context=narrative,
            )

        # Build prompt for Azure OpenAI
        system_prompt = (
            "You are the Tactical Engine AI for MatchCast AI, an elite Premier League analysis system. "
            "Synthesize the raw match metrics and detected spatial patterns into a 2-to-3 sentence "
            "masterful tactical diagnosis. Focus on spatial dynamics, pressing height, and structural imbalances."
        )

        user_content = {
            "minute": match_state.minute,
            "score": f"{match_state.home_team} {match_state.score.home} - {match_state.score.away} {match_state.away_team}",
            "possession": f"{match_state.home_team} {match_state.possession.home}% - {match_state.away_team} {match_state.possession.away}%",
            "xg": f"{match_state.xg_totals.home} vs {match_state.xg_totals.away}",
            "patterns_detected": patterns,
            "key_moment": key_moment.description if key_moment else None,
            "momentum_swing": mom_swing,
            "pressing_summary": press_summary,
            "passing_summary": pass_summary,
        }

        try:
            response = await client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Tactical Data:\n{json.dumps(user_content, indent=2)}"},
                ],
                max_completion_tokens=1500,
                reasoning_effort="low",
            )
            narrative = (response.choices[0].message.content or "").strip()
            if not narrative:
                raise ValueError("Empty LLM response")

        except Exception as exc:
            logger.warning("TacticalAgent LLM call failed (%s). Using fallback narrative.", exc)
            narrative = self._generate_fallback_narrative(
                match_state, key_moment, patterns, mom_swing, press_summary
            )

        return TacticalInsight(
            patterns=patterns,
            momentum_swing=mom_swing,
            pressing_summary=press_summary,
            passing_summary=pass_summary,
            narrative_context=narrative,
        )

    def _generate_fallback_narrative(
        self,
        match_state: MatchState,
        key_moment: Optional[KeyMoment],
        patterns: List[str],
        momentum_swing: Optional[str],
        pressing_summary: Optional[str],
    ) -> str:
        """Deterministic tactical narrative generator when offline/fallback."""
        h_name = match_state.home_team
        a_name = match_state.away_team
        h_xg = match_state.xg_totals.home
        a_xg = match_state.xg_totals.away
        h_poss = match_state.possession.home

        if key_moment:
            context = f"Following {key_moment.description}, "
        else:
            context = f"At minute {match_state.minute}, "

        if patterns:
            pattern_text = f"the data highlights {patterns[0].lower()}."
        else:
            pattern_text = f"{h_name} hold {h_poss}% possession while generating {h_xg} xG against {a_name}'s {a_xg} xG."

        tactical_clause = (
            f" {momentum_swing or 'Territorial battles remain balanced'} with "
            f"{pressing_summary or 'disciplined mid-block defensive shapes'}."
        )

        return f"{context}{pattern_text}{tactical_clause}"
