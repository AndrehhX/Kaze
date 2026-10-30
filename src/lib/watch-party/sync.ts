/**
 * Watch-party synchronization math (pure, unit-tested).
 *
 * The database row is the single source of truth: the host's RPC stamps
 * `state_updated_at` with the *server* clock. Each client estimates its offset
 * to that clock (NTP-style, best-of-N by round-trip time) and extrapolates the
 * expected position. Small drift is absorbed by nudging playbackRate; large
 * drift triggers a seek. No media is ever relayed between participants.
 */

export type RoomState = {
  episodeId: string;
  isPlaying: boolean;
  position: number;
  rate: number;
  /** Server timestamp (ms) when the state was written. */
  updatedAt: number;
  version: number;
};

export type ClockSample = { t0: number; server: number; t1: number };

/** Offset (ms) to add to the local clock to get server time. Uses the lowest-RTT sample. */
export function estimateOffset(samples: ClockSample[]): { offset: number; rtt: number } | null {
  if (!samples.length) return null;
  const best = [...samples].sort((a, b) => a.t1 - a.t0 - (b.t1 - b.t0))[0];
  const rtt = best.t1 - best.t0;
  return { offset: best.server - (best.t0 + rtt / 2), rtt };
}

export function expectedPosition(state: RoomState, serverNow: number): number {
  if (!state.isPlaying) return state.position;
  return state.position + Math.max(0, (serverNow - state.updatedAt) / 1000) * state.rate;
}

export type Correction = { kind: "ok"; rate: number } | { kind: "nudge"; rate: number; drift: number } | { kind: "seek"; to: number; drift: number };

export const SEEK_THRESHOLD = 1.0;
export const NUDGE_THRESHOLD = 0.15;

export function correction(localPosition: number, expected: number, baseRate: number): Correction {
  const drift = localPosition - expected;
  const abs = Math.abs(drift);
  if (abs > SEEK_THRESHOLD) return { kind: "seek", to: Math.max(0, expected), drift };
  if (abs > NUDGE_THRESHOLD) return { kind: "nudge", rate: baseRate * (drift > 0 ? 0.95 : 1.05), drift };
  return { kind: "ok", rate: baseRate };
}

export function rowToState(r: { episode_id: string; is_playing: boolean; position_seconds: number; playback_rate: number; state_updated_at: string; state_version: number }): RoomState {
  return { episodeId: r.episode_id, isPlaying: r.is_playing, position: r.position_seconds, rate: r.playback_rate, updatedAt: new Date(r.state_updated_at).getTime(), version: Number(r.state_version) };
}
