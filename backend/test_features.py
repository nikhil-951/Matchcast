"""Tests for the Verifier, overlay engine, data integrity and team-label normalisation."""

import json
from pathlib import Path

import pytest

from backend.models.events import MatchData, MatchEvent
from backend.models.match_state import MatchState
from backend.services.overlays import ViewerProfile, build_overlays
from backend.services.verifier import VerificationTracker, summarize, verify_text

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "matches"


def make_state() -> MatchState:
    state = MatchState(match_id="t", home_team="Home FC", away_team="Away FC")
    state.xg_totals.home, state.xg_totals.away = 1.20, 0.45
    state.possession.home, state.possession.away = 61.0, 39.0
    state.momentum.home, state.momentum.away = 70.0, 30.0
    state.score.home, state.score.away = 2, 1
    state.pressing_intensity.home_pressures_count = 14
    state.pressing_intensity.away_pressures_count = 9
    return state


# ---------------------------- Verifier ---------------------------------
def test_verifier_accepts_correct_numbers():
    claims = verify_text("Home FC have 1.20 xG and 61.0% possession, leading (2-1).", make_state())
    assert {c["type"] for c in claims} >= {"xg", "possession", "score"}
    assert all(c["status"] == "verified" for c in claims)


def test_verifier_flags_wrong_numbers():
    claims = verify_text("Home FC have 2.80 xG and 75% possession. It is (0-3).", make_state())
    statuses = {c["type"]: c["status"] for c in claims}
    assert statuses["xg"] == "wrong"
    assert statuses["possession"] == "wrong"
    assert statuses["score"] == "wrong"
    assert any(c["actual"] for c in claims)  # tells you the real value


def test_verifier_marks_hallucinated_statistics_unsupported():
    claims = verify_text("In 84% of matches with this xG disparity, the leader wins.", make_state())
    assert len(claims) == 1 and claims[0]["status"] == "unsupported"


def test_verifier_summary_and_tracker():
    claims = verify_text("1.20 xG. 2.80 xG. Historically teams win.", make_state())
    summary = summarize(claims)
    assert summary["verified"] == 1 and summary["wrong"] == 1 and summary["unsupported"] == 1
    tracker = VerificationTracker()
    tracker.add(claims)
    assert tracker.snapshot()["total"] == 3


def test_percentages_are_matched_to_the_nearest_keyword():
    # "61.0% of the ball and 70.0% of the momentum index" must not be read as two momentum claims
    claims = verify_text("Home FC control 61.0% of the ball and 70.0% of the momentum index.", make_state())
    assert [(c["type"], c["status"]) for c in claims] == [("possession", "verified"), ("momentum", "verified")]
    claims = verify_text("Home FC hold 61.0% possession and a momentum rating of 70.0%.", make_state())
    assert [(c["type"], c["status"]) for c in claims] == [("possession", "verified"), ("momentum", "verified")]


# ---------------------------- Overlays ---------------------------------
def shot(speed=112.0, outcome="saved", player="J. Calderon", team="Away FC"):
    return MatchEvent(
        event_id="evt_1", minute=14, second=10, type="shot", team=team, player=player, player_number=9,
        position={"x": 90, "y": 50}, xG=0.2, outcome=outcome,
        additional={"shot_speed_kmh": speed},
    )


def test_hard_shot_triggers_speed_overlay_in_three_languages():
    overlays = build_overlays(shot(), ViewerProfile())
    speed = next(o for o in overlays if o["type"] == "shot_speed")
    assert set(speed["text"]) == {"en", "hi", "es"}
    assert "112" in speed["text"]["en"]
    assert speed["evidence_event_ids"] == ["evt_1"] and speed["match_clock"] == "14:10"


def test_soft_shot_has_no_speed_overlay():
    assert not [o for o in build_overlays(shot(speed=70.0), ViewerProfile()) if o["type"] == "shot_speed"]


def test_player_focus_and_highlight():
    focused = build_overlays(shot(), ViewerProfile(favorite_player="Someone Else", player_focus=True))
    assert focused == []
    mine = build_overlays(shot(), ViewerProfile(favorite_player="J. Calderon", player_focus=True))
    assert mine and all(o["highlight"] for o in mine)


def test_single_metric_mode():
    only_goals = build_overlays(shot(), ViewerProfile(focus_metric="goals"))
    assert only_goals == []
    goal = build_overlays(shot(outcome="goal"), ViewerProfile(focus_metric="goals"), {"home": 0, "away": 1})
    assert goal and goal[0]["type"] == "goal" and "0-1" in goal[0]["text"]["en"]


# ------------------------ Data integrity -------------------------------
EXPECTED = {
    "match_001_comeback.json": (3, 2),
    "match_002_dominance.json": (4, 0),
    "match_003_scrappy_draw.json": (2, 2),
}


@pytest.mark.parametrize("filename,score", EXPECTED.items())
def test_flagship_matches_are_full_length_with_scripted_scores(filename, score):
    data = json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))
    events = data["events"]
    assert len(events) > 1500, "a full match should have ~2000 events"
    assert events[-1]["minute"] >= 90
    goals = [e for e in events if e["type"] == "shot" and e.get("outcome") == "goal"]
    home = sum(1 for g in goals if g["team"] == "home")
    assert (home, len(goals) - home) == score


def test_team_labels_are_normalised_to_names():
    raw = json.loads((DATA_DIR / "match_001_comeback.json").read_text(encoding="utf-8"))
    md = MatchData(**raw).normalize_team_labels()
    assert {e.team for e in md.events} <= {md.home_team, md.away_team}


def test_pass_and_shot_speed_fields_exist():
    raw = json.loads((DATA_DIR / "match_001_comeback.json").read_text(encoding="utf-8"))
    passes = [e for e in raw["events"] if e["type"] == "pass" and e.get("additional")]
    assert passes and "pass_difficulty" in passes[0]["additional"]
    shots = [e for e in raw["events"] if e["type"] == "shot"]
    assert all("shot_speed_kmh" in (s.get("additional") or {}) for s in shots)
