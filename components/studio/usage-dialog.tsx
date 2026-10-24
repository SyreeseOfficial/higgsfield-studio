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
import { usageStats } from "@/lib/studio/usage"

const fmt = (s: number | null) =>
  s == null ? "–" : s < 60 ? `${Math.round(s)} s` : `${(s / 60).toFixed(1)} min`

/** Local usage stats computed from this browser's history; nothing leaves the device. */
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
