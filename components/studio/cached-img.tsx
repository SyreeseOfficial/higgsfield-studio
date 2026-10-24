"use client"

import { useState, type ComponentProps } from "react"

import { copyFor } from "@/lib/studio/media-cache"

/** An <img> that falls back to the saved local copy when its link no longer loads. */
export function CachedImg({
  src,
  alt,
  onError,
  ...props
}: ComponentProps<"img"> & { src: string; alt: string }) {
  const [copy, setCopy] = useState<{ of: string; url: string }>()
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote result, sized by its container
    <img
      {...props}
      alt={alt}
      src={copy?.of === src ? copy.url : src}
      onError={(event) => {
        onError?.(event)
        if (copy?.of !== src)
          void copyFor(src).then((url) => url && setCopy({ of: src, url }))
      }}
    />
  )
}
