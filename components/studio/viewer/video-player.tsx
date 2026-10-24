"use client"

import { useEffect, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePreferences } from "@/generation/stores/preferences"
import { cn } from "@/lib/utils"

const RATES = [0.5, 1, 1.5, 2]
// ponytail: browsers do not expose a video's frame rate; 24 fps is the usual
// generated-video rate. Use requestVideoFrameCallback metadata if a model differs.
const FRAME = 1 / 24

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** Video with scrub bar, speed, frame stepping, loop and keys:
    Space/K play · ←/→ 5 s · , . one frame · [ ] speed · L loop · M mute. */
export function ViewerVideo({
  src,
  poster,
  onMetadata,
}: {
  src: string
  poster?: string
  onMetadata?: (info: {
    width: number
    height: number
    seconds: number
  }) => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [rate, setRate] = useState(1)
  const [loop, setLoop] = useState(true)
  // Sound is a global preference, so muting here sticks for every video.
  const muted = usePreferences((s) => s.mute)
  const setMuted = (next: boolean | ((m: boolean) => boolean)) =>
    usePreferences
      .getState()
      .set({ mute: typeof next === "function" ? next(muted) : next })

  // The time readout follows every frame, not the browser's ~4 Hz timeupdate.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      if (ref.current) setTime(ref.current.currentTime)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  useEffect(() => {
    const v = ref.current
    if (v) v.playbackRate = rate
  }, [rate])

  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) void v.play().catch(() => undefined)
    else v.pause()
  }
  const seek = (to: number) => {
    const v = ref.current
    if (!v) return
    v.currentTime = Math.min(Math.max(0, to), v.duration || to)
    setTime(v.currentTime)
  }
  const step = (frames: number) => {
    const v = ref.current
    if (!v) return
    v.pause()
    seek(v.currentTime + frames * FRAME)
  }
  const nudgeRate = (dir: 1 | -1) =>
    setRate(
      (r) =>
        RATES[Math.min(RATES.length - 1, Math.max(0, RATES.indexOf(r) + dir))]!
    )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (target?.closest("input:not([type=range]),textarea,select")) return
      const onButton = !!target?.closest("button")
      const onRange = target instanceof HTMLInputElement

      const v = ref.current
      if (!v) return
      const act = (fn: () => void) => {
        event.preventDefault()
        fn()
      }
      switch (event.key) {
        case " ":
          if (!onButton) act(toggle)
          break
        case "k":
          act(toggle)
          break
        case "ArrowLeft":
          if (!onRange) act(() => seek(v.currentTime - 5))
          break
        case "ArrowRight":
          if (!onRange) act(() => seek(v.currentTime + 5))
          break
        case ",":
          act(() => step(-1))
          break
        case ".":
          act(() => step(1))
          break
        case "[":
          act(() => nudgeRate(-1))
          break
        case "]":
          act(() => nudgeRate(1))
          break
        case "l":
          act(() => setLoop((x) => !x))
          break
        case "m":
          act(() => setMuted((x) => !x))
          break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="flex max-h-full max-w-full flex-col gap-2">
      <video
        ref={ref}
        src={src}
        poster={poster}
        autoPlay
        loop={loop}
        muted={muted}
        playsInline
        className="min-h-0 max-w-full rounded-xl object-contain shadow-2xl"
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false)
          if (ref.current) setTime(ref.current.currentTime)
        }}
        onLoadedMetadata={(event) => {
          const v = event.currentTarget
          setDuration(v.duration)
          onMetadata?.({
            width: v.videoWidth,
            height: v.videoHeight,
            seconds: v.duration,
          })
        }}
      />
      <div className="flex items-center gap-1.5 rounded-xl bg-black/50 px-2 py-1.5 text-xs backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={playing ? "Pause" : "Play"}
          onClick={toggle}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous frame"
          onClick={() => step(-1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next frame"
          onClick={() => step(1)}
        >
          <ChevronRight />
        </Button>
        <input
          type="range"
          aria-label="Seek"
          className="min-w-0 flex-1 accent-primary"
          min={0}
          max={duration || 1}
          step={FRAME}
          value={Math.min(time, duration || 1)}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span className="tabular-nums">
          {clock(time)} / {clock(duration)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Speed ${rate}×. Click to change`}
          onClick={() =>
            setRate((r) => RATES[(RATES.indexOf(r) + 1) % RATES.length]!)
          }
        >
          {rate}×
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Loop"
          aria-pressed={loop}
          className={cn(loop && "text-primary")}
          onClick={() => setLoop((x) => !x)}
        >
          <Repeat />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={() => setMuted((x) => !x)}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
      </div>
    </div>
  )
}
