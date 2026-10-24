import type { ModelEntry } from "@/generation/catalog"
import { MEDIA_ROLES, ROLE_LABEL } from "@/generation/catalog/media-inputs"

/** One line for the model picker: accepted inputs, longest clip, rough turnaround. Derived from the catalog entry. */
export function modelSummary(model: ModelEntry): string {
  const inputs = MEDIA_ROLES.filter((role) => (model.roles[role] ?? 0) > 0).map(
    (role) => ROLE_LABEL[role].toLowerCase()
  )
  const duration = Object.entries(model.settings).find(
    ([key, field]) => /duration/i.test(key) && field.type === "range"
  )?.[1]
  return [
    inputs.length ? `Takes ${inputs.join(", ")}` : "Text prompt only",
    duration?.type === "range" ? `up to ${duration.max} s` : null,
    model.surface === "video" ? "minutes per clip" : "under a minute",
  ]
    .filter(Boolean)
    .join(" · ")
}
