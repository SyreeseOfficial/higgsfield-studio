import { useEffect, useState } from "react"

import type { MediaItem } from "@/generation/catalog"

import { read as readStored, write } from "@/generation/stores/browser-storage"

const KEY = "hf.draft.v1"

type Draft = { prompt: string; media: MediaItem[] }

function read(): Draft | null {
  try {
    const raw: unknown = JSON.parse(readStored(KEY) ?? "null")
    if (raw === null || typeof raw !== "object") return null
    const { prompt, media } = raw as Partial<Draft>
    return {
      prompt: typeof prompt === "string" ? prompt : "",
      media: Array.isArray(media) ? media : [],
    }
  } catch {
    return null
  }
}

/** Prompt text and attached references that survive a reload. Restored after
    mount, never during render, so SSR output matches. */
export function useDraft() {
  const [prompt, setPrompt] = useState("")
  const [media, setMedia] = useState<MediaItem[]>([])
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    const saved = read()
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot restore from localStorage
      setPrompt(saved.prompt)
      setMedia(saved.media)
    }
    setRestored(true)
  }, [])

  useEffect(() => {
    if (!restored) return
    // A blob: URL dies with the page; only uploaded references come back.
    write(
      KEY,
      JSON.stringify({
        prompt,
        media: media.filter((m) => !m.url.startsWith("blob:")),
      })
    )
  }, [restored, prompt, media])

  return { prompt, setPrompt, media, setMedia }
}
