"""
MatchCast AI - Comprehensive Backend Verification Suite
Tests all data models, xG calculations, momentum service, playback engine,
agent pipeline, and FastAPI endpoints.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

# Ensure root and backend directory are in sys.path
_curr_dir = Path(__file__).resolve().parent
_par_dir = _curr_dir.parent
for _p in [str(_par_dir), str(_curr_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from backend.agents.analyst_pundit import AnalystPundit
from backend.agents.data_agent import DataAgent
from backend.agents.host_orchestrator import HostOrchestrator
from backend.agents.passion_pundit import PassionPundit
from backend.agents.tactical_agent import TacticalAgent
from backend.agents.tactician_pundit import TacticianPundit
from backend.models.events import MatchData, MatchEvent, Position
from backend.models.match_state import KeyMoment, MatchState
from backend.services.match_playback import MatchPlaybackEngine
from backend.services.momentum import MomentumTracker
from backend.services.xg_model import calculate_xg


def test_xg_model() -> None:
    print("[TEST] Running xG Model tests...")

    # Penalty
    pen_event = MatchEvent(
        event_id="p1", minute=10, second=0, type="shot", subtype="penalty",
        team="Apex United", player="Player 1"
    )
    pen_xg = calculate_xg(pen_event)
    assert pen_xg == 0.76, f"Penalty xG should be 0.76, got {pen_xg}"

    # Close range central shot
    close_event = MatchEvent(
        event_id="c1", minute=12, second=0, type="shot", subtype="open_play",
        team="Apex United", player="Player 2",
        position=Position(x=95.0, y=50.0), body_part="right_foot"
    )
    close_xg = calculate_xg(close_event)
    assert close_xg > 0.40, f"Close central shot should be high xG (>0.40), got {close_xg}"

    # Long range shot
    long_event = MatchEvent(
        event_id="l1", minute=15, second=0, type="shot", subtype="open_play",
        team="Apex United", player="Player 3",
        position=Position(x=65.0, y=50.0), body_part="right_foot"
    )
    long_xg = calculate_xg(long_event)
    assert long_xg < 0.15, f"Long range shot should be low xG (<0.15), got {long_xg}"

    print(f" -> xG Model verified (penalty={pen_xg}, close={close_xg}, long={long_xg})")


def test_momentum_tracker() -> None:
    print("[TEST] Running Momentum Tracker tests...")
    tracker = MomentumTracker(window_minutes=5, swing_threshold=20.0)

    # Add home passes and shot
    for i in range(5):
        tracker.add_event(MatchEvent(
            event_id=f"e{i}", minute=2, second=i * 10, type="pass",
            team="Home Team", player="Player H", position=Position(x=70.0, y=50.0), success=True
        ))

    tracker.add_event(MatchEvent(
        event_id="shot1", minute=3, second=0, type="shot",
        team="Home Team", player="Player H", position=Position(x=90.0, y=50.0), xG=0.5
    ))

    stats = tracker.calculate_rolling_momentum(current_minute=3, home_team="Home Team", away_team="Away Team")
    assert stats.home > 60.0, f"Home team momentum should be dominant (>60), got {stats.home}"
    print(f" -> Momentum Tracker verified (Home: {stats.home}%, Away: {stats.away}%, Swing: {stats.swing})")


def test_playback_engine() -> None:
    print("[TEST] Running Match Playback Engine tests...")
    match_file = Path(__file__).resolve().parent.parent / "data" / "matches" / "synthetic_derby.json"
    assert match_file.exists(), f"Synthetic match file does not exist at {match_file}"

    playback = MatchPlaybackEngine.from_file(match_file)
    assert playback.match_data is not None
    assert len(playback.match_data.events) == 30

    # Test seek
    playback.seek(45)
    assert playback.current_minute >= 45
    print(f" -> Playback Engine verified (seek to 45 => event idx {playback.current_index})")


async def test_agent_pipeline() -> None:
    print("[TEST] Running Multi-Agent Pipeline tests...")

    data_agent = DataAgent(home_team="Apex United", away_team="Titan City", match_id="test_match")
    tactical_agent = TacticalAgent()
    tactician = TacticianPundit()
    passion = PassionPundit()
    analyst = AnalystPundit()
    host = HostOrchestrator(tactician=tactician, passion=passion, analyst=analyst)

    # 1. Process goal event
    goal_event = MatchEvent(
        event_id="goal_1", minute=23, second=10, type="goal", subtype="open_play",
        team="Apex United", player="Dominic Drake", position=Position(x=92.0, y=50.0),
        xG=0.55, outcome="goal"
    )
    state, key_moment = data_agent.process_event(goal_event)

    assert state.score.home == 1
    assert state.score.away == 0
    assert key_moment is not None
    assert key_moment.importance == "HIGH"
    print(f" -> DataAgent processed goal (Score: {state.score.home}-{state.score.away}, KeyMoment: {key_moment.description})")

    # 2. Tactical Agent analysis
    tactical_agent.update_history(goal_event)
    insight = await tactical_agent.analyze(state, key_moment)
    assert insight.narrative_context
    print(f" -> TacticalAgent insight: {insight.narrative_context[:80]}...")

    # 3. Host Orchestrator debate
    debate = await host.orchestrate_moment(key_moment, state, insight, audience_mode="fan")
    assert len(debate.pundits) == 3, f"HIGH importance moment should trigger 3 pundits, got {len(debate.pundits)}"
    assert debate.agreement_score >= 0.0
    print(f" -> HostOrchestrator debate generated with {len(debate.pundits)} pundits (agreement: {debate.agreement_score})")
    for p in debate.pundits:
        print(f"    - {p.name}: \"{p.comment[:70]}...\" [{p.sentiment}]")

    # 4. Host Q&A handling
    answer = await host.handle_question(
        "Why did the defense leave Drake completely unmarked in the six-yard box?",
        state, insight, audience_mode="scout"
    )
    assert len(answer.answers) > 0
    print(f" -> HostOrchestrator Q&A handled with {len(answer.answers)} responses")

    # 5. Match Personality at Full Time
    personality = await host.generate_match_personality(state, data_agent.key_moments)
    assert len(personality.tags) > 0
    print(f" -> Match Personality tags: {personality.tags}")


def test_fastapi_endpoints() -> None:
    print("[TEST] Running FastAPI endpoints test via TestClient...")
    from fastapi.testclient import TestClient
    from backend.main import app

    client = TestClient(app)

    # Health check
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    # List matches
    res = client.get("/api/matches")
    assert res.status_code == 200
    matches = res.json()["matches"]
    assert len(matches) > 0, "Should list at least one match"
    print(f" -> Listed {len(matches)} match files")

    # Ask endpoint
    res = client.post("/api/match/synthetic_derby/ask", json={"question": "What is the xG differential?", "mode": "fan"})
    assert res.status_code == 200
    ans = res.json()
    assert "answers" in ans
    print(f" -> Ask endpoint responded with {len(ans['answers'])} answers")

    # Mode endpoint
    res = client.post("/api/match/synthetic_derby/mode", json={"mode": "scout"})
    assert res.status_code == 200
    assert res.json()["audience_mode"] == "scout"

    # State endpoint
    res = client.get("/api/match/synthetic_derby/state")
    assert res.status_code == 200
    print(f" -> State endpoint: {res.json()['match_id']}")

    # Events endpoint
    res_ev = client.get("/api/match/synthetic_derby/events")
    assert res_ev.status_code == 200
    assert "events" in res_ev.json()
    assert res_ev.json()["total_events"] > 0
    print(f" -> Events endpoint: {res_ev.json()['total_events']} events fetched")

    # Session-isolated unscripted match generation (Acceptance Test 6)
    res_a = client.post("/api/match/generate-live?session_id=visitor_alice")
    assert res_a.status_code == 200
    res_b = client.post("/api/match/generate-live?session_id=visitor_bob")
    assert res_b.status_code == 200
    assert res_a.json()["match_id"] != res_b.json()["match_id"]
    print(f" -> Session-isolated matches: {res_a.json()['match_id']} != {res_b.json()['match_id']}")

    # SPA routing verification (tested when frontend has been built)
    from backend.main import _frontend_dist
    if _frontend_dist.exists() and (_frontend_dist / "index.html").exists():
        for spa_path in ["/", "/matches", "/matches/match_001_comeback"]:
            res_spa = client.get(spa_path)
            assert res_spa.status_code == 200
        print(" -> SPA routes successfully serve index.html")
    else:
        print(" -> Frontend dist not built in current environment; skipping SPA route checks")


async def main() -> None:
    print("=" * 60)
    print("MATCHCAST AI BACKEND TEST SUITE")
    print("=" * 60)
    test_xg_model()
    test_momentum_tracker()
    test_playback_engine()
    await test_agent_pipeline()
    test_fastapi_endpoints()
    print("=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
