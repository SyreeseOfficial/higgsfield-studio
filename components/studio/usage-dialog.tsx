"use client"

import { HISTORY_MAX_RECORDS } from "@/lib/studio/limits"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { RunRecord } from "@/lib/studio/history"
import { getModel } from "@/generation/catalog"
import { brandColor } from "@/lib/studio/model-brand"
import { usageStats, type Usage } from "@/lib/studio/usage"

const fmt = (s: number | null) =>
  s == null ? "–" : s < 60 ? `${Math.round(s)} s` : `${(s / 60).toFixed(1)} min`

/** Local usage stats computed from this browser's history; nothing leaves the device. */
function modelColor(modelId: string): string {
  try {
    return brandColor(getModel(modelId).icon) ?? "#9ca3af"
  } catch {
    return "#9ca3af"
  }
}

/** Stacked bars: one column per day, one segment per model, tinted by its company. */
function Timeline({ timeline }: { timeline: Usage["timeline"] }) {
  const peak = Math.max(1, ...timeline.map((d) => d.total))
  const legend = new Map<string, string>()
  for (const day of timeline)
    for (const m of day.models) legend.set(m.modelId, m.label)
  return (
    <>
      <div
        className="flex h-24 items-end gap-1"
        role="img"
        aria-label={`Runs per day by model: ${timeline
          .map(
            (d) =>
              `${d.day} ${d.total}${d.models.length ? ` (${d.models.map((m) => `${m.label} ${m.runs}`).join(", ")})` : ""}`
          )
          .join("; ")}`}
      >
        {timeline.map((d) => (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="flex w-full flex-col-reverse overflow-hidden rounded"
              style={{ height: `${(d.total / peak) * 100}%` }}
              title={`${d.day}: ${d.total}`}
            >
              {d.models.map((m) => (
                <span
                  key={m.modelId}
                  style={{
                    flexGrow: m.runs,
                    backgroundColor: modelColor(m.modelId),
                  }}
                />
              ))}
            </div>
            <span className="text-[9px] text-muted-foreground">{d.day}</span>
          </div>
        ))}
      </div>
      {legend.size ? (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {[...legend].map(([id, label]) => (
            <li key={id} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-sm"
                style={{ backgroundColor: modelColor(id) }}
              />
              {label}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

export function UsageDialog({
  open,
  onOpenChange,
  records,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: RunRecord[]
}) {
  const usage = usageStats(records)
  const peak = Math.max(1, ...usage.perDay.map((d) => d.runs))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Usage</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-5 text-sm">
            <p className="text-xs text-muted-foreground">
              Based on the runs saved in this browser: the latest{" "}
              {HISTORY_MAX_RECORDS}, plus any you starred. Older runs are not
              counted.
            </p>
            <dl className="grid grid-cols-3 gap-3">
              {[
                ["Runs saved", String(usage.total)],
                [
                  "Success rate",
                  usage.successRate == null
                    ? "–"
                    : `${Math.round(usage.successRate * 100)}%`,
                ],
                ["Median time", fmt(usage.medianSeconds)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/5 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div
              className="flex h-20 items-end gap-2"
              role="img"
              aria-label={`Runs per day: ${usage.perDay.map((d) => `${d.day} ${d.runs}`).join(", ")}`}
            >
              {usage.perDay.map((d) => (
                <div
                  key={d.day}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div
                    className="w-full rounded bg-primary/70"
                    style={{
                      height: `${(d.runs / peak) * 100}%`,
                      minHeight: d.runs ? 2 : 0,
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
            <section aria-label="Activity, last 14 days">
              <h3 className="pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Activity, last 14 days
              </h3>
              <Timeline timeline={usage.timeline} />
            </section>
            <section aria-label="Last 7 days">
              <h3 className="pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Last 7 days
              </h3>
              <p className="tabular-nums">
                {usage.weekly.runs} runs ·{" "}
                {usage.weekly.successRate == null
                  ? "no finished runs"
                  : `${Math.round(usage.weekly.successRate * 100)}% succeeded`}
                {usage.weekly.failed ? ` · ${usage.weekly.failed} failed` : ""}
              </p>
              {usage.weekly.byReason.length ? (
                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {usage.weekly.byReason.map((r) => (
                    <li key={r.reason} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">{r.reason}</span>
                      <span className="tabular-nums">{r.count}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">Model</th>
                  <th className="py-1 text-right font-medium">Runs</th>
                  <th className="py-1 text-right font-medium">Done</th>
                  <th className="py-1 text-right font-medium">Failed</th>
                  <th className="py-1 text-right font-medium">Median</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {usage.byModel.map((m) => (
                  <tr key={m.model} className="border-t border-white/10">
                    <td className="py-1.5">{m.model}</td>
                    <td className="text-right">{m.runs}</td>
                    <td className="text-right">{m.completed}</td>
                    <td className="text-right">{m.failed}</td>
                    <td className="text-right">{fmt(m.medianSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {usage.total === 0 ? (
              <p className="text-muted-foreground">No runs yet.</p>
            ) : null}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
