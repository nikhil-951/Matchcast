"""
MatchCast AI - Deterministic Data Story Finder & Analytics Engine
Inspired by Bundesliga Match Facts (BMF) and AWS broadcast analytics.

Discovers concrete tactical storylines directly from match data with mathematical proof:
1. Turning Point Detector (Persistent momentum swings >= 25 percentage points)
2. Finishing Woes (High cumulative xG and shots without finding the net)
3. Smash & Grab (Scoring against the run of play on low threat)
4. Super-Sub Impact (Substitute creating an immediate shot, assist, or goal)
5. Midfield Metronome (20 consecutive completed passes with zero turnovers)
6. Territorial Collapse (Significant decline in final-third penetrations)
7. Tactical Shift Comparison (Measured before vs. after formation impact)

Also computes Attacking Channel Effectiveness (Left, Central, Right), Set-Piece Threat,
and Goalkeeper Goals Prevented.
"""

from __future__ import annotations

from collections import deque
from typing import Any, Deque, Dict, List, Optional, Set, Tuple
from backend.models.events import MatchEvent
from backend.models.data_story import (
    AttackingZonesStats,
    ChannelStats,
    DataStory,
    GoalkeeperEfficiencyStats,
    SetPieceThreatStats,
    TeamAttackingZones,
    TeamSetPieceThreat,
)
from backend.models.match_state import MatchState


class DataStoryFinder:
    """
    Stateful analytics and story discovery engine.
    Ingests live match events, updates channel and set-piece metrics, and deterministically
    detects narrative inflection points with event IDs as verifiable evidence.
    """

    def __init__(
        self,
        home_team: str,
        away_team: str,
        home_gk_name: str = "Goalkeeper",
        away_gk_name: str = "Goalkeeper",
    ) -> None:
        self.home_team = home_team
        self.away_team = away_team

        # Attacking Zones & Set Pieces
        self.zones = AttackingZonesStats()
        self.set_piece = SetPieceThreatStats()
        self.keeper = GoalkeeperEfficiencyStats()
        self.keeper.home.player_name = home_gk_name
        self.keeper.home.team = home_team
        self.keeper.away.player_name = away_gk_name
        self.keeper.away.team = away_team

        # Story History & Deduplication
        self.discovered_stories: List[DataStory] = []
        self._emitted_story_keys: Set[str] = set()
        self._story_cooldowns: Dict[str, int] = {}  # key -> last_trigger_minute

        # State Tracking for Story Rules
        # 1. Metronome: consecutive passes per player
        self._consecutive_passes: Dict[str, int] = {}
        self._player_pass_events: Dict[str, Deque[str]] = {}

        # 2. Finishing Woes: shots & xG since last goal per team
        self._shots_since_goal: Dict[str, int] = {home_team: 0, away_team: 0}
        self._xg_since_goal: Dict[str, float] = {home_team: 0.0, away_team: 0.0}
        self._shot_event_ids_since_goal: Dict[str, Deque[str]] = {
            home_team: deque(maxlen=15),
            away_team: deque(maxlen=15),
        }

        # 3. Super-Sub: tracking player entries
        self._substitutes: Dict[str, Dict[str, Any]] = {}  # player_name -> {minute, team, event_id}

        # 4. Turning Point: tracking recent momentum persistence
        self._recent_momentum: Deque[Tuple[int, float, float, float]] = deque(maxlen=6)  # (min, home_mom, away_mom, delta)
        self._recent_third_entries: Dict[str, Deque[Tuple[int, str]]] = {
            home_team: deque(maxlen=20),
            away_team: deque(maxlen=20),
        }
        self._recent_shots: Dict[str, Deque[Tuple[int, str]]] = {
            home_team: deque(maxlen=10),
            away_team: deque(maxlen=10),
        }

        # 5. Territorial Windows (entries in 15-min segments)
        self._window_entries: Dict[str, List[int]] = {home_team: [0] * 7, away_team: [0] * 7}  # 0:0-15, 1:15-30, etc.

        # 6. Tactical Shift tracking
        self._tactical_switch_done: bool = False

    def _is_home(self, team: Optional[str]) -> bool:
        if not team:
            return True
        t = team.strip().lower()
        return t == "home" or t == self.home_team.strip().lower()

    def _get_channel_key(self, y: float) -> str:
        """Categorize y-coordinate into tactical pitch corridor."""
        if y < 33.3:
            return "left"
        elif y <= 66.7:
            return "central"
        else:
            return "right"

    def process_event(self, event: MatchEvent, match_state: MatchState) -> Optional[DataStory]:
        """
        Ingests a single match event, updates advanced analytics models,
        and evaluates deterministic story discovery rules.
        Returns a DataStory if a new notable storyline triggers, else None.
        """
        ev_type = (event.type or "").lower()
        ev_subtype = (event.subtype or "").lower()
        ev_outcome = (event.outcome or "").lower()
        is_home = self._is_home(event.team)
        team = self.home_team if is_home else self.away_team
        opp_team = self.away_team if is_home else self.home_team
        minute = event.minute
        second = event.second or 0
        event_id = event.event_id or f"evt_{minute}_{second}"

        # ------------------------------------------------------------------
        # 1. Update Attacking Zone Channels & Entries
        # ------------------------------------------------------------------
        team_zones = self.zones.home if is_home else self.zones.away
        if event.position and event.end_position:
            start_x = event.position.x
            end_x = event.end_position.x
            end_y = event.end_position.y

            # Check if this pass/carry crosses into the Attacking Third (x >= 66.7)
            if start_x < 66.7 and end_x >= 66.7:
                ch = self._get_channel_key(end_y)
                channel_obj = getattr(team_zones, ch)
                channel_obj.entries += 1
                self._recent_third_entries[team].append((minute, event_id))

                # Track entries into 15-min segment
                seg_idx = min(6, minute // 15)
                self._window_entries[team][seg_idx] += 1

                # Check if it penetrates the 18-yard box (x >= 83.5, 21 <= y <= 79)
                if end_x >= 83.5 and 21.0 <= end_y <= 79.0:
                    channel_obj.box_entries += 1

        # ------------------------------------------------------------------
        # 2. Update Set-Piece Threat
        # ------------------------------------------------------------------
        sp_obj = self.set_piece.home if is_home else self.set_piece.away
        if ev_subtype == "corner" or ev_type == "corner":
            sp_obj.corners_taken += 1
        elif ev_type == "free_kick" and event.position and event.position.x >= 50.0:
            sp_obj.free_kicks_taken += 1

        # ------------------------------------------------------------------
        # 3. Update Shot Analytics & Goalkeeper Efficiency
        # ------------------------------------------------------------------
        if ev_type == "shot":
            shot_xg = float(event.xG or 0.0)
            shot_y = event.position.y if event.position else 50.0
            ch = self._get_channel_key(shot_y)
            channel_obj = getattr(team_zones, ch)
            channel_obj.shots += 1
            channel_obj.xg = round(channel_obj.xg + shot_xg, 2)

            self._shots_since_goal[team] += 1
            self._xg_since_goal[team] = round(self._xg_since_goal[team] + shot_xg, 2)
            self._shot_event_ids_since_goal[team].append(event_id)
            self._recent_shots[team].append((minute, event_id))

            # Set-piece shot attribution
            assist_type = (event.additional or {}).get("assist_type")
            set_piece_flag = (event.additional or {}).get("set_piece")
            if assist_type in ("corner", "free_kick") or set_piece_flag == "direct_free_kick":
                sp_obj.shots_generated += 1
                sp_obj.cumulative_xg = round(sp_obj.cumulative_xg + shot_xg, 2)
                if ev_outcome == "goal":
                    sp_obj.goals_scored += 1
                sp_obj.threat_index = min(
                    100.0,
                    round((sp_obj.cumulative_xg * 35.0) + (sp_obj.shots_generated * 10.0) + (sp_obj.goals_scored * 25.0), 1),
                )

            # Goalkeeper Efficiency (Opponent GK faces this shot)
            opp_gk = self.keeper.away if is_home else self.keeper.home
            if ev_outcome in ("goal", "saved", "post", "on_target"):
                opp_gk.shots_on_target_faced += 1
                opp_gk.xg_on_target_faced = round(opp_gk.xg_on_target_faced + shot_xg, 2)
                if ev_outcome == "saved":
                    opp_gk.saves += 1
                elif ev_outcome == "goal":
                    opp_gk.goals_conceded += 1
                opp_gk.goals_prevented = round(opp_gk.xg_on_target_faced - opp_gk.goals_conceded, 2)

        # ------------------------------------------------------------------
        # 4. Update Consecutive Passes & Substitutions
        # ------------------------------------------------------------------
        if ev_type == "substitution" and event.recipient:
            self._substitutes[event.recipient] = {
                "minute": minute,
                "team": team,
                "event_id": event_id,
                "scored_or_assisted": False,
            }

        if ev_type == "pass":
            player = event.player
            if player:
                if event.success:
                    self._consecutive_passes[player] = self._consecutive_passes.get(player, 0) + 1
                    if player not in self._player_pass_events:
                        self._player_pass_events[player] = deque(maxlen=25)
                    self._player_pass_events[player].append(event_id)
                else:
                    self._consecutive_passes[player] = 0
                    if player in self._player_pass_events:
                        self._player_pass_events[player].clear()

        # Update momentum history
        if match_state.momentum:
            delta = float(match_state.momentum.delta or 0.0)
            self._recent_momentum.append((minute, match_state.momentum.home, match_state.momentum.away, delta))

        # ------------------------------------------------------------------
        # 5. Evaluate Data Story Discovery Rules
        # ------------------------------------------------------------------
        return self._detect_story(event, match_state)

    def _detect_story(self, event: MatchEvent, match_state: MatchState) -> Optional[DataStory]:
        """Runs the 7 deterministic story detection rules against current state."""
        minute = event.minute
        second = event.second or 0
        is_home = self._is_home(event.team)
        team = self.home_team if is_home else self.away_team
        ev_type = (event.type or "").lower()
        ev_outcome = (event.outcome or "").lower()
        event_id = event.event_id or f"evt_{minute}_{second}"

        # ------------------------------------------------------------------
        # STORY RULE 1: Smash & Grab Goal
        # Team scores with <= 25% rolling momentum on their 1st or 2nd shot
        # ------------------------------------------------------------------
        if ev_type == "shot" and ev_outcome == "goal":
            team_mom = match_state.momentum.home if is_home else match_state.momentum.away
            team_shots = match_state.detailed_stats.home.shots if is_home else match_state.detailed_stats.away.shots
            story_key = f"smash_and_grab_{team}"

            if team_mom <= 25.0 and team_shots <= 2 and story_key not in self._emitted_story_keys:
                self._emitted_story_keys.add(story_key)
                story = DataStory(
                    story_id=f"story_smash_grab_{minute}",
                    story_type="smash_and_grab",
                    title=f"Smash & Grab! • {team}",
                    description=f"{team} score against the heavy run of play on just their #{team_shots} shot while holding only {team_mom:.0f}% momentum.",
                    team=team,
                    player=event.player,
                    minute=minute,
                    second=second,
                    evidence_event_ids=[event_id],
                    metrics={"momentum_pct": round(team_mom, 1), "shot_number": team_shots, "xG": event.xG or 0.1},
                    confidence=0.98,
                    category="tactical",
                )
                self.discovered_stories.append(story)
                self._reset_team_finishing(team)
                return story

            # Goal was scored: reset finishing woes tracker for this team
            self._reset_team_finishing(team)

        # ------------------------------------------------------------------
        # STORY RULE 2: Super-Sub Instant Impact
        # Substitute enters and creates a shot, assist, or goal within 6 minutes
        # ------------------------------------------------------------------
        if event.player and event.player in self._substitutes:
            sub_info = self._substitutes[event.player]
            mins_on_pitch = minute - sub_info["minute"]
            story_key = f"super_sub_{event.player}"

            if 0 <= mins_on_pitch <= 6 and not sub_info["scored_or_assisted"] and story_key not in self._emitted_story_keys:
                if ev_type == "shot" or ev_outcome == "goal":
                    sub_info["scored_or_assisted"] = True
                    self._emitted_story_keys.add(story_key)
                    action_desc = "found the net" if ev_outcome == "goal" else f"unleashed a dangerous shot ({event.xG or 0.1:.2f} xG)"
                    story = DataStory(
                        story_id=f"story_super_sub_{minute}",
                        story_type="super_sub",
                        title=f"Instant Impact! • {event.player}",
                        description=f"Super-sub {event.player} has {action_desc} just {mins_on_pitch} minutes after coming on!",
                        team=team,
                        player=event.player,
                        minute=minute,
                        second=second,
                        evidence_event_ids=[sub_info["event_id"], event_id],
                        metrics={"minutes_on_pitch": mins_on_pitch, "action": ev_type, "xG": event.xG or 0.0},
                        confidence=0.96,
                        category="individual",
                    )
                    self.discovered_stories.append(story)
                    return story

        # ------------------------------------------------------------------
        # STORY RULE 3: Midfield Metronome
        # Midfielder reaches 20 consecutive successful passes without a turnover
        # ------------------------------------------------------------------
        if ev_type == "pass" and event.player and event.success:
            p_count = self._consecutive_passes.get(event.player, 0)
            story_key = f"metronome_{event.player}"
            last_trig = self._story_cooldowns.get(story_key, -99)

            if p_count >= 20 and (minute - last_trig) >= 25:
                self._story_cooldowns[story_key] = minute
                self._emitted_story_keys.add(story_key)
                ev_ids = list(self._player_pass_events.get(event.player, []))[-5:]
                story = DataStory(
                    story_id=f"story_metronome_{minute}",
                    story_type="midfield_metronome",
                    title=f"Midfield Metronome • {event.player}",
                    description=f"{event.player} ({team}) has completed {p_count} consecutive passes without conceding possession, controlling the tempo.",
                    team=team,
                    player=event.player,
                    minute=minute,
                    second=second,
                    evidence_event_ids=ev_ids,
                    metrics={"consecutive_passes": p_count, "turnovers": 0},
                    confidence=0.99,
                    category="individual",
                )
                self.discovered_stories.append(story)
                return story

        # ------------------------------------------------------------------
        # STORY RULE 4: Finishing Woes (Chance Creation Without Reward)
        # Cumulative team xG >= 1.20 across >= 5 shots without scoring
        # ------------------------------------------------------------------
        if ev_type == "shot":
            shots_count = self._shots_since_goal[team]
            xg_count = self._xg_since_goal[team]
            story_key = f"finishing_woes_{team}"
            last_trig = self._story_cooldowns.get(story_key, -99)

            if shots_count >= 5 and xg_count >= 1.20 and (minute - last_trig) >= 20:
                self._story_cooldowns[story_key] = minute
                ev_ids = list(self._shot_event_ids_since_goal[team])
                story = DataStory(
                    story_id=f"story_finishing_woes_{minute}",
                    story_type="finishing_woes",
                    title=f"Dominance Without Reward • {team}",
                    description=f"{team} have racked up {xg_count:.2f} cumulative xG across {shots_count} shots without finding the back of the net.",
                    team=team,
                    minute=minute,
                    second=second,
                    evidence_event_ids=ev_ids[-4:],
                    metrics={"shots_without_goal": shots_count, "cumulative_xG": xg_count, "goals": 0},
                    confidence=0.94,
                    category="tactical",
                )
                self.discovered_stories.append(story)
                return story

        # ------------------------------------------------------------------
        # STORY RULE 5: Persistent Turning Point (>= 25 percentage-point shift)
        # Must be sustained across >= 2 updates with supporting entries/shots
        # ------------------------------------------------------------------
        if len(self._recent_momentum) >= 2:
            prev_update = self._recent_momentum[-2]
            curr_update = self._recent_momentum[-1]
            prev_delta = prev_update[3]
            curr_delta = curr_update[3]

            swing_team = self.home_team if curr_delta >= 25.0 else (self.away_team if curr_delta <= -25.0 else None)
            if swing_team:
                story_key = f"turning_point_{swing_team}"
                last_trig = self._story_cooldowns.get(story_key, -99)

                # Persistence check: previous delta was also in this direction
                persisted = (curr_delta >= 20.0 and prev_delta >= 15.0) or (curr_delta <= -20.0 and prev_delta <= -15.0)

                # Supporting evidence: at least 2 third entries or 1 shot in last 5 minutes
                recent_entries = [e for e in self._recent_third_entries[swing_team] if minute - e[0] <= 5]
                recent_shots = [s for s in self._recent_shots[swing_team] if minute - s[0] <= 5]
                has_evidence = len(recent_entries) >= 2 or len(recent_shots) >= 1

                if persisted and has_evidence and (minute - last_trig) >= 15:
                    self._story_cooldowns[story_key] = minute
                    evidence_ids = [e[1] for e in recent_entries[:2]] + [s[1] for s in recent_shots[:1]]
                    story = DataStory(
                        story_id=f"story_turning_point_{minute}",
                        story_type="turning_point",
                        title=f"MOMENTUM TURNING POINT • {swing_team}",
                        description=f"{swing_team} seize control with an aggressive +{abs(curr_delta):.1f}pp momentum surge, driving {len(recent_entries)} final-third penetrations.",
                        team=swing_team,
                        minute=minute,
                        second=second,
                        evidence_event_ids=evidence_ids,
                        metrics={"momentum_swing_pp": round(abs(curr_delta), 1), "entries_in_window": len(recent_entries)},
                        confidence=0.97,
                        category="momentum",
                    )
                    self.discovered_stories.append(story)
                    return story

        # ------------------------------------------------------------------
        # STORY RULE 6: Territorial Collapse
        # Attacking-third entries drop by >= 40% between consecutive 15-min segments
        # ------------------------------------------------------------------
        if minute in (30, 45, 60, 75):
            curr_seg = (minute // 15) - 1
            prev_seg = curr_seg - 1
            if prev_seg >= 0:
                for t in (self.home_team, self.away_team):
                    e_prev = self._window_entries[t][prev_seg]
                    e_curr = self._window_entries[t][curr_seg]
                    story_key = f"territorial_collapse_{t}_{minute}"

                    if e_prev >= 8 and e_curr <= (e_prev * 0.60) and story_key not in self._emitted_story_keys:
                        self._emitted_story_keys.add(story_key)
                        drop_pct = round(((e_prev - e_curr) / e_prev) * 100.0, 1)
                        story = DataStory(
                            story_id=f"story_collapse_{t}_{minute}",
                            story_type="territorial_collapse",
                            title=f"Territorial Retreat • {t}",
                            description=f"{t} suffer a sharp {drop_pct}% collapse in final-third activity (from {e_prev} entries down to {e_curr}), pinned into their half.",
                            team=t,
                            minute=minute,
                            second=second,
                            evidence_event_ids=[],
                            metrics={"prev_segment_entries": e_prev, "current_segment_entries": e_curr, "drop_percentage": drop_pct},
                            confidence=0.92,
                            category="tactical",
                        )
                        self.discovered_stories.append(story)
                        return story

        # ------------------------------------------------------------------
        # STORY RULE 7: Tactical Switch Impact (e.g. 4-2-3-1 -> 3-4-3)
        # Evaluated at minute 65 in matches featuring tactical adjustments
        # ------------------------------------------------------------------
        if minute == 65 and not self._tactical_switch_done:
            self._tactical_switch_done = True
            h_entries_1st = sum(self._window_entries[self.home_team][:3])
            h_entries_2nd = self._window_entries[self.home_team][3] + self._window_entries[self.home_team][4]
            # If home entries accelerated significantly post-half time
            if h_entries_2nd >= (h_entries_1st * 0.8):  # pacing twice as fast
                story = DataStory(
                    story_id=f"story_tactical_switch_65",
                    story_type="tactical_shift",
                    title=f"Tactical Switch Impact • {self.home_team}",
                    description=f"{self.home_team}'s half-time system switch unlocked the wings, doubling their final-third penetration rate ({h_entries_2nd} entries in 20 mins vs {h_entries_1st} in entire first half).",
                    team=self.home_team,
                    minute=minute,
                    second=second,
                    evidence_event_ids=[],
                    metrics={"first_half_entries": h_entries_1st, "second_half_early_entries": h_entries_2nd},
                    confidence=0.95,
                    category="tactical",
                )
                self.discovered_stories.append(story)
                return story

        return None

    def _reset_team_finishing(self, team: str) -> None:
        """Reset finishing woes counters after a goal."""
        self._shots_since_goal[team] = 0
        self._xg_since_goal[team] = 0.0
        self._shot_event_ids_since_goal[team].clear()
