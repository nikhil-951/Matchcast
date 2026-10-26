import React from 'react';
import { AudienceMode } from '../types';

interface ModeToggleProps {
  currentMode: AudienceMode;
  onModeChange: (mode: AudienceMode) => void;
  disabled?: boolean;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
  currentMode,
  onModeChange,
  disabled = false,
}) => {
  const modes: Array<{
    id: AudienceMode;
    label: string;
    icon: string;
    description: string;
    color: string;
  }> = [
    {
      id: 'fan',
      label: 'Fan',
      icon: '👤',
      description: 'Atmosphere, emotion & passion',
      color: 'from-[#3D195B] to-[#52237a] text-[#B8F34A] border-[#B8F34A]/50',
    },
    {
      id: 'scout',
      label: 'Scout',
      icon: '🔍',
      description: 'Tactical shapes & player traits',
      color: 'from-[#3D195B] to-[#52237a] text-[#B8F34A] border-[#B8F34A]/50',
    },
    {
      id: 'broadcaster',
      label: 'Broadcaster',
      icon: '📺',
      description: 'Narrative storylines & punchy analysis',
      color: 'from-[#3D195B] to-[#52237a] text-[#B8F34A] border-[#B8F34A]/50',
    },
  ];

  return (
    <div className="flex items-center space-x-1.5 bg-[#20212A] p-1 rounded-xl border border-[#3D195B]/60 shadow-inner">
      <div className="hidden sm:block text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-2.5">
        Lens:
      </div>
      {modes.map((mode) => {
        const isActive = currentMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            disabled={disabled}
            onClick={() => onModeChange(mode.id)}
            title={mode.description}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
              ${
                isActive
                  ? `bg-gradient-to-r ${mode.color} border shadow-lg shadow-black/40 font-semibold scale-[1.02]`
                  : 'text-gray-300 hover:text-white hover:bg-[#101116] border border-transparent'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="text-sm">{mode.icon}</span>
            <span>{mode.label}</span>
            {isActive && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B8F34A] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#B8F34A]"></span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
