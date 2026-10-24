"use client"

import { useState, type ChangeEvent, type ReactNode } from "react"
import {
  ChevronDown,
  Clapperboard,
  ImageIcon,
  SlidersHorizontal,
  SpellCheck,
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
import type {
  MediaItem,
  MediaRole,
  ModelEntry,
  Surface,
} from "@/generation/catalog"
import { ROLE_KIND } from "@/generation/catalog/media-inputs"
import type { UploadOptions } from "@/generation/upload"
import { modelSummary } from "@/lib/studio/model-info"
import type { AssetLibraryItem, AssetSelection } from "@/lib/studio/uploads"

import { MediaInputs, ReferencePicker } from "./prompt/media-inputs"
import { useReferenceIntake, referenceRoom } from "./prompt/reference-intake"
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
