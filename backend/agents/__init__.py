"""
MatchCast AI - Multi-Agent Architecture
Exports the 6 core agents: DataAgent, TacticalAgent, TacticianPundit, PassionPundit, AnalystPundit, HostOrchestrator.
"""

from backend.agents.analyst_pundit import AnalystPundit
from backend.agents.data_agent import DataAgent
from backend.agents.host_orchestrator import HostOrchestrator
from backend.agents.passion_pundit import PassionPundit
from backend.agents.tactical_agent import TacticalAgent
from backend.agents.tactician_pundit import TacticianPundit

__all__ = [
    "DataAgent",
    "TacticalAgent",
    "TacticianPundit",
    "PassionPundit",
    "AnalystPundit",
    "HostOrchestrator",
]
