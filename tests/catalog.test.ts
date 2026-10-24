import { describe, expect, it } from "vitest"

import { MODELS, parseSettings } from "@/generation/catalog"
import type { MediaRole } from "@/generation/catalog"
import { ROLE_KIND, inputRoles } from "@/generation/catalog/media-inputs"
import { toPlatform } from "@/generation/to-platform"

/** One plane per input mode of every installed model, filled with the least input that validates. */
const cases = MODELS.flatMap((model) =>
  (model.mediaModes?.length
    ? model.mediaModes.map((mode) => mode.id)
    : [undefined]
  ).map((mode) => ({ model, mode, name: `${model.id} ${mode ?? ""}`.trim() }))
)

describe("every catalog model builds a platform request from its defaults", () => {
  it.each(cases)("$name", ({ model, mode }) => {
    const roles = inputRoles(model, mode)
    const needed = new Set<MediaRole>(model.requiredRoles ?? [])
    const modeSpec = model.mediaModes?.find((m) => m.id === mode)
    if (modeSpec?.requireAny) {
      const first = (Object.keys(roles) as MediaRole[]).find(
        (role) => (roles[role] ?? 0) > 0
      )
      if (first) needed.add(first)
    }
    const media = Object.fromEntries(
      [...needed].map((role) => [
        role,
        [
          {
            id: role,
            role,
            kind: ROLE_KIND[role],
            url: "https://example.com/input",
          },
        ],
      ])
    )
    const { path, body } = toPlatform({
      model: model.id,
      ...(mode ? { inputMode: mode } : {}),
      prompt: { text: "a test prompt" },
      media,
      settings: parseSettings(model, {}),
    })
    expect(path).toMatch(/^\/?[\w./-]+$/)
    expect(body).toBeTypeOf("object")
  })
})
