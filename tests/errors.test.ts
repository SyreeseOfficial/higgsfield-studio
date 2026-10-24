import { describe, expect, it } from "vitest"

import { friendlyError } from "@/generation/errors"

import { PLATFORM_ERRORS } from "./fixtures/platform-errors"

describe("friendlyError", () => {
  it.each(PLATFORM_ERRORS)("$name", ({ status, message, expected }) => {
    expect(friendlyError(message, status)).toMatch(expected)
  })

  it("passes through anything else", () => {
    expect(friendlyError("Prompt too long (max 500)", 422)).toBe(
      "Prompt too long (max 500)"
    )
  })

  it("never throws and never returns an empty answer, whatever the input", () => {
    // Seeded so a failure reproduces.
    let seed = 7
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32
    const words = [
      "nsfw",
      "credit",
      "rate limit",
      "model",
      "unknown",
      "",
      "💥",
      "\n",
      "x".repeat(500),
    ]
    const statuses = [
      undefined,
      0,
      200,
      400,
      401,
      402,
      403,
      404,
      408,
      422,
      429,
      500,
      502,
      503,
      599,
    ]
    for (let i = 0; i < 2000; i++) {
      const message = Array.from(
        { length: Math.floor(rand() * 4) },
        () => words[Math.floor(rand() * words.length)]
      ).join(" ")
      const status = statuses[Math.floor(rand() * statuses.length)]
      const out = friendlyError(message, status)
      expect(typeof out).toBe("string")
      if (status === 429) expect(out).toMatch(/Rate limit/)
      if (status === 402) expect(out).toMatch(/Not enough credits/)
      if (status === 401) expect(out).toMatch(/API key/)
    }
  })
})
