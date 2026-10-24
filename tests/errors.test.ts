import { describe, expect, it } from "vitest"

import { friendlyError } from "@/generation/errors"

describe("friendlyError", () => {
  it.each([
    ["Request flagged by NSFW filter", undefined, /content filter/],
    ["Insufficient credits", 402, /credits/],
    ["slow down", 429, /Rate limit/],
    ["bad key", 401, /API key/],
    ["Model is unavailable", undefined, /unavailable/],
    ["upstream exploded", 502, /their side|its side/],
  ])("%s", (message, status, expected) => {
    expect(friendlyError(message, status)).toMatch(expected)
  })
  it("passes through anything else", () => {
    expect(friendlyError("Prompt too long (max 500)", 422)).toBe(
      "Prompt too long (max 500)"
    )
  })
})
