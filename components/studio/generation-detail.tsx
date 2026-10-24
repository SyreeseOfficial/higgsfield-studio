"use client"

import { useEffect, useRef, useState } from "react"
import type { ReactElement, ReactNode } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import {
  Braces,
  Check,
  Columns2,
  Copy,
  Download,
  ImageIcon,
  Loader2,
  Maximize,
  Minimize,
  Share2,
  Terminal,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { MediaItem } from "@/generation/catalog"
import { downloadMedia } from "@/lib/studio/download-media"
import { runToCurl, runToJson } from "@/lib/studio/export-run"
import { cn } from "@/lib/utils"

import { CachedImg } from "./cached-img"
import { ViewerVideo } from "./viewer/video-player"
import { ZoomImage } from "./viewer/zoom-image"

/**
 * GenerationDetailModal — the full-screen viewer every generation opens
 * through. The media sits on a blurred backdrop with a frosted right panel
 * for the prompt, details and actions. A generation still running opens too
 * (`pending`) and swaps to the result when its `src` arrives.
 */
export interface GenerationDetail {
  /** Result URL; empty while `pending`. */
  src: string
  pending?: boolean
  mediaType?: "image" | "video"
  poster?: string
  aspectRatio?: number
  prompt?: string
  model?: string
  modelId?: string
  /** Platform request id, shown as the Support ID. */
  requestId?: string
  references?: MediaItem[]
  inputMode?: string
  createdAt?: number
  completedAt?: number
  settings?: Record<string, unknown>
}

export interface GenerationDetailRow {
  id: string
  label: string
  value: ReactNode
  /** Text the row's copy button puts on the clipboard (defaults to `value` when it is a string). */
  copy?: string
}

export interface GenerationDetailModalProps {
  /** Omit when the caller controls `open`. */
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  generation: GenerationDetail
  rows?: GenerationDetailRow[]
  /** Replaces the default footer (Download · Copy · Share). */
  actions?: ReactNode
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000))
  return seconds < 60
    ? `${seconds} s`
    : `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

type MediaInfo = { width?: number; height?: number; seconds?: number }

function defaultRows(
  g: GenerationDetail,
  info: MediaInfo
): GenerationDetailRow[] {
  const rows: GenerationDetailRow[] = []
  if (g.model) rows.push({ id: "model", label: "Model", value: g.model })
  if (g.modelId && g.modelId !== g.model)
    rows.push({ id: "modelId", label: "Model ID", value: g.modelId })
  rows.push({
    id: "type",
    label: "Type",
    value: g.mediaType === "video" ? "Video" : "Image",
  })
  if (info.width && info.height)
    rows.push({
      id: "size",
      label: "Size",
      value: `${info.width} × ${info.height}`,
    })
  if (info.seconds)
    rows.push({
      id: "length",
      label: "Length",
      value: `${info.seconds.toFixed(1)} s`,
    })
  if (g.createdAt)
    rows.push({
      id: "created",
      label: "Created",
      value: new Date(g.createdAt).toLocaleString(),
    })
  if (g.createdAt && g.completedAt)
    rows.push({
      id: "took",
      label: "Took",
      value: formatDuration(g.completedAt - g.createdAt),
    })
  for (const [key, value] of Object.entries(g.settings ?? {})) {
    if (value === undefined || value === null) continue
    rows.push({ id: key, label: key.replace(/_/g, " "), value: String(value) })
  }
  if (g.requestId)
    rows.push({ id: "support", label: "Support ID", value: g.requestId })
  return rows
}

/** Copies text; the check icon stays for a moment so the click is visible. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={`Copy ${label}`}
      className={cn("shrink-0", done && "text-primary")}
      onClick={() =>
        void copyText(text)
          .then(() => {
            setDone(true)
            window.setTimeout(() => setDone(false), 1200)
          })
          .catch(() => undefined)
      }
    >
      {done ? <Check /> : <Copy />}
    </Button>
  )
}

/** PNG blob of the image; the clipboard only takes PNG. */
async function imageAsPng(src: string): Promise<Blob> {
  const blob = await (await fetch(src)).blob()
  if (blob.type === "image/png") return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0)
  return new Promise((resolve, reject) =>
    canvas.toBlob((png) => (png ? resolve(png) : reject()), "image/png")
  )
}

export function GenerationDetailModal({
  trigger,
  open: controlledOpen,
  onOpenChange,
  generation,
  rows,
  actions,
}: GenerationDetailModalProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = controlledOpen ?? ownOpen
  const setOpen = (next: boolean) => {
    setOwnOpen(next)
    onOpenChange?.(next)
  }
  const [note, setNote] = useState<string | null>(null)
  const [info, setInfo] = useState<MediaInfo>({})
  const [compare, setCompare] = useState(false)
  const [refIndex, setRefIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const stage = useRef<HTMLDivElement>(null)

  const isVideo = generation.mediaType === "video"
  const backdrop = isVideo ? generation.poster : generation.src
  const detailRows = rows ?? defaultRows(generation, info)
  const imageRefs = (generation.references ?? []).filter(
    (m) => m.kind !== "video" && m.kind !== "audio"
  )
  const reference = imageRefs[Math.min(refIndex, imageRefs.length - 1)]
  const comparing = compare && !!reference && !generation.pending
  const exportable = {
    ...(generation.modelId ? { modelId: generation.modelId } : {}),
    ...(generation.model ? { model: generation.model } : {}),
    ...(generation.mediaType ? { type: generation.mediaType } : {}),
    ...(generation.prompt ? { prompt: generation.prompt } : {}),
    ...(generation.settings ? { settings: generation.settings } : {}),
    ...(generation.references ? { references: generation.references } : {}),
    ...(generation.inputMode ? { inputMode: generation.inputMode } : {}),
    ...(generation.requestId ? { requestId: generation.requestId } : {}),
    ...(generation.createdAt ? { createdAt: generation.createdAt } : {}),
    ...(generation.src ? { result: generation.src } : {}),
  }

  useEffect(() => {
    const sync = () =>
      setFullscreen(document.fullscreenElement === stage.current)
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void stage.current?.requestFullscreen?.().catch(() => undefined)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (
        (event.target as HTMLElement | null)?.closest("input,textarea,select")
      )
        return
      if (event.key === "f") toggleFullscreen()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const flash = (message: string) => {
    setNote(message)
    window.setTimeout(() => setNote(null), 2500)
  }
  const copyThen = (text: string, message: string) =>
    void copyText(text)
      .then(() => flash(message))
      .catch(() => flash("Couldn't copy"))

  const curl = open ? runToCurl(exportable) : null

  const media = generation.pending ? (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="text-sm">
        Generating… this window updates when it&apos;s ready.
      </p>
    </div>
  ) : isVideo ? (
    <ViewerVideo
      src={generation.src}
      {...(generation.poster ? { poster: generation.poster } : {})}
      onMetadata={setInfo}
    />
  ) : (
    <ZoomImage
      src={generation.src}
      alt={generation.prompt ?? ""}
      onSize={setInfo}
    />
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {trigger ? <DialogPrimitive.Trigger render={trigger} /> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/80 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex flex-col duration-150 outline-none md:flex-row data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
          <DialogPrimitive.Title className="sr-only">
            Generation
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {generation.prompt ?? "Generated media"}
          </DialogPrimitive.Description>
          {backdrop ? (
            <CachedImg
              aria-hidden
              src={backdrop}
              alt=""
              className="pointer-events-none absolute inset-0 size-full scale-110 object-cover opacity-40 blur-3xl"
            />
          ) : null}
          <div
            ref={stage}
            className="relative flex min-h-0 flex-1 items-center justify-center bg-black/0 p-4 md:p-8"
          >
            {comparing && reference ? (
              <div className="grid size-full min-h-0 grid-cols-2 gap-3">
                <figure className="flex min-h-0 flex-col items-center gap-2">
                  <CachedImg
                    src={reference.url}
                    alt={reference.name ?? "Reference"}
                    className="min-h-0 max-w-full flex-1 rounded-xl object-contain shadow-2xl"
                  />
                  <figcaption className="text-xs text-muted-foreground">
                    Reference
                  </figcaption>
                </figure>
                <figure className="flex min-h-0 flex-col items-center gap-2">
                  <div className="min-h-0 w-full flex-1">{media}</div>
                  <figcaption className="text-xs text-muted-foreground">
                    Result
                  </figcaption>
                </figure>
              </div>
            ) : (
              media
            )}
            <div className="absolute top-3 right-3 z-10 flex gap-1.5">
              {imageRefs.length > 0 && !generation.pending ? (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-pressed={compare}
                  onClick={() => setCompare((x) => !x)}
                >
                  <Columns2 /> Compare
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={
                  fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"
                }
                title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                onClick={toggleFullscreen}
              >
                {fullscreen ? <Minimize /> : <Maximize />}
              </Button>
            </div>
          </div>
          <aside className="relative flex max-h-[45dvh] w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-white/10 bg-background/70 p-4 backdrop-blur-xl md:m-4 md:max-h-none md:w-[360px] md:rounded-2xl md:border">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Generation</span>
              <DialogPrimitive.Close
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Close" />
                }
              >
                <X />
              </DialogPrimitive.Close>
            </div>
            {generation.prompt ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Prompt
                  </span>
                  <CopyButton text={generation.prompt} label="prompt" />
                </div>
                <p className="max-h-40 overflow-y-auto text-sm leading-6">
                  {generation.prompt}
                </p>
              </div>
            ) : null}
            {imageRefs.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  References
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {imageRefs.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-label={`Compare with reference ${i + 1}`}
                      aria-pressed={compare && i === refIndex}
                      className={cn(
                        "size-12 overflow-hidden rounded-lg border border-white/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        compare && i === refIndex && "ring-2 ring-primary"
                      )}
                      onClick={() => {
                        setRefIndex(i)
                        setCompare(true)
                      }}
                    >
                      <CachedImg
                        src={m.url}
                        alt=""
                        className="size-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {detailRows.length > 0 ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {detailRows.map((row) => {
                  const text =
                    row.copy ??
                    (typeof row.value === "string" ? row.value : undefined)
                  return (
                    <div key={row.id} className="group/row contents">
                      <dt className="self-center text-muted-foreground capitalize">
                        {row.label}
                      </dt>
                      <dd className="flex items-center justify-end gap-1 tabular-nums">
                        <span className="min-w-0 truncate">{row.value}</span>
                        {text ? (
                          <span className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-within:opacity-100">
                            <CopyButton text={text} label={row.label} />
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            ) : null}
            <div className="mt-auto flex flex-wrap items-center gap-2">
              {actions ?? (
                <>
                  <Button
                    className="min-w-24 flex-1"
                    disabled={!generation.src}
                    onClick={() => void downloadMedia(generation.src)}
                  >
                    <Download /> Download
                  </Button>
                  {!isVideo && generation.src ? (
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Copy image"
                      title="Copy image"
                      onClick={() =>
                        void imageAsPng(generation.src)
                          .then((png) =>
                            navigator.clipboard.write([
                              new ClipboardItem({ "image/png": png }),
                            ])
                          )
                          .then(() => flash("Image copied"))
                          .catch(() =>
                            flash(
                              "Couldn't copy the image (the host blocks it)"
                            )
                          )
                      }
                    >
                      <ImageIcon />
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copy as JSON"
                    title="Copy as JSON"
                    onClick={() =>
                      copyThen(runToJson(exportable), "JSON copied")
                    }
                  >
                    <Braces />
                  </Button>
                  {curl ? (
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Copy as curl"
                      title="Copy as curl (key left as $HF_API_KEY)"
                      onClick={() => copyThen(curl, "curl copied")}
                    >
                      <Terminal />
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copy link"
                    title="Copy link"
                    disabled={!generation.src}
                    onClick={() => {
                      const url = new URL(generation.src, window.location.href)
                        .href
                      if (navigator.share)
                        void navigator
                          .share({ text: generation.prompt, url })
                          .catch(() => undefined)
                      else copyThen(url, "Link copied")
                    }}
                  >
                    <Share2 />
                  </Button>
                </>
              )}
            </div>
            <p
              role="status"
              aria-live="polite"
              className="min-h-4 text-xs text-muted-foreground"
            >
              {note}
            </p>
          </aside>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
