import { describe, expect, it, vi } from "vitest"

import { PlatformError, createPlatformClient } from "@/generation/platform"
import { createMockPlatform } from "@/generation/mock-platform"

const reply = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status })

/** A client whose fetch is scripted: each call returns the next response. */
function scripted(...responses: (Response | Error)[]) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    const next = responses.shift()
    if (next instanceof Error) throw next
    return next ?? reply(500, {})
  })
  return {
    fetch,
    client: createPlatformClient({
      apiKey: "k-123",
      baseUrl: "https://api.test/",
      fetch,
    }),
  }
}

describe("platform client against recorded-shape responses", () => {
  it("submits with the key and idempotency key, and maps the queue reply", async () => {
    const { client, fetch } = scripted(
      reply(200, {
        request_id: "r1",
        status: "queued",
        status_url: "https://s",
        cancel_url: "https://c",
      })
    )
    const queued = await client.submit(
      "vendor/model",
      { prompt: "hi" },
      "idem-1"
    )
    expect(queued).toEqual({
      requestId: "r1",
      status: "queued",
      statusUrl: "https://s",
      cancelUrl: "https://c",
    })
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe("https://api.test/vendor/model")
    const headers = new Headers(init?.headers)
    expect(headers.get("Authorization")).toBe("Key k-123")
    expect(headers.get("Idempotency-Key")).toBe("idem-1")
    expect(JSON.parse(String(init?.body))).toEqual({ prompt: "hi" })
  })

  it("maps image and video results and ignores malformed entries", async () => {
    const { client } = scripted(
      reply(200, {
        request_id: "r",
        status: "completed",
        images: [{ url: "https://a" }, { nope: 1 }, "x"],
      }),
      reply(200, {
        request_id: "r",
        status: "completed",
        video: { url: "https://v" },
      }),
      reply(200, {
        request_id: "r",
        status: "failed",
        error: { detail: "boom" },
      })
    )
    expect(await client.status("r")).toEqual({
      requestId: "r",
      status: "completed",
      images: [{ url: "https://a" }],
    })
    expect(await client.status("r")).toMatchObject({
      video: { url: "https://v" },
    })
    expect(await client.status("r")).toMatchObject({
      status: "failed",
      error: { detail: "boom" },
    })
  })

  it.each([
    [401, { detail: "Invalid API key" }],
    [402, { detail: "Payment required" }],
    [429, { detail: "Too many requests" }],
    [500, "<html>oops</html>"],
  ])(
    "turns HTTP %i into a PlatformError carrying the status",
    async (status, body) => {
      const { client } = scripted(reply(status, body))
      await expect(client.submit("m", {})).rejects.toMatchObject({
        name: "PlatformError",
        status,
      })
    }
  )

  it("rejects a reply with no request id as a bad gateway", async () => {
    const { client } = scripted(reply(200, { status: "queued" }))
    await expect(client.submit("m", {})).rejects.toMatchObject({ status: 502 })
  })

  it("treats a dropped connection as 502 and a timeout as 408 (job may exist)", async () => {
    const { client } = scripted(
      new TypeError("fetch failed"),
      Object.assign(new Error("timed out"), { name: "TimeoutError" })
    )
    await expect(client.submit("m", {})).rejects.toMatchObject({ status: 502 })
    await expect(client.submit("m", {})).rejects.toMatchObject({ status: 408 })
  })

  it("refuses model ids that could escape the path", async () => {
    const { client, fetch } = scripted()
    await expect(client.submit("../admin", {})).rejects.toBeInstanceOf(
      PlatformError
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it("cancel posts to the request's cancel route", async () => {
    const { client, fetch } = scripted(reply(202, undefined))
    await client.cancel("r 1")
    expect(fetch.mock.calls[0]![0]).toBe(
      "https://api.test/requests/r%201/cancel"
    )
  })
})

describe("mock platform (HF_MOCK)", () => {
  const setup = () => {
    let t = 1_000_000
    const mock = createMockPlatform({ now: () => t })
    const client = createPlatformClient({
      apiKey: "k",
      baseUrl: "http://mock.local",
      fetch: mock.fetch,
    })
    return { client, mock, advance: (ms: number) => (t += ms) }
  }

  it("runs a job from queued to completed", async () => {
    const { client, advance } = setup()
    const { requestId } = await client.submit("vendor/image", {
      prompt: "a cat",
    })
    expect((await client.status(requestId)).status).toBe("queued")
    advance(1500)
    expect((await client.status(requestId)).status).toBe("in_progress")
    advance(3000)
    expect(await client.status(requestId)).toMatchObject({
      status: "completed",
      images: [{ url: expect.stringContaining(requestId) }],
    })
  })

  it("returns a video for video requests", async () => {
    const { client, advance } = setup()
    const { requestId } = await client.submit("kling-video/x", {
      prompt: "p",
      duration: 5,
    })
    advance(7000)
    expect(await client.status(requestId)).toMatchObject({
      video: { url: expect.stringMatching(/\.mp4$/) },
    })
  })

  it.each([
    ["[nsfw]", "nsfw"],
    ["[fail]", "failed"],
  ])("%s ends as %s", async (token, status) => {
    const { client, advance } = setup()
    const { requestId } = await client.submit("m", { prompt: `x ${token}` })
    advance(4000)
    expect((await client.status(requestId)).status).toBe(status)
  })

  it.each([
    ["[ratelimit]", 429],
    ["[credits]", 402],
    ["[badkey]", 401],
    ["[500]", 500],
  ])("%s is refused with %i", async (token, status) => {
    const { client } = setup()
    await expect(client.submit("m", { prompt: token })).rejects.toMatchObject({
      status,
    })
  })

  it("answers a repeated idempotency key with the same job", async () => {
    const { client } = setup()
    const a = await client.submit("m", { prompt: "p" }, "same")
    const b = await client.submit("m", { prompt: "p" }, "same")
    const c = await client.submit("m", { prompt: "p" }, "other")
    expect(b.requestId).toBe(a.requestId)
    expect(c.requestId).not.toBe(a.requestId)
  })

  it("cancels only while queued", async () => {
    const { client, advance } = setup()
    const queued = await client.submit("m", { prompt: "p" })
    await client.cancel(queued.requestId)
    expect((await client.status(queued.requestId)).status).toBe("canceled")
    const running = await client.submit("m", { prompt: "q" })
    advance(2000)
    await expect(client.cancel(running.requestId)).rejects.toMatchObject({
      status: 400,
    })
  })

  it("404s an unknown request and requires a key", async () => {
    const { client, mock } = setup()
    await expect(client.status("nope")).rejects.toMatchObject({ status: 404 })
    expect(
      (await mock.fetch("http://mock.local/requests/x/status")).status
    ).toBe(401)
  })
})
