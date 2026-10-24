import { describe, expect, it } from "vitest"

import { MODELS, parseSettings } from "@/generation/catalog"

// Seeded so a failure reproduces.
let seed = 42
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32
const junk = () =>
  [
    undefined,
    null,
    NaN,
    Infinity,
    -Infinity,
    -1,
    0,
    1e9,
    "",
    "x",
    "16:9",
    true,
    false,
    [],
    {},
    [1],
  ][Math.floor(rand() * 16)]

describe("parseSettings", () => {
  it("either throws or returns only values the model declares, for random input", () => {
    for (const model of MODELS)
      for (let i = 0; i < 200; i++) {
        const raw = Object.fromEntries(
          [...Object.keys(model.settings), "extra"].map((k) => [k, junk()])
        )
        let out: Record<string, unknown>
        try {
          out = parseSettings(model, raw)
        } catch (caught) {
          expect(caught).toBeInstanceOf(Error)
          continue
        }
        expect(Object.keys(out).sort()).toEqual(
          Object.keys(model.settings).sort()
        )
        for (const [key, field] of Object.entries(model.settings)) {
          const value = out[key]
          if (field.type === "enum") expect(field.values).toContain(value)
          else if (field.type === "range") {
            expect(Number.isFinite(value)).toBe(true)
            expect(value as number).toBeGreaterThanOrEqual(field.min)
            expect(value as number).toBeLessThanOrEqual(field.max)
          } else expect(typeof value).toBe("boolean")
        }
      }
  })

  it("accepts an empty object (every default is valid)", () => {
    for (const model of MODELS)
      expect(() => parseSettings(model, {})).not.toThrow()
  })
})
