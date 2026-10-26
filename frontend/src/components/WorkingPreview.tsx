import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export const WorkingPreview: React.FC = () => {
  const [activeFrame, setActiveFrame] = useState(0);

  const frames = [
    {
      minute: "34'",
      title: "Tactical Overload on Right Channel",
      subTitle: "Synthetic City FC transition creates 3v2 half-space overload",
      punditName: "The Tactician",
      punditRole: "Positional Analysis",
      punditAvatar: "🎙️",
      quote: "The opposition double-pivot pressed too high. Look at the right half-space — 3v2 overload created within 2.8 seconds of transition.",
      verifiedText: "Verified via tracking coordinates (x=78.4, y=24.1) • 96% Match Fact Confidence",
      ballPos: { x: 74, y: 32 },
      passPath: "M 48 46 L 74 32",
      xg: "0.42 xG",
      momentum: "+24% Blue FC",
    },
    {
      minute: "63'",
      title: "Formation Pivot: 4-2-3-1 → 3-4-3",
      subTitle: "Tactical change shifts momentum wave into attacking central corridor",
      punditName: "The Quant Analyst",
      punditRole: "Expected Threat & Data Models",
      punditAvatar: "📊",
      quote: "xT skyrocketed from 0.08 to 0.44 following the tactical substitution. Central corridor entries doubled over a rolling 5-minute window.",
      verifiedText: "Verified via deterministic event stream #118 • Zero Hallucination",
      ballPos: { x: 82, y: 50 },
      passPath: "M 60 38 L 82 50",
      xg: "0.78 xG",
      momentum: "+38% Blue FC",
    },
    {
      minute: "88'",
      title: "High-Press Turnover & Equalizer",
      subTitle: "Passionate narrative clash arbitrated by studio consensus engine",
      punditName: "The Passionate Fan",
      punditRole: "Emotional & Dramatic Lens",
      punditAvatar: "🔥",
      quote: "Sheer heart and desire! That high press forced the turnover. You cannot quantify that level of relentless commitment!",
      verifiedText: "Referee decision & turnover verified against simulated physics log",
      ballPos: { x: 91, y: 48 },
      passPath: "M 82 50 L 91 48",
      xg: "0.91 xG",
      momentum: "92% Consensus",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFrame((prev) => (prev + 1) % frames.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [frames.length]);

  const current = frames[activeFrame];

  return (
    <div className="w-full bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/50 rounded-2xl overflow-hidden shadow-md dark:shadow-2xl transition-colors">
      {/* Broadcast Bar Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-[#101116] border-b border-slate-200 dark:border-[#3D195B]/40 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-[#B8F34A]/15 text-[#3D195B] dark:text-[#B8F34A] border border-purple-300 dark:border-[#B8F34A]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-[#B8F34A] animate-pulse" />
            LIVE TELEMETRY PREVIEW
          </span>
          <span className="font-mono text-slate-500 dark:text-gray-400 font-semibold">{current.minute}</span>
          <span className="text-slate-700 dark:text-gray-300 font-bold hidden sm:inline">• {current.title}</span>
        </div>

        {/* Frame indicators */}
        <div className="flex items-center gap-1.5">
          {frames.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveFrame(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeFrame === idx ? 'w-6 bg-[#3D195B] dark:bg-[#B8F34A]' : 'w-2 bg-slate-300 dark:bg-gray-700 hover:bg-slate-400 dark:hover:bg-gray-500'
              }`}
              title={`Jump to frame ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Left: 2D Synthetic Tactical Pitch Preview (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 dark:bg-[#101116] p-4 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-[#3D195B]/40 min-h-[260px]">
          {/* Pitch SVG */}
          <div className="relative w-full aspect-[16/9] bg-[#0c1318] rounded-xl overflow-hidden border border-[#1e3427] shadow-inner">
            <svg viewBox="0 0 100 68" className="w-full h-full select-none">
              {/* Pitch turf base */}
              <rect x="0" y="0" width="100" height="68" fill="#0d1b12" />
              {/* Grass strips */}
              {[0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5].map((x, i) => (
                <rect
                  key={i}
                  x={x}
                  y="0"
                  width="12.5"
                  height="68"
                  fill={i % 2 === 0 ? '#0f2016' : '#0d1b12'}
                  opacity="0.75"
                />
              ))}

              {/* Pitch lines */}
              <rect x="5" y="4" width="90" height="60" fill="none" stroke="#254d33" strokeWidth="0.6" />
              <line x1="50" y1="4" x2="50" y2="64" stroke="#254d33" strokeWidth="0.6" />
              <circle cx="50" cy="34" r="9" fill="none" stroke="#254d33" strokeWidth="0.6" />
              <circle cx="50" cy="34" r="0.8" fill="#254d33" />

              {/* Penalty boxes */}
              <rect x="5" y="16" width="16" height="36" fill="none" stroke="#254d33" strokeWidth="0.6" />
              <rect x="79" y="16" width="16" height="36" fill="none" stroke="#254d33" strokeWidth="0.6" />

              {/* Channels guideline (left, center, right) */}
              <line x1="68" y1="4" x2="68" y2="64" stroke="#3D195B" strokeWidth="0.5" strokeDasharray="1,1" opacity="0.6" />
              <line x1="68" y1="24" x2="95" y2="24" stroke="#3D195B" strokeWidth="0.4" strokeDasharray="1,1" opacity="0.5" />
              <line x1="68" y1="44" x2="95" y2="44" stroke="#3D195B" strokeWidth="0.4" strokeDasharray="1,1" opacity="0.5" />

              {/* Pass vector */}
              <path
                d={current.passPath}
                fill="none"
                stroke="#B8F34A"
                strokeWidth="0.9"
                strokeDasharray="2,1.5"
                className="animate-pulse"
              />

              {/* Players (Home Blue / Away Red) */}
              <circle cx="35" cy="34" r="1.8" fill="#3D195B" stroke="#B8F34A" strokeWidth="0.5" />
              <circle cx="48" cy="46" r="1.8" fill="#3D195B" stroke="#B8F34A" strokeWidth="0.5" />
              <circle cx="62" cy="22" r="1.8" fill="#3D195B" stroke="#B8F34A" strokeWidth="0.5" />
              <circle cx="78" cy="32" r="1.8" fill="#3D195B" stroke="#B8F34A" strokeWidth="0.5" />
              <circle cx="82" cy="50" r="1.8" fill="#3D195B" stroke="#B8F34A" strokeWidth="0.5" />

              {/* Opponent Defenders (Away Graphite / Cool White) */}
              <circle cx="72" cy="26" r="1.8" fill="#20212A" stroke="#F3F4F6" strokeWidth="0.5" />
              <circle cx="75" cy="42" r="1.8" fill="#20212A" stroke="#F3F4F6" strokeWidth="0.5" />
              <circle cx="88" cy="34" r="1.8" fill="#20212A" stroke="#F3F4F6" strokeWidth="0.5" />

              {/* Ball */}
              <motion.circle
                cx={current.ballPos.x}
                cy={current.ballPos.y}
                r="1.4"
                fill="#ffffff"
                stroke="#B8F34A"
                strokeWidth="0.6"
                animate={{ cx: current.ballPos.x, cy: current.ballPos.y }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </svg>

            {/* Overlaid stat pills */}
            <div className="absolute bottom-2 left-2 flex gap-2 text-[10px] font-mono">
              <span className="bg-[#101116]/85 text-[#B8F34A] border border-[#3D195B]/50 px-2 py-0.5 rounded font-bold backdrop-blur">
                {current.xg}
              </span>
              <span className="bg-[#101116]/85 text-purple-300 border border-[#3D195B]/50 px-2 py-0.5 rounded font-bold backdrop-blur">
                {current.momentum}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Autonomous AI Punditry & Fact Verification (5 cols) */}
        <div className="lg:col-span-5 p-5 flex flex-col justify-between bg-slate-50 dark:bg-[#15161e] min-h-[280px]">
          <div>
            {/* Pundit Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{current.punditAvatar}</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">{current.punditName}</h4>
                  <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">{current.punditRole}</span>
                </div>
              </div>

              <span className="text-[10px] uppercase font-bold text-[#3D195B] dark:text-[#B8F34A] bg-purple-100 dark:bg-[#3D195B]/60 border border-purple-200 dark:border-[#B8F34A]/40 px-2 py-0.5 rounded-full">
                Real-Time Lens
              </span>
            </div>

            {/* Commentary Quote */}
            <div className="bg-white dark:bg-[#101116] rounded-xl p-3.5 border border-slate-200 dark:border-[#3D195B]/40 mb-3 shadow-xs min-h-[80px] flex items-center">
              <p className="text-xs text-slate-700 dark:text-[#F3F4F6] italic leading-relaxed font-normal break-words">
                &ldquo;{current.quote}&rdquo;
              </p>
            </div>
          </div>

          {/* Verification Badge */}
          <div className="pt-3 border-t border-slate-200 dark:border-[#3D195B]/40">
            <div className="flex items-start gap-1.5 text-[11px] text-[#3D195B] dark:text-[#B8F34A]">
              <span className="text-sm">✓</span>
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] block">Fact Verification Engine</span>
                <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono leading-tight block">{current.verifiedText}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
