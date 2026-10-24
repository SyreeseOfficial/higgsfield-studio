"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { cancelGeneration, submitGeneration } from "@/generation/actions"
import { getModel } from "@/generation/catalog"
import { friendlyError } from "@/generation/errors"
import { groupMedia } from "@/generation/catalog/media-inputs"
import type { GenerationPlane } from "@/generation/catalog"
import type { GenerationStatus } from "@/generation/platform"
import {
  WatchTimeoutError,
  stopWatching,
  watchRequest,
} from "@/generation/poll"

import {
  aspectFromSettings,
  loadHistory,
  readHistory,
  saveHistory,
  type RunRecord,
} from "./history"

export const MAX_RUNNING = 2
const MAX_QUEUED = 20
const IMAGE_DEADLINE_MS = 15 * 60_000
const VIDEO_DEADLINE_MS = 40 * 60_000
const CHANNEL = "studio-history"

/** Adds runs another tab created and takes its settled copy of any run still
    running here. Returns `current` untouched when nothing changed, so the
    save → broadcast → merge loop between tabs ends.
    ponytail: deletes in one tab are not propagated; add tombstones if needed. */
function mergeRecords(current: RunRecord[], stored: RunRecord[]): RunRecord[] {
  const byId = new Map(current.map((r) => [r.id, r]))
  let changed = false
  const merged = current.map((r) => {
    const other = stored.find((s) => s.id === r.id)
    if (r.status === "running" && other && other.status !== "running") {
      changed = true
      return other
    }
    return r
  })
  const added = stored.filter((s) => !byId.has(s.id))
  if (added.length === 0 && !changed) return current
  return [...merged, ...added].sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * The studio's generation controller: submits planes to the platform through
 * the server action, keeps every run in IndexedDB-backed history, and resumes
 * polls for runs that were still in flight when the page reloaded.
 */
export function useRuns({ onAuthError }: { onAuthError?: () => void } = {}) {
  const [records, setRecords] = useState<RunRecord[]>([])
  // Planes waiting for a free slot; lost on reload (only sent runs are history).
  const [queue, setQueue] = useState<
    { record: RunRecord; plane: GenerationPlane; projectId?: string }[]
  >([])
  const [pump, setPump] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Blocks a second submit while the first is still awaiting the platform.
  const submitting = useRef(false)
  // Key of an attempt whose outcome is unknown, reused if the same plane is retried.
  const pending = useRef<{ fingerprint: string; key: string } | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)
  const onAuthErrorRef = useRef(onAuthError)
  useEffect(() => {
    onAuthErrorRef.current = onAuthError
  })

  const update = useCallback((id: string, patch: Partial<RunRecord>) => {
    setRecords((current) =>
      current.map((r) => (r.id === id ? { ...r, ...patch } : r))
    )
  }, [])

  const watch = useCallback(
    (record: RunRecord, from = record.createdAt) => {
      const limit =
        record.surface === "video" ? VIDEO_DEADLINE_MS : IMAGE_DEADLINE_MS
      watchRequest(record.requestId, { deadline: from + limit })
        .then((status) => update(record.id, settle(status)))
        .catch((caught: unknown) => {
          // Slow is not failed: the platform may still finish (and bill) it.
          if (caught instanceof WatchTimeoutError)
            return update(record.id, { stalled: true })
          update(record.id, {
            status: "failed",
            canceling: false,
            error: caught instanceof Error ? caught.message : String(caught),
          })
        })
    },
    [update]
  )

  useEffect(() => {
    let alive = true
    void readHistory().then(({ records: stored, skipped }) => {
      if (!alive) return
      if (skipped)
        setError(
          `${skipped} saved ${skipped === 1 ? "run was" : "runs were"} unreadable and left out.`
        )
      setRecords(stored)
      setLoaded(true)
      for (const record of stored)
        if (record.status === "running") watch(record)
    })
    const bc = new BroadcastChannel(CHANNEL)
    channel.current = bc
    bc.onmessage = () =>
      void loadHistory().then((stored) =>
        setRecords((current) => mergeRecords(current, stored))
      )
    return () => {
      alive = false
      bc.close()
      channel.current = null
      stopWatching()
    }
  }, [watch])

  // Writes are batched for 250 ms, and flushed if the tab goes away first.
  const latest = useRef(records)
  useEffect(() => {
    latest.current = records
    if (!loaded) return
    const timer = setTimeout(
      () =>
        void saveHistory(records).then(() => channel.current?.postMessage(0)),
      250
    )
    return () => clearTimeout(timer)
  }, [loaded, records])
  useEffect(() => {
    const flush = () => {
      if (loaded) void saveHistory(latest.current)
    }
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [loaded])

  const start = useCallback(
    async (
      plane: GenerationPlane,
      projectId: string | undefined,
      queuedId: string
    ) => {
      submitting.current = true
      setError(null)
      const model = getModel(plane.model)
      const fingerprint = JSON.stringify([plane, projectId])
      const key =
        pending.current?.fingerprint === fingerprint
          ? pending.current.key
          : crypto.randomUUID()
      pending.current = { fingerprint, key }
      try {
        const result = await submitGeneration(plane, key)
        if (!result.ok) {
          // Keep the key unless the platform definitely refused the job.
          if (result.kind !== "unknown") pending.current = null
          if (result.kind === "auth") onAuthErrorRef.current?.()
          setError(result.error)
          return
        }
        pending.current = null
        const { queued } = result
        const record: RunRecord = {
          id: queued.requestId,
          requestId: queued.requestId,
          surface: model.surface,
          modelId: model.id,
          modelLabel: model.label,
          prompt: plane.prompt.text,
          settings: plane.settings,
          media: Object.values(plane.media).flatMap((items) => items ?? []),
          ...(plane.inputMode ? { inputMode: plane.inputMode } : {}),
          ...(projectId ? { projectId } : {}),
          aspect: aspectFromSettings(plane.settings),
          status: "running",
          urls: [],
          createdAt: Date.now(),
        }
        setRecords((current) => [record, ...current])
        watch(record)
      } catch (caught) {
        // The call itself dropped: the job may exist, so the key stays.
        setError(caught instanceof Error ? caught.message : String(caught))
      } finally {
        submitting.current = false
        setQueue((current) => current.filter((q) => q.record.id !== queuedId))
        setPump((n) => n + 1)
      }
    },
    [watch]
  )

  // Sends the next queued plane whenever a slot is free.
  useEffect(() => {
    const next = queue[0]
    if (!loaded || !next || submitting.current) return
    if (records.filter((r) => r.status === "running").length >= MAX_RUNNING)
      return
    // Claim the slot now, send on a microtask: start() sets state.
    submitting.current = true
    queueMicrotask(() => void start(next.plane, next.projectId, next.record.id))
  }, [loaded, queue, records, pump, start])

  /** Queues a plane; it goes to the platform as soon as fewer than MAX_RUNNING runs are active. */
  const submit = useCallback(
    async (
      plane: GenerationPlane,
      projectId?: string
    ): Promise<RunRecord | null> => {
      if (queue.length >= MAX_QUEUED) {
        setError(
          `Too many waiting generations (${MAX_QUEUED}). Wait or cancel some.`
        )
        return null
      }
      setError(null)
      const model = getModel(plane.model)
      const record: RunRecord = {
        id: `queued-${crypto.randomUUID()}`,
        requestId: "",
        surface: model.surface,
        modelId: model.id,
        modelLabel: model.label,
        prompt: plane.prompt.text,
        settings: plane.settings,
        ...(projectId ? { projectId } : {}),
        aspect: aspectFromSettings(plane.settings),
        status: "running",
        urls: [],
        createdAt: Date.now(),
      }
      setQueue((current) => [
        ...current,
        { record, plane, ...(projectId ? { projectId } : {}) },
      ])
      return record
    },
    [queue.length]
  )

  /** Resubmits a finished run's prompt, settings and references; the platform picks a new seed. */
  const variation = useCallback(
    (id: string) => {
      const record = records.find((r) => r.id === id)
      if (!record) return
      void submit(
        {
          model: record.modelId,
          ...(record.inputMode ? { inputMode: record.inputMode } : {}),
          prompt: { text: record.prompt },
          media: groupMedia(record.media ?? []),
          settings: record.settings,
        },
        record.projectId
      )
    },
    [records, submit]
  )

  const cancel = useCallback(
    async (id: string) => {
      if (queue.some((q) => q.record.id === id)) {
        setQueue((current) => current.filter((q) => q.record.id !== id))
        return
      }
      const record = records.find((r) => r.id === id)
      if (!record || record.status !== "running" || record.canceling) return
      update(id, { canceling: true })
      try {
        // Only queued jobs can be canceled; the next poll reports what happened.
        await cancelGeneration({ requestIds: [record.requestId] })
      } catch {
        update(id, { canceling: false })
        setError("Already running, can't cancel")
      }
    },
    [queue, records, update]
  )

  /** Drops everything waiting and cancels everything running. */
  const cancelAll = useCallback(async () => {
    setQueue([])
    await Promise.all(
      records.filter((r) => r.status === "running").map((r) => cancel(r.id))
    )
  }, [cancel, records])

  /** Starts a fresh watch for a run that outlived its deadline. */
  const recheck = useCallback(
    (id: string) => {
      const record = records.find((r) => r.id === id)
      if (!record || record.status !== "running") return
      update(id, { stalled: false })
      watch(record, Date.now())
    },
    [records, update, watch]
  )

  /** Removes runs and returns them, so the caller can offer Undo. */
  const remove = useCallback(
    (ids: string[]): RunRecord[] => {
      const gone = records.filter((r) => ids.includes(r.id))
      setRecords((current) => current.filter((r) => !ids.includes(r.id)))
      return gone
    },
    [records]
  )

  const restore = useCallback((restored: RunRecord[]) => {
    setRecords((current) =>
      [
        ...restored,
        ...current.filter((r) => !restored.some((x) => x.id === r.id)),
      ].sort((a, b) => b.createdAt - a.createdAt)
    )
  }, [])

  const toggleStar = useCallback((id: string) => {
    setRecords((current) =>
      current.map((r) => (r.id === id ? { ...r, starred: !r.starred } : r))
    )
  }, [])

  /** Files runs under a project, or out of any project when `projectId` is undefined. */
  const move = useCallback((ids: string[], projectId?: string) => {
    setRecords((current) =>
      current.map((r) => {
        if (!ids.includes(r.id)) return r
        const moved: RunRecord = { ...r }
        if (projectId) moved.projectId = projectId
        else delete moved.projectId
        return moved
      })
    )
  }, [])

  const running = records.filter((r) => r.status === "running")
  // Waiting placeholders lead the list, newest first, each numbered by queue place.
  const waiting = queue
    .map((q, i) => ({ ...q.record, queued: i + 1 }))
    .reverse()

  return {
    records: waiting.length ? [...waiting, ...records] : records,
    running,
    queuedCount: queue.length,
    variation,
    cancelAll,
    loaded,
    error,
    submit,
    cancel,
    recheck,
    remove,
    restore,
    move,
    toggleStar,
    setError,
  }
}

function settle(status: GenerationStatus): Partial<RunRecord> {
  const urls = [
    ...(status.images?.map((i) => i.url) ?? []),
    ...(status.video ? [status.video.url] : []),
  ]
  if (status.status === "completed" && urls.length > 0)
    return {
      status: "completed",
      urls,
      stalled: false,
      canceling: false,
      completedAt: Date.now(),
    }
  const reason =
    status.status === "nsfw"
      ? "Blocked by the content filter"
      : status.status === "canceled"
        ? "Canceled"
        : friendlyError(
            describeError(status.error) ??
              "The generation did not produce media"
          )
  return { status: "failed", error: reason, stalled: false, canceling: false }
}

function describeError(error: unknown): string | undefined {
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const detail =
      (error as { detail?: unknown; message?: unknown }).detail ??
      (error as { message?: unknown }).message
    if (typeof detail === "string") return detail
  }
  return undefined
}
