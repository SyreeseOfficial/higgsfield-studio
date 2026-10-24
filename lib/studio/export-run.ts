import { groupMedia } from "@/generation/catalog/media-inputs"
import type { MediaItem } from "@/generation/catalog"
import { toPlatform } from "@/generation/to-platform"

export type RunExport = {
  modelId?: string
  model?: string
  type?: string
  prompt?: string
  settings?: Record<string, unknown>
  references?: MediaItem[]
  inputMode?: string
  requestId?: string
  createdAt?: number
  result?: string
}

export function runToJson(run: RunExport): string {
  return JSON.stringify(
    {
      model: run.modelId ?? run.model,
      type: run.type,
      prompt: run.prompt,
      settings: run.settings,
      references: run.references?.map(({ url, role }) => ({ url, role })),
      requestId: run.requestId,
      createdAt: run.createdAt
        ? new Date(run.createdAt).toISOString()
        : undefined,
      result: run.result,
    },
    null,
    2
  )
}

/** The request this run would send, as a curl command with the key and host left as variables.
    Null when the model is no longer installed or the inputs no longer validate. */
export function runToCurl(run: RunExport): string | null {
  if (!run.modelId) return null
  try {
    const { path, body } = toPlatform({
      model: run.modelId,
      ...(run.inputMode ? { inputMode: run.inputMode } : {}),
      prompt: { text: run.prompt ?? "" },
      media: groupMedia(run.references ?? []),
      settings: run.settings ?? {},
    })
    const json = JSON.stringify(body, null, 2).replace(/'/g, "'\\''")
    return [
      `curl -X POST "$HF_API_BASE_URL${path.startsWith("/") ? "" : "/"}${path}"`,
      `  -H "Authorization: Key $HF_API_KEY"`,
      `  -H "Content-Type: application/json"`,
      `  -d '${json}'`,
    ].join(" \\\n")
  } catch {
    return null
  }
}
