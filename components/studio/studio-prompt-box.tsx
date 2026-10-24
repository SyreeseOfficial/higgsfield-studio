"use client"

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type ReactNode,
} from "react"
import {
  AudioLines,
  Check,
  ChevronDown,
  Clapperboard,
  Crop,
  Ellipsis,
  ImageIcon,
  Pause,
  Play,
  Plus,
  SlidersHorizontal,
  SpellCheck,
  Trash2,
  X,
} from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemContent,
  SelectItemDescription,
  SelectItemIcon,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type {
  MediaItem,
  MediaKind,
  MediaRole,
  ModelEntry,
  Surface,
} from "@/generation/catalog"
import {
  inputRoles,
  MEDIA_ROLES,
  REFERENCE_ROLE,
  ROLE_KIND,
  ROLE_LABEL,
} from "@/generation/catalog/media-inputs"
import type { UploadOptions } from "@/generation/upload"
import { modelSummary } from "@/lib/studio/model-info"
import { kindOf, referenceFile } from "@/lib/studio/uploads"
import type { AssetLibraryItem, AssetSelection } from "@/lib/studio/uploads"

import { AssetLibraryModal } from "./asset-library"
import { ImageEditor } from "./image-editor"
import { PromptBox, type PromptBoxSurface } from "./prompt-box"
import { SettingsDialog, settingLabel } from "./settings-dialog"

export const MAX_INLINE_SETTINGS = 1

type ImageRole = "reference" | "start" | "end"

export interface StudioPromptBoxProps {
  surfaces: Surface[]
  surface: Surface
  onSurfaceChange: (surface: Surface) => void
  models: ModelEntry[]
  model: ModelEntry
  onModelChange: (id: string) => void
  settings: Record<string, unknown>
  onSettingChange: (key: string, value: unknown) => void
  inputMode?: string
  media: MediaItem[]
  onMediaAdd: (role: MediaRole | "auto", selection: AssetSelection[]) => void
  onMediaRemove: (id: string) => void
  /** Drop `fromId` into the place of `toId`. */
  onMediaReorder: (fromId: string, toId: string) => void
  /** Swap a reference for an edited upload, keeping its role and place. */
  onMediaReplace: (id: string, selection: AssetSelection) => void
  onMediaRoleChange: (id: string, role: ImageRole) => void
  library: {
    items: AssetLibraryItem[]
    onUpload: (file: File, options?: UploadOptions) => Promise<AssetSelection>
  }
  placeholder?: string
  prompt: string
  onPromptChange: (value: string) => void
  cost?: ReactNode
  onGenerate: () => void
  onCancel: () => void
  generating?: boolean
  canceling?: boolean
  generateDisabled?: boolean
  disabledReason?: string
  /** Tooltip on Generate while it is enabled: roughly how long a run takes. */
  etaHint?: string
  error?: ReactNode
  skin?: PromptBoxSurface
  className?: string
}

function modelIcon(model: ModelEntry): ReactNode {
  return model.icon ? (
    // eslint-disable-next-line @next/next/no-img-element -- Static SVG logos do not need an image proxy.
    <img
      src={`/model-icons/${model.icon}.svg`}
      alt=""
      className="brightness-0 invert"
    />
  ) : (
    <Clapperboard />
  )
}

export function headlineSetting(model: ModelEntry): string | undefined {
  const enums = Object.entries(model.settings).filter(
    ([, field]) => field.type === "enum"
  )
  return (enums.find(([key]) => /aspect|ratio/.test(key)) ?? enums[0])?.[0]
}

const PICKER_POPUP = {
  variant: "picker",
  surface: "solid",
  side: "bottom",
  align: "start",
  sideOffset: 8,
  collisionPadding: 16,
} as const

function PillSelect({
  value,
  options,
  onValueChange,
  start,
  label,
}: {
  value: string
  options: {
    value: string
    label: string
    description?: string
    icon?: ReactNode
  }[]
  onValueChange: (value: string) => void
  start?: ReactNode
  label: string
}) {
  const current = options.find((option) => option.value === value)
  return (
    <Select
      value={value}
      onValueChange={(next) => next != null && onValueChange(String(next))}
    >
      <SelectTrigger
        bare
        aria-label={label}
        render={
          <PromptBox.Pill
            start={start ?? current?.icon}
            end={<ChevronDown />}
          />
        }
      >
        <SelectValue>{() => current?.label ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent {...PICKER_POPUP}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.icon != null ? (
              <SelectItemIcon>{option.icon}</SelectItemIcon>
            ) : null}
            {option.description != null ? (
              <SelectItemContent>
                <SelectItemText>{option.label}</SelectItemText>
                <SelectItemDescription>
                  {option.description}
                </SelectItemDescription>
              </SelectItemContent>
            ) : (
              <SelectItemText>{option.label}</SelectItemText>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** A small outline in the shape of an aspect-ratio value like "16:9"; nothing for other values. */
function aspectFrame(value: string, preview?: string): ReactNode {
  const [w, h] = value.split(":").map(Number)
  if (!w || !h) return undefined
  // With an image attached, the frame shows it cropped exactly as this ratio would.
  const long = preview ? 24 : 14
  return (
    <span
      aria-hidden="true"
      className="rounded-[3px] border border-current bg-cover bg-center"
      style={{
        width: w >= h ? long : (long * w) / h,
        height: h >= w ? long : (long * h) / w,
        ...(preview ? { backgroundImage: `url("${preview}")` } : {}),
      }}
    />
  )
}

type RefMeta = { width?: number; height?: number; seconds?: number }

function MediaPreview({
  item,
  onMeta,
}: {
  item: MediaItem
  onMeta?: (meta: RefMeta) => void
}) {
  const kind = item.kind ?? ROLE_KIND[item.role]
  if (kind === "video")
    return (
      <video
        src={item.url}
        muted
        playsInline
        preload="metadata"
        className="size-full object-cover"
        onLoadedMetadata={(event) =>
          onMeta?.({
            width: event.currentTarget.videoWidth,
            height: event.currentTarget.videoHeight,
            seconds: event.currentTarget.duration,
          })
        }
      />
    )
  if (kind === "audio") return <AudioLines className="size-5" />
  return (
    // eslint-disable-next-line @next/next/no-img-element -- User uploads bypass the image proxy.
    <img
      src={item.url}
      alt={item.name ?? "Reference image"}
      className="size-full object-cover"
      onLoad={(event) =>
        onMeta?.({
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight,
        })
      }
    />
  )
}

function AudioChip({ item, label }: { item: MediaItem; label: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex h-12 w-32 items-center gap-2 rounded-xl bg-white/5 px-2">
      <button
        type="button"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/5"
        aria-label={`${playing ? "Pause" : "Play"} ${item.name ?? label}`}
        onClick={() => {
          if (!audio.current) return
          setFailed(false)
          if (playing) audio.current.pause()
          else void audio.current.play().catch(() => setFailed(true))
        }}
      >
        {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
      </button>
      <span className="min-w-0 truncate text-q-caption-sm-medium">
        {failed ? "Cannot play" : label}
      </span>
      <audio
        ref={audio}
        src={item.url}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false)
          setFailed(true)
        }}
      />
    </div>
  )
}

function formatBytes(bytes: number): string {
  return bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Dimensions, length and size of a reference, as a short caption and a full tooltip. */
function describeReference(
  meta: RefMeta | undefined,
  bytes: number | undefined
) {
  const parts = [
    meta?.width && meta.height ? `${meta.width}×${meta.height}` : null,
    meta?.seconds && Number.isFinite(meta.seconds)
      ? `${meta.seconds.toFixed(1)} s`
      : null,
    bytes ? formatBytes(bytes) : null,
  ].filter(Boolean)
  return {
    caption: meta?.seconds
      ? `${meta.seconds.toFixed(1)} s`
      : meta?.width && meta.height
        ? `${meta.width}×${meta.height}`
        : "",
    detail: parts.join(" · "),
  }
}

const controlClass =
  "absolute z-10 flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[popup-open]:opacity-100"

function mediaSlots(model: ModelEntry, inputMode?: string): MediaRole[] {
  const limits = inputRoles(model, inputMode)
  return MEDIA_ROLES.filter(
    (role) =>
      !!limits[role] &&
      (role === "start" ||
        role === "end" ||
        role === "source" ||
        ((role === "video" || role === "audio") && limits[role] === 1))
  )
}

function ReferencePicker({
  model,
  inputMode,
  media,
  onMediaAdd,
  library,
}: Pick<
  StudioPromptBoxProps,
  "model" | "inputMode" | "media" | "onMediaAdd" | "library"
>) {
  const { kinds, kindLimits, remaining } = referenceRoom(
    model,
    inputMode,
    media
  )
  if (!kinds.length) return null
  return (
    <AssetLibraryModal
      items={library.items}
      onUpload={library.onUpload}
      accept={kinds}
      kindLimits={kindLimits}
      maxSelections={remaining}
      excludeIds={media.map((item) => item.url)}
      onSelectMany={(selection) => onMediaAdd("auto", selection)}
      trigger={
        <PromptBox.Pill
          iconOnly
          aria-label="Add references"
          title="Add references"
          disabled={!remaining}
          className="disabled:opacity-40"
          start={<Plus />}
        />
      }
    />
  )
}

/** Which kinds of reference the dock can still take, and how many of each. */
function referenceRoom(
  model: ModelEntry,
  inputMode: string | undefined,
  media: MediaItem[]
) {
  const limits = inputRoles(model, inputMode)
  const slots = mediaSlots(model, inputMode)
  const kinds = (Object.keys(REFERENCE_ROLE) as MediaKind[]).filter(
    (kind) =>
      !slots.includes(REFERENCE_ROLE[kind]) &&
      (limits[REFERENCE_ROLE[kind]] ?? 0) > 0
  )
  const kindLimits = Object.fromEntries(
    kinds.map((kind) => [
      kind,
      Math.max(
        0,
        (limits[REFERENCE_ROLE[kind]] ?? 0) -
          media.filter((item) => item.role === REFERENCE_ROLE[kind]).length
      ),
    ])
  ) as Partial<Record<MediaKind, number>>
  const remaining = Object.values(kindLimits).reduce(
    (total, count) => total + count,
    0
  )
  return { kinds, kindLimits, remaining }
}

/** Pasted images and files dropped on the dock become references, like the library's upload tile. */
function useReferenceIntake({
  model,
  inputMode,
  media,
  onMediaAdd,
  library,
}: Pick<
  StudioPromptBoxProps,
  "model" | "inputMode" | "media" | "onMediaAdd" | "library"
>) {
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(
    null
  )
  const busy = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const [dragging, setDragging] = useState(false)

  const take = async (files: File[]) => {
    if (!files.length || busy.current) return
    busy.current = true
    try {
      const { kinds, kindLimits } = referenceRoom(model, inputMode, media)
      if (!kinds.length)
        throw new Error(`${model.label} doesn't take reference files.`)
      const used: Partial<Record<MediaKind, number>> = {}
      for (const file of files) {
        const kind = kindOf(file)
        if (!kinds.includes(kind))
          throw new Error(`${model.label} doesn't take ${kind} references.`)
        used[kind] = (used[kind] ?? 0) + 1
        if (used[kind]! > (kindLimits[kind] ?? 0))
          throw new Error(
            `You can add ${kindLimits[kind] ?? 0} more ${kind} files.`
          )
      }
      abort.current = new AbortController()
      setStatus({ text: "Uploading reference…", error: false })
      const uploaded: AssetSelection[] = []
      let reused = 0
      for (const file of files)
        uploaded.push(
          await library.onUpload(file, {
            signal: abort.current.signal,
            onReused: () => reused++,
            onProgress: (fraction) =>
              setStatus({
                text: `Uploading reference… ${Math.round(fraction * 100)}%`,
                error: false,
              }),
          })
        )
      onMediaAdd("auto", uploaded)
      if (reused) {
        setStatus({
          text:
            reused === uploaded.length
              ? "Already uploaded, reusing it."
              : `${reused} already uploaded, reusing.`,
          error: false,
        })
        window.setTimeout(() => setStatus(null), 2500)
      } else setStatus(null)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError")
        setStatus(null)
      else
        setStatus({
          text: caught instanceof Error ? caught.message : "Upload failed.",
          error: true,
        })
    } finally {
      busy.current = false
    }
  }

  // Files dragged anywhere over the window are taken; the overlay says so.
  const takeRef = useRef(take)
  useEffect(() => {
    takeRef.current = take
  })
  useEffect(() => {
    let depth = 0
    const hasFiles = (event: globalThis.DragEvent) =>
      !!event.dataTransfer?.types.includes("Files")
    const enter = (event: globalThis.DragEvent) => {
      if (!hasFiles(event)) return
      depth++
      setDragging(true)
    }
    const leave = (event: globalThis.DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const over = (event: globalThis.DragEvent) => {
      if (hasFiles(event)) event.preventDefault() // else the browser opens the file
    }
    const drop = (event: globalThis.DragEvent) => {
      depth = 0
      setDragging(false)
      // A drop zone inside a dialog (the library's upload tile) handles its own files.
      if (!hasFiles(event) || event.defaultPrevented) return
      event.preventDefault()
      void takeRef.current(Array.from(event.dataTransfer?.files ?? []))
    }
    window.addEventListener("dragenter", enter)
    window.addEventListener("dragleave", leave)
    window.addEventListener("dragover", over)
    window.addEventListener("drop", drop)
    return () => {
      window.removeEventListener("dragenter", enter)
      window.removeEventListener("dragleave", leave)
      window.removeEventListener("dragover", over)
      window.removeEventListener("drop", drop)
    }
  }, [])

  return {
    status,
    dragging,
    cancel: () => abort.current?.abort(),
    onPaste: (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData.files)
      if (!files.length) return
      event.preventDefault()
      void take(files)
    },
  }
}

const REF_MIME = "application/x-studio-reference"

function ReferenceCard({
  item,
  kind,
  label,
  bytes,
  roleMenu,
  remove,
  dragging,
  onDragStart,
  onDragEnd,
  onDropOn,
  onEdit,
}: {
  item: MediaItem
  kind: MediaKind
  label: string
  bytes: number | undefined
  roleMenu: ReactNode
  remove: ReactNode
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDropOn: (fromId: string) => void
  onEdit: (() => void) | undefined
}) {
  const [meta, setMeta] = useState<RefMeta>()
  const { caption, detail } = describeReference(meta, bytes)
  return (
    <div
      className={`group relative flex shrink-0 flex-col items-center ${dragging ? "opacity-40" : ""}`}
      title={`${label}: ${item.name ?? item.url}${detail ? `\n${detail}` : ""}`}
      data-media-role={item.role}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(REF_MIME, item.id)
        event.dataTransfer.effectAllowed = "move"
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(REF_MIME)) event.preventDefault()
      }}
      onDrop={(event) => {
        const from = event.dataTransfer.getData(REF_MIME)
        if (!from || from === item.id) return
        event.preventDefault()
        onDropOn(from)
      }}
    >
      {kind === "audio" ? (
        <AudioChip item={item} label={label} />
      ) : (
        <div className="relative size-12 overflow-hidden rounded-xl bg-white/5">
          <MediaPreview item={item} onMeta={setMeta} />
          {kind === "video" ? (
            <Play className="pointer-events-none absolute bottom-1 left-1 size-3 fill-white text-white drop-shadow" />
          ) : null}
        </div>
      )}
      {caption ? (
        <span className="mt-0.5 text-xs leading-none text-muted-foreground tabular-nums">
          {caption}
        </span>
      ) : null}
      {roleMenu}
      {remove}
      {onEdit ? (
        <button
          type="button"
          aria-label={`Crop or rotate ${item.name ?? label}`}
          className={`${controlClass} top-7 -right-1`}
          onClick={onEdit}
        >
          <Crop className="size-3" />
        </button>
      ) : null}
    </div>
  )
}

function MediaInputs({
  model,
  inputMode,
  media,
  onMediaAdd,
  onMediaRemove,
  onMediaReorder,
  onMediaReplace,
  onMediaRoleChange,
  library,
  tilesOnly = false,
}: Pick<
  StudioPromptBoxProps,
  | "model"
  | "inputMode"
  | "media"
  | "onMediaAdd"
  | "onMediaRemove"
  | "onMediaReorder"
  | "onMediaReplace"
  | "onMediaRoleChange"
  | "library"
> & { tilesOnly?: boolean }) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{
    item: MediaItem
    file: File
  } | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const onEdit = (item: MediaItem) => {
    setEditError(null)
    void referenceFile(item.url, item.name)
      .then((file) => setEditing({ item, file }))
      .catch(() =>
        setEditError(
          "Can't open this image for editing (the host blocks it). Remove it and add the file again."
        )
      )
  }
  const allSlots = mediaSlots(model, inputMode)
  const slots = allSlots.filter(
    (role) =>
      (role === "start" || role === "end" || role === "source") === tilesOnly
  )
  const hasReferenceImages = !!model.roles.reference
  const references = tilesOnly
    ? []
    : media.filter((item) => !allSlots.includes(item.role))
  const imageRoles = (["reference", "start", "end"] as const).filter(
    (role) => model.roles[role]
  )
  const roleMenu = (item: MediaItem) => {
    if (
      ROLE_KIND[item.role] !== "image" ||
      !hasReferenceImages ||
      imageRoles.length < 2
    )
      return null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Role for ${item.name ?? "image"}`}
              className={`${controlClass} -top-1 -left-1`}
            >
              <Ellipsis className="size-3" />
            </button>
          }
        />
        <DropdownMenuContent side="top" align="start" sideOffset={6}>
          {imageRoles.map((role) => (
            <DropdownMenuItem
              key={role}
              onClick={() => onMediaRoleChange(item.id, role)}
            >
              {role === "reference" ? "Reference image" : ROLE_LABEL[role]}
              {item.role === role ? <Check className="ml-auto size-3" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
  const remove = (item: MediaItem) => (
    <button
      type="button"
      aria-label={`Remove ${item.name ?? ROLE_LABEL[item.role]}`}
      className={`${controlClass} -top-1 -right-1`}
      onClick={() => onMediaRemove(item.id)}
    >
      <X className="size-3" />
    </button>
  )

  if (!slots.length && !references.length) return null
  const content = (
    <>
      {slots.map((role) => {
        const item = media.find((entry) => entry.role === role)
        const label =
          role === "video"
            ? "Video"
            : role === "audio"
              ? "Audio"
              : ROLE_LABEL[role]
        return (
          <div key={role} className="group relative shrink-0">
            <AssetLibraryModal
              items={library.items}
              onUpload={library.onUpload}
              accept={[ROLE_KIND[role]]}
              onSelect={(selection) => onMediaAdd(role, [selection])}
              trigger={
                tilesOnly ? (
                  <PromptBox.Upload
                    label={label}
                    src={item?.url}
                    mediaType={ROLE_KIND[role]}
                    alt={item?.name ?? label}
                    aria-label={`${item ? "Replace" : "Add"} ${label.toLowerCase()}`}
                  />
                ) : (
                  <button
                    type="button"
                    aria-label={`${item ? "Replace" : "Add"} ${label.toLowerCase()}`}
                    className="flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/5 pr-3 text-q-caption-sm-medium"
                  >
                    <span className="flex size-12 items-center justify-center overflow-hidden rounded-xl">
                      {item ? (
                        <MediaPreview item={item} />
                      ) : (
                        <Plus className="size-4 text-q-icon-secondary" />
                      )}
                    </span>
                    {label}
                  </button>
                )
              }
            />
            {item ? (
              <>
                {roleMenu(item)}
                {remove(item)}
              </>
            ) : null}
          </div>
        )
      })}
      {references.map((item, index) => {
        const kind = item.kind ?? ROLE_KIND[item.role]
        const ordinal = references
          .slice(0, index + 1)
          .filter(
            (entry) => (entry.kind ?? ROLE_KIND[entry.role]) === kind
          ).length
        const label = `${kind === "image" ? "Image" : kind === "video" ? "Video" : "Audio"} ${ordinal}`
        return (
          <ReferenceCard
            key={item.id}
            item={item}
            kind={kind}
            label={label}
            bytes={library.items.find((entry) => entry.src === item.url)?.bytes}
            roleMenu={roleMenu(item)}
            remove={remove(item)}
            dragging={dragId === item.id}
            onDragStart={() => setDragId(item.id)}
            onDragEnd={() => setDragId(null)}
            onDropOn={(fromId) => onMediaReorder(fromId, item.id)}
            onEdit={kind === "image" ? () => onEdit(item) : undefined}
          />
        )
      })}
      {dragId ? (
        <div
          className="flex h-12 items-center gap-1.5 rounded-xl border border-dashed border-red-400/60 px-3 text-xs text-red-300"
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes(REF_MIME))
              event.preventDefault()
          }}
          onDrop={(event) => {
            event.preventDefault()
            const id = event.dataTransfer.getData(REF_MIME)
            if (id) onMediaRemove(id)
            setDragId(null)
          }}
        >
          <Trash2 className="size-3.5" /> Drop to remove
        </div>
      ) : null}
      {!tilesOnly && media.length > 1 ? (
        <button
          type="button"
          aria-label="Clear attachments"
          title="Clear attachments"
          className="flex size-7 items-center justify-center rounded-full text-q-icon-secondary hover:bg-white/5 hover:text-q-icon-primary"
          onClick={() => media.forEach((item) => onMediaRemove(item.id))}
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </>
  )
  return tilesOnly ? (
    <PromptBox.Uploads>{content}</PromptBox.Uploads>
  ) : (
    <div
      className="flex max-h-36 flex-wrap items-center gap-2 overflow-y-auto p-1"
      aria-label="Attached media"
    >
      {content}
      {editError ? (
        <p role="alert" className="w-full text-xs text-q-state-error-fg">
          {editError}
        </p>
      ) : null}
      {editing ? (
        <ImageEditor
          file={editing.file}
          onCancel={() => setEditing(null)}
          onApply={async (edited) => {
            onMediaReplace(editing.item.id, await library.onUpload(edited))
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

export function StudioPromptBox({
  surfaces,
  surface,
  onSurfaceChange,
  models,
  model,
  onModelChange,
  settings,
  onSettingChange,
  inputMode,
  media,
  onMediaAdd,
  onMediaRemove,
  onMediaReorder,
  onMediaReplace,
  onMediaRoleChange,
  library,
  placeholder = "Describe the scene you imagine...",
  prompt,
  onPromptChange,
  cost,
  onGenerate,
  onCancel,
  generating = false,
  canceling = false,
  generateDisabled = false,
  disabledReason,
  etaHint,
  error,
  skin,
  className = "w-[830px] max-w-full",
}: StudioPromptBoxProps) {
  const headline = headlineSetting(model)
  const headlineField = headline ? model.settings[headline] : undefined
  const [spellcheck, setSpellcheck] = useState(true)
  const intake = useReferenceIntake({
    model,
    inputMode,
    media,
    onMediaAdd,
    library,
  })
  return (
    <div className="contents" onPaste={intake.onPaste}>
      {intake.dragging ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
        >
          <div className="rounded-2xl border-2 border-dashed border-primary px-10 py-8 text-center">
            <p className="text-lg font-semibold">Drop to add as a reference</p>
            <p className="text-sm text-muted-foreground">
              {referenceRoom(model, inputMode, media).kinds.length
                ? "Images, video and audio the model accepts are uploaded."
                : `${model.label} doesn't take reference files.`}
            </p>
          </div>
        </div>
      ) : null}
      <PromptBox.Root surface={skin} className={className}>
        <PromptBox.ModeRail hidden={surfaces.length < 2}>
          {surfaces.map((value) => (
            <PromptBox.Mode
              key={value}
              active={surface === value}
              onClick={() => onSurfaceChange(value)}
              start={value === "video" ? <Clapperboard /> : <ImageIcon />}
            >
              {value === "video" ? "Video" : "Image"}
            </PromptBox.Mode>
          ))}
        </PromptBox.ModeRail>
        <PromptBox.Body>
          <MediaInputs
            {...{
              model,
              inputMode,
              media,
              onMediaAdd,
              onMediaRemove,
              onMediaReorder,
              onMediaReplace,
              onMediaRoleChange,
              library,
            }}
          />
          <PromptBox.Field
            placeholder={placeholder}
            aria-label={placeholder}
            spellCheck={spellcheck}
            value={prompt}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              onPromptChange(event.target.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.metaKey || event.ctrlKey) &&
                !generating &&
                !generateDisabled
              ) {
                event.preventDefault()
                onGenerate()
              }
            }}
          />
          {error != null || intake.status ? (
            <p
              className={
                "px-1 pb-1 text-q-caption-sm-medium " +
                (error == null && intake.status && !intake.status.error
                  ? "text-muted-foreground"
                  : "text-q-state-error-fg")
              }
              role="alert"
            >
              {error ?? intake.status?.text}
              {error == null && intake.status && !intake.status.error ? (
                <button
                  type="button"
                  className="ml-2 underline hover:text-foreground"
                  onClick={intake.cancel}
                >
                  Cancel
                </button>
              ) : null}
            </p>
          ) : null}
          <PromptBox.Actions className="flex-wrap">
            <ReferencePicker
              {...{ model, inputMode, media, onMediaAdd, library }}
            />
            <PillSelect
              label="Model"
              value={model.id}
              onValueChange={onModelChange}
              options={models.map((entry) => ({
                value: entry.id,
                label: entry.label,
                description: modelSummary(entry),
                icon: modelIcon(entry),
              }))}
            />
            {headline && headlineField?.type === "enum" ? (
              <PillSelect
                label={settingLabel(headline)}
                value={
                  typeof settings[headline] === "string"
                    ? (settings[headline] as string)
                    : headlineField.default
                }
                onValueChange={(value) => onSettingChange(headline, value)}
                options={headlineField.values.map((value) => ({
                  value,
                  label: value,
                  icon: aspectFrame(
                    value,
                    media.find((m) => (m.kind ?? ROLE_KIND[m.role]) === "image")
                      ?.url
                  ),
                }))}
              />
            ) : null}
            <PromptBox.Pill
              iconOnly
              aria-label="Spellcheck"
              aria-pressed={spellcheck}
              title={spellcheck ? "Turn spellcheck off" : "Turn spellcheck on"}
              className={spellcheck ? undefined : "opacity-50"}
              start={<SpellCheck />}
              onClick={() => setSpellcheck((on) => !on)}
            />
            <SettingsDialog
              model={model}
              values={settings}
              onChange={onSettingChange}
              trigger={
                <PromptBox.Pill
                  iconOnly
                  aria-label="All settings"
                  start={<SlidersHorizontal />}
                />
              }
            />
          </PromptBox.Actions>
        </PromptBox.Body>
        <MediaInputs
          tilesOnly
          {...{
            model,
            inputMode,
            media,
            onMediaAdd,
            onMediaRemove,
            onMediaReorder,
            onMediaReplace,
            onMediaRoleChange,
            library,
          }}
        />
        <PromptBox.Generate
          cost={generating ? undefined : cost}
          onClick={generating ? onCancel : onGenerate}
          disabled={canceling || (!generating && generateDisabled)}
          title={!generating && generateDisabled ? disabledReason : etaHint}
        >
          {canceling ? "Cancelling…" : generating ? "Cancel all" : "Generate"}
        </PromptBox.Generate>
      </PromptBox.Root>
    </div>
  )
}
