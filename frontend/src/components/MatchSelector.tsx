import React from 'react';
import { motion } from 'framer-motion';
import { Match } from '../types';

interface MatchSelectorProps {
  matches: Match[];
  onSelectMatch: (match: Match) => void;
}

export const MatchSelector: React.FC<MatchSelectorProps> = ({
  matches,
  onSelectMatch,
}) => {
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleGenerateLive = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/match/generate-live', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const liveMatch: Match = {
          match_id: data.match_id,
          name: `${data.home_team} vs ${data.away_team}`,
          home_team: data.home_team,
          away_team: data.away_team,
          theme: 'domination',
          description: 'A dynamically synthesized, unscripted match featuring unpredictable organic goals and tactical momentum.',
        };
        onSelectMatch(liveMatch);
      }
    } catch (e) {
      console.error('Failed to generate live match', e);
    } finally {
      setIsGenerating(false);
    }
  };
  const getThemeStyling = (theme?: string) => {
    switch (theme) {
      case 'dramatic-comeback':
        return {
          gradient: 'from-[#3D195B]/30 via-[#52237a]/20 to-[#B8F34A]/10',
          badgeBg: 'bg-[#3D195B]/60 text-[#B8F34A] border-[#B8F34A]/40',
          accent: 'border-[#3D195B]/50 hover:border-[#B8F34A]/60',
          tag: '⚡ 90+4\' Comeback Thriller',
          stats: { xg: '2.84 vs 1.15', intensity: 'Very High', tension: '98%' },
          bannerIcon: '🔥',
        };
      case 'domination':
        return {
          gradient: 'from-[#3D195B]/30 via-[#52237a]/20 to-[#B8F34A]/10',
          badgeBg: 'bg-[#3D195B]/60 text-[#B8F34A] border-[#B8F34A]/40',
          accent: 'border-[#3D195B]/50 hover:border-[#B8F34A]/60',
          tag: '🎯 High-Press Tactical Clinic',
          stats: { xg: '3.42 vs 0.38', intensity: 'Extreme', tension: '74%' },
          bannerIcon: '⚡',
        };
      case 'gritty-draw':
      default:
        return {
          gradient: 'from-[#3D195B]/30 via-[#52237a]/20 to-[#B8F34A]/10',
          badgeBg: 'bg-[#3D195B]/60 text-[#B8F34A] border-[#B8F34A]/40',
          accent: 'border-[#3D195B]/50 hover:border-[#B8F34A]/60',
          tag: '🛡️ Low-Block Strategic Chess',
          stats: { xg: '1.05 vs 0.95', intensity: 'Physical', tension: '91%' },
          bannerIcon: '⚔️',
        };
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4 py-12 max-w-7xl mx-auto">
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-3xl mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3D195B]/60 border border-[#B8F34A]/40 text-[#B8F34A] text-xs font-semibold mb-4 tracking-wide uppercase">
          <span>🎙️ Premier League AI Panel</span>
          <span>•</span>
          <span>Instant Tactical & Emotional Debate</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
          Select a Match to <span className="bg-gradient-to-r from-white via-[#F3F4F6] to-[#B8F34A] bg-clip-text text-transparent">Analyze & Debate</span>
        </h1>

        <p className="text-gray-400 text-base md:text-lg leading-relaxed">
          Three specialized AI pundits — The Tactician, The Passionate Fan, and The Quant Analyst — dissect every key turn of events in real time.
        </p>
      </motion.div>

      {/* Dynamic Unscripted Match Generator Trigger (Data Innovation 4.1.v) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-2xl mb-8 flex justify-center"
      >
        <button
          type="button"
          disabled={isGenerating}
          onClick={handleGenerateLive}
          className={`
            w-full flex items-center justify-between gap-4 px-6 py-4 rounded-2xl font-bold text-sm transition-all shadow-2xl cursor-pointer
            ${isGenerating
              ? 'bg-[#3D195B]/60 text-[#B8F34A] border border-[#B8F34A]/50 animate-pulse'
              : 'bg-gradient-to-r from-[#3D195B] via-[#52237a] to-[#29103e] hover:from-[#52237a] hover:to-[#3D195B] text-white border border-[#B8F34A]/50 shadow-lg shadow-[#3D195B]/40 hover:scale-[1.01]'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎲</span>
            <div className="text-left">
              <div className="font-extrabold text-sm tracking-wide flex items-center gap-2">
                <span>{isGenerating ? 'Synthesizing Live Unscripted Match...' : 'Generate Live Unscripted Match'}</span>
                <span className="text-[10px] bg-[#B8F34A] text-[#101116] px-2 py-0.5 rounded-full font-bold uppercase">On-Demand Engine</span>
              </div>
              <div className="text-xs font-normal text-purple-200 opacity-90">
                Randomized seeds, unscripted scorelines, and organic set pieces generated on the fly
              </div>
            </div>
          </div>
          <span className="text-xl">✨</span>
        </button>
      </motion.div>

      {/* 3 Match Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {matches.map((match, idx) => {
          const theme = getThemeStyling(match.theme);

          return (
            <motion.div
              key={match.match_id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              onClick={() => onSelectMatch(match)}
              className={`
                group relative flex flex-col justify-between overflow-hidden rounded-2xl
                bg-[#20212A] border ${theme.accent} p-6 shadow-xl shadow-black/50
                transition-all duration-300 cursor-pointer
              `}
            >
              {/* Background gradient flare */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-20 group-hover:opacity-35 transition-opacity duration-300`}
              />

              {/* Top Row: Theme tag & Icon */}
              <div className="relative z-10 flex items-center justify-between mb-4">
                <span
                  className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${theme.badgeBg}`}
                >
                  {theme.tag}
                </span>
                <span className="text-2xl">{theme.bannerIcon}</span>
              </div>

              {/* Match Title & Teams */}
              <div className="relative z-10 mb-6">
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-[#B8F34A] transition-colors">
                  {match.name}
                </h3>

                <div className="bg-[#101116]/80 rounded-xl p-3.5 border border-[#3D195B]/40 mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#B8F34A] shadow-sm shadow-[#B8F34A]/50" />
                      <span className="text-sm font-semibold text-gray-200">{match.home_team}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">HOME</span>
                  </div>

                  <div className="h-px bg-[#3D195B]/40" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
                      <span className="text-sm font-semibold text-gray-200">{match.away_team}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">AWAY</span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                  {match.description}
                </p>
              </div>

              {/* Stats badges */}
              <div className="relative z-10 pt-4 border-t border-[#3D195B]/40 mb-5">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#101116]/60 p-2 rounded-lg border border-[#3D195B]/40">
                    <div className="text-[10px] text-gray-400 font-mono uppercase">xG Projection</div>
                    <div className="text-xs font-bold text-gray-200 font-mono mt-0.5">{theme.stats.xg}</div>
                  </div>
                  <div className="bg-[#101116]/60 p-2 rounded-lg border border-[#3D195B]/40">
                    <div className="text-[10px] text-gray-400 font-mono uppercase">Intensity</div>
                    <div className="text-xs font-bold text-[#B8F34A] font-mono mt-0.5">{theme.stats.intensity}</div>
                  </div>
                  <div className="bg-[#101116]/60 p-2 rounded-lg border border-[#3D195B]/40">
                    <div className="text-[10px] text-gray-400 font-mono uppercase">Debate Index</div>
                    <div className="text-xs font-bold text-purple-300 font-mono mt-0.5">{theme.stats.tension}</div>
                  </div>
                </div>
              </div>

              {/* Launch Button */}
              <div className="relative z-10">
                <button
                  type="button"
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-[#3D195B] to-[#52237a] hover:from-[#52237a] hover:to-[#3D195B] text-[#B8F34A] border border-[#B8F34A]/40 shadow-lg shadow-[#3D195B]/40 transition-all duration-200 flex items-center justify-center gap-2 group-hover:scale-[1.02] cursor-pointer"
                >
                  <span>Launch Match Studio</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Feature teaser footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-12 flex flex-wrap items-center justify-center gap-8 text-xs text-gray-400 font-medium"
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-400">⚡</span> Live 2D SVG Pitch Events
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400">🎙️</span> 3 Autonomous AI Pundits
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-400">📊</span> Real-time Agreement Meter
        </div>
        <div className="flex items-center gap-2">
          <span className="text-purple-400">💬</span> Interactive Q&A Panel
        </div>
      </motion.div>
    </div>
  );
};
