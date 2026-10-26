import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useMatchState, DEFAULT_MATCHES } from '../hooks/useMatchState';
import { useWebSocket } from '../hooks/useWebSocket';
import { getVisitorSessionId } from '../utils/session';
import {
  Match,
  MatchState,
  MatchEvent,
  PanelDebate,
  PanelAnswer,
  MatchPersonality,
  AudienceMode,
  ViewerProfile,
  Overlay,
} from '../types';

interface MatchContextType {
  matches: Match[];
  selectedMatch: Match | null;
  currentMatchState: MatchState;
  currentEvents: MatchEvent[];
  currentLastEvent: MatchEvent | null;
  currentDebate: PanelDebate | null;
  displayedAnswer: PanelAnswer | null;
  isPlaying: boolean;
  isAsking: boolean;
  playbackSpeed: number;
  audienceMode: AudienceMode;
  language: ViewerProfile['language'];
  wsOverlays: Overlay[];
  wsVerificationStats: any;
  wsPersonality: MatchPersonality | null;
  isWsConnected: boolean;
  isLoadingMatches: boolean;
  selectMatchById: (matchId: string) => Promise<Match | null>;
  deselectMatch: () => void;
  togglePlay: () => void;
  seek: (minute: number) => void;
  changeSpeed: (speed: number) => void;
  changeMode: (mode: AudienceMode) => void;
  setLanguage: (lang: ViewerProfile['language']) => void;
  askQuestion: (question: string) => Promise<PanelAnswer | null>;
  clearAnswer: () => void;
  generateLiveMatch: () => Promise<Match | null>;
  showPersonalityModal: boolean;
  setShowPersonalityModal: (show: boolean) => void;
  handleClosePersonalityModal: () => void;
}

const MatchContext = createContext<MatchContextType | undefined>(undefined);

export const MatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    matches,
    selectedMatch,
    audienceMode,
    isPlaying,
    isAsking,
    simState,
    simEvents,
    simDebate,
    selectMatch,
    startMatch,
    pauseMatch,
    resumeMatch,
    changePlaybackSpeed,
    playbackSpeed,
    seekMatch,
    askPanel,
    changeMode,
  } = useMatchState();

  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [localAnswer, setLocalAnswer] = useState<PanelAnswer | null>(null);
  const [showPersonalityModal, setShowPersonalityModal] = useState(false);
  const [hasDismissedPersonality, setHasDismissedPersonality] = useState<string | null>(null);
  const [language, setLanguage] = useState<ViewerProfile['language']>('en');

  // WebSocket connection for live match updates
  const {
    connected: isWsConnected,
    matchState: wsMatchState,
    events: wsEvents,
    lastEvent: wsLastEvent,
    lastDebate: wsLastDebate,
    panelAnswer: wsPanelAnswer,
    personality: wsPersonality,
    overlays: wsOverlays,
    verificationStats: wsVerificationStats,
    clearAnswer: clearWsAnswer,
  } = useWebSocket({
    matchId: selectedMatch ? selectedMatch.match_id : null,
  });

  // Consolidated match state (prefer WS if received, otherwise local state)
  const currentMatchState: MatchState = wsMatchState || {
    ...simState,
    home_team: selectedMatch?.home_team || simState.home_team,
    away_team: selectedMatch?.away_team || simState.away_team,
  };

  // Consolidated events
  const currentEvents = wsEvents.length > 0 ? wsEvents : simEvents;
  const currentLastEvent = wsLastEvent || (simEvents.length > 0 ? simEvents[simEvents.length - 1] : null);

  // Consolidated debate
  const currentDebate = wsLastDebate || simDebate;

  // Answer for AskPanel (WebSocket or REST fallback)
  const displayedAnswer = wsPanelAnswer || localAnswer;

  // Auto-open summary modal once when match reaches full_time
  useEffect(() => {
    if (
      selectedMatch &&
      currentMatchState.status === 'full_time' &&
      hasDismissedPersonality !== selectedMatch.match_id &&
      !showPersonalityModal
    ) {
      setShowPersonalityModal(true);
    }
  }, [selectedMatch, currentMatchState.status, hasDismissedPersonality, showPersonalityModal]);

  const handleClosePersonalityModal = () => {
    setShowPersonalityModal(false);
    if (selectedMatch) {
      setHasDismissedPersonality(selectedMatch.match_id);
    }
  };

  // Select a match by its ID (handles recovery from URL or direct clicks)
  const selectMatchById = useCallback(
    async (matchId: string): Promise<Match | null> => {
      // Check if already selected
      if (selectedMatch && selectedMatch.match_id === matchId) {
        return selectedMatch;
      }

      // 1. Look up in current matches list
      let target = matches.find((m) => m.match_id === matchId);

      // 2. Fallback to DEFAULT_MATCHES
      if (!target) {
        target = DEFAULT_MATCHES.find((m) => m.match_id === matchId);
      }

      // 3. If not found, try fetching from backend /api/matches
      if (!target) {
        setIsLoadingMatches(true);
        try {
          const res = await fetch('/api/matches');
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : data?.matches;
            if (Array.isArray(list)) {
              const found = list.find((m: any) => m.match_id === matchId);
              if (found) {
                target = {
                  match_id: found.match_id,
                  name: `${found.home_team} vs ${found.away_team}`,
                  home_team: found.home_team,
                  away_team: found.away_team,
                  theme: 'domination',
                  description: `${found.events_count ?? 0} synthetic tactical events`,
                };
              }
            }
          }
        } catch (e) {
          console.warn('Failed to resolve match from /api/matches', e);
        } finally {
          setIsLoadingMatches(false);
        }
      }

      if (target) {
        if (selectedMatch && selectedMatch.match_id !== target.match_id) {
          pauseMatch(selectedMatch.match_id);
        }
        clearWsAnswer();
        setLocalAnswer(null);
        setShowPersonalityModal(false);
        setHasDismissedPersonality(null);
        selectMatch(target);
        startMatch(target.match_id);
        return target;
      }

      return null;
    },
    [matches, selectedMatch, selectMatch, startMatch, pauseMatch, clearWsAnswer]
  );

  const deselectMatch = useCallback(() => {
    if (selectedMatch) {
      pauseMatch(selectedMatch.match_id);
    }
    clearWsAnswer();
    setLocalAnswer(null);
    setShowPersonalityModal(false);
    setHasDismissedPersonality(null);
    selectMatch(null);
  }, [selectedMatch, pauseMatch, clearWsAnswer, selectMatch]);

  const togglePlay = useCallback(() => {
    if (!selectedMatch) return;
    if (isPlaying) {
      pauseMatch(selectedMatch.match_id);
    } else {
      resumeMatch(selectedMatch.match_id);
    }
  }, [selectedMatch, isPlaying, pauseMatch, resumeMatch]);

  const seek = useCallback(
    (minute: number) => {
      if (!selectedMatch) return;
      seekMatch(selectedMatch.match_id, minute);
    },
    [selectedMatch, seekMatch]
  );

  const changeSpeed = useCallback(
    (speed: number) => {
      if (!selectedMatch) return;
      changePlaybackSpeed(selectedMatch.match_id, speed);
    },
    [selectedMatch, changePlaybackSpeed]
  );

  const handleAskQuestion = useCallback(
    async (question: string) => {
      if (!selectedMatch) return null;
      const answer = await askPanel(selectedMatch.match_id, question, audienceMode, language);
      if (answer) {
        setLocalAnswer(answer);
      }
      return answer;
    },
    [selectedMatch, askPanel, audienceMode, language]
  );

  const handleClearAnswer = useCallback(() => {
    setLocalAnswer(null);
    clearWsAnswer();
  }, [clearWsAnswer]);

  const generateLiveMatch = useCallback(async (): Promise<Match | null> => {
    const sid = getVisitorSessionId();
    try {
      const res = await fetch(`/api/match/generate-live?session_id=${encodeURIComponent(sid)}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        const liveMatch: Match = {
          match_id: data.match_id,
          name: `${data.home_team} vs ${data.away_team}`,
          home_team: data.home_team,
          away_team: data.away_team,
          theme: 'domination',
          description: 'A dynamically synthesized, unscripted match featuring unpredictable organic goals and tactical momentum.',
        };
        return liveMatch;
      }
    } catch (e) {
      console.error('Failed to generate live match', e);
    }
    return null;
  }, []);

  return (
    <MatchContext.Provider
      value={{
        matches,
        selectedMatch,
        currentMatchState,
        currentEvents,
        currentLastEvent,
        currentDebate,
        displayedAnswer,
        isPlaying,
        isAsking,
        playbackSpeed,
        audienceMode,
        language,
        wsOverlays,
        wsVerificationStats,
        wsPersonality,
        isWsConnected,
        isLoadingMatches,
        selectMatchById,
        deselectMatch,
        togglePlay,
        seek,
        changeSpeed,
        changeMode: (mode) => changeMode(selectedMatch?.match_id || null, mode),
        setLanguage,
        askQuestion: handleAskQuestion,
        clearAnswer: handleClearAnswer,
        generateLiveMatch,
        showPersonalityModal,
        setShowPersonalityModal,
        handleClosePersonalityModal,
      }}
    >
      {children}
    </MatchContext.Provider>
  );
};

export const useMatch = (): MatchContextType => {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error('useMatch must be used within a MatchProvider');
  }
  return context;
};
