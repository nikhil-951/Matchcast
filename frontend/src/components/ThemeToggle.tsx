import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ showLabel = false, className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border
        ${
          isDark
            ? 'bg-[#20212A] hover:bg-[#3D195B]/60 text-yellow-300 hover:text-white border-[#3D195B]/60 shadow-sm'
            : 'bg-white hover:bg-slate-100 text-[#3D195B] hover:text-[#52237a] border-slate-300 shadow-sm'
        }
        ${className}
      `}
    >
      <span className="text-sm select-none" aria-hidden="true">
        {isDark ? '☀️' : '🌙'}
      </span>
      {showLabel && (
        <span className="text-[11px] font-medium tracking-tight">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
};
