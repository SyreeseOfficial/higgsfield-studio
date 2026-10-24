"use client"

import { useState } from "react"
import type { ReactElement } from "react"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import type { ModelEntry, SettingField } from "@/generation/catalog/types"
import { cn } from "@/lib/utils"

/** Every setting the active model declares, rendered from the catalog. */
export interface SettingsDialogProps {
  trigger: ReactElement
  model: ModelEntry
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

export function SettingsDialog({
  trigger,
  model,
  values,
  onChange,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(model.settings)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{model.label} settings</DialogTitle>
          <DialogDescription>Applied to the next generation.</DialogDescription>
          {entries.length > 0 ? (
            <button
              type="button"
              className="text-q-caption-sm-medium text-q-text-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => {
                for (const [key, field] of entries) onChange(key, field.default)
              }}
            >
              Reset to defaults
            </button>
          ) : null}
        </DialogHeader>
        <DialogBody>
          {entries.length === 0 ? (
            <p className="text-q-body-sm-regular text-q-text-secondary">
              This model has no settings.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {entries.map(([key, field]) => (
                <div key={key} className="pb-2">
                  <SettingRow
                    name={key}
                    field={field}
                    value={values[key]}
                    onChange={(v) => onChange(key, v)}
                  />
                  <p className="px-1 text-q-caption-sm-regular text-q-text-secondary">
                    {settingHelp(key, field)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

export function settingLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

/** One sentence under a setting. Known keys get a specific line; others fall back to what the control allows. */
const SETTING_HELP: Record<string, string> = {
  aspectRatio: "Shape of the result: wide for scenes, tall for phone screens.",
  resolution: "Sharper output takes longer and may cost more.",
  batchSize: "How many images each run makes.",
  enhancePrompt: "Lets the model add detail to your prompt before generating.",
  duration: "Length of the clip in seconds. Longer clips take longer to make.",
  generateAudio: "Adds generated sound to the clip.",
  sound: "Adds generated sound to the clip.",
  bitrateMode: "High keeps more detail but makes a larger file.",
  cfgScale:
    "How closely to follow your prompt. Higher is stricter, lower is looser.",
  multiShots: "Lets the clip cut between several shots.",
  keepOriginalSound: "Keeps the audio from your reference video.",
  characterOrientation:
    "Whether the character faces the way it does in the video or in the image.",
}

export function settingHelp(key: string, field: SettingField): string {
  return (
    SETTING_HELP[key] ??
    (field.type === "range"
      ? `A number from ${field.min} to ${field.max}.`
      : field.type === "enum"
        ? `Choose one of ${field.values.length} options.`
        : "Turn on or off.")
  )
}

function SettingRow({
  name,
  field,
  value,
  onChange,
}: {
  name: string
  field: SettingField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const label = settingLabel(name)
  if (field.type === "enum") {
    const current = typeof value === "string" ? value : field.default
    return (
      <label className="flex min-h-11 items-center justify-between gap-4 px-1 text-q-body-sm-medium">
        <span>{label}</span>
        <Select value={current} onValueChange={(v) => onChange(v)}>
          <SelectTrigger size="sm" className="w-auto min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent variant="picker" surface="solid" align="end">
            {field.values.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    )
  }
  if (field.type === "range") {
    const current = typeof value === "number" ? value : field.default
    return (
      <div className="flex flex-col gap-2 px-1 py-2 text-q-body-sm-medium">
        <div className="flex items-center justify-between">
          <span>{label}</span>
          <span className="text-q-caption-sm-regular text-q-text-secondary tabular-nums">
            {current}
          </span>
        </div>
        <Slider
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={[current]}
          onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        />
      </div>
    )
  }
  const current = typeof value === "boolean" ? value : field.default
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-1 text-q-body-sm-medium">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={current}
        onClick={() => onChange(!current)}
        className={cn(
          "relative h-6 w-10 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          current ? "bg-q-brand-primary" : "bg-q-transparent-light-15"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-background transition-transform",
            current ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
    </div>
  )
}
