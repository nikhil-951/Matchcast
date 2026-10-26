import React, { useMemo, useState, useRef, useCallback } from 'react';
import { MatchEvent } from '../types';

interface MatchMomentumGraphProps {
  events: MatchEvent[];
  currentMinute: number;
  homeTeam: string;
  awayTeam: string;
  onSeek?: (minute: number) => void;
  maxMinute?: number;
  height?: number;
  compact?: boolean;
}

export const MatchMomentumGraph: React.FC<MatchMomentumGraphProps> = React.memo(({
  events,
  currentMinute,
  homeTeam,
  awayTeam,
  onSeek,
  maxMinute = 90,
  height = 180,
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredMinute, setHoveredMinute] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);

  // Dynamic effective max minute to handle stoppage time
  const effectiveMax = useMemo(() => {
    const maxEventMinute = events.reduce((max, ev) => Math.max(max, ev.minute || 0), 90);
    return Math.max(maxMinute, maxEventMinute, currentMinute);
  }, [events, maxMinute, currentMinute]);

  // Compute rolling 5-minute attacking momentum time-series curve (0 to effectiveMax)
  const momentumSeries = useMemo(() => {
    const series: Array<{ minute: number; net: number; homePct: number; awayPct: number }> = [];

    for (let m = 0; m <= effectiveMax; m++) {
      // Rolling 5-minute window [m-4, m]
      const windowEvents = events.filter((e) => (e.minute || 0) >= m - 4 && (e.minute || 0) <= m);

      let homeThreat = 4.0;
      let awayThreat = 4.0;

      for (const e of windowEvents) {
        const teamName = (e.team || '').trim().toLowerCase();
        const isHome = teamName === 'home' || teamName === homeTeam.trim().toLowerCase();

        let weight = 0.0;
        const eType = (e.type || '').toLowerCase();
        const eOutcome = (e.outcome || '').toLowerCase();
        const posX = e.position?.x ?? 50;

        if (eType === 'pass' || eType === 'free_kick') {
          weight += 1.0;
          if (posX >= 65) weight += 1.5; // Final third pass
          if (posX >= 85) weight += 1.0; // Penalty box entry
          if (e.additional?.progressive || (e as any).progressive) weight += 1.0;
          if (eOutcome === 'incomplete' || (e as any).success === false) weight -= 0.6;
        } else if (eType === 'shot') {
          weight += 4.0 + (e.xG || 0.1) * 14.0;
          if (eOutcome === 'goal') weight += 8.0;
          if (eOutcome === 'saved' || eOutcome === 'blocked') weight += 1.5;
        } else if (eType === 'goal') {
          weight += 12.0;
        } else if (eType === 'corner') {
          weight += 2.5;
        } else if (eType === 'tackle' || eType === 'interception' || eType === 'ball_recovery') {
          weight += 1.5;
          if (posX >= 55) weight += 1.5; // High press recovery
        } else if (eType === 'foul') {
          weight -= 1.0;
        }

        if (isHome) {
          homeThreat += Math.max(0, weight);
        } else {
          awayThreat += Math.max(0, weight);
        }
      }

      const total = homeThreat + awayThreat;
      const net = (homeThreat - awayThreat) / (total > 0 ? total : 8.0); // -1.0 (away) to +1.0 (home)
      const homePct = Math.round((homeThreat / total) * 100);
      const awayPct = 100 - homePct;

      series.push({ minute: m, net, homePct, awayPct });
    }

    return series;
  }, [events, effectiveMax, homeTeam]);

  // Extract key events to pin on the graph (Goals, Cards)
  const pinnedEvents = useMemo(() => {
    return events
      .filter((e) => {
        const isGoal = e.type === 'goal' || e.outcome === 'goal';
        const isCard = e.type === 'card' || !!e.card_type;
        return isGoal || isCard;
      })
      .map((e) => {
        const teamName = (e.team || '').trim().toLowerCase();
        const isHome = teamName === 'home' || teamName === homeTeam.trim().toLowerCase();
        const isGoal = e.type === 'goal' || e.outcome === 'goal';
        const isRed = e.card_type === 'red' || (e.type === 'card' && String(e.additional?.card) === 'red');
        return {
          ...e,
          isHome,
          isGoal,
          isRed,
        };
      });
  }, [events, homeTeam]);

  // SVG coordinate dimensions
  const SVG_WIDTH = 1000;
  const SVG_HEIGHT = height;
  const ZERO_Y = SVG_HEIGHT / 2;
  const AMPLITUDE = (SVG_HEIGHT / 2) - 24; // Margin for pins

  // Build SVG polygon paths for Home (Top - Red) and Away (Bottom - Light)
  const { homePath, awayPath } = useMemo(() => {
    if (momentumSeries.length === 0) return { homePath: '', awayPath: '' };

    // Points for home (top half, y <= ZERO_Y)
    const homePoints: Array<[number, number]> = [];
    // Points for away (bottom half, y >= ZERO_Y)
    const awayPoints: Array<[number, number]> = [];

    momentumSeries.forEach((pt) => {
      const x = (pt.minute / effectiveMax) * SVG_WIDTH;
      const net = pt.net; // -1 to +1

      if (net >= 0) {
        // Home peak goes UP (y decreases)
        const yHome = ZERO_Y - (net * AMPLITUDE);
        homePoints.push([x, yHome]);
        awayPoints.push([x, ZERO_Y]);
      } else {
        // Away peak goes DOWN (y increases)
        const yAway = ZERO_Y + (Math.abs(net) * AMPLITUDE);
        homePoints.push([x, ZERO_Y]);
        awayPoints.push([x, yAway]);
      }
    });

    // Generate smooth SVG paths
    const buildAreaD = (pts: Array<[number, number]>, isTop: boolean) => {
      if (pts.length < 2) return '';
      let d = `M 0,${ZERO_Y} `;
      pts.forEach(([px, py]) => {
        d += `L ${px.toFixed(1)},${py.toFixed(1)} `;
      });
      d += `L ${SVG_WIDTH},${ZERO_Y} Z`;
      return d;
    };

    return {
      homePath: buildAreaD(homePoints, true),
      awayPath: buildAreaD(awayPoints, false),
    };
  }, [momentumSeries, effectiveMax, ZERO_Y, AMPLITUDE]);

  // Click & Seek handling
  const handleGraphClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !onSeek) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetMin = Math.round(ratio * effectiveMax);
    onSeek(targetMin);
  }, [effectiveMax, onSeek]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetMin = Math.round(ratio * effectiveMax);
    setHoveredMinute(targetMin);
    setHoverPosition({ x: e.clientX, y: rect.top });
  }, [effectiveMax]);

  const handleMouseLeave = useCallback(() => {
    setHoveredMinute(null);
    setHoverPosition(null);
  }, []);

  // Events occurring at hovered minute
  const hoveredEvents = useMemo(() => {
    if (hoveredMinute === null) return [];
    return events.filter((e) => e.minute === hoveredMinute);
  }, [hoveredMinute, events]);

  const currentMomPoint = useMemo(() => {
    if (hoveredMinute !== null && hoveredMinute < momentumSeries.length) {
      return momentumSeries[hoveredMinute];
    }
    const idx = Math.min(currentMinute, momentumSeries.length - 1);
    return momentumSeries[idx] || { minute: currentMinute, net: 0, homePct: 50, awayPct: 50 };
  }, [hoveredMinute, currentMinute, momentumSeries]);

  const playheadXPercent = Math.min(100, Math.max(0, (currentMinute / effectiveMax) * 100));
  const htXPercent = (45 / effectiveMax) * 100;

  return (
    <div className="w-full bg-[#101116] border border-slate-800 rounded-2xl p-4 shadow-2xl select-none flex flex-col justify-between">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between mb-2 px-1 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
            <span>⚡</span>
            <span>Match Momentum</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            (MatchCast Momentum Engine • Rolling 5&apos; Threat Differential)
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono font-bold">
          <div className="flex items-center gap-1.5 text-[#B8F34A]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3D195B] border border-[#B8F34A] shadow-sm shadow-[#B8F34A]/40" />
            <span className="max-w-[160px] sm:max-w-none truncate">{homeTeam}</span>
            <span className="text-slate-400 font-normal">({currentMomPoint.homePct}%)</span>
          </div>
          <span className="text-slate-600 font-normal">vs</span>
          <div className="flex items-center gap-1.5 text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20212A] border border-[#F3F4F6] shadow-sm shadow-white/30" />
            <span className="max-w-[160px] sm:max-w-none truncate">{awayTeam}</span>
            <span className="text-slate-400 font-normal">({currentMomPoint.awayPct}%)</span>
          </div>
        </div>
      </div>

      {/* Main Momentum Canvas & Event Pins */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full cursor-default select-none group py-1"
        style={{ height: `${SVG_HEIGHT}px` }}
      >
        {/* SVG Mountain Wave */}
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Home Team Wave Fill (Purple to Electric Emerald/Lime) */}
            <linearGradient id="homeWaveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B8F34A" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#3D195B" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#1e102d" stopOpacity="0.75" />
            </linearGradient>

            {/* Away Team Wave Fill (Crisp White to Slate Graphite) */}
            <linearGradient id="awayWaveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#20212A" stopOpacity="0.75" />
              <stop offset="40%" stopColor="#64748b" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#F3F4F6" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Central Zero Baseline */}
          <line
            x1="0"
            y1={ZERO_Y}
            x2={SVG_WIDTH}
            y2={ZERO_Y}
            stroke="#475569"
            strokeWidth="1.5"
            strokeOpacity="0.8"
          />

          {/* Half-Time Dotted Vertical Divider */}
          <line
            x1={(45 / effectiveMax) * SVG_WIDTH}
            y1="4"
            x2={(45 / effectiveMax) * SVG_WIDTH}
            y2={SVG_HEIGHT - 4}
            stroke="#64748b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            strokeOpacity="0.7"
          />

          {/* Top Filled Waves (Home Threat) */}
          <path d={homePath} fill="url(#homeWaveGrad)" />

          {/* Bottom Filled Waves (Away Threat) */}
          <path d={awayPath} fill="url(#awayWaveGrad)" />

          {/* Playhead Vertical Line */}
          <line
            x1={(currentMinute / effectiveMax) * SVG_WIDTH}
            y1="0"
            x2={(currentMinute / effectiveMax) * SVG_WIDTH}
            y2={SVG_HEIGHT}
            stroke="#B8F34A"
            strokeWidth="2"
            strokeOpacity="0.9"
          />
        </svg>

        {/* Pinned Event Badges (Goals ⚽ and Cards 🟨 🟥) */}
        {pinnedEvents.map((ev, idx) => {
          const xPct = Math.min(98, Math.max(2, (ev.minute / effectiveMax) * 100));
          // If Home: placed at top (Y ~ 14%); if Away: placed at bottom (Y ~ 86%)
          const topPosition = ev.isHome ? '12%' : '88%';

          return (
            <div
              key={`${ev.event_id || idx}-${ev.minute}`}
              style={{
                left: `${xPct}%`,
                top: topPosition,
                transform: 'translate(-50%, -50%)',
              }}
              title={`${ev.minute}': ${ev.isGoal ? '⚽ GOAL' : ev.isRed ? '🟥 RED CARD' : '🟨 YELLOW CARD'} by ${ev.player || ev.team}`}
              className="absolute z-20 flex items-center justify-center transition-transform hover:scale-135 cursor-default" 
            >
              {ev.isGoal ? (
                <div className="w-6 h-6 rounded-full bg-black/80 border border-white/60 shadow-lg shadow-black/80 flex items-center justify-center text-sm select-none">
                  ⚽
                </div>
              ) : ev.isRed ? (
                <div className="w-5 h-5 rounded-md bg-red-600 border border-white/80 shadow-md flex items-center justify-center text-[10px] select-none">
                  🟥
                </div>
              ) : (
                <div className="w-5 h-5 rounded-md bg-amber-400 border border-black/40 shadow-md flex items-center justify-center text-[10px] select-none text-black font-bold">
                  🟨
                </div>
              )}
            </div>
          );
        })}

        {/* Hover Vertical Guide Line */}
        {hoveredMinute !== null && (
          <div
            style={{ left: `${(hoveredMinute / effectiveMax) * 100}%` }}
            className="absolute top-0 bottom-0 w-px bg-white/60 pointer-events-none z-10"
          />
        )}
      </div>

      {/* Axis Labels (0' Kickoff, HT, FT) */}
      <div className="relative w-full flex justify-between items-center text-[11px] text-slate-400 font-mono mt-1 px-1">
        <span>0&apos;</span>

        <span
          style={{ left: `${htXPercent}%`, transform: 'translateX(-50%)' }}
          className="absolute font-bold text-slate-300"
        >
          HT
        </span>

        <span>FT ({effectiveMax}&apos;)</span>
      </div>

      {/* Hover Floating Tooltip */}
      {hoveredMinute !== null && hoverPosition && (
        <div
          style={{
            position: 'fixed',
            left: `${hoverPosition.x}px`,
            top: `${hoverPosition.y - 12}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="z-50 pointer-events-none bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs text-white max-w-xs backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-3 font-bold mb-1 border-b border-slate-800 pb-1">
            <span className="text-[#B8F34A] font-mono text-xs">{hoveredMinute}&apos; Minute</span>
            <span className="text-[10px] text-slate-400 uppercase">Click to jump →</span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono py-1">
            <span className="text-[#B8F34A] font-bold">{homeTeam}: {currentMomPoint.homePct}%</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-200 font-bold">{awayTeam}: {currentMomPoint.awayPct}%</span>
          </div>

          {hoveredEvents.length > 0 ? (
            <div className="mt-1 pt-1 border-t border-slate-800 space-y-1">
              {hoveredEvents.map((ev, i) => (
                <div key={i} className="text-[11px] text-slate-300 flex items-center gap-1.5">
                  <span>{ev.type === 'goal' || ev.outcome === 'goal' ? '⚽' : ev.card_type ? '🟨' : '⚡'}</span>
                  <span className="font-bold text-white">{ev.player || ev.team}</span>
                  <span className="text-slate-400 truncate max-w-[180px]">({ev.description || ev.type})</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 italic mt-0.5">
              {currentMomPoint.net > 0.15
                ? `High attacking pressure by ${homeTeam}`
                : currentMomPoint.net < -0.15
                ? `High attacking pressure by ${awayTeam}`
                : 'Balanced passage of play'}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

MatchMomentumGraph.displayName = 'MatchMomentumGraph';
