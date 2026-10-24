/** Turns what the platform said into a sentence with a next step. Pure, so server actions and the browser share it. */
export function friendlyError(message: string, status?: number): string {
  const text = message.toLowerCase()
  if (/nsfw|content (filter|policy|moderation)|moderat|safety/.test(text))
    return "Blocked by the content filter. Reword the prompt or try different references."
  if (status === 402 || /credit|insufficient|balance|payment|quota/.test(text))
    return "Not enough credits. Top up your Higgsfield account, then try again."
  if (status === 429 || /rate.?limit|too many requests/.test(text))
    return "Rate limit reached. Wait a minute, then try again."
  if (status === 401 || status === 403)
    return "Higgsfield rejected your API key. Update it in the key dialog."
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
