/**
 * Session utility to provide unique per-visitor isolation.
 * Prevents multiple concurrent judges from interfering with each other's live match replay.
 */
export function getVisitorSessionId(): string {
  if (typeof window === 'undefined') return 'default_judge';
  try {
    let id = localStorage.getItem('matchcast_visitor_id');
    if (!id) {
      id = 'judge_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('matchcast_visitor_id', id);
    }
    return id;
  } catch {
    return 'default_judge';
  }
}
