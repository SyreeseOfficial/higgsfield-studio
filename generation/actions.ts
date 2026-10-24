"use server"

import { cookies } from "next/headers"

import { getModel, parseSettings } from "./catalog"
import type { GenerationPlane } from "./catalog/types"
import {
  MissingCredentialsError,
  PLATFORM_KEY_COOKIE,
  PLATFORM_KEY_COOKIE_OPTIONS,
  decodeCredentials,
  encodeCredentials,
  parseCredentialInput,
} from "./credentials"
import { friendlyError } from "./errors"
import { PlatformError, createPlatformClient } from "./platform"
import type { QueuedGeneration, StatusResult } from "./platform"
import { fail, ok, type Result } from "./result"
import { toPlatform } from "./to-platform"

// Keep in step with STATUS_BATCH in poll.ts.
const MAX_STATUS_IDS = 50
const STATUS_CONCURRENCY = 8

export async function savePlatformCredentials(data: unknown): Promise<Result> {
  try {
    const { apiKey } = parseCredentialInput(data)
    const jar = await cookies()
    jar.set(
      PLATFORM_KEY_COOKIE,
      encodeCredentials(apiKey),
      PLATFORM_KEY_COOKIE_OPTIONS
    )
    return ok(undefined)
  } catch (caught) {
    return fail(caught)
  }
}

export async function clearPlatformCredentials() {
  const jar = await cookies()
  jar.set(PLATFORM_KEY_COOKIE, "", {
    ...PLATFORM_KEY_COOKIE_OPTIONS,
    maxAge: 0,
  })
}

/** Last four characters of the saved key, for a "connected" badge; the rest never leaves the server. */
export async function platformKeyTail(): Promise<string | null> {
  const stored = await readStoredCredentials()
  return stored ? stored.apiKey.slice(-4) : null
}

export async function hasPlatformCredentials() {
  return (await readStoredCredentials()) !== null
}

/** `auth`: the key is missing or refused. `rejected`: the platform definitely
    did not take the job, so a retry may use a fresh idempotency key. `unknown`:
    it may have taken it (5xx, dropped connection), so the retry must reuse the key. */
export type SubmitFailure = "auth" | "rejected" | "unknown"

export type SubmitResult =
  | { ok: true; queued: QueuedGeneration }
  | { ok: false; kind: SubmitFailure; error: string }

export async function submitGeneration(
  plane: GenerationPlane,
  idempotencyKey?: string
): Promise<SubmitResult> {
  try {
    const model = getModel(plane.model)
    const parsed: GenerationPlane = {
      ...plane,
      settings: parseSettings(model, plane.settings),
    }
    const { path, body } = toPlatform(parsed)
    const client = createPlatformClient(await readCredentials())
    return { ok: true, queued: await client.submit(path, body, idempotencyKey) }
  } catch (caught) {
    const raw = caught instanceof Error ? caught.message : String(caught)
    const error = friendlyError(
      raw,
      caught instanceof PlatformError ? caught.status : undefined
    )
    if (caught instanceof MissingCredentialsError)
      return { ok: false, kind: "auth", error }
    if (caught instanceof PlatformError) {
      if (caught.status === 401 || caught.status === 403)
        return { ok: false, kind: "auth", error }
      return {
        ok: false,
        kind: caught.status < 500 ? "rejected" : "unknown",
        error,
      }
    }
    return { ok: false, kind: "rejected", error }
  }
}

/** Every request in flight, answered in one round trip. Next dispatches server
    actions one at a time per client, so a poll per run would queue ahead of the
    next submit — the fan-out belongs on this side of the call, where it is
    genuinely parallel. */
export async function getGenerationStatuses(
  data: unknown
): Promise<StatusResult[]> {
  const requestIds = [...new Set(parseRequestIds(data))]
  if (requestIds.length > MAX_STATUS_IDS)
    throw new Error("Too many request ids")
  const client = createPlatformClient(await readCredentials())
  const results: StatusResult[] = []
  for (let i = 0; i < requestIds.length; i += STATUS_CONCURRENCY) {
    results.push(
      ...(await Promise.all(
        requestIds
          .slice(i, i + STATUS_CONCURRENCY)
          .map(async (requestId): Promise<StatusResult> => {
            try {
              return { requestId, status: await client.status(requestId) }
            } catch (caught) {
              return {
                requestId,
                error:
                  caught instanceof Error ? caught.message : String(caught),
                // A 5xx, 429 or dropped connection says nothing about the job.
                terminal:
                  caught instanceof PlatformError &&
                  caught.status >= 400 &&
                  caught.status < 500 &&
                  caught.status !== 408 &&
                  caught.status !== 429,
              }
            }
          })
      ))
    )
  }
  return results
}

export async function cancelGeneration(data: unknown): Promise<Result> {
  try {
    const [requestId] = parseRequestIds(data)
    await createPlatformClient(await readCredentials()).cancel(requestId!)
    return ok(undefined)
  } catch (caught) {
    return fail(caught)
  }
}

async function readStoredCredentials() {
  const jar = await cookies()
  return decodeCredentials(jar.get(PLATFORM_KEY_COOKIE)?.value)
}

async function readCredentials() {
  const stored = await readStoredCredentials()
  if (!stored) throw new MissingCredentialsError()
  const baseUrl = process.env.HF_API_BASE_URL
  if (!baseUrl) throw new Error("Missing HF_API_BASE_URL")
  return { ...stored, baseUrl }
}

function parseRequestIds(data: unknown): string[] {
  const payload = asObject(data, "Invalid status payload")
  const requestIds = payload.requestIds
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    throw new Error("Invalid request ids")
  }
  return requestIds.map((requestId) => {
    if (typeof requestId !== "string" || !requestId)
      throw new Error("Invalid request id")
    return requestId
  })
}

function asObject(data: unknown, message: string): Record<string, unknown> {
  if (data === null || typeof data !== "object" || Array.isArray(data))
    throw new Error(message)
  return data as Record<string, unknown>
}
