import { useState, useEffect, useCallback, useRef } from 'react';
import { getVisitorSessionId } from '../utils/session';
import {
  Match,
  AudienceMode,
  MatchState,
  MatchEvent,
  PanelDebate,
  PanelAnswer,
  MatchPersonality,
} from '../types';

export const DEFAULT_MATCHES: Match[] = [
  {
    match_id: 'match_001_comeback',
    name: 'The Great Comeback',
    home_team: 'Synthetic City FC',
    away_team: 'Metro Stars FC',
    description: 'Trailing 0-2 at half-time, Synthetic City switch to a 3-4-3 and mount a stunning second-half comeback to win 3-2 in stoppage time.',
    theme: 'dramatic-comeback',
    home_color: '#3b82f6',
    away_color: '#ef4444',
  },
  {
    match_id: 'match_002_dominance',
    name: 'Total Domination',
    home_team: 'Thunderstrike United',
    away_team: 'Aegis Port FC',
    description: 'Thunderstrike\'s relentless high press dismantles a 5-4-1 low block. 72% possession, 4-0 clean sheet masterclass.',
    theme: 'domination',
    home_color: '#f59e0b',
    away_color: '#8b5cf6',
  },
  {
    match_id: 'match_003_scrappy_draw',
    name: 'The Battle',
    home_team: 'Ironwall FC',
    away_team: 'Phoenix Athletic',
    description: 'Blood and thunder 2-2 draw with double yellow cards, a straight red, a penalty, and a heartbreaking 88th-minute equalizer.',
    theme: 'gritty-draw',
    home_color: '#10b981',
    away_color: '#f97316',
  },
];

// Rich fallback debates for simulation/offline experience
export const MOCK_DEBATES: Record<string, PanelDebate[]> = {
  default: [
    {
      moment_description: '34\' Counter-attack transition opens up midfield pocket',
      importance: 'medium',
      agreement_score: 82,
      host_summary: 'A clinic in transitional verticality. Let\'s get the panel\'s read on that rapid release.',
      pundits: [
        {
          id: 'tactician',
          name: 'The Tactician',
          comment: 'Notice how the half-spaces were vacated. The double pivot stepped too high, creating a 3v2 overload on the break.',
          sentiment: 'positive',
          confidence: 0.92,
        },
        {
          id: 'passion',
          name: 'The Passionate Fan',
          comment: 'Pure heart! Look at that sprint! That\'s what playing for the badge looks like — sheer desire won that ball!',
          sentiment: 'positive',
          confidence: 0.95,
        },
        {
          id: 'analyst',
          name: 'The Quant Analyst',
          comment: 'Expected threat (xT) jumped from 0.08 to 0.44 inside 3.2 seconds. Optimal decision-making by the ball carrier.',
          sentiment: 'positive',
          confidence: 0.88,
        },
      ],
    },
    {
      moment_description: '56\' Controversial penalty appeal waved away by referee',
      importance: 'high',
      agreement_score: 28,
      host_summary: 'Pandemonium in the technical area! Was there enough contact for the referee to point to the spot?',
      pundits: [
        {
          id: 'tactician',
          name: 'The Tactician',
          comment: 'The defender committed his weight early, but the winger exaggerated contact before trailing his foot.',
          sentiment: 'neutral',
          confidence: 0.74,
        },
        {
          id: 'passion',
          name: 'The Passionate Fan',
          comment: 'Absolute robbery! In what world is that not a penalty?! He got clipped at full speed, clear as day!',
          sentiment: 'negative',
          confidence: 0.99,
        },
        {
          id: 'analyst',
          name: 'The Quant Analyst',
          comment: 'Probability of overturn was only 14% under VAR guidance. Contact was minimal with no trajectory disruption.',
          sentiment: 'neutral',
          confidence: 0.85,
        },
      ],
    },
    {
      moment_description: '78\' Stunner from 25 yards strikes the crossbar into the net!',
      importance: 'high',
      agreement_score: 95,
      host_summary: 'Unbelievable strike! An absolute rocket that nearly tore the net apart!',
      pundits: [
        {
          id: 'tactician',
          name: 'The Tactician',
          comment: 'The dip on that shot came from clean technique through the ball. The goalkeeper was screened by his own center-back.',
          sentiment: 'positive',
          confidence: 0.89,
        },
        {
          id: 'passion',
          name: 'The Passionate Fan',
          comment: 'TAKE A BOW! Goal of the season contender, nothing more to say! Electric atmosphere in the stadium right now!',
          sentiment: 'positive',
          confidence: 0.98,
        },
        {
          id: 'analyst',
          name: 'The Quant Analyst',
          comment: 'xG of just 0.03 on that attempt, but post-shot xG rose to 0.94 due to velocity (108 km/h) and top-corner placement.',
          sentiment: 'positive',
          confidence: 0.96,
        },
      ],
    },
  ],
};

export function useMatchState() {
  const [matches, setMatches] = useState<Match[]>(DEFAULT_MATCHES);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('fan');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(10.0);
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [simulationActive, setSimulationActive] = useState<boolean>(false);

  // Sim fallback state when backend isn't actively emitting
  const [simState, setSimState] = useState<MatchState>({
    minute: 0,
    second: 0,
    score: { home: 0, away: 0 },
    possession: { home: 50, away: 50 },
    xg: { home: 0.12, away: 0.08 },
    home_team: 'Synthetic City FC',
    away_team: 'Merseyside Reds',
    status: 'not_started',
  });

  const [simEvents, setSimEvents] = useState<MatchEvent[]>([]);
  const [simDebate, setSimDebate] = useState<PanelDebate | null>(null);
  const simTimerRef = useRef<number | null>(null);

  // Fetch match list from backend with fallback
  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/matches');
      if (res.ok) {
        const data = await res.json();
        // Backend returns { matches: [...] }; enrich with the curated names/descriptions where we have them
        const list = Array.isArray(data) ? data : data?.matches;
        if (Array.isArray(list) && list.length > 0) {
          setMatches(
            list.map((m: Match & { events_count?: number }) => {
              const curated = DEFAULT_MATCHES.find((d) => d.match_id === m.match_id);
              return {
                ...(curated ?? {
                  name: `${m.home_team} vs ${m.away_team}`,
                  description: `${m.events_count ?? 0} synthetic events`,
                }),
                ...m,
              } as Match;
            })
          );
          return;
        }
      }
    } catch {
      // Backend not running, use defaults
      console.log('Using default mock matches');
    }
    setMatches(DEFAULT_MATCHES);
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Select a match (or deselect with null)
  const selectMatch = useCallback((match: Match | null) => {
    setSelectedMatch(match);
    setIsPlaying(false);
    setSimulationActive(false);
    if (match) {
      setSimState({
        minute: 0,
        second: 0,
        score: { home: 0, away: 0 },
        possession: { home: 50, away: 50 },
        xg: { home: 0.0, away: 0.0 },
        home_team: match.home_team,
        away_team: match.away_team,
        status: 'not_started',
      });
    }
    setSimEvents([]);
    setSimDebate(null);
  }, []);

  // API Call: Start match playback
  const startMatch = useCallback(async (matchId: string) => {
    setIsPlaying(true);
    const sid = getVisitorSessionId();
    try {
      const res = await fetch(`/api/match/${matchId}/start?speed=${playbackSpeed}&session_id=${encodeURIComponent(sid)}`, { method: 'POST' });
      if (res.ok) {
        return true;
      }
    } catch {
      console.log('Backend not reachable; running local simulation mode');
    }
    // If backend wasn't running, activate client simulation
    setSimulationActive(true);
    return true;
  }, [playbackSpeed]);

  // API Call: Pause match playback
  const pauseMatch = useCallback(async (matchId: string) => {
    setIsPlaying(false);
    const sid = getVisitorSessionId();
    try {
      await fetch(`/api/match/${matchId}/pause?session_id=${encodeURIComponent(sid)}`, { method: 'POST' });
    } catch {
      // Local fallback
    }
  }, []);

  // API Call: Resume match playback
  const resumeMatch = useCallback(async (matchId: string) => {
    setIsPlaying(true);
    const sid = getVisitorSessionId();
    try {
      await fetch(`/api/match/${matchId}/resume?session_id=${encodeURIComponent(sid)}`, { method: 'POST' });
    } catch {
      // Local fallback
    }
  }, []);

  // API Call: Change playback speed (e.g. 0.5x, 1x, 2x, 5x, 10x)
  const changePlaybackSpeed = useCallback(async (matchId: string, speed: number) => {
    setPlaybackSpeed(speed);
    const sid = getVisitorSessionId();
    try {
      await fetch(`/api/match/${matchId}/speed?speed=${speed}&session_id=${encodeURIComponent(sid)}`, { method: 'POST' });
    } catch {
      // Local fallback
    }
  }, []);

  // API Call: Seek match to a specific minute
  const seekMatch = useCallback(async (matchId: string, minute: number) => {
    setSimState((prev) => ({
      ...prev,
      minute: Math.max(0, Math.min(90, minute)),
      second: 0,
    }));
    const sid = getVisitorSessionId();
    try {
      const res = await fetch(`/api/match/${matchId}/seek?minute=${minute}&session_id=${encodeURIComponent(sid)}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.state) {
          setSimState(data.state);
        }
      }
    } catch {
      // Local fallback
    }
  }, []);

  // API Call: Ask the panel a question
  const askPanel = useCallback(
    async (
      matchId: string,
      question: string,
      mode: AudienceMode,
      language?: string
    ): Promise<PanelAnswer | null> => {
      setIsAsking(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const sid = getVisitorSessionId();
      try {
        const res = await fetch(`/api/match/${matchId}/ask?session_id=${encodeURIComponent(sid)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, mode, language: language || 'en' }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          // Backend answers carry {id, comment}; the UI expects {pundit_id, answer}
          const raw = await res.json();
          const data: PanelAnswer = {
            question: raw?.question || question,
            host_summary: raw?.host_summary || 'Our studio panel has analyzed your tactical question:',
            answers: (raw?.answers ?? []).map(
              (a: { pundit_id?: string; id?: string; persona?: string; name: string; answer?: string; comment?: string }) => ({
                pundit_id: a.pundit_id || a.persona || a.id || 'analyst',
                name: a.name || 'Pundit',
                answer: a.answer || a.comment || '',
              })
            ),
          };
          setIsAsking(false);
          return data;
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn('Backend ask endpoint unavailable, using mock response:', err);
      }

      // Fallback synthetic answer for offline demo
      try {
        await new Promise((r) => setTimeout(r, 600));
      } finally {
        setIsAsking(false);
      }

      const mockResponses: Record<AudienceMode, PanelAnswer> = {
        fan: {
          question,
          host_summary: `Great question from the stands. Here is how our panel sees it from the fans' perspective:`,
          answers: [
            {
              pundit_id: 'tactician',
              name: 'The Tactician',
              answer: 'Looking at how the midfield shaped up, their high line left them vulnerable to quick vertical releases.',
            },
            {
              pundit_id: 'passion',
              name: 'The Passionate Fan',
              answer: 'It is all about the energy! They were fighting for every loose ball and gave 110% out there!',
            },
            {
              pundit_id: 'analyst',
              name: 'The Quant Analyst',
              answer: 'Their progressive pass success rate reached 84% in that final 15-minute sequence, yielding high quality chances.',
            },
          ],
        },
        scout: {
          question,
          host_summary: `Scouting perspective: Evaluating technical execution and positional profile:`,
          answers: [
            {
              pundit_id: 'tactician',
              name: 'The Tactician',
              answer: 'Look at the body orientation when receiving on the half-turn. Exceptional spatial awareness under intense press.',
            },
            {
              pundit_id: 'passion',
              name: 'The Passionate Fan',
              answer: 'Natural grit and leadership. Communicates constantly with back four, a true captain material.',
            },
            {
              pundit_id: 'analyst',
              name: 'The Quant Analyst',
              answer: 'Ranks in the 94th percentile for progressive ball carries (6.8 per 90) and tackles won in the middle third.',
            },
          ],
        },
        broadcaster: {
          question,
          host_summary: `Broadcaster angle: Framing the storyline and peak drama of the contest:`,
          answers: [
            {
              pundit_id: 'tactician',
              name: 'The Tactician',
              answer: 'A tactical chess match where the manager\'s substitution at minute 60 swung the momentum completely.',
            },
            {
              pundit_id: 'passion',
              name: 'The Passionate Fan',
              answer: 'Pure cinematic football drama. The away supporters won\'t forget this electric atmosphere for years!',
            },
            {
              pundit_id: 'analyst',
              name: 'The Quant Analyst',
              answer: 'Story of the numbers: 2.45 xG created versus 0.62 conceded confirms an emphatic and deserved outcome.',
            },
          ],
        },
      };

      return mockResponses[mode] || mockResponses.fan;
    },
    []
  );

  // API Call: Change audience mode
  const changeMode = useCallback(
    async (matchId: string | null, mode: AudienceMode) => {
      setAudienceMode(mode);
      if (!matchId) return;
      const sid = getVisitorSessionId();
      try {
        await fetch(`/api/match/${matchId}/mode?session_id=${encodeURIComponent(sid)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        });
      } catch {
        // Backend offline
      }
    },
    []
  );

  // Standalone simulation clock when simulationActive is true
  useEffect(() => {
    if (!simulationActive || !isPlaying) {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      return;
    }

    simTimerRef.current = window.setInterval(() => {
      setSimState((prev) => {
        let nextSec = prev.second + 3;
        let nextMin = prev.minute;

        if (nextSec >= 60) {
          nextMin += 1;
          nextSec = 0;
        }

        if (nextMin > 90) {
          setIsPlaying(false);
          return { ...prev, minute: 90, second: 0, status: 'full_time' };
        }

        // Trigger sample events at milestones
        if (nextMin === 18 && prev.minute < 18) {
          const newEvent: MatchEvent = {
            event_id: 'sim_ev_1',
            minute: 18,
            type: 'shot',
            team: 'home',
            player: 'M. Sorenson',
            description: 'Fierce drive towards the bottom corner tipped away',
            position: { x: 78, y: 38 },
            end_position: { x: 98, y: 48 },
            outcome: 'saved',
          };
          setSimEvents((evs) => [...evs, newEvent]);
        }

        if (nextMin === 34 && prev.minute < 34) {
          const goalEvent: MatchEvent = {
            event_id: 'sim_ev_2',
            minute: 34,
            type: 'goal',
            team: 'home',
            player: 'K. Lindqvist',
            description: 'GOAL! Curled masterfully into top-right corner!',
            position: { x: 82, y: 52 },
            end_position: { x: 99, y: 47 },
            outcome: 'goal',
          };
          setSimEvents((evs) => [...evs, goalEvent]);
          setSimDebate(MOCK_DEBATES.default[0]);
          return {
            ...prev,
            minute: nextMin,
            second: nextSec,
            score: { ...prev.score, home: prev.score.home + 1 },
            xg: { ...prev.xg, home: +(prev.xg.home + 0.65).toFixed(2) },
          };
        }

        if (nextMin === 56 && prev.minute < 56) {
          const cardEvent: MatchEvent = {
            event_id: 'sim_ev_3',
            minute: 56,
            type: 'card',
            team: 'away',
            player: 'C. Romero',
            description: 'Yellow card for a cynical challenge in midfield',
            position: { x: 48, y: 65 },
            card_type: 'yellow',
          };
          setSimEvents((evs) => [...evs, cardEvent]);
          setSimDebate(MOCK_DEBATES.default[1]);
        }

        if (nextMin === 78 && prev.minute < 78) {
          const goal2: MatchEvent = {
            event_id: 'sim_ev_4',
            minute: 78,
            type: 'goal',
            team: 'away',
            player: 'H. Son',
            description: 'GOAL! Sensational thunderbolt into the top corner!',
            position: { x: 26, y: 40 },
            end_position: { x: 1, y: 52 },
            outcome: 'goal',
          };
          setSimEvents((evs) => [...evs, goal2]);
          setSimDebate(MOCK_DEBATES.default[2]);
          return {
            ...prev,
            minute: nextMin,
            second: nextSec,
            score: { ...prev.score, away: prev.score.away + 1 },
            xg: { ...prev.xg, away: +(prev.xg.away + 0.72).toFixed(2) },
          };
        }

        return {
          ...prev,
          minute: nextMin,
          second: nextSec,
          possession: {
            home: Math.min(68, Math.max(38, prev.possession.home + (Math.random() > 0.5 ? 1 : -1))),
            away: 100 - Math.min(68, Math.max(38, prev.possession.home + (Math.random() > 0.5 ? 1 : -1))),
          },
        };
      });
    }, 500);

    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [simulationActive, isPlaying]);

  return {
    matches,
    selectedMatch,
    audienceMode,
    isPlaying,
    playbackSpeed,
    isAsking,
    simulationActive,
    simState,
    simEvents,
    simDebate,
    selectMatch,
    startMatch,
    pauseMatch,
    resumeMatch,
    changePlaybackSpeed,
    seekMatch,
    askPanel,
    changeMode,
    setIsPlaying,
    setSimulationActive,
  };
}
