import { toAuthorizationHeader } from "./credentials"
import { parseUploadTicket, requireUploadContentType } from "./upload-contract"
import type { UploadTicket } from "./upload-contract"

const UPLOAD_PATH = "/files/generate-upload-url"
const DEBUG = process.env.HF_DEBUG === "1"
/** One slow call must not hold up submit, cancel and status checks behind it. */
const REQUEST_TIMEOUT_MS = 30_000
const MODEL_ID = /^[a-z0-9][a-z0-9._/-]*$/i

/** One JSON line per event, never a prompt or reference URL. The request id doubles as the "Support ID" on failed tiles. */
function log(event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    event,
    ...fields,
  })
  if (event === "error") console.error(line)
  else console.info(line)
}

export class PlatformError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(messageFromBody(status, body))
    this.name = "PlatformError"
    this.status = status
    this.body = body
  }
}

export type QueuedGeneration = {
  status: string
  requestId: string
  statusUrl: string
  cancelUrl: string
}

export type GenerationStatus = {
  status: string
  requestId: string
  images?: Array<{ url: string }>
  video?: { url: string }
  error?: unknown
}

/** One request's answer inside a batched status poll. A request that errors
    carries its reason alone, so it cannot lose the answers standing beside it.
    `terminal` is true only when retrying cannot help (unknown request, bad key). */
export type StatusResult =
  | { requestId: string; status: GenerationStatus }
  | { requestId: string; error: string; terminal: boolean }

export type PlatformClientOptions = {
  apiKey: string
  baseUrl: string
  fetch?: typeof fetch
}

export function isModelId(model: string): boolean {
  return MODEL_ID.test(model) && !model.includes("..")
}

export function createPlatformClient(options: PlatformClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "")
  const fetchImpl = options.fetch ?? fetch
  const auth = toAuthorizationHeader(options.apiKey)

  async function send(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
    extraHeaders?: Record<string, string>
  ) {
    const url = `${baseUrl}${path}`
    // Prompts and reference URLs live in bodies; only HF_DEBUG=1 logs them.
    if (DEBUG)
      console.info("[platform] request", { method, url, body: body ?? null })
    let response: Response
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          Authorization: auth,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...extraHeaders,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (caught) {
      // The job may exist: 408 / 502 are treated as "unknown", never "refused".
      const timedOut = caught instanceof Error && caught.name === "TimeoutError"
      log("error", { method, path, status: timedOut ? 408 : 502 })
      throw new PlatformError(timedOut ? 408 : 502, {
        detail: timedOut
          ? "Higgsfield did not answer in time. Check again in a moment."
          : "Could not reach Higgsfield. Check your connection and try again.",
      })
    }

    const payload = await readJson(response)
    // Signed upload URLs are credentials; do not write them to logs.
    if (DEBUG)
      console.info("[platform] response", {
        method,
        url,
        status: response.status,
        ...(path === UPLOAD_PATH ? {} : { body: payload }),
      })
    if (!response.ok) {
      log("error", { method, path, status: response.status })
      throw new PlatformError(response.status, payload)
    }
    return payload
  }

  return {
    async createUpload(contentType: unknown): Promise<UploadTicket> {
      const type = requireUploadContentType(contentType)
      return parseUploadTicket(
        await send("POST", UPLOAD_PATH, { content_type: type }),
        type
      )
    },
    async submit(
      model: string,
      input: Record<string, unknown>,
      idempotencyKey?: string
    ): Promise<QueuedGeneration> {
      if (!isModelId(model))
        throw new PlatformError(400, { detail: "Invalid model" })
      const queued = mapQueued(
        await send(
          "POST",
          `/${model}`,
          input,
          idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
        )
      )
      log("submit", { model, requestId: queued.requestId })
      return queued
    },
    async status(requestId: string): Promise<GenerationStatus> {
      if (!requestId)
        throw new PlatformError(400, { detail: "Missing request id" })
      return mapStatus(
        await send("GET", `/requests/${encodeURIComponent(requestId)}/status`)
      )
    },
    /** Queued requests only; the platform answers 202 and the status turns "canceled". */
    async cancel(requestId: string): Promise<void> {
      if (!requestId)
        throw new PlatformError(400, { detail: "Missing request id" })
      log("cancel", { requestId })
      await send(
        "POST",
        `/requests/${encodeURIComponent(requestId)}/cancel`,
        {}
      )
    },
  }
}

function mapQueued(payload: unknown): QueuedGeneration {
  const data = asRecord(payload)
  const requestId = stringField(data, "request_id")
  if (!requestId)
    throw new PlatformError(502, {
      detail: "Platform response missing request_id",
    })
  return {
    status: stringField(data, "status") ?? "queued",
    requestId,
    statusUrl: stringField(data, "status_url") ?? "",
    cancelUrl: stringField(data, "cancel_url") ?? "",
  }
}

function mapStatus(payload: unknown): GenerationStatus {
  const data = asRecord(payload)
  const requestId = stringField(data, "request_id") ?? ""
  const images = Array.isArray(data.images)
    ? data.images.flatMap((item) => {
        const url = asRecord(item).url
        return typeof url === "string" ? [{ url }] : []
      })
    : undefined
  const videoUrl = asRecord(data.video).url

  return {
    status: stringField(data, "status") ?? "unknown",
    requestId,
    ...(images?.length ? { images } : {}),
    ...(typeof videoUrl === "string" ? { video: { url: videoUrl } } : {}),
    ...(data.error !== undefined ? { error: data.error } : {}),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringField(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const field = value[key]
  return typeof field === "string" ? field : undefined
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function messageFromBody(status: number, body: unknown): string {
  const detail = asRecord(body).detail
  if (typeof detail === "string" && detail) return detail
  return `Platform request failed (${status})`
}
