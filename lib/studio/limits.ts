/** Tunables in one place. Polling intervals live with the poller in generation/poll.ts. */

/** Runs kept in browser history; older ones are dropped on save. */
export const HISTORY_MAX_RECORDS = 400
/** Runs sent to the platform at once; the rest wait in the local queue. */
export const MAX_RUNNING = 2
/** Runs allowed to wait in the local queue. */
export const MAX_QUEUED = 20
/** How long a run is watched before it is marked "Still working". */
export const IMAGE_DEADLINE_MS = 15 * 60_000
export const VIDEO_DEADLINE_MS = 40 * 60_000
/** History writes within this window are batched into one. */
export const SAVE_DEBOUNCE_MS = 250
