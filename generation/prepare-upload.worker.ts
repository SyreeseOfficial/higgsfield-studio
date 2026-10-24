import { sha256Hex } from "./hash"
import { stripBytes } from "./strip-metadata"

/** Metadata stripping and fingerprinting for an upload, off the main thread (an MP4 can be 200 MB). */
type Request = { id: number; type: string; buffer: ArrayBuffer }

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
}

ctx.onmessage = async ({ data: { id, type, buffer } }) => {
  try {
    const clean = stripBytes(type, new Uint8Array(buffer))
    if (clean === "rotated") {
      ctx.postMessage({ id, rotated: true }, [])
      return
    }
    const bytes = clean ?? new Uint8Array(buffer)
    const hash = await sha256Hex(bytes)
    ctx.postMessage({ id, bytes, hash }, [bytes.buffer])
  } catch (caught) {
    ctx.postMessage({ id, error: String(caught) }, [])
  }
}
