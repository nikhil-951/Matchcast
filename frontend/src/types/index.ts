export type AudienceMode = 'fan' | 'scout' | 'broadcaster';

export interface Position {
  x: number; // 0-100 (left to right)
  y: number; // 0-100 (top to bottom)
}

export interface Score {
  home: number;
  away: number;
}

export interface PossessionStats {
  home: number;
  away: number;
}

export interface XGStats {
  home: number;
  away: number;
}

export interface TeamDetailedStats {
  shots: number;
  shots_on_target: number;
  total_passes: number;
  completed_passes: number;
  pass_accuracy: number;
  fouls: number;
  yellow_cards: number;
  red_cards: number;
  corners: number;
  tackles_won: number;
}

export interface DetailedStats {
  home: TeamDetailedStats;
  away: TeamDetailedStats;
}

export interface ChannelStats {
  entries: number;
  box_entries: number;
  shots: number;
  xg: number;
}

export interface TeamAttackingZones {
  left: ChannelStats;
  central: ChannelStats;
  right: ChannelStats;
}

export interface AttackingZonesStats {
  home: TeamAttackingZones;
  away: TeamAttackingZones;
}

export interface TeamSetPieceThreat {
  corners_taken: number;
  free_kicks_taken: number;
  shots_generated: number;
  goals_scored: number;
  cumulative_xg: number;
  threat_index: number;
}

export interface SetPieceThreatStats {
  home: TeamSetPieceThreat;
  away: TeamSetPieceThreat;
}

export interface GoalkeeperMetrics {
  player_name: string;
  team: string;
  saves: number;
  goals_conceded: number;
  shots_on_target_faced: number;
  xg_on_target_faced: number;
  goals_prevented: number;
}

export interface GoalkeeperEfficiencyStats {
  home: GoalkeeperMetrics;
  away: GoalkeeperMetrics;
}

export interface DataStory {
  story_id: string;
  story_type: string;
  title: string;
  description: string;
  team?: string;
  player?: string;
  minute: number;
  second: number;
  evidence_event_ids: string[];
  metrics: Record<string, any>;
  confidence: number;
  category: string;
}

export interface MatchState {
  match_id?: string;
  minute: number;
  second: number;
  score: Score;
  possession: PossessionStats;
  xg: XGStats;
  home_team: string;
  away_team: string;
  is_paused?: boolean;
  status?: 'not_started' | 'live' | 'half_time' | 'full_time';
  momentum?: {
    home: number;
    away: number;
    swing?: string;
    delta?: number;
  };
  detailed_stats?: DetailedStats;
  control_index?: number;
  chaos_index?: number;
  game_rhythm?: string;
  attacking_zones?: AttackingZonesStats;
  set_piece_threat?: SetPieceThreatStats;
  keeper_efficiency?: GoalkeeperEfficiencyStats;
  latest_story?: DataStory;
  active_stories?: DataStory[];
}

export type EventType = 'goal' | 'shot' | 'card' | 'substitution' | 'foul' | 'corner' | 'offside' | string;

export interface MatchEvent {
  event_id: string;
  minute: number;
  second?: number;
  type: EventType;
  subtype?: string;
  team: string; // team name (backend normalises 'home'/'away')
  player: string;
  description: string;
  position: Position;
  end_position?: Position;
  outcome?: 'goal' | 'saved' | 'missed' | 'blocked' | 'success' | 'failed' | string;
  card_type?: 'yellow' | 'red';
  sub_on?: string;
  sub_off?: string;
  recipient?: string;
  xG?: number;
  additional?: Record<string, any>;
}

export type PunditId = 'tactician' | 'passion' | 'analyst';
export type Sentiment = string; // positive | negative | neutral | excited | critical | analytical ...

export interface Claim {
  type: 'xg' | 'possession' | 'momentum' | 'score' | 'pressures' | 'statistic' | string;
  claim: string;
  status: 'verified' | 'wrong' | 'unsupported';
  actual?: string | null;
}

export interface VerificationSummary {
  total: number;
  verified: number;
  wrong: number;
  unsupported: number;
  verified_pct: number;
  by_type?: Record<string, number>;
}

export interface Overlay {
  id: string;
  type: 'player_tag' | 'shot_speed' | 'pass_quality' | 'goal' | 'card' | string;
  match_clock: string;
  start_s: number;
  duration_s: number;
  team: string;
  player: string;
  priority: number;
  highlight: boolean;
  evidence_event_ids: string[];
  text: Record<string, string>;
  payload: Record<string, unknown>;
  shownAt?: number;
}

export interface ViewerProfile {
  mode: AudienceMode;
  language: 'en' | 'hi' | 'es';
  favorite_club: string | null;
  favorite_player: string | null;
  player_focus: boolean;
  focus_metric: 'all' | 'shots' | 'passes' | 'goals';
}

export interface RosterPlayer {
  name: string;
  number: number | null;
  team: string;
}

export interface PunditComment {
  id: PunditId | string;
  persona?: string;
  key_observation?: string | null;
  verification?: Claim[];
  name: string;
  comment: string;
  sentiment: Sentiment;
  confidence: number; // 0-1
}

export interface PanelDebate {
  moment_description: string;
  importance: string;
  verification?: VerificationSummary | null;
  pundits: PunditComment[];
  agreement_score: number; // 0-100
  host_summary: string;
  timestamp?: number;
}

export interface PunditAnswer {
  pundit_id?: string;
  id?: string;
  persona?: string;
  name: string;
  answer?: string;
  comment?: string;
}

export interface PanelAnswer {
  question: string;
  answers: PunditAnswer[];
  host_summary: string;
}

export interface KeyMoment {
  minute: number;
  description: string;
  importance: 'high' | 'medium' | 'low';
}

export interface MatchPersonality {
  summary: string;
  tags: string[];
  key_moments: KeyMoment[];
}

export interface Match {
  match_id: string;
  name: string;
  home_team: string;
  away_team: string;
  description: string;
  theme?: string;
  filename?: string;
  home_color?: string;
  away_color?: string;
}

export type WebSocketMessage =
  | { type: 'match_state'; data: MatchState }
  | { type: 'data_story'; data: DataStory }
  | { type: 'match_event'; data: MatchEvent }
  | { type: 'panel_debate'; data: PanelDebate }
  | { type: 'panel_answer'; data: PanelAnswer }
  | { type: 'overlay'; data: Overlay[] }
  | { type: 'verification_stats'; data: VerificationSummary }
  | { type: 'match_personality'; data: MatchPersonality }
  | { type: 'seek_reset'; data: { keep_events?: MatchEvent[]; target_index?: number; target_minute?: number } };
