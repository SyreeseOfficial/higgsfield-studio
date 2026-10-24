import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createPlatformClient } from "@/generation/platform"
import { createMockPlatform } from "@/generation/mock-platform"
import type { StatusResult } from "@/generation/platform"

// Drive the real poller against the in-memory platform, as the server action would.
let now = 1_000_000
const mock = createMockPlatform({ now: () => now })
const client = createPlatformClient({
  apiKey: "k",
  baseUrl: "http://mock.local",
  fetch: mock.fetch,
})
const calls: number[] = []

vi.mock("@/generation/actions", () => ({
  getGenerationStatuses: async (data: {
    requestIds: string[]
  }): Promise<StatusResult[]> => {
    calls.push(data.requestIds.length)
    return Promise.all(
      data.requestIds.map(async (requestId): Promise<StatusResult> => {
        try {
          return { requestId, status: await client.status(requestId) }
        } catch (caught) {
          return { requestId, error: String(caught), terminal: true }
        }
      })
    )
  },
}))

const { stopWatching, watchRequest } = await import("@/generation/poll")

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  calls.length = 0
  mock.reset()
})
afterEach(() => {
  stopWatching()
  vi.useRealTimers()
})

describe("polling under load", () => {
  it("settles 130 mixed runs exactly once each, in batches of at most 50", async () => {
    const tokens = ["", "", "[nsfw]", "[fail]", "[empty]"]
    const jobs = await Promise.all(
      Array.from({ length: 130 }, async (_, i) => {
        const token = tokens[i % tokens.length]!
        const { requestId } = await client.submit("m", {
          prompt: `run ${i} ${token}`,
        })
        return { requestId, token }
      })
    )
    const settled = new Map<string, string>()
    const watches = jobs.map(({ requestId }) =>
      watchRequest(requestId).then((s) => {
        expect(settled.has(requestId)).toBe(false) // never twice
        settled.set(requestId, s.status)
      })
    )
    // Move both the fake timers and the mock's clock forward.
    for (let i = 0; i < 6; i++) {
      now += 4000
      await vi.advanceTimersByTimeAsync(4000)
    }
    await Promise.all(watches)

    expect(settled.size).toBe(130)
    for (const { requestId, token } of jobs) {
      const want =
        token === "[nsfw]"
          ? "nsfw"
          : token === "[fail]"
            ? "failed"
            : "completed"
      expect(settled.get(requestId)).toBe(want)
    }
    expect(Math.max(...calls)).toBeLessThanOrEqual(50)
  })

  it("a run the platform has forgotten fails alone, the rest finish", async () => {
    const real = await client.submit("m", { prompt: "ok" })
    const lost = watchRequest("does-not-exist")
    const found = watchRequest(real.requestId)
    const lostCaught = expect(lost).rejects.toThrow()
    now += 5000
    await vi.advanceTimersByTimeAsync(5000)
    await lostCaught
    now += 4000
    await vi.advanceTimersByTimeAsync(4000)
    await expect(found).resolves.toMatchObject({ status: "completed" })
  })
})
