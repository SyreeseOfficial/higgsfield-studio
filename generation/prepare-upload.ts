import { sha256Hex } from "./hash"
import { reencode, stripMetadata } from "./strip-metadata"

type Reply =
  | { id: number; bytes: Uint8Array<ArrayBuffer>; hash?: string }
  | { id: number; rotated: true }
  | { id: number; error: string }

let worker: Worker | undefined
let nextId = 0
const pending = new Map<number, (reply: Reply) => void>()

function getWorker(): Worker {
  if (worker) return worker
  const created = new Worker(
    new URL("./prepare-upload.worker.ts", import.meta.url),
    { type: "module" }
  )
  created.onmessage = ({ data }: MessageEvent<Reply>) => {
    pending.get(data.id)?.(data)
    pending.delete(data.id)
  }
  created.onerror = () => {
    // Give up on workers for this page: every waiter falls back to the main thread.
    for (const done of pending.values())
      done({ id: -1, error: "worker failed" })
    pending.clear()
    worker = undefined
    broken = true
  }
  return (worker = created)
}
let broken = false

function viaWorker(file: File, buffer: ArrayBuffer): Promise<Reply> {
  return new Promise((resolve) => {
    const id = nextId++
    pending.set(id, resolve)
    getWorker().postMessage({ id, type: file.type, buffer }, [buffer])
  })
}

/** The file to upload (metadata stripped) and its SHA-256, computed off the main
    thread; falls back to doing the same work inline if workers are unavailable. */
export async function prepareUpload(
  original: File
): Promise<{ file: File; hash?: string }> {
  if (!broken && typeof Worker !== "undefined") {
    try {
      const reply = await viaWorker(original, await original.arrayBuffer())
      if ("bytes" in reply)
        return {
          file: new File([reply.bytes], original.name, { type: original.type }),
          ...(reply.hash ? { hash: reply.hash } : {}),
        }
      if ("rotated" in reply) {
        const file = await reencode(original)
        const hash = await sha256Hex(await file.arrayBuffer())
        return { file, ...(hash ? { hash } : {}) }
      }
    } catch {
      /* fall through to the main thread */
    }
  }
  const file = await stripMetadata(original)
  const hash = await sha256Hex(await file.arrayBuffer())
  return { file, ...(hash ? { hash } : {}) }
}
