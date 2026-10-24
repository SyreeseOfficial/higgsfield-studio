/** Error bodies shaped like the platform's (`{ detail }` strings), with what the studio should say.
    Representative samples, not live captures: add a row whenever a real failure shows an unhandled wording. */
export const PLATFORM_ERRORS: {
  name: string
  status: number | undefined
  message: string
  expected: RegExp
}[] = [
  {
    name: "moderation block",
    status: 422,
    message: "Content flagged by moderation (nsfw)",
    expected: /content filter/,
  },
  {
    name: "safety refusal",
    status: 400,
    message: "Request rejected by safety system",
    expected: /content filter/,
  },
  {
    name: "out of credits",
    status: 402,
    message: "Payment required",
    expected: /Not enough credits/,
  },
  {
    name: "credits by wording",
    status: 400,
    message: "Insufficient credit balance",
    expected: /Not enough credits/,
  },
  {
    name: "rate limited",
    status: 429,
    message: "Too many requests",
    expected: /Rate limit/,
  },
  {
    name: "bad key",
    status: 401,
    message: "Invalid API key",
    expected: /rejected your API key/,
  },
  {
    name: "forbidden",
    status: 403,
    message: "Forbidden",
    expected: /rejected your API key/,
  },
  {
    name: "unknown model",
    status: 404,
    message: "Not found",
    expected: /unavailable/,
  },
  {
    name: "overloaded",
    status: 503,
    message: "Service unavailable",
    expected: /unavailable/,
  },
  {
    name: "server error",
    status: 500,
    message: "Internal Server Error",
    expected: /their side|its side/,
  },
  {
    name: "bad gateway",
    status: 502,
    message: "Bad gateway",
    expected: /its side/,
  },
  {
    name: "validation (passes through)",
    status: 422,
    message: "prompt: ensure this value has at most 500 characters",
    expected: /at most 500/,
  },
  // The status is the platform's verdict; a keyword in the text must not override it.
  {
    name: "credit card in a 429",
    status: 429,
    message: "Too many requests for prompt 'credit card on a table'",
    expected: /Rate limit/,
  },
  {
    name: "rate wording in a 402",
    status: 402,
    message: "rate limit of your plan: out of balance",
    expected: /Not enough credits/,
  },
]
