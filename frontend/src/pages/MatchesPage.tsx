import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMatch } from '../context/MatchContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { Match } from '../types';

export const MatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { matches, selectMatchById, generateLiveMatch } = useMatch();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleWatchMatch = async (matchId: string) => {
    await selectMatchById(matchId);
    navigate(`/matches/${matchId}`);
  };

  const handleGenerateUnscripted = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const live = await generateLiveMatch();
      if (live) {
        await selectMatchById(live.match_id);
        navigate(`/matches/${live.match_id}`);
      } else {
        setGenerateError('Could not generate synthetic match right now. Please select one of the featured matches below.');
      }
    } catch {
      setGenerateError('Connection error during generation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Structured match scenarios with defined scorelines
  const getMatchScenario = (match: Match) => {
    if (match.match_id === 'match_001_comeback') {
      return {
        label: 'Scripted Comeback Thriller',
        scoreline: '3 - 2',
        status: 'Full Time Result',
        keyFact: 'Tactical shift from 4-2-3-1 to 3-4-3 erased a 0-2 half-time deficit with a 90+4\' winner.',
        tag: 'Comeback',
        tagColor: 'text-purple-900 dark:text-[#B8F34A] border-purple-300 dark:border-[#B8F34A]/40 bg-purple-100 dark:bg-[#3D195B]/40',
      };
    }
    if (match.match_id === 'match_002_dominance') {
      return {
        label: 'Tactical Domination Masterclass',
        scoreline: '4 - 0',
        status: 'Full Time Result',
        keyFact: 'High press dismantled low block: 72% possession and 3.42 cumulative xG.',
        tag: 'Domination',
        tagColor: 'text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40',
      };
    }
    if (match.match_id === 'match_003_scrappy_draw') {
      return {
        label: 'High-Tension Contested Draw',
        scoreline: '2 - 2',
        status: 'Full Time Result',
        keyFact: 'Fierce debate trigger: straight red card, controversial penalty, and 88\' equalizer.',
        tag: 'Contested Draw',
        tagColor: 'text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40',
      };
    }
    return {
      label: 'Synthetic Match',
      scoreline: 'Live',
      status: 'On Demand',
      keyFact: match.description || 'Procedural match telemetry and real-time pundit debate.',
      tag: 'Custom',
      tagColor: 'text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/40',
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#101116] text-slate-900 dark:text-[#F3F4F6] flex flex-col font-sans transition-colors duration-200 selection:bg-[#0050d5] selection:text-white">
      {/* Top Header */}
      <header className="w-full border-b border-slate-200 dark:border-[#3D195B]/40 bg-white/95 dark:bg-[#101116]/95 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-[#B8F34A] transition-colors py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#20212A]"
            >
              <span>←</span>
              <span>Home</span>
            </Link>
            <div className="h-4 w-px bg-slate-200 dark:bg-[#3D195B]/40" />
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">MatchCast</span>
              <span className="text-[10px] text-purple-900 dark:text-[#B8F34A] font-mono uppercase bg-purple-100 dark:bg-[#3D195B]/50 px-2 py-0.5 rounded border border-purple-200 dark:border-[#B8F34A]/30">
                Studio
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <ThemeToggle showLabel />
            <div className="hidden sm:flex items-center gap-2 text-slate-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-[#B8F34A]" />
              <span className="font-mono text-[11px]">3 Curated Scenarios Ready</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 lg:py-10 flex flex-col gap-8">
        {/* Title Section */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1.5">
            Match Selection Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 max-w-2xl">
            Select a match scenario to enter the live tactical studio with 2D pitch telemetry, autonomous AI pundit debates, and deterministic fact verification.
          </p>
        </div>

        {/* 3 Featured Matches Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
              Featured Scenarios
            </h2>
            <span className="text-[11px] text-slate-500 dark:text-gray-500 font-mono">Click any match to launch</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {matches.slice(0, 3).map((match) => {
              const scenario = getMatchScenario(match);

              return (
                <div
                  key={match.match_id}
                  className="bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/50 hover:border-purple-300 dark:hover:border-[#B8F34A]/60 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-sm dark:shadow-xl group"
                >
                  <div>
                    {/* Scenario Pill & Category */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${scenario.tagColor}`}>
                        {scenario.tag}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-gray-500 font-mono">{scenario.status}</span>
                    </div>

                    {/* Match Name */}
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#3D195B] dark:group-hover:text-[#B8F34A] transition-colors mb-3">
                      {match.name}
                    </h3>

                    {/* Scoreline & Team Board */}
                    <div className="bg-slate-50 dark:bg-[#101116] rounded-xl p-3.5 border border-slate-200 dark:border-[#3D195B]/40 mb-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800 dark:text-[#F3F4F6] truncate max-w-[180px]">
                          {match.home_team}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-gray-400">HOME</span>
                      </div>

                      <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-white dark:bg-[#20212A]/60 border border-slate-200 dark:border-[#3D195B]/30">
                        <span className="text-[11px] text-slate-500 dark:text-gray-400 font-mono">Scoreline</span>
                        <span className="text-sm font-mono font-black text-purple-900 dark:text-[#B8F34A] tracking-wider">
                          {scenario.scoreline}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800 dark:text-[#F3F4F6] truncate max-w-[180px]">
                          {match.away_team}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-gray-400">AWAY</span>
                      </div>
                    </div>

                    {/* Key Tactical Fact / Description */}
                    <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed mb-4">
                      {scenario.keyFact}
                    </p>
                  </div>

                  {/* Watch Match Button */}
                  <div className="pt-3 border-t border-slate-100 dark:border-[#3D195B]/30">
                    <button
                      type="button"
                      onClick={() => handleWatchMatch(match.match_id)}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#B8F34A] hover:bg-[#a6e038] text-[#101116] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#B8F34A]/20 cursor-pointer"
                    >
                      <span>Watch Match</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Separate On-Demand Match Generation Section */}
        <section
          aria-label="On-Demand Synthetic Generation"
          className="mt-4 pt-6 border-t border-slate-200 dark:border-[#3D195B]/30"
        >
          <div className="bg-white dark:bg-[#15161e] border border-slate-200 dark:border-[#3D195B]/40 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm dark:shadow-none">
            <div className="flex-1 min-w-0 pr-2 sm:pr-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">🎲</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Generate On-Demand Unscripted Match
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
                Need an entirely organic, randomized match? Generate procedural seeds, unscripted goals, referee controversies, and physical ball telemetry on the fly.
              </p>
              {generateError && (
                <p className="text-xs text-rose-500 dark:text-rose-400 mt-2 font-medium">{generateError}</p>
              )}
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateUnscripted}
              className={`
                px-5 py-3 rounded-xl font-bold text-xs whitespace-nowrap transition-all shadow-md flex items-center gap-2 cursor-pointer
                ${
                  isGenerating
                    ? 'bg-purple-100 dark:bg-[#3D195B] text-[#3D195B] dark:text-[#B8F34A] border border-purple-300 dark:border-[#B8F34A]/40 animate-pulse'
                    : 'bg-slate-100 dark:bg-[#20212A] hover:bg-slate-200 dark:hover:bg-[#3D195B]/50 text-slate-800 dark:text-[#F3F4F6] hover:text-[#3D195B] dark:hover:text-[#B8F34A] border border-slate-300 dark:border-[#3D195B]/60'
                }
              `}
            >
              {isGenerating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-[#3D195B] dark:border-[#B8F34A] border-t-transparent rounded-full animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <span>✨ Generate Match</span>
                </>
              )}
            </button>
          </div>
        </section>
      </main>

      {/* Footer Disclaimer */}
      <footer className="w-full border-t border-slate-200 dark:border-[#3D195B]/40 py-4 px-4 text-center text-xs text-slate-500 dark:text-gray-500">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-[11px]">All matches utilize 100% synthetic tactical simulation data.</span>
          <Link to="/" className="text-[11px] text-slate-600 dark:text-gray-400 hover:text-[#3D195B] dark:hover:text-[#B8F34A]">
            Back to Overview
          </Link>
        </div>
      </footer>
    </div>
  );
};
