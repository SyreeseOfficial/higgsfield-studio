"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ComponentProps } from "react"
import { Compass, Folder } from "lucide-react"

import { StudioPromptBox } from "@/components/studio/studio-prompt-box"
import {
  ExamplePresets,
  TEMPLATES,
  type TemplateItem,
} from "@/components/studio/template-picker"
import { HeroComposition } from "@/components/studio/hero-composition"
import { KeyDialog } from "@/components/studio/key-dialog"
import {
  MyProjects,
  type MyProjectsProject,
} from "@/components/studio/my-projects"
import { StudioSidebar, type StudioView } from "@/components/studio/sidebar"
import { UserGenerations } from "@/components/studio/user-generations"
import type { GalleryItem } from "@/components/studio/gallery/gallery-types"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { hasPlatformCredentials } from "@/generation/actions"
import { MODELS, getModel, parseSettings } from "@/generation/catalog"
import type {
  GenerationPlane,
  MediaItem,
  MediaRole,
  Surface,
} from "@/generation/catalog"
import {
  changeImageRole,
  groupMedia,
  inferInputMode,
  inputRoles,
  mergeMedia,
  mergeReferences,
} from "@/generation/catalog/media-inputs"
import { toPlatform } from "@/generation/to-platform"
import { useActive } from "@/generation/stores/active"
import { useSettings } from "@/generation/stores/settings"
import {
  runToGalleryItems,
  runToLibraryItems,
} from "@/lib/studio/gallery-items"
import { useProjects } from "@/lib/studio/projects"
import {
  uploadAsset,
  useUploads,
  type AssetSelection,
} from "@/lib/studio/uploads"
import {
  CommandPalette,
  type Command,
} from "@/components/studio/command-palette"
import { ShortcutsDialog } from "@/components/studio/shortcuts-dialog"
import { UsageDialog } from "@/components/studio/usage-dialog"
import { ErrorBoundary } from "@/components/studio/error-boundary"
import { PrivacyDialog } from "@/components/studio/privacy-dialog"
import { useOnline } from "@/lib/studio/use-online"
import { claimTip } from "@/lib/studio/tips"
import { FeedControls } from "@/components/studio/feed-controls"
import {
  DEFAULT_FEED_VIEW,
  applyFeedView,
  emptyFeedMessage,
  isDateSorted,
  type FeedView,
} from "@/lib/studio/feed-view"
import type { RunRecord } from "@/lib/studio/history"
import { MoveToProjectDialog } from "@/components/studio/move-dialog"
import { UndoToast } from "@/components/studio/undo-toast"
import {
  requestNotificationPermission,
  useRunSignals,
} from "@/lib/studio/use-run-signals"
import { useRuns } from "@/lib/studio/use-runs"

/**
 * StudioTemplate — the full creative workspace: projects-first sidebar, hero,
 * the floating prompt dock, Explore / My Projects, and the edge-to-edge
 * generations feed. Generation goes through the model catalog and the
 * platform server actions; history and projects live in the browser.
 *
 * Keep the six structural parts when adapting (see AGENTS.md): sidebar,
 * glow + dot-field atmosphere, HeroComposition, StudioPromptBox, the
 * Explore / My Projects section, and the UserGenerations feed.
 */

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

type DockProps = Omit<
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

function HomeState({
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

function FeedState({
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
}: {
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

export interface StudioTemplateProps {
  /** Product name in the sidebar header. */
  title?: string
  /** Hero headline above the dock. */
  headline?: string
}

export function StudioTemplate({
  title = "Studio",
  headline = "Turn any idea into images and video",
}: StudioTemplateProps) {
  const [view, setView] = useState<StudioView>({ kind: "home" })
  const [collapsed, setCollapsed] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [media, setMedia] = useState<MediaItem[]>([])
  const [keyOpen, setKeyOpen] = useState(false)
  const [keyConfigured, setKeyConfigured] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [moving, setMoving] = useState<GalleryItem[] | null>(null)
  const [undo, setUndo] = useState<{
    message: string
    records: RunRecord[]
  } | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const online = useOnline()
  const [tip, setTip] = useState<string | null>(null)

  const surface = useActive((s) => s.surface)
  const modelId = useActive((s) => s.model)
  const setActiveModel = useActive((s) => s.setModel)
  const settingsByModel = useSettings((s) => s.byModel)
  const setSetting = useSettings((s) => s.set)
  const projectsStore = useProjects()
  const uploads = useUploads((s) => s.items)
  const runs = useRuns({
    onAuthError: () => {
      setKeyConfigured(false)
      setKeyOpen(true)
    },
  })

  const surfaces = useMemo(
    () =>
      (["video", "image"] as Surface[]).filter((s) =>
        MODELS.some((m) => m.surface === s)
      ),
    []
  )
  const models = useMemo(
    () => MODELS.filter((m) => m.surface === surface),
    [surface]
  )
  const model = useMemo(() => {
    try {
      return getModel(modelId)
    } catch {
      return models[0] ?? MODELS[0]!
    }
  }, [modelId, models])
  const settings = useMemo(
    () => settingsByModel[model.id] ?? {},
    [settingsByModel, model.id]
  )
  const inputMode = inferInputMode(model, media)
  const prepared = useMemo(() => {
    try {
      const plane: GenerationPlane = {
        model: model.id,
        inputMode,
        prompt: { text: prompt.trim() },
        media: groupMedia(media),
        settings: parseSettings(model, settings),
      }
      toPlatform(plane)
      return { plane, error: null }
    } catch (caught) {
      return {
        plane: null,
        error: caught instanceof Error ? caught.message : String(caught),
      }
    }
  }, [inputMode, media, model, prompt, settings])

  // The cookie can expire or be cleared in another tab; re-check on return.
  useEffect(() => {
    const check = () => void hasPlatformCredentials().then(setKeyConfigured)
    check()
    window.addEventListener("focus", check)
    return () => window.removeEventListener("focus", check)
  }, [])

  const galleryItems = useMemo(
    () => runs.records.flatMap(runToGalleryItems),
    [runs.records]
  )
  const libraryItems = useMemo(
    () => [...uploads, ...runs.records.flatMap(runToLibraryItems)],
    [runs.records, uploads]
  )
  const byProject = useMemo(() => {
    const map = new Map<string, GalleryItem[]>()
    for (const item of galleryItems) {
      if (!item.projectId) continue
      map.set(item.projectId, [...(map.get(item.projectId) ?? []), item])
    }
    return map
  }, [galleryItems])
  const projects = useMemo<MyProjectsProject[]>(
    () =>
      projectsStore.projects.map((p) => {
        const items = byProject.get(p.id) ?? []
        const cover = items.find(
          (i) => i.status === "ready" && i.src !== ""
        )?.src
        return {
          id: p.id,
          name: p.name,
          generationCount: new Set(items.map((i) => i.runId)).size,
          updatedAt: p.updatedAt,
          ...(cover ? { cover } : {}),
        }
      }),
    [byProject, projectsStore.projects]
  )
  const selectedProject =
    view.kind === "project"
      ? projects.find((p) => p.id === view.projectId)
      : undefined
  const visibleItems =
    view.kind === "project"
      ? (byProject.get(view.projectId) ?? [])
      : galleryItems

  const canGenerate =
    prepared.plane !== null && (prompt.trim().length > 0 || media.length > 0)
  // New prompts queue behind running ones; with nothing to send, the dock offers Cancel all.
  const generating =
    !canGenerate && (runs.running.length > 0 || runs.queuedCount > 0)
  const missingRequiredInput =
    model.requiredRoles?.some(
      (role) => !media.some((item) => item.role === role)
    ) ||
    (model.requirePrompt && !prompt.trim())

  useRunSignals(runs.records)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      const target = event.target as HTMLElement | null
      const typing =
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      if (event.key === "?" && !typing && !event.metaKey && !event.ctrlKey)
        setShortcutsOpen(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // One-time hints for features that have no visible control.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (claimTip("shortcuts"))
        setTip(
          "Tip: Ctrl/⌘+Enter generates, Ctrl/⌘+K opens the command palette, ? lists shortcuts."
        )
    }, 2000)
    return () => clearTimeout(timer)
  }, [])
  const completed = runs.records.some((r) => r.status === "completed")
  useEffect(() => {
    if (completed && claimTip("paste"))
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, gated by localStorage
      setTip(
        "Tip: paste an image or drop a file on the prompt box to use it as a reference."
      )
  }, [completed])

  const deleteRuns = (items: GalleryItem[]) => {
    const gone = runs.remove([...new Set(items.map((i) => i.runId))])
    if (gone.length)
      setUndo({
        message:
          gone.length === 1
            ? "Generation deleted"
            : `${gone.length} generations deleted`,
        records: gone,
      })
  }

  const handleGenerate = useCallback(() => {
    if (!canGenerate || !prepared.plane) return
    setLocalError(null)
    requestNotificationPermission()
    if (!keyConfigured) {
      setKeyOpen(true)
      return
    }
    const projectId = view.kind === "project" ? view.projectId : undefined
    void runs.submit(prepared.plane, projectId).then((record) => {
      if (record && view.kind === "home") setView({ kind: "all" })
      if (record && projectId) projectsStore.touch(projectId)
    })
  }, [canGenerate, keyConfigured, prepared.plane, projectsStore, runs, view])

  const handleCancel = useCallback(() => {
    if (!generating || canceling) return
    setCanceling(true)
    void runs.cancelAll().finally(() => setCanceling(false))
  }, [canceling, generating, runs])

  const commands: Command[] = [
    {
      id: "home",
      label: "Home",
      hint: "Go to",
      run: () => setView({ kind: "home" }),
    },
    {
      id: "all",
      label: "All generations",
      hint: "Go to",
      run: () => setView({ kind: "all" }),
    },
    ...projectsStore.projects.map((p) => ({
      id: `project:${p.id}`,
      label: p.name,
      hint: "Project",
      run: () => setView({ kind: "project", projectId: p.id }),
    })),
    ...surfaces.map((s) => ({
      id: `surface:${s}`,
      label: s === "video" ? "Video" : "Image",
      hint: "Surface",
      run: () => changeSurface(s),
    })),
    ...MODELS.map((m) => ({
      id: `model:${m.id}`,
      label: m.label,
      hint: `Model · ${m.surface}`,
      run: () => setActiveModel(m.id),
    })),
    {
      id: "key",
      label: "Manage API key",
      hint: "Settings",
      run: () => setKeyOpen(true),
    },
    {
      id: "privacy",
      label: "Privacy and storage",
      hint: "Settings",
      run: () => setPrivacyOpen(true),
    },
    {
      id: "usage",
      label: "Usage",
      hint: "Stats",
      run: () => setUsageOpen(true),
    },
    {
      id: "shortcuts",
      label: "Keyboard shortcuts",
      hint: "Help",
      run: () => setShortcutsOpen(true),
    },
  ]

  const handleUseTemplate = (t: TemplateItem) => {
    setPrompt(t.prompt)
    if (t.modelId && MODELS.some((m) => m.id === t.modelId)) {
      const target = getModel(t.modelId)
      setActiveModel(target.id)
      if (t.settings) setSetting(target.id, t.settings)
    } else if (t.kind !== surface && surfaces.includes(t.kind)) {
      changeSurface(t.kind)
    }
  }

  // setModel derives the surface from the model, so switching surface = picking its first model.
  const changeSurface = (next: Surface) => {
    const first = MODELS.find((m) => m.surface === next)
    if (first) setActiveModel(first.id)
  }

  const dock: DockProps = {
    surfaces,
    surface,
    onSurfaceChange: changeSurface,
    models,
    model,
    onModelChange: (id) => {
      setLocalError(null)
      setActiveModel(id)
    },
    settings,
    onSettingChange: (key, value) => setSetting(model.id, { [key]: value }),
    inputMode,
    media,
    onMediaAdd: (role: MediaRole | "auto", selection: AssetSelection[]) => {
      const selected = selection.map((item) => ({
        id: item.id,
        url: item.src,
        kind: item.kind,
        name: item.name,
      }))
      const roles = inputRoles(model, inputMode)
      const next =
        role === "auto"
          ? mergeReferences(media, selected, roles)
          : mergeMedia(
              media,
              role,
              selected.map((item) => ({
                ...item,
                id: `${role}:${item.id}`,
                role,
              })),
              roles[role] ?? 0
            )
      setLocalError(null)
      setMedia(next)
    },
    onMediaRemove: (id) => {
      setLocalError(null)
      setMedia((current) => current.filter((item) => item.id !== id))
    },
    onMediaRoleChange: (id, role) => {
      try {
        setMedia(changeImageRole(model, media, id, role))
        setLocalError(null)
      } catch (caught) {
        setLocalError(
          caught instanceof Error
            ? caught.message
            : "Could not change the image role."
        )
      }
    },
    library: { items: libraryItems, onUpload: uploadAsset },
    prompt,
    onPromptChange: setPrompt,
    onGenerate: handleGenerate,
    onCancel: handleCancel,
    generating,
    canceling,
    generateDisabled: !canGenerate || !online,
    disabledReason: online ? (prepared.error ?? undefined) : "You're offline",
    etaHint:
      model.surface === "video"
        ? "Video usually takes a few minutes"
        : "Images usually take under a minute",
    error:
      localError ??
      runs.error ??
      (online
        ? null
        : "You're offline. Generate is back when you reconnect.") ??
      (!missingRequiredInput && media.length > 0 ? prepared.error : null) ??
      undefined,
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <StudioSidebar
        title={title}
        view={view}
        onViewChange={setView}
        projects={projects}
        onCreateProject={(name) =>
          setView({ kind: "project", projectId: projectsStore.create(name).id })
        }
        onRenameProject={(id, name) => projectsStore.rename(id, name)}
        onDeleteProject={(id) => {
          projectsStore.remove(id)
          if (view.kind === "project" && view.projectId === id)
            setView({ kind: "all" })
        }}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        keyConfigured={keyConfigured}
        onOpenKey={() => setKeyOpen(true)}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {view.kind === "home" ? (
          <HomeState
            title={headline}
            items={galleryItems}
            projects={projects}
            dock={dock}
            onCreateProject={(name) =>
              setView({
                kind: "project",
                projectId: projectsStore.create(name).id,
              })
            }
            onOpenAll={() => setView({ kind: "all" })}
            onOpenProject={(p) => setView({ kind: "project", projectId: p.id })}
            onUseTemplate={handleUseTemplate}
          />
        ) : (
          <FeedState
            items={visibleItems}
            previewItems={galleryItems}
            title={selectedProject?.name ?? "All Generations"}
            dock={dock}
            onDelete={(item) => deleteRuns([item])}
            onDeleteMany={deleteRuns}
            onVariation={(item) => runs.variation(item.runId)}
            onStar={(item) => runs.toggleStar(item.runId)}
            onMove={(items) => setMoving(items)}
            onCancel={(item) => void runs.cancel(item.runId)}
            onRecheck={(item) => runs.recheck(item.runId)}
          />
        )}
      </main>
      <MoveToProjectDialog
        open={moving !== null}
        count={new Set(moving?.map((i) => i.runId)).size}
        projects={projectsStore.projects}
        onOpenChange={(open) => {
          if (!open) setMoving(null)
        }}
        onPick={(projectId) => {
          runs.move([...new Set(moving?.map((i) => i.runId))], projectId)
          if (projectId) projectsStore.touch(projectId)
          setMoving(null)
        }}
      />
      {undo ? (
        <UndoToast
          message={undo.message}
          onUndo={() => {
            runs.restore(undo.records)
            setUndo(null)
          }}
          onDismiss={() => setUndo(null)}
        />
      ) : null}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={commands}
      />
      <PrivacyDialog open={privacyOpen} onOpenChange={setPrivacyOpen} />
      <UsageDialog
        open={usageOpen}
        onOpenChange={setUsageOpen}
        records={runs.records.filter((r) => !r.queued)}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      {tip && !undo ? (
        <UndoToast
          message={tip}
          actionLabel="Got it"
          ms={9000}
          onUndo={() => setTip(null)}
          onDismiss={() => setTip(null)}
        />
      ) : null}
      <KeyDialog
        open={keyOpen}
        onOpenChange={setKeyOpen}
        configured={keyConfigured}
        onChange={setKeyConfigured}
      />
    </div>
  )
}
