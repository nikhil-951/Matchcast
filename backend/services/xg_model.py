"""
MatchCast AI - Expected Goals (xG) Calculation Model
Statistical shot evaluation model calculating xG based on location, angle, and modifiers.
"""

from __future__ import annotations

import math
from typing import Optional
from backend.models.events import MatchEvent, Position


def calculate_distance_to_goal(position: Position, goal_x: float = 100.0, goal_y: float = 50.0) -> float:
    """
    Calculate Euclidean distance from shot location to the center of the attacking goal.
    Coordinates are normalized to a 0-100 pitch grid.
    """
    dx = goal_x - position.x
    dy = goal_y - position.y
    return math.sqrt(dx * dx + dy * dy)


def calculate_shot_angle_degrees(
    position: Position,
    goal_x: float = 100.0,
    goal_y1: float = 44.5,
    goal_y2: float = 55.5,
) -> float:
    """
    Calculate the visible goal angle (in degrees) subtended between the two goal posts.
    Posts are assumed at (100, 44.5) and (100, 55.5) on a 100x100 grid.
    """
    # Vectors to each post
    v1_x = goal_x - position.x
    v1_y = goal_y1 - position.y

    v2_x = goal_x - position.x
    v2_y = goal_y2 - position.y

    dot = v1_x * v2_x + v1_y * v2_y
    mag1 = math.sqrt(v1_x * v1_x + v1_y * v1_y)
    mag2 = math.sqrt(v2_x * v2_x + v2_y * v2_y)

    if mag1 * mag2 == 0:
        return 0.0

    cos_theta = max(-1.0, min(1.0, dot / (mag1 * mag2)))
    angle_rad = math.acos(cos_theta)
    return math.degrees(angle_rad)


def calculate_xg(event: MatchEvent) -> float:
    """
    Calculate expected goals (xG) for a shot event.
    Returns fixed 0.76 for penalties.
    For open play and set pieces, applies spatial decay, visible goal angle, and contextual multipliers.
    """
    # If the event already carries a precomputed xG, preserve it if valid
    if event.xG is not None and event.xG > 0:
        return round(float(event.xG), 4)

    # Penalties have a standardized historical conversion rate of ~0.76
    subtype = (event.subtype or "").lower()
    if "penalty" in subtype or "penalty" in (event.type or "").lower():
        return 0.76

    pos = event.position
    if pos is None:
        # Default average shot xG if position coordinate is absent
        return 0.10

    # Ensure coordinates are facing attacking goal
    x = max(0.0, min(100.0, pos.x))
    y = max(0.0, min(100.0, pos.y))
    clamped_pos = Position(x=x, y=y)

    distance = calculate_distance_to_goal(clamped_pos)
    angle_deg = calculate_shot_angle_degrees(clamped_pos)

    # Base logistic regression inspired decay:
    # Closer distance and wider angle to goal yield higher baseline probability
    # Distance coefficient ~ -0.11, angle factor rewards central visibility
    angle_norm = max(0.0, min(1.0, angle_deg / 65.0))
    linear_predictor = 1.3 - (0.105 * distance) + (1.6 * angle_norm)
    base_xg = 1.0 / (1.0 + math.exp(-linear_predictor))

    # Apply qualitative and contextual modifiers
    modifier = 1.0

    # Body part modifier
    body_part = (event.body_part or "").lower()
    if "head" in body_part:
        modifier *= 0.55
    elif "weak" in body_part:
        modifier *= 0.85
    elif "other" in body_part:
        modifier *= 0.60

    # Under pressure modifier
    if event.under_pressure:
        modifier *= 0.75

    # Shot / assist context from additional dict or subtype
    add_info = event.additional or {}
    assist_type = str(add_info.get("assist_type", "")).lower()
    is_first_time = bool(add_info.get("first_time", False))

    if "cutback" in assist_type:
        modifier *= 1.25
    elif "through_ball" in assist_type:
        modifier *= 1.20
    elif "cross" in assist_type:
        modifier *= 0.85
    elif "rebound" in assist_type:
        modifier *= 1.30

    if is_first_time:
        modifier *= 0.88

    if "direct_free_kick" in subtype or "free_kick" in subtype:
        modifier *= 0.65

    calculated = base_xg * modifier
    # Constrain within realistic single shot bounds
    calculated = max(0.01, min(0.95, calculated))

    return round(calculated, 4)
