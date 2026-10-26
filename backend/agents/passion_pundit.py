"""
MatchCast AI - The Passion Pundit Agent
Persona: Fiery, emotional, Carragher / Keane-style moment-driven reactions.
Focuses on decisive moments, defensive blunders, desire, hunger, and controversy.
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


class PassionPundit:
    """
    The Passion Pundit: Drives the emotional and visceral narrative of the debate.
    Passionate, uncompromising, and quick to call out heart, effort, and blunders.
    """

    def __init__(self) -> None:
        self.name = "The Passion Pundit"
        self.persona = "passion"

    def _get_system_prompt(self, audience_mode: str, language: str = "en") -> str:
        base = (
            "You are 'The Passion Pundit' on the MatchCast AI pundit panel. "
            "Your personality is fiery, passionate, visceral, and blunt — like Jamie Carragher or Roy Keane. "
            "You care about desire, intensity, hunger, defensive responsibility, and decisive moments. "
            "You have zero patience for passive defending, excuses, or over-complicated tactical fluff. "
            "Use natural expressions like 'Listen!', 'Unbelievable!', 'That is criminal defending!', "
            "'Where is the desire?', or 'That is pure quality!' when appropriate. "
        )

        lang_guidance = ""
        if language == "es":
            lang_guidance = "\nCRITICAL: You MUST write your commentary comment in passionate, natural Spanish (Español)."
        elif language == "hi":
            lang_guidance = "\nCRITICAL: You MUST write your commentary comment in passionate Hindi (हिंदी / expressive football tone)."

        if audience_mode == "scout":
            mode_guidance = (
                "Audience mode is SCOUT: Focus heavily on duel commitment, physical recovery runs, "
                "defensive awareness under duress, and individual accountability in key moments."
            )
        elif audience_mode == "broadcaster":
            mode_guidance = (
                "Audience mode is BROADCASTER: Give dramatic, high-energy television reactions that capture "
                "the raw emotion and theatre of Premier League football."
            )
        else:  # fan
            mode_guidance = (
                "Audience mode is FAN: High octane, expressive, relatable supporter energy. "
                "Get straight to the heart of what made this moment thrilling or infuriating."
            )

        accuracy_guidance = (
            "\nFACTUAL ACCURACY MANDATE: Strictly respect the physical details in last_moment! "
            "If a goal was scored from outside the box (long-range thunderbolt), praise it as an unbelievable strike from distance outside the area. "
            "NEVER claim a long-range goal was scored inside the box. If it's a tap-in or header, celebrate it accordingly!"
        )

        format_guidance = (
            "\nOutput must be JSON with keys:\n"
            "- comment: (string, 2 to 4 sentences in your fiery voice)\n"
            "- sentiment: (one of: excited, critical, incredulous, positive, concerned)\n"
            "- confidence: (float between 0.80 and 0.99)\n"
            "- key_observation: (concise phrase of the emotional or human element)\n"
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
        Generate high-emotion pundit commentary via Azure OpenAI or fallback.
        """
        client = get_openai_client()

        if client is None:
            return self._fallback_commentary(tactical_insight, match_state, audience_mode, user_question)

        ev = match_state.last_event
        moment_desc = key_moment.description if key_moment else (match_state.key_moments[-1].description if match_state.key_moments else "In-game battle")

        prompt_input = {
            "audience_mode": audience_mode,
            "language": language,
            "minute": match_state.minute,
            "score": f"{match_state.home_team} {match_state.score.home} - {match_state.score.away} {match_state.away_team}",
            "last_moment": moment_desc,
            "event_type": ev.type if ev else "play",
            "narrative_context": tactical_insight.narrative_context,
            "user_question": user_question,
        }

        try:
            response = await client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[
                    {"role": "system", "content": self._get_system_prompt(audience_mode, language)},
                    {"role": "user", "content": f"Match Situation:\n{json.dumps(prompt_input)}"},
                ],
                response_format={"type": "json_object"},
                max_completion_tokens=1500,
                reasoning_effort="low",
            )
            content = response.choices[0].message.content or "{}"
            data = json.loads(content)

            return PunditComment(
                id=f"pas_{uuid.uuid4().hex[:8]}",
                name=self.name,
                persona=self.persona,
                comment=data.get("comment", "Listen, you can talk about tactics all day, but that is about pure desire!"),
                sentiment=data.get("sentiment", "excited"),
                confidence=float(data.get("confidence", 0.95)),
                key_observation=data.get("key_observation", "Desire and work rate in the decisive phase"),
            )

        except Exception as exc:
            logger.warning("PassionPundit LLM failed (%s), using fallback.", exc)
            return self._fallback_commentary(tactical_insight, match_state, audience_mode, user_question)

    def _fallback_commentary(
        self,
        tactical_insight: TacticalInsight,
        match_state: MatchState,
        audience_mode: str,
        user_question: Optional[str] = None,
    ) -> PunditComment:
        """Deterministic fallback commentary capturing Carragher/Keane fire."""
        h_team = match_state.home_team
        a_team = match_state.away_team

        if user_question:
            comment = (
                f"Listen, regarding '{user_question}' — don't overcomplicate it! "
                f"It's about who wants it more when the tackle is there to be won! "
                f"If you're wearing the shirt, you track your runner, you put your head in where it hurts, simple as that!"
            )
            obs = "Commitment and accountability"
            sentiment = "critical"
        elif match_state.key_moments:
            latest = match_state.key_moments[-1]
            if "GOAL" in latest.description:
                comment = (
                    f"Listen, that is unbelievable! Absolute pandemonium! "
                    f"You can talk about formations all afternoon, but that is pure guts and composure in the cauldron! "
                    f"The roof has completely come off this stadium!"
                )
                obs = "Pure desire and clinical finishing"
                sentiment = "excited"
            elif "RED CARD" in latest.description or "PENALTY" in latest.description:
                comment = (
                    f"What on earth is he doing?! That is an absolute joke at this level! "
                    f"You've let your teammates down, you've let the manager down, and in a match of this magnitude, "
                    f"that is criminal decision making!"
                )
                obs = "Disciplinary madness and costly lapse"
                sentiment = "incredulous"
            else:
                comment = (
                    f"Look at the intensity out there right now! {h_team} and {a_team} are throwing everything into every 50-50 challenge! "
                    f"Forget the passing percentages for a second — this is proper Premier League football with blood and thunder!"
                )
                obs = "High intensity physical battle"
                sentiment = "excited"
        else:
            comment = (
                f"Listen, I love the aggression we are seeing! "
                f"{h_team} are pressing like their lives depend on it, but {a_team} have got to stand up to the battle. "
                "If you don't match the work rate, you will get blown away!"
            )
            obs = "Duel intensity and work rate"
            sentiment = "excited"

        return PunditComment(
            id=f"pas_{uuid.uuid4().hex[:8]}",
            name=self.name,
            persona=self.persona,
            comment=comment,
            sentiment=sentiment,
            confidence=0.96,
            key_observation=obs,
        )
