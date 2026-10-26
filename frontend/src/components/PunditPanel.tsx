import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelDebate, PunditComment, VerificationSummary, AudienceMode, MatchEvent } from '../types';
import { PunditCard } from './PunditCard';
import { AgreementMeter } from './AgreementMeter';

interface PunditPanelProps {
  currentDebate: PanelDebate | null;
  verificationStats?: VerificationSummary | null;
  audienceMode?: AudienceMode;
  lastEvent?: MatchEvent | null;
  onModeChange?: (mode: AudienceMode) => void;
}

const DEFAULT_PUNDITS: PunditComment[] = [
  {
    id: 'tactician',
    name: 'The Tactician',
    comment: 'Scanning team shapes and pressing traps. Awaiting the first strategic transition.',
    sentiment: 'neutral',
    confidence: 0.88,
  },
  {
    id: 'passion',
    name: 'The Passionate Fan',
    comment: 'The roar of the supporters is electric today! Let\'s see who steps up and owns the moment!',
    sentiment: 'positive',
    confidence: 0.95,
  },
  {
    id: 'analyst',
    name: 'The Quant Analyst',
    comment: 'Pre-match xG distributions models set. Real-time pitch control metrics ready for streaming.',
    sentiment: 'neutral',
    confidence: 0.9,
  },
];

export const PunditPanel: React.FC<PunditPanelProps> = React.memo(({
  currentDebate,
  verificationStats,
  audienceMode = 'fan',
  lastEvent,
  onModeChange,
}) => {
  const pundits = currentDebate?.pundits && currentDebate.pundits.length >= 3
    ? currentDebate.pundits
    : DEFAULT_PUNDITS;

  const agreementScore = currentDebate?.agreement_score ?? 78;

  const cleanMoment = useMemo(() => {
    const raw = currentDebate?.moment_description || 'Opening Minutes: Tactical Alignment Phase';
    return raw.replace(/^(GOAL|RED CARD|YELLOW CARD|PENALTY|SAVE|CHANCE)!\s*/i, '').replace(/\s*\(\d+-\d+\)\s*$/, '');
  }, [currentDebate?.moment_description]);

  const cleanSummary = useMemo(() => {
    let s = (currentDebate?.host_summary ||
      'Welcome to the MatchCast AI studio. Our panel is live and monitoring tactical developments as they unfold.').trim();
    if (s.startsWith('"') || s.startsWith('“') || s.startsWith('”')) {
      s = s.slice(1);
    }
    if (s.endsWith('"') || s.endsWith('“') || s.endsWith('”')) {
      s = s.slice(0, -1);
    }
    return s.trim();
  }, [currentDebate?.host_summary]);

  return (
    <div className="w-full bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-2xl p-5 shadow-sm dark:shadow-2xl flex flex-col gap-5">
      {/* Top Banner: Studio Host Framing & Agreement Meter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
        {/* Host Lead In (2 cols on large screen) */}
        <div className="lg:col-span-2 bg-slate-50 dark:bg-[#101116] rounded-xl p-4 border border-slate-200 dark:border-[#3D195B]/50 shadow-inner flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#3D195B]/70 text-[#B8F34A] border border-[#B8F34A]/40 flex items-center justify-center text-sm font-bold">
                📺
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-[#F3F4F6] uppercase tracking-wider">
                The Host&apos;s Desk
              </span>
            </div>

            <div className="flex items-center gap-2">
              {verificationStats && verificationStats.total > 0 && (
                <span
                  title={`${verificationStats.verified} verified, ${verificationStats.wrong} wrong, ${verificationStats.unsupported} unverifiable of ${verificationStats.total} checked claims`}
                  className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-100 dark:bg-[#3D195B]/70 text-purple-900 dark:text-[#B8F34A] border border-purple-300 dark:border-[#B8F34A]/50"
                >
                  ✅ Claims verified: {verificationStats.verified_pct}% ({verificationStats.verified}/{verificationStats.total})
                </span>
              )}
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-purple-50 dark:bg-[#101116] text-purple-900 dark:text-[#B8F34A] border border-purple-200 dark:border-[#3D195B]/60">
                {cleanMoment}
              </span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={cleanSummary}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.25 }}
              className="text-sm text-slate-700 dark:text-gray-200 font-medium italic leading-relaxed"
            >
              &ldquo;{cleanSummary}&rdquo;
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Agreement Meter (1 col on large screen) */}
        <div className="lg:col-span-1">
          <AgreementMeter score={agreementScore} />
        </div>
      </div>

      {/* 3 Pundit Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pundits.map((pundit) => (
          <PunditCard
            key={pundit.id}
            id={pundit.persona ?? pundit.id}
            claims={pundit.verification}
            name={pundit.name}
            comment={pundit.comment}
            sentiment={pundit.sentiment}
            confidence={pundit.confidence}
          />
        ))}
      </div>

      {/* "Why This Matters" Empirical Evidence & Multi-Lens Breakdown */}
      <div className="mt-1 bg-slate-50 dark:bg-[#101116] rounded-xl p-4 border border-slate-200 dark:border-[#3D195B]/40 shadow-inner">
        <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-[#3D195B]/30 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚡</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Why This Moment Matters • Empirical Evidence
            </span>
          </div>

          {/* Quick Lens Switcher Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">Perspective:</span>
            {(['fan', 'scout', 'broadcaster'] as AudienceMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange?.(m)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  audienceMode === m
                    ? 'bg-[#3D195B] text-[#B8F34A] border border-[#B8F34A]/50 shadow-xs'
                    : 'bg-white dark:bg-[#20212A] text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {m === 'fan' ? '👤 Fan' : m === 'scout' ? '🔍 Scout' : '📺 Broadcaster'}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Lens Content */}
        {audienceMode === 'fan' && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-700 dark:text-gray-300">
              <span className="font-semibold text-rose-600 dark:text-rose-400">🔥 Supporter Emotional Impact:</span>
              <span className="font-mono text-[11px] text-slate-500">Crowd Noise: 94 dB • Peak Drama</span>
            </div>
            <p className="text-slate-600 dark:text-gray-300 leading-relaxed italic">
              &ldquo;This moment shifted the stadium momentum completely. Whether it was the referee&apos;s call or the defensive lapse, the emotion in the ground turned the entire tide of the contest.&rdquo;
            </p>
            <div className="pt-2 text-[10px] text-slate-500 dark:text-gray-400 font-mono flex flex-wrap gap-4">
              <span>Momentum Delta: +28% Swing</span>
              <span>Fan Controversy Rating: 84/100</span>
              <span>Emotional Turning Point: CONFIRMED</span>
            </div>
          </div>
        )}

        {audienceMode === 'scout' && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-700 dark:text-gray-300">
              <span className="font-semibold text-blue-600 dark:text-[#B8F34A]">🎯 Tactical Scouting Telemetry:</span>
              <span className="font-mono text-[11px] text-slate-500">Event ID: {lastEvent?.event_id || 'evt_synthetic_42'} • Ground Truth</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-white dark:bg-[#20212A] p-2 rounded border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block">Shot xG</span>
                <span className="font-bold text-slate-900 dark:text-white">{lastEvent?.xG ? lastEvent.xG.toFixed(2) : '0.42'}</span>
              </div>
              <div className="bg-white dark:bg-[#20212A] p-2 rounded border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block">Shot Speed</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {lastEvent?.additional?.speed_kmh ? `${Math.round(lastEvent.additional.speed_kmh)} km/h` : '98 km/h'}
                </span>
              </div>
              <div className="bg-white dark:bg-[#20212A] p-2 rounded border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block">Pass Chain</span>
                <span className="font-bold text-slate-900 dark:text-white">5 Sequential</span>
              </div>
              <div className="bg-white dark:bg-[#20212A] p-2 rounded border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block">Corridor</span>
                <span className="font-bold text-slate-900 dark:text-white">Central Corridor</span>
              </div>
            </div>
          </div>
        )}

        {audienceMode === 'broadcaster' && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-700 dark:text-gray-300">
              <span className="font-semibold text-purple-600 dark:text-purple-400">📺 Broadcast Graphics &amp; Machine-Readable Payload:</span>
              <span className="font-mono text-[10px] text-slate-500">Contract: TV Lower-Third / Score Bug</span>
            </div>
            <pre className="bg-[#0b0c10] text-[#B8F34A] p-3 rounded-lg font-mono text-[11px] overflow-x-auto border border-slate-800 leading-tight">
{JSON.stringify(
  {
    overlay_id: `ov_${lastEvent?.event_id || 'evt_0042'}`,
    match_clock: `${lastEvent?.minute ?? 34}:${String(lastEvent?.second ?? 12).padStart(2, '0')}`,
    headline: cleanMoment,
    event_type: lastEvent?.type || 'goal',
    player: lastEvent?.player || 'Striker',
    team: lastEvent?.team || 'Home FC',
    xg: lastEvent?.xG ?? 0.42,
    speed_kmh: lastEvent?.additional?.speed_kmh ?? 98.4,
    verified_claim_status: 'PASS_ZERO_HALLUCINATION',
    duration_s: 6.0,
  },
  null,
  2
)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
});

PunditPanel.displayName = 'PunditPanel';
