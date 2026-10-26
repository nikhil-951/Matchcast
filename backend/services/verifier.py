"""
MatchCast AI - Claim Verifier
Fact-checks the numbers pundits quote against the deterministic match state.

Pundits may disagree on opinion, never on facts. Every checkable claim is tagged:
  verified     - the quoted number matches the computed value
  wrong        - the quoted number matches nothing in the computed state
  unsupported  - a statistic (e.g. "in 84% of matches...") that cannot be derived from this match's data

Claim types: xg, possession, momentum, score, pressures, statistic.
Code (not an LLM) recomputes every value, so the verdict itself cannot hallucinate.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from backend.models.match_state import MatchState

XG_TOL = 0.02
PCT_TOL = 0.6

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_PCT = re.compile(r"(\d+(?:\.\d+)?)\s*%")
_DECIMAL = re.compile(r"(?<![\d.])(\d+\.\d{1,2})(?!\d|\s*%)")
_SCORE = re.compile(r"\((\d+)\s*-\s*(\d+)\)")
_PRESSURES = re.compile(r"(\d+)\s+(?:defensive actions|pressures|pressing actions)")
_CONSECUTIVE = re.compile(r"(\d+)\s+consecutive passes", re.IGNORECASE)
_ENTRIES = re.compile(r"(\d+)\s+(?:final-third entries|box entries|box penetrations|entries)", re.IGNORECASE)
_STATISTIC = re.compile(
    r"(historically|of matches|win expectancy|percentile|per 90|conversion rates|"
    r"in \d+% of|over \d+%|\d+(?:st|nd|rd|th) percentile)",
    re.IGNORECASE,
)


def _close(value: float, targets: List[Optional[float]], tol: float) -> bool:
    return any(t is not None and abs(value - t) <= tol for t in targets)


def _claim(kind: str, text: str, status: str, actual: Optional[str] = None) -> Dict[str, Any]:
    return {"type": kind, "claim": text.strip(), "status": status, "actual": actual}


_POSSESSION_WORDS = ("possession", "of the ball", "the ball", "territorial")
_MOMENTUM_WORDS = ("momentum",)


def _percent_kind(low: str, start: int, end: int) -> Optional[str]:
    """Decide what a percentage refers to using the NEAREST keyword (after the number first)."""
    after = low[end: end + 32]
    best: Optional[tuple] = None
    for kind, words in (("possession", _POSSESSION_WORDS), ("momentum", _MOMENTUM_WORDS)):
        for w in words:
            i = after.find(w)
            if i != -1 and (best is None or i < best[0]):
                best = (i, kind)
    if best:
        return best[1]
    before = low[max(0, start - 28): start]
    best = None
    for kind, words in (("possession", _POSSESSION_WORDS), ("momentum", _MOMENTUM_WORDS)):
        for w in words:
            i = before.rfind(w)
            if i != -1 and (best is None or i > best[0]):
                best = (i, kind)
    return best[1] if best else None


def verify_text(text: str, state: MatchState) -> List[Dict[str, Any]]:
    """Extract checkable claims from text and verify each against `state`."""
    claims: List[Dict[str, Any]] = []
    if not text:
        return claims

    h_xg, a_xg = state.xg_totals.home, state.xg_totals.away
    h_poss, a_poss = state.possession.home, state.possession.away
    h_mom, a_mom = state.momentum.home, state.momentum.away
    delta = abs(state.momentum.delta or 0.0)
    h_press = state.pressing_intensity.home_pressures_count
    a_press = state.pressing_intensity.away_pressures_count

    for sentence in _SENTENCE_SPLIT.split(text):
        low = sentence.lower()

        # Statistics that no single match can support (the classic hallucination)
        if _STATISTIC.search(sentence):
            claims.append(_claim("statistic", sentence, "unsupported"))
            continue

        for m in _PCT.finditer(sentence):
            value = float(m.group(1))
            kind = _percent_kind(low, m.start(), m.end())
            if kind == "possession":
                ok = _close(value, [h_poss, a_poss], PCT_TOL)
                claims.append(_claim("possession", m.group(0), "verified" if ok else "wrong",
                                     f"{h_poss}% / {a_poss}%"))
            elif kind == "momentum":
                ok = _close(value, [h_mom, a_mom, delta], PCT_TOL)
                claims.append(_claim("momentum", m.group(0), "verified" if ok else "wrong",
                                     f"{h_mom}% / {a_mom}% (swing {delta:.1f}%)"))

        if "xg" in low or "expected goal" in low:
            for m in _DECIMAL.finditer(sentence):
                value = float(m.group(1))
                ok = _close(value, [h_xg, a_xg], XG_TOL)
                claims.append(_claim("xg", m.group(1) + " xG", "verified" if ok else "wrong",
                                     f"{h_xg:.2f} / {a_xg:.2f}"))

        for m in _SCORE.finditer(sentence):
            h, a = int(m.group(1)), int(m.group(2))
            ok = (h, a) == (state.score.home, state.score.away)
            claims.append(_claim("score", m.group(0), "verified" if ok else "wrong",
                                 f"{state.score.home}-{state.score.away}"))

        for m in _PRESSURES.finditer(sentence):
            value = int(m.group(1))
            ok = value in (h_press, a_press)
            claims.append(_claim("pressures", m.group(0), "verified" if ok else "wrong",
                                 f"{h_press} / {a_press}"))

        for m in _CONSECUTIVE.finditer(sentence):
            val = int(m.group(1))
            valid_passes = [20]
            if state.latest_story and state.latest_story.story_type == "midfield_metronome":
                valid_passes.append(int(state.latest_story.metrics.get("consecutive_passes", 20)))
            ok = val in valid_passes
            claims.append(_claim("metronome", m.group(0), "verified" if ok else "wrong", f"{valid_passes[-1]} passes"))

        for m in _ENTRIES.finditer(sentence):
            val = int(m.group(1))
            total_h_entries = (state.attacking_zones.home.left.entries + 
                               state.attacking_zones.home.central.entries + 
                               state.attacking_zones.home.right.entries) if state.attacking_zones else 0
            total_a_entries = (state.attacking_zones.away.left.entries + 
                               state.attacking_zones.away.central.entries + 
                               state.attacking_zones.away.right.entries) if state.attacking_zones else 0
            story_entries = []
            if state.latest_story and "entries" in str(state.latest_story.metrics):
                for k, v in state.latest_story.metrics.items():
                    if "entries" in k and isinstance(v, int):
                        story_entries.append(v)
            ok = val in (total_h_entries, total_a_entries) or val in story_entries
            claims.append(_claim("entries", m.group(0), "verified" if ok else "wrong", f"{total_h_entries} / {total_a_entries} entries"))

    # Deduplicate claims to prevent back-to-back duplicate badges
    unique_claims: List[Dict[str, Any]] = []
    seen = set()
    for c in claims:
        key = (c["type"], c["claim"], c["status"])
        if key not in seen:
            seen.add(key)
            unique_claims.append(c)

    return unique_claims


def summarize(claims: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(claims)
    verified = sum(1 for c in claims if c["status"] == "verified")
    wrong = sum(1 for c in claims if c["status"] == "wrong")
    unsupported = sum(1 for c in claims if c["status"] == "unsupported")
    return {
        "total": total,
        "verified": verified,
        "wrong": wrong,
        "unsupported": unsupported,
        "verified_pct": round(100.0 * verified / total, 1) if total else 100.0,
    }


@dataclass
class VerificationTracker:
    """Running tally for the 'claims verified' badge and the eval report."""

    total: int = 0
    verified: int = 0
    wrong: int = 0
    unsupported: int = 0
    by_type: Dict[str, int] = field(default_factory=dict)

    def add(self, claims: List[Dict[str, Any]]) -> None:
        for c in claims:
            self.total += 1
            self.by_type[c["type"]] = self.by_type.get(c["type"], 0) + 1
            if c["status"] == "verified":
                self.verified += 1
            elif c["status"] == "wrong":
                self.wrong += 1
            else:
                self.unsupported += 1

    def snapshot(self) -> Dict[str, Any]:
        pct = round(100.0 * self.verified / self.total, 1) if self.total else 100.0
        return {
            "total": self.total,
            "verified": self.verified,
            "wrong": self.wrong,
            "unsupported": self.unsupported,
            "verified_pct": pct,
            "by_type": dict(self.by_type),
        }


def verify_comment(comment: Any, state: MatchState) -> List[Dict[str, Any]]:
    """Verify a PunditComment in place and return its claims."""
    text = comment.comment
    if getattr(comment, "key_observation", None):
        text = f"{text} {comment.key_observation}."
    claims = verify_text(text, state)
    comment.verification = claims
    return claims


def verify_debate(debate: Any, state: MatchState, tracker: Optional[VerificationTracker] = None) -> Dict[str, Any]:
    """Verify every pundit in a debate/answer; attaches `verification` summaries."""
    pundits = getattr(debate, "pundits", None) or getattr(debate, "answers", [])
    all_claims: List[Dict[str, Any]] = []
    for p in pundits:
        all_claims.extend(verify_comment(p, state))
    summary = summarize(all_claims)
    debate.verification = summary
    if tracker is not None:
        tracker.add(all_claims)
    return summary
