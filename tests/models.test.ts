import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { MODELS } from "@/generation/catalog"
import { MEDIA_ROLES } from "@/generation/catalog/media-inputs"

describe("model files", () => {
  it("has at least one model", () => expect(MODELS.length).toBeGreaterThan(0))

  it("ids are unique and well formed", () => {
    const ids = MODELS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9._-]*$/)
  })

  it.each(MODELS.map((m) => [m.id, m] as const))(
    "%s is complete",
    (_id, model) => {
      expect(model.label.trim()).not.toBe("")
      expect(["image", "video"]).toContain(model.surface)
      // Every brand icon the picker asks for exists on disk.
      if (model.icon)
        expect(
          existsSync(join("public/model-icons", `${model.icon}.svg`))
        ).toBe(true)
      // Roles are real roles with positive limits.
      for (const [role, limit] of Object.entries(model.roles)) {
        expect(MEDIA_ROLES).toContain(role)
        expect(limit).toBeGreaterThan(0)
      }
      // Defaults sit inside what the control allows.
      for (const field of Object.values(model.settings)) {
        if (field.type === "enum") expect(field.values).toContain(field.default)
        if (field.type === "range") {
          expect(field.default).toBeGreaterThanOrEqual(field.min)
          expect(field.default).toBeLessThanOrEqual(field.max)
        }
      }
    }
  )

  it("picker order is unique within each surface", () => {
    for (const surface of ["image", "video"] as const) {
      const orders = MODELS.filter(
        (m) => m.surface === surface && m.order !== undefined
      ).map((m) => m.order)
      expect(new Set(orders).size, `${surface} orders: ${orders}`).toBe(
        orders.length
      )
    }
  })
})

describe("ModelId type", () => {
  it("lists exactly the installed models", async () => {
    const { readFileSync } = await import("node:fs")
    const barrel = readFileSync(
      "generation/catalog/models.generated.ts",
      "utf8"
    )
    const declared = [
      ...(barrel.match(/export type ModelId = ([^\n]+)/)?.[1] ?? "").matchAll(
        /"([^"]+)"/g
      ),
    ].map((m) => m[1])
    expect(declared.sort()).toEqual(MODELS.map((m) => m.id).sort())
  })
})
