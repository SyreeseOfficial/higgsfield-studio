const BASE = "https://api.higgsfield.ai";
const USER_AGENT = "higgsfield-studio/0.1";

export function authHeader(keyId: string, keySecret: string): string {
  return `Key ${keyId}:${keySecret}`;
}

// ponytail: Higgsfield has no account/validate endpoint. GET /requests/{id}/status
// on a random id returns 401 for bad credentials and 404 ("not found for this
// account") for good ones — zero-cost way to check a key. Swap for a real
// validate/balance endpoint if Higgsfield ever ships one.
export async function validateKey(keyId: string, keySecret: string): Promise<boolean> {
  const probeId = crypto.randomUUID();
  const res = await fetch(`${BASE}/requests/${probeId}/status`, {
    headers: {
      Authorization: authHeader(keyId, keySecret),
      "User-Agent": USER_AGENT,
    },
  });
  if (res.status === 401) return false;
  return true;
}

// ponytail: Higgsfield's public API has no account/balance endpoint (checked the
// OpenAPI spec and the billing docs — neither lists one; the only place balance
// shows up is the web dashboard, the `hf` CLI, and an unrelated MCP server tool
// that isn't reachable with a raw API key). So there is no real `credits` number
// to surface here. Don't fake one.

export type Cred = { keyId: string; keySecret: string };

export type ErrShape = { title: string; detail: string };

const ERR: Record<string, ErrShape> = {
  credits: { title: "Not enough credits", detail: "Your Higgsfield account doesn't have enough credits for this generation. No credits were charged." },
  invalidKey: { title: "API key no longer works", detail: "Higgsfield rejected this key. Reconnect it in Settings." },
  blocked: { title: "Model temporarily blocked", detail: "Higgsfield has this model blocked for your account right now. Try again later or pick another model." },
  unavailable: { title: "Model unavailable", detail: "Higgsfield's model is disabled or not ready. Try again shortly." },
  safety: { title: "Blocked by the content filter", detail: "Higgsfield flagged something in this prompt or reference. Rephrase it and try again. No credits were charged." },
  server: { title: "Higgsfield couldn't finish this run", detail: "The server returned an error. This is usually temporary. Your credits were refunded." },
  canceled: { title: "Generation canceled", detail: "This generation was canceled before it finished." },
  unsupported: { title: "Model not connected yet", detail: "This model isn't wired to a real Higgsfield endpoint yet." },
  needsImage: { title: "Add a reference image", detail: "This model only generates video from a starting image — attach one and try again." },
  concurrency: { title: "Too many requests at once", detail: "Higgsfield is limiting requests from this key right now." },
};

// ponytail: Higgsfield has no 429/Retry-After for its concurrency limit — it's a
// plain 400 with a message ("Maximum number of concurrent requests (N) has been
// reached", per their rate-limits doc, which also says they don't publish a
// retry-after value). Detect it by message and give the route a flag so it can
// still answer our own client with a real 429 + a made-up but reasonable wait.
export function isConcurrencyLimit(httpStatus: number, body: any): boolean {
  return httpStatus === 400 && /concurrent/i.test(String(body?.detail || ""));
}
export const ERR_CONCURRENCY = ERR.concurrency;

function errFromStatus(httpStatus: number, body: any): ErrShape {
  if (isConcurrencyLimit(httpStatus, body)) return ERR.concurrency;
  if (httpStatus === 401) return ERR.invalidKey;
  if (httpStatus === 403) return ERR.credits;
  if (httpStatus === 423) return ERR.blocked;
  if (httpStatus === 503) return ERR.unavailable;
  if (httpStatus >= 500) return ERR.server;
  return { title: "Higgsfield rejected this request", detail: String(body?.detail || body?.error || "Invalid parameters.") };
}

async function hf(cred: Cred, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: authHeader(cred.keyId, cred.keySecret), "User-Agent": USER_AGENT, ...(init.headers || {}) },
  });
  return res;
}

/** Relays one file's bytes to Higgsfield's presigned upload flow and returns its public URL. */
export async function uploadFile(cred: Cred, bytes: Buffer, contentType: string): Promise<string> {
  const genRes = await hf(cred, "/files/generate-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: contentType }),
  });
  if (!genRes.ok) throw new Error(`generate-upload-url failed: ${genRes.status}`);
  const { upload_url, upload_headers, public_url } = await genRes.json();
  const put = await fetch(upload_url, { method: "PUT", headers: upload_headers, body: new Uint8Array(bytes) });
  if (!put.ok) throw new Error(`upload PUT failed: ${put.status}`);
  return public_url as string;
}

export type RefInput = { url: string; kind: string; tag?: string };
export type CreateJob = {
  type: "image" | "video";
  model: string;
  prompt: string;
  negative?: string;
  ratio: string;
  res?: string;
  duration?: number;
  audio?: boolean;
  refs: RefInput[];
};

type CreateResult = { requestId: string } | { error: ErrShape };

// Generic model registry, ported from Higgsfield's own official Next.js template
// (`pnpm dlx shadcn@latest view higgsfield-ai/app-templates/models` —
// generation/catalog/defaults.ts + mappers.ts) rather than guessed — see TODO.md.
// Each entry is the set of real platform paths a model exposes per media role; `mapByPaths`
// mirrors the template's own `mapByPaths()` exactly: first/last frame, then image-to-video,
// then reference(s), then plain text.
type PlatformPaths = { text?: string; image?: string; firstLast?: string; reference?: string };

const GENERIC_VIDEO: Record<string, PlatformPaths> = {
  dop: { image: "higgsfield-ai/dop/lite" },
  "flux-3": { text: "blackforestlabs/flux-3/text-to-video", image: "blackforestlabs/flux-3/image-to-video" },
  "grok-video": { reference: "xai/grok-imagine-video/v1.5/reference-to-video" },
  "happy-horse-1-0": { text: "alibaba/happy-horse/text-to-video", image: "alibaba/happy-horse/image-to-video" },
  "happy-horse-1-1": { text: "alibaba/happy-horse/v1.1/text-to-video", image: "alibaba/happy-horse/v1.1/image-to-video" },
  "kling-2-6": { text: "kling-video/v2.6/pro/text-to-video", image: "kling-video/v2.6/pro/image-to-video" },
  "kling-o1": { firstLast: "kling-video/omni/first-last-frame" },
  "kling-o3": { firstLast: "kling-video/o3/first-last-frame" },
  "ltx-2-5-fast": { text: "lightricks/ltx-2.5/text-to-video/fast" }, // no image-to-video in the template
  "ltx-2-5-pro": { text: "lightricks/ltx-2.5/text-to-video/pro" },
  "minimax-h3": { text: "minimax/h3/text-to-video", image: "minimax/h3/image-to-video" },
  "pixverse-6": { text: "pixverse/v6/text-to-video", image: "pixverse/v6/image-to-video" },
  "wan-2-6": { text: "wan/v2.6/text-to-video", image: "wan/v2.6/image-to-video" },
  "wan-2-7": { text: "wan/v2.7/text-to-video", image: "wan/v2.7/image-to-video" },
  "wan-3": { text: "alibaba/wan-3.0/text-to-video", image: "alibaba/wan-3.0/image-to-video" },
  "wan-3-prime": { text: "alibaba/wan-3.0-prime/text-to-video", image: "alibaba/wan-3.0-prime/image-to-video" },
};

const GENERIC_IMAGE: Record<string, PlatformPaths> = {
  "flux-2": { text: "flux-2-pro" },
  "grok-image": { text: "xai/grok-imagine-image-2.0" },
  ideogram: { text: "ideogram/v4.0" },
  "qwen-image": { text: "alibaba/qwen-image-3/text-to-image" },
  recraft: { text: "recraft/v4.1/text-to-image" },
  "z-image": { text: "z-image/turbo" },
};

function refUrl(refs: RefInput[], tag: string): string | undefined {
  return refs.find((r) => r.tag === tag)?.url;
}
function refsByKind(refs: RefInput[], kind: string): string[] {
  return refs.filter((r) => r.kind === kind && r.tag !== "Start" && r.tag !== "End").map((r) => r.url);
}

function mapByPaths(job: CreateJob, paths: PlatformPaths, hasDuration: boolean): { path: string; body: any } | null {
  const start = refUrl(job.refs, "Start");
  const end = refUrl(job.refs, "End");
  const imgs = refsByKind(job.refs, "image");
  const vids = refsByKind(job.refs, "video");
  const body: any = { prompt: job.prompt, aspect_ratio: job.ratio, resolution: job.res };
  if (hasDuration) body.duration = job.duration || 5;
  if (paths.firstLast && (start || end)) {
    return { path: paths.firstLast, body: { ...body, ...(start ? { first_frame_url: start } : {}), ...(end ? { last_frame_url: end } : {}) } };
  }
  if (paths.image && start) {
    return { path: paths.image, body: { ...body, image_url: start, ...(end ? { last_image_url: end } : {}) } };
  }
  if (paths.reference && (imgs.length || vids.length)) {
    return { path: paths.reference, body: { ...body, ...(imgs.length ? { image_urls: imgs } : {}), ...(vids.length ? { video_urls: vids } : {}) } };
  }
  if (paths.text) return { path: paths.text, body: imgs.length ? { ...body, image_urls: imgs } : body };
  // No text path and none of the media-specific branches above matched: this model needs a
  // reference and none was given. (The official template's own mapper falls through to calling
  // paths.image/reference/firstLast anyway with no media — confirmed live that Higgsfield accepts
  // and starts "Generating…" on that incomplete request. Diverging here on purpose.)
  return null;
}

// ponytail: Higgsfield has one HTTP endpoint PER MODEL (and a different one again
// for the text-only vs reference-image variant of the same model), not one
// generic "create a generation" call. soul, seedance, kling, kling-standard, minimax, soul-v2
// and soul-cinema keep bespoke branches (confirmed via the OpenAPI spec); everything in
// GENERIC_VIDEO/GENERIC_IMAGE above is confirmed via Higgsfield's own template source. Anything
// still missing from both falls through to ERR.unsupported — better to say so than to guess a
// path and silently waste the user's credits on a malformed call.
async function createOne(cred: Cred, job: CreateJob): Promise<CreateResult> {
  let res: Response;
  const generic = job.type === "video" ? GENERIC_VIDEO[job.model] : GENERIC_IMAGE[job.model];
  if (generic) {
    const mapped = mapByPaths(job, generic, job.type === "video");
    if (!mapped) return { error: ERR.needsImage };
    res = await hf(cred, "/" + mapped.path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mapped.body) });
  } else if (job.model === "soul") {
    const resolution = job.res === "4K" ? "4K" : "2K"; // soul only ships 2K/4K
    res = await hf(cred, "/higgsfield-ai/soul/standard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: job.prompt, num_images: 1, resolution, aspect_ratio: job.ratio }),
    });
  } else if (job.model === "soul-v2" || job.model === "soul-cinema") {
    const path = job.model === "soul-v2" ? "higgsfield-ai/soul/v2/standard" : "higgsfield-ai/soul/cinema";
    const resolution = job.res === "1080p" ? "1080p" : "720p";
    res = await hf(cred, "/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: job.prompt, batch_size: 1, resolution, aspect_ratio: job.ratio, enhance_prompt: false }),
    });
  } else if (job.model === "seedance") {
    const images = job.refs.filter((r) => r.kind === "image").map((r) => r.url);
    const videos = job.refs.filter((r) => r.kind === "video").map((r) => r.url);
    const path = images.length || videos.length ? "/bytedance/seedance-2.0/reference-to-video" : "/bytedance/seedance-2.0/text-to-video";
    const body: any = { prompt: job.prompt, duration: job.duration || 5, resolution: job.res || "720p", aspect_ratio: job.ratio, generate_audio: !!job.audio };
    if (images.length) body.image_urls = images.slice(0, 9);
    if (videos.length) body.video_urls = videos.slice(0, 3);
    res = await hf(cred, path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } else if (job.model === "kling") {
    // kling-video takes one image_url, not an array — first image ref wins (Start frame, if tagged).
    const img = job.refs.find((r) => r.kind === "image");
    const path = img ? "/kling-video/v2.5-turbo/pro/image-to-video" : "/kling-video/v2.5-turbo/pro/text-to-video";
    const body: any = { prompt: job.prompt, duration: job.duration === 10 ? 10 : 5 };
    if (job.negative) body.negative_prompt = job.negative;
    if (img) body.image_url = img.url;
    res = await hf(cred, path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } else if (job.model === "minimax") {
    // hailuo-2.3/standard: confirmed via the OpenAPI spec. duration is 6|10 (not 5|10 like kling) —
    // prompt_optimizer has no UI control, left at the API's own default (true).
    const img = job.refs.find((r) => r.kind === "image");
    const path = img ? "/minimax/hailuo-2.3/standard/image-to-video" : "/minimax/hailuo-2.3/standard/text-to-video";
    const body: any = { prompt: job.prompt, duration: job.duration === 10 ? 10 : 6, prompt_optimizer: true };
    if (img) body.image_url = img.url;
    res = await hf(cred, path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } else if (job.model === "kling-standard") {
    // v2.5-turbo/standard/image-to-video only — confirmed via the OpenAPI spec (same body shape as
    // pro, but no text-to-video counterpart exists for this tier; image_url is required).
    const img = job.refs.find((r) => r.kind === "image");
    if (!img) return { error: ERR.needsImage };
    const body: any = { prompt: job.prompt, duration: job.duration === 10 ? 10 : 5, image_url: img.url };
    if (job.negative) body.negative_prompt = job.negative;
    res = await hf(cred, "/kling-video/v2.5-turbo/standard/image-to-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } else {
    return { error: ERR.unsupported };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: errFromStatus(res.status, body) };
  }
  const data = await res.json();
  return { requestId: data.request_id as string };
}

/** Creates `count` Higgsfield requests for one generation (soul alone could batch via num_images, but
 * kept to one request per item for all models — simplest uniform path, see ponytail note above). */
export async function createMany(cred: Cred, job: CreateJob, count: number): Promise<CreateResult[]> {
  const out: CreateResult[] = [];
  for (let i = 0; i < count; i++) out.push(await createOne(cred, job));
  return out;
}

export type StatusResult =
  | { status: "pending" }
  | { status: "completed"; url: string }
  | { status: "failed"; error: ErrShape };

export async function getStatus(cred: Cred, requestId: string): Promise<StatusResult> {
  const res = await hf(cred, `/requests/${requestId}/status`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { status: "failed", error: errFromStatus(res.status, body) };
  }
  const d = await res.json();
  if (d.status === "queued" || d.status === "in_progress") return { status: "pending" };
  if (d.status === "completed") {
    const url = d.images?.[0]?.url || d.video?.url || d.audio?.url || d.audios?.[0]?.url;
    if (!url) return { status: "failed", error: ERR.server };
    return { status: "completed", url };
  }
  if (d.status === "nsfw") return { status: "failed", error: ERR.safety };
  if (d.status === "canceled") return { status: "failed", error: ERR.canceled };
  return { status: "failed", error: d.error ? { title: "Higgsfield couldn't finish this run", detail: String(d.error) } : ERR.server };
}

export async function cancelRequest(cred: Cred, requestId: string): Promise<void> {
  await hf(cred, `/requests/${requestId}/cancel`, { method: "POST" }).catch(() => {});
}
