import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchPersonality as MatchPersonalityType } from '../types';

interface MatchPersonalityProps {
  isOpen: boolean;
  onClose: () => void;
  personality: MatchPersonalityType | null;
  onSeekToMoment?: (minute: number) => void;
  homeTeam: string;
  awayTeam: string;
  score: { home: number; away: number };
}

const DEFAULT_PERSONALITY: MatchPersonalityType = {
  summary:
    'An exhilarating, high-intensity tactical war that shifted dynamically across three distinct phases. Early high pressing was met with composed low-block resilience before dramatic stoppage-time chaos dictated the narrative.',
  tags: [
    '⚡ High Press Clinic',
    '🔥 Counter-Attack Volatility',
    '🛡️ Resilient Low Block',
    '📈 High xG Outlier',
    '🏆 Instant Classic',
  ],
  key_moments: [
    {
      minute: 18,
      description: 'Lightning break down the right channel; low drive saved by the keeper.',
      importance: 'medium',
    },
    {
      minute: 34,
      description: 'Opener: Sensational 22-yard curling strike into the top corner!',
      importance: 'high',
    },
    {
      minute: 56,
      description: 'Heated penalty controversy: studs-up challenge waved away by VAR.',
      importance: 'high',
    },
    {
      minute: 78,
      description: 'Stunning equalizer from range hits crossbar and bounces in.',
      importance: 'high',
    },
    {
      minute: 90,
      description: 'Stoppage time goal-line clearance seals an extraordinary contest.',
      importance: 'medium',
    },
  ],
};

export const MatchPersonality: React.FC<MatchPersonalityProps> = ({
  isOpen,
  onClose,
  personality,
  onSeekToMoment,
  homeTeam,
  awayTeam,
  score,
}) => {
  const data = personality || DEFAULT_PERSONALITY;

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const getMomentBadge = (importance: string) => {
    return importance === 'high'
      ? 'bg-red-500/10 text-red-400 border-red-500/30'
      : 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-pointer"
          onClick={onClose}
        >
          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] cursor-default"
          >
            {/* Header with Title and Close Button */}
            <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-[#101116] border-b border-slate-200 dark:border-[#3D195B]/40">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-[#F3F4F6] tracking-tight">
                    Match Personality & Tactical Narrative
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {homeTeam} {score.home} - {score.away} {awayTeam} • Full Time Review
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#101116] hover:bg-slate-200 dark:hover:bg-[#3D195B]/50 text-slate-600 dark:text-gray-300 hover:text-purple-900 dark:hover:text-[#B8F34A] border border-slate-200 dark:border-[#3D195B]/40 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Narrative Summary */}
              <div>
                <h4 className="text-xs font-bold text-purple-900 dark:text-[#B8F34A] uppercase tracking-wider mb-2">
                  Editorial Analysis
                </h4>
                <div className="bg-slate-50 dark:bg-[#101116] rounded-xl p-4 border border-slate-200 dark:border-[#3D195B]/40">
                  <p className="text-sm text-slate-800 dark:text-[#F3F4F6] leading-relaxed font-normal">
                    {data.summary}
                  </p>
                </div>
              </div>

              {/* Personality Tags */}
              <div>
                <h4 className="text-xs font-bold text-purple-900 dark:text-[#B8F34A] uppercase tracking-wider mb-2.5">
                  Tactical & Emotional DNA
                </h4>
                <div className="flex flex-wrap gap-2">
                  {data.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-[#3D195B]/40 text-purple-900 dark:text-[#B8F34A] border border-purple-200 dark:border-[#B8F34A]/30 shadow-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Key Moments Timeline List */}
              <div>
                <h4 className="text-xs font-bold text-purple-900 dark:text-[#B8F34A] uppercase tracking-wider mb-2.5">
                  Defining Key Moments
                </h4>
                <div className="space-y-2.5">
                  {data.key_moments.map((km, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (onSeekToMoment) {
                          onSeekToMoment(km.minute);
                          onClose();
                        }
                      }}
                      className="group flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#101116] hover:bg-slate-100 dark:hover:bg-[#3D195B]/20 border border-slate-200 dark:border-[#3D195B]/40 hover:border-purple-300 dark:hover:border-[#B8F34A]/50 transition-all cursor-pointer"
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-mono font-bold text-xs text-purple-900 dark:text-[#B8F34A] bg-purple-100 dark:bg-[#3D195B]/40 px-2 py-0.5 rounded border border-purple-300 dark:border-[#B8F34A]/40">
                          {km.minute}&apos;
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getMomentBadge(km.importance)}`}>
                            {km.importance}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-gray-400 group-hover:text-purple-900 dark:group-hover:text-[#B8F34A] transition-colors">
                            Click to jump on timeline →
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-gray-300 leading-normal">
                          {km.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-[#101116] border-t border-slate-200 dark:border-[#3D195B]/40 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#B8F34A] hover:bg-[#a6e038] text-[#101116] shadow-md shadow-[#B8F34A]/20 transition-all cursor-pointer"
              >
                Back to Studio
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
