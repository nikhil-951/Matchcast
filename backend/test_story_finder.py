"""
MatchCast AI - Unit Tests for Data Story Finder, Turning Point Detector & Tactical Analytics
"""

import pytest
from backend.models.events import MatchEvent
from backend.models.match_state import MatchState, MomentumStats
from backend.services.story_finder import DataStoryFinder
from backend.services.verifier import verify_text


def _make_event(
    event_id: str,
    minute: int,
    ev_type: str,
    team: str = "Synthetic City FC",
    player: str = "M. Belotti",
    pos=(50.0, 50.0),
    end_pos=None,
    success=True,
    outcome=None,
    xg=None,
    subtype=None,
    additional=None,
) -> MatchEvent:
    return MatchEvent(
        event_id=event_id,
        minute=minute,
        second=0,
        type=ev_type,
        subtype=subtype,
        team=team,
        player=player,
        position={"x": pos[0], "y": pos[1]},
        end_position={"x": end_pos[0], "y": end_pos[1]} if end_pos else None,
        success=success,
        outcome=outcome,
        xG=xg,
        additional=additional or {},
    )


def test_midfield_metronome_rule_and_reset():
    finder = DataStoryFinder("Synthetic City FC", "Metro Stars FC")
    state = MatchState(home_team="Synthetic City FC", away_team="Metro Stars FC", minute=20)

    # 19 successful passes: no story yet
    for i in range(19):
        ev = _make_event(f"p_{i}", 20, "pass", "Synthetic City FC", "E. Lindberg", success=True)
        assert finder.process_event(ev, state) is None

    # 20th successful pass: triggers Metronome story
    ev20 = _make_event("p_19", 20, "pass", "Synthetic City FC", "E. Lindberg", success=True)
    story = finder.process_event(ev20, state)
    assert story is not None
    assert story.story_type == "midfield_metronome"
    assert "E. Lindberg" in story.title
    assert story.metrics["consecutive_passes"] == 20

    # Incomplete pass resets count
    fail_ev = _make_event("p_fail", 21, "pass", "Synthetic City FC", "E. Lindberg", success=False)
    finder.process_event(fail_ev, state)
    assert finder._consecutive_passes["E. Lindberg"] == 0


def test_smash_and_grab_rule():
    finder = DataStoryFinder("Synthetic City FC", "Metro Stars FC")
    state = MatchState(
        home_team="Synthetic City FC",
        away_team="Metro Stars FC",
        minute=14,
        momentum=MomentumStats(home=80.0, away=20.0, delta=-60.0),
    )

    # Away team first shot on low momentum (20%) scores a goal
    goal_ev = _make_event(
        "shot_1",
        14,
        "shot",
        team="Metro Stars FC",
        player="J. Calderon",
        pos=(85.0, 50.0),
        outcome="goal",
        xg=0.12,
    )
    story = finder.process_event(goal_ev, state)
    assert story is not None
    assert story.story_type == "smash_and_grab"
    assert "Metro Stars FC" in story.title
    assert story.metrics["momentum_pct"] <= 25.0


def test_finishing_woes_and_reset_on_goal():
    finder = DataStoryFinder("Synthetic City FC", "Metro Stars FC")
    state = MatchState(home_team="Synthetic City FC", away_team="Metro Stars FC", minute=35)

    # 4 missed shots with 0.3 xG each = 1.20 xG, 4 shots (needs 5 shots)
    for i in range(4):
        ev = _make_event(f"s_{i}", 30 + i, "shot", "Synthetic City FC", outcome="saved", xg=0.30)
        assert finder.process_event(ev, state) is None

    # 5th shot pushes shots to 5 and xG to 1.50 -> triggers finishing woes
    ev5 = _make_event("s_4", 35, "shot", "Synthetic City FC", outcome="saved", xg=0.30)
    story = finder.process_event(ev5, state)
    assert story is not None
    assert story.story_type == "finishing_woes"
    assert story.metrics["shots_without_goal"] == 5
    assert story.metrics["cumulative_xG"] >= 1.20

    # Once a goal is scored, finishing woes tracker resets
    goal_ev = _make_event("s_goal", 38, "shot", "Synthetic City FC", outcome="goal", xg=0.40)
    finder.process_event(goal_ev, state)
    assert finder._shots_since_goal["Synthetic City FC"] == 0
    assert finder._xg_since_goal["Synthetic City FC"] == 0.0


def test_super_sub_impact():
    finder = DataStoryFinder("Synthetic City FC", "Metro Stars FC")
    state = MatchState(home_team="Synthetic City FC", away_team="Metro Stars FC", minute=45)

    # Substitution at minute 45: O. Sissoko enters
    sub_ev = _make_event("sub_1", 45, "substitution", "Synthetic City FC", player="D. Vance", additional={"sub_on": "O. Sissoko"})
    sub_ev.recipient = "O. Sissoko"
    finder.process_event(sub_ev, state)

    # Sissoko takes a shot at minute 49 (4 minutes post-sub)
    shot_ev = _make_event("s_sis", 49, "shot", "Synthetic City FC", player="O. Sissoko", outcome="saved", xg=0.28)
    story = finder.process_event(shot_ev, state)
    assert story is not None
    assert story.story_type == "super_sub"
    assert "O. Sissoko" in story.title
    assert story.metrics["minutes_on_pitch"] == 4


def test_attacking_zones_channel_classification():
    finder = DataStoryFinder("Synthetic City FC", "Metro Stars FC")
    state = MatchState(home_team="Synthetic City FC", away_team="Metro Stars FC", minute=10)

    # 1. Left Channel entry (x: 50 -> 72, y: 20 -> 22 < 33.3)
    ev_left = _make_event("pass_left", 10, "pass", "Synthetic City FC", pos=(50.0, 20.0), end_pos=(72.0, 22.0))
    finder.process_event(ev_left, state)
    assert finder.zones.home.left.entries == 1

    # 2. Central Channel entry into penalty box (x: 55 -> 88, y: 50 -> 50)
    ev_cen = _make_event("pass_cen", 11, "pass", "Synthetic City FC", pos=(55.0, 50.0), end_pos=(88.0, 50.0))
    finder.process_event(ev_cen, state)
    assert finder.zones.home.central.entries == 1
    assert finder.zones.home.central.box_entries == 1

    # 3. Right Channel shot (x: 82, y: 75 > 66.7)
    ev_shot = _make_event("shot_r", 12, "shot", "Synthetic City FC", pos=(82.0, 75.0), xg=0.25)
    finder.process_event(ev_shot, state)
    assert finder.zones.home.right.shots == 1
    assert finder.zones.home.right.xg == 0.25


def test_goalkeeper_goals_prevented():
    finder = DataStoryFinder("Synthetic City FC", "Metro Stars FC", home_gk_name="M. Al-Mansoor", away_gk_name="L. Kincaid")
    state = MatchState(home_team="Synthetic City FC", away_team="Metro Stars FC", minute=25)

    # Synthetic City (home) takes a shot on target (xG 0.45) -> Away GK saves it
    shot1 = _make_event("s1", 25, "shot", "Synthetic City FC", outcome="saved", xg=0.45)
    finder.process_event(shot1, state)
    assert finder.keeper.away.saves == 1
    assert finder.keeper.away.goals_conceded == 0
    assert finder.keeper.away.goals_prevented == 0.45  # saved a 0.45 xG chance

    # Synthetic City takes shot on target (xG 0.15) -> scores goal
    shot2 = _make_event("s2", 28, "shot", "Synthetic City FC", outcome="goal", xg=0.15)
    finder.process_event(shot2, state)
    assert finder.keeper.away.goals_conceded == 1
    # Total xG faced: 0.60 - 1 conceded = -0.40
    assert finder.keeper.away.goals_prevented == -0.40


def test_verifier_checks_story_metrics():
    state = MatchState(
        home_team="Synthetic City FC",
        away_team="Metro Stars FC",
        minute=45,
    )
    # Story: E. Lindberg completed 20 consecutive passes
    from backend.models.data_story import DataStory
    state.latest_story = DataStory(
        story_id="story_metronome_45",
        story_type="midfield_metronome",
        title="Midfield Metronome • E. Lindberg",
        description="E. Lindberg completed 20 consecutive passes without conceding possession.",
        minute=45,
        metrics={"consecutive_passes": 20},
    )

    claims = verify_text("Lindberg controlled the rhythm with 20 consecutive passes.", state)
    metronome_claim = next((c for c in claims if c["type"] == "metronome"), None)
    assert metronome_claim is not None
    assert metronome_claim["status"] == "verified"
