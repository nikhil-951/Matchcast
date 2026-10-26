"""
MatchCast AI - Match Playback Engine
Asynchronous match replay engine supporting variable speeds, seek, pause, resume, and streaming.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import AsyncGenerator, Callable, Dict, List, Optional, Union

from backend.models.events import MatchData, MatchEvent

logger = logging.getLogger(__name__)


class MatchPlaybackEngine:
    """
    Playback controller for replaying synthetic match events asynchronously.
    Supports variable playback speed (1x, 2x, 5x, 10x), seeking, pause, and resume.
    """

    def __init__(
        self,
        match_data: Optional[MatchData] = None,
        base_event_delay: float = 1.2,
    ) -> None:
        self.match_data: Optional[MatchData] = match_data
        self.base_event_delay: float = base_event_delay  # Seconds per event at 1x speed
        self.speed: float = 1.0
        self.current_index: int = 0
        self.current_minute: int = 0

        self.is_running: bool = False
        self.is_paused: bool = False
        self._pause_event = asyncio.Event()
        self._pause_event.set()  # Not paused initially
        self._stop_requested: bool = False

    @classmethod
    def from_file(cls, filepath: Union[str, Path]) -> "MatchPlaybackEngine":
        """Instantiate playback engine by loading a match JSON file."""
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"Match file not found at: {path}")

        with open(path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        match_data = MatchData(**raw_data)
        return cls(match_data=match_data)

    def load_data(self, match_data: MatchData) -> None:
        """Load MatchData object directly."""
        self.match_data = match_data
        self.current_index = 0
        self.current_minute = 0
        self._stop_requested = False

    def set_speed(self, speed: float) -> None:
        """Set replay playback multiplier (e.g. 1.0, 2.0, 5.0, 10.0)."""
        if speed <= 0:
            raise ValueError("Speed must be positive")
        self.speed = float(speed)
        logger.info("Match playback speed set to %sx", self.speed)

    def pause(self) -> None:
        """Pause playback."""
        if not self.is_paused:
            self.is_paused = True
            self._pause_event.clear()
            logger.info("Match playback paused at minute %d (event %d)", self.current_minute, self.current_index)

    def resume(self) -> None:
        """Resume playback from pause."""
        if self.is_paused:
            self.is_paused = False
            self._pause_event.set()
            logger.info("Match playback resumed at minute %d", self.current_minute)

    def stop(self) -> None:
        """Signal playback to stop completely."""
        self._stop_requested = True
        self.is_running = False
        self._pause_event.set()  # Unblock if waiting on pause

    def seek(self, target_minute: int) -> int:
        """
        Jump playback pointer to the first event at or after target_minute.
        Returns the new event index.
        """
        if not self.match_data or not self.match_data.events:
            self.current_minute = target_minute
            return 0

        target_minute = max(0, min(120, target_minute))
        events = self.match_data.events

        # Find the earliest index where minute >= target_minute
        new_index = len(events)
        for idx, ev in enumerate(events):
            if ev.minute >= target_minute:
                new_index = idx
                break

        self.current_index = new_index
        self.current_minute = target_minute
        logger.info("Seeked playback to minute %d (index %d/%d)", target_minute, new_index, len(events))
        return self.current_index

    async def stream_events(self) -> AsyncGenerator[MatchEvent, None]:
        """
        Async generator that yields MatchEvents at intervals scaled by playback speed.
        Handles pauses, speed adjustments, and seeks smoothly.
        """
        if not self.match_data:
            raise RuntimeError("No match data loaded in playback engine")

        events = self.match_data.events
        total_events = len(events)
        self.is_running = True
        self._stop_requested = False

        try:
            while self.current_index < total_events and not self._stop_requested:
                # Wait if paused
                await self._pause_event.wait()
                if self._stop_requested:
                    break

                event = events[self.current_index]
                self.current_minute = event.minute
                self.current_index += 1

                yield event

                # Compute delay based on speed
                delay = self.base_event_delay / max(0.1, self.speed)
                await asyncio.sleep(delay)

        finally:
            self.is_running = False
            logger.info("Match playback stream finished. Total events processed: %d", self.current_index)

    def get_progress(self) -> Dict[str, Union[int, float, bool]]:
        """Return playback status summary."""
        total = len(self.match_data.events) if self.match_data else 0
        return {
            "current_minute": self.current_minute,
            "current_index": self.current_index,
            "total_events": total,
            "speed": self.speed,
            "is_running": self.is_running,
            "is_paused": self.is_paused,
        }
