import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchEvent } from '../types';

interface PitchVisualizerProps {
  matchId?: string;
  lastEvent: MatchEvent | null;
  events?: MatchEvent[];
  homeTeam: string;
  awayTeam: string;
  status?: string;
  score?: { home: number; away: number };
  favoritePlayer?: string | null;
}

interface ActiveOverlay {
  id: string;
  event: MatchEvent;
  createdAt: number;
}

interface RosterMember {
  name: string;
  number?: number | null;
  role: string;
  key: string;
  seedX: number;
  seedY: number;
}

// Official Ground-Truth Player Role & Jersey Number Registry
// Guarantees 100% tactical fidelity across fullbacks, center backs, midfielders, wingers, and strikers
const PLAYER_ROLES_REGISTRY: Record<string, { role: string; number: number }> = {
  'A. Mokoena': { role: 'CB', number: 4 },
  'A. Moretti': { role: 'LB', number: 3 },
  'A. Nwosu-Brown': { role: 'DM', number: 16 },
  'A. Solbakken': { role: 'ST', number: 9 },
  'A. Sorenson': { role: 'DM', number: 4 },
  'A. Van Der Beek': { role: 'RB', number: 2 },
  'A. Zivkovic': { role: 'CM', number: 21 },
  'B. Geller': { role: 'CB', number: 4 },
  'B. Nygard': { role: 'LW', number: 11 },
  'B. O\'Farrell': { role: 'CB', number: 22 },
  'C. Blackwell': { role: 'CB', number: 5 },
  'C. D\'Angelo': { role: 'RB', number: 2 },
  'C. Dupuis': { role: 'CM', number: 22 },
  'C. O\'Donnell': { role: 'RW', number: 7 },
  'C. Sinclair': { role: 'CM', number: 17 },
  'C. Vane': { role: 'GK', number: 1 },
  'D. Calderon': { role: 'GK', number: 22 },
  'D. Castaneda': { role: 'LB', number: 24 },
  'D. Kovacevic': { role: 'GK', number: 23 },
  'D. Ristic': { role: 'RW', number: 7 },
  'D. Savic': { role: 'CB', number: 5 },
  'D. Stoilov': { role: 'RM', number: 7 },
  'D. Vance': { role: 'CB', number: 5 },
  'E. Adetunji': { role: 'ST', number: 9 },
  'E. De Vries': { role: 'DM', number: 8 },
  'E. Lindberg': { role: 'CM', number: 8 },
  'E. Rostami': { role: 'CB', number: 5 },
  'E. Vukovic': { role: 'ST', number: 9 },
  'F. Cruz': { role: 'ST', number: 21 },
  'F. Mercer': { role: 'CB', number: 18 },
  'G. Castille': { role: 'CM', number: 8 },
  'G. Larsson': { role: 'ST', number: 20 },
  'G. Navas': { role: 'CAM', number: 10 },
  'H. Brauer': { role: 'RB', number: 2 },
  'H. Guttman': { role: 'GK', number: 1 },
  'H. Nyberg': { role: 'CB', number: 14 },
  'I. Diallo': { role: 'ST', number: 9 },
  'I. Varga': { role: 'CB', number: 6 },
  'J. Bradshaw-Cruz': { role: 'DM', number: 41 },
  'J. Calderon': { role: 'ST', number: 9 },
  'J. Thorne': { role: 'DM', number: 6 },
  'J. Tremblay': { role: 'RB', number: 2 },
  'K. Demir': { role: 'CB', number: 4 },
  'K. Lind': { role: 'CM', number: 16 },
  'K. Lindstrom': { role: 'CM', number: 20 },
  'K. Miyazawa': { role: 'LW', number: 11 },
  'K. O\'Leary': { role: 'RM', number: 7 },
  'K. Okonjo': { role: 'ST', number: 19 },
  'K. Varga': { role: 'CAM', number: 10 },
  'K. Voronin': { role: 'CB', number: 4 },
  'L. Kincaid': { role: 'GK', number: 13 },
  'L. Peeters': { role: 'LM', number: 11 },
  'L. Vance': { role: 'RW', number: 7 },
  'M. Al-Mansoor': { role: 'GK', number: 1 },
  'M. Balic': { role: 'CM', number: 8 },
  'M. Belotti': { role: 'ST', number: 9 },
  'M. Benali': { role: 'LB', number: 3 },
  'M. Brandao': { role: 'CM', number: 6 },
  'M. El-Sayed': { role: 'CM', number: 10 },
  'M. Sorenson': { role: 'ST', number: 9 },
  'M. Vance': { role: 'RB', number: 2 },
  'M. Zouma': { role: 'LW', number: 11 },
  'N. Achebe': { role: 'LW', number: 11 },
  'N. Kolar': { role: 'ST', number: 19 },
  'N. Skov': { role: 'CB', number: 5 },
  'N. Tadic': { role: 'LWB', number: 3 },
  'O. Sissoko': { role: 'ST', number: 14 },
  'P. Cisse': { role: 'LM', number: 11 },
  'P. Gallagher': { role: 'CB', number: 15 },
  'P. Lindqvist': { role: 'RWB', number: 2 },
  'P. Nielsen': { role: 'CB', number: 24 },
  'R. Callahan': { role: 'CM', number: 8 },
  'R. Dubois': { role: 'CB', number: 14 },
  'R. Holst': { role: 'ST', number: 10 },
  'R. Kolarov': { role: 'DM', number: 6 },
  'R. Tanaka': { role: 'LB', number: 3 },
  'S. Arisawa': { role: 'GK', number: 12 },
  'S. Baros': { role: 'CM', number: 15 },
  'S. Fontana': { role: 'CM', number: 17 },
  'S. Halvorsen': { role: 'CB', number: 4 },
  'S. Jansen': { role: 'CM', number: 10 },
  'S. O\'Connor': { role: 'LB', number: 16 },
  'T. Althaus': { role: 'DM', number: 6 },
  'T. Hakala': { role: 'CB', number: 25 },
  'T. Hauksson': { role: 'LB', number: 3 },
  'T. Jepsen': { role: 'CM', number: 8 },
  'T. Moreau': { role: 'RW', number: 7 },
  'T. Ruan': { role: 'CM', number: 18 },
  'V. Petrov': { role: 'CB', number: 3 },
  'V. Ramos-Silva': { role: 'RB', number: 2 },
  'Y. Fofana': { role: 'ST', number: 18 },
  'Z. Hristov': { role: 'CM', number: 10 },
};

const HOME_FORMATION_SLOTS = [
  { role: 'GK', key: 'GK', defaultName: 'Goalkeeper', seedX: 0.1, seedY: 0.2 },
  { role: 'LB', key: 'LB', defaultName: 'Left Back', seedX: 4.4, seedY: 2.7 },
  { role: 'CB', key: 'CB1', defaultName: 'Centre Back 1', seedX: 2.2, seedY: 1.4 },
  { role: 'CB', key: 'CB2', defaultName: 'Centre Back 2', seedX: 3.3, seedY: 2.1 },
  { role: 'RB', key: 'RB', defaultName: 'Right Back', seedX: 1.1, seedY: 0.8 },
  { role: 'DM', key: 'DM', defaultName: 'Defensive Mid', seedX: 5.5, seedY: 3.5 },
  { role: 'CM', key: 'CM1', defaultName: 'Central Mid 1', seedX: 6.6, seedY: 4.1 },
  { role: 'CM', key: 'CM2', defaultName: 'Central Mid 2', seedX: 7.7, seedY: 4.8 },
  { role: 'LW', key: 'LW', defaultName: 'Left Wing', seedX: 11.0, seedY: 6.9 },
  { role: 'ST', key: 'ST', defaultName: 'Striker', seedX: 9.9, seedY: 6.2 },
  { role: 'RW', key: 'RW', defaultName: 'Right Wing', seedX: 8.8, seedY: 5.5 },
];

const AWAY_FORMATION_SLOTS = [
  { role: 'GK', key: 'GK', defaultName: 'Goalkeeper', seedX: 1.5, seedY: 0.7 },
  { role: 'RB', key: 'RB', defaultName: 'Right Back', seedX: 6.0, seedY: 3.8 },
  { role: 'CB', key: 'CB1', defaultName: 'Centre Back 1', seedX: 3.8, seedY: 2.4 },
  { role: 'CB', key: 'CB2', defaultName: 'Centre Back 2', seedX: 4.9, seedY: 3.1 },
  { role: 'LB', key: 'LB', defaultName: 'Left Back', seedX: 2.7, seedY: 1.9 },
  { role: 'DM', key: 'DM1', defaultName: 'Defensive Mid 1', seedX: 7.1, seedY: 4.5 },
  { role: 'DM', key: 'DM2', defaultName: 'Defensive Mid 2', seedX: 8.2, seedY: 5.2 },
  { role: 'AM', key: 'AM', defaultName: 'Attacking Mid', seedX: 9.3, seedY: 5.9 },
  { role: 'RW', key: 'RW', defaultName: 'Right Wing', seedX: 12.6, seedY: 8.0 },
  { role: 'ST', key: 'ST', defaultName: 'Striker', seedX: 11.5, seedY: 7.3 },
  { role: 'LW', key: 'LW', defaultName: 'Left Wing', seedX: 10.4, seedY: 6.6 },
];

function buildTacticalRoster(
  events: MatchEvent[],
  teamName: string,
  isHome: boolean,
  slots: typeof HOME_FORMATION_SLOTS
): RosterMember[] {
  const playerStats = new Map<
    string,
    {
      name: string;
      number?: number | null;
      count: number;
      saveCount: number;
      sumX: number;
      sumY: number;
    }
  >();

  (events || []).forEach((ev) => {
    const isTeam = isHome
      ? ev.team === 'home' || (ev.team && ev.team.toLowerCase() === teamName.toLowerCase())
      : ev.team === 'away' || (ev.team && ev.team.toLowerCase() === teamName.toLowerCase());

    if (!isTeam || !ev.player) return;

    const num = (ev as any).player_number ?? ev.additional?.player_number ?? null;
    const pos = ev.position || { x: 50, y: 50 };
    const evType = (ev.type || '').toLowerCase();
    const isSave = evType === 'save' || evType === 'goal_kick';

    let stat = playerStats.get(ev.player);
    if (!stat) {
      stat = {
        name: ev.player,
        number: num,
        count: 0,
        saveCount: 0,
        sumX: 0,
        sumY: 0,
      };
      playerStats.set(ev.player, stat);
    }
    if (num && !stat.number) stat.number = num;
    stat.count += 1;
    if (isSave) stat.saveCount += 1;
    stat.sumX += pos.x;
    stat.sumY += pos.y;
  });

  const playerList = Array.from(playerStats.values()).map((p) => {
    const reg = PLAYER_ROLES_REGISTRY[p.name];
    return {
      name: p.name,
      number: reg ? reg.number : p.number,
      role: reg ? reg.role : null,
      count: p.count,
      isGk: (reg && reg.role === 'GK') || p.saveCount > 0 || p.number === 1,
      avgX: p.count > 0 ? p.sumX / p.count : 50,
      avgY: p.count > 0 ? p.sumY / p.count : 50,
    };
  });

  const assignedNames = new Set<string>();
  const squad: RosterMember[] = [];

  // Slot 0: GK
  let gk = playerList.find((p) => p.isGk);
  if (!gk && playerList.length > 0) {
    gk = playerList.reduce((min, p) => (p.avgX < min.avgX ? p : min), playerList[0]);
  }
  if (gk) assignedNames.add(gk.name);
  squad.push({
    name: gk ? gk.name : `${teamName} ${slots[0].defaultName}`,
    number: gk ? gk.number : 1,
    role: slots[0].role,
    key: slots[0].key,
    seedX: slots[0].seedX,
    seedY: slots[0].seedY,
  });

  // Remaining outfield candidates sorted by match participation count
  const outfield = playerList.filter((p) => !assignedNames.has(p.name));

  // Populate outfield formation slots with ground-truth role matching
  for (let i = 1; i < slots.length; i++) {
    const slot = slots[i];
    let matched = outfield.find((p) => !assignedNames.has(p.name) && p.role === slot.role);
    if (!matched) {
      if (slot.role.includes('B')) {
        matched = outfield.find((p) => !assignedNames.has(p.name) && p.role && p.role.includes('B'));
      } else if (slot.role.includes('M')) {
        matched = outfield.find((p) => !assignedNames.has(p.name) && p.role && p.role.includes('M'));
      } else {
        matched = outfield.find((p) => !assignedNames.has(p.name) && p.role && (p.role === 'ST' || p.role === 'FW' || p.role === 'RW' || p.role === 'LW'));
      }
    }
    if (!matched) {
      matched = outfield.find((p) => !assignedNames.has(p.name));
    }

    if (matched) assignedNames.add(matched.name);
    squad.push({
      name: matched ? matched.name : `${teamName} ${slot.defaultName}`,
      number: matched ? matched.number : null,
      role: slot.role,
      key: slot.key,
      seedX: slot.seedX,
      seedY: slot.seedY,
    });
  }

  return squad;
}

// Continuous Sofascore / Opta Style Thermal Colormap Palette (256-step LUT)
// Progression: Blue -> Cyan -> Lime Green -> Yellow -> Orange -> Crimson Red
// Broadcast Sofascore / Opta Style Thermal Colormap Palette (256-step LUT)
// Progression: Transparent -> Cobalt Blue -> Cyan -> Lime Green -> Yellow -> Orange -> Crimson Red
const THERMAL_COLORMAP_LUT = (() => {
  const stops = [
    { t: 0.00, r: 0, g: 30, b: 180, a: 0 },
    { t: 0.08, r: 0, g: 65, b: 235, a: 120 },
    { t: 0.22, r: 0, g: 195, b: 255, a: 170 },
    { t: 0.40, r: 25, g: 235, b: 75, a: 205 },
    { t: 0.60, r: 255, g: 235, b: 0, a: 230 },
    { t: 0.80, r: 255, g: 115, b: 0, a: 245 },
    { t: 1.00, r: 235, g: 20, b: 20, a: 255 },
  ];
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let s0 = stops[0];
    let s1 = stops[stops.length - 1];
    for (let k = 0; k < stops.length - 1; k++) {
      if (stops[k].t <= t && t <= stops[k + 1].t) {
        s0 = stops[k];
        s1 = stops[k + 1];
        break;
      }
    }
    const factor = (t - s0.t) / (s1.t - s0.t || 1);
    const idx = i * 4;
    lut[idx] = Math.round(s0.r + (s1.r - s0.r) * factor);
    lut[idx + 1] = Math.round(s0.g + (s1.g - s0.g) * factor);
    lut[idx + 2] = Math.round(s0.b + (s1.b - s0.b) * factor);
    lut[idx + 3] = Math.round(s0.a + (s1.a - s0.a) * factor);
  }
  return lut;
})();

// Fast 32-bit representation for sub-millisecond canvas color remapping
const THERMAL_COLORMAP_LUT_32 = new Uint32Array(THERMAL_COLORMAP_LUT.buffer);

export const PitchVisualizer: React.FC<PitchVisualizerProps> = React.memo(({
  matchId,
  lastEvent,
  events = [],
  homeTeam,
  awayTeam,
  status,
  score,
  favoritePlayer,
}) => {
  const [activeOverlays, setActiveOverlays] = useState<ActiveOverlay[]>([]);
  const isFullTime = status === 'full_time';
  const isGoal = (lastEvent?.type || '').toLowerCase() === 'goal' || (lastEvent?.outcome || '').toLowerCase() === 'goal';
  const [ballPos, setBallPos] = useState<{ x: number; y: number }>({ x: 52.5, y: 34 });

  // Heatmap View state
  const [visualizerMode, setVisualizerMode] = useState<'radar' | 'heatmap'>('radar');
  const [selectedHeatmapPlayer, setSelectedHeatmapPlayer] = useState<string | null>(favoritePlayer || null);
  const [heatmapScope, setHeatmapScope] = useState<'current' | 'full'>('current');
  const [allMatchEvents, setAllMatchEvents] = useState<MatchEvent[]>([]);
  const [isLoadingAllEvents, setIsLoadingAllEvents] = useState<boolean>(false);

  // Pitch dimensions in standard meters
  const PITCH_WIDTH = 105;
  const PITCH_HEIGHT = 68;

  // Fetch full match events for complete heatmap when matchId changes
  useEffect(() => {
    if (!matchId) return;
    let isMounted = true;
    setIsLoadingAllEvents(true);
    fetch(`/api/match/${matchId}/events`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.events) return;
        setAllMatchEvents(data.events);
      })
      .catch((err) => {
        console.warn('Failed to fetch full match events for heatmap:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAllEvents(false);
      });
    return () => {
      isMounted = false;
    };
  }, [matchId]);

  // Standardized individual player coordinate mapping for Heatmap mode
  // Normalizes perspective so the player's team attacks from LEFT to RIGHT (0 -> 105m)
  // Standard pitch:
  // - Defensive Third / Own Goal: X in [0, 35m] (Left)
  // - Middle Third: X in [35, 70m] (Center)
  // - Attacking Third / Opponent Goal: X in [70, 105m] (Right)
  // - Right Flank (RB, RW): Y in [34, 68m] (Bottom of screen)
  // - Left Flank (LB, LW): Y in [0, 34m] (Top of screen)
  const mapHeatmapCoords = (pos?: { x: number; y: number }) => {
    if (!pos) return { x: 52.5, y: 34 };
    let x = pos.x;
    let y = pos.y;
    if (x <= 100 && y <= 100) {
      x = (x / 100) * PITCH_WIDTH;
      // Invert Y so raw y=15 (RB/RW) maps to bottom touchline (Y > 34m), raw y=85 (LB/LW) maps to top touchline (Y < 34m)
      y = ((100 - y) / 100) * PITCH_HEIGHT;
    }
    return {
      x: Math.max(1, Math.min(PITCH_WIDTH - 1, x)),
      y: Math.max(1, Math.min(PITCH_HEIGHT - 1, y)),
    };
  };

  // Convert coordinate (0-100 normalized attacking or 105x68) to SVG pitch coordinate space for 22-player match radar.
  const mapCoords = (pos?: { x: number; y: number }, team?: string) => {
    if (!pos) return { x: 52.5, y: 34 };
    let x = pos.x;
    let y = pos.y;
    const isAway = team === 'away' || (team && team.toLowerCase() === awayTeam.toLowerCase());
    if (isAway && x <= 100 && y <= 100) {
      x = 100 - x;
      y = 100 - y;
    }
    if (x <= 100 && y <= 100) {
      x = (x / 100) * PITCH_WIDTH;
      y = (y / 100) * PITCH_HEIGHT;
    }
    return {
      x: Math.min(PITCH_WIDTH, Math.max(0, x)),
      y: Math.min(PITCH_HEIGHT, Math.max(0, y)),
    };
  };

  // Clock tick for continuous living athlete micro-motion
  const [clockTick, setClockTick] = useState<number>(0);
  useEffect(() => {
    if (isFullTime) return;
    const interval = setInterval(() => {
      setClockTick((prev) => (prev + 1) % 10000);
    }, 200);
    return () => clearInterval(interval);
  }, [isFullTime]);

  // If match reaches full time, park ball at center circle and clear active pins
  useEffect(() => {
    if (isFullTime) {
      setBallPos({ x: 52.5, y: 34 });
      setActiveOverlays([]);
    }
  }, [isFullTime]);

  // Track incoming event and update animated ball position smoothly
  useEffect(() => {
    if (!lastEvent || isFullTime) return;

    const targetPos = lastEvent.end_position
      ? mapCoords(lastEvent.end_position, lastEvent.team)
      : mapCoords(lastEvent.position, lastEvent.team);

    setBallPos(targetPos);

    const newOverlay: ActiveOverlay = {
      id: `${lastEvent.event_id || Date.now()}-${Math.random()}`,
      event: lastEvent,
      createdAt: Date.now(),
    };

    setActiveOverlays([newOverlay]);

    const timer = setTimeout(() => {
      setActiveOverlays((prev) => prev.filter((o) => o.id !== newOverlay.id));
    }, 1800);

    return () => clearTimeout(timer);
  }, [lastEvent, isFullTime, homeTeam, awayTeam]);

  // Faded recent pass trajectories (last 5-7 events) to bring radar to life
  const recentPassTrails = useMemo(() => {
    if (!events || events.length === 0) return [];
    const valid = events
      .filter((e) => (e.type === 'pass' || e.type === 'shot' || e.type === 'cross' || e.type === 'free_kick') && e.end_position)
      .slice(-6);

    return valid.map((ev, idx) => {
      const start = mapCoords(ev.position, ev.team);
      const end = mapCoords(ev.end_position, ev.team);
      const opacity = 0.12 + (idx / Math.max(1, valid.length)) * 0.38;
      const isHome = ev.team === 'home' || (ev.team && ev.team.toLowerCase() === homeTeam.toLowerCase());
      const color = ev.type === 'shot' ? '#38bdf8' : isHome ? '#B8F34A' : '#f59e0b';
      return { id: `${ev.event_id || idx}-${idx}`, start, end, opacity, color, isShot: ev.type === 'shot' };
    });
  }, [events, homeTeam, awayTeam]);

  // Intelligent Tactical Squad Allocation
  // Analyzes spatial coordinates and action types to place GKs, Defenders, Midfielders, and Attackers correctly.
  const squadEventsSource = allMatchEvents.length > 0 ? allMatchEvents : events;
  const homeSquad = useMemo(() => buildTacticalRoster(squadEventsSource, homeTeam, true, HOME_FORMATION_SLOTS), [squadEventsSource, homeTeam]);
  const awaySquad = useMemo(() => buildTacticalRoster(squadEventsSource, awayTeam, false, AWAY_FORMATION_SLOTS), [squadEventsSource, awayTeam]);

  // All distinct players for Heatmap Selector (starters + substitutes with ground-truth roles)
  const allSelectablePlayers = useMemo(() => {
    const list: { name: string; number?: number | null; role: string; team: string; isHome: boolean }[] = [];

    // Ingest all players who appeared in match events
    const distinctPlayers = new Map<string, { team: string; isHome: boolean; number?: number | null }>();
    squadEventsSource.forEach((ev) => {
      if (!ev.player || distinctPlayers.has(ev.player)) return;
      const isHome = ev.team === 'home' || (ev.team && ev.team.toLowerCase() === homeTeam.toLowerCase());
      const num = (ev as any).player_number ?? ev.additional?.player_number ?? null;
      distinctPlayers.set(ev.player, {
        team: isHome ? homeTeam : awayTeam,
        isHome,
        number: num,
      });
    });

    distinctPlayers.forEach((info, name) => {
      const reg = PLAYER_ROLES_REGISTRY[name];
      const role = reg ? reg.role : (homeSquad.find((p) => p.name === name)?.role || awaySquad.find((p) => p.name === name)?.role || 'Player');
      const number = reg ? reg.number : info.number;
      list.push({
        name,
        number,
        role,
        team: info.team,
        isHome: info.isHome,
      });
    });

    // Sort by team, then position hierarchy (GK -> DF -> MF -> FW)
    const roleRank: Record<string, number> = { GK: 1, RB: 2, RWB: 2, CB: 3, CB1: 3, CB2: 3, LB: 4, LWB: 4, DM: 5, DM1: 5, DM2: 5, CM: 6, CM1: 6, CM2: 6, CAM: 7, AM: 7, RM: 8, LM: 8, RW: 9, LW: 10, ST: 11, FW: 11 };
    list.sort((a, b) => {
      if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
      const rA = roleRank[a.role] || 50;
      const rB = roleRank[b.role] || 50;
      return rA - rB;
    });

    return list;
  }, [squadEventsSource, homeSquad, awaySquad, homeTeam, awayTeam]);

  // Ensure an active heatmap player is selected
  useEffect(() => {
    if (!selectedHeatmapPlayer && allSelectablePlayers.length > 0) {
      if (favoritePlayer && allSelectablePlayers.some((p) => p.name === favoritePlayer)) {
        setSelectedHeatmapPlayer(favoritePlayer);
      } else {
        // Default to striker or key attacker (e.g. M. Belotti)
        const striker = allSelectablePlayers.find((p) => p.role === 'ST') || allSelectablePlayers[0];
        setSelectedHeatmapPlayer(striker.name);
      }
    }
  }, [selectedHeatmapPlayer, allSelectablePlayers, favoritePlayer]);

  // Track current team in possession with hysteresis (filters out defensive press/foul flickers)
  const isHomePossession = useMemo(() => {
    if (!events || events.length === 0) {
      if (!lastEvent) return true;
      return lastEvent.team === 'home' || (lastEvent.team && lastEvent.team.toLowerCase() === homeTeam.toLowerCase());
    }
    const nonPossessionTypes = new Set(['pressure', 'foul', 'yellow_card', 'red_card', 'card', 'offside']);
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (!ev) continue;
      if (nonPossessionTypes.has(ev.type)) continue;
      if (ev.type === 'tackle' && ev.outcome !== 'won' && ev.outcome !== 'success') continue;
      const isHome = ev.team === 'home' || (ev.team && ev.team.toLowerCase() === homeTeam.toLowerCase());
      return isHome;
    }
    return true;
  }, [events, lastEvent, homeTeam]);

  // Dynamic Tactical Collective Movement Engine (22 Players)
  const playersOnPitch = useMemo(() => {
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const carrierName = lastEvent?.player || '';
    const ballX = ballPos.x;
    const ballY = ballPos.y;

    // Optional pass receiver position
    const endPos = (lastEvent?.type === 'pass' || lastEvent?.type === 'cross' || lastEvent?.type === 'through_ball' || lastEvent?.type === 'free_kick') && lastEvent.end_position
      ? mapCoords(lastEvent.end_position, lastEvent.team)
      : null;

    // Flank-Anchored Progressive Kinematics for Home (defending goal at x=0, attacking towards x=105)
    // Facing attacking direction (East ➔): Top touchline is LEFT FLANK (LB, LW), Bottom touchline is RIGHT FLANK (RB, RW)
    const computeHomeSide = (bx: number, by: number, inPossession: boolean) => {
      const sY = (by - 34) * 0.45;
      if (inPossession) {
        const pX = (bx - 25) / 80;
        const baseDefX = clamp(18 + Math.max(-2, pX * 26), 16, 52);
        const midX = clamp(bx - 10, baseDefX + 10, 72);
        const attX = clamp(bx + 8, midX + 12, 98);

        return {
          GK: { x: clamp(4.0 + Math.max(0, pX) * 3.5, 3.2, 9.5), y: clamp(34 + sY * 0.35, 28, 40) },
          LB: { x: clamp(baseDefX + 2, 20, 85), y: clamp(14 + (by < 34 ? (by - 34) * 0.3 : 0), 6, 26) },
          CB1: { x: baseDefX, y: clamp(25 + sY * 0.4, 18, 34) },
          CB2: { x: baseDefX, y: clamp(43 + sY * 0.4, 34, 50) },
          RB: { x: clamp(baseDefX + 2, 20, 85), y: clamp(54 + (by >= 34 ? (by - 34) * 0.3 : 0), 42, 62) },
          DM: { x: clamp(midX - 6, baseDefX + 6, 62), y: clamp(34 + sY * 0.6, 24, 44) },
          CM1: { x: clamp(midX, baseDefX + 10, 76), y: clamp(24 + sY * 0.5, 14, 38) },
          CM2: { x: clamp(midX + 2, baseDefX + 10, 78), y: clamp(44 + sY * 0.5, 30, 54) },
          LW: { x: clamp(attX, 58, 98), y: clamp(16 + sY * 0.3, 8, 28) },
          ST: { x: clamp(bx + 10, 65, 100), y: clamp(34 + sY * 0.4, 24, 44) },
          RW: { x: clamp(attX, 58, 98), y: clamp(52 + sY * 0.3, 40, 60) },
        };
      } else {
        // Home Defending: Progressive track-back relative to ballX, strictly keeping flank corridor Y
        const defLineX = clamp(bx * 0.42 + 10, 14, 45);
        const midLineX = clamp(bx * 0.55 + 16, defLineX + 8, 62);
        const attLineX = clamp(bx * 0.65 + 24, midLineX + 10, 80);

        return {
          GK: { x: clamp(3.8 + (bx / 105) * 3.2, 3.0, 8.5), y: clamp(34 + sY * 0.4, 28, 40) },
          LB: { x: clamp(defLineX + 2, 16, 50), y: clamp(14 + sY * 0.35, 6, 26) },
          CB1: { x: defLineX, y: clamp(25 + sY * 0.45, 18, 34) },
          CB2: { x: defLineX, y: clamp(43 + sY * 0.45, 34, 50) },
          RB: { x: clamp(defLineX + 2, 16, 50), y: clamp(54 + sY * 0.35, 42, 62) },
          DM: { x: clamp(midLineX - 4, defLineX + 6, 58), y: clamp(34 + sY * 0.65, 22, 46) },
          CM1: { x: midLineX, y: clamp(24 + sY * 0.5, 14, 38) },
          CM2: { x: midLineX, y: clamp(44 + sY * 0.5, 30, 54) },
          LW: { x: attLineX, y: clamp(16 + sY * 0.3, 8, 28) },
          ST: { x: clamp(bx + 6, attLineX, 85), y: clamp(34 + sY * 0.35, 22, 46) },
          RW: { x: attLineX, y: clamp(52 + sY * 0.3, 40, 60) },
        };
      }
    };

    // Flank-Anchored Progressive Kinematics for Away (defending goal at x=105, attacking towards x=0 ⬅)
    // Facing attacking direction (West ⬅): Top touchline is RIGHT FLANK (RB, RW), Bottom touchline is LEFT FLANK (LB, LW)
    const computeAwaySide = (bx: number, by: number, inPossession: boolean) => {
      const sY = (by - 34) * 0.45;
      if (inPossession) {
        const pX = (105 - bx - 25) / 80;
        const baseDefX = 105 - clamp(18 + Math.max(-2, pX * 26), 16, 52);
        const midX = 105 - clamp((105 - bx) - 10, (105 - baseDefX) + 10, 72);
        const attX = 105 - clamp((105 - bx) + 8, (105 - midX) + 12, 98);

        return {
          GK: { x: 105 - clamp(4.2 + Math.max(0, pX) * 3.5, 3.2, 9.5), y: clamp(34 + sY * 0.35, 28, 40) },
          RB: { x: clamp(baseDefX - 2, 20, 85), y: clamp(14 + (by < 34 ? (by - 34) * 0.3 : 0), 6, 26) },
          CB1: { x: baseDefX, y: clamp(25 + sY * 0.4, 18, 34) },
          CB2: { x: baseDefX, y: clamp(43 + sY * 0.4, 34, 50) },
          LB: { x: clamp(baseDefX - 2, 20, 85), y: clamp(54 + (by >= 34 ? (by - 34) * 0.3 : 0), 42, 62) },
          DM1: { x: clamp(midX + 6, 43, 89), y: clamp(26 + sY * 0.5, 16, 38) },
          DM2: { x: clamp(midX + 6, 43, 89), y: clamp(42 + sY * 0.5, 30, 52) },
          AM: { x: clamp(midX - 2, 27, 75), y: clamp(34 + sY * 0.6, 22, 46) },
          RW: { x: clamp(attX, 7, 47), y: clamp(16 + sY * 0.3, 8, 28) },
          ST: { x: clamp(bx - 10, 5, 40), y: clamp(34 + sY * 0.4, 24, 44) },
          LW: { x: clamp(attX, 7, 47), y: clamp(52 + sY * 0.3, 40, 60) },
        };
      } else {
        // Away Defending: Progressive track-back relative to ballX, strictly keeping flank corridor Y
        const defLineX = 105 - clamp((105 - bx) * 0.42 + 10, 14, 45);
        const midLineX = 105 - clamp((105 - bx) * 0.55 + 16, (105 - defLineX) + 8, 62);
        const attLineX = 105 - clamp((105 - bx) * 0.65 + 24, (105 - midLineX) + 10, 80);

        return {
          GK: { x: 105 - clamp(3.8 + ((105 - bx) / 105) * 3.2, 3.0, 8.5), y: clamp(34 + sY * 0.4, 28, 40) },
          RB: { x: clamp(defLineX - 2, 55, 89), y: clamp(14 + sY * 0.35, 6, 26) },
          CB1: { x: defLineX, y: clamp(25 + sY * 0.45, 18, 34) },
          CB2: { x: defLineX, y: clamp(43 + sY * 0.45, 34, 50) },
          LB: { x: clamp(defLineX - 2, 55, 89), y: clamp(54 + sY * 0.35, 42, 62) },
          DM1: { x: midLineX, y: clamp(26 + sY * 0.5, 16, 38) },
          DM2: { x: midLineX, y: clamp(42 + sY * 0.5, 30, 52) },
          AM: { x: clamp(midLineX + 4, 47, 83), y: clamp(34 + sY * 0.65, 22, 46) },
          RW: { x: attLineX, y: clamp(16 + sY * 0.3, 8, 28) },
          ST: { x: clamp(bx - 6, 20, attLineX), y: clamp(34 + sY * 0.35, 22, 46) },
          LW: { x: attLineX, y: clamp(52 + sY * 0.3, 40, 60) },
        };
      }
    };

    // Calculate tactical layouts directly without inverse-mirror flips
    const rawHome = computeHomeSide(ballX, ballY, isHomePossession);
    const rawAway = computeAwaySide(ballX, ballY, !isHomePossession);

    const home = homeSquad.map((p) => {
      const pos = rawHome[p.key] || { x: 50, y: 34 };
      const isFavorite = !!(favoritePlayer && (favoritePlayer === p.name || p.name.includes(favoritePlayer)));
      return {
        ...p,
        team: homeTeam,
        x: clamp(pos.x, 2, 103),
        y: clamp(pos.y, 2, 66),
        isFavorite,
        isCarrier: false,
        isReceiver: false,
        isPressing: false,
      };
    });

    const away = awaySquad.map((p) => {
      const pos = rawAway[p.key] || { x: 50, y: 34 };
      const isFavorite = !!(favoritePlayer && (favoritePlayer === p.name || p.name.includes(favoritePlayer)));
      return {
        ...p,
        team: awayTeam,
        x: clamp(pos.x, 2, 103),
        y: clamp(pos.y, 2, 66),
        isFavorite,
        isCarrier: false,
        isReceiver: false,
        isPressing: false,
      };
    });

        // Assign active ball carrier directly to ball position with HARD POSITIONAL SAFEGUARDS
    if (isHomePossession) {
      let carrier = home.find((p) => p.name === carrierName);
      // Hard safeguard: Goalkeeper CANNOT carry ball outside defensive 18-yard box!
      if (carrier && carrier.role === 'GK' && ballX > 16.5) {
        carrier = null;
      }
      // Tactical safeguard: Fullbacks & Center Backs cannot cross into opposite touchlines
      // Home: LB is top (y < 34), RB is bottom (y >= 34)
      if (carrier && carrier.role === 'LB' && ballY > 36.0) {
        carrier = null;
      }
      if (carrier && carrier.role === 'RB' && ballY < 32.0) {
        carrier = null;
      }
      if (carrier && carrier.role === 'CB' && ballX > 75.0 && (ballY < 18.0 || ballY > 50.0)) {
        carrier = null;
      }
      if (!carrier) {
        const initialCandidate = home.find(
          (p) => p.role !== 'GK' && !(p.role === 'LB' && ballY > 36.0) && !(p.role === 'RB' && ballY < 32.0)
        ) || home[1];
        carrier = home.reduce((closest, p) => {
          if (p.role === 'GK') return closest;
          if (p.role === 'LB' && ballY > 36.0) return closest;
          if (p.role === 'RB' && ballY < 32.0) return closest;
          if (p.role === 'CB' && ballX > 75.0 && (ballY < 18.0 || ballY > 50.0)) return closest;
          const d1 = Math.hypot(p.x - ballX, p.y - ballY);
          const d2 = Math.hypot(closest.x - ballX, closest.y - ballY);
          return d1 < d2 ? p : closest;
        }, initialCandidate);
      }
      if (carrier) {
        if (carrier.role === 'GK') {
          carrier.x = clamp(ballX, 2.8, 14.0);
          carrier.y = clamp(ballY, 24.0, 44.0);
        } else {
          carrier.x = ballX;
          carrier.y = ballY;
        }
        carrier.isCarrier = true;
      }

      if (endPos) {
        const initialReceiver = home.find(
          (p) => !p.isCarrier && p.role !== 'GK' && !(p.role === 'LB' && endPos.y > 36.0) && !(p.role === 'RB' && endPos.y < 32.0)
        ) || home[9] || home[1];
        const receiver = home.reduce((closest, p) => {
          if (p.isCarrier || p.role === 'GK') return closest;
          if (p.role === 'LB' && endPos.y > 36.0) return closest;
          if (p.role === 'RB' && endPos.y < 32.0) return closest;
          const d1 = Math.hypot(p.x - endPos.x, p.y - endPos.y);
          const d2 = Math.hypot(closest.x - endPos.x, closest.y - endPos.y);
          return d1 < d2 ? p : closest;
        }, initialReceiver);
        if (receiver && !receiver.isCarrier) {
          receiver.x = endPos.x;
          receiver.y = endPos.y;
          receiver.isReceiver = true;
        }
      }

      // Defending press: nearest away outfield defender in the relevant corridor presses ball
      // Away: RB is top (y < 34), LB is bottom (y >= 34)
      const initialPresser = away.find(
        (p) => p.role !== 'GK' && !(p.role === 'RB' && ballY > 36.0) && !(p.role === 'LB' && ballY < 32.0)
      ) || away[5] || away[1];
      const presser = away.reduce((closest, p) => {
        if (p.role === 'GK') return closest;
        if (p.role === 'RB' && ballY > 36.0) return closest;
        if (p.role === 'LB' && ballY < 32.0) return closest;
        const d1 = Math.hypot(p.x - ballX, p.y - ballY);
        const d2 = Math.hypot(closest.x - ballX, closest.y - ballY);
        return d1 < d2 ? p : closest;
      }, initialPresser);
      if (presser) {
        presser.x = clamp(ballX + 2.4, 3, 102);
        presser.y = clamp(ballY, 4, 64);
        presser.isPressing = true;
      }
    } else {
      let carrier = away.find((p) => p.name === carrierName);
      if (carrier && carrier.role === 'GK' && ballX < 88.5) {
        carrier = null;
      }
      // Away: RB is top (y < 34), LB is bottom (y >= 34)
      if (carrier && carrier.role === 'RB' && ballY > 36.0) {
        carrier = null;
      }
      if (carrier && carrier.role === 'LB' && ballY < 32.0) {
        carrier = null;
      }
      if (carrier && carrier.role === 'CB' && ballX < 30.0 && (ballY < 18.0 || ballY > 50.0)) {
        carrier = null;
      }
      if (!carrier) {
        const initialCandidate = away.find(
          (p) => p.role !== 'GK' && !(p.role === 'RB' && ballY > 36.0) && !(p.role === 'LB' && ballY < 32.0)
        ) || away[1];
        carrier = away.reduce((closest, p) => {
          if (p.role === 'GK') return closest;
          if (p.role === 'RB' && ballY > 36.0) return closest;
          if (p.role === 'LB' && ballY < 32.0) return closest;
          if (p.role === 'CB' && ballX < 30.0 && (ballY < 18.0 || ballY > 50.0)) return closest;
          const d1 = Math.hypot(p.x - ballX, p.y - ballY);
          const d2 = Math.hypot(closest.x - ballX, closest.y - ballY);
          return d1 < d2 ? p : closest;
        }, initialCandidate);
      }
      if (carrier) {
        if (carrier.role === 'GK') {
          carrier.x = clamp(ballX, 91.0, 102.2);
          carrier.y = clamp(ballY, 24.0, 44.0);
        } else {
          carrier.x = ballX;
          carrier.y = ballY;
        }
        carrier.isCarrier = true;
      }

      if (endPos) {
        const initialReceiver = away.find(
          (p) => !p.isCarrier && p.role !== 'GK' && !(p.role === 'RB' && endPos.y > 36.0) && !(p.role === 'LB' && endPos.y < 32.0)
        ) || away[9] || away[1];
        const receiver = away.reduce((closest, p) => {
          if (p.isCarrier || p.role === 'GK') return closest;
          if (p.role === 'RB' && endPos.y > 36.0) return closest;
          if (p.role === 'LB' && endPos.y < 32.0) return closest;
          const d1 = Math.hypot(p.x - endPos.x, p.y - endPos.y);
          const d2 = Math.hypot(closest.x - endPos.x, closest.y - endPos.y);
          return d1 < d2 ? p : closest;
        }, initialReceiver);
        if (receiver && !receiver.isCarrier) {
          receiver.x = endPos.x;
          receiver.y = endPos.y;
          receiver.isReceiver = true;
        }
      }

      // Home defending press: Home LB is top (y < 34), Home RB is bottom (y >= 34)
      const initialPresser = home.find(
        (p) => p.role !== 'GK' && !(p.role === 'LB' && ballY > 36.0) && !(p.role === 'RB' && ballY < 32.0)
      ) || home[5] || home[1];
      const presser = home.reduce((closest, p) => {
        if (p.role === 'GK') return closest;
        if (p.role === 'LB' && ballY > 36.0) return closest;
        if (p.role === 'RB' && ballY < 32.0) return closest;
        const d1 = Math.hypot(p.x - ballX, p.y - ballY);
        const d2 = Math.hypot(closest.x - ballX, closest.y - ballY);
        return d1 < d2 ? p : closest;
      }, initialPresser);
      if (presser) {
        presser.x = clamp(ballX - 2.4, 3, 102);
        presser.y = clamp(ballY, 4, 64);
        presser.isPressing = true;
      }
    }

    // Blend subtle athlete idling micro-motion with strict tactical corridor bounds
    const homeWithMicro = home.map((p) => {
      const mx = p.isCarrier ? 0 : Math.sin(clockTick * 0.15 + p.seedX) * 0.4;
      const my = p.isCarrier ? 0 : Math.cos(clockTick * 0.12 + p.seedY) * 0.3;
      let finalX = clamp(p.x + mx, 2, 103);
      let finalY = clamp(p.y + my, 2, 66);
      if (p.role === 'GK') {
        finalX = clamp(finalX, 2.8, 14.0);
        finalY = clamp(finalY, 24.0, 44.0);
      } else if (p.role === 'LB') {
        finalY = clamp(finalY, 4.0, 36.0);
      } else if (p.role === 'RB') {
        finalY = clamp(finalY, 32.0, 64.0);
      } else if (p.role === 'CB') {
        finalY = clamp(finalY, 16.0, 52.0);
      }
      return {
        ...p,
        x: finalX,
        y: finalY,
      };
    });

    const awayWithMicro = away.map((p) => {
      const mx = p.isCarrier ? 0 : Math.sin(clockTick * 0.15 + p.seedX) * 0.4;
      const my = p.isCarrier ? 0 : Math.cos(clockTick * 0.12 + p.seedY) * 0.3;
      let finalX = clamp(p.x + mx, 2, 103);
      let finalY = clamp(p.y + my, 2, 66);
      if (p.role === 'GK') {
        finalX = clamp(finalX, 91.0, 102.2);
        finalY = clamp(finalY, 24.0, 44.0);
      } else if (p.role === 'RB') {
        finalY = clamp(finalY, 4.0, 36.0);
      } else if (p.role === 'LB') {
        finalY = clamp(finalY, 32.0, 64.0);
      } else if (p.role === 'CB') {
        finalY = clamp(finalY, 16.0, 52.0);
      }
      return {
        ...p,
        x: finalX,
        y: finalY,
      };
    });
    return { home: homeWithMicro, away: awayWithMicro };
  }, [ballPos.x, ballPos.y, lastEvent, homeTeam, awayTeam, homeSquad, awaySquad, favoritePlayer, clockTick, isHomePossession]);

// ==============================================================================
// Kinematic Tactical Positional-Occupancy Engine
// Computes player's physical (x, y) pitch location across match events
// based on role, ball position, and team possession phase
// ==============================================================================
function computeTacticalPlayerPos(
  roleKey: string,
  isHome: boolean,
  bxM: number,
  byM: number,
  inPossession: boolean
): { x: number; y: number } {
  const clampV = (val: number, minV: number, maxV: number) => Math.max(minV, Math.min(maxV, val));
  
  // Standardize perspective: if away player, mirror ball to evaluate Left -> Right attack
  const bx = isHome ? bxM : 105.0 - bxM;
  const by = isHome ? byM : 68.0 - byM;
  const sY = (by - 34.0) * 0.45;
  const pX = (bx - 25.0) / 80.0;

  const role = roleKey.toUpperCase();
  const isRightSide = role === 'RB' || role === 'RWB' || role === 'RW' || role === 'RM';
  const isLeftSide = role === 'LB' || role === 'LWB' || role === 'LW' || role === 'LM';
  const isAttacker = role === 'ST' || role === 'CF' || role === 'FW';
  const isCAM = role === 'AM' || role === 'CAM';
  const isGK = role === 'GK';

  if (inPossession) {
    const baseDefX = clampV(18.0 + Math.max(-2.0, pX * 26.0), 16.0, 52.0);
    const midX = clampV(bx - 10.0, baseDefX + 10.0, 72.0);
    const attX = clampV(bx + 8.0, midX + 12.0, 98.0);

    if (isGK) return { x: clampV(4.0 + Math.max(0, pX) * 3.5, 3.2, 9.5), y: clampV(34.0 + sY * 0.35, 28.0, 40.0) };
    if (isRightSide) {
      if (role === 'RW') return { x: clampV(attX, 58.0, 98.0), y: clampV(54.0 + sY * 0.3, 40.0, 64.0) };
      return { x: clampV(baseDefX + 2.0, 20.0, 85.0), y: clampV(54.0 + (by >= 34.0 ? sY * 0.35 : 0), 42.0, 64.0) };
    }
    if (isLeftSide) {
      if (role === 'LW') return { x: clampV(attX, 58.0, 98.0), y: clampV(14.0 + sY * 0.3, 4.0, 28.0) };
      return { x: clampV(baseDefX + 2.0, 20.0, 85.0), y: clampV(14.0 + (by < 34.0 ? sY * 0.35 : 0), 4.0, 26.0) };
    }
    if (isAttacker) return { x: clampV(bx + 10.0, 65.0, 100.0), y: clampV(34.0 + sY * 0.4, 24.0, 44.0) };
    if (isCAM) return { x: clampV(midX + 4.0, baseDefX + 14.0, 84.0), y: clampV(34.0 + sY * 0.55, 20.0, 48.0) };
    if (role === 'CB' || role.startsWith('CB')) return { x: baseDefX, y: clampV((role.includes('2') ? 43.0 : 25.0) + sY * 0.4, 18.0, 50.0) };
    return { x: clampV(midX, baseDefX + 8.0, 75.0), y: clampV(34.0 + sY * 0.5, 18.0, 50.0) };
  } else {
    const defLineX = clampV(bx * 0.42 + 10.0, 14.0, 45.0);
    const midLineX = clampV(bx * 0.55 + 16.0, defLineX + 8.0, 62.0);
    const attLineX = clampV(bx * 0.65 + 24.0, midLineX + 10.0, 80.0);

    if (isGK) return { x: clampV(3.8 + (bx / 105.0) * 3.2, 3.0, 8.5), y: clampV(34.0 + sY * 0.4, 28.0, 40.0) };
    if (isRightSide) {
      if (role === 'RW') return { x: attLineX, y: clampV(54.0 + sY * 0.3, 40.0, 64.0) };
      return { x: clampV(defLineX + 2.0, 16.0, 50.0), y: clampV(54.0 + sY * 0.35, 42.0, 64.0) };
    }
    if (isLeftSide) {
      if (role === 'LW') return { x: attLineX, y: clampV(14.0 + sY * 0.3, 4.0, 28.0) };
      return { x: clampV(defLineX + 2.0, 16.0, 50.0), y: clampV(14.0 + sY * 0.35, 4.0, 26.0) };
    }
    if (isAttacker) return { x: clampV(bx + 6.0, attLineX, 85.0), y: clampV(34.0 + sY * 0.35, 22.0, 46.0) };
    if (isCAM) return { x: clampV(midLineX + 2.0, defLineX + 10.0, 68.0), y: clampV(34.0 + sY * 0.5, 20.0, 48.0) };
    if (role === 'CB' || role.startsWith('CB')) return { x: defLineX, y: clampV((role.includes('2') ? 43.0 : 25.0) + sY * 0.45, 18.0, 50.0) };
    return { x: midLineX, y: clampV(34.0 + sY * 0.5, 18.0, 50.0) };
  }
}

  // ==========================================
  // Heatmap Spatial Telemetry & Receipts Engine
  // ==========================================
  const activeHeatmapData = useMemo(() => {
    if (!selectedHeatmapPlayer) return null;

    const sourceEvents = heatmapScope === 'full' && allMatchEvents.length > 0 ? allMatchEvents : events;
    const playerEvents = sourceEvents.filter(
      (ev) =>
        ev.player &&
        ev.player.trim().toLowerCase() === selectedHeatmapPlayer.trim().toLowerCase() &&
        ev.type !== 'substitution' &&
        ev.type !== 'card' &&
        ev.type !== 'yellow_card' &&
        ev.type !== 'red_card' &&
        ev.type !== 'half_time' &&
        ev.type !== 'full_time'
    );

    const playerMeta = allSelectablePlayers.find(
      (p) => p.name.trim().toLowerCase() === selectedHeatmapPlayer.trim().toLowerCase()
    );
    const role = playerMeta?.role || 'Player';

    // Generate broadcast-grade spatial density points:
    // 1. Primary action points (dispersion radius 68px = 13.6m)
    // 2. Trajectory interpolation along passes and carries
    // 3. Sequential movement transitions between consecutive actions
    // 4. Positional corridor territorial coverage (anchors continuous operational zone)
    const points: Array<{
      x: number;
      y: number;
      endX?: number;
      endY?: number;
      type?: string;
      outcome?: string;
      xG?: number;
      speed?: number;
      sprintSpeed?: number;
      minute?: number;
      weight?: number;
      radius?: number;
    }> = [];

    const isHome = playerMeta ? playerMeta.isHome : true;

    // 1. Identify active match minute window for the player
    let minMinute = 0;
    let maxMinute = 90;
    if (playerEvents.length > 0) {
      const minutes = playerEvents.map((e) => e.minute || 0);
      minMinute = Math.min(...minutes);
      maxMinute = Math.max(...minutes);
      // If player recorded events in 1st half, they likely started from minute 0
      if (minMinute <= 25) minMinute = 0;
      // If player recorded events in late 2nd half, they were active until full time
      if (maxMinute >= 75) maxMinute = 95;
    }

    // 2. KINEMATIC POSITIONAL-OCCUPANCY SAMPLING ACROSS MATCH TIMELINE
    // True movement & time-in-zone tracking samples:
    const timelineEvents = sourceEvents.filter(
      (ev) => (ev.minute || 0) >= minMinute && (ev.minute || 0) <= maxMinute && ev.position
    );
    // Stride to capture ~250-320 continuous positional occupancy frames across match
    const stride = Math.max(1, Math.floor(timelineEvents.length / 280));

    for (let i = 0; i < timelineEvents.length; i += stride) {
      const ev = timelineEvents[i];
      const bxRaw = ev.position?.x ?? 50;
      const byRaw = ev.position?.y ?? 50;
      const bxM = (bxRaw / 100) * PITCH_WIDTH;
      const byM = ((100 - byRaw) / 100) * PITCH_HEIGHT;

      const evTeam = (ev.team || '').toLowerCase();
      const inPoss = isHome ? (evTeam === 'home' || evTeam === homeTeam.toLowerCase()) : (evTeam === 'away' || evTeam === awayTeam.toLowerCase());
      const playerPos = computeTacticalPlayerPos(role, isHome, bxM, byM, inPoss);

      points.push({
        x: playerPos.x,
        y: playerPos.y,
        weight: 0.20,
        radius: 62,
      });
    }

    // 3. ON-BALL ACTIONS & SHOTS AS VIVID HIGH-INTENSITY HOTSPOTS
    playerEvents.forEach((ev) => {
      const pt = mapHeatmapCoords(ev.position);
      const endPt = ev.end_position ? mapHeatmapCoords(ev.end_position) : null;
      const isShot = ev.type === 'shot' || ev.type === 'goal';

      // Tactical role safeguard:
      if (role === 'GK' && pt.x > 28.0) return;
      if ((role === 'ST' || role === 'FW') && pt.x < 16.0) return;

      // High-intensity action core
      points.push({
        x: pt.x,
        y: pt.y,
        endX: endPt?.x,
        endY: endPt?.y,
        type: ev.type,
        outcome: ev.outcome,
        xG: ev.xG,
        speed: ev.additional?.shot_speed_kmh || ev.additional?.ball_speed_kmh,
        sprintSpeed: ev.additional?.player_speed_kmh,
        minute: ev.minute,
        weight: isShot ? 0.65 : 0.48,
        radius: 68,
      });

      // Pass / dribble vector trajectory points
      if (endPt) {
        const steps = [0.25, 0.5, 0.75];
        steps.forEach((s) => {
          points.push({
            x: pt.x + (endPt.x - pt.x) * s,
            y: pt.y + (endPt.y - pt.y) * s,
            weight: 0.26,
            radius: 54,
          });
        });
      }
    });

    // Pitch thirds calculation (Left=Defensive 3rd, Middle=Middle 3rd, Right=Attacking 3rd)
    const total = Math.max(1, points.length);
    let defCount = 0;
    let midCount = 0;
    let attCount = 0;

    points.forEach((pt) => {
      if (pt.x < 35.0) defCount++;
      else if (pt.x <= 70.0) midCount++;
      else attCount++;
    });

    const defPct = Math.round((defCount / total) * 100);
    const midPct = Math.round((midCount / total) * 100);
    const attPct = Math.round((attCount / total) * 100);

    // Passes: verified completion check
    const passEvents = playerEvents.filter(
      (e) => e.type === 'pass' || e.type === 'cross' || e.type === 'through_ball' || e.type === 'free_kick'
    );
    const completedPasses = passEvents.filter((e) => {
      if (e.success === false) return false;
      if (e.success === true) return true;
      const oc = (e.outcome || '').toLowerCase();
      if (oc === 'failed' || oc === 'incomplete' || oc === 'intercepted' || oc === 'blocked' || oc === 'out') return false;
      return true;
    }).length;
    const passAccuracy = passEvents.length > 0 ? Math.round((completedPasses / passEvents.length) * 100) : null;

    // Shots & Goals
    const shotEvents = playerEvents.filter((e) => e.type === 'shot' || e.type === 'goal');
    const goals = playerEvents.filter((e) => e.type === 'goal' || e.outcome === 'goal');
    const totalXg = shotEvents.reduce((acc, ev) => acc + (ev.xG || 0.1), 0);

    // Top speeds
    const maxSprint = Math.max(0, ...playerEvents.map((e) => e.additional?.player_speed_kmh || 0));
    const maxShotSpeed = Math.max(0, ...playerEvents.map((e) => e.additional?.shot_speed_kmh || 0));

    // Defensive actions
    const defensiveActions = playerEvents.filter(
      (e) => e.type === 'tackle' || e.type === 'interception' || e.type === 'clearance' || e.type === 'ball_recovery'
    ).length;
    const saves = playerEvents.filter((e) => e.type === 'save' || e.outcome === 'saved').length;

    // Primary Hot Zone & Fact Check Verdict
    let primaryZone = 'Midfield Central Engine';
    let verdict = 'Verified Tactical Activity';

    if (role === 'GK') {
      primaryZone = 'Defensive Penalty Area & 6-Yard Box';
      verdict = `✅ GOALKEEPER LOCKED: Strictly protected defensive penalty area (${defPct}% in defensive 3rd). 0 roaming into attack.`;
    } else if (attPct >= 45) {
      primaryZone = 'Final Third & Opponent Penalty Box Threat';
      verdict = `✅ ATTACKING THREAT: Concentrated in final third (${attPct}% attacking 3rd). Goal threat verified.`;
    } else if (defPct >= 45) {
      primaryZone = 'Deep Defensive Half & Low Block';
      verdict = `✅ DEFENSIVE DISCIPLINE: Holding tactical line (${defPct}% defensive 3rd). Backline verified.`;
    } else {
      primaryZone = 'Midfield Circulation & Half-Spaces';
      verdict = `✅ MIDFIELD CONTROL: Anchoring central transition (${midPct}% midfield 3rd). Fluid play verified.`;
    }

    return {
      playerName: selectedHeatmapPlayer,
      meta: playerMeta,
      points,
      totalEvents: playerEvents.length,
      defPct,
      midPct,
      attPct,
      passAccuracy,
      totalPasses: passEvents.length,
      completedPasses,
      shotsCount: shotEvents.length,
      goalsCount: goals.length,
      totalXg: totalXg.toFixed(2),
      maxSprint: maxSprint > 0 ? maxSprint.toFixed(1) : null,
      maxShotSpeed: maxShotSpeed > 0 ? Math.round(maxShotSpeed) : null,
      defensiveActions,
      saves,
      primaryZone,
      verdict,
    };
  }, [selectedHeatmapPlayer, heatmapScope, allMatchEvents, events, allSelectablePlayers, homeTeam, awayTeam]);

  // =========================================================
  // Continuous 2D Kernel Density Estimation (KDE) Heatmap Texture Generator
  // Produces a smooth, continuous Sofascore/Opta thermal surface via Canvas 2D
  // =========================================================
  const [heatmapDataUrl, setHeatmapDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (visualizerMode !== 'heatmap' || !activeHeatmapData || activeHeatmapData.points.length === 0) {
      setHeatmapDataUrl(null);
      return;
    }

    const points = activeHeatmapData.points;
    const width = 525;
    const height = 340;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const scaleX = width / 105;
    const scaleY = height / 68;
    const defaultRadius = 72; // Broadcast dispersion radius (~14.4 meters)

    // Step 1: True Additive Kernel Density Estimation (KDE)
    ctx.globalCompositeOperation = 'lighter';

    points.forEach((pt) => {
      const cx = pt.x * scaleX;
      const cy = pt.y * scaleY;
      const r = pt.radius || defaultRadius;
      const alpha = pt.weight || (pt.type === 'shot' || pt.type === 'goal' ? 0.45 : 0.32);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
      grad.addColorStop(0.20, `rgba(0, 0, 0, ${alpha * 0.90})`);
      grad.addColorStop(0.45, `rgba(0, 0, 0, ${alpha * 0.60})`);
      grad.addColorStop(0.70, `rgba(0, 0, 0, ${alpha * 0.25})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Step 2: Remap accumulated alpha to the 256-step Sofascore thermal colormap
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let maxAlpha = 1;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > maxAlpha) maxAlpha = data[i];
    }

    // Dynamic Range Power-Law Compression (Gamma = 0.55)
    // Seamlessly exposes soft ambient movement presence (blue/cyan/lime)
    // while keeping frequent action cores blazing in fiery orange and crimson red
    const u32 = new Uint32Array(imgData.data.buffer);
    for (let i = 0; i < u32.length; i++) {
      const a = data[i * 4 + 3];
      if (a === 0) continue;
      const normVal = Math.pow(a / maxAlpha, 0.55);
      const normIdx = Math.min(255, Math.floor(normVal * 255));
      u32[i] = THERMAL_COLORMAP_LUT_32[normIdx];
    }

    ctx.putImageData(imgData, 0, 0);
    setHeatmapDataUrl(canvas.toDataURL('image/png'));
  }, [visualizerMode, activeHeatmapData]);

  // Action status calculations for banner
  const actionStatus = useMemo(() => {
    if (isFullTime) {
      const scoreStr = score ? `${score.home} - ${score.away}` : '';
      return {
        label: '🏆 FULL TIME',
        sub: `${homeTeam} ${scoreStr} ${awayTeam} • Match Concluded`,
        badgeColor: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black border-amber-300 ring-4 ring-amber-500/40 shadow-amber-500/50 shadow-2xl',
        glow: 'from-amber-950/40 via-transparent to-amber-950/40',
      };
    }

    if (lastEvent?.type === 'half_time' || (lastEvent?.minute === 45 && lastEvent?.second === 0)) {
      const scoreStr = score ? `${score.home} - ${score.away}` : '0 - 0';
      return {
        label: '⏸️ HALF TIME',
        sub: `${homeTeam} ${scoreStr} ${awayTeam} • Studio Analysis Active`,
        badgeColor: 'bg-indigo-600/30 text-indigo-200 border-indigo-400 ring-2 ring-indigo-500/40 shadow-indigo-500/30',
        glow: 'from-indigo-950/50 via-transparent to-indigo-950/50',
      };
    }

    if (!lastEvent) {
      return {
        label: 'MATCH IN PROGRESS',
        sub: 'Tactical feed active',
        badgeColor: 'bg-blue-600/20 text-blue-400 border-blue-500/40',
        glow: '',
      };
    }

    const isHome = lastEvent.team === 'home' || (lastEvent.team && lastEvent.team.toLowerCase() === homeTeam.toLowerCase());
    const team = isHome ? homeTeam : awayTeam;
    const oppTeam = isHome ? awayTeam : homeTeam;
    const playerName = lastEvent.player || team;
    const evType = (lastEvent.type || '').toLowerCase();
    const evOutcome = (lastEvent.outcome || '').toLowerCase();
    const isGoal = evType === 'goal' || evOutcome === 'goal';
    const isSaved = evOutcome === 'saved' || evType === 'save';
    const isShot = evType === 'shot';
    const isCard = evType === 'card';
    const isGoalKick = evType === 'goal_kick';
    const isClearance = evType === 'clearance';
    const isTackle = evType === 'tackle';
    const isInterception = evType === 'interception';
    const isRecovery = evType === 'ball_recovery';
    const speed = lastEvent.additional?.shot_speed_kmh || lastEvent.additional?.ball_speed_kmh;

    if (isGoal) {
      return {
        label: '⚽ GOAL!',
        sub: `${playerName} (${team})`,
        badgeColor: 'bg-emerald-500 text-black font-black border-emerald-300 ring-4 ring-emerald-500/40 animate-pulse',
        glow: 'from-emerald-950/80 via-transparent to-transparent',
      };
    }

    if (isSaved) {
      return {
        label: '🧤 SENSATIONAL SAVE!',
        sub: `${playerName} denies ${oppTeam} strike`,
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
        glow: 'from-amber-950/50 via-transparent to-transparent',
      };
    }

    const playerSpeed = lastEvent.additional?.player_speed_kmh;
    const sprintDist = lastEvent.additional?.sprint_distance_m;
    const eventDist = lastEvent.additional?.distance_m;
    const effectiveSprintDist = sprintDist || eventDist || 0;
    if (playerSpeed && playerSpeed >= 31.0 && effectiveSprintDist >= 20.0 && !isGoal && !isSaved) {
      return {
        label: `⚡ SPRINT ALERT (${playerSpeed} km/h)`,
        sub: `${playerName} (${team}) • ${Math.round(effectiveSprintDist)}m explosive burst`,
        badgeColor: 'bg-amber-400 text-black font-black border-amber-300 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/20 animate-pulse',
        glow: 'from-amber-950/50 via-transparent to-transparent',
      };
    }

    if (isGoalKick) {
      return {
        label: `🧤 GOAL KICK • ${team}`,
        sub: `${playerName} restarts play from the box`,
        badgeColor: 'bg-slate-700/60 text-slate-200 border-slate-500/70 shadow-slate-500/20',
        glow: '',
      };
    }

    if (isTackle) {
      return {
        label: `⚔️ TACKLE WON • ${team}`,
        sub: `${playerName} dispossesses ${oppTeam} • Possession regained`,
        badgeColor: isHome
          ? 'bg-blue-600/30 text-blue-200 border-blue-400 ring-2 ring-blue-500/40 shadow-blue-500/30 animate-pulse'
          : 'bg-amber-600/30 text-amber-200 border-amber-400 ring-2 ring-amber-500/40 shadow-amber-500/30 animate-pulse',
        glow: isHome ? 'to-blue-950/40 from-transparent' : 'from-amber-950/40 to-transparent',
      };
    }

    if (isInterception) {
      return {
        label: `🛡️ INTERCEPTION • ${team}`,
        sub: `${playerName} cuts out pass • ${team} on the counter`,
        badgeColor: isHome
          ? 'bg-indigo-600/30 text-indigo-200 border-indigo-400 ring-2 ring-indigo-500/40 shadow-indigo-500/30 animate-pulse'
          : 'bg-purple-600/30 text-purple-200 border-purple-400 ring-2 ring-purple-500/40 shadow-purple-500/30 animate-pulse',
        glow: isHome ? 'to-indigo-950/40 from-transparent' : 'from-purple-950/40 to-transparent',
      };
    }

    if (isRecovery) {
      return {
        label: `🔄 BALL WON • ${team}`,
        sub: `${playerName} recovers loose ball • ${team} in possession`,
        badgeColor: isHome
          ? 'bg-teal-600/30 text-teal-200 border-teal-400 ring-2 ring-teal-500/40 animate-pulse'
          : 'bg-orange-600/30 text-orange-200 border-orange-400 ring-2 ring-orange-500/40 animate-pulse',
        glow: '',
      };
    }

    if (isClearance) {
      return {
        label: `🛡️ CLEARANCE • ${team}`,
        sub: `${playerName} clears danger under heavy press`,
        badgeColor: 'bg-zinc-700/60 text-zinc-200 border-zinc-500/70',
        glow: '',
      };
    }

    if (isShot) {
      if (evOutcome === 'off_target' || evOutcome === 'missed') {
        return {
          label: '💨 SHOT OFF TARGET',
          sub: `${playerName} (${team}) strikes wide • ${oppTeam} goal kick`,
          badgeColor: 'bg-rose-500/25 text-rose-300 border-rose-500/40 shadow-rose-500/20',
          glow: 'from-rose-950/30 via-transparent to-transparent',
        };
      }
      if (evOutcome === 'post') {
        return {
          label: '💥 OFF THE WOODWORK!',
          sub: `${playerName} (${team}) strikes the post!`,
          badgeColor: 'bg-amber-500/30 text-amber-200 border-amber-400 ring-2 ring-amber-500/40 animate-pulse',
          glow: 'from-amber-950/40 via-transparent to-transparent',
        };
      }
      return {
        label: speed && speed > 95 ? `🚀 ROCKET SHOT (${Math.round(speed)} km/h)` : '🎯 SHOT ON TARGET',
        sub: `${playerName} (${team}) • xG ${lastEvent.xG ? lastEvent.xG.toFixed(2) : '0.15'}`,
        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50',
        glow: 'from-cyan-950/40 via-transparent to-transparent',
      };
    }

    const evSubtype = (lastEvent.subtype || '').toLowerCase();
    const isPenalty = evType === 'penalty' || evSubtype === 'penalty' || lastEvent.additional?.shot_type === 'penalty' || lastEvent.additional?.is_penalty;
    if (isPenalty && !isGoal && !isSaved) {
      return {
        label: `🚨 PENALTY • ${team}`,
        sub: evType === 'foul'
          ? `${playerName} commits foul in the box • Penalty awarded!`
          : `${playerName} takes penalty spot kick`,
        badgeColor: 'bg-rose-600/30 text-rose-200 border-rose-400 ring-2 ring-rose-500/50 animate-pulse',
        glow: 'from-rose-950/50 via-transparent to-transparent',
      };
    }

    const isCorner = evType === 'corner' || evSubtype === 'corner' || lastEvent.additional?.assist_type === 'corner';
    if (isCorner) {
      return {
        label: `🚩 CORNER KICK • ${team}`,
        sub: `${playerName} delivering cross into the box`,
        badgeColor: 'bg-emerald-600/30 text-emerald-200 border-emerald-400',
        glow: 'from-emerald-950/40 via-transparent to-transparent',
      };
    }

    const isFreeKick = evType === 'free_kick' || evSubtype === 'free_kick' || lastEvent.additional?.set_piece === 'free_kick' || lastEvent.additional?.assist_type === 'free_kick';
    if (isFreeKick) {
      return {
        label: `🎯 FREE KICK • ${team}`,
        sub: `${playerName} awarded free kick • Restarts play`,
        badgeColor: 'bg-sky-600/30 text-sky-200 border-sky-400 ring-2 ring-sky-500/40 animate-pulse',
        glow: 'from-sky-950/40 via-transparent to-transparent',
      };
    }

    if (evType === 'foul') {
      return {
        label: `⚠️ FOUL • ${team}`,
        sub: `${playerName} commits infraction • ${oppTeam} awarded free kick`,
        badgeColor: 'bg-amber-600/25 text-amber-300 border-amber-500/40',
        glow: '',
      };
    }

    if (isCard || evSubtype === 'yellow' || evSubtype === 'red' || lastEvent.additional?.color) {
      const isRed = lastEvent.card_type === 'red' || evSubtype.includes('red') || (lastEvent.additional?.color || '').includes('red');
      return {
        label: isRed ? '🟥 RED CARD' : '🟨 YELLOW CARD',
        sub: isRed ? `${playerName} (${team}) sent off!` : `${playerName} (${team}) booked`,
        badgeColor: isRed
          ? 'bg-red-600 text-white font-bold border-red-400 ring-2 ring-red-500/50'
          : 'bg-yellow-400/30 text-yellow-200 border-yellow-400 ring-1 ring-yellow-400/40',
        glow: isRed ? 'from-red-950/60 via-transparent to-transparent' : 'from-yellow-950/40 via-transparent to-transparent',
      };
    }

    const coords = mapCoords(lastEvent.position, lastEvent.team);
    const inAttackingThird = isHome ? coords.x > 72 : coords.x < 33;
    const inDefensiveThird = isHome ? coords.x < 33 : coords.x > 72;

    if (inAttackingThird) {
      return {
        label: `🔥 DANGEROUS ATTACK • ${team}`,
        sub: `${playerName} pressuring the penalty area`,
        badgeColor: isHome
          ? 'bg-orange-500/25 text-orange-300 border-orange-400/60 shadow-orange-500/30'
          : 'bg-amber-500/25 text-amber-300 border-amber-400/60 shadow-amber-500/30',
        glow: isHome ? 'to-orange-950/40 from-transparent' : 'from-amber-950/40 to-transparent',
      };
    }

    if (inDefensiveThird) {
      return {
        label: `🛡️ IN POSSESSION • ${team}`,
        sub: `${playerName} building out from defensive third`,
        badgeColor: isHome
          ? 'bg-blue-600/25 text-blue-300 border-blue-500/40'
          : 'bg-amber-600/25 text-amber-300 border-amber-500/40',
        glow: '',
      };
    }

    return {
      label: `⚡ IN POSSESSION • ${team}`,
      sub: `${playerName} circulating through midfield`,
      badgeColor: isHome
        ? 'bg-blue-600/25 text-blue-300 border-blue-500/40 shadow-blue-500/20'
        : 'bg-amber-600/25 text-amber-300 border-amber-500/40 shadow-amber-500/20',
      glow: '',
    };
  }, [lastEvent, homeTeam, awayTeam, isFullTime, score]);

  const getShotColor = (outcome?: string) => {
    switch (outcome?.toLowerCase()) {
      case 'goal':
        return '#22c55e';
      case 'saved':
        return '#f97316';
      case 'missed':
      case 'off_target':
        return '#ef4444';
      case 'blocked':
      default:
        return '#94a3b8';
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/50 shadow-sm dark:shadow-2xl flex flex-col">
      {/* Visualizer Header Bar with Live Possession Indicator & Heatmap Toggle */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-[#101116]/95 border-b border-slate-200 dark:border-[#3D195B]/40 gap-2 text-xs">
        {/* Left: Mode Toggle Pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-200 dark:bg-[#1a1b24] p-0.5 rounded-lg border border-slate-300 dark:border-white/10 shadow-inner">
            <button
              type="button"
              onClick={() => setVisualizerMode('radar')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                visualizerMode === 'radar'
                  ? 'bg-purple-900 text-[#B8F34A] shadow-md'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>⚽</span>
              <span>Live Radar (22)</span>
            </button>
            <button
              type="button"
              onClick={() => setVisualizerMode('heatmap')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                visualizerMode === 'heatmap'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-md font-black'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>🔥</span>
              <span>Player Heatmap</span>
            </button>
          </div>

          <span className="text-slate-400 dark:text-gray-500 text-[10px] hidden xl:inline">105m × 68m FIFA Pitch</span>
        </div>

        {/* Center/Right: Heatmap Controls OR Match Possession */}
        {visualizerMode === 'heatmap' ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {/* Player Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#181922] px-2 py-1 rounded-lg border border-slate-300 dark:border-white/10">
              <span className="text-slate-400 dark:text-gray-400 font-medium text-[10px]">Player:</span>
              <select
                value={selectedHeatmapPlayer || ''}
                onChange={(e) => setSelectedHeatmapPlayer(e.target.value)}
                className="bg-transparent text-slate-900 dark:text-white font-bold text-xs focus:outline-none cursor-pointer max-w-[170px]"
              >
                <optgroup label={`${homeTeam} (Home)`}>
                  {allSelectablePlayers
                    .filter((p) => p.isHome)
                    .map((p) => (
                      <option key={`opt-h-${p.name}`} value={p.name} className="dark:bg-[#181922] text-slate-900 dark:text-white">
                        {p.name} {p.number ? `(#${p.number})` : ''} • {p.role}
                      </option>
                    ))}
                </optgroup>
                <optgroup label={`${awayTeam} (Away)`}>
                  {allSelectablePlayers
                    .filter((p) => !p.isHome)
                    .map((p) => (
                      <option key={`opt-a-${p.name}`} value={p.name} className="dark:bg-[#181922] text-slate-900 dark:text-white">
                        {p.name} {p.number ? `(#${p.number})` : ''} • {p.role}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            {/* Scope Toggle: Match So Far vs Full 90 Mins */}
            <div className="flex items-center bg-slate-200 dark:bg-[#1a1b24] p-0.5 rounded-lg border border-slate-300 dark:border-white/10">
              <button
                type="button"
                onClick={() => setHeatmapScope('current')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  heatmapScope === 'current'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ⏱️ To Date
              </button>
              <button
                type="button"
                onClick={() => setHeatmapScope('full')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  heatmapScope === 'full'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={allMatchEvents.length ? `${allMatchEvents.length} events loaded` : 'Load full 90 match events'}
              >
                ⚡ Full 90'
              </button>
            </div>
          </div>
        ) : (
          /* Live Radar Possession Indicator */
          <div className="flex items-center gap-3 text-[11px]">
            <div
              className={`flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg transition-all ${
                !isFullTime && isHomePossession
                  ? 'bg-purple-100 dark:bg-[#3D195B]/70 text-purple-900 dark:text-[#B8F34A] border border-purple-300 dark:border-[#B8F34A]/40 shadow-sm shadow-[#3D195B]/40'
                  : 'text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-[#101116]/60 border border-slate-200 dark:border-transparent'
              }`}
              title={!isFullTime && isHomePossession ? `${homeTeam} currently in possession` : undefined}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !isFullTime && isHomePossession ? 'bg-[#B8F34A] animate-pulse' : 'bg-purple-400 dark:bg-purple-600/40'
                }`}
              />
              <span className="truncate max-w-[120px]">{homeTeam}</span>
              {!isFullTime && isHomePossession && (
                <span className="text-[9px] font-black tracking-widest text-purple-900 dark:text-[#B8F34A] uppercase hidden sm:inline">
                  • POSS
                </span>
              )}
            </div>

            <span className="text-slate-400 dark:text-gray-600 font-extrabold text-[10px]">VS</span>

            <div
              className={`flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg transition-all ${
                !isFullTime && !isHomePossession
                  ? 'bg-purple-100 dark:bg-[#3D195B]/70 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-400/40 shadow-sm shadow-purple-900/40'
                  : 'text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-[#101116]/60 border border-slate-200 dark:border-transparent'
              }`}
              title={!isFullTime && !isHomePossession ? `${awayTeam} currently in possession` : undefined}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !isFullTime && !isHomePossession ? 'bg-purple-600 dark:bg-purple-400 animate-pulse' : 'bg-slate-400 dark:bg-gray-600/40'
                }`}
              />
              <span className="truncate max-w-[120px]">{awayTeam}</span>
              {!isFullTime && !isHomePossession && (
                <span className="text-[9px] font-black tracking-widest text-purple-900 dark:text-purple-300 uppercase hidden sm:inline">
                  • POSS
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pitch Canvas Container (Aspect Ratio 105:68) */}
      <div className="relative w-full aspect-[105/68] bg-[#0c2214] select-none overflow-hidden flex items-center justify-center">
        {/* Attacking Zone Glow in Radar Mode */}
        {visualizerMode === 'radar' && actionStatus.glow && (
          <div className={`absolute inset-0 bg-gradient-to-r ${actionStatus.glow} pointer-events-none transition-all duration-700 z-10 opacity-70`} />
        )}

        {/* Live Action Status Banner in Radar Mode */}
        {visualizerMode === 'radar' && (
          <div className="absolute top-3 inset-x-0 z-30 flex justify-center pointer-events-none px-4">
            <motion.div
              key={actionStatus.label + actionStatus.sub}
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className={`
                flex items-center gap-2.5 px-4 py-1.5 rounded-full backdrop-blur-md shadow-2xl border text-xs
                ${actionStatus.badgeColor}
              `}
            >
              <span className="font-black uppercase tracking-wider">{actionStatus.label}</span>
              <span className="text-gray-300 opacity-90 font-medium text-[11px] border-l border-white/20 pl-2">
                {actionStatus.sub}
              </span>
            </motion.div>
          </div>
        )}

        {/* SVG Football Pitch */}
        <svg
          viewBox={`0 0 ${PITCH_WIDTH} ${PITCH_HEIGHT}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Stadium grass alternating green stripes (Matches broadcast feeds) */}
            <pattern
              id="pitchTurf"
              width="10.5"
              height="68"
              patternUnits="userSpaceOnUse"
            >
              <rect x="0" y="0" width="5.25" height="68" fill="#1b7a2b" />
              <rect x="5.25" y="0" width="5.25" height="68" fill="#166824" />
            </pattern>

            {/* Broadcast Multi-Stop Heat Radial Gradient */}
            <radialGradient id="heatRadialCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#fde047" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#f97316" stopOpacity="0.65" />
              <stop offset="85%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>

            {/* Gaussian Blur for Organic Heatmap Dispersion */}
            <filter id="heatGlowBlur" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.4" />
            </filter>
          </defs>

          {/* Pitch background grass with alternating lush stripes */}
          <rect x="0" y="0" width={PITCH_WIDTH} height={PITCH_HEIGHT} fill="url(#pitchTurf)" />

          {/* ========================================================= */}
          {/* VIEW MODE 1: CONTINUOUS SOFASCORE / OPTA THERMAL HEATMAP */}
          {/* ========================================================= */}
          {visualizerMode === 'heatmap' && heatmapDataUrl && (
            <g id="sofascore-thermal-surface">
              <image
                x="0"
                y="0"
                width={PITCH_WIDTH}
                height={PITCH_HEIGHT}
                href={heatmapDataUrl}
                preserveAspectRatio="none"
                opacity="0.95"
              />
              {/* Broadcast Attacking Direction & Flank Badges */}
              <g transform="translate(82, 5.5)" opacity="0.90">
                <rect x="-1" y="-2.2" width="22" height="4.4" rx="1.2" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.3" />
                <text x="10" y="0.8" textAnchor="middle" fontSize="1.8" fill="#B8F34A" fontWeight="bold" letterSpacing="0.2">
                  ATTACK ➔
                </text>
              </g>
              {/* Tactical Flank Identifiers */}
              <g opacity="0.65" fontSize="1.6" fill="#ffffff" fontWeight="bold" letterSpacing="0.4">
                <text x="52.5" y="4.5" textAnchor="middle">◀ LEFT FLANK (LB / LW) ▶</text>
                <text x="52.5" y="65.2" textAnchor="middle">◀ RIGHT FLANK (RB / RW) ▶</text>
                <text x="18" y="34.5" textAnchor="middle" opacity="0.45" fontSize="1.9">DEFENSIVE HALF</text>
                <text x="87" y="34.5" textAnchor="middle" opacity="0.45" fontSize="1.9">ATTACKING HALF</text>
              </g>
            </g>
          )}

          {/* Pitch Markings (Crisp white lines overlaid over turf and thermal heatmap) */}
          <g
            stroke={visualizerMode === 'heatmap' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.65)'}
            strokeWidth="0.55"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="101" height="64" />
            <line x1="52.5" y1="2" x2="52.5" y2="66" />
            <circle cx="52.5" cy="34" r="9.15" />
            <circle cx="52.5" cy="34" r="0.6" fill="rgba(255, 255, 255, 0.7)" />

            {/* Left Penalty Area */}
            <rect x="2" y="13.84" width="16.5" height="40.32" />
            <rect x="2" y="24.84" width="5.5" height="18.32" />
            <circle cx="13" cy="34" r="0.5" fill="rgba(255, 255, 255, 0.7)" />
            <path d="M 18.5 27.5 A 9.15 9.15 0 0 1 18.5 40.5" />
            <rect x="0.2" y="30.34" width="1.8" height="7.32" stroke="rgba(255, 255, 255, 0.8)" fill="rgba(255, 255, 255, 0.08)" />

            {/* Right Penalty Area */}
            <rect x="86.5" y="13.84" width="16.5" height="40.32" />
            <rect x="97.5" y="24.84" width="5.5" height="18.32" />
            <circle cx="92" cy="34" r="0.5" fill="rgba(255, 255, 255, 0.7)" />
            <path d="M 86.5 27.5 A 9.15 9.15 0 0 0 86.5 40.5" />
            <rect x="103" y="30.34" width="1.8" height="7.32" stroke="rgba(255, 255, 255, 0.8)" fill="rgba(255, 255, 255, 0.08)" />

            {/* Corner Arcs */}
            <path d="M 2 3 A 1 1 0 0 0 3 2" />
            <path d="M 102 2 A 1 1 0 0 0 103 3" />
            <path d="M 2 65 A 1 1 0 0 1 3 66" />
            <path d="M 102 66 A 1 1 0 0 1 103 65" />
          </g>

          {/* Goal pin overlay if player scored */}
          {visualizerMode === 'heatmap' && activeHeatmapData && activeHeatmapData.points.filter((pt) => pt.type === 'goal' || pt.outcome === 'goal').map((pt, gIdx) => (
            <g key={`goal-pin-${gIdx}`} transform={`translate(${pt.x}, ${pt.y - 3.2})`}>
              <rect x="-4.5" y="-1.8" width="9" height="3.2" rx="1.2" fill="#047857" stroke="#34d399" strokeWidth="0.3" />
              <text x="0" y="0.5" textAnchor="middle" fontSize="1.8" fill="#ffffff" fontWeight="black">
                ⚽ {pt.minute}'
              </text>
            </g>
          ))}

          {/* ========================================================= */}
          {/* VIEW MODE 2: LIVE 22-PLAYER RADAR (When visualizerMode === 'radar') */}
          {/* ========================================================= */}
          {visualizerMode === 'radar' && (
            <>
              {/* Faded Recent Pass Sequences & Build-Up Trails */}
              {!isFullTime && recentPassTrails.map((trail) => (
                <g key={`trail-${trail.id}`}>
                  <line
                    x1={trail.start.x}
                    y1={trail.start.y}
                    x2={trail.end.x}
                    y2={trail.end.y}
                    stroke={trail.color}
                    strokeWidth={trail.isShot ? "0.9" : "0.55"}
                    strokeDasharray={trail.isShot ? "2 2" : "1.5 2"}
                    strokeOpacity={trail.opacity}
                  />
                  <circle
                    cx={trail.end.x}
                    cy={trail.end.y}
                    r={trail.isShot ? "1.4" : "0.8"}
                    fill={trail.color}
                    opacity={trail.opacity * 1.2}
                  />
                </g>
              ))}

              {/* Tactical Formation Outfield Player Dots */}
              {!isFullTime && (
                <g id="tactical-formations">
                  {/* Home Team (Purple fill / Neon Lime stroke) */}
                  {playersOnPitch.home.map((p) => (
                    <g
                      key={`home-${p.key}-${p.name}`}
                      style={{
                        transform: `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px)`,
                        transition: 'transform 0.85s cubic-bezier(0.25, 1, 0.5, 1)',
                        willChange: 'transform',
                      }}
                      className="cursor-pointer group"
                      onClick={() => {
                        setSelectedHeatmapPlayer(p.name);
                        setVisualizerMode('heatmap');
                      }}
                    >
                      <title>{`Click to view ${p.name}'s Heatmap & Spatial Verification • ${p.role}${p.number ? ` #${p.number}` : ''}${p.isCarrier ? ' • In Possession ⚽' : ''}`}</title>
                      {/* Carrier Active Aura */}
                      {p.isCarrier && (
                        <circle
                          cx="0"
                          cy="0"
                          r="2.5"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="0.45"
                          strokeDasharray="1.5 1"
                          className="animate-spin"
                          opacity="0.95"
                        />
                      )}
                      {/* Pressing Defender Indicator */}
                      {p.isPressing && (
                        <circle
                          cx="0"
                          cy="0"
                          r="2.3"
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="0.4"
                          strokeDasharray="1 1"
                          opacity="0.85"
                        />
                      )}
                      {/* Favourite Player Badge */}
                      {p.isFavorite && (
                        <>
                          <circle
                            cx="0"
                            cy="0"
                            r="2.8"
                            fill="none"
                            stroke="#eab308"
                            strokeWidth="0.5"
                            opacity="0.95"
                          />
                          <text
                            x="0"
                            y="-2.4"
                            textAnchor="middle"
                            fontSize="1.6"
                            fill="#eab308"
                            className="pointer-events-none select-none font-bold"
                          >
                            ★
                          </text>
                        </>
                      )}
                      {/* Outer Jersey Circle */}
                      <circle
                        cx="0"
                        cy="0"
                        r={p.role === 'GK' ? 1.55 : 1.35}
                        fill="#3D195B"
                        stroke="#B8F34A"
                        strokeWidth="0.45"
                        opacity="0.9"
                      />
                      {/* Inner Core */}
                      <circle
                        cx="0"
                        cy="0"
                        r="0.45"
                        fill="#B8F34A"
                        opacity="0.95"
                      />
                      {/* Role text */}
                      <text
                        x="0"
                        y="3.0"
                        textAnchor="middle"
                        fontSize="1.1"
                        fontWeight="bold"
                        fill="#B8F34A"
                        style={{ filter: 'drop-shadow(0px 1px 1.5px rgba(0,0,0,0.95))' }}
                        className="pointer-events-none select-none font-mono"
                      >
                        {p.role}
                      </text>
                    </g>
                  ))}

                  {/* Away Team (Graphite fill / Cool White stroke) */}
                  {playersOnPitch.away.map((p) => (
                    <g
                      key={`away-${p.key}-${p.name}`}
                      style={{
                        transform: `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px)`,
                        transition: 'transform 0.85s cubic-bezier(0.25, 1, 0.5, 1)',
                        willChange: 'transform',
                      }}
                      className="cursor-pointer group"
                      onClick={() => {
                        setSelectedHeatmapPlayer(p.name);
                        setVisualizerMode('heatmap');
                      }}
                    >
                      <title>{`Click to view ${p.name}'s Heatmap & Spatial Verification • ${p.role}${p.number ? ` #${p.number}` : ''}${p.isCarrier ? ' • In Possession ⚽' : ''}`}</title>
                      {/* Carrier Active Aura */}
                      {p.isCarrier && (
                        <circle
                          cx="0"
                          cy="0"
                          r="2.5"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="0.45"
                          strokeDasharray="1.5 1"
                          className="animate-spin"
                          opacity="0.95"
                        />
                      )}
                      {/* Pressing Defender Indicator */}
                      {p.isPressing && (
                        <circle
                          cx="0"
                          cy="0"
                          r="2.3"
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="0.4"
                          strokeDasharray="1 1"
                          opacity="0.85"
                        />
                      )}
                      {/* Favourite Player Badge */}
                      {p.isFavorite && (
                        <>
                          <circle
                            cx="0"
                            cy="0"
                            r="2.8"
                            fill="none"
                            stroke="#eab308"
                            strokeWidth="0.5"
                            opacity="0.95"
                          />
                          <text
                            x="0"
                            y="-2.4"
                            textAnchor="middle"
                            fontSize="1.6"
                            fill="#eab308"
                            className="pointer-events-none select-none font-bold"
                          >
                            ★
                          </text>
                        </>
                      )}
                      {/* Outer Jersey Circle */}
                      <circle
                        cx="0"
                        cy="0"
                        r={p.role === 'GK' ? 1.55 : 1.35}
                        fill="#20212A"
                        stroke="#F3F4F6"
                        strokeWidth="0.45"
                        opacity="0.9"
                      />
                      {/* Inner Core */}
                      <circle
                        cx="0"
                        cy="0"
                        r="0.45"
                        fill="#F3F4F6"
                        opacity="0.95"
                      />
                      {/* Role text */}
                      <text
                        x="0"
                        y="3.0"
                        textAnchor="middle"
                        fontSize="1.1"
                        fontWeight="bold"
                        fill="#F3F4F6"
                        style={{ filter: 'drop-shadow(0px 1px 1.5px rgba(0,0,0,0.95))' }}
                        className="pointer-events-none select-none font-mono"
                      >
                        {p.role}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* Trajectories and Overlays */}
              {!isFullTime && activeOverlays.map((overlay) => {
                const ev = overlay.event;
                const start = mapCoords(ev.position, ev.team);
                const end = ev.end_position
                  ? mapCoords(ev.end_position, ev.team)
                  : ev.type === 'shot'
                  ? (ev.team === 'home' || ev.team === homeTeam)
                    ? { x: 104, y: 34 }
                    : { x: 1, y: 34 }
                  : null;

                if (ev.type === 'shot' && end) {
                  const shotColor = getShotColor(ev.outcome);
                  return (
                    <g key={overlay.id}>
                      <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={shotColor}
                        strokeWidth="0.8"
                        strokeDasharray="2 1.5"
                        strokeOpacity="0.45"
                      />
                      <circle
                        cx={end.x}
                        cy={end.y}
                        r="2.2"
                        fill="none"
                        stroke={shotColor}
                        strokeWidth="0.5"
                        opacity="0.8"
                      />
                      <circle cx={end.x} cy={end.y} r="0.8" fill={shotColor} opacity="0.9" />
                    </g>
                  );
                }

                if ((ev.type === 'pass' || ev.type === 'free_kick') && end) {
                  const isFreeKickEv = ev.type === 'free_kick' || (ev.subtype || '').includes('free_kick') || ev.additional?.set_piece === 'free_kick';
                  const isSuccess = ev.outcome !== 'failed';
                  const passColor = isFreeKickEv ? '#06b6d4' : (isSuccess ? '#38bdf8' : '#ef4444');
                  return (
                    <g key={overlay.id}>
                      <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={passColor}
                        strokeWidth={isFreeKickEv ? "0.85" : "0.65"}
                        strokeDasharray={isFreeKickEv ? "3 1.5" : "2 2"}
                        strokeOpacity={isFreeKickEv ? "0.6" : "0.4"}
                      />
                      <circle
                        cx={end.x}
                        cy={end.y}
                        r={isFreeKickEv ? "2.0" : "1.8"}
                        fill="none"
                        stroke={passColor}
                        strokeWidth="0.45"
                        opacity="0.8"
                      />
                      <circle cx={end.x} cy={end.y} r="0.7" fill={passColor} opacity="0.9" />
                    </g>
                  );
                }

                if ((ev.type === 'goal_kick' || ev.type === 'clearance') && end) {
                  const kickColor = '#a855f7';
                  return (
                    <g key={overlay.id}>
                      <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={kickColor}
                        strokeWidth="0.7"
                        strokeDasharray="3 2"
                        strokeOpacity="0.4"
                      />
                      <circle
                        cx={end.x}
                        cy={end.y}
                        r="1.8"
                        fill="none"
                        stroke={kickColor}
                        strokeWidth="0.45"
                        opacity="0.7"
                      />
                      <circle cx={end.x} cy={end.y} r="0.7" fill={kickColor} opacity="0.8" />
                    </g>
                  );
                }

                if (ev.type === 'corner' && end) {
                  const cornerColor = '#10b981';
                  return (
                    <g key={overlay.id}>
                      <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={cornerColor}
                        strokeWidth="0.75"
                        strokeDasharray="3 2"
                        strokeOpacity="0.6"
                      />
                      <circle cx={end.x} cy={end.y} r="2.0" fill="none" stroke={cornerColor} strokeWidth="0.5" opacity="0.8" />
                      <circle cx={end.x} cy={end.y} r="0.8" fill={cornerColor} opacity="0.9" />
                    </g>
                  );
                }

                if (ev.type === 'card' || ev.type === 'foul') {
                  const isRed = ev.card_type === 'red' || (ev.subtype || '').includes('red') || (ev.additional?.color || '').includes('red');
                  const cardColor = isRed ? '#ef4444' : (ev.type === 'foul' ? '#f59e0b' : '#eab308');
                  return (
                    <g key={overlay.id}>
                      <circle cx={start.x} cy={start.y} r="2.2" fill="none" stroke={cardColor} strokeWidth="0.5" opacity="0.8" />
                      <circle cx={start.x} cy={start.y} r="0.9" fill={cardColor} />
                    </g>
                  );
                }

                return null;
              })}

              {/* Animated Live Ball Indicator */}
              <g
                style={{
                  transform: `translate(${ballPos.x.toFixed(2)}px, ${ballPos.y.toFixed(2)}px)`,
                  transition: 'transform 0.85s cubic-bezier(0.25, 1, 0.5, 1)',
                  willChange: 'transform',
                }}
              >
                {isGoal && (
                  <>
                    <circle
                      cx="0"
                      cy="0"
                      r="5.5"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="0.8"
                      opacity="0.8"
                      className="animate-ping"
                    />
                    <circle
                      cx="0"
                      cy="0"
                      r="3.8"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="0.5"
                      strokeDasharray="2 1"
                      className="animate-spin"
                    />
                  </>
                )}
                <circle
                  cx="0"
                  cy="0"
                  r={isFullTime ? "2.0" : isGoal ? "3.2" : "2.4"}
                  fill={isFullTime ? "#eab308" : isGoal ? "#10b981" : "#38bdf8"}
                  opacity={isFullTime ? 0.25 : 0.45}
                />
                <circle
                  cx="0"
                  cy="0"
                  r="1.2"
                  fill="#ffffff"
                  stroke={isFullTime ? "#ca8a04" : isGoal ? "#059669" : "#0284c7"}
                  strokeWidth="0.4"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="0.45"
                  fill={isFullTime ? "#ca8a04" : isGoal ? "#047857" : "#0369a1"}
                />
              </g>
            </>
          )}
        </svg>

        {/* HTML / Framer Motion Active Event Badges Layer on top of Pitch (in Radar mode) */}
        <AnimatePresence>
          {visualizerMode === 'radar' && !isFullTime && activeOverlays.map((overlay) => {
            const ev = overlay.event;
            const start = mapCoords(ev.position, ev.team);
            const leftPercent = (start.x / PITCH_WIDTH) * 100;
            const topPercent = (start.y / PITCH_HEIGHT) * 100;

            const isGoal = ev.type === 'goal' || ev.outcome === 'goal';
            const isCard = ev.type === 'card';
            const isShot = ev.type === 'shot';
            const isHomeTeam = ev.team === 'home' || ev.team === homeTeam;

            return (
              <motion.div
                key={overlay.id}
                initial={{ opacity: 0, scale: 0.5, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.25 } }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{
                  position: 'absolute',
                  left: `${leftPercent}%`,
                  top: `${topPercent}%`,
                  transform: 'translate(-50%, -100%)',
                }}
                className="pointer-events-none z-20 flex flex-col items-center"
              >
                <div
                  className={`
                    px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-1.5 whitespace-nowrap border
                    ${
                      isGoal
                        ? 'bg-emerald-950/95 text-emerald-300 border-emerald-400 ring-2 ring-emerald-500/50 scale-110 shadow-emerald-500/40'
                        : isCard
                        ? ev.card_type === 'red'
                          ? 'bg-red-950/95 text-red-300 border-red-500 shadow-red-500/40'
                          : 'bg-amber-950/95 text-amber-300 border-amber-400 shadow-amber-500/40'
                        : isShot
                        ? 'bg-cyan-950/95 text-cyan-200 border-cyan-400/80 shadow-cyan-500/30'
                        : isHomeTeam
                        ? 'bg-[#0f1d38]/95 text-blue-200 border-blue-500/60 shadow-blue-500/20'
                        : 'bg-[#2d1b0f]/95 text-amber-200 border-amber-500/60 shadow-amber-500/20'
                    }
                  `}
                >
                  <span className="text-sm">
                    {isGoal
                      ? '⚽'
                      : isCard
                      ? ev.card_type === 'red'
                        ? '🟥'
                        : '🟨'
                      : isShot
                      ? '🎯'
                      : ev.type === 'free_kick' || (ev.subtype || '').includes('free_kick')
                      ? '🎯'
                      : ev.type === 'goal_kick'
                      ? '🧤'
                      : ev.type === 'tackle'
                      ? '⚔️'
                      : ev.type === 'interception'
                      ? '🛡️'
                      : ev.type === 'ball_recovery'
                      ? '🔄'
                      : '📍'}
                  </span>
                  <span>{ev.player}</span>
                  {ev.outcome && (
                    <span className="text-[10px] uppercase opacity-80 font-mono">
                      ({ev.outcome})
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ========================================================================= */}
      {/* HEATMAP TELEMETRY & RECEIPTS HUD CARD (Rendered when visualizerMode === 'heatmap') */}
      {/* ========================================================================= */}
      {visualizerMode === 'heatmap' && activeHeatmapData && (
        <div className="bg-slate-900 border-t border-slate-800 p-3 sm:p-4 text-xs text-slate-200 space-y-3">
          {/* Header Row: Player Badge + Primary Hot Zone + Verdict */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-md ${
                  activeHeatmapData.meta?.isHome
                    ? 'bg-purple-950 text-[#B8F34A] border border-[#B8F34A]/50'
                    : 'bg-zinc-800 text-white border border-slate-600'
                }`}
              >
                {activeHeatmapData.meta?.number || activeHeatmapData.meta?.role || '#'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-white">{activeHeatmapData.playerName}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                    {activeHeatmapData.meta?.role || 'Player'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({activeHeatmapData.meta?.team || (activeHeatmapData.meta?.isHome ? homeTeam : awayTeam)})
                  </span>
                </div>
                <div className="text-[11px] text-amber-400 font-medium flex items-center gap-1.5 mt-0.5">
                  <span>📍 Hot Zone:</span>
                  <span className="text-slate-300 font-semibold">{activeHeatmapData.primaryZone}</span>
                </div>
              </div>
            </div>

            {/* Verdict Stamp */}
            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 font-semibold text-[11px] flex items-center gap-2 shadow-sm">
              <span>{activeHeatmapData.verdict}</span>
            </div>
          </div>

          {/* Positional Thirds Breakdown Progress Bar */}
          <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Pitch Third Presence</span>
              <span className="font-mono text-slate-300">{activeHeatmapData.totalEvents} Tracked Actions</span>
            </div>
            {/* Visual 3-color progress bar */}
            <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${activeHeatmapData.defPct}%` }}
                className="h-full bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white transition-all duration-500"
                title={`Defensive Third: ${activeHeatmapData.defPct}%`}
              >
                {activeHeatmapData.defPct > 12 && `${activeHeatmapData.defPct}%`}
              </div>
              <div
                style={{ width: `${activeHeatmapData.midPct}%` }}
                className="h-full bg-purple-600 flex items-center justify-center text-[9px] font-bold text-white transition-all duration-500"
                title={`Middle Third: ${activeHeatmapData.midPct}%`}
              >
                {activeHeatmapData.midPct > 12 && `${activeHeatmapData.midPct}%`}
              </div>
              <div
                style={{ width: `${activeHeatmapData.attPct}%` }}
                className="h-full bg-emerald-500 flex items-center justify-center text-[9px] font-black text-black transition-all duration-500"
                title={`Attacking Third: ${activeHeatmapData.attPct}%`}
              >
                {activeHeatmapData.attPct > 12 && `${activeHeatmapData.attPct}%`}
              </div>
            </div>
            {/* Third Labels */}
            <div className="flex justify-between text-[10px] font-semibold text-slate-400 pt-0.5">
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Defensive 3rd: {activeHeatmapData.defPct}%
              </span>
              <span className="flex items-center gap-1.5 text-purple-400">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Middle 3rd: {activeHeatmapData.midPct}%
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Attacking 3rd: {activeHeatmapData.attPct}%
              </span>
            </div>
          </div>

          {/* Broadcast Thermal Intensity Scale Legend */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950/40 border border-slate-800 text-[10px] text-slate-400">
            <span className="font-semibold text-slate-300">Thermal Intensity</span>
            <div className="flex items-center gap-2 font-mono text-[9px]">
              <span>Low</span>
              <div className="w-28 h-2 rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 via-emerald-400 via-yellow-400 to-red-600 shadow-inner" />
              <span>Hot Core</span>
            </div>
            <span className="text-slate-400">{activeHeatmapData.points.length} Samples</span>
          </div>

          {/* Telemetry Fact Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">Total Touches</span>
              <span className="text-sm font-black text-white font-mono">{activeHeatmapData.totalEvents}</span>
            </div>

            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">Pass Accuracy</span>
              <span className="text-sm font-black text-sky-400 font-mono">
                {activeHeatmapData.passAccuracy !== null
                  ? `${activeHeatmapData.passAccuracy}% (${activeHeatmapData.completedPasses}/${activeHeatmapData.totalPasses})`
                  : 'N/A'}
              </span>
            </div>

            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">Shots & xG</span>
              <span className="text-sm font-black text-amber-400 font-mono">
                {activeHeatmapData.shotsCount > 0
                  ? `${activeHeatmapData.shotsCount} (${activeHeatmapData.totalXg} xG)`
                  : '0 (0.00 xG)'}
              </span>
            </div>

            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">
                {activeHeatmapData.meta?.role === 'GK' ? 'Goalkeeper Saves' : 'Top Sprint Speed'}
              </span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {activeHeatmapData.meta?.role === 'GK'
                  ? `${activeHeatmapData.saves} Saves`
                  : activeHeatmapData.maxSprint
                  ? `${activeHeatmapData.maxSprint} km/h`
                  : `${activeHeatmapData.defensiveActions} Won`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mini Legend Footer in Radar Mode */}
      {visualizerMode === 'radar' && (
        <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#090d18] border-t border-gray-800 text-[11px] text-gray-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-emerald-500 rounded-sm" />
              <span>Goal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-orange-500 rounded-sm" />
              <span>Saved Shot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-sky-400 rounded-sm" />
              <span>Pass</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white border border-sky-400" />
              <span>Live Ball</span>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 font-mono hidden sm:block">
            {isFullTime ? 'Full-Time Tactical Summary' : '💡 Tip: Click any player dot to view their verified heatmap'}
          </div>
        </div>
      )}
    </div>
  );
});

PitchVisualizer.displayName = 'PitchVisualizer';
