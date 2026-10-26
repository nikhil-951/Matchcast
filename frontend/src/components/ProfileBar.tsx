import React, { useEffect, useState, useMemo } from 'react';
import { getVisitorSessionId } from '../utils/session';
import { AudienceMode, RosterPlayer, ViewerProfile, MatchEvent } from '../types';
import { calculatePlayerRatings, getRatingBadgeClass } from '../utils/playerRatings';

interface ProfileBarProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  mode: AudienceMode;
  events?: MatchEvent[];
  currentMinute?: number;
  onChange?: (profile: ViewerProfile) => void;
}

const LANGS: { code: ViewerProfile['language']; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'ES' },
];

/** Personalization: language, favourite club/player, player-focus mode, single metric. */
export const ProfileBar: React.FC<ProfileBarProps> = ({
  matchId,
  homeTeam,
  awayTeam,
  mode,
  events = [],
  currentMinute,
  onChange,
}) => {
  const [profile, setProfile] = useState<ViewerProfile>({
    mode,
    language: 'en',
    favorite_club: homeTeam || null,
    favorite_player: null,
    player_focus: false,
    focus_metric: 'all',
  });
  const [players, setPlayers] = useState<RosterPlayer[]>([]);

  // Compute live Opta-style ratings for all players
  const playerRatings = useMemo(() => {
    return calculatePlayerRatings(events, homeTeam, awayTeam, currentMinute);
  }, [events, homeTeam, awayTeam, currentMinute]);

  const activePlayerStats = profile.favorite_player ? playerRatings[profile.favorite_player] : null;

  useEffect(() => {
    let cancelled = false;
    const sid = getVisitorSessionId();
    fetch(`/api/match/${matchId}/players?session_id=${encodeURIComponent(sid)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.players) {
          setPlayers(d.players);
          // Preselect sensible defaults so demo shows personalization immediately
          const defaultClub = homeTeam || d.players[0]?.team || null;
          const defaultPlayer = d.players.find((p: RosterPlayer) => p.team === defaultClub)?.name || d.players[0]?.name || null;
          setProfile((prev) => {
            const next = {
              ...prev,
              favorite_club: prev.favorite_club || defaultClub,
              favorite_player: prev.favorite_player || defaultPlayer,
            };
            onChange?.(next);
            return next;
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [matchId, homeTeam, onChange]);

  const update = (patch: Partial<ViewerProfile>) => {
    const next = { ...profile, ...patch, mode };
    if (!next.favorite_player) next.player_focus = false;
    setProfile(next);
    onChange?.(next);
    const sid = getVisitorSessionId();
    fetch(`/api/match/${matchId}/profile?session_id=${encodeURIComponent(sid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => undefined);
  };

  const selectClass =
    'bg-slate-50 dark:bg-[#101116] border border-slate-200 dark:border-[#3D195B]/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-[#F3F4F6] focus:outline-none focus:border-[#3D195B] dark:focus:border-[#B8F34A] transition-colors';

  return (
    <div
      className="w-full flex flex-wrap items-center gap-3 bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-xl px-4 py-2.5 shadow-xs dark:shadow-none transition-colors"
      data-testid="profile-bar"
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900 dark:text-[#B8F34A]">Made for you</span>

      <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-[#3D195B]/60" role="group" aria-label="Language">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => update({ language: l.code })}
            className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
              profile.language === l.code ? 'bg-[#3D195B] text-[#B8F34A]' : 'bg-slate-100 dark:bg-[#101116] text-slate-700 dark:text-[#F3F4F6] hover:bg-slate-200 dark:hover:bg-[#3D195B]/40'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <select
        aria-label="Favourite club"
        className={selectClass}
        value={profile.favorite_club ?? ''}
        onChange={(e) => update({ favorite_club: e.target.value || null })}
      >
        <option value="">Favourite club: none</option>
        <option value={homeTeam}>{homeTeam}</option>
        <option value={awayTeam}>{awayTeam}</option>
      </select>

      <select
        aria-label="Favourite player"
        className={selectClass}
        value={profile.favorite_player ?? ''}
        onChange={(e) => update({ favorite_player: e.target.value || null })}
      >
        <option value="">Favourite player: none</option>
        {[homeTeam, awayTeam].map((team) => (
          <optgroup key={team} label={team} className="bg-white dark:bg-[#101116] text-slate-700 dark:text-gray-300">
            {players
              .filter((p) => p.team === team)
              .map((p) => (
                <option key={p.name} value={p.name} className="bg-white dark:bg-[#101116] text-slate-800 dark:text-[#F3F4F6]">
                  {p.number != null ? `#${p.number} ` : ''}
                  {p.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>

      {/* Live Player Rating Pill */}
      {activePlayerStats && (
        <div
          title={`${activePlayerStats.name} live rating and performance stats`}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#101116] border border-slate-200 dark:border-[#3D195B]/60 text-xs shadow-xs"
        >
          <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[11px] border ${getRatingBadgeClass(activePlayerStats.rating)}`}>
            ⭐ {activePlayerStats.rating.toFixed(1)}
          </span>
          <span className="text-[11px] text-slate-700 dark:text-gray-300 font-mono hidden md:inline">
            {activePlayerStats.summary}
          </span>
        </div>
      )}


    </div>
  );
};
