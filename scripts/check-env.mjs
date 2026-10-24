// Validates the server's settings. Used by next.config.ts (fails the build) and
// instrumentation.ts (fails startup with a readable message). Plain JS so both can import it.

/** @param {Record<string, string | undefined>} env @returns {string[]} one sentence per problem */
export function checkEnv(env = process.env) {
  const problems = []
  if (env.HF_MOCK === "1") return problems // demo mode needs no platform settings

  const base = env.HF_API_BASE_URL
  if (!base) {
    problems.push(
      "HF_API_BASE_URL is not set. Set it to the Higgsfield platform API address (see .env.example), or HF_MOCK=1 for a demo."
    )
  } else {
    try {
      const url = new URL(base)
      if (url.protocol !== "https:" && url.protocol !== "http:")
        throw new Error("protocol")
    } catch {
      problems.push(
        `HF_API_BASE_URL ("${base}") is not a valid http(s) address.`
      )
    }
  }
  if (
    env.HF_COOKIE_SECRET !== undefined &&
    env.HF_COOKIE_SECRET !== "" &&
    env.HF_COOKIE_SECRET.length < 16
  )
    problems.push(
      "HF_COOKIE_SECRET is too short. Use at least 16 random characters."
    )
  for (const host of (env.HF_MEDIA_HOSTS ?? "").split(/\s+/).filter(Boolean))
    if (!/^(\*\.)?[a-z0-9.-]+$/i.test(host))
      problems.push(
        `HF_MEDIA_HOSTS has an invalid host "${host}". Use bare host names like cdn.example.com or *.example.com.`
      )
  if (env.HF_DEBUG !== undefined && env.HF_DEBUG !== "" && env.HF_DEBUG !== "1")
    problems.push('HF_DEBUG must be "1" or unset.')
  return problems
}

/** @param {string[]} problems */
export function formatProblems(problems) {
  return [
    "Studio is not configured correctly:",
    ...problems.map((p) => `  - ${p}`),
    "Fix these in .env.local (or your host's environment settings) and restart.",
    "Set HF_SKIP_ENV_CHECK=1 to skip this check.",
  ].join("\n")
}
