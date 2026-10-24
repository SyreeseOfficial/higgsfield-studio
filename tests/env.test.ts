import { describe, expect, it } from "vitest"

import { checkEnv } from "../scripts/check-env.mjs"

describe("checkEnv", () => {
  const ok = { HF_API_BASE_URL: "https://api.example.com" }
  it("accepts a minimal valid setup and demo mode", () => {
    expect(checkEnv(ok)).toEqual([])
    expect(checkEnv({ HF_MOCK: "1" })).toEqual([])
  })
  it("names each problem", () => {
    expect(checkEnv({})[0]).toMatch(/HF_API_BASE_URL is not set/)
    expect(checkEnv({ HF_API_BASE_URL: "not a url" })[0]).toMatch(/not a valid/)
    expect(checkEnv({ HF_API_BASE_URL: "ftp://x" })[0]).toMatch(/not a valid/)
    expect(checkEnv({ ...ok, HF_COOKIE_SECRET: "short" })[0]).toMatch(
      /too short/
    )
    expect(
      checkEnv({ ...ok, HF_MEDIA_HOSTS: "good.com bad host!" })[0]
    ).toMatch(/invalid host "host!"/)
    expect(checkEnv({ ...ok, HF_DEBUG: "yes" })[0]).toMatch(/HF_DEBUG/)
  })
})

describe("findPlaceholders", () => {
  it("lists references to the sample media, with file names", async () => {
    const { findPlaceholders } =
      await import("../scripts/check-placeholders.mjs")
    const found = findPlaceholders()
    expect(found.length).toBeGreaterThan(0) // until the sample media is replaced
    for (const line of found) expect(line).toMatch(/\.tsx?: \/presets\//)
  })
})
