import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

const sources = ["generation", "lib", "components", "layouts", "app"]
  .flatMap(walk)
  .filter((f) => /\.(ts|tsx)$/.test(f))

/** Storage keys written in code: hf.<name>.v<N>, history.v<N>, queue.v<N>, media.index, studio-tab. */
const KEY =
  /["'`](hf\.[A-Za-z]+\.v\d+|history\.v\d+|queue\.v\d+|media\.index|studio-tab)\b/g

describe("storage keys", () => {
  it("every key in the code is documented, and every documented key exists", () => {
    const inCode = new Set<string>()
    for (const file of sources)
      for (const m of readFileSync(file, "utf8").matchAll(KEY))
        inCode.add(m[1]!)
    const doc = readFileSync("docs/storage.md", "utf8")
    const documented = new Set(
      [...doc.matchAll(/^\| `([^`]+?)(?:\.<[^`]+>)?`\s*\|/gm)].map((m) => m[1]!)
    )
    // media.<url> is a pattern, not a literal key.
    documented.delete("media")
    expect([...inCode].sort()).toEqual([...documented].sort())
  })
})
