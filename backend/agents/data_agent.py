"""
MatchCast AI - Data Ingestion Agent
Deterministic analytical agent responsible for ingesting match events, computing running xG,
calculating possession and momentum, tracking match state, and flagging key moments.
No LLM calls - pure real-time computation.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

from backend.models.events import MatchEvent
from backend.models.match_state import (
    DetailedStats,
    KeyMoment,
    MatchState,
    MomentumStats,
    PossessionStats,
    PressingStats,
    Score,
    TeamDetailedStats,
    XgTotals,
)
from backend.services.momentum import MomentumTracker
from backend.services.xg_model import calculate_xg
from backend.services.story_finder import DataStoryFinder

logger = logging.getLogger(__name__)


class DataAgent:
    """
    Data Ingestion Agent: Ingests raw match events, updates match state aggregates,
    calculates real-time xG, possession, pressing intensity, and flags key tactical moments.
    """

    def __init__(
        self,
        home_team: str = "Home Team",
        away_team: str = "Away Team",
        match_id: str = "live_match",
    ) -> None:
        self.match_id = match_id
        self.home_team = home_team
        self.away_team = away_team

        # State aggregations
        self.score = Score(home=0, away=0)
        self.xg_totals = XgTotals(home=0.0, away=0.0)
        self.pass_counts: Dict[str, int] = {home_team: 0, away_team: 0}
        self.pressure_counts: Dict[str, int] = {home_team: 0, away_team: 0}
        self.home_stats = TeamDetailedStats()
        self.away_stats = TeamDetailedStats()
        self.events_processed = 0
        self.key_moments: List[KeyMoment] = []

        # Momentum engine
        self.momentum_tracker = MomentumTracker(window_minutes=5, swing_threshold=20.0)

        # Rate-limiting for momentum swing alerts (avoid consecutive alerts within 3 minutes)
        self._last_momentum_swing_minute: int = -10

        # Deterministic Data Story Finder & Channel Analytics
        self.story_finder = DataStoryFinder(home_team, away_team)

        self.current_phase = "FIRST_HALF"

    def reset(self, home_team: str, away_team: str, match_id: str) -> None:
        """Reset state tracking for a new match."""
        self.match_id = match_id
        self.home_team = home_team
        self.away_team = away_team
        self.score = Score(home=0, away=0)
        self.xg_totals = XgTotals(home=0.0, away=0.0)
        self.pass_counts = {home_team: 0, away_team: 0}
        self.pressure_counts = {home_team: 0, away_team: 0}
        self.home_stats = TeamDetailedStats()
        self.away_stats = TeamDetailedStats()
        self.events_processed = 0
        self.key_moments.clear()
        self.momentum_tracker.reset()
        self._last_momentum_swing_minute = -10
        self.story_finder = DataStoryFinder(home_team, away_team)
        self.current_phase = "FIRST_HALF"

    def get_initial_state(self) -> MatchState:
        """Returns clean initial MatchState at kickoff (0-0, 0 xG, minute 0)."""
        return MatchState(
            match_id=self.match_id,
            home_team=self.home_team,
            away_team=self.away_team,
            minute=0,
            second=0,
            score=Score(home=0, away=0),
            control_index=50.0,
            chaos_index=50.0,
            game_rhythm="Balanced Tactical Chess Match",
            possession=PossessionStats(home=50.0, away=50.0),
            xg_totals=XgTotals(home=0.0, away=0.0),
            xg=XgTotals(home=0.0, away=0.0),
            momentum=MomentumStats(),
            pressing_intensity=PressingStats(home=0.0, away=0.0),
            events_processed=0,
            key_moments=[],
            current_phase="FIRST_HALF",
            status="live",
            detailed_stats=DetailedStats(
                home=TeamDetailedStats(),
                away=TeamDetailedStats(),
            ),
            attacking_zones=self.story_finder.zones,
            set_piece_threat=self.story_finder.set_piece,
            keeper_efficiency=self.story_finder.keeper,
            latest_story=None,
            active_stories=[],
        )

    def process_event(self, event: MatchEvent) -> Tuple[MatchState, Optional[KeyMoment]]:
        """
        Process a single incoming match event.
        Returns the updated MatchState and an optional KeyMoment if an inflection point occurred.
        """
        self.events_processed += 1
        ev_team = event.team.strip().lower()
        is_home = (ev_team == "home" or ev_team == self.home_team.strip().lower())

        # Determine phase based on minute
        if event.minute < 45:
            self.current_phase = "FIRST_HALF"
        elif event.minute == 45 and event.second == 0 and self.events_processed > 5:
            self.current_phase = "HALF_TIME"
        elif 45 <= event.minute < 90:
            self.current_phase = "SECOND_HALF"
        else:
            self.current_phase = "FULL_TIME"

        active_stats = self.home_stats if is_home else self.away_stats

        # 1. Update Pass & Possession metrics
        ev_type = (event.type or "").lower()
        ev_subtype = (event.subtype or "").lower()
        ev_outcome = (event.outcome or "").lower()

        if ev_type in ("pass", "free_kick"):
            active_stats.total_passes += 1
            if event.success is not False and ev_outcome != "incomplete":
                active_stats.completed_passes += 1
            if active_stats.total_passes > 0:
                active_stats.pass_accuracy = round(
                    (active_stats.completed_passes / active_stats.total_passes) * 100.0, 1
                )
            if is_home:
                self.pass_counts[self.home_team] = self.pass_counts.get(self.home_team, 0) + 1
            else:
                self.pass_counts[self.away_team] = self.pass_counts.get(self.away_team, 0) + 1

        # 2. Update Pressing & Defensive metrics
        if ev_type in ("pressure", "tackle", "interception", "ball_recovery"):
            if ev_type in ("tackle", "interception", "ball_recovery") and event.success is not False:
                active_stats.tackles_won += 1
            if is_home:
                self.pressure_counts[self.home_team] = self.pressure_counts.get(self.home_team, 0) + 1
            else:
                self.pressure_counts[self.away_team] = self.pressure_counts.get(self.away_team, 0) + 1

        # 3. Compute and accrue Shot xG & Shots on Target
        shot_xg = 0.0
        if ev_type == "shot" or ev_subtype == "penalty":
            active_stats.shots += 1
            shot_xg = calculate_xg(event)
            event.xG = shot_xg
            if is_home:
                self.xg_totals.home = round(self.xg_totals.home + shot_xg, 2)
            else:
                self.xg_totals.away = round(self.xg_totals.away + shot_xg, 2)

        # 4. Update Score and Shots on Target
        is_goal = (ev_type == "goal" or ev_outcome == "goal")
        if is_goal:
            active_stats.shots_on_target += 1
            if is_home:
                self.score.home += 1
            else:
                self.score.away += 1
        elif (ev_type == "shot" or ev_subtype == "penalty") and ev_outcome in ("saved", "post", "on_target"):
            active_stats.shots_on_target += 1

        # 5. Fouls, Cards & Corners
        if ev_type == "foul":
            active_stats.fouls += 1

        if ev_type == "card" or ev_subtype in ("yellow", "red"):
            card_color = ev_subtype or (event.additional or {}).get("color", "")
            if "yellow" in card_color:
                active_stats.yellow_cards += 1
            elif "red" in card_color:
                active_stats.red_cards += 1

        if ev_type == "corner" or ev_subtype == "corner" or (event.additional or {}).get("assist_type") == "corner":
            active_stats.corners += 1

        # 5. Push event to Momentum Tracker and evaluate
        self.momentum_tracker.add_event(event)
        momentum_stats = self.momentum_tracker.calculate_rolling_momentum(
            current_minute=event.minute,
            home_team=self.home_team,
            away_team=self.away_team,
        )

        # 6. Compute Possession Percentages
        total_passes = self.pass_counts.get(self.home_team, 0) + self.pass_counts.get(self.away_team, 0)
        if total_passes > 0:
            home_poss = round((self.pass_counts.get(self.home_team, 0) / total_passes) * 100.0, 1)
            away_poss = round(100.0 - home_poss, 1)
        else:
            home_poss, away_poss = 50.0, 50.0

        possession_stats = PossessionStats(home=home_poss, away=away_poss)

        # 7. Pressing intensity rate
        minutes_elapsed = max(1, event.minute)
        pressing_stats = PressingStats(
            home=round(self.pressure_counts.get(self.home_team, 0) / minutes_elapsed, 2),
            away=round(self.pressure_counts.get(self.away_team, 0) / minutes_elapsed, 2),
            home_pressures_count=self.pressure_counts.get(self.home_team, 0),
            away_pressures_count=self.pressure_counts.get(self.away_team, 0),
        )

        # 8. Compute Control vs Chaos & Game Rhythm
        pass_acc = active_stats.pass_accuracy or 80.0
        recent_press = (self.pressure_counts.get(self.home_team, 0) + self.pressure_counts.get(self.away_team, 0)) / max(1, self.events_processed)
        chaos_factor = (100.0 - pass_acc) * 0.55 + min(35.0, recent_press * 110.0)
        if ev_type in ("shot", "foul", "card", "tackle", "corner"):
            chaos_factor += 8.0
        chaos_val = round(max(15.0, min(85.0, chaos_factor)), 1)
        control_val = round(100.0 - chaos_val, 1)

        if chaos_val >= 60.0:
            if ev_type in ("shot", "corner"):
                game_rhythm = "Box Scramble & Goalmouth Chaos"
            elif ev_type in ("foul", "card", "tackle"):
                game_rhythm = "High-Intensity Physical Clash"
            else:
                game_rhythm = "High-Tempo Direct Transition"
        elif control_val >= 60.0:
            game_rhythm = "Controlled Patient Build-Up"
        else:
            game_rhythm = "Balanced Tactical Chess Match"

        # 9. Check for Key Moment inflection point
        key_moment = self._detect_key_moment(event, shot_xg, is_goal, momentum_stats)
        if key_moment:
            self.key_moments.append(key_moment)

        # Status label for frontend
        status_label = "live"
        if self.current_phase == "HALF_TIME":
            status_label = "half_time"
        elif self.current_phase == "FULL_TIME":
            status_label = "full_time"

        # Construct comprehensive MatchState
        match_state = MatchState(
            match_id=self.match_id,
            home_team=self.home_team,
            away_team=self.away_team,
            minute=event.minute,
            second=event.second,
            score=self.score,
            control_index=control_val,
            chaos_index=chaos_val,
            game_rhythm=game_rhythm,
            possession=possession_stats,
            xg_totals=self.xg_totals,
            xg=self.xg_totals,
            momentum=momentum_stats,
            pressing_intensity=pressing_stats,
            events_processed=self.events_processed,
            key_moments=list(self.key_moments),
            current_phase=self.current_phase,
            status=status_label,
            detailed_stats=DetailedStats(
                home=self.home_stats.model_copy(),
                away=self.away_stats.model_copy(),
            ),
            last_event=event,
        )

        # 10. Process Deterministic Data Story Finder & Channel Analytics
        story = self.story_finder.process_event(event, match_state)
        match_state.attacking_zones = self.story_finder.zones
        match_state.set_piece_threat = self.story_finder.set_piece
        match_state.keeper_efficiency = self.story_finder.keeper
        match_state.active_stories = list(self.story_finder.discovered_stories)

        if story:
            match_state.latest_story = story
            # Elevate major narrative discoveries into KeyMoments so Pundits debate them
            if not key_moment and story.story_type in (
                "turning_point",
                "smash_and_grab",
                "super_sub",
                "finishing_woes",
                "tactical_shift",
            ):
                importance_level = (
                    "HIGH"
                    if story.story_type in ("turning_point", "smash_and_grab", "tactical_shift")
                    else "MEDIUM"
                )
                story_key_moment = KeyMoment(
                    minute=story.minute,
                    second=story.second,
                    description=f"{story.title}: {story.description}",
                    importance=importance_level,
                    event_id=event.event_id,
                    team=story.team,
                    type=story.story_type,
                )
                self.key_moments.append(story_key_moment)
                match_state.key_moments = list(self.key_moments)
                key_moment = story_key_moment

        return match_state, key_moment

    def _detect_key_moment(
        self,
        event: MatchEvent,
        shot_xg: float,
        is_goal: bool,
        momentum_stats: MomentumStats,
    ) -> Optional[KeyMoment]:
        """Evaluate event context and identify if it merits pundit panel reaction."""
        ev_type = (event.type or "").lower()
        ev_subtype = (event.subtype or "").lower()
        ev_outcome = (event.outcome or "").lower()

        # Goal -> HIGH importance
        if is_goal:
            dist_yd = 0.0
            dist_m = 0.0
            if event.position:
                dist_m = round((100.0 - event.position.x) * 1.05, 1)
                dist_yd = round(dist_m * 1.0936, 1)

            add_data = event.additional or {}
            assist_type = add_data.get("assist_type")

            if "penalty" in ev_subtype or "penalty" in ev_type:
                goal_desc = "a clinical penalty kick from the spot"
            elif "free_kick" in ev_subtype or assist_type == "free_kick":
                goal_desc = f"a spectacular direct free-kick curled in from {dist_yd} yards ({dist_m}m) out"
            elif event.position and event.position.x < 84.0:
                goal_desc = f"a stunning long-range rocket from OUTSIDE the penalty box ({dist_yd} yards / {dist_m}m out)"
            elif ev_subtype == "header" or (event.body_part or "").lower() == "head":
                goal_desc = f"a towering header from a whipped delivery ({dist_yd} yards out)"
            elif (event.position and event.position.x >= 94.0) or ev_subtype == "tap_in":
                goal_desc = f"a point-blank tap-in finish at the goalmouth ({dist_yd} yards out)"
            else:
                goal_desc = f"a composed finish inside the penalty box ({dist_yd} yards out)"

            return KeyMoment(
                minute=event.minute,
                second=event.second,
                description=f"GOAL! {event.player} scores for {event.team} with {goal_desc}! ({self.score.home}-{self.score.away})",
                importance="HIGH",
                event_id=event.event_id,
                team=event.team,
                type="goal",
            )

        # Red card or second yellow -> HIGH importance
        if ev_type == "card" and ev_subtype in ("red", "second_yellow"):
            return KeyMoment(
                minute=event.minute,
                second=event.second,
                description=f"RED CARD! {event.player} ({event.team}) has been sent off!",
                importance="HIGH",
                event_id=event.event_id,
                team=event.team,
                type="red_card",
            )

        # Penalty awarded / taken -> HIGH importance
        is_pen_event = "penalty" in ev_subtype or "penalty" in ev_type or (event.additional or {}).get("is_penalty")
        if is_pen_event and not is_goal:
            if ev_type == "goalkeeper_save" or "save" in ev_subtype:
                return KeyMoment(
                    minute=event.minute,
                    second=event.second,
                    description=f"PENALTY SAVED! {event.player} ({event.team}) makes a heroic penalty save to deny the spot kick!",
                    importance="HIGH",
                    event_id=event.event_id,
                    team=event.team,
                    type="penalty_saved",
                )
            elif ev_type == "foul":
                return KeyMoment(
                    minute=event.minute,
                    second=event.second,
                    description=f"PENALTY AWARDED! {event.player} ({event.team}) concedes a penalty kick after a foul inside the box!",
                    importance="HIGH",
                    event_id=event.event_id,
                    team=event.team,
                    type="penalty_awarded",
                )
            elif ev_type == "shot":
                if ev_outcome in ("off_target", "missed", "post"):
                    return KeyMoment(
                        minute=event.minute,
                        second=event.second,
                        description=f"PENALTY MISSED! {event.player} ({event.team}) puts the penalty spot kick off target!",
                        importance="HIGH",
                        event_id=event.event_id,
                        team=event.team,
                        type="penalty_missed",
                    )
                # If outcome is saved, the subsequent goalkeeper_save event narrates the heroic stop.
                # If outcome is in-flight, the foul already alerted viewers.
                return None

        # High xG big chance missed/saved -> MEDIUM importance
        if ev_type == "shot" and shot_xg >= 0.35 and not is_goal:
            desc = f"BIG CHANCE! {event.player} ({event.team}) with a major opportunity ({shot_xg:.2f} xG) — {ev_outcome}!"
            return KeyMoment(
                minute=event.minute,
                second=event.second,
                description=desc,
                importance="MEDIUM",
                event_id=event.event_id,
                team=event.team,
                type="high_xg_chance",
            )

        # Woodwork hit -> MEDIUM importance
        if ev_outcome in ("post", "crossbar"):
            return KeyMoment(
                minute=event.minute,
                second=event.second,
                description=f"WOODWORK! {event.player} ({event.team}) rattles the {ev_outcome}!",
                importance="MEDIUM",
                event_id=event.event_id,
                team=event.team,
                type="woodwork",
            )

        # Yellow card -> MEDIUM importance
        if ev_type == "card" and ev_subtype == "yellow":
            return KeyMoment(
                minute=event.minute,
                second=event.second,
                description=f"YELLOW CARD! {event.player} ({event.team}) is booked by the referee.",
                importance="MEDIUM",
                event_id=event.event_id,
                team=event.team,
                type="yellow_card",
            )

        # Significant Momentum Swing -> HIGH or MEDIUM importance (rate-limited)
        if (
            momentum_stats.swing in ("SWING_TO_HOME", "SWING_TO_AWAY")
            and (event.minute - self._last_momentum_swing_minute) >= 4
        ):
            self._last_momentum_swing_minute = event.minute
            favored = self.home_team if momentum_stats.swing == "SWING_TO_HOME" else self.away_team
            return KeyMoment(
                minute=event.minute,
                second=event.second,
                description=f"TACTICAL SWING! {favored} seizing massive momentum ({abs(momentum_stats.delta or 0):.1f}% swing in 5 mins)!",
                importance="MEDIUM",
                event_id=event.event_id,
                team=favored,
                type="momentum_swing",
            )

        return None
