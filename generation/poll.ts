import { getGenerationStatuses } from "./actions"
import type { GenerationStatus, StatusResult } from "./platform"

/** Statuses the platform never moves off again. */
const TERMINAL = new Set(["completed", "failed", "nsfw", "canceled"])

export const POLL_INTERVAL_MS = 4000
export const POLL_DEADLINE_MS = 10 * 60_000
/** Rounds allowed to fail back to back before the watches are given up on. One
    dropped round must not end every generation in flight. */
const MAX_MISSES = 3
/** Same limit, per request: a 502 or 429 on one status read says nothing about the job. */
const MAX_REQUEST_ERRORS = 3
/** Ids per status call; the server refuses more. */
const STATUS_BATCH = 50

/** The deadline passed with the job still unfinished: it may yet complete. */
export class WatchTimeoutError extends Error {
  constructor() {
    super("timed out waiting for the platform")
    this.name = "WatchTimeoutError"
  }
}

type Waiter = {
  deadline: number
  errors: number
  resolve: (status: GenerationStatus) => void
  reject: (reason: Error) => void
}

const waiting = new Map<string, Waiter>()
const inflight = new Map<string, Promise<GenerationStatus>>()
let timer: ReturnType<typeof setTimeout> | null = null
let polling = false
let misses = 0

/** Resolves when the platform reports a terminal status for this request.
    Every request in flight is asked for together, in one server action per
    interval: Next dispatches server actions one at a time per client, so a
    poll per run would queue ahead of the next submit and the composer would
    stall again — with the lock gone and the queue doing the same work. */
export function watchRequest(
  requestId: string,
  opts?: { deadline?: number }
): Promise<GenerationStatus> {
  const existing = inflight.get(requestId)
  if (existing) return existing
  const promise = new Promise<GenerationStatus>((resolve, reject) => {
    waiting.set(requestId, {
      deadline: opts?.deadline ?? Date.now() + POLL_DEADLINE_MS,
      errors: 0,
      resolve: (status) => {
        inflight.delete(requestId)
        resolve(status)
      },
      reject: (reason) => {
        inflight.delete(requestId)
        reject(reason)
      },
    })
    schedule()
  })
  inflight.set(requestId, promise)
  return promise
}

/** Drops every watch without settling it: the studio unmounted and there is
    nobody left to hand a result to. In-flight jobs stay in history and the
    next mount starts a fresh watch. */
export function stopWatching(): void {
  if (timer !== null) clearTimeout(timer)
  timer = null
  misses = 0
  waiting.clear()
  inflight.clear()
}

function schedule(): void {
  if (timer !== null || polling || waiting.size === 0) return
  timer = setTimeout(() => void round(), POLL_INTERVAL_MS)
}

async function round(): Promise<void> {
  timer = null
  polling = true
  try {
    const ids = [...waiting.keys()]
    const results: StatusResult[] = []
    for (let i = 0; i < ids.length; i += STATUS_BATCH)
      results.push(
        ...(await getGenerationStatuses({
          requestIds: ids.slice(i, i + STATUS_BATCH),
        }))
      )
    misses = 0
    for (const result of results) deliver(result)
    sweep()
  } catch (caught) {
    if (++misses < MAX_MISSES) return
    settleAll(caught instanceof Error ? caught : new Error(String(caught)))
  } finally {
    polling = false
    schedule()
  }
}

function deliver(result: StatusResult): void {
  const waiter = waiting.get(result.requestId)
  if (!waiter) return
  if ("error" in result) {
    if (!result.terminal && ++waiter.errors < MAX_REQUEST_ERRORS) return
    waiting.delete(result.requestId)
    waiter.reject(new Error(result.error))
    return
  }
  waiter.errors = 0
  if (!TERMINAL.has(result.status.status)) return
  waiting.delete(result.requestId)
  waiter.resolve(result.status)
}

/* A run the platform never finishes would otherwise hold its skeleton open for
   the rest of the session. */
function sweep(): void {
  const now = Date.now()
  for (const [requestId, waiter] of [...waiting]) {
    if (now <= waiter.deadline) continue
    waiting.delete(requestId)
    waiter.reject(new WatchTimeoutError())
  }
}

function settleAll(reason: Error): void {
  const waiters = [...waiting.values()]
  waiting.clear()
  misses = 0
  for (const waiter of waiters) waiter.reject(reason)
}
