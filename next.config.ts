import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

import type { NextConfig } from "next"

import { checkEnv, formatProblems } from "./scripts/check-env.mjs"
import { findPlaceholders } from "./scripts/check-placeholders.mjs"
import { syncModels, watchModels } from "./scripts/sync-models.mjs"

// Opt-in release gate: sample media from the template must be gone before shipping.
if (process.env.HF_FAIL_ON_PLACEHOLDERS === "1") {
  const left = findPlaceholders()
  if (left.length)
    throw new Error(
      `Placeholder media is still referenced:\n${left.map((l) => `  - ${l}`).join("\n")}`
    )
}

// Keep the model barrel + registry items in sync with generation/catalog/models/*.
// The config is evaluated more than once per process (reloads); sync and watch once.
const once = globalThis as { __modelsSynced?: boolean }
if (!once.__modelsSynced) {
  once.__modelsSynced = true
  syncModels()
  if (process.env.NODE_ENV === "development") watchModels()
}

/** Shown in Settings and /api/health: package version plus the commit it was built from. */
function buildInfo() {
  const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
    version: string
  }
  let commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  try {
    commit ??= execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    /* not a git checkout */
  }
  return { version, commit: commit ?? "" }
}
const build = buildInfo()

const dev = process.env.NODE_ENV === "development"

// A production build with a missing or malformed setting fails here, not at the first generation.
if (!dev && process.env.HF_SKIP_ENV_CHECK !== "1") {
  const problems = checkEnv()
  if (problems.length) throw new Error(formatProblems(problems))
}

// Results and references come from the platform's CDN and signed storage. Their
// hosts are not published, so media and connect accept any https origin unless
// HF_MEDIA_HOSTS lists them. Scripts stay same-origin; 'unsafe-inline' remains
// only because Next's inline bootstrap needs a nonce (which forces dynamic pages).
const hosts = process.env.HF_MEDIA_HOSTS?.split(/\s+/)
  .filter((host) => /^(\*\.)?[a-z0-9.-]+$/i.test(host))
  .map((host) => `https://${host}`)
const remote = hosts?.length ? hosts.join(" ") : "https:"
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${remote}`,
  `media-src 'self' blob: ${dev ? "data: " : ""}${remote}`,
  `connect-src 'self' ${remote}${dev ? " ws: wss:" : ""}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: build.version,
    NEXT_PUBLIC_APP_COMMIT: build.commit,
  },
  agentRules: false,
  experimental: { agentUpgrade: "security" },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(dev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]),
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
}

export default nextConfig
