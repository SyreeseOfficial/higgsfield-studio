"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ComponentProps } from "react"
import { Compass, Folder } from "lucide-react"

import { StudioPromptBox } from "@/components/studio/studio-prompt-box"
import {
  ExamplePresets,
  TEMPLATES,
  type TemplateItem,
} from "@/components/studio/template-picker"
import { HeroComposition } from "@/components/studio/hero-composition"
import {
  MyProjects,
  type MyProjectsProject,
} from "@/components/studio/my-projects"
import { UserGenerations } from "@/components/studio/user-generations"
import type { GalleryItem } from "@/components/studio/gallery/gallery-types"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ErrorBoundary } from "@/components/studio/error-boundary"
import { FeedControls } from "@/components/studio/feed-controls"
import {
  DEFAULT_FEED_VIEW,
  applyFeedView,
  emptyFeedMessage,
  isDateSorted,
  type FeedView,
} from "@/lib/studio/feed-view"

// Shown until the user has three finished outputs of their own.
const HERO_FALLBACKS = [
  "/presets/studio-2.svg",
  "/presets/studio-1.svg",
  "/presets/studio-3.svg",
] as const

const HERO_GLOW =
  "radial-gradient(60% 80% at 50% 0%, rgba(160,164,170,0.14) 0%, rgba(160,164,170,0.05) 42%, transparent 72%)"
const HERO_DOTS = "radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)"
const HERO_DOTS_MASK =
  "radial-gradient(55% 70% at 50% 0%, #000 0%, rgba(0,0,0,0.35) 45%, transparent 75%)"

export type DockProps = Omit<
  ComponentProps<typeof StudioPromptBox>,
  "className" | "skin"
>

function heroImages(items: GalleryItem[]): readonly [string, string, string] {
  const ready = items
    .filter((i) => i.status === "ready" && i.src !== "")
    .slice(0, 3)
    .map((i) => i.src)
  return [
    ready[0] ?? HERO_FALLBACKS[0],
    ready[1] ?? HERO_FALLBACKS[1],
    ready[2] ?? HERO_FALLBACKS[2],
  ]
}

export function HomeState({
  title,
  items,
  projects,
  dock,
  onCreateProject,
  onOpenAll,
  onOpenProject,
  onUseTemplate,
}: {
  title: string
  items: GalleryItem[]
  projects: MyProjectsProject[]
  dock: DockProps
  onCreateProject: (name: string) => void
  onOpenAll: () => void
  onOpenProject: (project: MyProjectsProject) => void
  onUseTemplate: (template: TemplateItem) => void
}) {
  const [tab, setTab] = useState("explore")
  const promptRef = useRef<HTMLDivElement>(null)
  const images = useMemo(() => heroImages(items), [items])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{
          backgroundImage: HERO_DOTS,
          backgroundSize: "14px 14px",
          maskImage: HERO_DOTS_MASK,
          WebkitMaskImage: HERO_DOTS_MASK,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{ backgroundImage: HERO_GLOW }}
      />

      <div className="relative flex w-full flex-col items-center gap-12 px-6 pt-16 pb-16">
        <div
          ref={promptRef}
          className="flex w-full min-w-0 flex-col items-center gap-8"
        >
          <div className="flex flex-col items-center gap-5">
            <HeroComposition images={images} alt="Recent Studio outputs" />
            <h1 className="max-w-[640px] text-center text-q-accent-lg-bold uppercase">
              {title}
            </h1>
          </div>
          <StudioPromptBox {...dock} />
        </div>

        <div className="flex w-full max-w-[900px] flex-col items-start gap-5">
          <Tabs
            variant="segmented"
            shape="pill"
            value={tab}
            onValueChange={(v) => setTab(String(v))}
          >
            <TabsList>
              <TabsTrigger value="explore" start={<Compass />}>
                Explore
              </TabsTrigger>
              <TabsTrigger value="projects" start={<Folder />}>
                My Projects
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div key={tab} className="w-full animate-in duration-300 fade-in-0">
            {tab === "projects" ? (
              <MyProjects
                projects={projects}
                generations={items}
                onCreateProject={onCreateProject}
                onOpenAllGenerations={onOpenAll}
                onOpenProject={onOpenProject}
              />
            ) : (
              <ExamplePresets
                items={TEMPLATES}
                onUse={(t) => {
                  onUseTemplate(t)
                  promptRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }}
                className="w-full"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function FeedState({
  items,
  previewItems,
  title,
  dock,
  onDelete,
  onCancel,
  onRecheck,
  onMove,
  onDeleteMany,
  onVariation,
  onStar,
  onMeasured,
  onUseAsReference,
  onSaveAsReference,
  loading,
}: {
  loading: boolean
  items: GalleryItem[]
  previewItems: GalleryItem[]
  title: string
  dock: DockProps
  onDelete: (item: GalleryItem) => void
  onCancel: (item: GalleryItem) => void
  onRecheck: (item: GalleryItem) => void
  onMove: (items: GalleryItem[]) => void
  onDeleteMany: (items: GalleryItem[]) => void
  onVariation: (item: GalleryItem) => void
  onStar: (item: GalleryItem) => void
  onMeasured: (item: GalleryItem, aspect: number) => void
  onUseAsReference: (item: GalleryItem) => void
  onSaveAsReference: (item: GalleryItem) => void
}) {
  const [feedView, setFeedView] = useState<FeedView>(DEFAULT_FEED_VIEW)
  const shownItems = useMemo(
    () => applyFeedView(items, feedView),
    [items, feedView]
  )
  const feedModels = useMemo(
    () => [...new Set(items.map((i) => i.modelLabel))].sort(),
    [items]
  )
  const filtered = items.length > 0 && shownItems.length === 0
  const images = useMemo(() => heroImages(previewItems), [previewItems])
  const dockRef = useRef<HTMLDivElement>(null)
  const [dockHeight, setDockHeight] = useState(180)
  useEffect(() => {
    const node = dockRef.current
    if (!node) return
    const observer = new ResizeObserver(() =>
      setDockHeight(node.getBoundingClientRect().height)
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="flex min-h-0 flex-1 flex-col px-4 pt-4"
        style={{ paddingBottom: dockHeight + 24 }}
      >
        {loading ? (
          <div
            className="grid flex-1 grid-cols-2 content-start gap-1.5 overflow-hidden md:grid-cols-4"
            aria-busy="true"
            aria-label="Loading your generations"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="aspect-[4/3] animate-pulse rounded-xl bg-card motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : (
          <ErrorBoundary
            fallback={(reset) => (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm">
                <p>Something went wrong showing your generations.</p>
                <button
                  type="button"
                  className="rounded-full bg-white/8 px-4 py-2 font-medium hover:bg-white/14"
                  onClick={reset}
                >
                  Reload feed
                </button>
              </div>
            )}
          >
            <UserGenerations
              items={shownItems}
              title={title}
              grouped={isDateSorted(feedView.sort)}
              toolbar={
                items.length > 0 ? (
                  <FeedControls
                    view={feedView}
                    models={feedModels}
                    onChange={setFeedView}
                  />
                ) : undefined
              }
              onStar={onStar}
              onDelete={onDelete}
              onCancel={onCancel}
              onRecheck={onRecheck}
              onMove={onMove}
              onDeleteMany={onDeleteMany}
              onVariation={onVariation}
              onMeasured={onMeasured}
              onUseAsReference={onUseAsReference}
              onSaveAsReference={onSaveAsReference}
              emptyState={{
                images,
                title: filtered
                  ? "Nothing here"
                  : title === "All Generations"
                    ? "No generations yet"
                    : `No generations in ${title}`,
                description: filtered
                  ? emptyFeedMessage(feedView)
                  : "Describe an idea below, then generate the first result.",
              }}
            />
          </ErrorBoundary>
        )}
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pt-24 pb-4"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 0%, var(--background) 100%)",
        }}
      >
        <div ref={dockRef} className="w-full max-w-[900px]">
          <StudioPromptBox
            {...dock}
            skin="glass"
            className="pointer-events-auto w-full"
          />
        </div>
      </div>
    </div>
  )
}
