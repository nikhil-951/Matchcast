import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MatchState, MatchEvent } from '../types';
import { MatchMomentumGraph } from './MatchMomentumGraph';

interface MatchStatsProps {
  matchState: MatchState;
  lastEvent?: MatchEvent | null;
  isPlaying?: boolean;
  playbackSpeed?: number;
  onTogglePlay?: () => void;
  onSpeedChange?: (speed: number) => void;
  onOpenPersonalityModal?: () => void;
  events?: MatchEvent[];
  onSeek?: (minute: number) => void;
}

export const MatchStats: React.FC<MatchStatsProps> = React.memo(({
  matchState,
  lastEvent,
  isPlaying,
  playbackSpeed = 1.0,
  onTogglePlay,
  onSpeedChange,
  onOpenPersonalityModal,
  events = [],
  onSeek,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'tactics' | 'overview'>('stats');

  const { minute, second, score, possession, xg, home_team, away_team, momentum, detailed_stats } = matchState;

  const safeHome = home_team || 'Home FC';
  const safeAway = away_team || 'Away FC';

  // Format clock with leading zero
  const formattedMinute = String(minute ?? 0).padStart(2, '0');
  const formattedSecond = String(second ?? 0).padStart(2, '0');

  // Compute possession percentages ensuring sum is 100
  // Early match guard: if < 2 mins or < 6 passes, show neutral 50-50 to avoid misleading 100%-0%
  const totalPasses = (detailed_stats?.home?.total_passes ?? 0) + (detailed_stats?.away?.total_passes ?? 0);
  const isEarlyPhase = (minute ?? 0) < 2 && totalPasses < 6;
  const homePoss = isEarlyPhase ? 50 : Math.round(possession?.home ?? 50);
  const awayPoss = isEarlyPhase ? 50 : Math.max(0, 100 - homePoss);

  // Active possession team from last event
  const currentPossTeam = lastEvent
    ? (lastEvent.team === 'home' || lastEvent.team.toLowerCase() === safeHome.toLowerCase()
        ? safeHome
        : safeAway)
    : null;

  // Compute momentum percentages
  const homeMom = Math.round(momentum?.home ?? 50);
  const awayMom = Math.max(0, 100 - homeMom);

  // Compute total xG for comparative bar width
  const homeXg = xg?.home ?? 0;
  const awayXg = xg?.away ?? 0;
  const totalXg = homeXg + awayXg;
  const homeXgPercent = totalXg > 0 ? (homeXg / totalXg) * 100 : 50;

  // Granular stats with robust fallback calculations
  const homeStats = detailed_stats?.home ?? {
    shots: Math.max(score?.home ?? 0, Math.round(homeXg * 6)),
    shots_on_target: Math.max(score?.home ?? 0, Math.round(homeXg * 3.5)),
    total_passes: Math.max(1, Math.round(homePoss * 7.5)),
    completed_passes: Math.max(1, Math.round(homePoss * 6.2)),
    pass_accuracy: 83.5,
    fouls: Math.max(1, Math.round(homePoss * 0.12)),
    yellow_cards: 0,
    red_cards: 0,
    corners: Math.max(0, Math.round(homeXg * 2)),
    tackles_won: Math.max(1, Math.round(awayPoss * 0.3)),
  };

  const awayStats = detailed_stats?.away ?? {
    shots: Math.max(score?.away ?? 0, Math.round(awayXg * 6)),
    shots_on_target: Math.max(score?.away ?? 0, Math.round(awayXg * 3.5)),
    total_passes: Math.max(1, Math.round(awayPoss * 7.5)),
    completed_passes: Math.max(1, Math.round(awayPoss * 6.0)),
    pass_accuracy: 80.0,
    fouls: Math.max(1, Math.round(awayPoss * 0.14)),
    yellow_cards: 0,
    red_cards: 0,
    corners: Math.max(0, Math.round(awayXg * 2)),
    tackles_won: Math.max(1, Math.round(homePoss * 0.3)),
  };

  const speedOptions = [0.5, 1.0, 2.0, 5.0, 10.0, 20.0];
  const isFullTime = matchState.status === 'full_time';

  // Helper for rendering stat rows with proportional bar
  const renderStatRow = (
    label: string,
    homeVal: number | string,
    awayVal: number | string,
    homeNum: number,
    awayNum: number,
    icon?: string
  ) => {
    const total = homeNum + awayNum;
    const homePct = total > 0 ? Math.min(95, Math.max(5, (homeNum / total) * 100)) : 50;

    return (
      <div className="py-1.5 border-b border-slate-200 dark:border-[#3D195B]/30 last:border-b-0">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-mono font-bold text-purple-900 dark:text-[#B8F34A] text-sm">{homeVal}</span>
          <span className="text-[11px] font-semibold text-slate-800 dark:text-[#F3F4F6] uppercase tracking-wider flex items-center gap-1.5">
            {icon && <span>{icon}</span>}
            {label}
          </span>
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">{awayVal}</span>
        </div>
        <div className="relative w-full h-1.5 bg-slate-200 dark:bg-[#101116] border border-slate-300 dark:border-[#3D195B]/30 rounded-full overflow-hidden flex shadow-inner">
          <div
            className="h-full bg-[#3D195B] dark:bg-[#B8F34A] rounded-l-full transition-all duration-300"
            style={{ width: `${homePct}%` }}
          />
          <div
            className="h-full bg-amber-500 dark:bg-[#8233bd] rounded-r-full transition-all duration-300"
            style={{ width: `${100 - homePct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col justify-between h-full bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-2xl">
      {/* Broadcast Match Clock & Telemetry Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 dark:border-[#3D195B]/40 gap-2">
          <div className="flex items-center gap-2">
            {isFullTime ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3D195B]/60 border border-[#B8F34A]/40 text-[#B8F34A]">
                <span className="w-2 h-2 rounded-full bg-[#B8F34A] shadow-sm shadow-[#B8F34A]/50" />
                <span className="text-[11px] font-black uppercase tracking-wider">FULL TIME</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3D195B]/60 border border-[#B8F34A]/40 text-[#B8F34A]">
                <span className="w-2 h-2 rounded-full bg-[#B8F34A] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-wider">
                  {minute >= 90 ? 'STOPPAGE TIME' : minute >= 45 ? '2ND HALF' : '1ST HALF'}
                </span>
              </div>
            )}

            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tracking-widest bg-slate-100 dark:bg-[#101116] px-3 py-1 rounded-lg border border-slate-200 dark:border-[#3D195B]/50 shadow-inner">
              {isFullTime ? 'FT' : `${formattedMinute}:${formattedSecond}`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-[#B8F34A] bg-slate-100 dark:bg-[#101116] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#3D195B]/40">
              Live Studio
            </span>
          </div>
        </div>

        {/* Main TV Scoreboard Display */}
        <div className="my-3 bg-slate-50 dark:bg-[#101116] rounded-xl p-3 border border-slate-200 dark:border-[#3D195B]/40 shadow-inner">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {/* Home Team */}
            <div className="flex flex-col items-center text-center px-1">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3D195B] to-[#52237a] flex items-center justify-center text-sm font-black text-[#B8F34A] shadow-lg shadow-[#3D195B]/40 border border-[#B8F34A]/40 mb-1">
                {safeHome.slice(0, 3).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-[#F3F4F6] text-center break-words leading-tight">
                {safeHome}
              </span>
              <span className="text-[10px] text-purple-900 dark:text-[#B8F34A] font-semibold uppercase">
                Home
              </span>
            </div>

            {/* Large Center Score */}
            <div className="flex flex-col items-center px-2">
              <div className="flex items-center gap-2.5">
                <motion.span
                  key={`score-home-${score?.home ?? 0}`}
                  initial={{ scale: 1.3, color: '#B8F34A' }}
                  animate={{ scale: 1, color: '#ffffff' }}
                  className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white"
                >
                  {score?.home ?? 0}
                </motion.span>
                <span className="text-xl font-bold text-gray-500 select-none">:</span>
                <motion.span
                  key={`score-away-${score?.away ?? 0}`}
                  initial={{ scale: 1.3, color: '#d8b4fe' }}
                  animate={{ scale: 1, color: '#ffffff' }}
                  className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white"
                >
                  {score?.away ?? 0}
                </motion.span>
              </div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 dark:text-gray-400 mt-0.5">
                Match Score
              </div>
            </div>

            {/* Away Team */}
            <div className="flex flex-col items-center text-center px-1">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-800 to-[#3D195B] flex items-center justify-center text-sm font-black text-white shadow-lg shadow-purple-900/40 border border-purple-400/40 mb-1">
                {safeAway.slice(0, 3).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-[#F3F4F6] text-center break-words leading-tight">
                {safeAway}
              </span>
              <span className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold uppercase">
                Away
              </span>
            </div>
          </div>
        </div>

        {/* Breaking Tactical Data Story Alert Banner */}
        {matchState.latest_story && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 p-3 rounded-xl bg-slate-100 dark:bg-[#16171F] border border-slate-200 dark:border-slate-800 border-l-4 border-l-blue-600 dark:border-l-[#B8F34A] shadow-sm"
          >
            <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
              <span className="flex items-center gap-1.5 text-blue-700 dark:text-[#B8F34A] uppercase tracking-wider font-bold">
                <span>⚡</span>
                <span>Tactical Story Discovery</span>
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-[#20212A] px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px] font-bold">
                {matchState.latest_story.minute}&apos;
              </span>
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white mb-1 leading-snug">
              {matchState.latest_story.title}
            </div>
            <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
              {matchState.latest_story.description}
            </div>
          </motion.div>
        )}

        {/* Tab Switcher: Match Stats vs Tactical Facts vs Momentum/xG */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-[#101116] p-1 border border-slate-200 dark:border-[#3D195B]/40 mb-3 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'stats'
                ? 'bg-[#3D195B] text-[#B8F34A] shadow-md shadow-[#3D195B]/40 border border-[#B8F34A]/50'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#20212A]'
            }`}
          >
            <span>📊</span>
            <span>Stats</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tactics')}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'tactics'
                ? 'bg-[#3D195B] text-[#B8F34A] shadow-md shadow-[#3D195B]/40 border border-[#B8F34A]/50'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#20212A]'
            }`}
          >
            <span>🎯</span>
            <span>Tactical Facts</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'overview'
                ? 'bg-[#3D195B] text-[#B8F34A] shadow-md shadow-[#3D195B]/40 border border-[#B8F34A]/50'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#20212A]'
            }`}
          >
            <span>⚡</span>
            <span>Momentum</span>
          </button>
        </div>

        {/* TAB 1: Complete Premier League Style Match Statistics */}
        {activeTab === 'stats' && (
          <div className="bg-slate-50 dark:bg-[#101116] rounded-xl p-3 border border-slate-200 dark:border-[#3D195B]/40 space-y-0.5">
            {renderStatRow(
              'Shots (On Target)',
              `${homeStats.shots} (${homeStats.shots_on_target})`,
              `${awayStats.shots} (${awayStats.shots_on_target})`,
              homeStats.shots,
              awayStats.shots,
              '🎯'
            )}
            {renderStatRow(
              'Expected Goals (xG)',
              homeXg.toFixed(2),
              awayXg.toFixed(2),
              homeXg * 100,
              awayXg * 100,
              '📈'
            )}
            {renderStatRow(
              'Possession %',
              `${homePoss}%`,
              `${awayPoss}%`,
              homePoss,
              awayPoss,
              '⚽'
            )}
            {renderStatRow(
              'Total Passes',
              homeStats.total_passes,
              awayStats.total_passes,
              homeStats.total_passes,
              awayStats.total_passes,
              '🔄'
            )}
            {renderStatRow(
              'Pass Accuracy',
              `${homeStats.pass_accuracy}%`,
              `${awayStats.pass_accuracy}%`,
              homeStats.pass_accuracy,
              awayStats.pass_accuracy,
              '🎯'
            )}
            {renderStatRow(
              'Corners',
              homeStats.corners,
              awayStats.corners,
              homeStats.corners,
              awayStats.corners,
              '🚩'
            )}
            {renderStatRow(
              'Tackles Won',
              homeStats.tackles_won,
              awayStats.tackles_won,
              homeStats.tackles_won,
              awayStats.tackles_won,
              '🛡️'
            )}
            {renderStatRow(
              'Fouls Committed',
              homeStats.fouls,
              awayStats.fouls,
              homeStats.fouls,
              awayStats.fouls,
              '⚠️'
            )}
            {renderStatRow(
              'Yellow Cards',
              `🟨 ${homeStats.yellow_cards}`,
              `🟨 ${awayStats.yellow_cards}`,
              homeStats.yellow_cards,
              awayStats.yellow_cards
            )}
            {renderStatRow(
              'Red Cards',
              `🟥 ${homeStats.red_cards}`,
              `🟥 ${awayStats.red_cards}`,
              homeStats.red_cards,
              awayStats.red_cards
            )}
          </div>
        )}

        {/* TAB 2: Bundesliga-Style Tactical Match Facts (Attacking Channels, Keeper, Set-Piece) */}
        {activeTab === 'tactics' && (
          <div className="space-y-3 bg-slate-50 dark:bg-[#101116] rounded-xl p-3 border border-slate-200 dark:border-[#3D195B]/40">
            {/* 1. Attacking Zone Effectiveness (Left, Central, Right Channels) */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-gray-300 mb-2">
                <span className="flex items-center gap-1.5 text-purple-900 dark:text-[#B8F34A] uppercase tracking-wider text-[11px]">
                  <span>🏹</span> Attacking Channels
                </span>
                <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Final Third Penetrations</span>
              </div>

              {/* Channel columns */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                {/* Left Channel */}
                <div className="bg-white dark:bg-[#20212A] p-2 rounded-lg border border-slate-200 dark:border-[#3D195B]/40">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-tight mb-1">Left Wing</div>
                  <div className="flex justify-between text-[11px] font-mono px-1">
                    <span className="text-purple-900 dark:text-[#B8F34A] font-bold">{matchState.attacking_zones?.home.left.entries ?? 0}</span>
                    <span className="text-slate-400 dark:text-gray-600">:</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">{matchState.attacking_zones?.away.left.entries ?? 0}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-gray-400 mt-1">
                    {((matchState.attacking_zones?.home.left.xg ?? 0) + (matchState.attacking_zones?.away.left.xg ?? 0)).toFixed(2)} xG
                  </div>
                </div>

                {/* Central Channel */}
                <div className="bg-white dark:bg-[#20212A] p-2 rounded-lg border border-purple-300 dark:border-[#B8F34A]/50 shadow-sm">
                  <div className="text-[10px] font-bold text-purple-900 dark:text-[#B8F34A] uppercase tracking-tight mb-1">Central Corridor</div>
                  <div className="flex justify-between text-[11px] font-mono px-1">
                    <span className="text-purple-900 dark:text-[#B8F34A] font-bold">{matchState.attacking_zones?.home.central.entries ?? 0}</span>
                    <span className="text-slate-400 dark:text-gray-600">:</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">{matchState.attacking_zones?.away.central.entries ?? 0}</span>
                  </div>
                  <div className="text-[9px] text-purple-900 dark:text-[#B8F34A] mt-1 font-bold">
                    {((matchState.attacking_zones?.home.central.xg ?? 0) + (matchState.attacking_zones?.away.central.xg ?? 0)).toFixed(2)} xG
                  </div>
                </div>

                {/* Right Channel */}
                <div className="bg-white dark:bg-[#20212A] p-2 rounded-lg border border-slate-200 dark:border-[#3D195B]/40">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-tight mb-1">Right Wing</div>
                  <div className="flex justify-between text-[11px] font-mono px-1">
                    <span className="text-purple-900 dark:text-[#B8F34A] font-bold">{matchState.attacking_zones?.home.right.entries ?? 0}</span>
                    <span className="text-slate-400 dark:text-gray-600">:</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">{matchState.attacking_zones?.away.right.entries ?? 0}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-gray-400 mt-1">
                    {((matchState.attacking_zones?.home.right.xg ?? 0) + (matchState.attacking_zones?.away.right.xg ?? 0)).toFixed(2)} xG
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Goalkeeper Efficiency (Goals Prevented / Synthetic Estimate) */}
            <div className="pt-2.5 border-t border-slate-200 dark:border-[#3D195B]/40">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-gray-300 mb-1.5">
                <span className="flex items-center gap-1.5 text-purple-900 dark:text-[#B8F34A] uppercase tracking-wider text-[11px]">
                  <span>🧤</span> Keeper Efficiency
                </span>
                <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Goals Prevented (xG - Conceded)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white dark:bg-[#20212A] p-2 rounded-lg border border-slate-200 dark:border-[#3D195B]/40">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-purple-900 dark:text-[#B8F34A] truncate">{safeHome}</span>
                    <span className={`text-xs font-mono font-bold ${(matchState.keeper_efficiency?.home.goals_prevented ?? 0) >= 0 ? 'text-emerald-600 dark:text-[#B8F34A]' : 'text-rose-600 dark:text-rose-400'}`}>
                      {(matchState.keeper_efficiency?.home.goals_prevented ?? 0) >= 0 ? '+' : ''}
                      {(matchState.keeper_efficiency?.home.goals_prevented ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 flex justify-between">
                    <span>{matchState.keeper_efficiency?.home.saves ?? 0} Saves</span>
                    <span>{matchState.keeper_efficiency?.home.goals_conceded ?? 0} Conceded</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#20212A] p-2 rounded-lg border border-slate-200 dark:border-[#3D195B]/40">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate">{safeAway}</span>
                    <span className={`text-xs font-mono font-bold ${(matchState.keeper_efficiency?.away.goals_prevented ?? 0) >= 0 ? 'text-emerald-600 dark:text-[#B8F34A]' : 'text-rose-600 dark:text-rose-400'}`}>
                      {(matchState.keeper_efficiency?.away.goals_prevented ?? 0) >= 0 ? '+' : ''}
                      {(matchState.keeper_efficiency?.away.goals_prevented ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 flex justify-between">
                    <span>{matchState.keeper_efficiency?.away.saves ?? 0} Saves</span>
                    <span>{matchState.keeper_efficiency?.away.goals_conceded ?? 0} Conceded</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Set-Piece Threat Index */}
            <div className="pt-2.5 border-t border-slate-200 dark:border-[#3D195B]/40">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-gray-300 mb-1.5">
                <span className="flex items-center gap-1.5 text-purple-900 dark:text-[#B8F34A] uppercase tracking-wider text-[11px]">
                  <span>🚩</span> Set-Piece Danger Index
                </span>
                <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Corners & Free Kicks</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white dark:bg-[#20212A] p-2.5 min-h-[56px] rounded-lg border border-slate-200 dark:border-[#3D195B]/40 flex justify-between items-center">
                  <span className="text-[11px] font-bold text-purple-900 dark:text-[#B8F34A] truncate max-w-[90px]">{safeHome}</span>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-purple-900 dark:text-[#B8F34A]">
                      {Math.round(matchState.set_piece_threat?.home.threat_index ?? 0)}/100
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-gray-400 leading-tight">
                      {(matchState.set_piece_threat?.home.cumulative_xg ?? 0).toFixed(2)} xG
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#20212A] p-2.5 min-h-[56px] rounded-lg border border-slate-200 dark:border-[#3D195B]/40 flex justify-between items-center">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate max-w-[90px]">{safeAway}</span>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-purple-900 dark:text-[#B8F34A]">
                      {Math.round(matchState.set_piece_threat?.away.threat_index ?? 0)}/100
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-gray-400 leading-tight">
                      {(matchState.set_piece_threat?.away.cumulative_xg ?? 0).toFixed(2)} xG
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Dynamic Wave and Detailed xG / Possession */}
        {activeTab === 'overview' && (
          <div className="space-y-3 bg-slate-50 dark:bg-[#101116] rounded-xl p-3 border border-slate-200 dark:border-[#3D195B]/40">
            {/* Momentum Swing Meter */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                <div className="flex items-center gap-1 font-mono font-bold text-purple-900 dark:text-[#B8F34A]">
                  <span>{homeMom}%</span>
                </div>
                <span className="text-[11px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1">
                  <span>⚡</span> Momentum Balance
                </span>
                <div className="flex items-center gap-1 font-mono font-bold text-amber-600 dark:text-amber-400">
                  <span>{awayMom}%</span>
                </div>
              </div>

              <div className="relative w-full h-2.5 bg-slate-200 dark:bg-[#101116] border border-slate-300 dark:border-[#3D195B]/30 rounded-full overflow-hidden flex shadow-inner">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#3D195B] to-[#B8F34A]"
                  initial={{ width: '50%' }}
                  animate={{ width: `${homeMom}%` }}
                  transition={{ duration: 0.4 }}
                />
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
                  initial={{ width: '50%' }}
                  animate={{ width: `${awayMom}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1">
                <span className="truncate max-w-[120px]">{safeHome}</span>
                <span className="hidden sm:inline">Interactive wave below ↓</span>
                <span className="truncate max-w-[120px] text-right">{safeAway}</span>
              </div>
            </div>

            {/* Expected Goals (xG) Comparison */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-purple-900 dark:text-[#B8F34A]">{homeXg.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-mono">xG</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Expected Goals (xG)
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-mono">xG</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{awayXg.toFixed(2)}</span>
                </div>
              </div>

              <div className="relative w-full h-2.5 bg-slate-200 dark:bg-[#101116] border border-slate-300 dark:border-[#3D195B]/30 rounded-full overflow-hidden flex shadow-inner">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#3D195B] to-[#B8F34A]"
                  initial={{ width: '50%' }}
                  animate={{ width: `${homeXgPercent}%` }}
                  transition={{ duration: 0.4 }}
                />
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
                  initial={{ width: '50%' }}
                  animate={{ width: `${100 - homeXgPercent}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            {/* Possession Stats Bar with In-Possession Live Indicator */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                <span className="font-mono font-bold text-purple-900 dark:text-[#B8F34A]">{homePoss}%</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Ball Possession
                  </span>
                  {currentPossTeam && !isFullTime && (
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-black uppercase rounded tracking-wider ${
                        currentPossTeam === safeHome
                          ? 'bg-[#3D195B]/70 text-[#B8F34A] border border-[#B8F34A]/50 animate-pulse'
                          : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 animate-pulse'
                      }`}
                    >
                      ⚡ {currentPossTeam}
                    </span>
                  )}
                </div>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{awayPoss}%</span>
              </div>

              <div className="relative w-full h-2.5 bg-slate-200 dark:bg-[#101116] border border-slate-300 dark:border-[#3D195B]/30 rounded-full overflow-hidden flex shadow-inner">
                <motion.div
                  className="h-full bg-[#3D195B] dark:bg-[#B8F34A]"
                  initial={{ width: '50%' }}
                  animate={{ width: `${homePoss}%` }}
                  transition={{ duration: 0.4 }}
                />
                <motion.div
                  className="h-full bg-amber-500 dark:bg-[#8233bd]"
                  initial={{ width: '50%' }}
                  animate={{ width: `${awayPoss}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            {/* Control vs. Chaos Index & Game Rhythm (Section 4.1 Requirement) */}
            <div className="pt-2.5 border-t border-slate-200 dark:border-[#3D195B]/40">
              <div className="flex items-center justify-between text-xs mb-1 font-medium">
                <span className="font-mono font-bold text-purple-900 dark:text-[#B8F34A]">
                  {Math.round(matchState.control_index ?? 55)}% CONTROL
                </span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {Math.round(matchState.chaos_index ?? 45)}% CHAOS
                </span>
              </div>
              <div className="text-center mb-1.5">
                <span className="inline-block text-[10px] font-bold tracking-wider text-slate-800 dark:text-[#B8F34A] uppercase bg-slate-100 dark:bg-[#20212A] px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-[#3D195B]/60">
                  {matchState.game_rhythm || "Balanced Tactical Chess Match"}
                </span>
              </div>
              <div className="relative w-full h-2.5 bg-slate-200 dark:bg-[#101116] border border-slate-300 dark:border-[#3D195B]/30 rounded-full overflow-hidden flex shadow-inner">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#3D195B] to-[#B8F34A]"
                  animate={{ width: `${Math.round(matchState.control_index ?? 55)}%` }}
                  transition={{ duration: 0.3 }}
                />
                <motion.div
                  className="h-full bg-gradient-to-r from-rose-500 to-red-600"
                  animate={{ width: `${Math.round(matchState.chaos_index ?? 45)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Match Summary trigger */}
      {onOpenPersonalityModal && (
        <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-[#3D195B]/40">
          <button
            type="button"
            onClick={onOpenPersonalityModal}
            className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-[#3D195B] hover:bg-[#52237a] text-[#B8F34A] transition-all flex items-center justify-center gap-2 border border-[#B8F34A]/40 shadow-sm dark:shadow-lg dark:shadow-[#3D195B]/30 cursor-pointer"
          >
            <span>🏆 Full Match Summary & Key Moments</span>
          </button>
        </div>
      )}
    </div>
  );
});

MatchStats.displayName = 'MatchStats';
