"""
MatchCast AI - Main FastAPI Application Server
Integrates REST API, WebSocket real-time event streaming, multi-agent orchestration,
and match replay session management.
"""

import sys
from pathlib import Path

# Ensure backend package resolution works whether started from project root or backend dir
_curr_dir = Path(__file__).resolve().parent
_par_dir = _curr_dir.parent
for _dir_path in [str(_par_dir), str(_curr_dir)]:
    if _dir_path not in sys.path:
        sys.path.insert(0, _dir_path)

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Set

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.agents.analyst_pundit import AnalystPundit
from backend.agents.data_agent import DataAgent
from backend.agents.host_orchestrator import HostOrchestrator
from backend.agents.passion_pundit import PassionPundit
from backend.agents.tactical_agent import TacticalAgent
from backend.agents.tactician_pundit import TacticianPundit
from backend.config import settings
from backend.models.events import MatchData, MatchEvent
from backend.services.overlays import FOCUS_METRICS, LANGUAGES, ViewerProfile, build_overlays, roster
from backend.services.verifier import VerificationTracker, verify_debate
from backend.models.match_state import KeyMoment, MatchState
from backend.models.panel_output import MatchPersonality, PanelAnswer, PanelDebate, TacticalInsight
from backend.services.match_playback import MatchPlaybackEngine
from backend.mcp_server import mcp_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("matchcast.server")

app = FastAPI(
    title="MatchCast AI Backend",
    version="1.0.0",
    description="Multi-Agent Premier League Synthetic Match Analysis & AI Pundit Panel",
)

# Mount Model Context Protocol (MCP) server endpoints
app.include_router(mcp_router)

# CORS Middleware (permitting all local & dev origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Session Management & State Store
# ==========================================

class QuestionRequest(BaseModel):
    """User Q&A request payload."""
    question: str
    mode: Optional[str] = None
    language: Optional[str] = "en"


class ModeRequest(BaseModel):
    """Audience framing mode update request payload."""
    mode: str = Field(..., description="'fan', 'scout', or 'broadcaster'")


class MatchSession:
    """Encapsulates active playback runtime, data streams, and connected WebSockets."""

    def __init__(self, match_data: MatchData) -> None:
        self.match_id = match_data.match_id
        self.match_data = match_data
        self.audience_mode: str = "fan"
        self.profile = ViewerProfile()
        self.verification = VerificationTracker()

        # Initialize agent pipeline
        self.data_agent = DataAgent(
            home_team=match_data.home_team,
            away_team=match_data.away_team,
            match_id=match_data.match_id,
        )
        self.tactical_agent = TacticalAgent()
        self.tactician = TacticianPundit()
        self.passion = PassionPundit()
        self.analyst = AnalystPundit()
        self.host_orchestrator = HostOrchestrator(
            tactician=self.tactician,
            passion=self.passion,
            analyst=self.analyst,
        )

        # Playback engine
        self.playback = MatchPlaybackEngine(match_data=match_data, base_event_delay=1.2)

        # Real-time state
        self.latest_state: Optional[MatchState] = None
        self.latest_insight: Optional[TacticalInsight] = None
        self.latest_debate: Optional[PanelDebate] = None
        self.match_personality: Optional[MatchPersonality] = None
        self.half_time_debated: bool = False

        # WebSocket subscribers
        self.connected_websockets: Set[WebSocket] = set()

        # Replay background task
        self.playback_task: Optional[asyncio.Task] = None

    async def broadcast(self, message_type: str, payload: Any) -> None:
        """Broadcast structured JSON message to all active WebSocket clients."""
        if not self.connected_websockets:
            return

        # Prepare payload dictionary
        data_dict = payload.model_dump() if hasattr(payload, "model_dump") else payload
        message = json.dumps({"type": message_type, "data": data_dict})

        disconnected: List[WebSocket] = []
        for ws in list(self.connected_websockets):
            try:
                await ws.send_text(message)
            except Exception as exc:
                logger.debug("Failed sending to client (%s), marking disconnect", exc)
                disconnected.append(ws)

        for ws in disconnected:
            self.connected_websockets.discard(ws)


active_sessions: Dict[str, MatchSession] = {}


def find_match_file(match_id: str) -> Optional[Path]:
    """Search for match file by id in DATA_DIR."""
    data_dir = settings.data_dir
    if not data_dir.exists():
        return None

    # Check direct match_id.json
    exact = data_dir / f"{match_id}.json"
    if exact.exists():
        return exact

    # Check case-insensitive or files without extension
    for file in data_dir.glob("*.json"):
        if file.stem.lower() == match_id.lower() or file.name.lower() == match_id.lower():
            return file

    return None


def make_session_key(match_id: str, session_id: Optional[str] = None) -> str:
    """Creates an isolated session key per visitor and match, preventing multi-judge interference."""
    if session_id:
        return f"{session_id}:{match_id}"
    return match_id


def get_or_create_session(match_id: str, session_id: Optional[str] = None) -> MatchSession:
    """Retrieve existing session or initialize from match data file for a specific client/visitor."""
    key = make_session_key(match_id, session_id)
    if key in active_sessions:
        return active_sessions[key]

    file_path = find_match_file(match_id)
    if not file_path:
        raise HTTPException(
            status_code=404,
            detail=f"Match with ID '{match_id}' not found in data directory ({settings.data_dir}).",
        )

    with open(file_path, "r", encoding="utf-8") as f:
        raw_json = json.load(f)

    match_data = MatchData(**raw_json).normalize_team_labels()
    session = MatchSession(match_data)
    active_sessions[key] = session
    return session


# ==========================================
# Background Playback Task Loop
# ==========================================

async def run_match_stream(session: MatchSession) -> None:
    """
    Core streaming loop:
    Yields MatchEvent -> DataAgent -> TacticalAgent -> HostOrchestrator -> WebSockets.
    """
    logger.info("Starting live match playback stream for match: %s", session.match_id)

    try:
        async for event in session.playback.stream_events():
            # 1. Feed event to Data Agent
            match_state, key_moment = session.data_agent.process_event(event)
            session.latest_state = match_state

            # Half-Time debrief trigger
            if not session.half_time_debated and (event.type == "half_time" or (event.minute == 45 and event.second == 0 and match_state.events_processed > 50)):
                session.half_time_debated = True
                ht_moment = KeyMoment(
                    minute=45,
                    second=0,
                    type="half_time",
                    description=f"Half-Time Whistle: {match_state.home_team} {match_state.score.home}-{match_state.score.away} {match_state.away_team} - Tactical Analysis",
                    importance="HIGH",
                )
                try:
                    ht_insight = await session.tactical_agent.analyze(match_state, ht_moment)
                    ht_debate = await session.host_orchestrator.orchestrate_moment(
                        key_moment=ht_moment,
                        match_state=match_state,
                        tactical_insight=ht_insight,
                        audience_mode=session.audience_mode,
                    )
                    verify_debate(ht_debate, match_state, session.verification)
                    session.latest_debate = ht_debate
                    await session.broadcast("panel_debate", ht_debate)
                    await session.broadcast("verification_stats", session.verification.snapshot())
                except Exception as ht_exc:
                    logger.warning("Error generating half-time debate: %s", ht_exc)

            # 2. Feed event to Tactical Agent for sliding spatial buffer
            session.tactical_agent.update_history(event)

            # 3. Broadcast real-time event and state to frontend
            await session.broadcast("match_event", event)
            await session.broadcast("match_state", match_state)

            # 3b. Instant, code-only broadcast overlays (personalized per viewer profile)
            overlays = build_overlays(
                event, session.profile, {"home": match_state.score.home, "away": match_state.score.away}
            )
            if overlays:
                await session.broadcast("overlay", overlays)

            # 4. If a key moment occurred, trigger the multi-agent tactical and pundit pipeline
            if key_moment:
                logger.info("Key Moment detected at min %d: %s", key_moment.minute, key_moment.description)

                # Tactical Agent synthesizes pattern and narrative
                tactical_insight = await session.tactical_agent.analyze(match_state, key_moment)
                session.latest_insight = tactical_insight

                # Host orchestrates pundits debate
                panel_debate = await session.host_orchestrator.orchestrate_moment(
                    key_moment=key_moment,
                    match_state=match_state,
                    tactical_insight=tactical_insight,
                    audience_mode=session.audience_mode,
                )
                # Verifier: fact-check every number the pundits quoted against computed state
                verify_debate(panel_debate, match_state, session.verification)
                session.latest_debate = panel_debate

                # Broadcast debate panel reaction + running verification tally
                await session.broadcast("panel_debate", panel_debate)
                await session.broadcast("verification_stats", session.verification.snapshot())

        # 5. Full time reached: set status, generate final post-match debate and personality
        if session.latest_state:
            logger.info("Match %s reached full time. Generating match personality.", session.match_id)
            session.latest_state.status = "full_time"
            await session.broadcast("match_state", session.latest_state)

            try:
                ft_moment = KeyMoment(
                    minute=session.latest_state.minute,
                    type="full_time",
                    description=f"Full-Time Whistle: {session.latest_state.home_team} {session.latest_state.score.home}-{session.latest_state.score.away} {session.latest_state.away_team}",
                    importance="HIGH",
                )
                ft_insight = await session.tactical_agent.analyze(session.latest_state, ft_moment)
                ft_debate = await session.host_orchestrator.orchestrate_moment(
                    key_moment=ft_moment,
                    match_state=session.latest_state,
                    tactical_insight=ft_insight,
                    audience_mode=session.audience_mode,
                )
                verify_debate(ft_debate, session.latest_state, session.verification)
                session.latest_debate = ft_debate
                await session.broadcast("panel_debate", ft_debate)
                await session.broadcast("verification_stats", session.verification.snapshot())
            except Exception as ft_exc:
                logger.warning("Error generating post-match debate (%s): %s", session.match_id, ft_exc)

            personality = await session.host_orchestrator.generate_match_personality(
                session.latest_state, session.data_agent.key_moments
            )
            session.match_personality = personality
            await session.broadcast("match_personality", personality)

    except asyncio.CancelledError:
        logger.info("Match playback loop cancelled for match: %s", session.match_id)
    except Exception as exc:
        logger.error("Error in match playback loop for %s: %s", session.match_id, exc, exc_info=True)


# ==========================================
# REST API Endpoints
# ==========================================

@app.get("/api/matches")
def list_matches() -> Dict[str, Any]:
    """List all available match files in data directory."""
    data_dir = settings.data_dir
    data_dir.mkdir(parents=True, exist_ok=True)

    matches_info: List[Dict[str, Any]] = []
    for file in data_dir.glob("*.json"):
        try:
            with open(file, "r", encoding="utf-8") as f:
                content = json.load(f)
                matches_info.append({
                    "match_id": content.get("match_id", file.stem),
                    "file_name": file.name,
                    "home_team": content.get("home_team", "Unknown"),
                    "away_team": content.get("away_team", "Unknown"),
                    "events_count": len(content.get("events", [])),
                })
        except Exception as exc:
            logger.warning("Error reading match file %s: %s", file, exc)

    return {"matches": matches_info, "data_dir": str(data_dir)}


@app.post("/api/match/generate-live")
def generate_live_unscripted_match(session_id: Optional[str] = Query(None)) -> Dict[str, Any]:
    """Generates a dynamic, unscripted match on demand with randomized seeds, goals, and cards.
    Maintains session isolation so generating a match does not interfere with other visitors.
    """
    try:
        from data.generate_matches import generate_unscripted_live_match
    except ImportError:
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from data.generate_matches import generate_unscripted_live_match

    match_dict = generate_unscripted_live_match()
    data_dir = settings.data_dir
    data_dir.mkdir(parents=True, exist_ok=True)

    if session_id:
        safe_sid = "".join(c for c in session_id if c.isalnum() or c in ("-", "_"))[:32]
        match_id = f"match_live_{safe_sid}"
    else:
        match_id = "match_live_unscripted"

    match_dict["match_id"] = match_id
    out_file = data_dir / f"{match_id}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(match_dict, f, indent=2)

    # Invalidate only cached sessions belonging to this visitor/match
    target_keys: List[str] = []
    if session_id:
        target_keys = [f"{session_id}:{match_id}", match_id]
    else:
        target_keys = [k for k in active_sessions.keys() if k == match_id or k.endswith(f":{match_id}")]

    for k in target_keys:
        old_sess = active_sessions.pop(k, None)
        if old_sess and old_sess.playback_task and not old_sess.playback_task.done():
            old_sess.playback.stop()
            old_sess.playback_task.cancel()

    return {
        "status": "generated",
        "match_id": match_dict["match_id"],
        "home_team": match_dict["home_team"],
        "away_team": match_dict["away_team"],
        "events_count": len(match_dict["events"]),
    }


@app.post("/api/match/{match_id}/start")
async def start_match_playback(
    match_id: str,
    speed: float = Query(default=1.0, ge=0.1, le=100.0, description="Playback multiplier (1x to 100x)"),
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """Start or restart live replay of the selected match for this visitor."""
    # 1. Stop and cancel only previous running tasks belonging to THIS visitor session
    if session_id:
        for other_key, other_sess in list(active_sessions.items()):
            if other_key.startswith(f"{session_id}:") and other_sess.playback_task and not other_sess.playback_task.done():
                logger.info("Stopping previous playback for visitor %s session: %s", session_id, other_key)
                other_sess.playback.stop()
                other_sess.playback_task.cancel()
                try:
                    await other_sess.playback_task
                except (asyncio.CancelledError, Exception):
                    pass
    else:
        # Fallback for headless tests without session_id
        for other_id, other_sess in list(active_sessions.items()):
            if ":" not in other_id and other_id != match_id and other_sess.playback_task and not other_sess.playback_task.done():
                logger.info("Stopping background playback session for match: %s", other_id)
                other_sess.playback.stop()
                other_sess.playback_task.cancel()
                try:
                    await other_sess.playback_task
                except (asyncio.CancelledError, Exception):
                    pass

    session = get_or_create_session(match_id, session_id)

    # 2. Cancel previous running task if present for this match
    if session.playback_task and not session.playback_task.done():
        session.playback.stop()
        session.playback_task.cancel()
        try:
            await session.playback_task
        except (asyncio.CancelledError, Exception):
            pass

    effective_speed = float(getattr(speed, "default", speed))
    session.playback.stop()
    session.playback.current_index = 0
    session.playback.current_minute = 0
    session.playback._stop_requested = False
    session.playback.is_paused = False
    session.playback._pause_event.set()
    session.playback.set_speed(effective_speed)

    session.data_agent.reset(
        home_team=session.match_data.home_team,
        away_team=session.match_data.away_team,
        match_id=match_id,
    )
    session.tactical_agent = TacticalAgent()
    session.latest_state = None
    session.latest_insight = None
    session.latest_debate = None
    session.match_personality = None
    session.half_time_debated = False
    session.verification = VerificationTracker()

    # 4. Launch streaming loop
    session.playback_task = asyncio.create_task(run_match_stream(session))

    return {
        "status": "started",
        "match_id": match_id,
        "session_id": session_id,
        "speed": effective_speed,
        "current_minute": 0,
    }


@app.post("/api/match/{match_id}/speed")
def set_match_playback_speed(
    match_id: str,
    speed: float = Query(..., ge=0.1, le=100.0, description="Replay speed multiplier (e.g. 0.5, 1, 2, 5, 10, 50)"),
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """Change live playback speed on the fly without restarting replay."""
    session = get_or_create_session(match_id, session_id)
    session.playback.set_speed(speed)
    return {"status": "updated", "match_id": match_id, "speed": speed}


@app.post("/api/match/{match_id}/pause")
def pause_match_playback(
    match_id: str,
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """Pause live replay."""
    session = get_or_create_session(match_id, session_id)
    session.playback.pause()
    return {"status": "paused", "match_id": match_id, "minute": session.playback.current_minute}


@app.post("/api/match/{match_id}/resume")
def resume_match_playback(
    match_id: str,
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """Resume live replay from pause."""
    session = get_or_create_session(match_id, session_id)
    session.playback.resume()
    return {"status": "resumed", "match_id": match_id, "minute": session.playback.current_minute}


@app.post("/api/match/{match_id}/seek")
async def seek_match_playback(
    match_id: str,
    minute: int = Query(..., ge=0, le=120),
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """
    Jump replay pointer to target minute and accurately reconstruct all cumulative stats.
    Prevents stat inflation, reset drift, and duplicate score counts.
    """
    session = get_or_create_session(match_id, session_id)
    new_index = session.playback.seek(minute)

    # 1. Reset data agent and tactical agent to clean slate
    session.data_agent.reset(
        home_team=session.match_data.home_team,
        away_team=session.match_data.away_team,
        match_id=match_id,
    )
    session.tactical_agent = TacticalAgent()
    session.half_time_debated = (minute >= 45)

    # 2. Silently replay events from index 0 up to new_index to accurately reconstruct state
    reconstructed_state: Optional[MatchState] = None
    all_events = session.match_data.events or []
    events_to_replay = all_events[:new_index]

    for ev in events_to_replay:
        reconstructed_state, _ = session.data_agent.process_event(ev)
        session.tactical_agent.update_history(ev)

    if reconstructed_state is None:
        reconstructed_state = session.data_agent.get_initial_state()

    session.latest_state = reconstructed_state

    # 3. Broadcast seek_reset and updated state to all connected WebSocket clients
    last_event = events_to_replay[-1] if events_to_replay else None
    keep_events_list = [ev.model_dump() for ev in events_to_replay[-40:]] if events_to_replay else []

    await session.broadcast("seek_reset", {
        "minute": minute,
        "event_index": new_index,
        "keep_events": keep_events_list,
    })
    await session.broadcast("match_state", reconstructed_state)
    if last_event:
        await session.broadcast("match_event", last_event)

    return {
        "status": "seeked",
        "match_id": match_id,
        "minute": minute,
        "event_index": new_index,
        "state": reconstructed_state.model_dump(),
    }


@app.post("/api/match/{match_id}/ask")
async def ask_pundit_panel(
    match_id: str,
    payload: QuestionRequest,
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """Submit a question to the host and pundit panel."""
    try:
        session = get_or_create_session(match_id, session_id)
        mode = payload.mode or session.audience_mode

        # Use current state or create baseline state
        state = session.latest_state or MatchState(
            match_id=match_id,
            home_team=session.match_data.home_team,
            away_team=session.match_data.away_team,
        )
        insight = session.latest_insight or TacticalInsight(
            patterns=["Balanced positioning"],
            narrative_context=f"Ongoing clash between {session.match_data.home_team} and {session.match_data.away_team}.",
        )

        lang = (payload.language or getattr(session.profile, "language", "en") or "en").lower().strip()
        panel_answer = await session.host_orchestrator.handle_question(
            question=payload.question,
            match_state=state,
            tactical_insight=insight,
            audience_mode=mode,
            language=lang,
        )

        verify_debate(panel_answer, state, session.verification)

        # Broadcast to all connected viewers
        await session.broadcast("panel_answer", panel_answer)
        await session.broadcast("verification_stats", session.verification.snapshot())

        return panel_answer.model_dump()
    except Exception as exc:
        logger.error("Error in ask_pundit_panel for match %s: %s", match_id, exc, exc_info=True)
        # Return multilingual localized fallback answer
        from backend.models.panel_output import PunditComment

        fallback_summaries = {
            "en": "Great question from the audience. Our pundits have analyzed the tactical numbers:",
            "hi": "दर्शकों की ओर से बेहतरीन सवाल। हमारे विश्लेषकों ने सामरिक आंकड़ों का विश्लेषण किया है:",
            "es": "Gran pregunta de la audiencia. Nuestros analistas han evaluado los números tácticos:",
        }
        fallback_tactician = {
            "en": "The structural spacing and transition channels remain the focal point of both managers' tactics.",
            "hi": "संरचनात्मक अंतराल और संक्रमण चैनल दोनों प्रबंधकों की रणनीतियों का मुख्य केंद्र बने हुए हैं।",
            "es": "El espaciado estructural y las transiciones siguen siendo el foco táctico de ambos entrenadores.",
        }
        fallback_analyst = {
            "en": "The underlying possession and expected goals distribution validate the tactical choices made so far.",
            "hi": "गेंद पर नियंत्रण और संभावित गोल (xG) का वितरण अब तक लिए गए सामरिक निर्णयों की पुष्टि करता है।",
            "es": "La distribución de posesión y goles esperados valida las decisiones tácticas tomadas hasta ahora.",
        }

        chosen_lang = lang if lang in fallback_summaries else "en"
        fallback = PanelAnswer(
            question=payload.question,
            host_summary=fallback_summaries[chosen_lang],
            answers=[
                PunditComment(
                    id="tactician",
                    name="The Tactician",
                    comment=fallback_tactician[chosen_lang],
                    sentiment="neutral",
                    confidence=0.88,
                ),
                PunditComment(
                    id="analyst",
                    name="The Quant Analyst",
                    comment=fallback_analyst[chosen_lang],
                    sentiment="neutral",
                    confidence=0.92,
                ),
            ],
            audience_mode=payload.mode or "fan",
        )
        return fallback.model_dump()


@app.post("/api/match/{match_id}/mode")
def set_audience_mode(
    match_id: str,
    payload: ModeRequest,
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """Change audience framing mode: 'fan', 'scout', or 'broadcaster'."""
    mode = payload.mode.lower().strip()
    if mode not in ("fan", "scout", "broadcaster"):
        raise HTTPException(
            status_code=400,
            detail="Mode must be one of: 'fan', 'scout', 'broadcaster'",
        )

    session = get_or_create_session(match_id, session_id)
    session.audience_mode = mode
    session.profile.mode = mode
    logger.info("Audience mode updated to %s for match %s", mode, match_id)
    return {"status": "updated", "match_id": match_id, "audience_mode": mode}


@app.get("/api/match/{match_id}/profile")
def get_viewer_profile(
    match_id: str,
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """Current viewer profile (language, favourite club/player, player-focus, single metric)."""
    session = get_or_create_session(match_id, session_id)
    return {"profile": session.profile.model_dump(), "languages": list(LANGUAGES), "focus_metrics": list(FOCUS_METRICS)}


@app.post("/api/match/{match_id}/profile")
def set_viewer_profile(
    match_id: str,
    payload: ViewerProfile,
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """Personalize the experience: changes which overlays are emitted and how they are worded."""
    if payload.language not in LANGUAGES:
        raise HTTPException(status_code=400, detail=f"language must be one of {list(LANGUAGES)}")
    if payload.focus_metric not in FOCUS_METRICS:
        raise HTTPException(status_code=400, detail=f"focus_metric must be one of {list(FOCUS_METRICS)}")
    if payload.mode not in ("fan", "scout", "broadcaster"):
        raise HTTPException(status_code=400, detail="mode must be one of: fan, scout, broadcaster")
    session = get_or_create_session(match_id, session_id)
    session.profile = payload
    session.audience_mode = payload.mode
    return {"status": "updated", "profile": payload.model_dump()}


@app.get("/api/match/{match_id}/players")
def get_players(
    match_id: str,
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """Roster for the favourite-player picker."""
    session = get_or_create_session(match_id, session_id)
    md = session.match_data
    return {"home_team": md.home_team, "away_team": md.away_team, **roster(md.events, md.home_team, md.away_team)}


@app.get("/api/match/{match_id}/verification")
def get_verification(
    match_id: str,
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """Running tally of verified / wrong / unsupported pundit claims."""
    session = get_or_create_session(match_id, session_id)
    return session.verification.snapshot()


@app.get("/api/match/{match_id}/state")
def get_match_state(
    match_id: str,
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """Fetch snapshot of the current match state."""
    session = get_or_create_session(match_id, session_id)
    if session.latest_state:
        return session.latest_state.model_dump()

    return {
        "match_id": match_id,
        "home_team": session.match_data.home_team,
        "away_team": session.match_data.away_team,
        "minute": session.playback.current_minute,
        "is_running": session.playback.is_running,
        "is_paused": session.playback.is_paused,
    }


@app.get("/api/match/{match_id}/events")
def get_match_events(
    match_id: str,
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> Dict[str, Any]:
    """All events for the match for complete heatmap and spatial verification."""
    session = get_or_create_session(match_id, session_id)
    md = session.match_data
    return {
        "match_id": match_id,
        "home_team": md.home_team,
        "away_team": md.away_team,
        "total_events": len(md.events),
        "events": [ev.model_dump() for ev in md.events],
    }


# ==========================================
# WebSocket Endpoint
# ==========================================

@app.websocket("/ws/match/{match_id}")
async def match_websocket_endpoint(
    websocket: WebSocket,
    match_id: str,
    session_id: Optional[str] = Query(default=None, description="Per-visitor client session ID"),
) -> None:
    """
    Real-time WebSocket endpoint streaming match_state, match_event,
    panel_debate, panel_answer, and match_personality.
    """
    await websocket.accept()

    try:
        session = get_or_create_session(match_id, session_id)
    except Exception as exc:
        logger.warning("Session init failed for websocket (%s): %s", match_id, exc)
        await websocket.send_text(json.dumps({"type": "error", "message": f"Match '{match_id}' not found"}))
        await websocket.close()
        return

    session.connected_websockets.add(websocket)
    logger.info("WebSocket connected for match: %s (session %s). Total clients: %d", match_id, session_id, len(session.connected_websockets))

    # Send current state immediately on connect if active playback is underway
    if session.latest_state and session.playback.is_running:
        await websocket.send_text(
            json.dumps({"type": "match_state", "data": session.latest_state.model_dump()})
        )
    if session.latest_debate and session.playback.is_running:
        await websocket.send_text(
            json.dumps({"type": "panel_debate", "data": session.latest_debate.model_dump()})
        )

    try:
        while True:
            # Listen for client messages (e.g. ping, direct question via WS)
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                msg_type = data.get("type")
                if msg_type == "ask":
                    q = data.get("question", "")
                    if q:
                        state = session.latest_state or MatchState(
                            match_id=match_id,
                            home_team=session.match_data.home_team,
                            away_team=session.match_data.away_team,
                        )
                        insight = session.latest_insight or TacticalInsight(
                            patterns=[],
                            narrative_context="Live match underway.",
                        )
                        answer = await session.host_orchestrator.handle_question(
                            question=q,
                            match_state=state,
                            tactical_insight=insight,
                            audience_mode=session.audience_mode,
                        )
                        verify_debate(answer, state, session.verification)
                        await session.broadcast("panel_answer", answer)
                        await session.broadcast("verification_stats", session.verification.snapshot())
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        session.connected_websockets.discard(websocket)
        logger.info("WebSocket disconnected for match: %s", match_id)
    except Exception as exc:
        session.connected_websockets.discard(websocket)
        logger.warning("WebSocket error for match %s: %s", match_id, exc)


@app.get("/health")
def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "MatchCast AI Backend",
        "azure_configured": str(settings.is_azure_configured),
    }


# ==========================================
# Frontend SPA Static Mount (if built)
# ==========================================

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

_frontend_dist = _par_dir / "frontend" / "dist"
if _frontend_dist.exists() and (_frontend_dist / "index.html").exists():
    _assets_dir = _frontend_dist / "assets"
    if _assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa_frontend(full_path: str):
        # Exclude API and WebSocket routes
        if full_path.startswith(("api/", "ws/", "health", "docs", "openapi.json")):
            raise HTTPException(status_code=404, detail="Not found")

        file_candidate = _frontend_dist / full_path
        if file_candidate.exists() and file_candidate.is_file() and full_path != "":
            return FileResponse(file_candidate)
        return FileResponse(
            _frontend_dist / "index.html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )

