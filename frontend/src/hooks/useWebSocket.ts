import { useState, useEffect, useRef, useCallback } from 'react';
import { getVisitorSessionId } from '../utils/session';
import {
  MatchState,
  MatchEvent,
  PanelDebate,
  PanelAnswer,
  MatchPersonality,
  Overlay,
  VerificationSummary,
  WebSocketMessage,
} from '../types';

interface UseWebSocketOptions {
  matchId: string | null;
  autoReconnect?: boolean;
  onMessageReceived?: (message: WebSocketMessage) => void;
}

export interface UseWebSocketReturn {
  connected: boolean;
  matchState: MatchState | null;
  events: MatchEvent[];
  debates: PanelDebate[];
  lastDebate: PanelDebate | null;
  lastEvent: MatchEvent | null;
  panelAnswer: PanelAnswer | null;
  personality: MatchPersonality | null;
  overlays: Overlay[];
  verificationStats: VerificationSummary | null;
  sendMessage: (msg: unknown) => void;
  clearAnswer: () => void;
  resetData: () => void;
}

export function useWebSocket({
  matchId,
  autoReconnect = true,
  onMessageReceived,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<MatchEvent | null>(null);
  const [debates, setDebates] = useState<PanelDebate[]>([]);
  const [lastDebate, setLastDebate] = useState<PanelDebate | null>(null);
  const [panelAnswer, setPanelAnswer] = useState<PanelAnswer | null>(null);
  const [personality, setPersonality] = useState<MatchPersonality | null>(null);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [verificationStats, setVerificationStats] = useState<VerificationSummary | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const currentMatchIdRef = useRef<string | null>(matchId);
  const eventIdsRef = useRef<Set<string>>(new Set());

  const resetData = useCallback(() => {
    eventIdsRef.current.clear();
    setMatchState(null);
    setEvents([]);
    setLastEvent(null);
    setDebates([]);
    setLastDebate(null);
    setPanelAnswer(null);
    setPersonality(null);
    setOverlays([]);
    setVerificationStats(null);
  }, []);

  const clearAnswer = useCallback(() => {
    setPanelAnswer(null);
  }, []);

  const sendMessage = useCallback((msg: unknown) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } else {
      console.warn('[WS] Cannot send message: WebSocket is not connected');
    }
  }, []);

  // Overlays leave the screen after a few seconds, like broadcast lower-thirds
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setOverlays((prev) => {
        const next = prev.filter((o) => now - (o.shownAt ?? now) < Math.max(4, o.duration_s) * 1000);
        return next.length === prev.length ? prev : next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    currentMatchIdRef.current = matchId;
    resetData();

    // Clean up any existing connection before opening a new one
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      const old = socketRef.current;
      socketRef.current = null;
      old.onopen = null;
      old.onmessage = null;
      old.onerror = null;
      old.onclose = null;
      old.close();
    }

    if (!matchId) {
      setConnected(false);
      return;
    }

    let isDisposed = false;

    const connect = () => {
      if (isDisposed || currentMatchIdRef.current !== matchId) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const sessionId = getVisitorSessionId();
      const wsUrl = `${protocol}//${window.location.host}/ws/match/${matchId}?session_id=${encodeURIComponent(sessionId)}`;

      try {
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (isDisposed || socketRef.current !== socket || currentMatchIdRef.current !== matchId) return;
          console.log(`[WS] Connected to match: ${matchId}`);
          setConnected(true);
        };

        socket.onmessage = (event) => {
          if (isDisposed || socketRef.current !== socket || currentMatchIdRef.current !== matchId) return;
          try {
            const parsed: WebSocketMessage = JSON.parse(event.data);

            if (onMessageReceived) {
              onMessageReceived(parsed);
            }

            switch (parsed.type) {
              case 'seek_reset': {
                const data = parsed.data;
                eventIdsRef.current.clear();
                const kept: MatchEvent[] = data?.keep_events || [];
                kept.forEach((ev: MatchEvent) => {
                  if (ev.event_id) eventIdsRef.current.add(ev.event_id);
                });
                setEvents(kept);
                if (kept.length > 0) {
                  setLastEvent(kept[kept.length - 1]);
                } else {
                  setLastEvent(null);
                }
                break;
              }
              case 'match_state':
                if (parsed.data && (!parsed.data.match_id || parsed.data.match_id === matchId)) {
                  setMatchState(parsed.data);
                }
                break;
              case 'match_event':
                setLastEvent(parsed.data);
                setEvents((prev) => {
                  const evId = parsed.data.event_id;
                  if (evId && eventIdsRef.current.has(evId)) {
                    return prev;
                  }
                  if (evId) {
                    eventIdsRef.current.add(evId);
                  }
                  return [...prev, parsed.data];
                });
                break;
              case 'panel_debate':
                setLastDebate(parsed.data);
                setDebates((prev) => [...prev, parsed.data]);
                break;
              case 'panel_answer': {
                const raw = parsed.data;
                const normalized: PanelAnswer = {
                  question: raw?.question || '',
                  host_summary: raw?.host_summary || '',
                  answers: (raw?.answers ?? []).map(
                    (a: { pundit_id?: string; persona?: string; id?: string; name?: string; answer?: string; comment?: string }) => ({
                      pundit_id: a.pundit_id || a.persona || a.id || 'analyst',
                      name: a.name || 'Pundit',
                      answer: a.answer || a.comment || '',
                    })
                  ),
                };
                setPanelAnswer(normalized);
                break;
              }
              case 'match_personality':
                setPersonality(parsed.data);
                break;
              case 'overlay': {
                const now = Date.now();
                setOverlays((prev) =>
                  [...prev, ...parsed.data.map((o) => ({ ...o, shownAt: now }))].slice(-8)
                );
                break;
              }
              case 'verification_stats':
                setVerificationStats(parsed.data);
                break;
              default:
                console.log('[WS] Received unhandled message type:', parsed);
            }
          } catch (err) {
            console.error('[WS] Error parsing JSON message:', err, event.data);
          }
        };

        socket.onerror = (err) => {
          if (isDisposed || socketRef.current !== socket || currentMatchIdRef.current !== matchId) return;
          console.warn('[WS] Socket error (backend may not be running yet):', err);
        };

        socket.onclose = () => {
          if (isDisposed || socketRef.current !== socket || currentMatchIdRef.current !== matchId) return;
          setConnected(false);
          socketRef.current = null;

          if (autoReconnect && !isDisposed) {
            reconnectTimeoutRef.current = window.setTimeout(() => {
              if (!isDisposed && currentMatchIdRef.current === matchId) {
                console.log(`[WS] Attempting reconnection for ${matchId}...`);
                connect();
              }
            }, 3000);
          }
        };
      } catch (err) {
        console.error('[WS] Failed to create WebSocket connection:', err);
      }
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        const old = socketRef.current;
        socketRef.current = null;
        old.onopen = null;
        old.onmessage = null;
        old.onerror = null;
        old.onclose = null;
        old.close();
      }
      resetData();
    };
  }, [matchId, autoReconnect, onMessageReceived, resetData]);

  return {
    connected,
    matchState,
    events,
    debates,
    lastDebate,
    lastEvent,
    panelAnswer,
    personality,
    overlays,
    verificationStats,
    sendMessage,
    clearAnswer,
    resetData,
  };
}
