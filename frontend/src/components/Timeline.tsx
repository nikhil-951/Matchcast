import React, { useRef, useState, useMemo, useCallback } from 'react';
import { MatchEvent } from '../types';
import { MatchMomentumGraph } from './MatchMomentumGraph';

interface TimelineProps {
  currentMinute: number;
  events: MatchEvent[];
  onSeek: (minute: number) => void;
  homeTeam?: string;
  awayTeam?: string;
  maxMinute?: number;
  status?: string;
}

export const Timeline: React.FC<TimelineProps> = React.memo(({
  currentMinute,
  events,
  onSeek,
  homeTeam = 'Home Team',
  awayTeam = 'Away Team',
  maxMinute = 90,
  status,
}) => {
  const [viewMode, setViewMode] = useState<'momentum' | 'classic'>('classic');
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoveredEvent, setHoveredEvent] = useState<MatchEvent | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const isFullTime = status === 'full_time';

  // Dynamic effective max minute to handle stoppage time (e.g. 94', 96') without playhead drift
  const effectiveMax = useMemo(() => {
    const maxEventMinute = events.reduce((max, ev) => Math.max(max, ev.minute || 0), 90);
    return Math.max(maxMinute, maxEventMinute, currentMinute);
  }, [events, maxMinute, currentMinute]);

  // Performance Optimization: Filter to only Key Moments / Highlights (~15-25 total)
  const keyEvents = useMemo(() => {
    return events.filter((ev) => {
      if (ev.type === 'goal' || ev.outcome === 'goal') return true;
      if (ev.type === 'card' || ev.card_type) return true;
      if (ev.type === 'substitution') return true;
      if (ev.type === 'shot' && (ev.outcome === 'saved' || (ev.xG && ev.xG >= 0.2))) return true;
      if (ev.additional?.is_penalty || ev.additional?.penalty) return true;
      return false;
    });
  }, [events]);

  const calculateMinuteFromEvent = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clampedRatio = Math.max(0, Math.min(1, clickX / rect.width));
    return Math.round(clampedRatio * effectiveMax);
  }, [effectiveMax]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const min = calculateMinuteFromEvent(e);
    onSeek(min);
  };

  // Jump to previous / next key moment
  const handlePrevKeyMoment = () => {
    const pastEvents = keyEvents.filter((e) => e.minute < currentMinute);
    if (pastEvents.length > 0) {
      const prev = pastEvents[pastEvents.length - 1];
      onSeek(prev.minute);
    } else {
      onSeek(0);
    }
  };

  const handleNextKeyMoment = () => {
    const futureEvents = keyEvents.filter((e) => e.minute > currentMinute);
    if (futureEvents.length > 0) {
      const next = futureEvents[0];
      onSeek(next.minute);
    } else {
      onSeek(effectiveMax);
    }
  };

  const getEventBadge = (event: MatchEvent) => {
    if (event.type === 'goal' || event.outcome === 'goal') {
      return { icon: '⚽', color: 'bg-emerald-500 border-emerald-300 ring-emerald-500/50 shadow-emerald-500/40' };
    }
    if (event.type === 'card') {
      if (event.card_type === 'red') {
        return { icon: '🟥', color: 'bg-red-500 border-red-300 ring-red-500/50 shadow-red-500/40' };
      }
      return { icon: '🟨', color: 'bg-amber-400 border-yellow-200 ring-amber-400/50 shadow-amber-400/40' };
    }
    if (event.type === 'substitution') {
      return { icon: '🔄', color: 'bg-blue-500 border-blue-300 ring-blue-500/50 shadow-blue-500/40' };
    }
    return { icon: '🧤', color: 'bg-purple-500 border-purple-300 ring-purple-500/50 shadow-purple-500/40' };
  };

  const formatMinuteDisplay = (min: number) => {
    if (min > 90) return `90+${min - 90}'`;
    return `${min}'`;
  };

  const progressPercent = isFullTime
    ? 100
    : Math.min(100, Math.max(0, (currentMinute / effectiveMax) * 100));

  return (
    <div className="w-full bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-2xl p-4 shadow-sm dark:shadow-2xl select-none">
      {/* Timeline Header Info & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-gray-400 mb-3 gap-2">
        <div className="flex items-center gap-2">
          {/* Mode Tabs: Momentum Wave vs Classic Scrubber */}
          <div className="flex items-center bg-slate-100 dark:bg-[#101116] p-0.5 rounded-lg border border-slate-200 dark:border-[#3D195B]/40">
            <button
              type="button"
              onClick={() => setViewMode('momentum')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'momentum'
                  ? 'bg-[#3D195B] text-[#B8F34A] shadow-xs'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>⚡</span>
              <span>MatchCast Momentum Wave</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('classic')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'classic'
                  ? 'bg-[#3D195B] text-[#B8F34A] shadow-xs'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>⏱️</span>
              <span>Classic Scrubber</span>
            </button>
          </div>

          <span className="text-[10px] text-slate-400 dark:text-gray-400 hidden lg:inline font-mono">
            {keyEvents.length > 0 ? `(${keyEvents.length} Key Highlights Tracked)` : 'Highlights appear as match unfolds'}
          </span>
        </div>

        {/* Key Moment Jump Controls & Current Time */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevKeyMoment}
            title="Jump to previous highlight"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-[#101116] hover:bg-slate-200 dark:hover:bg-[#3D195B]/60 border border-slate-200 dark:border-[#3D195B]/50 text-[11px] font-bold text-slate-700 dark:text-gray-300 hover:text-purple-900 dark:hover:text-[#B8F34A] transition-colors cursor-pointer"
          >
            <span>⏮️ Prev Moment</span>
          </button>
          <button
            type="button"
            onClick={handleNextKeyMoment}
            title="Jump to next highlight"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-[#101116] hover:bg-slate-200 dark:hover:bg-[#3D195B]/60 border border-slate-200 dark:border-[#3D195B]/50 text-[11px] font-bold text-slate-700 dark:text-gray-300 hover:text-purple-900 dark:hover:text-[#B8F34A] transition-colors cursor-pointer"
          >
            <span>Next Moment ⏭️</span>
          </button>

          <div className="flex items-center gap-1.5 font-mono font-bold ml-2 bg-slate-100 dark:bg-[#101116] px-2.5 py-1 rounded border border-slate-200 dark:border-[#3D195B]/50 text-xs">
            {isFullTime ? (
              <span className="px-2 py-0.5 rounded bg-[#3D195B]/60 text-[#B8F34A] border border-[#B8F34A]/40 text-[11px] font-black uppercase">
                FT ({formatMinuteDisplay(currentMinute)})
              </span>
            ) : (
              <>
                <span className="text-purple-900 dark:text-[#B8F34A]">{formatMinuteDisplay(currentMinute)}</span>
                <span className="text-slate-400 dark:text-gray-600">/</span>
                <span className="text-slate-500 dark:text-gray-400">{effectiveMax > 90 ? `90+` : `${maxMinute}'`}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* VIEW 1: BUNDESLIGA MATCH MOMENTUM WAVE GRAPH (Default) */}
      {viewMode === 'momentum' ? (
        <MatchMomentumGraph
          events={events}
          currentMinute={currentMinute}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          onSeek={onSeek}
          maxMinute={maxMinute}
          height={160}
        />
      ) : (
        /* VIEW 2: CLASSIC SCRUBBER BAR */
        <div>
          <div
            ref={trackRef}
            onClick={handleClick}
            className="relative h-10 w-full flex items-center cursor-pointer group py-2"
          >
            {/* Track Background Line */}
            <div className="relative w-full h-3.5 bg-slate-200 dark:bg-[#101116] rounded-full border border-slate-300 dark:border-[#3D195B]/40 overflow-visible shadow-inner">
              {/* Progress fill with smooth glow */}
              <div
                className="h-full bg-gradient-to-r from-[#3D195B] via-[#632497] to-[#B8F34A] rounded-full transition-all duration-150 shadow-md dark:shadow-lg dark:shadow-[#B8F34A]/25"
                style={{ width: `${progressPercent}%` }}
              />

              {/* Half-time marker (45') */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-gray-500/90 z-10"
                style={{ left: `${(45 / effectiveMax) * 100}%` }}
                title="Half Time (45')"
              >
                <div className="absolute -top-5 -translate-x-1/2 text-[9px] font-mono text-slate-600 dark:text-gray-300 uppercase font-bold tracking-tight">
                  HT 45&apos;
                </div>
              </div>

              {/* 15', 30', 60', 75' minute tick marks */}
              {[15, 30, 60, 75].map((tick) => (
                <div
                  key={tick}
                  className="absolute top-1 bottom-1 w-px bg-slate-400/50 dark:bg-[#3D195B]/60"
                  style={{ left: `${(tick / effectiveMax) * 100}%` }}
                />
              ))}

              {/* Current Scrubber Head */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#B8F34A] border-2 border-white shadow-lg shadow-[#B8F34A]/80 z-30 transition-transform duration-75 group-hover:scale-125 flex items-center justify-center pointer-events-none"
                style={{ left: `${progressPercent}%` }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#101116]" />
              </div>

              {/* Render Clickable Key Event Markers Only (15-25 markers) */}
              {keyEvents.map((ev, index) => {
                const evPercent = Math.min(100, Math.max(0, (ev.minute / effectiveMax) * 100));
                const badge = getEventBadge(ev);

                return (
                  <div
                    key={`${ev.event_id || index}-${ev.minute}`}
                    style={{ left: `${evPercent}%` }}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(ev.minute);
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredEvent(ev);
                      setHoverPosition({ x: rect.left + rect.width / 2, y: rect.top });
                    }}
                    onMouseLeave={() => {
                      setHoveredEvent(null);
                      setHoverPosition(null);
                    }}
                  >
                    <div
                      className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md border
                        hover:scale-125 transition-transform cursor-pointer ring-2
                        ${badge.color}
                      `}
                    >
                      <span className="select-none text-[11px]">{badge.icon}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline Axis Labels */}
          <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-gray-500 font-mono mt-1 px-1">
            <span>0&apos; Kickoff</span>
            <span className="hidden sm:inline">15&apos;</span>
            <span className="hidden sm:inline">30&apos;</span>
            <span className="font-bold text-slate-700 dark:text-gray-400">45&apos; (HT)</span>
            <span className="hidden sm:inline">60&apos;</span>
            <span className="hidden sm:inline">75&apos;</span>
            <span>90&apos;+ (FT)</span>
          </div>
        </div>
      )}

      {/* Floating Hover Event Tooltip (Classic Mode) */}
      {viewMode === 'classic' && hoveredEvent && hoverPosition && (
        <div
          style={{
            position: 'fixed',
            left: `${hoverPosition.x}px`,
            top: `${hoverPosition.y - 10}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="z-50 pointer-events-none bg-slate-900/95 dark:bg-[#0a0e1a]/95 border border-slate-700 rounded-lg p-2.5 shadow-2xl text-xs text-white max-w-xs backdrop-blur-md"
        >
          <div className="flex items-center gap-1.5 font-bold text-blue-400 mb-1">
            <span>{hoveredEvent.minute}&apos;</span>
            <span className="uppercase text-[10px] text-gray-400">({hoveredEvent.team})</span>
            <span>•</span>
            <span className="text-white">{hoveredEvent.player}</span>
          </div>
          <div className="text-gray-300 text-[11px] leading-snug">
            {hoveredEvent.description || `${hoveredEvent.type.toUpperCase()} by ${hoveredEvent.player}`}
          </div>
        </div>
      )}
    </div>
  );
});

Timeline.displayName = 'Timeline';
