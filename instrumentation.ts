/** Runs once when the server starts: a missing or malformed setting stops it with a readable message. */
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.HF_SKIP_ENV_CHECK === "1"
  )
    return
  const { checkEnv, formatProblems } = await import("./scripts/check-env.mjs")
  const problems = checkEnv()
  if (!problems.length) return
  if (process.env.NODE_ENV === "production")
    throw new Error(formatProblems(problems))
  console.error(formatProblems(problems)) // dev: keep running so the in-app message can explain
}
