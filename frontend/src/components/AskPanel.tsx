import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelAnswer, AudienceMode } from '../types';

interface AskPanelProps {
  onAsk: (question: string) => Promise<PanelAnswer | null>;
  currentAnswer: PanelAnswer | null;
  onClearAnswer?: () => void;
  isLoading: boolean;
  audienceMode: AudienceMode;
}

export const AskPanel: React.FC<AskPanelProps> = React.memo(({
  onAsk,
  currentAnswer,
  onClearAnswer,
  isLoading,
  audienceMode,
}) => {
  const [question, setQuestion] = useState('');
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const suggestedQuestions = [
    'Should the manager change formation to exploit the wide channels?',
    'Was that challenge worthy of a red card in today\'s rules?',
    'Which player is driving the highest expected threat (xT)?',
    'How can the home team unlock this stubborn low defensive block?',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;
    setErrorMessage(null);
    try {
      const q = question.trim();
      const res = await onAsk(q);
      if (!res) {
        setErrorMessage('The studio panel took longer than expected to formulate a response. Please retry in a moment.');
      } else {
        setQuestion('');
      }
    } catch {
      setErrorMessage('Studio connection disrupted. Please retry your question.');
    }
  };

  const handlePickSuggested = async (suggested: string) => {
    if (isLoading) return;
    setErrorMessage(null);
    setActivePrompt(suggested);
    try {
      const res = await onAsk(suggested);
      if (!res) {
        setErrorMessage('The studio panel could not formulate consensus. Please retry.');
      }
    } catch {
      setErrorMessage('Studio connection disrupted. Please retry.');
    } finally {
      setActivePrompt(null);
    }
  };

  const getPunditBadge = (punditId?: string) => {
    const key = String(punditId || '').toLowerCase();
    switch (key) {
      case 'tactician':
        return {
          icon: '🎙️',
          name: 'The Tactician',
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
        };
      case 'passion':
        return {
          icon: '🔥',
          name: 'The Passionate Fan',
          color: 'text-red-400 bg-red-500/10 border-red-500/30',
        };
      case 'analyst':
      default:
        return {
          icon: '📊',
          name: 'The Quant Analyst',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        };
    }
  };

  return (
    <div className="w-full bg-white dark:bg-[#20212A] border border-slate-200 dark:border-[#3D195B]/40 rounded-2xl p-5 shadow-sm dark:shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-[#3D195B]/30 text-purple-900 dark:text-[#B8F34A] border border-purple-200 dark:border-[#3D195B]/60 flex items-center justify-center text-sm font-bold">
            💬
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-[#F3F4F6] uppercase tracking-wider">
              Ask the Studio Panel
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-gray-400">
              Pose tactical or controversial questions answered tailored to your{' '}
              <span className="text-purple-900 dark:text-[#B8F34A] font-semibold uppercase">{audienceMode}</span> perspective
            </p>
          </div>
        </div>

        {currentAnswer && onClearAnswer && (
          <button
            type="button"
            onClick={onClearAnswer}
            className="text-xs text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-[#F3F4F6] px-2.5 py-1 rounded bg-slate-100 dark:bg-[#101116] border border-slate-200 dark:border-[#3D195B]/40 hover:bg-slate-200 dark:hover:bg-[#3D195B]/30 transition-colors cursor-pointer"
          >
            Clear Discussion
          </button>
        )}
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">Quick Prompts:</span>
        {suggestedQuestions.map((q, idx) => {
          const isThisLoading = isLoading && activePrompt === q;
          return (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handlePickSuggested(q)}
              className={`
                text-xs rounded-lg px-2.5 py-1 transition-all cursor-pointer truncate max-w-[280px] border flex items-center gap-1.5
                ${
                  isThisLoading
                    ? 'bg-purple-100 dark:bg-[#3D195B]/40 border-purple-400 dark:border-[#B8F34A]/60 text-purple-900 dark:text-[#B8F34A] animate-pulse'
                    : isLoading
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-[#101116] border-slate-200 dark:border-[#3D195B]/30 text-slate-400 dark:text-gray-500'
                    : 'text-slate-700 dark:text-gray-300 hover:text-purple-900 dark:hover:text-[#B8F34A] bg-slate-100 dark:bg-[#101116] hover:bg-slate-200 dark:hover:bg-[#3D195B]/40 border-slate-200 dark:border-[#3D195B]/40 hover:border-purple-300 dark:hover:border-[#B8F34A]/50'
                }
              `}
            >
              {isThisLoading && (
                <span className="w-2.5 h-2.5 border-2 border-purple-900 dark:border-[#B8F34A] border-t-transparent rounded-full animate-spin" />
              )}
              <span>&ldquo;{q}&rdquo;</span>
            </button>
          );
        })}
      </div>

      {/* Input Field & Submit Button */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask the pundits anything about strategy, fouls, xG, or momentum..."
            disabled={isLoading}
            className="w-full bg-slate-50 dark:bg-[#101116] text-slate-900 dark:text-[#F3F4F6] placeholder-slate-400 dark:placeholder-gray-500 text-sm rounded-xl px-4 py-3 border border-slate-300 dark:border-[#3D195B]/60 focus:outline-none focus:border-purple-600 dark:focus:border-[#B8F34A] focus:ring-1 focus:ring-purple-600 dark:focus:ring-[#B8F34A] transition-colors disabled:opacity-60"
          />
          {isLoading && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs text-purple-900 dark:text-[#B8F34A] font-mono">
              <span className="w-4 h-4 border-2 border-purple-900 dark:border-[#B8F34A] border-t-transparent rounded-full animate-spin" />
              <span>Studio deliberating...</span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!question.trim() || isLoading}
          className={`
            px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition-all
            ${
              question.trim() && !isLoading
                ? 'bg-[#B8F34A] hover:bg-[#a6e038] text-[#101116] font-bold shadow-md shadow-[#B8F34A]/20 cursor-pointer hover:scale-[1.02]'
                : isLoading
                ? 'bg-[#3D195B] text-[#B8F34A] cursor-wait border border-[#B8F34A]/40'
                : 'bg-slate-100 dark:bg-[#101116] text-slate-400 dark:text-gray-500 cursor-not-allowed border border-slate-200 dark:border-[#3D195B]/40'
            }
          `}
        >
          {isLoading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-[#B8F34A] border-t-transparent rounded-full animate-spin" />
              <span>Debating...</span>
            </>
          ) : (
            <>
              <span>Send</span>
              <span>→</span>
            </>
          )}
        </button>
      </form>

      {/* Error / Warning Alert */}
      {errorMessage && (
        <div className="mt-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-slate-400 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white text-xs px-1.5 py-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Display Answer Section */}
      <AnimatePresence>
        {currentAnswer && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mt-5 pt-4 border-t border-slate-200 dark:border-[#3D195B]/40 space-y-4"
          >
            {/* Host summary of the response */}
            <div className="bg-slate-50 dark:bg-[#101116] rounded-xl p-3.5 border border-slate-200 dark:border-[#3D195B]/50">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-[#B8F34A] uppercase tracking-wider mb-1">
                <span>🎙️</span>
                <span>The Host Addresses: &ldquo;{currentAnswer.question}&rdquo;</span>
              </div>
              <p className="text-sm text-slate-800 dark:text-[#F3F4F6] leading-relaxed italic">
                {currentAnswer.host_summary}
              </p>
            </div>

            {/* Answers from each pundit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(currentAnswer.answers || []).map((ans: any, idx: number) => {
                const punditId = ans.pundit_id || ans.persona || ans.id || 'analyst';
                const answerText = ans.answer || ans.comment || '';
                const punditName = ans.name || '';
                const badge = getPunditBadge(punditId);
                return (
                  <div
                    key={idx}
                    className="bg-slate-50 dark:bg-[#101116] border border-slate-200 dark:border-[#3D195B]/50 rounded-xl p-3.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">{badge.icon}</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-[#F3F4F6]">
                          {punditName || badge.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed">
                        {answerText}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

AskPanel.displayName = 'AskPanel';
