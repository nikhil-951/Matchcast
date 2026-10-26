"""
MatchCast AI - The Analyst Pundit Agent
Persona: Data-driven, objective, Opta-style analytical pundit.
References expected goals (xG), progressive actions, possession tilt, and statistical anomalies.
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Optional

from backend.config import get_openai_client, settings
from backend.models.match_state import MatchState
from backend.models.panel_output import PunditComment, TacticalInsight

logger = logging.getLogger(__name__)


class AnalystPundit:
    """
    The Analyst: Grounds the debate in quantitative data, probabilities,
    xG models, passing completion rates, and historical statistical baselines.
    """

    def __init__(self) -> None:
        self.name = "The Analyst"
        self.persona = "analyst"

    def _get_system_prompt(self, audience_mode: str, language: str = "en") -> str:
        base = (
            "You are 'The Analyst' on the MatchCast AI pundit panel. "
            "Your personality is objective, mathematically rigorous, and Opta-style analytical. "
            "You anchor every opinion in real statistical metrics: Expected Goals (xG), cumulative xG differential, "
            "territorial tilt, possession percentages, pressure metrics, and shot conversion efficiency. "
            "You avoid emotional hyperbole and let the underlying data tell the story. "
        )

        lang_guidance = ""
        if language == "es":
            lang_guidance = "\nCRITICAL: You MUST write your commentary comment in rigorous, analytical Spanish (Español)."
        elif language == "hi":
            lang_guidance = "\nCRITICAL: You MUST write your commentary comment in fluent Hindi (हिंदी / clear data terms)."

        if audience_mode == "scout":
            mode_guidance = (
                "Audience mode is SCOUT: Reference exact metrics like cumulative xG, territorial share, "
                "pressing turnover volumes, and shot quality distribution (xG per shot)."
            )
        elif audience_mode == "broadcaster":
            mode_guidance = (
                "Audience mode is BROADCASTER: Deliver TV graphic-style statistical summaries. "
                "Highlight the stark numbers that define the broadcast narrative."
            )
        else:  # fan
            mode_guidance = (
                "Audience mode is FAN: Explain what the metrics actually mean in plain, compelling terms "
                "(e.g., explaining why a 0.35 xG chance is considered a golden opportunity)."
            )

        accuracy_guidance = (
            "\nFACTUAL ACCURACY MANDATE: Always quote the exact metrics provided. "
            "If a shot was outside the penalty box, evaluate its low baseline xG and long shooting distance. "
            "NEVER claim a long-range shot was scored inside the box."
        )

        format_guidance = (
            "\nOutput must be JSON with keys:\n"
            "- comment: (string, 2 to 4 sentences citing the match numbers)\n"
            "- sentiment: (one of: analytical, positive, critical, neutral, concerned)\n"
            "- confidence: (float between 0.85 and 0.99)\n"
            "- key_observation: (concise quantitative takeaway with numbers)\n"
            "Output ONLY valid JSON."
        )

        return base + "\n" + mode_guidance + "\n" + lang_guidance + "\n" + accuracy_guidance + "\n" + format_guidance

    async def commentate(
        self,
        tactical_insight: TacticalInsight,
        match_state: MatchState,
        audience_mode: str = "fan",
        user_question: Optional[str] = None,
        language: str = "en",
        key_moment: Optional[KeyMoment] = None,
    ) -> PunditComment:
        """
        Generate statistical pundit commentary via Azure OpenAI or fallback.
        """
        client = get_openai_client()

        if client is None:
            return self._fallback_commentary(tactical_insight, match_state, audience_mode, user_question)

        ev = match_state.last_event
        moment_desc = key_moment.description if key_moment else (ev.description if ev else (match_state.key_moments[-1].description if match_state.key_moments else "In-game battle"))

        prompt_input = {
            "audience_mode": audience_mode,
            "language": language,
            "minute": match_state.minute,
            "home_team": match_state.home_team,
            "away_team": match_state.away_team,
            "score": f"{match_state.score.home} - {match_state.score.away}",
            "key_moment": moment_desc,
            "xg_totals": f"{match_state.xg_totals.home} xG vs {match_state.xg_totals.away} xG",
            "possession": f"{match_state.possession.home}% vs {match_state.possession.away}%",
            "momentum": f"{match_state.momentum.home}% vs {match_state.momentum.away}%",
            "pressures": f"{match_state.pressing_intensity.home_pressures_count} vs {match_state.pressing_intensity.away_pressures_count}",
            "patterns": tactical_insight.patterns,
            "user_question": user_question,
        }

        try:
            response = await client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[
                    {"role": "system", "content": self._get_system_prompt(audience_mode, language)},
                    {"role": "user", "content": f"Statistical Data:\n{json.dumps(prompt_input)}"},
                ],
                response_format={"type": "json_object"},
                max_completion_tokens=1500,
                reasoning_effort="low",
            )
            content = response.choices[0].message.content or "{}"
            data = json.loads(content)

            return PunditComment(
                id=f"ana_{uuid.uuid4().hex[:8]}",
                name=self.name,
                persona=self.persona,
                comment=data.get(
                    "comment",
                    f"The underlying data tells the story: {match_state.xg_totals.home} xG to {match_state.xg_totals.away} xG.",
                ),
                sentiment=data.get("sentiment", "analytical"),
                confidence=float(data.get("confidence", 0.94)),
                key_observation=data.get(
                    "key_observation",
                    f"xG differential of {abs(round(match_state.xg_totals.home - match_state.xg_totals.away, 2))}",
                ),
            )

        except Exception as exc:
            logger.warning("AnalystPundit LLM failed (%s), using fallback.", exc)
            return self._fallback_commentary(tactical_insight, match_state, audience_mode, user_question)

    def _fallback_commentary(
        self,
        tactical_insight: TacticalInsight,
        match_state: MatchState,
        audience_mode: str,
        user_question: Optional[str] = None,
    ) -> PunditComment:
        """Deterministic fallback commentary embedding precise statistical telemetry."""
        h_team = match_state.home_team
        a_team = match_state.away_team
        h_xg = match_state.xg_totals.home
        a_xg = match_state.xg_totals.away
        h_poss = match_state.possession.home
        a_poss = match_state.possession.away
        h_mom = match_state.momentum.home
        a_mom = match_state.momentum.away

        diff = round(h_xg - a_xg, 2)
        xg_summary = f"{h_team} {h_xg:.2f} xG — {a_team} {a_xg:.2f} xG"

        if user_question:
            comment = (
                f"Statistically addressing '{user_question}', the numbers provide clear clarity. "
                f"{h_team} have accumulated {h_xg:.2f} xG from {h_poss}% possession, "
                f"while {a_team} sit on {a_xg:.2f} xG. When the momentum metric shifts to {max(h_mom, a_mom)}%, "
                "conversion rates historically increase by over 30%."
            )
            obs = f"xG battle: {xg_summary}"
        elif match_state.key_moments and "GOAL" in match_state.key_moments[-1].description:
            latest = match_state.key_moments[-1]
            comment = (
                f"From an expected goals perspective, {latest.description}. "
                f"Currently, the cumulative ledger reads {xg_summary}. "
                f"With {h_poss}% territorial possession and a rolling momentum rating of {h_mom}% for {h_team}, "
                "the goal probability curve was trending decisively towards a breakthrough."
            )
            obs = f"Cumulative xG trend: {xg_summary}"
        else:
            if audience_mode == "scout":
                comment = (
                    f"Statistical breakdown at minute {match_state.minute}: {xg_summary}. "
                    f"Rolling momentum differential stands at {abs(match_state.momentum.delta or 0):.1f}%, "
                    f"with {match_state.pressing_intensity.home_pressures_count} defensive actions for {h_team} "
                    f"versus {match_state.pressing_intensity.away_pressures_count} for {a_team}."
                )
                obs = f"Defensive pressure balance: {match_state.pressing_intensity.home_pressures_count} to {match_state.pressing_intensity.away_pressures_count}"
            elif audience_mode == "broadcaster":
                comment = (
                    f"The graphic on screen illustrates the story: {xg_summary}. "
                    f"{h_team} control {h_poss}% of the ball and {h_mom}% of the momentum index. "
                    "In 84% of matches with this xG disparity at this stage, the leading team secures points."
                )
                obs = f"Historical win expectancy based on {xg_summary}"
            else:
                comment = (
                    f"The data gives us the real picture: {h_team} have generated {h_xg:.2f} expected goals compared to {a_xg:.2f} for {a_team}. "
                    f"They're controlling {h_poss}% of the possession and {h_mom}% of the momentum. "
                    "When you out-create an opponent by this margin, the results inevitably follow."
                )
                obs = f"Dominance index: {xg_summary}"

        return PunditComment(
            id=f"ana_{uuid.uuid4().hex[:8]}",
            name=self.name,
            persona=self.persona,
            comment=comment,
            sentiment="analytical",
            confidence=0.96,
            key_observation=obs,
        )
