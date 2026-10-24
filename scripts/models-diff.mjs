// Compares the installed model files with the latest catalog in the shadcn registry:
//   pnpm models:diff
// Prints models that are new upstream, removed upstream, or changed since you installed them.
// Needs network. It only reads: nothing is installed or overwritten.
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const ITEM = process.env.HF_MODELS_ITEM ?? "higgsfield-ai/app-templates/models"
const DIR = "generation/catalog/models"

let registry
try {
  const out = execFileSync("pnpm", ["dlx", "shadcn@latest", "view", ITEM], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const parsed = JSON.parse(out)
  registry = Array.isArray(parsed) ? parsed[0] : parsed
  if (!registry?.files) throw new Error("the registry answer has no files")
} catch (error) {
  console.error(
    `Could not read ${ITEM} from the registry (${error.message.split("\n")[0]}).`
  )
  console.error(
    "Check your network, or set HF_MODELS_ITEM to the registry item that lists the models."
  )
  process.exit(1)
}

const upstream = new Map(
  registry.files.map((f) => [f.path.split("/").pop(), f.content])
)
const local = new Set(
  readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
)

const added = [...upstream.keys()].filter((f) => !local.has(f))
const removed = [...local].filter((f) => !upstream.has(f))
const changed = [...upstream]
  .filter(
    ([f, content]) =>
      local.has(f) &&
      content != null &&
      readFileSync(join(DIR, f), "utf8").trim() !== content.trim()
  )
  .map(([f]) => f)

const show = (title, list) =>
  list.length &&
  console.log(`${title}:\n${list.map((f) => `  ${f}`).join("\n")}`)
show("New upstream (not installed)", added)
show("Installed but no longer upstream", removed)
show("Changed upstream", changed)
if (!added.length && !removed.length && !changed.length)
  console.log("Installed models match the registry.")
else if (added.length || changed.length)
  console.log(
    "\nUpdate one with: pnpm dlx shadcn@latest add higgsfield-ai/app-templates/<name> --overwrite"
  )
if (!existsSync(DIR)) process.exit(1)
