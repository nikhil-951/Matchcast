"""
MatchCast AI - The Host Orchestrator Agent
Moderates pundit panel debates, evaluates moment importance, routes user queries,
calculates panel agreement metrics, and produces full-time match personality synthesis.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import List, Optional

from backend.agents.analyst_pundit import AnalystPundit
from backend.agents.passion_pundit import PassionPundit
from backend.agents.tactician_pundit import TacticianPundit
from backend.config import get_openai_client, settings
from backend.models.match_state import KeyMoment, MatchState
from backend.models.panel_output import (
    MatchPersonality,
    PanelAnswer,
    PanelDebate,
    PunditComment,
    TacticalInsight,
)

logger = logging.getLogger(__name__)


class HostOrchestrator:
    """
    The Host Orchestrator:
    Directs the broadcast panel, regulates speaker turns, measures debate consensus,
    and conducts interactive Q&A.
    """

    def __init__(
        self,
        tactician: Optional[TacticianPundit] = None,
        passion: Optional[PassionPundit] = None,
        analyst: Optional[AnalystPundit] = None,
    ) -> None:
        self.tactician = tactician or TacticianPundit()
        self.passion = passion or PassionPundit()
        self.analyst = analyst or AnalystPundit()

    def evaluate_importance(self, key_moment: KeyMoment) -> str:
        """
        Determine importance tier:
        HIGH: Goals, red cards, penalties, massive momentum swings
        MEDIUM: Big chances, woodwork, yellow cards, pressing trap alerts
        LOW: Routine events
        """
        if key_moment.importance in ("HIGH", "MEDIUM", "LOW"):
            return key_moment.importance

        m_type = (key_moment.type or "").lower()
        desc = key_moment.description.lower()

        if any(k in m_type or k in desc for k in ("goal", "red card", "penalty", "sent off")):
            return "HIGH"
        if any(k in m_type or k in desc for k in ("chance", "yellow", "woodwork", "swing")):
            return "MEDIUM"
        return "LOW"

    def calculate_agreement_score(self, pundits: List[PunditComment]) -> float:
        """
        Calculate agreement score (0 to 100) based on sentiment alignment.
        """
        if len(pundits) <= 1:
            return 95.0

        positive_sentiments = {"positive", "excited"}
        negative_sentiments = {"critical", "incredulous", "concerned"}

        pos_count = sum(1 for p in pundits if p.sentiment.lower() in positive_sentiments)
        neg_count = sum(1 for p in pundits if p.sentiment.lower() in negative_sentiments)
        total = len(pundits)

        if pos_count == total or neg_count == total:
            return 90.0
        if pos_count > 0 and neg_count > 0:
            # Polarized opinions
            raw_conflict = max(0.20, 1.0 - (abs(pos_count - neg_count) + 1) / total * 0.6)
            return round(raw_conflict * 100.0, 1)

        return 65.0

    async def orchestrate_moment(
        self,
        key_moment: KeyMoment,
        match_state: MatchState,
        tactical_insight: TacticalInsight,
        audience_mode: str = "fan",
    ) -> PanelDebate:
        """
        Trigger pundit responses based on moment importance and synthesize debate.
        """
        importance = self.evaluate_importance(key_moment)
        pundits: List[PunditComment] = []

        if importance == "HIGH":
            # All 3 pundits speak on major moments - run concurrently
            t_com, p_com, a_com = await asyncio.gather(
                self.tactician.commentate(tactical_insight, match_state, audience_mode, key_moment=key_moment),
                self.passion.commentate(tactical_insight, match_state, audience_mode, key_moment=key_moment),
                self.analyst.commentate(tactical_insight, match_state, audience_mode, key_moment=key_moment),
            )
            pundits = [t_com, p_com, a_com]

        elif importance == "MEDIUM":
            # Pick 2 most relevant pundits depending on event characteristics - run concurrently
            desc_lower = key_moment.description.lower()
            if "chance" in desc_lower or "swing" in desc_lower or "trap" in desc_lower:
                t_com, a_com = await asyncio.gather(
                    self.tactician.commentate(tactical_insight, match_state, audience_mode, key_moment=key_moment),
                    self.analyst.commentate(tactical_insight, match_state, audience_mode, key_moment=key_moment),
                )
                pundits = [t_com, a_com]
            else:
                p_com, t_com = await asyncio.gather(
                    self.passion.commentate(tactical_insight, match_state, audience_mode, key_moment=key_moment),
                    self.tactician.commentate(tactical_insight, match_state, audience_mode, key_moment=key_moment),
                )
                pundits = [p_com, t_com]

        else:
            # LOW: Host only or single pundit
            a_com = await self.analyst.commentate(tactical_insight, match_state, audience_mode, key_moment=key_moment)
            pundits = [a_com]

        agreement = self.calculate_agreement_score(pundits)
        host_summary = await self._generate_host_summary(key_moment, pundits, audience_mode)

        return PanelDebate(
            moment_description=key_moment.description,
            importance=importance,
            pundits=pundits,
            agreement_score=agreement,
            host_summary=host_summary,
            audience_mode=audience_mode,
        )

    async def handle_question(
        self,
        question: str,
        match_state: MatchState,
        tactical_insight: TacticalInsight,
        audience_mode: str = "fan",
        language: str = "en",
    ) -> PanelAnswer:
        """
        Route user question to the most qualified pundit(s) and provide host synthesis.
        """
        q_lower = question.lower()
        answers: List[PunditComment] = []

        is_stats = any(w in q_lower for w in ("stat", "xg", "number", "percentage", "data", "possession", "metric"))
        is_passion = any(w in q_lower for w in ("fault", "blame", "referee", "card", "red", "desire", "effort", "worst", "best"))
        is_tactics = any(w in q_lower for w in ("tactic", "formation", "press", "shape", "system", "space", "line"))

        if is_stats and not is_tactics and not is_passion:
            answers.append(await self.analyst.commentate(tactical_insight, match_state, audience_mode, question, language))
        elif is_passion and not is_stats:
            answers.append(await self.passion.commentate(tactical_insight, match_state, audience_mode, question, language))
        elif is_tactics and not is_stats and not is_passion:
            answers.append(await self.tactician.commentate(tactical_insight, match_state, audience_mode, question, language))
        else:
            # Multi-perspective question: engage Tactician and Passion concurrently
            t_com, p_com = await asyncio.gather(
                self.tactician.commentate(tactical_insight, match_state, audience_mode, question, language),
                self.passion.commentate(tactical_insight, match_state, audience_mode, question, language),
            )
            answers.extend([t_com, p_com])

        host_summary = await self._generate_qa_summary(question, answers, audience_mode, language)

        return PanelAnswer(
            question=question,
            answers=answers,
            host_summary=host_summary,
            audience_mode=audience_mode,
        )

    async def generate_match_personality(
        self,
        match_state: MatchState,
        key_moments: List[KeyMoment],
    ) -> MatchPersonality:
        """
        At full time: generate comprehensive match personality, thematic tags, and strategic verdict.
        """
        client = get_openai_client()

        h_team = match_state.home_team
        a_team = match_state.away_team
        score_str = f"{match_state.score.home}-{match_state.score.away}"

        if client is None:
            return self._fallback_match_personality(match_state, key_moments)

        system_prompt = (
            "You are the Host Orchestrator of MatchCast AI. Deliver the definitive full-time match verdict. "
            "Characterize the personality of this match with vivid tags and a masterclass tactical summary."
        )

        user_content = {
            "teams": f"{h_team} vs {a_team}",
            "final_score": score_str,
            "xg_totals": f"{match_state.xg_totals.home} vs {match_state.xg_totals.away}",
            "possession": f"{match_state.possession.home}% - {match_state.possession.away}%",
            "key_moments_count": len(key_moments),
            "key_moments": [k.description for k in key_moments[-5:]],
        }

        try:
            response = await client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": (
                            f"Generate full-time match personality JSON with keys:\n"
                            f"- summary: (paragraph summary of the match narrative)\n"
                            f"- tags: (array of 3-4 catchy tags, e.g. ['High-Pressing Masterclass', 'Late Drama'])\n"
                            f"- tactical_verdict: (concise strategic verdict on how the game was won or lost)\n"
                            f"Data: {json.dumps(user_content)}"
                        ),
                    },
                ],
                response_format={"type": "json_object"},
                max_completion_tokens=1500,
                reasoning_effort="low",
            )
            data = json.loads(response.choices[0].message.content or "{}")

            return MatchPersonality(
                summary=data.get(
                    "summary",
                    f"A gripping encounter between {h_team} and {a_team} ending {score_str}.",
                ),
                tags=data.get("tags", ["Tactical Chess Match", "High Pressing", "Premier League Drama"]),
                key_moments=key_moments,
                tactical_verdict=data.get(
                    "tactical_verdict",
                    f"Decided by spatial control and execution in decisive transition moments.",
                ),
            )
        except Exception as exc:
            logger.warning("MatchPersonality LLM call failed (%s), using fallback.", exc)
            return self._fallback_match_personality(match_state, key_moments)

    @staticmethod
    def clean_moment_description(desc: str) -> str:
        """Format raw event log strings into natural broadcast narrative prose."""
        if not desc:
            return desc
        text = desc.strip()
        # Remove leading event tags like GOAL! or RED CARD!
        text = re.sub(r'^(GOAL|RED CARD|YELLOW CARD|PENALTY|SAVE|CHANCE)!\s*', '', text, flags=re.IGNORECASE)
        # Remove trailing score parentheticals like (3-2)
        text = re.sub(r'\s*\(\d+-\d+\)\s*$', '', text)
        # Clean up score phrases e.g. "scores for Team" -> "goal for Team"
        if "scores for" in text:
            text = text.replace("scores for", "goal for")
        return text.strip()


    async def _generate_host_summary(
        self,
        key_moment: KeyMoment,
        pundits: List[PunditComment],
        audience_mode: str,
    ) -> str:
        """Host wrap-up synthesizing panel opinions."""
        clean_desc = self.clean_moment_description(key_moment.description)
        client = get_openai_client()
        if client is None:
            names = ", ".join(p.name for p in pundits)
            return (
                f"Fascinating debate from our panel. While {names} view this through different lenses, "
                f"there is no question that {clean_desc} has fundamentally shifted the complexion of the match."
            )

        prompt = (
            f"You are the TV host moderating MatchCast AI. Moment: '{clean_desc}'. "
            f"Panel reactions: {[p.name + ': ' + p.comment for p in pundits]}. "
            f"Audience mode: {audience_mode}. Give a 1-2 sentence polished host sign-off wrapping up the debate. "
            f"Avoid quotes around the sentence and do not use raw score parentheticals."
        )

        try:
            resp = await client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[{"role": "user", "content": prompt}],
                max_completion_tokens=1000,
                reasoning_effort="low",
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception:
            return f"A defining moment here that tests both managers' tactical adjustments as the match evolves."

    async def _generate_qa_summary(
        self,
        question: str,
        answers: List[PunditComment],
        audience_mode: str,
        language: str = "en",
    ) -> str:
        """Host wrap-up for user question response."""
        if language == "es":
            return f"Excelente pregunta de la audiencia sobre '{question}'. Nuestro panel analiza las claves tácticas y la ejecución necesaria en este nivel."
        elif language == "hi":
            return f"दर्शकों से बहुत अच्छा सवाल: '{question}'। हमारे पैनल ने रणनीतिक बुनियादी सिद्धांतों और खेल के स्तर का विश्लेषण किया है।"
        return (
            f"Great question from the audience regarding '{question}'. "
            f"Our panel highlights both the structural fundamentals and the raw execution needed at this level."
        )

    def _fallback_match_personality(
        self,
        match_state: MatchState,
        key_moments: List[KeyMoment],
    ) -> MatchPersonality:
        """Deterministic match personality when LLM is unavailable."""
        h = match_state.home_team
        a = match_state.away_team
        s_home = match_state.score.home
        s_away = match_state.score.away

        if s_home > s_away:
            verdict = f"{h} executed their tactical game plan with superior spatial dominance and finishing efficiency."
            tags = ["Home Dominance", "Tactical Execution", "Pressing Masterclass"]
        elif s_away > s_home:
            verdict = f"{a} pulled off a clinical away performance, exploiting transition channels at key moments."
            tags = ["Counter-Attacking Masterclass", "Clinical Finishing", "Away Triumph"]
        else:
            verdict = "A tightly contested tactical stalemate where defensive structures largely neutralized attacking overloads."
            tags = ["Tactical Chess Match", "High Intensity Stalemate", "Even Contest"]

        summary = (
            f"The full-time whistle blows on an intense battle between {h} and {a}, concluding at {s_home}-{s_away}. "
            f"{h} finished with {match_state.xg_totals.home} xG and {match_state.possession.home}% possession, "
            f"while {a} posted {match_state.xg_totals.away} xG. Across {len(key_moments)} pivotal moments, "
            f"this contest demonstrated the razor-thin margins of elite Premier League football."
        )

        return MatchPersonality(
            summary=summary,
            tags=tags,
            key_moments=key_moments,
            tactical_verdict=verdict,
        )
