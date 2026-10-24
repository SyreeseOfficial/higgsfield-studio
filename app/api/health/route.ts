import { NextResponse } from "next/server"

import { checkEnv } from "@/scripts/check-env.mjs"

/** For uptime checks: 200 when the server is configured, 503 (with a count, no details) when not. */
export function GET() {
  const problems = process.env.HF_SKIP_ENV_CHECK === "1" ? [] : checkEnv()
  return NextResponse.json(
    {
      ok: problems.length === 0,
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      commit: process.env.NEXT_PUBLIC_APP_COMMIT || undefined,
      mock: process.env.HF_MOCK === "1" || undefined,
      problems: problems.length || undefined,
    },
    {
      status: problems.length ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
