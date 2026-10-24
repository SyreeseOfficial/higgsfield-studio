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
  const perDay = Array.from({ length: days }, (_, i) => {
    const start = today - (days - 1 - i) * 86_400_000
    return {
      day: new Date(start).toLocaleDateString(undefined, { weekday: "short" }),
      runs: records.filter(
        (r) => r.createdAt >= start && r.createdAt < start + 86_400_000
      ).length,
    }
  })

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
  }
}
