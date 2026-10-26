import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMatch } from '../context/MatchContext';
import { PitchVisualizer } from '../components/PitchVisualizer';
import { MatchStats } from '../components/MatchStats';
import { Timeline } from '../components/Timeline';
import { MatchMomentumGraph } from '../components/MatchMomentumGraph';
import { PunditPanel } from '../components/PunditPanel';
import { AskPanel } from '../components/AskPanel';
import { MatchPersonality } from '../components/MatchPersonality';
import { OverlayFeed } from '../components/OverlayFeed';
import { ProfileBar } from '../components/ProfileBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ModeToggle } from '../components/ModeToggle';
import { ThemeToggle } from '../components/ThemeToggle';
import { calculatePlayerRatings, getRatingBadgeClass } from '../utils/playerRatings';
import { ViewerProfile } from '../types';

type MatchCentreTab = 'overview' | 'analytics' | 'pundits' | 'evidence';

export const MatchCentrePage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const {
    matches,
    selectedMatch,
    currentMatchState,
    currentEvents,
    currentLastEvent,
    currentDebate,
    displayedAnswer,
    isPlaying,
    isAsking,
    playbackSpeed,
    audienceMode,
    language,
    wsOverlays,
    wsVerificationStats,
    wsPersonality,
    isWsConnected,
    isLoadingMatches,
    selectMatchById,
    togglePlay,
    seek,
    changeSpeed,
    changeMode,
    setLanguage,
    askQuestion,
    clearAnswer,
    showPersonalityModal,
    setShowPersonalityModal,
    handleClosePersonalityModal,
  } = useMatch();

  const [activeTab, setActiveTab] = useState<MatchCentreTab>('overview');
  const [matchResolved, setMatchResolved] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState<boolean>(true);
  const [viewerProfile, setViewerProfile] = useState<ViewerProfile | null>(null);

  // Attempt to select and recover match based on URL param
  useEffect(() => {
    let isMounted = true;
    if (!matchId) {
      setIsResolving(false);
      setMatchResolved(false);
      return;
    }

    setIsResolving(true);
    selectMatchById(matchId).then((res) => {
      if (!isMounted) return;
      setIsResolving(false);
      setMatchResolved(!!res);
    });

    return () => {
      isMounted = false;
    };
  }, [matchId, selectMatchById]);

  // Compute live Opta-style Player Ratings across all match events
  const allRatings = useMemo(() => {
    return calculatePlayerRatings(
      currentEvents,
      currentMatchState.home_team,
      currentMatchState.away_team,
      currentMatchState.minute
    );
  }, [currentEvents, currentMatchState.home_team, currentMatchState.away_team, currentMatchState.minute]);

  const topHomePlayers = useMemo(() => {
    return Object.values(allRatings)
      .filter((p) => p.team === currentMatchState.home_team)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
  }, [allRatings, currentMatchState.home_team]);

  const topAwayPlayers = useMemo(() => {
    return Object.values(allRatings)
      .filter((p) => p.team === currentMatchState.away_team)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
  }, [allRatings, currentMatchState.away_team]);

  const playerOfTheMatch = useMemo(() => {
    const list = Object.values(allRatings);
    if (list.length === 0) return null;
    return list.reduce((top, p) => (p.rating > top.rating ? p : top), list[0]);
  }, [allRatings]);

  // Loading indicator while resolving URL
  if (isResolving || (isLoadingMatches && !selectedMatch)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#101116] text-slate-900 dark:text-[#F3F4F6] flex flex-col items-center justify-center p-6 transition-colors">
        <div className="w-10 h-10 border-3 border-[#3D195B] border-t-emerald-500 dark:border-t-[#B8F34A] rounded-full animate-spin mb-4" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">Loading Match Studio...</h2>
        <p className="text-xs text-slate-500 dark:text-gray-400 font-mono mt-1">Synchronizing telemetry for {matchId}</p>
      </div>
    );
  }

  // Graceful In-App Fallback when match ID is not found (Requirement 2 & Acceptance Test 4)
  if (!matchResolved || !selectedMatch) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#101116] text-slate-900 dark:text-[#F3F4F6] flex flex-col items-center justify-center p-6 transition-colors">
        <div className="max-w-md w-full bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/60 rounded-2xl p-6 text-center shadow-xl dark:shadow-2xl space-y-4">
          <div className="text-3xl">⚠️</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Match Scenario Not Found</h2>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
              The requested match ID <code className="bg-slate-100 dark:bg-[#101116] px-1.5 py-0.5 rounded text-purple-900 dark:text-[#B8F34A] font-mono">{matchId}</code> could not be found or has expired.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              to="/matches"
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#B8F34A] text-[#101116] hover:bg-[#a6e038] transition-all cursor-pointer shadow-md"
            >
              ← Return to All Matches
            </Link>
            <button
              type="button"
              onClick={() => {
                const fallback = matches[0] || { match_id: 'match_001_comeback' };
                navigate(`/matches/${fallback.match_id}`);
              }}
              className="w-full py-2 px-4 rounded-xl font-medium text-xs bg-slate-100 dark:bg-[#101116] text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#3D195B]/40 hover:bg-slate-200 dark:hover:bg-[#3D195B]/30 transition-all cursor-pointer"
            >
              Watch Featured Match: The Great Comeback
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isFullTime = currentMatchState.status === 'full_time';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#101116] text-slate-900 dark:text-[#F3F4F6] flex flex-col font-sans transition-colors duration-200 selection:bg-[#0050d5] selection:text-white">
      {/* Compact Match Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-[#3D195B]/40 bg-white/95 dark:bg-[#101116]/95 backdrop-blur-md px-4 lg:px-8 py-2.5 transition-colors">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left: Brand + Clear "All matches" navigation link */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2.5">
              <Link
                to="/matches"
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-[#F3F4F6] hover:text-[#3D195B] dark:hover:text-[#B8F34A] bg-white dark:bg-[#20212A] hover:bg-slate-100 dark:hover:bg-[#3D195B]/60 border border-slate-200 dark:border-[#3D195B]/50 rounded-lg transition-colors cursor-pointer shadow-sm"
                title="Return to match selection dashboard"
              >
                <span>←</span>
                <span>All matches</span>
              </Link>

              <div className="h-4 w-px bg-slate-200 dark:bg-[#3D195B]/40 hidden sm:block" />

              {/* Match Name & Team pill */}
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {selectedMatch.name}
                </span>
              </div>
            </div>

            {/* Scoreboard Inset */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#20212A] px-3 py-1 rounded-xl border border-slate-200 dark:border-[#3D195B]/40">
              <span className="text-xs font-semibold text-slate-800 dark:text-gray-300 truncate max-w-[110px]">
                {currentMatchState.home_team}
              </span>
              <span className="text-sm font-mono font-black text-purple-950 dark:text-[#B8F34A] px-1.5 py-0.2 rounded bg-white dark:bg-[#101116] border border-slate-200 dark:border-[#3D195B]/40 shadow-xs">
                {currentMatchState.score.home} - {currentMatchState.score.away}
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-gray-300 truncate max-w-[110px]">
                {currentMatchState.away_team}
              </span>

              {/* Synchronized Minute:Second Clock */}
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-[#101116] px-2.5 py-0.5 rounded border border-slate-200 dark:border-[#3D195B]/40 shadow-xs">
                {String(currentMatchState.minute ?? 0).padStart(2, '0')}:{String(currentMatchState.second ?? 0).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Center / Right: Live Controls + Audience Lens + Theme Toggle + WebSocket Status */}
          <div className="flex items-center gap-2 sm:gap-2.5 w-full md:w-auto justify-end">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                isPlaying
                  ? 'bg-purple-100 dark:bg-[#3D195B] hover:bg-purple-200 dark:hover:bg-[#52237a] text-[#3D195B] dark:text-[#B8F34A] border border-purple-300 dark:border-[#B8F34A]/40'
                  : 'bg-[#B8F34A] hover:bg-[#a6e038] text-[#101116]'
              }`}
            >
              <span>{isPlaying ? '⏸' : '▶'}</span>
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            {/* Jump to Next Key Moment Button */}
            <button
              type="button"
              onClick={() => {
                const nextEv = currentEvents.find(
                  (e) => (e.minute || 0) > (currentMatchState.minute || 0) && (e.type === 'goal' || e.outcome === 'goal' || e.type === 'card' || !!e.card_type || e.type === 'substitution')
                );
                if (nextEv && nextEv.minute) {
                  seek(nextEv.minute);
                } else {
                  seek(Math.min(90, (currentMatchState.minute || 0) + 15));
                }
              }}
              title="Jump directly to the next key moment"
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-[#20212A] hover:bg-slate-200 dark:hover:bg-[#3D195B]/50 text-slate-700 dark:text-gray-300 hover:text-purple-900 dark:hover:text-[#B8F34A] border border-slate-200 dark:border-[#3D195B]/50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>⏭</span>
              <span className="hidden sm:inline">Next Moment</span>
            </button>

            {/* Playback speed selector */}
            <div className="flex items-center bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/50 rounded-lg overflow-hidden text-[11px] font-mono shadow-xs">
              {[1.0, 5.0, 10.0, 20.0].map((spd) => (
                <button
                  key={spd}
                  onClick={() => changeSpeed(spd)}
                  className={`px-2 py-1 transition-colors cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-[#3D195B] text-[#B8F34A] font-bold'
                      : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Live Feed Status */}
            <div
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                isWsConnected
                  ? 'bg-purple-50 dark:bg-[#3D195B]/60 text-purple-900 dark:text-[#B8F34A] border-purple-200 dark:border-[#B8F34A]/40'
                  : 'bg-slate-100 dark:bg-[#20212A] text-slate-500 dark:text-gray-400 border-slate-200 dark:border-[#3D195B]/40'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isWsConnected ? 'bg-emerald-500 dark:bg-[#B8F34A] animate-pulse' : 'bg-gray-400'
                }`}
              />
              <span>{isWsConnected ? 'Feed Synced' : 'Simulating'}</span>
            </div>

            {/* Theme Switcher Toggle */}
            <ThemeToggle />

            {/* Audience Lens Switcher */}
            <ModeToggle currentMode={audienceMode} onModeChange={changeMode} />
          </div>
        </div>

        {/* Sub-bar: Navigation Sections (Overview, Analytics, Pundits, Evidence) */}
        <div className="max-w-[1920px] mx-auto mt-2 pt-2 border-t border-slate-200 dark:border-[#3D195B]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <nav className="flex items-center gap-1" aria-label="Match Centre Sections">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-[#3D195B] text-[#B8F34A] border border-[#B8F34A]/50 shadow-md shadow-[#3D195B]/30'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#20212A]'
              }`}
            >
              <span>🏟️</span>
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-[#3D195B] text-[#B8F34A] border border-[#B8F34A]/50 shadow-md shadow-[#3D195B]/30'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#20212A]'
              }`}
            >
              <span>⚡</span>
              <span>Momentum &amp; Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('pundits')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pundits'
                  ? 'bg-[#3D195B] text-[#B8F34A] border border-[#B8F34A]/50 shadow-md shadow-[#3D195B]/30'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#20212A]'
              }`}
            >
              <span>🎙️</span>
              <span>Pundits</span>
            </button>

            <button
              onClick={() => setActiveTab('evidence')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'evidence'
                  ? 'bg-[#3D195B] text-[#B8F34A] border border-[#B8F34A]/50 shadow-md shadow-[#3D195B]/30'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#20212A]'
              }`}
            >
              <span>🔍</span>
              <span>Story Finder &amp; Evidence</span>
            </button>
          </nav>

          {/* Quick trigger for editorial narrative modal */}
          <button
            type="button"
            onClick={() => setShowPersonalityModal(true)}
            className="text-[11px] font-bold text-purple-900 dark:text-[#B8F34A] bg-white dark:bg-[#20212A] hover:bg-slate-100 dark:hover:bg-[#3D195B]/50 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#3D195B]/50 transition-colors flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0 shadow-xs"
          >
            <span>🏆</span>
            <span>Match Personality Summary</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 lg:px-8 py-4 flex flex-col gap-4">
        {/* Personalization Profile Bar */}
        <ProfileBar
          matchId={selectedMatch.match_id}
          homeTeam={currentMatchState.home_team}
          awayTeam={currentMatchState.away_team}
          mode={audienceMode}
          events={currentEvents}
          currentMinute={currentMatchState.minute}
          onChange={(p) => {
            setLanguage(p.language);
            setViewerProfile(p);
          }}
        />

        {/* TAB 1: OVERVIEW SECTION */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-4">
            {/* Top Grid: 2D Pitch (70%) + Quick Match Stats (30%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-8 flex flex-col relative">
                <OverlayFeed overlays={wsOverlays} language={language} />
                <PitchVisualizer
                  matchId={matchId}
                  lastEvent={currentLastEvent}
                  events={currentEvents}
                  homeTeam={currentMatchState.home_team}
                  awayTeam={currentMatchState.away_team}
                  status={currentMatchState.status}
                  score={currentMatchState.score}
                  favoritePlayer={viewerProfile?.favorite_player || null}
                />
              </div>

              <div className="lg:col-span-4 flex flex-col">
                <MatchStats
                  matchState={currentMatchState}
                  lastEvent={currentLastEvent}
                  isPlaying={isPlaying}
                  playbackSpeed={playbackSpeed}
                  onTogglePlay={togglePlay}
                  onSpeedChange={changeSpeed}
                  onOpenPersonalityModal={() => setShowPersonalityModal(true)}
                  events={currentEvents}
                  onSeek={seek}
                />
              </div>
            </div>

            {/* Interactive Timeline Scrubber & Bundesliga Momentum Wave */}
            <div className="w-full">
              <Timeline
                currentMinute={currentMatchState.minute}
                events={currentEvents}
                onSeek={seek}
                homeTeam={currentMatchState.home_team}
                awayTeam={currentMatchState.away_team}
                maxMinute={90}
                status={currentMatchState.status}
              />
            </div>
          </div>
        )}

        {/* TAB 2: ANALYTICS SECTION */}
        {activeTab === 'analytics' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-2xl p-5 shadow-sm dark:shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-[#3D195B]/40">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Advanced Tactical Analytics & Match Facts
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Derived from 2D coordinates, rolling 5-minute threat matrices, and deterministic event physics.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-purple-900 dark:text-[#B8F34A] bg-slate-100 dark:bg-[#101116] px-2.5 py-1 rounded border border-slate-200 dark:border-[#3D195B]/40">
                  {currentMatchState.home_team} {currentMatchState.score.home} - {currentMatchState.score.away} {currentMatchState.away_team}
                </span>
              </div>

              {/* Full-width MatchCast Match Momentum Time-Series Wave Graph */}
              <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-[#101116] border border-slate-200 dark:border-[#3D195B]/40">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚡</span> Match Momentum &amp; Turning Points
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
                      {currentMatchState.home_team} (Top / Red)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold border border-slate-300 dark:border-white/20">
                      {currentMatchState.away_team} (Bottom / Light)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-gray-400 font-mono">
                    ⚽ Goals &bull; 🟨 Yellows &bull; 🟥 Reds Pinned
                  </div>
                </div>
                <MatchMomentumGraph
                  events={currentEvents}
                  currentMinute={currentMatchState.minute}
                  homeTeam={currentMatchState.home_team}
                  awayTeam={currentMatchState.away_team}
                  height={190}
                />
              </div>

              {/* Detailed Tactical Facts Panels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Attacking Channels */}
                <div className="bg-slate-50 dark:bg-[#101116] rounded-xl p-4 border border-slate-200 dark:border-[#3D195B]/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-[#3D195B] dark:text-[#B8F34A] mb-2 uppercase">
                      <span className="flex items-center gap-1.5">
                        <span>🏹</span> Attacking Channels
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Penetrations</span>
                    </div>

                    <div className="space-y-2 mt-3">
                      <div className="p-2 rounded-lg bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 flex justify-between items-center text-xs">
                        <span className="text-slate-700 dark:text-gray-300">Left Wing</span>
                        <span className="font-mono font-bold text-[#3D195B] dark:text-[#B8F34A]">
                          {currentMatchState.attacking_zones?.home.left.entries ?? 0} entries
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-[#20212A] border border-emerald-300 dark:border-[#B8F34A]/50 flex justify-between items-center text-xs">
                        <span className="text-[#3D195B] dark:text-[#B8F34A] font-bold">Central Corridor</span>
                        <span className="font-mono font-bold text-[#3D195B] dark:text-[#B8F34A]">
                          {currentMatchState.attacking_zones?.home.central.entries ?? 0} entries
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 flex justify-between items-center text-xs">
                        <span className="text-slate-700 dark:text-gray-300">Right Wing</span>
                        <span className="font-mono font-bold text-[#3D195B] dark:text-[#B8F34A]">
                          {currentMatchState.attacking_zones?.home.right.entries ?? 0} entries
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200 dark:border-[#3D195B]/30 text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                    Measures final-third verticality
                  </div>
                </div>

                {/* 2. Goalkeeper Efficiency */}
                <div className="bg-slate-50 dark:bg-[#101116] rounded-xl p-4 border border-slate-200 dark:border-[#3D195B]/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-[#3D195B] dark:text-[#B8F34A] mb-2 uppercase">
                      <span className="flex items-center gap-1.5">
                        <span>🧤</span> Keeper Efficiency
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">xG Prevented</span>
                    </div>

                    <div className="space-y-2 mt-3">
                      <div className="p-2.5 rounded-lg bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-[#F3F4F6]">{currentMatchState.home_team}</div>
                          <div className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                            {currentMatchState.keeper_efficiency?.home.saves ?? 0} saves • {currentMatchState.keeper_efficiency?.home.goals_conceded ?? 0} conceded
                          </div>
                        </div>
                        <span className="font-mono font-bold text-[#3D195B] dark:text-[#B8F34A] text-sm">
                          {(currentMatchState.keeper_efficiency?.home.goals_prevented ?? 0) >= 0 ? '+' : ''}
                          {(currentMatchState.keeper_efficiency?.home.goals_prevented ?? 0).toFixed(2)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-[#F3F4F6]">{currentMatchState.away_team}</div>
                          <div className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                            {currentMatchState.keeper_efficiency?.away.saves ?? 0} saves • {currentMatchState.keeper_efficiency?.away.goals_conceded ?? 0} conceded
                          </div>
                        </div>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                          {(currentMatchState.keeper_efficiency?.away.goals_prevented ?? 0) >= 0 ? '+' : ''}
                          {(currentMatchState.keeper_efficiency?.away.goals_prevented ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200 dark:border-[#3D195B]/30 text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                    Goals Prevented = xG faced - goals conceded
                  </div>
                </div>

                {/* 3. Set-Piece Danger Index */}
                <div className="bg-slate-50 dark:bg-[#101116] rounded-xl p-4 border border-slate-200 dark:border-[#3D195B]/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-[#3D195B] dark:text-[#B8F34A] mb-2 uppercase">
                      <span className="flex items-center gap-1.5">
                        <span>🚩</span> Set-Piece Danger
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Threat Score</span>
                    </div>

                    <div className="space-y-2 mt-3">
                      <div className="p-2.5 rounded-lg bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-[#F3F4F6]">{currentMatchState.home_team}</div>
                          <div className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                            {(currentMatchState.set_piece_threat?.home.cumulative_xg ?? 0).toFixed(2)} cum. xG
                          </div>
                        </div>
                        <span className="font-mono font-bold text-[#3D195B] dark:text-[#B8F34A] text-sm">
                          {Math.round(currentMatchState.set_piece_threat?.home.threat_index ?? 0)}/100
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-[#F3F4F6]">{currentMatchState.away_team}</div>
                          <div className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                            {(currentMatchState.set_piece_threat?.away.cumulative_xg ?? 0).toFixed(2)} cum. xG
                          </div>
                        </div>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                          {Math.round(currentMatchState.set_piece_threat?.away.threat_index ?? 0)}/100
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200 dark:border-[#3D195B]/30 text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                    Combines set-piece entries, shots, and box penetration
                  </div>
                </div>
              </div>

              {/* Rhythm & Control Section */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#3D195B]/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600 dark:text-gray-400 uppercase text-[11px]">Match Game Rhythm:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-[#3D195B]/60 text-purple-900 dark:text-[#B8F34A] border border-purple-200 dark:border-[#B8F34A]/40 font-mono font-bold">
                    {currentMatchState.game_rhythm || 'Balanced Tactical Chess Match'}
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs">
                  <span className="text-[#3D195B] dark:text-[#B8F34A] font-bold">
                    Control: {Math.round(currentMatchState.control_index ?? 55)}%
                  </span>
                  <span className="text-slate-400 dark:text-gray-500">•</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    Chaos: {Math.round(currentMatchState.chaos_index ?? 45)}%
                  </span>
                </div>
              </div>

              {/* Standout Performers & Player Ratings Section */}
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-[#3D195B]/40">
                <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⭐</span>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Standout Performers &amp; Live Player Ratings
                    </h3>
                    <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono hidden sm:inline">
                      (Opta-Style 10.0 Scale • Live Match Telemetry)
                    </span>
                  </div>

                  {playerOfTheMatch && playerOfTheMatch.rating >= 6.8 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                      <span>👑</span>
                      <span>POTM Leader: {playerOfTheMatch.name} ({playerOfTheMatch.rating.toFixed(1)})</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Home Top Performers */}
                  <div className="bg-slate-50 dark:bg-[#101116] rounded-xl p-3.5 border border-slate-200 dark:border-[#3D195B]/40">
                    <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                      <span>{currentMatchState.home_team} • Top Performers</span>
                      <span className="text-[10px] text-slate-400 font-normal">Ranked by match impact</span>
                    </div>
                    <div className="space-y-2">
                      {topHomePlayers.map((p, idx) => (
                        <div
                          key={p.name}
                          className="bg-white dark:bg-[#20212A] p-2.5 rounded-lg border border-slate-200 dark:border-[#3D195B]/40 flex items-center justify-between text-xs shadow-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono text-[11px] text-slate-400 font-bold w-4">
                              #{idx + 1}
                            </span>
                            <div className="truncate">
                              <span className="font-bold text-slate-900 dark:text-[#F3F4F6] block truncate">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono block truncate">
                                {p.summary}
                              </span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${getRatingBadgeClass(p.rating)}`}>
                            {p.rating.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Away Top Performers */}
                  <div className="bg-slate-50 dark:bg-[#101116] rounded-xl p-3.5 border border-slate-200 dark:border-[#3D195B]/40">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                      <span>{currentMatchState.away_team} • Top Performers</span>
                      <span className="text-[10px] text-slate-400 font-normal">Ranked by match impact</span>
                    </div>
                    <div className="space-y-2">
                      {topAwayPlayers.map((p, idx) => (
                        <div
                          key={p.name}
                          className="bg-white dark:bg-[#20212A] p-2.5 rounded-lg border border-slate-200 dark:border-[#3D195B]/40 flex items-center justify-between text-xs shadow-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono text-[11px] text-slate-400 font-bold w-4">
                              #{idx + 1}
                            </span>
                            <div className="truncate">
                              <span className="font-bold text-slate-900 dark:text-[#F3F4F6] block truncate">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono block truncate">
                                {p.summary}
                              </span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${getRatingBadgeClass(p.rating)}`}>
                            {p.rating.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PUNDITS SECTION */}
        {activeTab === 'pundits' && (
          <div className="flex flex-col gap-4">
            <ErrorBoundary fallbackTitle="Studio Pundit Panel">
              <PunditPanel
                currentDebate={currentDebate}
                verificationStats={wsVerificationStats}
                audienceMode={audienceMode}
                lastEvent={currentLastEvent}
                onModeChange={changeMode}
              />
            </ErrorBoundary>
          </div>
        )}

        {/* TAB 4: EVIDENCE & STORY FINDER SECTION */}
        {activeTab === 'evidence' && (
          <div className="flex flex-col gap-4">
            {/* Tactical Data Story Finder Header & Story Cards */}
            <div className="bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-2xl p-5 shadow-sm dark:shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-[#3D195B]/40">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>⚡</span>
                    <span>Deterministic Data Story Finder</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Discovers empirical tactical narratives verified against exact event coordinates and threat deltas.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-blue-700 dark:text-[#B8F34A] bg-slate-100 dark:bg-[#101116] px-2.5 py-1 rounded border border-slate-200 dark:border-[#3D195B]/40">
                  {currentMatchState.active_stories?.length || (currentMatchState.latest_story ? 1 : 0)} Stories Discovered
                </span>
              </div>

              {/* List of active stories or fallback description */}
              {currentMatchState.active_stories && currentMatchState.active_stories.length > 0 ? (
                <div className="space-y-3">
                  {currentMatchState.active_stories.map((story) => (
                    <div
                      key={story.story_id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-[#101116] border border-slate-200 dark:border-[#3D195B]/40"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-blue-700 dark:text-[#B8F34A] uppercase tracking-wide">
                          {story.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono bg-white dark:bg-[#20212A] px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-bold">
                            {story.minute}&apos;
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400">
                            Confidence: {Math.round((story.confidence ?? 0.95) * 100)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed mb-2">
                        {story.description}
                      </p>
                      <div className="text-[10px] text-slate-500 dark:text-gray-400 font-mono flex flex-wrap gap-x-4 gap-y-1">
                        <span>Category: {story.category}</span>
                        <span>Evidence Event IDs: {story.evidence_event_ids?.join(', ') || 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : currentMatchState.latest_story ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#101116] border border-slate-200 dark:border-[#3D195B]/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-blue-700 dark:text-[#B8F34A] uppercase tracking-wide">
                      {currentMatchState.latest_story.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-white dark:bg-[#20212A] px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-bold">
                        {currentMatchState.latest_story.minute}&apos;
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400">
                        Confidence: {Math.round((currentMatchState.latest_story.confidence ?? 0.95) * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed mb-2">
                    {currentMatchState.latest_story.description}
                  </p>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 font-mono flex flex-wrap gap-x-4 gap-y-1">
                    <span>Category: {currentMatchState.latest_story.category}</span>
                    <span>Evidence Event IDs: {currentMatchState.latest_story.evidence_event_ids?.join(', ') || 'N/A'}</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#101116] border border-dashed border-slate-300 dark:border-[#3D195B]/40 text-center py-6">
                  <div className="text-2xl mb-2">🔍</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">
                    Story Finder Active &bull; Monitoring Live Coordinates
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400 max-w-md mx-auto">
                    The deterministic story engine scans rolling 5-minute threat deltas, finishing efficiency, and substitute impacts. Story discoveries will automatically appear here with verified event citations.
                  </p>
                </div>
              )}
            </div>

            {/* Interactive Q&A Panel */}
            <ErrorBoundary fallbackTitle="Ask the Studio Panel">
              <AskPanel
                onAsk={askQuestion}
                currentAnswer={displayedAnswer}
                onClearAnswer={clearAnswer}
                isLoading={isAsking}
                audienceMode={audienceMode}
              />
            </ErrorBoundary>
          </div>
        )}
      </main>

      {/* Full-Time Editorial Modal */}
      <MatchPersonality
        isOpen={showPersonalityModal}
        onClose={handleClosePersonalityModal}
        personality={wsPersonality}
        onSeekToMoment={seek}
        homeTeam={currentMatchState.home_team}
        awayTeam={currentMatchState.away_team}
        score={currentMatchState.score}
      />
    </div>
  );
};
