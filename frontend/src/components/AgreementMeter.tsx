import React from 'react';
import { motion } from 'framer-motion';

interface AgreementMeterProps {
  score: number; // 0 to 100
}

export const AgreementMeter: React.FC<AgreementMeterProps> = ({ score }) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  const getMeterConfig = (val: number) => {
    if (val < 40) {
      return {
        label: 'Pundits Disagree! 🔥',
        sublabel: 'Heated Debate in Studio',
        color: 'from-red-600 to-rose-500',
        badgeBg: 'bg-red-500/15 text-red-400 border-red-500/30',
        glow: 'glow-red',
      };
    }
    if (val <= 70) {
      return {
        label: 'Mixed Views ⚖️',
        sublabel: 'Divergent Perspectives',
        color: 'from-amber-500 to-yellow-400',
        badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        glow: 'glow-amber',
      };
    }
    return {
      label: 'Consensus ✓',
      sublabel: 'Panel In Total Agreement',
      color: 'from-[#3D195B] via-[#632497] to-[#B8F34A]',
      badgeBg: 'bg-[#3D195B]/40 text-[#B8F34A] border-[#B8F34A]/40',
      glow: 'glow-green',
    };
  };

  const config = getMeterConfig(clampedScore);

  return (
    <div className="bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-xl p-4 shadow-sm dark:shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 dark:text-[#F3F4F6] uppercase tracking-wider">
            Agreement Meter
          </span>
          <span className="text-[10px] text-slate-500 dark:text-gray-400 hidden md:inline">
            • Real-time consensus alignment
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${config.badgeBg}`}>
            {config.label}
          </span>
          <span className="font-mono font-bold text-sm text-slate-900 dark:text-[#F3F4F6]">
            {clampedScore}%
          </span>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="relative w-full h-3 bg-slate-200 dark:bg-[#101116] rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-[#3D195B]/50">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${config.color}`}
          initial={{ width: '0%' }}
          animate={{ width: `${clampedScore}%` }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        />
      </div>

      {/* Ticks and scale */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-gray-400 font-mono mt-1.5 px-0.5">
        <span className="text-red-500 dark:text-red-400/80">0% Polarized</span>
        <span className="text-amber-600 dark:text-amber-400/80">50% Split</span>
        <span className="text-emerald-600 dark:text-[#B8F34A]/90">100% Unanimous</span>
      </div>
    </div>
  );
};
