import type { MediaItem, Surface } from "@/generation/catalog"

import { HISTORY_MAX_RECORDS } from "./limits"
import { defaultKv, type Kv } from "./kv"

export type RunStatus = "running" | "completed" | "failed"

/** One generation request and everything the studio shows about it. */
export interface RunRecord {
  id: string
  /** Platform request id; running rows resume their poll from it after a reload. */
  requestId: string
  surface: Surface
  modelId: string
  modelLabel: string
  prompt: string
  settings: Record<string, unknown>
  /** Owning project, when generated from a project view. */
  projectId?: string
  /** Aspect ratio as width / height, used by the justified feed before media loads. */
  aspect: number
  status: RunStatus
  /** Result URLs: one video or N images. */
  urls: string[]
  error?: string
  /** Reference inputs and input mode the run was submitted with, so "More like this" can resubmit it. */
  media?: MediaItem[]
  inputMode?: string
  /** 1-based place in the local queue; set only on waiting placeholders, never persisted. */
  queued?: number
  starred?: boolean
  completedAt?: number
  /** Deadline passed but the platform never said it failed: offer "Check again". */
  stalled?: boolean
  /** Cancel requested; the next poll decides the final state. */
  canceling?: boolean
  createdAt: number
}

/** Adds runs another tab created and takes its settled copy of any run still
    running here. Returns `current` untouched when nothing changed, so the
    save → broadcast → merge loop between tabs ends.
    ponytail: deletes in one tab are not propagated; add tombstones if needed. */
export function mergeRecords(
  current: RunRecord[],
  stored: RunRecord[]
): RunRecord[] {
  const byId = new Map(current.map((r) => [r.id, r]))
  let changed = false
  const merged = current.map((r) => {
    const other = stored.find((s) => s.id === r.id)
    if (r.status === "running" && other && other.status !== "running") {
      changed = true
      return other
    }
    return r
  })
  const added = stored.filter((s) => !byId.has(s.id))
  if (added.length === 0 && !changed) return current
  return [...merged, ...added].sort((a, b) => b.createdAt - a.createdAt)
}

const KEY = "history.v1"

export async function loadHistory(kv: Kv = defaultKv()): Promise<RunRecord[]> {
  return (await readHistory(kv)).records
}

/** Valid runs, plus how many stored rows were unreadable and left out. */
export async function readHistory(
  kv: Kv = defaultKv()
): Promise<{ records: RunRecord[]; skipped: number }> {
  const stored = await kv.get<unknown>(KEY)
  if (!Array.isArray(stored)) return { records: [], skipped: 0 }
  const records = stored.filter(isRunRecord)
  return { records, skipped: stored.length - records.length }
}

export async function saveHistory(
  records: RunRecord[],
  kv: Kv = defaultKv()
): Promise<void> {
  await kv.set(KEY, capHistory(records))
}

/** Newest-first records, trimmed to the cap; starred runs are never dropped. */
export function capHistory(records: RunRecord[]): RunRecord[] {
  let room = HISTORY_MAX_RECORDS
  return records.filter((r) => r.starred || room-- > 0)
}

function isRunRecord(value: unknown): value is RunRecord {
  if (value === null || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  return (
    typeof r.id === "string" &&
    typeof r.requestId === "string" &&
    typeof r.modelId === "string" &&
    typeof r.prompt === "string" &&
    typeof r.createdAt === "number" &&
    (r.status === "running" ||
      r.status === "completed" ||
      r.status === "failed") &&
    typeof r.aspect === "number" &&
    typeof r.modelLabel === "string" &&
    (r.surface === "image" || r.surface === "video") &&
    r.settings !== null &&
    typeof r.settings === "object" &&
    Array.isArray(r.urls) &&
    r.urls.every((url) => typeof url === "string")
  )
}

/** Parses "16:9" / "9:16" / "1:1" style enum values; 1 when unknown. */
export function aspectFromSettings(settings: Record<string, unknown>): number {
  const raw = settings.aspect_ratio ?? settings.aspectRatio ?? settings.ratio
  if (typeof raw !== "string") return 1
  const [w, h] = raw.split(/[:x/]/).map(Number)
  return w && h ? w / h : 1
}
