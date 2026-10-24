const CREDITS =
  "Not enough credits. Top up your Higgsfield account, then try again."
const RATE_LIMIT = "Rate limit reached. Wait a minute, then try again."
const BAD_KEY = "Higgsfield rejected your API key. Update it in the key dialog."

/** Turns what the platform said into a sentence with a next step. Pure, so server actions and the browser share it. */
export function friendlyError(message: string, status?: number): string {
  const text = message.toLowerCase()
  // The status code is the platform's own verdict; keywords only guess, so they go second.
  if (status === 402) return CREDITS
  if (status === 429) return RATE_LIMIT
  if (status === 401) return BAD_KEY
  if (/nsfw|content (filter|policy|moderation)|moderat|safety/.test(text))
    return "Blocked by the content filter. Reword the prompt or try different references."
  if (status === 403) return BAD_KEY // after the filter check: a 403 can be a moderation block
  if (/credit|insufficient|balance|payment|quota/.test(text)) return CREDITS
  if (/rate.?limit|too many requests/.test(text)) return RATE_LIMIT
  if (
    status === 404 ||
    status === 503 ||
    /model.*(unavailable|not found|unknown)|unknown model/.test(text)
  )
    return "This model is unavailable right now. Pick another model or try later."
  if (status !== undefined && status >= 500)
    return "Higgsfield had a problem on its side. Try again in a moment."
  return message
}
