import { notFound } from "next/navigation"

import { DevGallery } from "./gallery"

/** Dev-only gallery of states and parts, for checking them without spending credits. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound()
  return <DevGallery />
}
