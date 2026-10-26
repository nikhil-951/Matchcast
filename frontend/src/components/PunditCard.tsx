import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Claim, Sentiment } from '../types';

interface PunditCardProps {
  id: string;
  name: string;
  comment: string;
  sentiment: Sentiment;
  confidence: number;
  isActive?: boolean;
  claims?: Claim[];
}

export const PunditCard: React.FC<PunditCardProps> = React.memo(({
  id,
  name,
  comment,
  sentiment,
  confidence,
  claims,
}) => {
  const [displayedText, setDisplayedText] = useState(comment);

  // Typing effect when a new comment arrives
  useEffect(() => {
    if (!comment) {
      setDisplayedText('');
      return;
    }

    let currentIndex = 0;
    setDisplayedText('');

    // Fast typing simulation (15ms per character)
    const interval = setInterval(() => {
      currentIndex++;
      setDisplayedText(comment.slice(0, currentIndex));
      if (currentIndex >= comment.length) {
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [comment]);

  // Visual styling based on pundit id
  const getPunditProfile = (punditId: string) => {
    switch (punditId.toLowerCase()) {
      case 'tactician':
        return {
          icon: '🎙️',
          role: 'Tactical Analyst',
          tagColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          accentBorder: 'hover:border-blue-500/60',
          avatarBg: 'bg-blue-600/20 text-blue-400 border-blue-500/40',
          bubbleBorder: 'border-blue-500/30',
          barColor: 'bg-blue-500',
        };
      case 'passion':
        return {
          icon: '🔥',
          role: 'Fan Voice & Passion',
          tagColor: 'bg-red-500/10 text-red-400 border-red-500/30',
          accentBorder: 'hover:border-red-500/60',
          avatarBg: 'bg-red-600/20 text-red-400 border-red-500/40',
          bubbleBorder: 'border-red-500/30',
          barColor: 'bg-red-500',
        };
      case 'analyst':
      default:
        return {
          icon: '📊',
          role: 'Quantitative Data',
          tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          accentBorder: 'hover:border-emerald-500/60',
          avatarBg: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40',
          bubbleBorder: 'border-emerald-500/30',
          barColor: 'bg-emerald-500',
        };
    }
  };

  const getSentimentBadge = (sent: Sentiment) => {
    switch (sent) {
      case 'excited':
      case 'positive':
        return { label: 'Upbeat / Praise', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'critical':
      case 'concerned':
      case 'incredulous':
      case 'negative':
        return { label: 'Critical / Fiery', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
      case 'neutral':
      default:
        return { label: 'Objective / Measured', color: 'text-gray-300 bg-gray-500/10 border-gray-500/20' };
    }
  };

  const profile = getPunditProfile(id);
  const sentimentBadge = getSentimentBadge(sentiment);
  const confidencePercent = Math.round((confidence || 0.85) * 100);

  // Deduplicate claims by unique key to prevent duplicate badges
  const uniqueClaims = useMemo(() => {
    if (!claims) return [];
    const seen = new Set<string>();
    return claims.filter((c) => {
      const key = `${c.type}-${c.claim}-${c.status}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [claims]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        flex flex-col justify-between h-full bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/50 rounded-2xl p-5 shadow-sm dark:shadow-xl
        transition-all duration-300 hover:shadow-md dark:hover:shadow-2xl hover:border-purple-400 dark:hover:border-[#B8F34A]/50 ${profile.accentBorder}
      `}
    >
      <div>
        {/* Pundit Header (Avatar, Name, Tag) */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border shadow-inner ${profile.avatarBg}`}
            >
              {profile.icon}
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                {name}
              </h4>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${profile.tagColor}`}>
                {profile.role}
              </span>
            </div>
          </div>

          {/* Sentiment Badge */}
          <span className={`text-[10px] font-medium px-2 py-1 rounded-full border ${sentimentBadge.color}`}>
            {sentimentBadge.label}
          </span>
        </div>

        {/* Speech Bubble */}
        <div className={`relative bg-slate-50 dark:bg-[#101116] rounded-xl p-4 border border-slate-200 dark:border-[#3D195B]/40 shadow-inner min-h-[95px]`}>
          {/* Subtle triangle bubble tail */}
          <div className="absolute -top-1.5 left-5 w-3 h-3 bg-slate-50 dark:bg-[#101116] border-t border-l border-slate-200 dark:border-[#3D195B]/50 transform rotate-45" />

          <p className="text-sm text-slate-800 dark:text-[#F3F4F6] leading-relaxed font-normal">
            {displayedText || (
              <span className="italic text-slate-400 dark:text-gray-500">Analyzing latest pitch sequence...</span>
            )}
            {displayedText.length < (comment?.length || 0) && (
              <span className="inline-block w-1.5 h-3.5 ml-1 bg-purple-700 dark:bg-[#B8F34A] animate-pulse" />
            )}
          </p>
        </div>
      </div>

      {/* Verifier: every number quoted is re-computed from the match data */}
      {uniqueClaims.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" data-testid="claim-badges">
          {uniqueClaims.map((c, i) => {
            const style =
              c.status === 'verified'
                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                : c.status === 'wrong'
                ? 'text-red-700 dark:text-red-300 bg-red-500/10 border-red-500/40'
                : 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
            const icon = c.status === 'verified' ? '✅' : c.status === 'wrong' ? '❌' : '⚠️';
            const tip =
              c.status === 'verified'
                ? `Verified against match data (${c.actual ?? ''})`
                : c.status === 'wrong'
                ? `Wrong: match data says ${c.actual ?? 'a different value'}`
                : 'Unverifiable: cannot be derived from this match\'s data';
            return (
              <span key={i} title={tip} className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${style}`}>
                {icon} {c.claim.length > 34 ? c.claim.slice(0, 34) + '…' : c.claim}
              </span>
            );
          })}
        </div>
      )}

      {/* Confidence Meter Footer */}
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-gray-700/50 flex items-center justify-between text-xs">
        <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400">Pundit Conviction</span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${profile.barColor} transition-all duration-500`}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
          <span className="font-mono font-bold text-[11px] text-slate-700 dark:text-gray-300">
            {confidencePercent}%
          </span>
        </div>
      </div>
    </motion.div>
  );
});

PunditCard.displayName = 'PunditCard';
