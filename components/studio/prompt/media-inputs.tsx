"use client"

import dynamic from "next/dynamic"
import { useRef, useState, type ReactNode } from "react"
import {
  AudioLines,
  Check,
  Crop,
  Ellipsis,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { MediaItem, MediaKind } from "@/generation/catalog"
import { ROLE_KIND, ROLE_LABEL } from "@/generation/catalog/media-inputs"
import { referenceFile } from "@/lib/studio/uploads"

import { AssetLibraryModal } from "../asset-library"
import { PromptBox } from "../prompt-box"
import type { StudioPromptBoxProps } from "../studio-prompt-box"
import { mediaSlots, referenceRoom } from "./reference-intake"

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

export function ReferencePicker({
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

const ImageEditor = dynamic(
  () => import("../image-editor").then((m) => m.ImageEditor),
  { ssr: false }
)

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

export function MediaInputs({
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
