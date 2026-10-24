import type { RunRecord } from "./history"

export interface ModelUsage {
  model: string
  runs: number
  completed: number
  failed: number
  /** Median seconds from submit to result, over runs that recorded a finish time. */
  medianSeconds: number | null
}

export interface Usage {
  total: number
  /** Completed / (completed + failed); null before any run has finished. */
  successRate: number | null
  medianSeconds: number | null
  byModel: ModelUsage[]
  /** Runs per day, oldest first, for the last `days` days. */
  perDay: { day: string; runs: number }[]
  /** The last 14 days, each split by model. */
  timeline: { day: string; total: number; models: TimelineModel[] }[]
  /** The last 7 days in one place. */
  weekly: {
    runs: number
    completed: number
    failed: number
    successRate: number | null
    /** Why runs failed, most common first (top 5). */
    byReason: { reason: string; count: number }[]
  }
}

export interface TimelineModel {
  modelId: string
  label: string
  runs: number
}

const TIMELINE_DAYS = 14
const WEEK_DAYS = 7

/** Local midnight `ago` calendar days before `today`; calendar maths, so a 23- or 25-hour day does not shift the buckets. */
function dayStart(today: number, ago: number): number {
  const d = new Date(today)
  d.setDate(d.getDate() - ago)
  return d.getTime()
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}

const seconds = (r: RunRecord) =>
  r.status === "completed" && r.completedAt
    ? (r.completedAt - r.createdAt) / 1000
    : null

export function usageStats(
  records: RunRecord[],
  days = 7,
  now = Date.now()
): Usage {
  const done = records.filter((r) => r.status !== "running")
  const finished = (rs: RunRecord[]) =>
    rs.filter((r) => r.status === "completed").length
  const byModel = new Map<string, RunRecord[]>()
  for (const r of records)
    byModel.set(r.modelLabel, [...(byModel.get(r.modelLabel) ?? []), r])

  const today = new Date(now).setHours(0, 0, 0, 0)
  const inDay = (ago: number) => {
    const start = dayStart(today, ago)
    const end = dayStart(today, ago - 1)
    return {
      start,
      runs: records.filter((r) => r.createdAt >= start && r.createdAt < end),
    }
  }
  const perDay = Array.from({ length: days }, (_, i) => {
    const { start, runs } = inDay(days - 1 - i)
    return {
      day: new Date(start).toLocaleDateString(undefined, { weekday: "short" }),
      runs: runs.length,
    }
  })
  const timeline = Array.from({ length: TIMELINE_DAYS }, (_, i) => {
    const { start, runs } = inDay(TIMELINE_DAYS - 1 - i)
    const models = new Map<string, TimelineModel>()
    for (const r of runs) {
      const m = models.get(r.modelId) ?? {
        modelId: r.modelId,
        label: r.modelLabel,
        runs: 0,
      }
      m.runs++
      models.set(r.modelId, m)
    }
    return {
      day: new Date(start).toLocaleDateString(undefined, {
        month: "numeric",
        day: "numeric",
      }),
      total: runs.length,
      models: [...models.values()].sort((a, b) => b.runs - a.runs),
    }
  })
  const week = records.filter(
    (r) => r.createdAt >= dayStart(today, WEEK_DAYS - 1)
  )
  const weekDone = week.filter((r) => r.status !== "running")
  const reasons = new Map<string, number>()
  for (const r of week)
    if (r.status === "failed") {
      const reason = r.error || "Unknown reason"
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
    }

  return {
    total: records.length,
    successRate: done.length ? finished(done) / done.length : null,
    medianSeconds: median(records.flatMap((r) => seconds(r) ?? [])),
    byModel: [...byModel]
      .map(([model, rs]) => ({
        model,
        runs: rs.length,
        completed: finished(rs),
        failed: rs.filter((r) => r.status === "failed").length,
        medianSeconds: median(rs.flatMap((r) => seconds(r) ?? [])),
      }))
      .sort((a, b) => b.runs - a.runs),
    perDay,
    timeline,
    weekly: {
      runs: week.length,
      completed: finished(week),
      failed: week.filter((r) => r.status === "failed").length,
      successRate: weekDone.length
        ? finished(weekDone) / weekDone.length
        : null,
      byReason: [...reasons]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    },
  }
}
