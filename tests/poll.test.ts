import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { StatusResult } from "@/generation/platform"

const getGenerationStatuses = vi.fn<(data: unknown) => Promise<StatusResult[]>>()
vi.mock("@/generation/actions", () => ({
  getGenerationStatuses: (data: unknown) => getGenerationStatuses(data),
}))

const { POLL_INTERVAL_MS, stopWatching, watchRequest, WatchTimeoutError } =
  await import("@/generation/poll")

const failure = (terminal: boolean): StatusResult => ({
  requestId: "r1",
  error: "boom",
  terminal,
})
const done: StatusResult = {
  requestId: "r1",
  status: { status: "completed", requestId: "r1" },
}

beforeEach(() => {
  vi.useFakeTimers()
  getGenerationStatuses.mockReset()
})
afterEach(() => {
  stopWatching()
  vi.useRealTimers()
})

describe("watchRequest", () => {
  it("rides out transient errors and settles on the later result", async () => {
    getGenerationStatuses
      .mockResolvedValueOnce([failure(false)])
      .mockResolvedValueOnce([failure(false)])
      .mockResolvedValueOnce([done])
    const result = watchRequest("r1")
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
    await expect(result).resolves.toMatchObject({ status: "completed" })
  })

  it("rejects at once on a terminal error", async () => {
    getGenerationStatuses.mockResolvedValue([failure(true)])
    const result = watchRequest("r1")
    const caught = expect(result).rejects.toThrow("boom")
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    await caught
  })

  it("gives up after repeated transient errors", async () => {
    getGenerationStatuses.mockResolvedValue([failure(false)])
    const result = watchRequest("r1")
    const caught = expect(result).rejects.toThrow("boom")
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
    await caught
  })

  it("times out as a WatchTimeoutError, not a failure", async () => {
    getGenerationStatuses.mockResolvedValue([
      { requestId: "r1", status: { status: "in_progress", requestId: "r1" } },
    ])
    const result = watchRequest("r1", { deadline: Date.now() + 1000 })
    const caught = expect(result).rejects.toBeInstanceOf(WatchTimeoutError)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    await caught
  })
})
