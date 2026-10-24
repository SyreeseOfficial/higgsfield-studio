/**
 * An in-memory stand-in for the Higgsfield platform: same routes, same JSON
 * shapes, no network and no credits. Tests inject `mock.fetch` into
 * `createPlatformClient`; `HF_MOCK=1` makes the server use it for demos.
 *
 * Behaviour is picked by a token in the prompt:
 *   [nsfw] blocked · [fail] failed · [empty] "completed" with no media ·
 *   [slow] stays running · [ratelimit] 429 · [credits] 402 · [badkey] 401 · [500] server error
 */
export const MOCK_BASE_URL = "http://mock.local"

type Job = {
  id: string
  prompt: string
  video: boolean
  createdAt: number
  canceled: boolean
}

const QUEUED_MS = 1000
const IMAGE_MS = 3000
const VIDEO_MS = 6000

export type MockPlatform = ReturnType<typeof createMockPlatform>

export function createMockPlatform({ now = Date.now } = {}) {
  const jobs = new Map<string, Job>()
  const byKey = new Map<string, string>()
  let counter = 0

  const json = (status: number, body: unknown) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })

  function submit(
    path: string,
    body: Record<string, unknown>,
    key: string | null
  ) {
    const prompt = typeof body.prompt === "string" ? body.prompt : ""
    if (prompt.includes("[badkey]"))
      return json(401, { detail: "Invalid API key" })
    if (prompt.includes("[credits]"))
      return json(402, { detail: "Payment required" })
    if (prompt.includes("[ratelimit]"))
      return json(429, { detail: "Too many requests" })
    if (prompt.includes("[500]"))
      return json(500, { detail: "Internal Server Error" })
    const known = key ? byKey.get(key) : undefined
    const id =
      known ??
      `mock-${++counter}-${Math.abs(hash(prompt + counter)).toString(36)}`
    if (!known) {
      jobs.set(id, {
        id,
        prompt,
        video: /video|i2v|t2v|motion/i.test(path) || "duration" in body,
        createdAt: now(),
        canceled: false,
      })
      if (key) byKey.set(key, id)
    }
    return json(200, {
      request_id: id,
      status: "queued",
      status_url: `${MOCK_BASE_URL}/requests/${id}/status`,
      cancel_url: `${MOCK_BASE_URL}/requests/${id}/cancel`,
    })
  }

  function status(job: Job) {
    if (job.canceled) return { request_id: job.id, status: "canceled" }
    const age = now() - job.createdAt
    const length = job.prompt.includes("[slow]")
      ? 10 * 60_000
      : job.video
        ? VIDEO_MS
        : IMAGE_MS
    if (age < QUEUED_MS) return { request_id: job.id, status: "queued" }
    if (age < length) return { request_id: job.id, status: "in_progress" }
    if (job.prompt.includes("[nsfw]"))
      return { request_id: job.id, status: "nsfw" }
    if (job.prompt.includes("[fail]"))
      return {
        request_id: job.id,
        status: "failed",
        error: { detail: "The model crashed" },
      }
    if (job.prompt.includes("[empty]"))
      return { request_id: job.id, status: "completed" }
    return job.video
      ? {
          request_id: job.id,
          status: "completed",
          video: { url: `/api/mock/media/${job.id}.mp4` },
        }
      : {
          request_id: job.id,
          status: "completed",
          images: [{ url: `/api/mock/media/${job.id}.svg` }],
        }
  }

  const mockFetch: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    )
    const method = init?.method ?? "GET"
    const headers = new Headers(init?.headers)
    const path = url.pathname
    if (!headers.get("Authorization"))
      return json(401, { detail: "Missing API key" })

    if (method === "POST" && path === "/files/generate-upload-url") {
      const id = `up-${++counter}`
      const type = JSON.parse(String(init?.body ?? "{}")).content_type as string
      return json(200, {
        upload_url: `https://mock.local/upload/${id}`,
        public_url: `https://mock.local/files/${id}`,
        content_type: type,
        upload_headers: { "Content-Type": type },
      })
    }
    const status_ = path.match(/^\/requests\/([^/]+)\/status$/)
    if (method === "GET" && status_) {
      const job = jobs.get(decodeURIComponent(status_[1]!))
      return job
        ? json(200, status(job))
        : json(404, { detail: "Request not found" })
    }
    const cancel = path.match(/^\/requests\/([^/]+)\/cancel$/)
    if (method === "POST" && cancel) {
      const job = jobs.get(decodeURIComponent(cancel[1]!))
      if (!job) return json(404, { detail: "Request not found" })
      if (now() - job.createdAt >= QUEUED_MS)
        return json(400, { detail: "Only queued requests can be canceled" })
      job.canceled = true
      return json(202, null)
    }
    if (method === "POST" && !path.startsWith("/requests/"))
      return submit(
        path,
        JSON.parse(String(init?.body ?? "{}")),
        headers.get("Idempotency-Key")
      )
    return json(404, { detail: "Not found" })
  }

  return {
    fetch: mockFetch,
    /** The prompt behind a result, for drawing its picture. */
    prompt: (id: string) => jobs.get(id)?.prompt,
    reset() {
      jobs.clear()
      byKey.clear()
    },
  }
}

function hash(text: string): number {
  let h = 0
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0
  return h
}

/** One shared instance per server process, for HF_MOCK=1. */
export const mockPlatform = createMockPlatform()

export const isMockMode = () => process.env.HF_MOCK === "1"

/** SVG picture for a mock image result. */
export function mockImageSvg(id: string): string {
  const prompt = mockPlatform.prompt(id) ?? "mock result"
  const hue = Math.abs(hash(id)) % 360
  const text = prompt.replace(/[<>&"]/g, " ").slice(0, 60)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 35%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 70% 15%)"/></linearGradient></defs><rect width="1024" height="768" fill="url(#g)"/><text x="512" y="384" fill="white" font-family="sans-serif" font-size="32" text-anchor="middle">${text}</text><text x="512" y="430" fill="white" opacity=".6" font-family="sans-serif" font-size="20" text-anchor="middle">mock result</text></svg>`
}
