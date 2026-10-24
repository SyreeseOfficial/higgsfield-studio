"use client"

import type { ReactNode } from "react"

import { JustifiedGallery } from "./gallery/justified-gallery"
import type { GalleryItem } from "./gallery/gallery-types"
import type { ScreenEmptyStateContent } from "./screen-empty-state"

/**
 * UserGenerations — THE component for any browsable feed of the current user's
 * own generations. Everything the feed needs (virtualized justified gallery,
 * hover actions, the detail lightbox, generating/failed tiles, density control,
 * infinite scroll) lives inside; screens render this, never the gallery folder.
 */
export interface UserGenerationsProps {
  items: GalleryItem[]
  title?: ReactNode
  emptyState: ScreenEmptyStateContent
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void | Promise<unknown>
  onDelete?: (item: GalleryItem) => void
  onCancel?: (item: GalleryItem) => void
  onRecheck?: (item: GalleryItem) => void
  onMove?: (items: GalleryItem[]) => void
  onDeleteMany?: (items: GalleryItem[]) => void
  onVariation?: (item: GalleryItem) => void
  onStar?: (item: GalleryItem) => void
  onMeasured?: (item: GalleryItem, aspect: number) => void
  toolbar?: ReactNode
  grouped?: boolean
}

export function UserGenerations(props: UserGenerationsProps) {
  return <JustifiedGallery grouped={false} {...props} />
}
