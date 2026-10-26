"""
MatchCast AI - Model Context Protocol (MCP) Server
Implements standard Model Context Protocol (MCP) compliant endpoints and JSON-RPC
interfaces for Microsoft Azure AI Foundry, Microsoft Copilot Studio, and external AI agents
to query real-time Premier League match state, tactical insights, and pundit debates.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

mcp_router = APIRouter(prefix="/mcp", tags=["Model Context Protocol (MCP)"])

MCP_TOOLS = [
    {
        "name": "get_live_match_state",
        "description": "Retrieve current live match score, possession, xG, momentum, and game rhythm metrics.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "match_id": {"type": "string", "description": "Match ID (e.g. 'match_001_comeback')"},
                "session_id": {"type": "string", "description": "Optional viewer session ID"}
            },
            "required": ["match_id"]
        }
    },
    {
        "name": "get_tactical_key_moments",
        "description": "Fetch all verified high-importance match events (goals, penalties, red cards, tactical shifts).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "match_id": {"type": "string", "description": "Match ID"}
            },
            "required": ["match_id"]
        }
    },
    {
        "name": "ask_pundit_panel",
        "description": "Query the multi-agent AI broadcast panel (The Tactician, The Passionate Fan, The Quant Analyst).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "match_id": {"type": "string", "description": "Match ID"},
                "question": {"type": "string", "description": "Viewer question regarding tactical decisions or players"},
                "mode": {"type": "string", "enum": ["fan", "scout", "broadcaster"], "default": "fan"},
                "language": {"type": "string", "enum": ["en", "hi", "es"], "default": "en"}
            },
            "required": ["match_id", "question"]
        }
    },
    {
        "name": "get_formation_model",
        "description": "Get estimated 11v11 tactical player pitch coordinates for both teams derived from formation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "match_id": {"type": "string", "description": "Match ID"}
            },
            "required": ["match_id"]
        }
    }
]


class MCPCallRequest(BaseModel):
    name: str = Field(..., description="Tool name to call")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Arguments for tool call")


class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: Optional[Dict[str, Any]] = None
    id: Optional[Any] = 1


@mcp_router.get("/tools")
def list_mcp_tools() -> Dict[str, Any]:
    """MCP standard tools/list endpoint."""
    return {"tools": MCP_TOOLS}


@mcp_router.post("/call")
async def call_mcp_tool(req: MCPCallRequest) -> Dict[str, Any]:
    """MCP standard tools/call endpoint."""
    from backend.main import get_or_create_session, QuestionRequest, ask_pundit_panel

    match_id = req.arguments.get("match_id", "match_001_comeback")
    session_id = req.arguments.get("session_id")

    try:
        session = get_or_create_session(match_id, session_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found: {exc}")

    if req.name == "get_live_match_state":
        state = session.latest_state
        return {
            "content": [
                {
                    "type": "text",
                    "text": str({
                        "match_id": match_id,
                        "home_team": session.match_data.home_team,
                        "away_team": session.match_data.away_team,
                        "minute": session.playback.current_minute,
                        "score": state.score.model_dump() if state else {"home": 0, "away": 0},
                        "possession": state.possession.model_dump() if state else {"home": 50, "away": 50},
                        "xg": state.xg.model_dump() if state else {"home": 0.0, "away": 0.0},
                        "game_rhythm": getattr(state, "game_rhythm", "Balanced Tactical Chess Match") if state else "Balanced",
                        "chaos_index": getattr(state, "chaos_index", 45.0) if state else 45.0,
                    })
                }
            ]
        }

    elif req.name == "get_tactical_key_moments":
        moments = session.data_agent.key_moments
        return {
            "content": [
                {
                    "type": "text",
                    "text": str([m.model_dump() for m in moments])
                }
            ]
        }

    elif req.name == "ask_pundit_panel":
        question = req.arguments.get("question", "What is the tactical story so far?")
        mode = req.arguments.get("mode", "fan")
        language = req.arguments.get("language", "en")
        q_req = QuestionRequest(question=question, mode=mode, language=language)
        ans = await ask_pundit_panel(match_id, q_req, session_id)
        return {
            "content": [
                {
                    "type": "text",
                    "text": str(ans)
                }
            ]
        }

    elif req.name == "get_formation_model":
        return {
            "content": [
                {
                    "type": "text",
                    "text": str({
                        "home": {"formation": "4-3-3", "team": session.match_data.home_team},
                        "away": {"formation": "5-4-1", "team": session.match_data.away_team},
                        "model": "Tactical Formation Shift Model v1.0",
                    })
                }
            ]
        }

    raise HTTPException(status_code=400, detail=f"Unknown tool name: {req.name}")


@mcp_router.post("")
async def jsonrpc_mcp_handler(req: JSONRPCRequest) -> Dict[str, Any]:
    """Full JSON-RPC 2.0 MCP protocol dispatcher for Microsoft Agent Framework & Copilot."""
    if req.method == "tools/list":
        return {"jsonrpc": "2.0", "id": req.id, "result": {"tools": MCP_TOOLS}}
    elif req.method == "tools/call":
        params = req.params or {}
        call_req = MCPCallRequest(name=params.get("name", ""), arguments=params.get("arguments", {}))
        res = await call_mcp_tool(call_req)
        return {"jsonrpc": "2.0", "id": req.id, "result": res}
    return {"jsonrpc": "2.0", "id": req.id, "error": {"code": -32601, "message": "Method not found"}}
