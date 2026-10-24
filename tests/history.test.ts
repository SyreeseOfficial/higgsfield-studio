import { describe, expect, it } from "vitest"

import {
  capHistory,
  mergeRecords,
  readHistory,
  saveHistory,
  type RunRecord,
} from "@/lib/studio/history"
import type { Kv } from "@/lib/studio/kv"
import { HISTORY_MAX_RECORDS } from "@/lib/studio/limits"

const memoryKv = (): Kv & { data: Map<string, unknown> } => {
  const data = new Map<string, unknown>()
  return {
    data,
    get: async <T>(key: string) => data.get(key) as T | undefined,
    set: async (key, value) => void data.set(key, value),
    del: async (key) => void data.delete(key),
  }
}

const run = (id: number, patch: Partial<RunRecord> = {}): RunRecord => ({
  id: String(id),
  requestId: `r${id}`,
  surface: "image",
  modelId: "m",
  modelLabel: "M",
  prompt: "p",
  settings: {},
  aspect: 1,
  status: "completed",
  urls: ["https://x/a.png"],
  createdAt: id,
  ...patch,
})

describe("readHistory", () => {
  it("skips unreadable rows, counts them and keeps order", async () => {
    const kv = memoryKv()
    kv.data.set("history.v1", [run(3), { id: "bad" }, null, 7, run(2), run(1)])
    const { records, skipped } = await readHistory(kv)
    expect(records.map((r) => r.id)).toEqual(["3", "2", "1"])
    expect(skipped).toBe(3)
  })

  it("is empty for missing or non-array data", async () => {
    expect(await readHistory(memoryKv())).toEqual({ records: [], skipped: 0 })
    const kv = memoryKv()
    kv.data.set("history.v1", { not: "an array" })
    expect((await readHistory(kv)).records).toEqual([])
  })
})

describe("saveHistory cap", () => {
  const many = Array.from({ length: HISTORY_MAX_RECORDS + 20 }, (_, i) =>
    run(1000 - i, i === HISTORY_MAX_RECORDS + 10 ? { starred: true } : {})
  )

  it("keeps the newest runs and every starred run", () => {
    const kept = capHistory(many)
    expect(kept.length).toBe(HISTORY_MAX_RECORDS + 1)
    expect(kept.at(-1)?.starred).toBe(true)
    expect(kept.slice(0, HISTORY_MAX_RECORDS)).toEqual(
      many.slice(0, HISTORY_MAX_RECORDS)
    )
  })

  it("writes the capped list", async () => {
    const kv = memoryKv()
    await saveHistory(many, kv)
    expect((await readHistory(kv)).records.length).toBe(HISTORY_MAX_RECORDS + 1)
  })
})

describe("mergeRecords (two tabs)", () => {
  it("returns the same array when nothing changed", () => {
    const current = [run(2), run(1)]
    expect(mergeRecords(current, [run(2), run(1)])).toBe(current)
  })

  it("adds runs from the other tab, newest first", () => {
    const merged = mergeRecords([run(3), run(1)], [run(2), run(1)])
    expect(merged.map((r) => r.id)).toEqual(["3", "2", "1"])
  })

  it("takes the other tab's settled copy of a run still running here", () => {
    const merged = mergeRecords(
      [run(1, { status: "running", urls: [] })],
      [run(1, { status: "completed" })]
    )
    expect(merged[0]?.status).toBe("completed")
  })
})
