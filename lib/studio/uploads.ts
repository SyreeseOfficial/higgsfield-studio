import { create } from "zustand"
import { persist } from "zustand/middleware"

import { newId } from "./id"
import {
  browserStorage,
  persistVersion,
} from "@/generation/stores/browser-storage"
import { stripMetadata } from "@/generation/strip-metadata"
import { uploadMedia, type UploadOptions } from "@/generation/upload"
import {
  mediaKindFromMime,
  unsupportedFileMessage,
} from "@/generation/upload-contract"
import type { MediaKind } from "@/generation/catalog/types"

export type AssetKind = MediaKind

/** A durable, submit-ready media reference: `src` is a public URL the platform can fetch. */
export interface AssetSelection {
  id: string
  src: string
  kind: AssetKind
  name?: string
}

export interface AssetLibraryItem extends AssetSelection {
  source: "upload" | "generation"
  /** SHA-256 of the uploaded bytes; the same file is never uploaded twice. */
  hash?: string
  createdAt: number
}

type UploadsState = {
  items: AssetLibraryItem[]
  add: (item: AssetLibraryItem) => void
  remove: (id: string) => void
}

/** Remember uploaded reference URLs in this browser. */
export const useUploads = create<UploadsState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((s) => ({
          items: [item, ...s.items.filter((i) => i.id !== item.id)].slice(
            0,
            200
          ),
        })),
      remove: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
    }),
    { name: "hf.uploads.v1", storage: browserStorage(), ...persistVersion }
  )
)

export function kindOf(file: File): AssetKind {
  try {
    return mediaKindFromMime(file.type)
  } catch {
    throw new Error(unsupportedFileMessage(file))
  }
}

async function sha256(file: File): Promise<string | undefined> {
  try {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer()
    )
    return Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("")
  } catch {
    return undefined // insecure context: skip dedupe
  }
}

/** Record a reference only after the Higgsfield storage upload succeeds.
    Location and camera metadata is stripped first, and a file already
    uploaded from this browser reuses its URL. */
export async function uploadAsset(
  original: File,
  options?: UploadOptions
): Promise<AssetLibraryItem> {
  kindOf(original) // refuse unsupported types before reading the file
  const file = await stripMetadata(original)
  const hash = await sha256(file)
  const known = hash
    ? useUploads.getState().items.find((i) => i.hash === hash)
    : undefined
  if (known) return known
  const { url } = await uploadMedia(file, options)
  const item: AssetLibraryItem = {
    id: newId(),
    src: url,
    kind: kindOf(file),
    name: original.name,
    source: "upload",
    createdAt: Date.now(),
    ...(hash ? { hash } : {}),
  }
  useUploads.getState().add(item)
  return item
}
