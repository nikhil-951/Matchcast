import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Overlay } from '../types';

interface OverlayFeedProps {
  overlays: Overlay[];
  language: 'en' | 'hi' | 'es';
}

const STYLES: Record<string, { icon: string; classes: string }> = {
  goal: { icon: '⚽', classes: 'bg-amber-500/90 text-black border-amber-300' },
  card: { icon: '🟨', classes: 'bg-yellow-400/90 text-black border-yellow-200' },
  substitution: { icon: '🔄', classes: 'bg-indigo-600/90 text-white border-indigo-300' },
  shot_speed: { icon: '💥', classes: 'bg-cyan-600/90 text-white border-cyan-300' },
  pass_quality: { icon: '🎯', classes: 'bg-fuchsia-600/90 text-white border-fuchsia-300' },
  player_tag: { icon: '👤', classes: 'bg-slate-800/90 text-white border-slate-500' },
};

/**
 * Broadcast-style lower-thirds rendered from the machine-readable overlay stream.
 * Each overlay arrives as JSON (type, clock, duration, text in en/hi/es, payload).
 */
export const OverlayFeed: React.FC<OverlayFeedProps> = ({ overlays, language }) => {
  const visible = [...overlays].sort((a, b) => b.priority - a.priority).slice(0, 4);

  return (
    <div
      className="pointer-events-none absolute bottom-4 left-4 z-20 flex w-[min(440px,92%)] flex-col gap-2"
      aria-live="polite"
      data-testid="overlay-feed"
    >
      <AnimatePresence initial={false}>
        {visible.map((o) => {
          const style = STYLES[o.type] ?? STYLES.player_tag;
          const card =
            o.type === 'card' && String(o.payload?.card) === 'red'
              ? 'bg-red-600/90 text-white border-red-300'
              : style.classes;
          return (
            <motion.div
              key={o.id}
              layout
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold shadow-lg backdrop-blur ${card} ${
                o.highlight ? 'ring-2 ring-white' : ''
              }`}
            >
              <span aria-hidden>{style.icon}</span>
              <span className="truncate">{o.text[language] ?? o.text.en}</span>
              <span className="ml-auto font-mono text-[10px] opacity-80">{o.match_clock}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
