import { isMockMode, mockImageSvg } from "@/generation/mock-platform"
import { MOCK_CLIP_BASE64 } from "@/generation/mock-media"

/** Media and upload endpoints behind HF_MOCK=1. Not found otherwise. */
const uploads = new Map<string, { bytes: ArrayBuffer; type: string }>()

type Params = { params: Promise<{ path: string[] }> }

export async function GET(_request: Request, { params }: Params) {
  if (!isMockMode()) return new Response(null, { status: 404 })
  const [kind, name = ""] = (await params).path
  const id = name.replace(/\.[a-z0-9]+$/, "")
  if (kind === "media" && name.endsWith(".svg"))
    return new Response(mockImageSvg(id), {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
    })
  if (kind === "media" && name.endsWith(".mp4"))
    return new Response(Buffer.from(MOCK_CLIP_BASE64, "base64"), {
      headers: { "Content-Type": "video/mp4" },
    })
  const file = kind === "files" ? uploads.get(id) : undefined
  if (file) return new Response(file.bytes, { headers: { "Content-Type": file.type } })
  return new Response(null, { status: 404 })
}

export async function PUT(request: Request, { params }: Params) {
  if (!isMockMode()) return new Response(null, { status: 404 })
  const [kind, id = ""] = (await params).path
  if (kind !== "upload") return new Response(null, { status: 404 })
  uploads.set(id, {
    bytes: await request.arrayBuffer(),
    type: request.headers.get("content-type") ?? "application/octet-stream",
  })
  return new Response(null, { status: 200 })
}
