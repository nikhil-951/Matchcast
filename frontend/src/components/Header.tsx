import React from 'react';
import { AudienceMode } from '../types';
import { ModeToggle } from './ModeToggle';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  currentMode: AudienceMode;
  onModeChange: (mode: AudienceMode) => void;
  selectedMatchName?: string;
  onBackToMatches?: () => void;
  isWsConnected: boolean;
  isPlaying?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onModeChange,
  selectedMatchName,
  onBackToMatches,
  isWsConnected,
  isPlaying,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-[#3D195B]/40 bg-white/95 dark:bg-[#101116]/95 backdrop-blur-md px-4 lg:px-8 py-3 transition-colors">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-[1920px] mx-auto">
        {/* Left: Brand & Match info */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-3">
            {/* Logo Icon */}
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#3D195B] via-[#52237a] to-[#29103e] shadow-md shadow-[#3D195B]/50 border border-[#B8F34A]/40">
              <span className="text-xl select-none">⚽</span>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#B8F34A] border-2 border-[#101116] rounded-full animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  MatchCast
                </span>
                {isPlaying && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-[#B8F34A]/20 text-emerald-800 dark:text-[#B8F34A] border border-emerald-300 dark:border-[#B8F34A]/40 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-[#B8F34A]"></span>
                    LIVE FEED
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">
                Premier League AI Pundit Studio
              </p>
            </div>
          </div>

          {selectedMatchName && onBackToMatches && (
            <div className="flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-[#3D195B]/40">
              <button
                onClick={onBackToMatches}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-[#F3F4F6] hover:text-[#3D195B] dark:hover:text-[#B8F34A] bg-slate-100 dark:bg-[#20212A] hover:bg-slate-200 dark:hover:bg-[#3D195B]/60 border border-slate-300 dark:border-[#3D195B]/50 rounded-lg transition-colors cursor-pointer"
                title="Return to match catalog"
              >
                <span>←</span>
                <span className="hidden md:inline">Change Match</span>
              </button>
              <span className="hidden lg:inline text-xs text-purple-900 dark:text-[#B8F34A]/90 font-semibold truncate max-w-xs">
                {selectedMatchName}
              </span>
            </div>
          )}
        </div>

        {/* Right: Theme Toggle + Connection status & Audience Mode */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Connection Pill */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              isWsConnected
                ? 'bg-purple-100 dark:bg-[#3D195B]/60 text-purple-900 dark:text-[#B8F34A] border-purple-200 dark:border-[#B8F34A]/40'
                : 'bg-slate-100 dark:bg-[#20212A] text-slate-600 dark:text-gray-300 border-slate-200 dark:border-[#3D195B]/40'
            }`}
            title={isWsConnected ? 'Connected to live stream WebSocket' : 'Standalone / Simulation standby'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isWsConnected ? 'bg-emerald-500 dark:bg-[#B8F34A] animate-pulse' : 'bg-gray-400'
              }`}
            />
            <span>{isWsConnected ? 'Feed Synced' : 'Ready'}</span>
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Audience Mode Switcher */}
          <ModeToggle
            currentMode={currentMode}
            onModeChange={onModeChange}
          />
        </div>
      </div>
    </header>
  );
};
