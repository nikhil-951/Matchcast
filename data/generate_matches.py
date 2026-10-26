"""
generate_matches.py - Synthetic Football Match Data Generator
MatchCast AI Project (Premier League AI Hackathon)

Generates realistic synthetic football match event data with:
- ~1400 to 1800 events per match chronologically ordered
- Realistic possession phases and passing sequences
- Strict event schema compliance
- Sophisticated xG model matching hackathon specifications
- 5 to 8 dramatic key moments per match for AI pundit debates
- Completely fictional teams and player names
"""

import os
import json
import math
import random
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Tuple


# ==============================================================================
# Domain Models & Data Structures
# ==============================================================================

@dataclass
class Player:
    name: str
    number: int
    position: str       # "GK", "DF", "MF", "FW"
    role: str           # "GK", "CB", "LB", "RB", "CM", "DM", "CAM", "LW", "RW", "ST"
    nominal_x: float    # 0 - 100 default attacking pitch coordinate
    nominal_y: float    # 0 - 100 default pitch coordinate
    preferred_foot: str = "right_foot"
    is_starter: bool = True


@dataclass
class Team:
    name: str
    formation: str
    starters: List[Player]
    substitutes: List[Player]
    team_type: str = "home"  # "home" or "away"
    active_players: List[Player] = field(default_factory=list)

    def __post_init__(self):
        self.active_players = list(self.starters)

    def get_player_by_name(self, name: str) -> Optional[Player]:
        for p in self.starters + self.substitutes:
            if p.name == name:
                return p
        return None

    def get_goalkeeper(self) -> Player:
        for p in self.active_players:
            if p.position == "GK":
                return p
        return self.active_players[0]

    def get_outfield_players(self) -> List[Player]:
        return [p for p in self.active_players if p.position != "GK"]


# ==============================================================================
# xG Calculation Engine
# ==============================================================================

def calculate_xg(
    x: float,
    y: float,
    body_part: Optional[str] = "right_foot",
    assist_type: Optional[str] = None,
    is_first_time: bool = False,
    is_under_pressure: bool = False,
    shot_type: str = "open_play",
    is_weak_foot: bool = False
) -> float:
    """
    Calculate Expected Goals (xG) strictly following hackathon guidelines:
    - Base xG from distance: max(0, 0.5 - (distance_to_goal / 50))
    - Angle modifier: multiply by (1 - abs(angle_from_center) / 90)
    - Body part: header = 0.7x, weak_foot = 0.85x
    - Assist type: through_ball = 1.3x, cross = 0.9x, corner = 0.6x
    - First time shot: 0.8x
    - Under pressure: 0.7x
    - Penalty: fixed 0.76
    - Free kick: fixed 0.06
    """
    if shot_type == "penalty":
        return 0.76
    if shot_type == "free_kick":
        return 0.06

    # Distance to goal center (100.0, 50.0)
    dx = max(0.01, 100.0 - x)
    dy = abs(50.0 - y)
    distance_to_goal = math.sqrt(dx ** 2 + dy ** 2)

    base_xg = max(0.01, 0.5 - (distance_to_goal / 50.0))

    # Angle from center
    angle_rad = math.atan2(dy, dx)
    angle_deg = math.degrees(angle_rad)
    angle_modifier = max(0.05, 1.0 - (angle_deg / 90.0))

    xg = base_xg * angle_modifier

    if body_part == "head":
        xg *= 0.7
    elif is_weak_foot:
        xg *= 0.85

    if assist_type == "through_ball":
        xg *= 1.3
    elif assist_type == "cross":
        xg *= 0.9
    elif assist_type == "corner":
        xg *= 0.6

    if is_first_time:
        xg *= 0.8
    if is_under_pressure:
        xg *= 0.7

    # Keep within realistic bounds and round to 2 decimals
    xg = max(0.01, min(0.95, xg))
    return round(xg, 2)


# ==============================================================================
# Match Generator Class
# ==============================================================================

class FootballMatchGenerator:
    """
    High-fidelity match simulator generating chronological football event streams.
    """

    def __init__(self, match_id: str, home_team: Team, away_team: Team, seed: int = 42, allow_dynamic_goals: bool = False):
        self.match_id = match_id
        self.home_team = home_team
        self.away_team = away_team
        self.seed = seed
        self.allow_dynamic_goals = allow_dynamic_goals
        self.rng = random.Random(seed)
        self.events: List[Dict[str, Any]] = []
        self.event_counter = 0

        # Match State
        self.minute = 0
        self.second = 0
        self.possession_team_str = "home"
        self.current_x = 50.0
        self.current_y = 50.0
        self.last_passer: Optional[Player] = None
        self.last_pass_type: Optional[str] = None
        self.home_score = 0
        self.away_score = 0
        self.red_cards: List[str] = []
        self.yellow_cards: List[str] = []

    def next_event_id(self) -> str:
        self.event_counter += 1
        return f"evt_{self.event_counter:04d}"

    def advance_time(self, min_seconds: int = 2, max_seconds: int = 5):
        dt = self.rng.randint(min_seconds, max_seconds)
        self.second += dt
        if self.second >= 60:
            self.minute += self.second // 60
            self.second = self.second % 60

    def _derive_motion_metrics(self, event_type, subtype, position, end_position, under_pressure, progressive):
        """Synthetic pass-quality and ball-speed metrics (pitch is 105m x 68m)."""
        if event_type not in ("pass", "shot") or not end_position:
            return None
        dx = (end_position[0] - position[0]) * 1.05
        dy = (end_position[1] - position[1]) * 0.68
        dist = round(float((dx * dx + dy * dy) ** 0.5), 1)
        if event_type == "shot":
            lo, hi = (45, 75) if subtype == "header" else (75, 125)
            return {"distance_m": dist, "shot_speed_kmh": round(float(self.rng.uniform(lo, hi)), 1)}
        ranges = {"short": (45, 75), "long": (70, 100), "through_ball": (60, 90),
                  "cross": (65, 95), "corner": (70, 95)}
        lo, hi = ranges.get(subtype or "short", (50, 85))
        difficulty = 0.12 + min(dist, 50.0) / 50.0 * 0.38 + (0.22 if under_pressure else 0.0) + (0.10 if progressive else 0.0)
        difficulty += float(self.rng.uniform(-0.05, 0.05))
        
        metrics = {
            "distance_m": dist,
            "ball_speed_kmh": round(float(self.rng.uniform(lo, hi)), 1),
            "pass_difficulty": round(max(0.0, min(1.0, difficulty)), 2),
        }
        
        # Player Sprint Speed & Distance Indicators (Threshold: 31.0+ km/h for elite bursts)
        # Biomechanically, elite sprinting (>= 31.0 km/h) requires substantial acceleration distance (20+ meters).
        # Short passes (e.g. 5-18m) cannot physically reach 31+ km/h top speeds.
        if dist >= 20.0 and (progressive or subtype in ("through_ball", "dribble", "counter") or (event_type == "shot" and dist >= 22.0)):
            if self.rng.random() < 0.25:
                speed = 31.0 + min(4.6, (dist - 20.0) * 0.11) + float(self.rng.uniform(-0.3, 0.6))
                sprint_dist = round(max(20.0, min(52.0, dist + float(self.rng.uniform(-1.0, 5.0)))), 1)
                metrics["player_speed_kmh"] = round(float(speed), 1)
                metrics["sprint_distance_m"] = sprint_dist
                
        return metrics

    def add_event(
        self,
        event_type: str,
        subtype: Optional[str],
        team: str,
        player: Player,
        position: Tuple[float, float],
        end_position: Optional[Tuple[float, float]] = None,
        recipient: Optional[str] = None,
        success: Optional[bool] = None,
        xg: Optional[float] = None,
        outcome: Optional[str] = None,
        body_part: Optional[str] = None,
        under_pressure: bool = False,
        progressive: Optional[bool] = None,
        additional: Optional[Dict[str, Any]] = None,
        advance_sec: Optional[Tuple[int, int]] = (2, 4)
    ) -> Dict[str, Any]:
        """Creates and records an event matching the exact Hackathon JSON schema."""
        if player is None:
            team_obj = self.get_team_obj(team)
            player = team_obj.active_players[0] if team_obj.active_players else team_obj.starters[0]
        evt = {
            "event_id": self.next_event_id(),
            "minute": int(self.minute),
            "second": int(self.second),
            "type": event_type,
            "subtype": subtype,
            "team": team,
            "player": player.name,
            "player_number": player.number,
            "position": {"x": round(float(position[0]), 1), "y": round(float(position[1]), 1)},
            "end_position": {"x": round(float(end_position[0]), 1), "y": round(float(end_position[1]), 1)} if end_position else None,
            "recipient": recipient,
            "success": success,
            "xG": xg,
            "outcome": outcome,
            "body_part": body_part,
            "under_pressure": under_pressure,
            "progressive": progressive,
            "additional": additional
        }
        extra = self._derive_motion_metrics(event_type, subtype, position, end_position, under_pressure, progressive)
        if extra:
            evt["additional"] = {**(additional or {}), **extra}
        self.events.append(evt)
        if advance_sec:
            self.advance_time(advance_sec[0], advance_sec[1])
        return evt

    def get_team_obj(self, team_str: str) -> Team:
        return self.home_team if team_str == "home" else self.away_team

    def get_opp_team_obj(self, team_str: str) -> Team:
        return self.away_team if team_str == "home" else self.home_team

    def select_player_near(self, team: Team, x: float, y: float, exclude: Optional[Player] = None) -> Player:
        candidates = [p for p in team.active_players if p != exclude]
        if not candidates:
            return team.active_players[0]
        # Tactical safeguard: Goalkeepers cannot participate in outfield actions outside penalty area (x > 22.0)
        if x > 22.0:
            outfield = [p for p in candidates if p.position != "GK"]
            if outfield:
                candidates = outfield
        # Tactical safeguard: Strikers do not defend inside defensive 6-yard box (x < 18.0) unless no defenders
        if x < 18.0:
            defensive = [p for p in candidates if p.position in ["DF", "MF", "GK"]]
            if defensive:
                candidates = defensive
        # Weighted by distance with steep quadratic decay so distant players aren't picked
        weights = []
        for p in candidates:
            d = math.sqrt((p.nominal_x - x) ** 2 + (p.nominal_y - y) ** 2)
            w = max(0.01, (110.0 - min(109.9, d)) ** 2)
            weights.append(w)
        return self.rng.choices(candidates, weights=weights, k=1)[0]

    def execute_kickoff(self, team_str: str):
        t = self.get_team_obj(team_str)
        strikers = [p for p in t.active_players if p.position == "FW"] or t.active_players
        p1 = self.rng.choice(strikers)
        midfielders = [p for p in t.active_players if p.position == "MF"] or t.active_players
        p2 = self.rng.choice(midfielders)

        self.add_event(
            event_type="kickoff",
            subtype=None,
            team=team_str,
            player=p1,
            position=(50.0, 50.0),
            end_position=(48.0, 48.0),
            recipient=p2.name,
            success=True,
            under_pressure=False,
            progressive=False,
            body_part=p1.preferred_foot,
            advance_sec=(2, 3)
        )
        self.possession_team_str = team_str
        self.current_x = 48.0
        self.current_y = 48.0
        self.last_passer = p1

    def execute_substitution(self, team_str: str, player_off_name: str, player_on_name: str, reason: str = "tactical"):
        team = self.get_team_obj(team_str)
        p_off = team.get_player_by_name(player_off_name)
        p_on = team.get_player_by_name(player_on_name)
        if not p_off or not p_on:
            self.advance_time(3, 5)  # never stall the clock on a bad lookup
            return

        # Swap in active squad
        if p_off in team.active_players:
            team.active_players.remove(p_off)
        if p_on not in team.active_players:
            team.active_players.append(p_on)

        self.add_event(
            event_type="substitution",
            subtype="tactical" if reason == "tactical" else "injury",
            team=team_str,
            player=p_on,
            position=(50.0, 0.0),
            recipient=p_off.name,
            success=True,
            additional={
                "sub_off": p_off.name,
                "sub_on": p_on.name,
                "player_off": p_off.name,
                "player_on": p_on.name,
                "reason": reason,
            },
            advance_sec=(3, 5)
        )

    def execute_card(self, team_str: str, player: Player, color: str = "yellow", position: Optional[Tuple[float, float]] = None):
        if color == "yellow":
            # If already booked, 2nd yellow is cautious; 12% chance of 2nd yellow dismissal
            if self.yellow_cards.count(player.name) >= 1:
                if self.rng.random() < 0.12:
                    color = "red"
                else:
                    return  # Referee gives strict final verbal warning
            self.yellow_cards.append(player.name)

        if color == "red":
            team = self.get_team_obj(team_str)
            # Avoid unrealistic multiple sendings-off per team in one match
            team_reds = [c for c in self.red_cards if c in [p.name for p in team.starters + team.substitutes]]
            if len(team_reds) >= 1:
                return
            if player in team.active_players:
                team.active_players.remove(player)
            self.red_cards.append(player.name)

        card_pos = position if position is not None else (self.current_x, self.current_y)
        self.add_event(
            event_type="card",
            subtype=color,
            team=team_str,
            player=player,
            position=card_pos,
            additional={"color": color},
            advance_sec=(2, 4)
        )

    def execute_corner(self, attacking_team_str: str, forced_outcome: Optional[str] = None):
        """Simulate a corner kick set piece."""
        att_team = self.get_team_obj(attacking_team_str)
        opp_team = self.get_opp_team_obj(attacking_team_str)
        opp_team_str = "away" if attacking_team_str == "home" else "home"
        gk = opp_team.get_goalkeeper()

        flag_y = 2.0 if self.current_y < 50.0 else 98.0
        flag_x = 99.0
        taker = self.select_player_near(att_team, flag_x, flag_y)

        target_x = round(float(self.rng.uniform(88.0, 94.0)), 1)
        target_y = round(float(self.rng.uniform(42.0, 58.0)), 1)

        self.add_event(
            event_type="corner",
            subtype="in-swinger" if self.rng.random() < 0.6 else "out-swinger",
            team=attacking_team_str,
            player=taker,
            position=(flag_x, flag_y),
            end_position=(target_x, target_y),
            success=True,
            additional={"assist_type": "corner", "delivery": "aerial"},
            advance_sec=(3, 5)
        )

        self.current_x = target_x
        self.current_y = target_y
        self.last_passer = taker
        self.last_pass_type = "corner"

        attacker = self.select_player_near(att_team, target_x, target_y, exclude=taker)

        if forced_outcome == "goal":
            self.simulate_shot_chance(attacker, attacking_team_str, forced_outcome="goal")
        elif forced_outcome:
            self.simulate_shot_chance(attacker, attacking_team_str, forced_outcome=forced_outcome)
        else:
            if self.rng.random() < 0.45:
                if self.allow_dynamic_goals:
                    outcome = self.rng.choices(["saved", "off_target", "blocked", "goal"], weights=[0.45, 0.35, 0.15, 0.05])[0]
                else:
                    outcome = self.rng.choices(["saved", "off_target", "blocked"], weights=[0.50, 0.35, 0.15])[0]
                self.simulate_shot_chance(attacker, attacking_team_str, forced_outcome=outcome)
            else:
                if self.rng.random() < 0.5:
                    self.add_event(
                        event_type="goalkeeper",
                        subtype="claim",
                        team=opp_team_str,
                        player=gk,
                        position=(4.0, 50.0),
                        success=True,
                        advance_sec=(2, 4)
                    )
                    # Goalkeeper distribution pass (smooth transition)
                    dist_receiver = self.select_player_near(opp_team, 22.0, 50.0, exclude=gk)
                    dist_target_x = round(float(self.rng.uniform(18.0, 26.0)), 1)
                    dist_target_y = round(float(self.rng.uniform(30.0, 70.0)), 1)
                    self.add_event(
                        event_type="pass",
                        subtype="short",
                        team=opp_team_str,
                        player=gk,
                        position=(5.0, 50.0),
                        end_position=(dist_target_x, dist_target_y),
                        recipient=dist_receiver.name if dist_receiver else "Defender",
                        success=True,
                        advance_sec=(2, 3),
                        additional={"action": "goalkeeper_distribution"}
                    )
                    self.possession_team_str = opp_team_str
                    self.current_x = dist_target_x
                    self.current_y = dist_target_y
                else:
                    defender = self.select_player_near(opp_team, 100.0 - target_x, 100.0 - target_y)
                    self.add_event(
                        event_type="clearance",
                        subtype="head",
                        team=opp_team_str,
                        player=defender,
                        position=(100.0 - target_x, 100.0 - target_y),
                        end_position=(min(90.0, 100.0 - target_x + 30.0), 50.0),
                        success=True,
                        advance_sec=(2, 3)
                    )
                    self.possession_team_str = opp_team_str
                    self.current_x = 40.0
                    self.current_y = 50.0

    def execute_penalty(self, attacking_team_str: str, forced_outcome: Optional[str] = None):
        """Simulate a penalty kick."""
        att_team = self.get_team_obj(attacking_team_str)
        opp_team = self.get_opp_team_obj(attacking_team_str)
        opp_team_str = "away" if attacking_team_str == "home" else "home"
        gk = opp_team.get_goalkeeper()

        forwards = [p for p in att_team.active_players if p.position == "FW"]
        taker = forwards[0] if forwards else att_team.active_players[-1]

        if forced_outcome:
            outcome = forced_outcome
        elif self.allow_dynamic_goals:
            outcome = "goal" if self.rng.random() < 0.76 else self.rng.choice(["saved", "off_target", "post"])
        else:
            outcome = self.rng.choice(["saved", "saved", "post", "off_target"])

        is_goal = (outcome == "goal")

        self.add_event(
            event_type="shot",
            subtype="penalty",
            team=attacking_team_str,
            player=taker,
            position=(88.5, 50.0),
            end_position=(100.0, round(float(self.rng.uniform(46.0, 54.0)), 1)) if is_goal else (100.0, round(float(self.rng.uniform(35.0, 65.0)), 1)),
            success=is_goal,
            xg=0.76,
            outcome=outcome,
            body_part=taker.preferred_foot,
            under_pressure=True,
            advance_sec=(4, 7),
            additional={"shot_type": "penalty", "distance_m": 11.0, "shot_zone": "penalty_box"}
        )

        if is_goal:
            if attacking_team_str == "home":
                self.home_score += 1
            else:
                self.away_score += 1
            self.execute_kickoff("away" if attacking_team_str == "home" else "home")
        elif outcome == "saved":
            self.add_event(
                event_type="goalkeeper",
                subtype="penalty_save",
                team=opp_team_str,
                player=gk,
                position=(2.0, 50.0),
                success=True,
                advance_sec=(2, 4)
            )
            # Goalkeeper distribution pass
            dist_receiver = self.select_player_near(opp_team, 22.0, 50.0, exclude=gk)
            dist_target_x = round(float(self.rng.uniform(18.0, 26.0)), 1)
            dist_target_y = round(float(self.rng.uniform(30.0, 70.0)), 1)
            self.add_event(
                event_type="pass",
                subtype="short",
                team=opp_team_str,
                player=gk,
                position=(4.0, 50.0),
                end_position=(dist_target_x, dist_target_y),
                recipient=dist_receiver.name if dist_receiver else "Defender",
                success=True,
                advance_sec=(2, 3),
                additional={"action": "goalkeeper_distribution"}
            )
            self.possession_team_str = opp_team_str
            self.current_x = dist_target_x
            self.current_y = dist_target_y
        else:
            self.possession_team_str = opp_team_str
            self.current_x = 10.0
            self.current_y = 50.0

    def execute_free_kick(self, attacking_team_str: str, x: float, y: float, taker_player: Optional[Player] = None, forced_outcome: Optional[str] = None):
        """Simulate a direct or indirect free kick awarded to the fouled team/player outside the box."""
        self.possession_team_str = attacking_team_str
        self.current_x = x
        self.current_y = y
        att_team = self.get_team_obj(attacking_team_str)
        taker = taker_player if taker_player is not None else self.select_player_near(att_team, x, y)

        if x >= 76.0 and 26.0 <= y <= 74.0:
            if forced_outcome == "goal":
                self.simulate_shot_chance(taker, attacking_team_str, forced_outcome="goal", shot_type="free_kick")
            elif forced_outcome:
                self.simulate_shot_chance(taker, attacking_team_str, forced_outcome=forced_outcome, shot_type="free_kick")
            else:
                if self.rng.random() < 0.40:
                    if self.allow_dynamic_goals:
                        outcome = self.rng.choices(["saved", "blocked", "off_target", "goal"], weights=[0.45, 0.30, 0.20, 0.05])[0]
                    else:
                        outcome = self.rng.choices(["saved", "blocked", "off_target"], weights=[0.50, 0.30, 0.20])[0]
                    self.simulate_shot_chance(taker, attacking_team_str, forced_outcome=outcome, shot_type="free_kick")
                else:
                    target_x = min(96.0, x + 15.0)
                    target_y = round(float(self.rng.uniform(35.0, 65.0)), 1)
                    receiver = self.select_player_near(att_team, target_x, target_y, exclude=taker)
                    self.add_event(
                        event_type="free_kick",
                        subtype="cross",
                        team=attacking_team_str,
                        player=taker,
                        position=(x, y),
                        end_position=(target_x, target_y),
                        recipient=receiver.name,
                        success=True,
                        advance_sec=(3, 5),
                        additional={"set_piece": "free_kick", "assist_type": "free_kick"}
                    )
                    self.possession_team_str = attacking_team_str
                    self.current_x = target_x
                    self.current_y = target_y
                    self.last_passer = taker
                    self.last_pass_type = "cross"
        else:
            target_x = max(10.0, min(90.0, x + float(self.rng.uniform(5.0, 15.0))))
            target_y = max(10.0, min(90.0, y + float(self.rng.uniform(-20.0, 20.0))))
            receiver = self.select_player_near(att_team, target_x, target_y, exclude=taker)
            self.add_event(
                event_type="free_kick",
                subtype="short",
                team=attacking_team_str,
                player=taker,
                position=(x, y),
                end_position=(target_x, target_y),
                recipient=receiver.name,
                success=True,
                advance_sec=(2, 4),
                additional={"set_piece": "free_kick", "delivery": "short_restart"}
            )
            self.possession_team_str = attacking_team_str
            self.current_x = target_x
            self.current_y = target_y
            self.last_passer = taker
            self.last_pass_type = "short"

    # --------------------------------------------------------------------------
    # Natural Possession Phase Generator
    # --------------------------------------------------------------------------
    def play_possession_phase(self, home_possession_prob: float = 0.5):
        """Simulates 3 to 10 events within a continuous football possession sequence."""
        team_str = self.possession_team_str
        team = self.get_team_obj(team_str)
        opp_team = self.get_opp_team_obj(team_str)

        passer = self.select_player_near(team, self.current_x, self.current_y)
        chain_length = self.rng.randint(3, 8)

        for _ in range(chain_length):
            # Opponent pressure chance
            if self.current_x > 35.0 and self.rng.random() < 0.35:
                presser = self.select_player_near(opp_team, 100.0 - self.current_x, 100.0 - self.current_y)
                press_success = self.rng.random() < 0.25
                self.add_event(
                    event_type="pressure",
                    subtype="successful" if press_success else "unsuccessful",
                    team="away" if team_str == "home" else "home",
                    player=presser,
                    position=(round(100.0 - self.current_x + self.rng.uniform(-3, 3), 1),
                              round(100.0 - self.current_y + self.rng.uniform(-3, 3), 1)),
                    success=press_success,
                    under_pressure=False,
                    advance_sec=(1, 2)
                )

            # Check if in shooting position (attacking third)
            if self.current_x >= 78.0 and self.rng.random() < 0.085:  # realistic shot volume (~10-15 per team)
                self.simulate_shot_chance(passer, team_str)
                return

            # Dribble opportunity
            if self.rng.random() < 0.18:
                dribble_success = self.rng.random() < 0.65
                self.add_event(
                    event_type="dribble",
                    subtype="successful" if dribble_success else "failed",
                    team=team_str,
                    player=passer,
                    position=(self.current_x, self.current_y),
                    success=dribble_success,
                    under_pressure=True,
                    advance_sec=(2, 3)
                )
                if not dribble_success:
                    # Turnover via tackle
                    tackler = self.select_player_near(opp_team, 100.0 - self.current_x, 100.0 - self.current_y)
                    self.add_event(
                        event_type="tackle",
                        subtype="won",
                        team="away" if team_str == "home" else "home",
                        player=tackler,
                        position=(100.0 - self.current_x, 100.0 - self.current_y),
                        success=True,
                        advance_sec=(2, 3)
                    )
                    self.possession_team_str = "away" if team_str == "home" else "home"
                    self.current_x = 100.0 - self.current_x
                    self.current_y = 100.0 - self.current_y
                    return
                else:
                    self.current_x = min(92.0, self.current_x + self.rng.uniform(4, 9))

            # Decide Pass Parameters
            is_progressive = False
            pass_success = self.rng.random() < 0.84

            # Pass direction
            if self.current_x < 40:
                target_x = self.current_x + self.rng.uniform(8, 22)
                pass_subtype = self.rng.choice(["short", "short", "long"])
            elif self.current_x < 70:
                target_x = self.current_x + self.rng.uniform(-5, 18)
                pass_subtype = self.rng.choice(["short", "short", "through_ball", "long"])
            else:
                target_x = min(96.0, self.current_x + self.rng.uniform(2, 14))
                pass_subtype = self.rng.choice(["short", "cross" if abs(self.current_y - 50) > 20 else "short", "through_ball"])

            target_y = min(95.0, max(5.0, self.current_y + self.rng.uniform(-25, 25)))

            if target_x - self.current_x >= 15.0 or (target_x >= 83.0 and target_x - self.current_x >= 10.0):
                is_progressive = True

            receiver = self.select_player_near(team, target_x, target_y, exclude=passer)

            self.add_event(
                event_type="pass",
                subtype=pass_subtype,
                team=team_str,
                player=passer,
                position=(self.current_x, self.current_y),
                end_position=(target_x, target_y),
                recipient=receiver.name if pass_success else None,
                success=pass_success,
                progressive=is_progressive,
                body_part=passer.preferred_foot,
                under_pressure=self.rng.random() < 0.35,
                advance_sec=(2, 4)
            )

            if pass_success:
                self.last_passer = passer
                self.last_pass_type = pass_subtype
                passer = receiver
                self.current_x = target_x
                self.current_y = target_y
            else:
                # Turnover handling
                self.handle_turnover(team_str, target_x, target_y)
                return

        # End of sequence naturally rotates or maintains possession via physical defensive action
        keep_prob = home_possession_prob if team_str == "home" else (1.0 - home_possession_prob)
        if self.rng.random() > keep_prob:
            self.handle_turnover(team_str, self.current_x, self.current_y)

    def handle_turnover(self, losing_team_str: str, x: float, y: float):
        opp_team_str = "away" if losing_team_str == "home" else "home"
        opp_team = self.get_opp_team_obj(losing_team_str)
        opp_x = max(5.0, min(95.0, 100.0 - x))
        opp_y = max(5.0, min(95.0, 100.0 - y))

        turnover_action = self.rng.choices(
            ["interception", "ball_recovery", "tackle", "clearance", "foul"],
            weights=[0.33, 0.31, 0.20, 0.07, 0.09],
            k=1
        )[0]

        if turnover_action == "interception":
            defender = self.select_player_near(opp_team, opp_x, opp_y)
            self.add_event(
                event_type="interception",
                subtype=None,
                team=opp_team_str,
                player=defender,
                position=(opp_x, opp_y),
                success=True,
                advance_sec=(1, 2)
            )
            self.possession_team_str = opp_team_str
            self.current_x = opp_x
            self.current_y = opp_y

        elif turnover_action == "clearance":
            defender = self.select_player_near(opp_team, opp_x, opp_y)
            self.add_event(
                event_type="clearance",
                subtype=None,
                team=opp_team_str,
                player=defender,
                position=(opp_x, opp_y),
                end_position=(min(90.0, opp_x + 35.0), max(10.0, min(90.0, opp_y + self.rng.uniform(-20, 20)))),
                success=True,
                advance_sec=(2, 3)
            )
            self.possession_team_str = losing_team_str
            self.current_x = max(15.0, x - 35.0)
            self.current_y = y

        elif turnover_action == "foul":
            foul_by_attacker = self.rng.random() < 0.28
            foul_team_str = losing_team_str if foul_by_attacker else opp_team_str
            won_team_str = opp_team_str if foul_by_attacker else losing_team_str
            foul_team = self.get_team_obj(foul_team_str)
            won_team = self.get_team_obj(won_team_str)

            # For scripted storyline matches, keep spontaneous turnover fouls in open field (x <= 82.0)
            # so that scripted penalty moments (e.g. min 74) remain the primary penalty storyline
            effective_x = min(82.0, x) if not self.allow_dynamic_goals else x
            effective_opp_x = 100.0 - effective_x

            foul_spot_x = effective_x if foul_by_attacker else effective_opp_x
            foul_spot_y = y if foul_by_attacker else opp_y
            fouler = self.select_player_near(foul_team, foul_spot_x, foul_spot_y)

            # Identify the specific player who was fouled
            fouled_spot_x = effective_opp_x if foul_by_attacker else effective_x
            fouled_spot_y = opp_y if foul_by_attacker else y
            fouled_player = self.select_player_near(won_team, fouled_spot_x, fouled_spot_y)

            # Check if penalty:
            # When defender (opp_team_str) fouls attacker (losing_team_str) inside defending penalty box (x >= 83.5, 21.0 <= y <= 79.0)
            is_penalty = (not foul_by_attacker) and (effective_x >= 83.5 and 21.0 <= y <= 79.0)

            # High likelihood (75%) of a yellow card for reckless foul/tackle inside the penalty box
            card_color = None
            if is_penalty:
                card_color = "yellow" if self.rng.random() < 0.75 else None
            elif self.rng.random() < 0.22:
                card_color = "yellow"

            self.add_event(
                event_type="foul",
                subtype="penalty" if is_penalty else "committed",
                team=foul_team_str,
                player=fouler,
                position=(foul_spot_x, foul_spot_y),
                success=False,
                advance_sec=(2, 4),
                additional={
                    "is_penalty": is_penalty,
                    "foul_zone": "penalty_box" if is_penalty else "open_field",
                    "fouled_player": fouled_player.name,
                }
            )

            if card_color:
                self.execute_card(foul_team_str, fouler, color=card_color, position=(foul_spot_x, foul_spot_y))

            if is_penalty:
                self.execute_penalty(won_team_str)
            else:
                # Outside the 18-yard box: award free kick to the fouled team & fouled player
                self.execute_free_kick(won_team_str, fouled_spot_x, fouled_spot_y, taker_player=fouled_player)

        else:  # ball_recovery / tackle
            defender = self.select_player_near(opp_team, opp_x, opp_y)
            self.add_event(
                event_type="ball_recovery",
                subtype=None,
                team=opp_team_str,
                player=defender,
                position=(opp_x, opp_y),
                success=True,
                advance_sec=(1, 3)
            )
            self.possession_team_str = opp_team_str
            self.current_x = opp_x
            self.current_y = opp_y

    def simulate_shot_chance(self, shooter: Player, team_str: str, forced_outcome: Optional[str] = None, shot_type: Optional[str] = None):
        """Generates a realistic shot event and immediate outcome."""
        opp_team_str = "away" if team_str == "home" else "home"
        opp_team = self.get_opp_team_obj(team_str)
        gk = opp_team.get_goalkeeper()

        if shot_type == "free_kick":
            shot_x = self.current_x
            shot_y = self.current_y
            body_part = shooter.preferred_foot
            is_pressure = False
            shot_subtype = "free_kick"
            shot_zone = "outside_box"
            xg = calculate_xg(
                x=shot_x,
                y=shot_y,
                body_part=body_part,
                assist_type=None,
                is_under_pressure=False,
                shot_type="free_kick"
            )
        else:
            shot_x = min(96.0, max(75.0, self.current_x))
            shot_y = min(80.0, max(20.0, self.current_y))
            body_part = "head" if self.last_pass_type == "cross" and self.rng.random() < 0.6 else shooter.preferred_foot
            is_pressure = self.rng.random() < 0.55

            xg = calculate_xg(
                x=shot_x,
                y=shot_y,
                body_part=body_part,
                assist_type=self.last_pass_type if self.last_pass_type in ["through_ball", "cross", "corner"] else None,
                is_under_pressure=is_pressure,
                shot_type="header" if body_part == "head" else "open_play"
            )

        if forced_outcome:
            outcome = forced_outcome
        elif self.allow_dynamic_goals:
            g_prob = min(0.60, max(0.04, xg * 1.30))
            rem = 1.0 - g_prob
            outcome = self.rng.choices(
                ["saved", "blocked", "off_target", "goal", "post"],
                weights=[rem * 0.46, rem * 0.30, rem * 0.21, g_prob, rem * 0.03],
                k=1
            )[0]
        else:
            outcome = self.rng.choices(
                ["saved", "blocked", "off_target", "goal", "post"],
                weights=[0.47, 0.29, 0.21, 0.00, 0.03],  # no random goals: scores come from the scripted storyline
                k=1
            )[0]

        is_goal = (outcome == "goal")

        # Determine granular shot subtype and zone
        if shot_type != "free_kick":
            if shot_x < 84.0:
                shot_subtype = "long_range"
                shot_zone = "outside_box"
            elif shot_x >= 94.0:
                shot_subtype = "tap_in"
                shot_zone = "six_yard_box"
            elif body_part == "head":
                shot_subtype = "header"
                shot_zone = "inside_box"
            elif self.last_pass_type == "cross":
                shot_subtype = "tap_in"
                shot_zone = "inside_box"
            else:
                shot_subtype = "open_play"
                shot_zone = "inside_box"

        shot_dist_m = round((100.0 - shot_x) * 1.05, 1)

        self.add_event(
            event_type="shot",
            subtype=shot_subtype,
            team=team_str,
            player=shooter,
            position=(shot_x, shot_y),
            end_position=(100.0, round(float(self.rng.uniform(46.0, 54.0)), 1)) if outcome in ["goal", "saved", "post"] else (100.0, round(float(self.rng.uniform(35.0, 65.0)), 1)),
            success=is_goal,
            xg=xg,
            outcome=outcome,
            body_part=body_part,
            under_pressure=is_pressure,
            advance_sec=(2, 4),
            additional={
                "shot_zone": shot_zone,
                "distance_m": shot_dist_m,
                "assist_type": self.last_pass_type if self.last_pass_type in ["through_ball", "cross", "corner", "free_kick"] else None,
                "set_piece": "direct_free_kick" if shot_subtype == "free_kick" else None,
            }
        )

        if outcome == "goal":
            if team_str == "home":
                self.home_score += 1
            else:
                self.away_score += 1
            self.execute_kickoff("away" if team_str == "home" else "home")

        elif outcome == "saved":
            # 40% of saves are tipped wide/over for a CORNER KICK
            if self.rng.random() < 0.40:
                self.add_event(
                    event_type="goalkeeper",
                    subtype="save_tip_wide",
                    team=opp_team_str,
                    player=gk,
                    position=(3.0, 50.0),
                    success=True,
                    advance_sec=(2, 3)
                )
                self.execute_corner(team_str)
                return

            save_type = self.rng.choice(["save", "save", "punch", "claim"])
            self.add_event(
                event_type="goalkeeper",
                subtype=save_type,
                team=opp_team_str,
                player=gk,
                position=(3.0, 50.0),
                success=True,
                advance_sec=(2, 4)
            )
            # Goalkeeper distributes ball smoothly out of defensive third (no teleportation)
            dist_receiver = self.select_player_near(opp_team, 22.0, 50.0, exclude=gk)
            dist_target_x = round(float(self.rng.uniform(18.0, 26.0)), 1)
            dist_target_y = round(float(self.rng.uniform(30.0, 70.0)), 1)
            self.add_event(
                event_type="pass",
                subtype="short",
                team=opp_team_str,
                player=gk,
                position=(4.0, 50.0),
                end_position=(dist_target_x, dist_target_y),
                recipient=dist_receiver.name if dist_receiver else "Defender",
                success=True,
                advance_sec=(2, 3),
                additional={"action": "goalkeeper_distribution"}
            )
            self.possession_team_str = opp_team_str
            self.current_x = dist_target_x
            self.current_y = dist_target_y

        elif outcome == "blocked":
            blocker = self.select_player_near(opp_team, 100.0 - shot_x, 100.0 - shot_y)
            # 35% of blocked shots deflect behind for a CORNER KICK
            if self.rng.random() < 0.35:
                self.add_event(
                    event_type="block",
                    subtype="deflection",
                    team=opp_team_str,
                    player=blocker,
                    position=(100.0 - shot_x, 100.0 - shot_y),
                    success=True,
                    advance_sec=(1, 2)
                )
                self.execute_corner(team_str)
                return

            self.add_event(
                event_type="clearance",
                subtype=None,
                team=opp_team_str,
                player=blocker,
                position=(100.0 - shot_x, 100.0 - shot_y),
                success=True,
                advance_sec=(2, 3)
            )
            self.possession_team_str = opp_team_str
            self.current_x = 25.0
            self.current_y = 50.0

        else:  # off_target or post
            self.possession_team_str = opp_team_str
            cb = self.select_player_near(opp_team, 18.0, 32.0, exclude=gk)
            self.add_event(
                event_type="goal_kick",
                subtype="short",
                team=opp_team_str,
                player=gk,
                position=(6.0, 50.0),
                end_position=(18.0, 32.0),
                recipient=cb.name,
                success=True,
                advance_sec=(3, 5)
            )
            self.current_x = 18.0
            self.current_y = 32.0
            self.last_passer = gk


# ==============================================================================
# Match Narrative Builders
# ==============================================================================

def create_match_001_comeback() -> Dict[str, Any]:
    """
    Match 001: 'The Great Comeback'
    Synthetic City FC trails 0-2 at half-time, then scores 3 goals in the second half to win 3-2.
    Features: early defensive errors, tactical half-time change (4-2-3-1 -> 3-4-3), momentum shift, late winner.
    """
    home_starters = [
        Player("M. Al-Mansoor", 1, "GK", "GK", 5.0, 50.0),
        Player("C. D'Angelo", 2, "DF", "RB", 25.0, 15.0),
        Player("S. Halvorsen", 4, "DF", "CB", 20.0, 38.0),
        Player("D. Vance", 5, "DF", "CB", 20.0, 62.0),
        Player("R. Tanaka", 3, "DF", "LB", 25.0, 85.0, preferred_foot="left_foot"),
        Player("J. Thorne", 6, "MF", "DM", 42.0, 35.0),
        Player("E. Lindberg", 8, "MF", "CM", 45.0, 65.0),
        Player("K. Varga", 10, "MF", "CAM", 65.0, 50.0),
        Player("T. Moreau", 7, "FW", "RW", 72.0, 18.0),
        Player("N. Achebe", 11, "FW", "LW", 72.0, 82.0, preferred_foot="left_foot"),
        Player("M. Belotti", 9, "FW", "ST", 82.0, 50.0),
    ]
    home_subs = [
        Player("O. Sissoko", 14, "FW", "ST", 80.0, 50.0, is_starter=False),
        Player("F. Mercer", 18, "DF", "CB", 20.0, 50.0, is_starter=False),
        Player("A. Zivkovic", 21, "MF", "CM", 50.0, 50.0, is_starter=False),
    ]
    home = Team("Synthetic City FC", "4-2-3-1", home_starters, home_subs, team_type="home")

    away_starters = [
        Player("L. Kincaid", 13, "GK", "GK", 5.0, 50.0),
        Player("H. Brauer", 2, "DF", "RB", 25.0, 15.0),
        Player("V. Petrov", 3, "DF", "CB", 20.0, 38.0),
        Player("P. Gallagher", 15, "DF", "CB", 20.0, 62.0),
        Player("S. O'Connor", 16, "DF", "LB", 25.0, 85.0, preferred_foot="left_foot"),
        Player("A. Sorenson", 4, "MF", "DM", 40.0, 50.0),
        Player("G. Castille", 8, "MF", "CM", 50.0, 32.0),
        Player("M. El-Sayed", 10, "MF", "CM", 52.0, 68.0),
        Player("D. Ristic", 7, "FW", "RW", 72.0, 18.0),
        Player("J. Calderon", 9, "FW", "ST", 82.0, 50.0),
        Player("B. Nygard", 11, "FW", "LW", 72.0, 82.0, preferred_foot="left_foot"),
    ]
    away_subs = [
        Player("K. Okonjo", 19, "FW", "ST", 80.0, 50.0, is_starter=False),
        Player("C. Dupuis", 22, "MF", "CM", 48.0, 50.0, is_starter=False),
        Player("T. Hakala", 25, "DF", "CB", 20.0, 50.0, is_starter=False),
    ]
    away = Team("Metro Stars FC", "4-3-3", away_starters, away_subs, team_type="away")

    sim = FootballMatchGenerator("match_001_comeback", home, away, seed=101)

    # First Half Kickoff
    sim.minute = 0
    sim.second = 0
    sim.execute_kickoff("home")

    km1_done = False
    km2_done = False
    # Target: ~1560 total events (~750 in 1st half, ~810 in 2nd half)
    while sim.minute < 45:
        # Key Moment 1 (Min 14): Horrible defensive blunder by Home CB Halvorsen -> Calderon Goal (0-1)
        if sim.minute >= 14 and not km1_done:
            km1_done = True
            sim.minute = 14
            sim.second = 10
            cb = home.get_player_by_name("S. Halvorsen")
            st = away.get_player_by_name("J. Calderon")
            gk = home.get_goalkeeper()
            # Pressured backpass error
            sim.add_event("pressure", "successful", "away", st, (22.0, 42.0), success=True, advance_sec=(1, 2))
            sim.add_event("pass", "short", "home", cb, (18.0, 40.0), end_position=(12.0, 48.0), recipient=None,
                          success=False, under_pressure=True, progressive=False, advance_sec=(1, 2))
            sim.add_event("interception", None, "away", st, (88.0, 52.0), success=True, advance_sec=(1, 2))
            sim.add_event("dribble", "successful", "away", st, (91.0, 52.0), success=True, under_pressure=True, advance_sec=(1, 2))
            xg_val = calculate_xg(93.0, 50.0, body_part="right_foot", is_under_pressure=False)
            sim.add_event("shot", "open_play", "away", st, (93.0, 50.0), end_position=(100.0, 51.0),
                          success=True, xg=xg_val, outcome="goal", body_part="right_foot", advance_sec=(3, 5),
                          additional={"shot_zone": "inside_box", "distance_m": 7.4})
            sim.away_score = 1
            sim.execute_kickoff("home")
            continue

        # Key Moment 2 (Min 36): Away corner cleared to edge of box -> Castille stunner from outside the box (0-2)
        if sim.minute >= 36 and not km2_done:
            km2_done = True
            sim.minute = 36
            sim.second = 15
            winger = away.get_player_by_name("D. Ristic")
            cm = away.get_player_by_name("G. Castille")
            cb = home.get_player_by_name("S. Halvorsen")
            # Corner kick
            sim.add_event("pass", "corner", "away", winger, (100.0, 98.0), end_position=(92.0, 52.0),
                          recipient=None, success=True, advance_sec=(2, 3))
            sim.add_event("clearance", None, "home", cb, (12.0, 48.0), end_position=(26.0, 45.0),
                          success=True, advance_sec=(2, 3))
            # Castille collects on edge of box (x=76 for away attacking)
            sim.add_event("ball_recovery", None, "away", cm, (76.0, 46.0), success=True, advance_sec=(1, 2))
            xg_val = calculate_xg(77.0, 46.0, body_part="right_foot", is_first_time=True, is_under_pressure=False)
            sim.add_event("shot", "long_range", "away", cm, (77.0, 46.0), end_position=(100.0, 53.0),
                          success=True, xg=xg_val, outcome="goal", body_part="right_foot", advance_sec=(3, 5),
                          additional={"shot_zone": "outside_box", "distance_m": 24.2, "shot_type": "long_range_strike"})
            sim.away_score = 2
            sim.execute_kickoff("home")
            continue

        sim.play_possession_phase(home_possession_prob=0.48)

    # Half Time
    sim.add_event("half_time", None, "home", home.starters[0], (50.0, 50.0), advance_sec=(0, 0))

    # Key Moment 3 (Half-Time Tactical Shift): Synthetic City switches 4-2-3-1 -> 3-4-3, Vance OFF, Sissoko ON!
    sim.minute = 45
    sim.second = 0
    sim.execute_substitution("home", "D. Vance", "O. Sissoko", reason="tactical")
    home.formation = "3-4-3"

    # Second Half Kickoff
    sim.execute_kickoff("away")

    # Second half loop
    km4_done = False
    km5_done = False
    km6_done = False
    km7_done = False
    while sim.minute < 94:
        # Key Moment 4 (Min 53): Belotti towering header from Achebe cross (1-2)
        if sim.minute >= 53 and not km4_done:
            km4_done = True
            sim.minute = 53
            sim.second = 20
            lw = home.get_player_by_name("N. Achebe")
            st = home.get_player_by_name("M. Belotti")
            sim.add_event("dribble", "successful", "home", lw, (82.0, 84.0), success=True, advance_sec=(2, 3))
            sim.add_event("pass", "cross", "home", lw, (84.0, 82.0), end_position=(93.0, 51.0),
                          recipient=st.name, success=True, progressive=True, advance_sec=(2, 3), additional={"delivery": "whipped_aerial"})
            sim.add_event("aerial_duel", "won", "home", st, (93.0, 51.0), success=True, advance_sec=(1, 2))
            xg_val = calculate_xg(93.0, 51.0, body_part="head", assist_type="cross", is_under_pressure=True, shot_type="header")
            sim.add_event("shot", "header", "home", st, (93.0, 51.0), end_position=(100.0, 52.0),
                          success=True, xg=xg_val, outcome="goal", body_part="head", under_pressure=True, advance_sec=(3, 5),
                          additional={"shot_zone": "inside_box", "distance_m": 7.4, "assist_type": "cross"})
            sim.home_score = 1
            sim.execute_kickoff("away")
            continue

        # Key Moment 5 (Min 72): High turnover -> Varga through-ball -> Moreau clinical finish (2-2)
        if sim.minute >= 72 and not km5_done:
            km5_done = True
            sim.minute = 72
            sim.second = 10
            dm = home.get_player_by_name("J. Thorne")
            cam = home.get_player_by_name("K. Varga")
            rw = home.get_player_by_name("T. Moreau")
            # Aggressive tackle & through ball
            sim.add_event("tackle", "won", "home", dm, (62.0, 45.0), success=True, advance_sec=(1, 2))
            sim.add_event("pass", "short", "home", dm, (62.0, 45.0), end_position=(68.0, 48.0),
                          recipient=cam.name, success=True, progressive=False, advance_sec=(1, 2))
            sim.add_event("pass", "through_ball", "home", cam, (68.0, 48.0), end_position=(88.0, 35.0),
                          recipient=rw.name, success=True, progressive=True, under_pressure=True, advance_sec=(2, 3))
            xg_val = calculate_xg(88.0, 35.0, body_part="right_foot", assist_type="through_ball", is_under_pressure=False)
            sim.add_event("shot", "open_play", "home", rw, (88.0, 35.0), end_position=(100.0, 48.0),
                          success=True, xg=xg_val, outcome="goal", body_part="right_foot", advance_sec=(3, 5),
                          additional={"shot_zone": "inside_box", "distance_m": 12.6, "assist_type": "through_ball"})
            sim.home_score = 2
            sim.execute_kickoff("away")
            continue

        # Key Moment 6 (Min 81): Massive 1v1 save by Al-Mansoor denying Ristic
        if sim.minute >= 81 and not km6_done:
            km6_done = True
            sim.minute = 81
            sim.second = 15
            away_rw = away.get_player_by_name("D. Ristic")
            gk = home.get_goalkeeper()
            sim.add_event("dribble", "successful", "away", away_rw, (86.0, 38.0), success=True, advance_sec=(2, 3))
            xg_val = calculate_xg(89.0, 44.0, body_part="right_foot", is_under_pressure=False)
            sim.add_event("shot", "open_play", "away", away_rw, (89.0, 44.0), end_position=(100.0, 49.0),
                          success=False, xg=xg_val, outcome="saved", body_part="right_foot", advance_sec=(2, 3))
            sim.add_event("goalkeeper", "save", "home", gk, (4.0, 50.0), success=True, advance_sec=(2, 4))
            dist_def = home.get_player_by_name("C. D'Angelo") or home.starters[1]
            sim.add_event("pass", "short", "home", gk, (5.0, 50.0), end_position=(22.0, 20.0),
                          recipient=dist_def.name, success=True, advance_sec=(2, 3), additional={"action": "goalkeeper_distribution"})
            sim.possession_team_str = "home"
            sim.current_x = 22.0
            sim.current_y = 20.0
            continue

        # Key Moment 7 (Min 89): Dramatic 89th min winner! Sissoko corner scramble (3-2)
        if sim.minute >= 89 and not km7_done:
            km7_done = True
            sim.minute = 89
            sim.second = 25
            varga = home.get_player_by_name("K. Varga")
            sissoko = home.get_player_by_name("O. Sissoko")
            halvorsen = home.get_player_by_name("S. Halvorsen")
            # 89th min corner
            sim.add_event("pass", "corner", "home", varga, (100.0, 2.0), end_position=(94.0, 48.0),
                          recipient=halvorsen.name, success=True, advance_sec=(2, 3))
            sim.add_event("aerial_duel", "won", "home", halvorsen, (94.0, 48.0), success=True, advance_sec=(1, 2))
            sim.add_event("pass", "short", "home", halvorsen, (94.0, 48.0), end_position=(96.0, 52.0),
                          recipient=sissoko.name, success=True, advance_sec=(1, 2))
            xg_val = calculate_xg(96.0, 52.0, body_part="right_foot", assist_type="corner", is_under_pressure=True)
            sim.add_event("shot", "tap_in", "home", sissoko, (96.0, 52.0), end_position=(100.0, 51.0),
                          success=True, xg=xg_val, outcome="goal", body_part="right_foot", under_pressure=True, advance_sec=(4, 6),
                          additional={"shot_zone": "six_yard_box", "distance_m": 4.2, "assist_type": "corner"})
            sim.home_score = 3
            sim.execute_kickoff("away")
            continue

        # Second half Synthetic City dominant momentum (62% possession)
        sim.play_possession_phase(home_possession_prob=0.62)

    # Full Time
    sim.minute = 94
    sim.second = 30
    sim.add_event("full_time", None, "home", home.starters[0], (50.0, 50.0), advance_sec=(0, 0))

    return {
        "match_id": "match_001_comeback",
        "home_team": home.name,
        "away_team": away.name,
        "home_formation": home.formation,
        "away_formation": away.formation,
        "events": sim.events
    }


def create_match_002_dominance() -> Dict[str, Any]:
    """
    Match 002: 'Total Domination'
    Thunderstrike United dominates from start to finish, winning 4-0 against Aegis Port FC.
    Features: high pressing, total possession control (~70%), multiple high-xG chances, clean sheet.
    """
    home_starters = [
        Player("C. Vane", 1, "GK", "GK", 5.0, 50.0),
        Player("A. Van Der Beek", 2, "DF", "RB", 32.0, 15.0),
        Player("K. Demir", 4, "DF", "CB", 28.0, 38.0),
        Player("N. Skov", 5, "DF", "CB", 28.0, 62.0),
        Player("M. Benali", 3, "DF", "LB", 32.0, 85.0, preferred_foot="left_foot"),
        Player("T. Althaus", 6, "MF", "DM", 50.0, 50.0),
        Player("R. Callahan", 8, "MF", "CM", 60.0, 32.0),
        Player("Z. Hristov", 10, "MF", "CM", 62.0, 68.0),
        Player("L. Vance", 7, "FW", "RW", 76.0, 15.0),
        Player("E. Adetunji", 9, "FW", "ST", 84.0, 50.0),
        Player("K. Miyazawa", 11, "FW", "LW", 76.0, 85.0, preferred_foot="left_foot"),
    ]
    home_subs = [
        Player("S. Fontana", 17, "MF", "CM", 58.0, 50.0, is_starter=False),
        Player("G. Larsson", 20, "FW", "ST", 82.0, 50.0, is_starter=False),
        Player("R. Dubois", 14, "DF", "CB", 26.0, 50.0, is_starter=False),
    ]
    home = Team("Thunderstrike United", "4-3-3", home_starters, home_subs, team_type="home")

    away_starters = [
        Player("D. Kovacevic", 23, "GK", "GK", 5.0, 50.0),
        Player("P. Lindqvist", 2, "DF", "RWB", 20.0, 12.0),
        Player("B. Geller", 4, "DF", "CB", 16.0, 30.0),
        Player("E. Rostami", 5, "DF", "CB", 15.0, 50.0),
        Player("I. Varga", 6, "DF", "CB", 16.0, 70.0),
        Player("N. Tadic", 3, "DF", "LWB", 20.0, 88.0, preferred_foot="left_foot"),
        Player("K. O'Leary", 7, "MF", "RM", 38.0, 20.0),
        Player("M. Balic", 8, "MF", "CM", 35.0, 40.0),
        Player("S. Jansen", 10, "MF", "CM", 35.0, 60.0),
        Player("L. Peeters", 11, "MF", "LM", 38.0, 80.0, preferred_foot="left_foot"),
        Player("A. Solbakken", 9, "FW", "ST", 60.0, 50.0),
    ]
    away_subs = [
        Player("H. Nyberg", 14, "DF", "CB", 16.0, 50.0, is_starter=False),
        Player("T. Ruan", 18, "MF", "CM", 36.0, 50.0, is_starter=False),
        Player("F. Cruz", 21, "FW", "ST", 62.0, 50.0, is_starter=False),
    ]
    away = Team("Aegis Port FC", "5-4-1", away_starters, away_subs, team_type="away")

    sim = FootballMatchGenerator("match_002_dominance", home, away, seed=202)

    sim.minute = 0
    sim.second = 0
    sim.execute_kickoff("home")

    km1_done = False
    km2_done = False
    km3_done = False
    while sim.minute < 45:
        # Key Moment 1 (Min 11): High pressing turnover -> Whipped cross -> Adetunji tap-in (1-0)
        if sim.minute >= 11 and not km1_done:
            km1_done = True
            sim.minute = 11
            sim.second = 10
            cb_opp = away.get_player_by_name("E. Rostami")
            adetunji = home.get_player_by_name("E. Adetunji")
            vance = home.get_player_by_name("L. Vance")
            sim.add_event("pressure", "successful", "home", adetunji, (78.0, 48.0), success=True, advance_sec=(1, 2))
            sim.add_event("pass", "short", "away", cb_opp, (22.0, 52.0), end_position=(28.0, 40.0), recipient=None,
                          success=False, under_pressure=True, advance_sec=(1, 2))
            sim.add_event("interception", None, "home", vance, (75.0, 22.0), success=True, advance_sec=(1, 2))
            sim.add_event("dribble", "successful", "home", vance, (75.0, 22.0), end_position=(87.0, 18.0), success=True, advance_sec=(2, 3))
            # Whipped cross across 6-yard box
            sim.add_event("pass", "cross", "home", vance, (87.0, 18.0), end_position=(96.0, 50.0),
                          recipient=adetunji.name, success=True, progressive=True, advance_sec=(2, 3), additional={"delivery": "whipped_low"})
            xg_val = calculate_xg(96.0, 50.0, body_part="right_foot", assist_type="cross", is_first_time=True)
            sim.add_event("shot", "tap_in", "home", adetunji, (96.0, 50.0), end_position=(100.0, 49.0),
                          success=True, xg=xg_val, outcome="goal", body_part="right_foot", advance_sec=(3, 5),
                          additional={"shot_zone": "six_yard_box", "distance_m": 4.2, "assist_type": "cross"})
            sim.home_score = 1
            sim.execute_kickoff("away")
            continue

        # Key Moment 2 (Min 28): Cynical foul at 24m -> Sublime direct free kick goal curled by Miyazawa! (2-0)
        if sim.minute >= 28 and not km2_done:
            km2_done = True
            sim.minute = 28
            sim.second = 5
            rw = home.get_player_by_name("L. Vance")
            miyazawa = home.get_player_by_name("K. Miyazawa")
            defender = away.get_player_by_name("M. Balic")
            sim.add_event("dribble", "successful", "home", rw, (76.0, 38.0), success=True, advance_sec=(2, 3))
            sim.add_event("foul", "committed", "away", defender, (24.0, 62.0), success=False, advance_sec=(2, 3))
            sim.execute_card("away", defender, "yellow")
            # Direct free kick curled from 24 yards outside the penalty box
            xg_fk = calculate_xg(77.0, 42.0, shot_type="free_kick", body_part="left_foot")
            sim.add_event("shot", "free_kick", "home", miyazawa, (77.0, 42.0), end_position=(100.0, 53.0),
                          success=True, xg=xg_fk, outcome="goal", body_part="left_foot", advance_sec=(3, 5),
                          additional={"shot_zone": "outside_box", "distance_m": 24.1, "shot_type": "direct_free_kick"})
            sim.home_score = 2
            sim.execute_kickoff("away")
            continue

        # Key Moment 3 (Min 43): Sweeper keeper C. Vane snuffs out rare Aegis counter 35m out
        if sim.minute >= 43 and not km3_done:
            km3_done = True
            sim.minute = 43
            sim.second = 15
            solbakken = away.get_player_by_name("A. Solbakken")
            vane = home.get_goalkeeper()
            sim.add_event("pass", "long", "away", away.get_player_by_name("S. Jansen"), (30.0, 55.0),
                          end_position=(68.0, 50.0), recipient=solbakken.name, success=True, progressive=True, advance_sec=(2, 3))
            sim.add_event("goalkeeper", "sweep", "home", vane, (35.0, 50.0), success=True, advance_sec=(2, 3))
            sim.add_event("clearance", None, "home", vane, (35.0, 50.0), end_position=(65.0, 20.0), success=True, advance_sec=(2, 3))
            sim.possession_team_str = "home"
            sim.current_x = 65.0
            sim.current_y = 20.0
            continue

        # Thunderstrike possesses ~70% of time
        sim.play_possession_phase(home_possession_prob=0.72)

    # Half Time
    sim.add_event("half_time", None, "home", home.starters[0], (50.0, 50.0), advance_sec=(0, 0))

    # Second Half Kickoff
    sim.minute = 45
    sim.second = 0
    sim.execute_kickoff("away")

    km4_done = False
    km5_done = False
    km6_done = False
    km7_done = False
    while sim.minute < 94:
        # Key Moment 4 (Min 61): Recycled corner -> Callahan screamer from 22m (3-0)
        if sim.minute >= 61 and not km4_done:
            km4_done = True
            sim.minute = 61
            sim.second = 15
            callahan = home.get_player_by_name("R. Callahan")
            miyazawa = home.get_player_by_name("K. Miyazawa")
            sim.add_event("pass", "corner", "home", miyazawa, (100.0, 98.0), end_position=(88.0, 52.0),
                          recipient=None, success=True, advance_sec=(2, 3))
            sim.add_event("clearance", None, "away", away.get_player_by_name("B. Geller"), (12.0, 48.0),
                          end_position=(25.0, 35.0), success=True, advance_sec=(2, 3))
            sim.add_event("ball_recovery", None, "home", callahan, (75.0, 65.0), success=True, advance_sec=(1, 2))
            xg_val = calculate_xg(75.0, 62.0, body_part="right_foot", is_under_pressure=False)
            sim.add_event("shot", "long_range", "home", callahan, (75.0, 62.0), end_position=(100.0, 53.0),
                          success=True, xg=xg_val, outcome="goal", body_part="right_foot", advance_sec=(3, 5),
                          additional={"shot_zone": "outside_box", "distance_m": 26.3, "shot_type": "long_range_strike"})
            sim.home_score = 3
            sim.execute_kickoff("away")
            continue

        # Key Moment 5 (Min 65): Tactical triple substitution showing squad depth
        if sim.minute >= 65 and not km5_done:
            km5_done = True
            sim.execute_substitution("home", "T. Althaus", "S. Fontana", reason="tactical")
            sim.execute_substitution("home", "E. Adetunji", "G. Larsson", reason="tactical")
            continue

        # Key Moment 6 (Min 74): Vance jinking dribble -> Penalty awarded & converted by Larsson (4-0)
        if sim.minute >= 74 and not km6_done:
            km6_done = True
            sim.minute = 74
            sim.second = 10
            vance = home.get_player_by_name("L. Vance")
            larsson = home.get_player_by_name("G. Larsson")
            defender = away.get_player_by_name("N. Tadic")
            rb = home.get_player_by_name("A. Van Der Beek")
            sim.add_event("pass", "long", "home", rb, (35.0, 20.0), end_position=(75.0, 22.0),
                          recipient=vance.name, success=True, progressive=True, advance_sec=(2, 3))
            sim.add_event("dribble", "successful", "home", vance, (75.0, 22.0), end_position=(88.0, 25.0), success=True, advance_sec=(2, 3))
            sim.add_event("tackle", "lost", "away", defender, (12.0, 75.0), success=False, advance_sec=(1, 2))
            sim.add_event("foul", "penalty", "away", defender, (12.0, 75.0), success=False, advance_sec=(2, 3),
                          additional={"is_penalty": True, "foul_zone": "penalty_box"})
            sim.execute_card("away", defender, "yellow")
            # Penalty
            xg_pen = calculate_xg(88.5, 50.0, shot_type="penalty")
            sim.add_event("shot", "penalty", "home", larsson, (88.5, 50.0), end_position=(100.0, 52.0),
                          success=True, xg=xg_pen, outcome="goal", body_part="right_foot", advance_sec=(3, 5),
                          additional={"shot_zone": "penalty_box", "distance_m": 11.0, "shot_type": "penalty"})
            sim.home_score = 4
            sim.execute_kickoff("away")
            continue

        # Key Moment 7 (Min 85): Clean sheet preserved with calm Vane catch
        if sim.minute >= 85 and not km7_done:
            km7_done = True
            sim.minute = 85
            sim.second = 20
            away_fwd = away.get_player_by_name("F. Cruz") or away.get_player_by_name("A. Solbakken")
            vane = home.get_goalkeeper()
            xg_val = calculate_xg(78.0, 45.0, body_part="right_foot", is_under_pressure=True)
            sim.add_event("shot", "open_play", "away", away_fwd, (78.0, 45.0), end_position=(100.0, 50.0),
                          success=False, xg=xg_val, outcome="saved", body_part="right_foot", under_pressure=True, advance_sec=(2, 3))
            sim.add_event("goalkeeper", "claim", "home", vane, (4.0, 50.0), success=True, advance_sec=(2, 4))
            dist_def = home.get_player_by_name("A. Van Der Beek") or home.starters[1]
            sim.add_event("pass", "short", "home", vane, (5.0, 50.0), end_position=(20.0, 25.0),
                          recipient=dist_def.name, success=True, advance_sec=(2, 3), additional={"action": "goalkeeper_distribution"})
            sim.possession_team_str = "home"
            sim.current_x = 20.0
            sim.current_y = 25.0
            continue

        sim.play_possession_phase(home_possession_prob=0.72)

    # Full Time
    sim.minute = 94
    sim.second = 10
    sim.add_event("full_time", None, "home", home.starters[0], (50.0, 50.0), advance_sec=(0, 0))

    return {
        "match_id": "match_002_dominance",
        "home_team": home.name,
        "away_team": away.name,
        "home_formation": home.formation,
        "away_formation": away.formation,
        "events": sim.events
    }


def create_match_003_scrappy_draw() -> Dict[str, Any]:
    """
    Match 003: 'The Battle'
    A scrappy, intense 2-2 draw between Ironwall FC and Phoenix Athletic.
    Features: lots of fouls, yellow cards, red card, penalty, end-to-end action, late equalizer.
    """
    home_starters = [
        Player("H. Guttman", 1, "GK", "GK", 5.0, 50.0),
        Player("V. Ramos-Silva", 2, "DF", "RB", 25.0, 15.0),
        Player("K. Voronin", 4, "DF", "CB", 20.0, 38.0),
        Player("C. Blackwell", 5, "DF", "CB", 20.0, 62.0),
        Player("A. Moretti", 3, "DF", "LB", 25.0, 85.0, preferred_foot="left_foot"),
        Player("M. Brandao", 6, "MF", "CM", 45.0, 38.0),
        Player("T. Jepsen", 8, "MF", "CM", 45.0, 62.0),
        Player("D. Stoilov", 7, "MF", "RM", 50.0, 15.0),
        Player("P. Cisse", 11, "MF", "LM", 50.0, 85.0, preferred_foot="left_foot"),
        Player("E. Vukovic", 9, "FW", "ST", 80.0, 42.0),
        Player("R. Holst", 10, "FW", "ST", 80.0, 58.0),
    ]
    home_subs = [
        Player("S. Baros", 15, "MF", "CM", 44.0, 50.0, is_starter=False),
        Player("N. Kolar", 19, "FW", "ST", 78.0, 50.0, is_starter=False),
        Player("B. O'Farrell", 22, "DF", "CB", 20.0, 50.0, is_starter=False),
    ]
    home = Team("Ironwall FC", "4-4-2", home_starters, home_subs, team_type="home")

    away_starters = [
        Player("S. Arisawa", 12, "GK", "GK", 5.0, 50.0),
        Player("J. Tremblay", 2, "DF", "RB", 25.0, 15.0),
        Player("A. Mokoena", 4, "DF", "CB", 20.0, 38.0),
        Player("D. Savic", 5, "DF", "CB", 20.0, 62.0),
        Player("T. Hauksson", 3, "DF", "LB", 25.0, 85.0, preferred_foot="left_foot"),
        Player("R. Kolarov", 6, "MF", "DM", 42.0, 38.0),
        Player("E. De Vries", 8, "MF", "DM", 42.0, 62.0),
        Player("G. Navas", 10, "MF", "CAM", 65.0, 50.0),
        Player("C. O'Donnell", 7, "FW", "RW", 72.0, 18.0),
        Player("M. Zouma", 11, "FW", "LW", 72.0, 82.0, preferred_foot="left_foot"),
        Player("I. Diallo", 9, "FW", "ST", 82.0, 50.0),
    ]
    away_subs = [
        Player("K. Lind", 16, "MF", "CM", 45.0, 50.0, is_starter=False),
        Player("Y. Fofana", 18, "FW", "ST", 80.0, 50.0, is_starter=False),
        Player("P. Nielsen", 24, "DF", "CB", 20.0, 50.0, is_starter=False),
    ]
    away = Team("Phoenix Athletic", "4-2-3-1", away_starters, away_subs, team_type="away")

    sim = FootballMatchGenerator("match_003_scrappy_draw", home, away, seed=303)

    sim.minute = 0
    sim.second = 0
    sim.execute_kickoff("home")

    km1_done = False
    km2_done = False
    km3_done = False
    while sim.minute < 45:
        # Key Moment 1 (Min 18): Heated brawl in midfield -> Double yellow cards!
        if sim.minute >= 18 and not km1_done:
            km1_done = True
            sim.minute = 18
            sim.second = 10
            brandao = home.get_player_by_name("M. Brandao")
            devries = away.get_player_by_name("E. De Vries")
            sim.add_event("tackle", "lost", "home", brandao, (52.0, 48.0), success=False, advance_sec=(1, 2))
            sim.add_event("foul", "committed", "home", brandao, (52.0, 48.0), success=False, advance_sec=(2, 3))
            sim.execute_card("home", brandao, "yellow")
            sim.add_event("foul", "committed", "away", devries, (48.0, 52.0), success=False, advance_sec=(2, 3))
            sim.execute_card("away", devries, "yellow")
            sim.possession_team_str = "away"
            sim.current_x = 48.0
            sim.current_y = 52.0
            continue

        # Key Moment 2 (Min 26): Mistimed sliding tackle in box -> Penalty for Phoenix -> Diallo converts (0-1)
        if sim.minute >= 26 and not km2_done:
            km2_done = True
            sim.minute = 26
            sim.second = 15
            diallo = away.get_player_by_name("I. Diallo")
            cb = home.get_player_by_name("C. Blackwell")
            sim.add_event("dribble", "successful", "away", diallo, (88.0, 50.0), success=True, advance_sec=(2, 3))
            sim.add_event("tackle", "lost", "home", cb, (12.0, 50.0), success=False, advance_sec=(1, 2))
            sim.add_event("foul", "committed", "home", cb, (12.0, 50.0), success=False, advance_sec=(2, 3))
            sim.execute_card("home", cb, "yellow")
            # Penalty
            xg_pen = calculate_xg(88.5, 50.0, shot_type="penalty")
            sim.add_event("shot", "penalty", "away", diallo, (88.5, 50.0), end_position=(100.0, 52.0),
                          success=True, xg=xg_pen, outcome="goal", body_part="right_foot", advance_sec=(3, 5),
                          additional={"shot_zone": "penalty_box", "distance_m": 11.0, "shot_type": "penalty"})
            sim.away_score = 1
            sim.execute_kickoff("home")
            continue

        # Key Moment 3 (Min 39): Free kick cross -> Goalmouth scramble -> Holst flicked header goal (1-1)
        if sim.minute >= 39 and not km3_done:
            km3_done = True
            sim.minute = 39
            sim.second = 10
            free_kick_taker = home.get_player_by_name("D. Stoilov")
            holst = home.get_player_by_name("R. Holst")
            defender = away.get_player_by_name("A. Mokoena")
            # Foul awarded
            sim.add_event("foul", "committed", "away", defender, (30.0, 25.0), success=False, advance_sec=(2, 3))
            # Free kick cross
            sim.add_event("pass", "free_kick", "home", free_kick_taker, (70.0, 25.0), end_position=(93.0, 51.0),
                          recipient=holst.name, success=True, progressive=True, advance_sec=(2, 3), additional={"delivery": "free_kick_cross"})
            sim.add_event("aerial_duel", "won", "home", holst, (93.0, 51.0), success=True, advance_sec=(1, 2))
            xg_val = calculate_xg(93.0, 51.0, body_part="head", assist_type="free_kick", is_under_pressure=True, shot_type="header")
            sim.add_event("shot", "header", "home", holst, (93.0, 51.0), end_position=(100.0, 51.0),
                          success=True, xg=xg_val, outcome="goal", body_part="head", under_pressure=True, advance_sec=(3, 5),
                          additional={"shot_zone": "inside_box", "distance_m": 7.4, "assist_type": "free_kick"})
            sim.home_score = 1
            sim.execute_kickoff("away")
            continue

        # Extra fouls and physical duels
        if sim.rng.random() < 0.06:
            t_str = sim.rng.choice(["home", "away"])
            t = sim.get_team_obj(t_str)
            fouler = sim.rng.choice(t.active_players)
            foul_x = round(float(sim.rng.uniform(25.0, 75.0)), 1)
            foul_y = round(float(sim.rng.uniform(15.0, 85.0)), 1)
            sim.add_event("foul", "committed", t_str, fouler, (foul_x, foul_y), success=False, advance_sec=(2, 3))
            if sim.rng.random() < 0.20:
                sim.execute_card(t_str, fouler, "yellow")

        sim.play_possession_phase(home_possession_prob=0.50)

    # Half Time
    sim.add_event("half_time", None, "home", home.starters[0], (50.0, 50.0), advance_sec=(0, 0))

    # Second Half Kickoff
    sim.minute = 45
    sim.second = 0
    sim.execute_kickoff("away")

    km4_done = False
    km5_done = False
    km6_done = False
    km7_done = False
    while sim.minute < 95:
        # Key Moment 4 (Min 55): Straight RED CARD for Brandao! Ironwall down to 10 men!
        if sim.minute >= 55 and not km4_done:
            km4_done = True
            sim.minute = 55
            sim.second = 15
            brandao = home.get_player_by_name("M. Brandao")
            kolarov = away.get_player_by_name("R. Kolarov")
            sim.add_event("tackle", "lost", "home", brandao, (48.0, 52.0), success=False, advance_sec=(1, 2))
            sim.add_event("foul", "committed", "home", brandao, (48.0, 52.0), success=False, advance_sec=(2, 3))
            sim.execute_card("home", brandao, "red")
            # Tactical reorganization for 10 men
            sim.execute_substitution("home", "R. Holst", "S. Baros", reason="tactical")
            sim.possession_team_str = "away"
            sim.current_x = 48.0
            sim.current_y = 52.0
            continue

        # Key Moment 5 (Min 64): 10-man Ironwall scores counter-attack goal! (2-1)
        if sim.minute >= 64 and not km5_done:
            km5_done = True
            sim.minute = 64
            sim.second = 20
            vukovic = home.get_player_by_name("E. Vukovic")
            jepsen = home.get_player_by_name("T. Jepsen")
            # Interception and breakaway
            sim.add_event("interception", None, "home", jepsen, (32.0, 45.0), success=True, advance_sec=(1, 2))
            sim.add_event("pass", "through_ball", "home", jepsen, (32.0, 45.0), end_position=(78.0, 48.0),
                          recipient=vukovic.name, success=True, progressive=True, advance_sec=(2, 3))
            sim.add_event("dribble", "successful", "home", vukovic, (84.0, 48.0), success=True, under_pressure=True, advance_sec=(2, 3))
            xg_val = calculate_xg(87.0, 48.0, body_part="right_foot", assist_type="through_ball", is_under_pressure=True)
            sim.add_event("shot", "open_play", "home", vukovic, (87.0, 48.0), end_position=(100.0, 48.0),
                          success=True, xg=xg_val, outcome="goal", body_part="right_foot", under_pressure=True, advance_sec=(3, 5),
                          additional={"shot_zone": "inside_box", "distance_m": 13.6, "assist_type": "through_ball"})
            sim.home_score = 2
            sim.execute_kickoff("away")
            continue

        # Key Moment 6 (Min 79): Phoenix Athletic strikes the woodwork!
        if sim.minute >= 79 and not km6_done:
            km6_done = True
            sim.minute = 79
            sim.second = 15
            zouma = away.get_player_by_name("M. Zouma")
            xg_val = calculate_xg(84.0, 68.0, body_part="right_foot", is_under_pressure=True)
            sim.add_event("shot", "open_play", "away", zouma, (84.0, 68.0), end_position=(100.0, 54.0),
                          success=False, xg=xg_val, outcome="post", body_part="right_foot", advance_sec=(2, 3))
            sim.add_event("clearance", None, "home", home.get_player_by_name("C. Blackwell"), (15.0, 52.0),
                          end_position=(45.0, 80.0), success=True, advance_sec=(2, 3))
            sim.possession_team_str = "away"
            sim.current_x = 55.0
            sim.current_y = 20.0
            continue

        # Key Moment 7 (Min 88): Dramatic late equalizer from long range outside box (2-2)
        if sim.minute >= 88 and not km7_done:
            km7_done = True
            sim.minute = 88
            sim.second = 25
            devries = away.get_player_by_name("E. De Vries")
            navas = away.get_player_by_name("G. Navas")
            sim.add_event("pass", "short", "away", navas, (75.0, 52.0), end_position=(80.0, 48.0),
                          recipient=devries.name, success=True, progressive=False, advance_sec=(1, 2))
            xg_val = calculate_xg(80.0, 48.0, body_part="right_foot", is_under_pressure=True)
            sim.add_event("shot", "long_range", "away", devries, (80.0, 48.0), end_position=(100.0, 52.0),
                          success=True, xg=xg_val, outcome="goal", body_part="right_foot", under_pressure=True, advance_sec=(3, 5),
                          additional={"shot_zone": "outside_box", "distance_m": 21.0, "shot_type": "long_range_strike"})
            sim.away_score = 2
            sim.execute_kickoff("home")
            continue

        # High pressure / scrappy fouls
        if sim.rng.random() < 0.06:
            t_str = sim.rng.choice(["home", "away"])
            t = sim.get_team_obj(t_str)
            fouler = sim.rng.choice(t.active_players)
            foul_x = round(float(sim.rng.uniform(25.0, 75.0)), 1)
            foul_y = round(float(sim.rng.uniform(15.0, 85.0)), 1)
            sim.add_event("foul", "committed", t_str, fouler, (foul_x, foul_y), success=False, advance_sec=(2, 3))
            if sim.rng.random() < 0.20:
                sim.execute_card(t_str, fouler, "yellow")

        # Phoenix has 60% possession against 10 men
        sim.play_possession_phase(home_possession_prob=0.40)

    # Full Time
    sim.minute = 95
    sim.second = 20
    sim.add_event("full_time", None, "home", home.starters[0], (50.0, 50.0), advance_sec=(0, 0))

    return {
        "match_id": "match_003_scrappy_draw",
        "home_team": home.name,
        "away_team": away.name,
        "home_formation": home.formation,
        "away_formation": away.formation,
        "events": sim.events
    }


def generate_unscripted_live_match(seed: Optional[int] = None, home_name: str = "Apex United", away_name: str = "Titan City") -> Dict[str, Any]:
    """Generates an unscripted dynamic match with organic probabilistic goals, cards, and corners."""
    used_seed = seed if seed is not None else random.randint(1000, 999999)
    rng = random.Random(used_seed)

    home_starters = [
        Player("L. Kincaid", 1, "GK", "GK", 5.0, 50.0),
        Player("M. Vance", 2, "DF", "RB", 22.0, 15.0),
        Player("J. Thorne", 5, "DF", "CB", 18.0, 38.0),
        Player("S. Halvorsen", 3, "DF", "CB", 18.0, 62.0),
        Player("D. Castaneda", 24, "DF", "LB", 22.0, 85.0),
        Player("A. Nwosu-Brown", 16, "MF", "DM", 45.0, 50.0),
        Player("C. Sinclair", 17, "MF", "CM", 60.0, 35.0),
        Player("K. Lindstrom", 20, "MF", "CM", 60.0, 65.0),
        Player("T. Moreau", 47, "FW", "RW", 78.0, 18.0),
        Player("M. Sorenson", 9, "FW", "ST", 85.0, 50.0),
        Player("N. Achebe", 10, "FW", "LW", 78.0, 82.0),
    ]
    home_subs = [
        Player("G. Larsson", 19, "FW", "ST", 82.0, 50.0, is_starter=False),
        Player("M. Benali", 8, "MF", "CM", 58.0, 50.0, is_starter=False),
        Player("F. Mercer", 6, "DF", "CB", 20.0, 50.0, is_starter=False),
    ]
    home = Team(home_name, "4-3-3", home_starters, home_subs, team_type="home")

    away_starters = [
        Player("D. Calderon", 22, "GK", "GK", 5.0, 50.0),
        Player("C. D'Angelo", 4, "DF", "RB", 22.0, 15.0),
        Player("K. Demir", 2, "DF", "CB", 18.0, 38.0),
        Player("N. Skov", 6, "DF", "CB", 18.0, 62.0),
        Player("R. Tanaka", 12, "DF", "LB", 22.0, 85.0),
        Player("J. Bradshaw-Cruz", 41, "MF", "DM", 44.0, 42.0),
        Player("T. Althaus", 5, "MF", "DM", 44.0, 58.0),
        Player("L. Vance", 7, "FW", "RW", 76.0, 18.0),
        Player("K. Varga", 8, "MF", "AM", 65.0, 50.0),
        Player("K. Miyazawa", 11, "FW", "LW", 76.0, 82.0),
        Player("E. Adetunji", 29, "FW", "ST", 84.0, 50.0),
    ]
    away_subs = [
        Player("E. Vukovic", 19, "FW", "LW", 75.0, 80.0, is_starter=False),
        Player("S. Fontana", 23, "MF", "CM", 55.0, 50.0, is_starter=False),
        Player("A. Moretti", 33, "DF", "LB", 22.0, 80.0, is_starter=False),
    ]
    away = Team(away_name, "4-2-3-1", away_starters, away_subs, team_type="away")

    sim = FootballMatchGenerator("match_live_unscripted", home, away, seed=used_seed, allow_dynamic_goals=True)
    sim.minute = 0
    sim.second = 0
    sim.execute_kickoff("home")

    while sim.minute < 45:
        sim.play_possession_phase(home_possession_prob=rng.uniform(0.48, 0.58))

    sim.add_event("half_time", None, "home", home.starters[0], (50.0, 50.0), advance_sec=(0, 0))

    sim.minute = 45
    sim.second = 0
    sim.execute_kickoff("away")
    stoppage = rng.randint(92, 95)

    sub_done = False
    while sim.minute < stoppage:
        if sim.minute == 68 and not sub_done:
            sub_done = True
            sim.execute_substitution("home", "N. Achebe", "G. Larsson", reason="tactical")
            sim.execute_substitution("away", "K. Miyazawa", "E. Vukovic", reason="tactical")
        sim.play_possession_phase(home_possession_prob=rng.uniform(0.46, 0.56))

    sim.minute = stoppage
    sim.second = 15
    sim.add_event("full_time", None, "home", home.starters[0], (50.0, 50.0), advance_sec=(0, 0))

    return {
        "match_id": "match_live_unscripted",
        "home_team": home.name,
        "away_team": away.name,
        "home_formation": home.formation,
        "away_formation": away.formation,
        "events": sim.events,
    }


# ==============================================================================
# Main Runner & File Exporter
# ==============================================================================

def generate_all_matches(output_dir: str = "matches") -> Dict[str, Dict[str, Any]]:
    os.makedirs(output_dir, exist_ok=True)

    matches_data = {
        "match_001_comeback.json": create_match_001_comeback(),
        "match_002_dominance.json": create_match_002_dominance(),
        "match_003_scrappy_draw.json": create_match_003_scrappy_draw(),
    }

    for filename, match_dict in matches_data.items():
        file_path = os.path.join(output_dir, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(match_dict, f, indent=2)
        print(f"Generated {filename}: {len(match_dict['events'])} events")

    return matches_data


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    matches_dir = os.path.join(current_dir, "matches")
    print(f"Generating synthetic match event files to: {matches_dir}")
    generate_all_matches(matches_dir)
