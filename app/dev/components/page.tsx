import { notFound } from "next/navigation"

import { GenerationTile } from "@/components/studio/generation-card"

/** Dev-only gallery of tile states, for checking them without spending credits. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound()
  const frame = "relative aspect-[4/3] overflow-hidden rounded-xl"
  return (
    <main className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
      {[
        [
          "Generating",
          <GenerationTile key="g" state="generating" className="size-full" />,
        ],
        [
          "Stalled",
          <GenerationTile
            key="s"
            state="generating"
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
      ].map(([label, tile]) => (
        <figure key={String(label)} className="flex flex-col gap-2">
          <div className={frame}>{tile}</div>
          <figcaption className="text-xs text-muted-foreground">
            {label}
          </figcaption>
        </figure>
      ))}
    </main>
  )
}
