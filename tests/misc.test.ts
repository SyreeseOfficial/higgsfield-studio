import { describe, expect, it } from "vitest"

import { parseUploadTicket } from "@/generation/upload-contract"
import { aspectFromSettings } from "@/lib/studio/history"
import {
  DEFAULT_FEED_VIEW,
  applyFeedView,
  type FeedView,
} from "@/lib/studio/feed-view"
import { usageStats } from "@/lib/studio/usage"
import type { RunRecord } from "@/lib/studio/history"
import { JustifiedLayoutEngine } from "@/components/studio/gallery/justified-engine"
import type { GalleryItem } from "@/components/studio/gallery/gallery-types"

describe("aspectFromSettings", () => {
  it("parses ratios and falls back to 1", () => {
    expect(aspectFromSettings({ aspect_ratio: "16:9" })).toBeCloseTo(16 / 9)
    expect(aspectFromSettings({ ratio: "9x16" })).toBeCloseTo(9 / 16)
    expect(aspectFromSettings({ aspect_ratio: "auto" })).toBe(1)
    expect(aspectFromSettings({})).toBe(1)
  })
})

describe("parseUploadTicket", () => {
  const ticket = {
    upload_url: "https://storage.example/put",
    public_url: "https://cdn.example/a.png",
    content_type: "image/png",
    upload_headers: { "Content-Type": "image/png" },
  }
  it("accepts a valid ticket", () => {
    expect(parseUploadTicket(ticket, "image/png").public_url).toBe(
      ticket.public_url
    )
  })
  it("rejects credential headers and mismatched types", () => {
    expect(() =>
      parseUploadTicket(
        {
          ...ticket,
          upload_headers: { ...ticket.upload_headers, Authorization: "x" },
        },
        "image/png"
      )
    ).toThrow()
    expect(() => parseUploadTicket(ticket, "image/jpeg")).toThrow()
    expect(() =>
      parseUploadTicket(
        { ...ticket, upload_url: "http://insecure" },
        "image/png"
      )
    ).toThrow()
  })
})

describe("JustifiedLayoutEngine", () => {
  const item = (id: string, width: number): GalleryItem => ({
    id,
    runId: id,
    createdAt: 0,
    kind: "image",
    status: "ready",
    src: "",
    width,
    height: 1,
    prompt: "",
    alt: "",
    modelLabel: "",
    settings: {},
    groupId: "all",
    groupLabel: "",
  })

  it("justifies a full row to the container width", () => {
    const engine = new JustifiedLayoutEngine()
    engine.setConfig({
      containerWidth: 1000,
      targetRowHeight: 200,
      gap: 6,
      grouped: false,
    })
    engine.setItems([
      item("a", 1),
      item("b", 1.5),
      item("c", 2),
      item("d", 1),
      item("e", 1),
    ])
    const [row] = engine.compute().rows
    const tiles = row!.tiles!
    const used = tiles.reduce((n, t) => n + t.width, 0) + 6 * (tiles.length - 1)
    expect(used).toBeCloseTo(1000, 0)
  })
})

describe("applyFeedView", () => {
  const mk = (id: string, patch: Partial<GalleryItem>): GalleryItem => ({
    id,
    runId: id,
    createdAt: Number(id),
    kind: "image",
    status: "ready",
    src: "",
    width: 1,
    height: 1,
    prompt: "",
    alt: "",
    modelLabel: "A",
    settings: {},
    groupId: "",
    groupLabel: "",
    ...patch,
  })
  const items = [
    mk("3", { kind: "video", modelLabel: "B", starred: true }),
    mk("2", { status: "failed" }),
    mk("1", {}),
  ]
  const ids = (view: Partial<FeedView>) =>
    applyFeedView(items, { ...DEFAULT_FEED_VIEW, ...view }).map((i) => i.id)

  it("filters by kind, failure, star and model", () => {
    expect(ids({ kind: "video" })).toEqual(["3"])
    expect(ids({ kind: "image" })).toEqual(["1"])
    expect(ids({ kind: "failed" })).toEqual(["2"])
    expect(ids({ kind: "starred" })).toEqual(["3"])
    expect(ids({ model: "A" })).toEqual(["2", "1"])
  })

  it("sorts", () => {
    expect(ids({ sort: "oldest" })).toEqual(["1", "2", "3"])
    expect(ids({ sort: "model" })).toEqual(["2", "1", "3"])
    expect(ids({ sort: "starred" })).toEqual(["3", "2", "1"])
  })
})

describe("usageStats", () => {
  const run = (patch: Partial<RunRecord>): RunRecord => ({
    id: "x",
    requestId: "x",
    surface: "image",
    modelId: "m",
    modelLabel: "M",
    prompt: "",
    settings: {},
    aspect: 1,
    status: "completed",
    urls: [],
    createdAt: 0,
    ...patch,
  })
  it("counts success rate and median time", () => {
    const u = usageStats(
      [
        run({ completedAt: 10_000 }),
        run({ completedAt: 30_000 }),
        run({ status: "failed" }),
        run({ status: "running" }),
      ],
      7,
      0
    )
    expect(u.total).toBe(4)
    expect(u.successRate).toBeCloseTo(2 / 3)
    expect(u.medianSeconds).toBe(20)
    expect(u.byModel[0]).toMatchObject({ runs: 4, completed: 2, failed: 1 })
    expect(u.perDay).toHaveLength(7)
  })
})

describe("credential cookie encryption", () => {
  it("round-trips with a secret and still reads plain cookies", async () => {
    const { encodeCredentials, decodeCredentials } =
      await import("@/generation/credentials")
    process.env.HF_COOKIE_SECRET = "test-secret"
    const sealed = encodeCredentials("abc123")
    expect(sealed.startsWith("enc1.")).toBe(true)
    expect(sealed).not.toContain("abc123")
    expect(decodeCredentials(sealed)).toEqual({ apiKey: "abc123" })
    expect(decodeCredentials(sealed.slice(0, -2) + "xx")).toBeNull()
    expect(decodeCredentials('{"apiKey":"plain"}')).toEqual({ apiKey: "plain" })
    delete process.env.HF_COOKIE_SECRET
    expect(decodeCredentials(sealed)).toBeNull()
  })
})

describe("zipFiles", () => {
  it("writes real DOS dates and refuses oversize archives", async () => {
    const { zipFiles, ZipTooLargeError } = await import("@/lib/studio/zip")
    const zip = await zipFiles([{ name: "a.txt", blob: new Blob(["hi"]) }])
    const view = new DataView(await zip.arrayBuffer())
    expect(view.getUint16(12, true) >> 9).toBeGreaterThan(40) // year since 1980, not 0
    const fake = { name: "x", blob: { size: 0xffffffff } as Blob }
    await expect(zipFiles([fake])).rejects.toBeInstanceOf(ZipTooLargeError)
  })
})

describe("runToCurl", () => {
  it("builds a keyless curl for an image model and null for an unknown one", async () => {
    const { runToCurl } = await import("@/lib/studio/export-run")
    const { MODELS, parseSettings } = await import("@/generation/catalog")
    const model = MODELS.find(
      (m) => m.surface === "image" && !m.mediaModes?.length
    )
    if (!model) return
    const curl = runToCurl({
      modelId: model.id,
      prompt: "it's a test",
      settings: parseSettings(model, {}),
    })
    expect(curl).toContain("$HF_API_KEY")
    expect(curl).toContain("it'\\''s a test")
    expect(runToCurl({ modelId: "nope-0", prompt: "x" })).toBeNull()
  })
})
