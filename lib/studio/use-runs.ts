"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

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
  IMAGE_DEADLINE_MS,
  MAX_QUEUED,
  MAX_RUNNING,
  SAVE_DEBOUNCE_MS,
  VIDEO_DEADLINE_MS,
} from "./limits"
import { newId } from "./id"
import { PendingKeys } from "./pending-keys"
import { saveCopies } from "./media-cache"
import {
  STORAGE_FAILED_EVENT,
  STORAGE_FAILED_MESSAGE,
  reportStorageFailure,
} from "./storage-warning"
import { defaultKv } from "./kv"
import { referenceReachable } from "./reference-check"
import {
  aspectFromSettings,
  loadHistory,
  mergeRecords,
  readHistory,
  saveHistory,
  type RunRecord,
} from "./history"

const CHANNEL = "studio-history"
const MAX_PENDING_KEYS = 20
/** Pause after the platform says "slow down". */
const RATE_PAUSE_MS = 60_000
/** A cancel the platform quietly ignored (job already running) is given this long to show up. */
const CANCEL_GRACE_MS = 20_000
/** Polls that say "completed" with no media are re-asked this many times before it counts as failed. */
const EMPTY_RETRIES = 3

type QueueEntry = {
  record: RunRecord
  plane: GenerationPlane
  projectId?: string
}

/** The queue is saved per tab (sessionStorage id), so a reload gets back its own
    queue and a second tab can never resend it. */
function queueKey(): string | null {
  try {
    let id = sessionStorage.getItem("studio-tab")
    if (!id) sessionStorage.setItem("studio-tab", (id = newId()))
    return `queue.v1.${id}`
  } catch {
    return null
  }
}

function isQueueEntry(value: unknown): value is QueueEntry {
  if (value === null || typeof value !== "object") return false
  const { record, plane } = value as Partial<QueueEntry>
  try {
    return (
      typeof record?.id === "string" &&
      typeof plane?.model === "string" &&
      !!getModel(plane.model)
    )
  } catch {
    return false
  }
}

/**
 * The studio's generation controller: submits planes to the platform through
 * the server action, keeps every run in IndexedDB-backed history, and resumes
 * polls for runs that were still in flight when the page reloaded.
 */
export function useRuns({ onAuthError }: { onAuthError?: () => void } = {}) {
  const [records, setRecords] = useState<RunRecord[]>([])
  // Planes waiting for a free slot; saved per tab and restored on reload.
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [pausedUntil, setPausedUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [pump, setPump] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Blocks a second submit while the first is still awaiting the platform.
  const submitting = useRef(false)
  // Keys of attempts whose outcome is unknown, reused if the same plane is retried.
  const [pending] = useState(() => new PendingKeys(MAX_PENDING_KEYS))
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
      const attempt = (emptyTries: number): void => {
        watchRequest(record.requestId, { deadline: from + limit })
          .then((status) => {
            const patch = settle(status)
            // Media can land a moment after "completed"; ask again before giving up.
            if (
              status.status === "completed" &&
              patch.status === "failed" &&
              emptyTries < EMPTY_RETRIES
            )
              return void setTimeout(() => attempt(emptyTries + 1), 3000)
            update(record.id, patch)
            if (patch.status === "completed" && record.surface === "image")
              void saveCopies(patch.urls ?? [])
          })
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
      }
      attempt(0)
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
      const resumed = stored.filter((r) => r.status === "running")
      for (const record of resumed) watch(record)
      const key = queueKey()
      void (key ? defaultKv().get<unknown>(key) : Promise.resolve(undefined))
        .catch(() => undefined)
        .then((saved) => {
          if (!alive) return
          const restored = Array.isArray(saved)
            ? saved.filter(isQueueEntry)
            : []
          if (restored.length) setQueue(restored)
          if (resumed.length || restored.length)
            setNotice(
              `Your runs were recovered: ${resumed.length} still generating, ${restored.length} waiting.`
            )
          setLoaded(true)
        })
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
        void saveHistory(records)
          .then(() => channel.current?.postMessage(0))
          .catch(reportStorageFailure),
      SAVE_DEBOUNCE_MS
    )
    return () => clearTimeout(timer)
  }, [loaded, records])
  useEffect(() => {
    const key = queueKey()
    if (loaded && key)
      void defaultKv()
        .set(key, queue)
        .catch(() => undefined)
  }, [loaded, queue])
  useEffect(() => {
    const warn = () => setError(STORAGE_FAILED_MESSAGE)
    window.addEventListener(STORAGE_FAILED_EVENT, warn)
    return () => window.removeEventListener(STORAGE_FAILED_EVENT, warn)
  }, [])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 10_000)
    return () => clearTimeout(timer)
  }, [notice])
  // Counts the rate-limit pause down once a second, then wakes the queue.
  useEffect(() => {
    if (pausedUntil <= Date.now()) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const wake = setTimeout(
      () => setPump((n) => n + 1),
      pausedUntil - Date.now()
    )
    return () => {
      clearInterval(tick)
      clearTimeout(wake)
    }
  }, [pausedUntil])
  useEffect(() => {
    const flush = () => {
      if (loaded) void saveHistory(latest.current)
    }
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [loaded])

  const send = useCallback(
    async (
      plane: GenerationPlane,
      projectId: string | undefined,
      queuedId: string
    ) => {
      submitting.current = true
      setError(null)
      const model = getModel(plane.model)
      const fingerprint = JSON.stringify([plane, projectId])
      const key = pending.keyFor(fingerprint, newId)
      let created: RunRecord | undefined
      let keepQueued = false
      try {
        let result = await submitGeneration(plane, key)
        if (!result.ok && result.kind === "unknown") {
          // Same idempotency key, so a second try cannot create a second job.
          setNotice("Retrying…")
          await new Promise((resolve) => setTimeout(resolve, 2000))
          result = await submitGeneration(plane, key)
          setNotice(null)
        }
        if (!result.ok) {
          if (result.status === 429) {
            // Slow down: keep the plane waiting and resume after a pause.
            keepQueued = true
            setPausedUntil(Date.now() + RATE_PAUSE_MS)
            setNow(Date.now())
            return
          }
          // Keep the key unless the platform definitely refused the job.
          if (result.kind !== "unknown") pending.settle(fingerprint)
          if (result.kind === "auth") onAuthErrorRef.current?.()
          setError(result.error)
          return
        }
        pending.settle(fingerprint)
        const { queued } = result
        const record: RunRecord = {
          // Same id as the waiting placeholder, so the tile does not remount.
          id: queuedId,
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
        created = record
      } catch (caught) {
        // The call itself dropped: the job may exist, so the key stays.
        setError(caught instanceof Error ? caught.message : String(caught))
      } finally {
        submitting.current = false
        if (!keepQueued)
          setQueue((current) => current.filter((q) => q.record.id !== queuedId))
        setPump((n) => n + 1)
      }
      // Saved now, not after the debounce, so another tab sees this slot taken.
      if (created)
        await saveHistory(
          mergeRecords([created, ...latest.current], await loadHistory())
        ).catch(reportStorageFailure)
    },
    [watch, pending]
  )

  /** Sends one plane under a cross-tab lock, so two tabs cannot both take the last slot. */
  const start = useCallback(
    async (
      plane: GenerationPlane,
      projectId: string | undefined,
      queuedId: string
    ) => {
      const locks =
        typeof navigator === "undefined" ? undefined : navigator.locks
      if (!locks) return send(plane, projectId, queuedId)
      let blocked = false
      await locks.request("studio-submit", async () => {
        const stored = await loadHistory()
        const active = new Set(
          [...stored, ...latest.current]
            .filter((r) => r.status === "running")
            .map((r) => r.id)
        )
        if (active.size >= MAX_RUNNING) {
          blocked = true
          return
        }
        await send(plane, projectId, queuedId)
      })
      if (blocked) {
        submitting.current = false
        // Another tab holds the slots; look again shortly.
        setTimeout(() => setPump((n) => n + 1), 3000)
      }
    },
    [send]
  )

  // Sends the next queued plane whenever a slot is free.
  useEffect(() => {
    const next = queue[0]
    if (!loaded || !next || submitting.current) return
    if (pausedUntil > Date.now()) return
    if (records.filter((r) => r.status === "running").length >= MAX_RUNNING)
      return
    // Claim the slot now, send on a microtask: start() sets state.
    submitting.current = true
    queueMicrotask(() => void start(next.plane, next.projectId, next.record.id))
  }, [loaded, queue, records, pump, pausedUntil, start])

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
        id: `queued-${newId()}`,
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
    async (id: string) => {
      const record = records.find((r) => r.id === id)
      if (!record) return
      const checks = await Promise.all(
        (record.media ?? []).map((m) => referenceReachable(m))
      )
      if (checks.includes(false)) {
        setError(
          "A reference file from this run is no longer available (its link expired). Add it again to make a variation."
        )
        return
      }
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
      // Only queued jobs can be canceled; the next poll reports what happened.
      const canceled = await cancelGeneration({
        requestIds: [record.requestId],
      })
        .then((result) => result.ok)
        .catch(() => false)
      if (!canceled) {
        update(id, { canceling: false })
        setError("Already running, can't cancel")
        return
      }
      // A running job accepts the request but never stops: don't stay on "Canceling…".
      setTimeout(() => {
        const current = latest.current.find((r) => r.id === id)
        if (current?.status !== "running" || !current.canceling) return
        update(id, { canceling: false })
        setError(
          "That run was already underway and can't be canceled. It will finish."
        )
      }, CANCEL_GRACE_MS)
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

  /** Corrects a run's layout shape to its loaded media (e.g. image-to-video keeps the source's ratio). */
  const setAspect = useCallback((id: string, aspect: number) => {
    setRecords((current) =>
      current.map((r) =>
        r.id === id && Math.abs(r.aspect / aspect - 1) > 0.02
          ? { ...r, aspect }
          : r
      )
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

  // Memoised: a new array every render would rebuild the whole gallery layout
  // on unrelated state changes (a countdown tick, a notice).
  const running = useMemo(
    () => records.filter((r) => r.status === "running"),
    [records]
  )
  // Waiting placeholders lead the list, newest first, each numbered by queue place.
  const allRecords = useMemo(() => {
    const waiting = queue
      .map((q, i) => ({ ...q.record, queued: i + 1 }))
      .reverse()
    return waiting.length ? [...waiting, ...records] : records
  }, [queue, records])

  return {
    records: allRecords,
    running,
    queuedCount: queue.length,
    variation,
    cancelAll,
    loaded,
    error,
    notice:
      pausedUntil > now
        ? `Rate limit reached. Queue paused, resuming in ${Math.ceil((pausedUntil - now) / 1000)}s.`
        : notice,
    submit,
    cancel,
    recheck,
    remove,
    restore,
    move,
    toggleStar,
    setAspect,
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
