"""
MatchCast AI - Broadcast Overlay Engine
Turns raw match events into timed, machine-readable overlay objects that a rendering
partner could draw over a live feed. Pure code: no LLM, so overlays are instant.

Overlay JSON (one object per overlay):
{
  "id": "ov_evt_0042_shot_speed",
  "type": "player_tag | shot_speed | pass_quality | goal | card",
  "match_clock": "14:10",          # when it appears on the match clock
  "start_s": 850,                  # same, in seconds
  "duration_s": 5,                 # how long it stays on screen
  "team": "Synthetic City FC",
  "player": "J. Calderon",
  "priority": 1-3,                 # 3 = most important
  "highlight": true,               # matches the viewer's favourite club/player
  "evidence_event_ids": ["evt_0042"],
  "text": {"en": "...", "hi": "...", "es": "..."},
  "payload": {...}                 # numbers a graphics engine can bind to
}
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from backend.models.events import MatchEvent

LANGUAGES = ("en", "hi", "es")
FOCUS_METRICS = ("all", "shots", "passes", "goals")

SHOT_SPEED_THRESHOLD_KMH = 100.0   # shown only for hard-hit shots
PLAYER_SPEED_THRESHOLD_KMH = 32.5  # shown for elite Premier League sprint bursts
SPRINT_OVERLAY_COOLDOWN_SEC = 90   # minimum match seconds between broadcast sprint overlays
HARD_PASS_DIFFICULTY = 0.60        # shown only for difficult completed passes


class ViewerProfile(BaseModel):
    """Everything that makes the same match feel different to different fans."""

    mode: str = Field(default="fan", description="fan | scout | broadcaster")
    language: str = Field(default="en", description="en | hi | es")
    favorite_club: Optional[str] = Field(default=None, description="Club name to highlight")
    favorite_player: Optional[str] = Field(default=None, description="Player name to highlight")
    player_focus: bool = Field(default=False, description="Show only the favourite player's overlays (plus goals)")
    focus_metric: str = Field(default="all", description="all | shots | passes | goals")
    last_speed_overlay_sec: int = Field(default=-999, description="Timestamp in match seconds of last speed overlay to throttle broadcast spam")


def _clock(minute: int, second: Optional[int]) -> str:
    sec = second or 0
    return f"{minute:02d}:{sec:02d}"


def _overlay(
    event: MatchEvent,
    kind: str,
    priority: int,
    duration: int,
    text: Dict[str, str],
    payload: Dict[str, Any],
    profile: ViewerProfile,
) -> Dict[str, Any]:
    sec = event.second or 0
    highlight = bool(
        (profile.favorite_player and event.player == profile.favorite_player)
        or (profile.favorite_club and event.team == profile.favorite_club)
    )
    return {
        "id": f"ov_{event.event_id}_{kind}",
        "type": kind,
        "match_clock": _clock(event.minute, sec),
        "start_s": event.minute * 60 + sec,
        "duration_s": duration,
        "team": event.team,
        "player": event.player,
        "priority": priority + (1 if highlight else 0),
        "highlight": highlight,
        "evidence_event_ids": [event.event_id],
        "text": text,
        "payload": payload,
    }


def build_overlays(
    event: MatchEvent,
    profile: Optional[ViewerProfile] = None,
    score: Optional[Dict[str, int]] = None,
) -> List[Dict[str, Any]]:
    """Return the overlays this event should trigger for this viewer (may be empty)."""
    profile = profile or ViewerProfile()
    extra = event.additional or {}
    number = f"#{event.player_number} " if event.player_number is not None else ""
    out: List[Dict[str, Any]] = []

    is_goal = event.type == "shot" and event.outcome == "goal"

    # --- Goal -------------------------------------------------------------
    if is_goal:
        scoreline = f"{score['home']}-{score['away']}" if score else ""
        out.append(_overlay(
            event, "goal", 3, 8,
            {
                "en": f"GOAL! {number}{event.player} ({event.team}) {scoreline}".strip(),
                "hi": f"गोल! {number}{event.player} ({event.team}) {scoreline}".strip(),
                "es": f"¡GOL! {number}{event.player} ({event.team}) {scoreline}".strip(),
            },
            {"xG": event.xG, "shot_speed_kmh": extra.get("shot_speed_kmh"), "score": score},
            profile,
        ))

    # --- Cards ------------------------------------------------------------
    elif event.type == "card":
        colour = (event.subtype or extra.get("color") or "yellow").lower()
        out.append(_overlay(
            event, "card", 2, 6,
            {
                "en": f"{colour.title()} card: {event.player} ({event.team})",
                "hi": f"{'लाल' if colour == 'red' else 'पीला'} कार्ड: {event.player} ({event.team})",
                "es": f"Tarjeta {'roja' if colour == 'red' else 'amarilla'}: {event.player} ({event.team})",
            },
            {"card": colour},
            profile,
        ))

    # --- Substitutions ----------------------------------------------------
    elif event.type == "substitution":
        sub_on = extra.get("sub_on") or event.player
        sub_off = extra.get("sub_off") or extra.get("player_off") or event.recipient or "Teammate"
        out.append(_overlay(
            event, "substitution", 2, 7,
            {
                "en": f"🔄 SUBSTITUTION: ⬆️ {sub_on} IN | ⬇️ {sub_off} OUT ({event.team})",
                "hi": f"🔄 प्रतिस्थापन: ⬆️ {sub_on} अंदर | ⬇️ {sub_off} बाहर ({event.team})",
                "es": f"🔄 CAMBIO: ⬆️ {sub_on} ENTRA | ⬇️ {sub_off} SALE ({event.team})",
            },
            {"sub_on": sub_on, "sub_off": sub_off, "reason": extra.get("reason", "tactical")},
            profile,
        ))

    # --- Shot speed (threshold-triggered) + player tag ---------------------
    elif event.type == "shot":
        speed = extra.get("shot_speed_kmh")
        out.append(_overlay(
            event, "player_tag", 1, 4,
            {
                "en": f"{number}{event.player} shoots",
                "hi": f"{number}{event.player} का शॉट",
                "es": f"{number}{event.player} dispara",
            },
            {"xG": event.xG, "outcome": event.outcome},
            profile,
        ))
        if speed and speed >= SHOT_SPEED_THRESHOLD_KMH:
            out.append(_overlay(
                event, "shot_speed", 2, 5,
                {
                    "en": f"Shot speed: {speed:.0f} km/h",
                    "hi": f"शॉट की गति: {speed:.0f} किमी/घं",
                    "es": f"Velocidad del disparo: {speed:.0f} km/h",
                },
                {"shot_speed_kmh": speed, "threshold_kmh": SHOT_SPEED_THRESHOLD_KMH},
                profile,
            ))

    # --- Pass quality (difficult completed passes only) ---------------------
    elif event.type == "pass" and event.success:
        difficulty = extra.get("pass_difficulty")
        if difficulty is not None and difficulty >= HARD_PASS_DIFFICULTY:
            dist = extra.get("distance_m")
            out.append(_overlay(
                event, "pass_quality", 2, 5,
                {
                    "en": f"{event.player}: {dist:.0f} m pass, difficulty {difficulty:.2f}",
                    "hi": f"{event.player}: {dist:.0f} मी का पास, कठिनाई {difficulty:.2f}",
                    "es": f"{event.player}: pase de {dist:.0f} m, dificultad {difficulty:.2f}",
                },
                {"distance_m": dist, "difficulty": difficulty, "ball_speed_kmh": extra.get("ball_speed_kmh")},
                profile,
            ))

    # --- Player Sprint Speed & Distance (threshold-triggered with cooldown) -
    player_spd = extra.get("player_speed_kmh")
    dist_cov = extra.get("sprint_distance_m", extra.get("distance_m", 0.0))
    if player_spd and player_spd >= PLAYER_SPEED_THRESHOLD_KMH and dist_cov >= 20.0:
        curr_event_sec = event.minute * 60 + (event.second or 0)
        allow_sprint = True
        if profile is not None:
            if curr_event_sec - profile.last_speed_overlay_sec < SPRINT_OVERLAY_COOLDOWN_SEC:
                allow_sprint = False
            else:
                profile.last_speed_overlay_sec = curr_event_sec

        if allow_sprint:
            dist_cov = extra.get("sprint_distance_m", 25.0)
            out.append(_overlay(
                event, "player_speed", 2, 5,
                {
                    "en": f"⚡ SPRINT: {number}{event.player} reached {player_spd:.1f} km/h ({dist_cov:.0f}m burst)",
                    "hi": f"⚡ स्प्रिंट: {number}{event.player} की गति {player_spd:.1f} किमी/घं ({dist_cov:.0f}मी)",
                    "es": f"⚡ SPRINT: {number}{event.player} alcanzó {player_spd:.1f} km/h ({dist_cov:.0f}m)",
                },
                {"player_speed_kmh": player_spd, "sprint_distance_m": dist_cov, "threshold_kmh": PLAYER_SPEED_THRESHOLD_KMH},
                profile,
            ))

    return _personalize(out, profile)


def _personalize(overlays: List[Dict[str, Any]], profile: ViewerProfile) -> List[Dict[str, Any]]:
    """Apply player-focus and single-metric modes."""
    result = overlays
    if profile.player_focus and profile.favorite_player:
        result = [o for o in result if o["player"] == profile.favorite_player or o["type"] == "goal"]

    metric_types = {
        "shots": {"player_tag", "shot_speed", "goal"},
        "passes": {"pass_quality"},
        "goals": {"goal", "card"},
    }
    if profile.focus_metric in metric_types:
        result = [o for o in result if o["type"] in metric_types[profile.focus_metric]]
    return result


def roster(events: List[MatchEvent], home_team: str, away_team: str) -> Dict[str, List[Dict[str, Any]]]:
    """Distinct players per team, for the favourite-player picker."""
    seen: Dict[str, Dict[str, Any]] = {}
    for ev in events:
        if ev.player and ev.player not in seen:
            t = (ev.team or "").strip().lower()
            canonical_team = (
                home_team if t in ("home", home_team.strip().lower())
                else (away_team if t in ("away", away_team.strip().lower()) else None)
            )
            if canonical_team:
                seen[ev.player] = {"name": ev.player, "number": ev.player_number, "team": canonical_team}
    players = sorted(seen.values(), key=lambda p: (p["team"], p["number"] or 0))
    return {"players": players}
