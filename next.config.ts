import type { NextConfig } from "next"

import { checkEnv, formatProblems } from "./scripts/check-env.mjs"
import { syncModels, watchModels } from "./scripts/sync-models.mjs"

// Keep the model barrel + registry items in sync with generation/catalog/models/*.
syncModels()
if (process.env.NODE_ENV === "development") watchModels()

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
  `media-src 'self' blob: ${remote}`,
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
