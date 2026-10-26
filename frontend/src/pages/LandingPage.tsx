import React from 'react';
import { Link } from 'react-router-dom';
import { WorkingPreview } from '../components/WorkingPreview';
import { ThemeToggle } from '../components/ThemeToggle';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#101116] text-slate-900 dark:text-[#F3F4F6] flex flex-col font-sans transition-colors duration-200 selection:bg-[#0050d5] selection:text-white">
      {/* Top Navigation */}
      <nav className="w-full border-b border-slate-200 dark:border-[#3D195B]/40 bg-white/95 dark:bg-[#101116]/95 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#3D195B] via-[#52237a] to-[#29103e] shadow-md shadow-[#3D195B]/40 border border-[#B8F34A]/40 group-hover:scale-105 transition-transform">
              <span className="text-lg select-none">⚽</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-[#F3F4F6]">MatchCast</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Independent Sports Analytics Studio</p>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-slate-600 dark:text-gray-400 bg-slate-100 dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B8F34A]" />
              100% Synthetic Event Data
            </span>
            <ThemeToggle showLabel />
            <Link
              to="/matches"
              className="px-4 py-2 text-xs font-bold rounded-xl bg-[#B8F34A] text-[#101116] hover:bg-[#a6e038] transition-all shadow-md shadow-[#B8F34A]/20 cursor-pointer"
            >
              Explore Matches →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14 flex flex-col gap-12">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          {/* Category Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-[#3D195B]/60 border border-purple-200 dark:border-[#B8F34A]/30 text-[#3D195B] dark:text-[#B8F34A] text-xs font-semibold mb-4 tracking-wide">
            <span>Deterministic Analytics</span>
            <span>•</span>
            <span>Multi-Agent AI Studio</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white mb-4 leading-tight">
            Every match has a story.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-900 via-[#3D195B] to-emerald-600 dark:from-white dark:via-[#F3F4F6] dark:to-[#B8F34A]">
              Show the evidence.
            </span>
          </h1>

          {/* Product Explanation Paragraph */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-gray-300 leading-relaxed max-w-2xl mb-8 font-normal">
            MatchCast AI transforms raw match events into real-time tactical narratives. Three autonomous AI pundits with distinct analytical lenses debate every critical turning point, grounded in deterministic story discovery and zero-hallucination fact verification.
          </p>

          {/* Primary Call to Action */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Link
              to="/matches"
              className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold rounded-xl bg-[#B8F34A] text-[#101116] hover:bg-[#a6e038] transition-all shadow-xl shadow-[#B8F34A]/25 text-center cursor-pointer hover:scale-[1.02]"
            >
              Explore Matches
            </Link>
            <a
              href="#pillars"
              className="w-full sm:w-auto px-6 py-3.5 text-sm font-medium rounded-xl bg-white dark:bg-[#20212A] text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#3D195B]/50 hover:bg-slate-100 dark:hover:bg-[#3D195B]/40 transition-all text-center"
            >
              How It Works ↓
            </a>
          </div>
        </div>

        {/* Genuine Working Preview Widget */}
        <section aria-label="Interactive Match Telemetry Preview" className="w-full max-w-5xl mx-auto">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#3D195B] dark:text-[#B8F34A]">
              Working Studio Telemetry Preview
            </span>
            <span className="font-mono text-[11px]">Synthetic Match Sample #001</span>
          </div>
          <WorkingPreview />
        </section>

        {/* Three Core Pillars Section */}
        <section id="pillars" className="w-full max-w-5xl mx-auto pt-6 border-t border-slate-200 dark:border-[#3D195B]/30">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">The Three Analytical Pillars</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 max-w-xl mx-auto">
              Built on mathematical thresholds, positional coordinates, and multi-perspective pundit arbitration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {/* Pillar 1: Deterministic Story Detection */}
            <div className="bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-xl p-6 flex flex-col justify-between shadow-sm dark:shadow-none min-h-[240px]">
              <div>
                <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-[#3D195B]/40 border border-purple-200 dark:border-[#B8F34A]/40 flex items-center justify-center text-lg mb-3">
                  🔍
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  Deterministic Story Detection
                </h3>
                <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed mb-4">
                  Algorithms continuously monitor a rolling 5-minute event window for decisive tactical patterns: Finishing Woes, Super-Sub Impact, Smash &amp; Grab, Midfield Metronome, and Territorial Collapse.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-[#3D195B]/30 text-[11px] text-[#3D195B] dark:text-[#B8F34A] font-mono">
                Mathematical triggers • No manufactured drama
              </div>
            </div>

            {/* Pillar 2: Multi-Agent AI Commentary */}
            <div className="bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-xl p-6 flex flex-col justify-between shadow-sm dark:shadow-none min-h-[240px]">
              <div>
                <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-[#3D195B]/40 border border-purple-200 dark:border-[#B8F34A]/40 flex items-center justify-center text-lg mb-3">
                  🎙️
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  Multi-Agent AI Commentary
                </h3>
                <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed mb-4">
                  Three autonomous personas with distinct analytical lenses debate every critical turning point: The Tactician dissects shapes and overloads; The Passionate Fan voices raw emotion; The Quant Analyst anchors in xG, xT, and shot velocity.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-[#3D195B]/30 text-[11px] text-[#3D195B] dark:text-[#B8F34A] font-mono">
                Host arbitration • Real-time consensus meter
              </div>
            </div>

            {/* Pillar 3: Fact Verification */}
            <div className="bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-xl p-6 flex flex-col justify-between shadow-sm dark:shadow-none min-h-[240px]">
              <div>
                <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-[#3D195B]/40 border border-purple-200 dark:border-[#B8F34A]/40 flex items-center justify-center text-lg mb-3">
                  🛡️
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  Zero-Hallucination Fact Verification
                </h3>
                <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed mb-4">
                  Every pundit argument and broadcast lower-third is checked against deterministic ground-truth coordinates, official event IDs, and shot trajectory physics before delivery to viewers.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-[#3D195B]/30 text-[11px] text-[#3D195B] dark:text-[#B8F34A] font-mono">
                Verified citations • Auditable evidence log
              </div>
            </div>
          </div>
        </section>

        {/* Clear Synthetic & Non-Endorsement Notice */}
        <section className="w-full max-w-5xl mx-auto mt-4 p-4 rounded-xl bg-slate-100 dark:bg-[#101116] border border-slate-200 dark:border-[#3D195B]/40 text-xs text-slate-600 dark:text-gray-400">
          <div className="flex items-start gap-2.5">
            <span className="text-base text-purple-700 dark:text-[#B8F34A]">ℹ️</span>
            <div className="space-y-1">
              <span className="font-bold text-slate-800 dark:text-gray-300 uppercase tracking-wide text-[10px] block">
                Research & Synthetic Compliance Notice
              </span>
              <p className="text-[11px] leading-relaxed">
                All players, clubs, tracking coordinates, and match events are 100% algorithmically synthesized for academic and technical demonstration purposes. MatchCast AI is an independent project and is not affiliated with, sponsored by, or endorsed by the Premier League or any real-world football organization.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-[#3D195B]/40 py-6 px-4 text-center text-xs text-slate-500 dark:text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>MatchCast AI — Independent Sports Telemetry &amp; AI Punditry Studio</span>
          <div className="flex items-center gap-4 text-slate-500 dark:text-gray-400">
            <Link to="/matches" className="hover:text-[#3D195B] dark:hover:text-[#B8F34A] transition-colors">
              Match Dashboard
            </Link>
            <span>•</span>
            <span className="font-mono text-[10px]">Azure F1 Free Tier Hosted</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
