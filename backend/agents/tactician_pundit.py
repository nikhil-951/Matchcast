"""
MatchCast AI - The Tactician Pundit Agent
Persona: Calm, precise, Guardiola-style structural analysis.
Focuses on formations, pressing structures, positional play, and space creation.
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from backend.config import get_openai_client, settings
from backend.models.match_state import MatchState
from backend.models.panel_output import PunditComment, TacticalInsight

logger = logging.getLogger(__name__)


class TacticianPundit:
    """
    The Tactician: Analyzes structural mechanisms, positional superiority,
    spatial spacing, rest defense, and tactical adjustments.
    """

    def __init__(self) -> None:
        self.name = "The Tactician"
        self.persona = "tactician"

    def _get_system_prompt(self, audience_mode: str, language: str = "en") -> str:
        base = (
            "You are 'The Tactician' on the MatchCast AI pundit panel. "
            "Your personality is calm, cerebral, obsessive about details, and analytical — like Pep Guardiola. "
            "You focus on spatial geometry, half-spaces, pressing triggers, rest defense, "
            "positional play (Juego de Posición), and tactical overloads. "
            "You don't care about drama or emotions — you care about structure, space, and execution. "
        )

        lang_guidance = ""
        if language == "es":
            lang_guidance = "\nCRITICAL: You MUST write your commentary comment in fluent Spanish (Español)."
        elif language == "hi":
            lang_guidance = "\nCRITICAL: You MUST write your commentary comment in fluent Hindi (हिंदी / accessible football terminology)."

        if audience_mode == "scout":
            mode_guidance = (
                "Audience mode is SCOUT: Use deep technical terminology (e.g., 3-2 build-up shape, "
                "half-space occupation, third-man combinations, rest defense compactness, pressing angles). "
                "Provide rigorous professional tactical breakdown."
            )
        elif audience_mode == "broadcaster":
            mode_guidance = (
                "Audience mode is BROADCASTER: Provide polished, television-ready soundbites with "
                "authoritative broadcast cadence, punchy explanations of the tactics, and clean transitions."
            )
        else:  # fan
            mode_guidance = (
                "Audience mode is FAN: Keep it clear, accessible, and vivid. Explain the structural concept "
                "using intuitive spatial metaphors without dumbing down the tactical truth."
            )

        accuracy_guidance = (
            "\nFACTUAL ACCURACY MANDATE: Strictly follow the physical shot zone and moment description. "
            "If a goal/shot occurred from outside the penalty box (shot_zone 'Outside the penalty box' or long-range), "
            "you MUST discuss it as a long-range strike from distance outside the box. NEVER state that a long-range shot "
            "was scored inside the box. If it is a tap-in, header, or free kick, analyze it accurately."
        )

        format_guidance = (
            "\nOutput must be JSON with keys:\n"
            "- comment: (string, 2 to 4 sentences in your distinct voice)\n"
            "- sentiment: (one of: analytical, positive, critical, concerned, neutral)\n"
            "- confidence: (float between 0.70 and 0.98)\n"
            "- key_observation: (concise phrase of the core tactical structure observed)\n"
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
        Generate tactically nuanced pundit commentary via Azure OpenAI or fallback.
        """
        client = get_openai_client()

        if client is None:
            return self._fallback_commentary(tactical_insight, match_state, audience_mode, user_question)

        ev = match_state.last_event
        moment_desc = key_moment.description if key_moment else (ev.description if ev else "General play")
        shot_zone = None
        if ev and ev.position:
            dist_m = round((100.0 - ev.position.x) * 1.05, 1)
            dist_yd = round(dist_m * 1.0936, 1)
            if ev.position.x < 84.0:
                shot_zone = f"Outside the penalty box ({dist_m}m / {dist_yd} yards out - LONG RANGE)"
            elif ev.position.x >= 94.0:
                shot_zone = f"Six-yard box / goalmouth ({dist_m}m / {dist_yd} yards out - TAP-IN / CLOSE RANGE)"
            else:
                shot_zone = f"Inside the penalty box ({dist_m}m / {dist_yd} yards out)"

        prompt_input = {
            "audience_mode": audience_mode,
            "language": language,
            "minute": match_state.minute,
            "score": f"{match_state.home_team} {match_state.score.home} - {match_state.score.away} {match_state.away_team}",
            "possession": f"{match_state.home_team} {match_state.possession.home}% - {match_state.away_team} {match_state.possession.away}%",
            "key_moment": moment_desc,
            "shot_location_and_zone": shot_zone,
            "tactical_patterns": tactical_insight.patterns,
            "tactical_narrative": tactical_insight.narrative_context,
            "recent_moment": ev.type if ev else "General play",
            "user_question": user_question,
        }

        try:
            response = await client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[
                    {"role": "system", "content": self._get_system_prompt(audience_mode, language)},
                    {"role": "user", "content": f"Match Context:\n{prompt_input}"},
                ],
                response_format={"type": "json_object"},
                max_completion_tokens=1500,
                reasoning_effort="low",
            )
            content = response.choices[0].message.content or "{}"
            import json
            data = json.loads(content)

            return PunditComment(
                id=f"tac_{uuid.uuid4().hex[:8]}",
                name=self.name,
                persona=self.persona,
                comment=data.get("comment", "Look at the spacing between the lines; that is where the match is won."),
                sentiment=data.get("sentiment", "analytical"),
                confidence=float(data.get("confidence", 0.90)),
                key_observation=data.get("key_observation", "Positional spacing in the half-space"),
            )

        except Exception as exc:
            logger.warning("TacticianPundit LLM failed (%s), using fallback.", exc)
            return self._fallback_commentary(tactical_insight, match_state, audience_mode, user_question)

    def _fallback_commentary(
        self,
        tactical_insight: TacticalInsight,
        match_state: MatchState,
        audience_mode: str,
        user_question: Optional[str] = None,
    ) -> PunditComment:
        """Deterministic fallback commentary aligned with Guardiola persona."""
        h_team = match_state.home_team
        a_team = match_state.away_team

        if user_question:
            comment = (
                f"Structurally speaking regarding '{user_question}', everything comes down to positional distances. "
                f"{h_team} are attempting to pin the back line while {a_team} maintain a compact block. "
                "If the spacing is even five meters off, the whole pressing mechanism breaks down."
            )
            obs = "Positional distances and line pinning"
        elif tactical_insight.patterns:
            primary_pattern = tactical_insight.patterns[0]
            if audience_mode == "scout":
                comment = (
                    f"Notice the structural breakdown here: {primary_pattern}. "
                    f"The staggering in midfield allows vertical line-breaking passes, but their rest defense "
                    f"is exposed to transition attacks if the counter-press fails in the first three seconds."
                )
                obs = "Midfield staggering and rest defense vulnerability"
            elif audience_mode == "broadcaster":
                comment = (
                    f"What we are seeing is pure tactical chess. {primary_pattern}. "
                    f"One manager is baiting the press while the other is trying to squeeze the pitch. "
                    "Whoever controls the central half-spaces controls this contest."
                )
                obs = "Central half-space control"
            else:
                comment = (
                    f"Look closely at the pitch geometry. {primary_pattern}. "
                    f"When you open up the width like that, you pull defenders apart and create the lane. "
                    "It's not about luck; it's about occupying the right spaces at the right second."
                )
                obs = "Spatial width manipulation"
        else:
            comment = (
                f"The shapes are fascinating right now. {h_team} have {match_state.possession.home}% of the ball, "
                f"manipulating the tempo to lure {a_team} out. Once the first line of pressure is bypassed, "
                "the numerical overload appears instantly."
            )
            obs = "Numerical overload creation in build-up"

        return PunditComment(
            id=f"tac_{uuid.uuid4().hex[:8]}",
            name=self.name,
            persona=self.persona,
            comment=comment,
            sentiment="analytical",
            confidence=0.92,
            key_observation=obs,
        )
