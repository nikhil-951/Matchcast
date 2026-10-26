import { MatchEvent } from '../types';

export interface PlayerPerformance {
  name: string;
  team: string;
  number?: number;
  rating: number; // e.g. 7.8 (scale 4.0 - 10.0)
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  completedPasses: number;
  totalPasses: number;
  passAccuracy: number;
  tackles: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  xg: number;
  summary: string;
}

/**
 * Deterministically computes live player performance ratings and action summaries
 * based on all events up to the current match clock.
 */
export function calculatePlayerRatings(
  events: MatchEvent[],
  homeTeam: string,
  awayTeam: string,
  currentMinute?: number
): Record<string, PlayerPerformance> {
  const players: Record<string, PlayerPerformance> = {};

  const filteredEvents = currentMinute !== undefined
    ? events.filter((e) => (e.minute || 0) <= currentMinute)
    : events;

  for (const ev of filteredEvents) {
    const rawName = (ev.player || '').trim();
    if (!rawName) continue;

    const team = ev.team === 'home' || ev.team?.toLowerCase() === homeTeam.toLowerCase()
      ? homeTeam
      : awayTeam;

    if (!players[rawName]) {
      players[rawName] = {
        name: rawName,
        team,
        number: (ev as any).player_number || ev.additional?.player_number || ev.additional?.number,
        rating: 6.0,
        goals: 0,
        assists: 0,
        shots: 0,
        shotsOnTarget: 0,
        completedPasses: 0,
        totalPasses: 0,
        passAccuracy: 0,
        tackles: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        xg: 0,
        summary: '',
      };
    }

    const p = players[rawName];
    const eType = (ev.type || '').toLowerCase();
    const eOutcome = (ev.outcome || '').toLowerCase();

    // Goal
    if (eType === 'goal' || eOutcome === 'goal') {
      p.goals += 1;
      p.shots += 1;
      p.shotsOnTarget += 1;
      p.rating += 1.3;
    }
    // Shot
    else if (eType === 'shot') {
      p.shots += 1;
      p.xg += ev.xG || 0.12;
      if (eOutcome === 'saved' || eOutcome === 'blocked' || eOutcome === 'on_target') {
        p.shotsOnTarget += 1;
        p.rating += 0.25;
      } else {
        p.rating += 0.1;
      }
    }
    // Pass
    else if (eType === 'pass' || eType === 'free_kick') {
      p.totalPasses += 1;
      if (eOutcome === 'incomplete' || (ev as any).success === false) {
        p.rating -= 0.02;
      } else {
        p.completedPasses += 1;
        p.rating += 0.025;
        if (ev.position && ev.position.x >= 70) {
          p.rating += 0.04; // Final-third pass
        }
      }
    }
    // Tackle / Interception / Ball Recovery
    else if (eType === 'tackle' || eType === 'interception' || eType === 'ball_recovery') {
      p.tackles += 1;
      p.rating += 0.3;
    }
    // Goalkeeper Save
    else if (eType === 'save') {
      p.saves += 1;
      p.rating += 0.45;
    }
    // Discipline
    else if (eType === 'foul') {
      p.rating -= 0.15;
    } else if (eType === 'card' || ev.card_type) {
      const isRed = ev.card_type === 'red' || (ev.subtype || '').includes('red');
      if (isRed) {
        p.redCards += 1;
        p.rating -= 2.0;
      } else {
        p.yellowCards += 1;
        p.rating -= 0.7;
      }
    }
  }

  // Calculate pass accuracies, clamp ratings between 4.0 and 9.9, and generate summaries
  for (const name of Object.keys(players)) {
    const p = players[name];
    p.passAccuracy = p.totalPasses > 0 ? Math.round((p.completedPasses / p.totalPasses) * 100) : 85;
    p.rating = Math.max(4.0, Math.min(9.9, Math.round(p.rating * 10) / 10));

    const parts: string[] = [];
    if (p.goals > 0) parts.push(`${p.goals} Goal${p.goals > 1 ? 's' : ''}`);
    if (p.shots > 0) parts.push(`${p.shots} Shot${p.shots > 1 ? 's' : ''}`);
    if (p.tackles > 0) parts.push(`${p.tackles} Tackle${p.tackles > 1 ? 's' : ''}`);
    if (p.saves > 0) parts.push(`${p.saves} Save${p.saves > 1 ? 's' : ''}`);
    if (p.totalPasses >= 3) parts.push(`${p.passAccuracy}% Pass Acc`);

    p.summary = parts.slice(0, 3).join(' • ') || 'Active in build-up play';
  }

  return players;
}

/**
 * Returns color styling class for rating badge.
 */
export function getRatingBadgeClass(rating: number): string {
  if (rating >= 7.6) {
    return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 ring-1 ring-emerald-500/30';
  }
  if (rating >= 6.8) {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
  }
  if (rating >= 6.0) {
    return 'bg-slate-500/20 text-slate-300 border-slate-600/40';
  }
  return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
}
