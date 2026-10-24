"use client"

import { AlertTriangle, Clock, Loader2, Star, Volume2 } from "lucide-react"

import { GenerationTile } from "@/components/studio/generation-card"
import {
  StatusChip,
  type ChipTone,
} from "@/components/studio/gallery/status-chip"
import { ToastStack, useToasts } from "@/components/studio/toast-stack"
import { ViewerVideo } from "@/components/studio/viewer/video-player"
import { ZoomImage } from "@/components/studio/viewer/zoom-image"
import { Button } from "@/components/ui/button"
import { MOCK_CLIP_BASE64 } from "@/generation/mock-media"
import { brandColor } from "@/lib/studio/model-brand"

const frame = "relative aspect-[4/3] overflow-hidden rounded-xl"

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

const TONES: [ChipTone, string, typeof Star | undefined][] = [
  ["run", "Generating 0:42", Loader2],
  ["queue", "Queued · 2", Clock],
  ["warn", "Still working", undefined],
  ["fail", "Couldn't generate", AlertTriangle],
  ["star", "Starred", Star],
  ["info", "5s · 1080p", Volume2],
]

/** Every tile state, chip, toast and viewer part with sample data, so they can be checked without generating. Dev server only. */
export function DevGallery() {
  const { toasts, push, dismiss } = useToasts()
  return (
    <main className="flex flex-col gap-8 p-6">
      <Section title="Tiles">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [
                "Generating",
                <GenerationTile
                  key="g"
                  state="generating"
                  className="size-full"
                />,
              ],
              [
                "Generating (Kling glow)",
                <GenerationTile
                  key="k"
                  state="generating"
                  glow={brandColor("kling")!}
                  className="size-full"
                />,
              ],
              [
                "Queued",
                <GenerationTile
                  key="q"
                  state="generating"
                  generatingKind="queue"
                  generatingLabel="Queued · 2"
                  className="size-full"
                />,
              ],
              [
                "Stalled",
                <GenerationTile
                  key="s"
                  state="generating"
                  generatingKind="warn"
                  generatingLabel="Still working"
                  className="size-full"
                />,
              ],
              [
                "Failed",
                <GenerationTile
                  key="f"
                  state="failed"
                  failureLabel="Blocked by the content filter. Reword the prompt or try different references."
                  className="size-full"
                />,
              ],
              [
                "Ready",
                <GenerationTile
                  key="r"
                  src="/presets/studio-1.svg"
                  alt="Example"
                  className="size-full"
                />,
              ],
            ] as [string, React.ReactNode][]
          ).map(([label, tile]) => (
            <figure key={label} className="flex flex-col gap-2">
              <div className={frame}>{tile}</div>
              <figcaption className="text-xs text-muted-foreground">
                {label}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section title="Status chips">
        <div className="flex flex-wrap gap-2">
          {TONES.map(([tone, text, icon]) => (
            <StatusChip key={tone} tone={tone} {...(icon ? { icon } : {})}>
              {text}
            </StatusChip>
          ))}
        </div>
      </Section>

      <Section title="Toasts (max 3)">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              push({ message: "Generation deleted", actionLabel: "Undo" })
            }
          >
            Push toast
          </Button>
        </div>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </Section>

      <Section title="Viewer: zoom and pan">
        <div className="relative h-80 rounded-xl bg-black/40">
          <ZoomImage src="/presets/studio-2.svg" alt="Sample" />
        </div>
      </Section>

      <Section title="Viewer: video player">
        <div className="flex h-96 justify-center rounded-xl bg-black/40 p-4">
          <ViewerVideo src={`data:video/mp4;base64,${MOCK_CLIP_BASE64}`} />
        </div>
      </Section>
    </main>
  )
}
