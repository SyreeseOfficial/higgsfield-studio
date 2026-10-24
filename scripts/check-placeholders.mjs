// Finds code that still points at the template's sample media (/presets/*).
// Off by default; set HF_FAIL_ON_PLACEHOLDERS=1 (e.g. in the production build) to make a build fail on them.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const DIRS = ["app", "components", "layouts", "lib", "generation"]
const PATTERN = /["'`]\/presets\/[\w.-]+/g

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

/** @returns {string[]} "file: /presets/x.svg" for every reference */
export function findPlaceholders(root = ".") {
  return DIRS.flatMap((dir) => walk(join(root, dir)))
    .filter(
      (file) =>
        /\.(ts|tsx)$/.test(file) && !file.includes(`${join("app", "dev")}`)
    )
    .flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(PATTERN)].map(
        (m) => `${file}: ${m[0].slice(1)}`
      )
    )
}
