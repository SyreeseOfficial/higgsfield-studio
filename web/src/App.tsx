import { Component as ReactComponent, createRef } from 'react';
import React from 'react';

// ponytail: faithful port of Studio v8.dc.html's logic class + template into one
// component. Splitting into many small components would mean re-deriving all the
// cross-cutting computed state (pills, feed grouping, grid tiles, popovers) across
// prop boundaries — riskier than keeping the original's single-source-of-truth
// `buildVals()` shape and converting the template to JSX 1:1. Render is broken into
// per-view methods below so it reads like the original's view sections.

// Turns "prop:value;prop:value" into a React style object. The .dc.html template's
// style strings (including icon fill/stroke, which live inside `style`, not as
// separate SVG attributes) can be kept almost verbatim with this, instead of
// hand-converting every one to camelCase.
function css(s: string): React.CSSProperties {
  const out: Record<string, string> = {};
  s.split(';').forEach((rule) => {
    const i = rule.indexOf(':');
    if (i < 0) return;
    const prop = rule.slice(0, i).trim();
    const val = rule.slice(i + 1).trim();
    if (!prop || !val) return;
    const camel = prop.startsWith('-')
      ? prop.slice(1).split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
      : prop.split('-').map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('');
    out[camel] = val;
  });
  return out as React.CSSProperties;
}

// These "props" existed only so the original design-tool preview could swap demo
// states (offline, rate-limited, bad key, etc). There's no such panel in the real
// app, so they become fixed constants. Real offline/rate-limit/failure handling
// comes from the network and from TODO.md's P0 backend work, not from here.
const SHOW_WALKTHROUGH = true;
const DEFAULT_MODE: 'image' | 'video' = 'image';

const TAG_TIPS: Record<string, string> = { Start: 'Start frame: the video opens on this image', End: 'End frame: the video ends on this image' };
const SAMPLES = {
  image: [] as [string, string][],
  video: [
    ['Drone over coastline', 'Slow drone push over a rugged coastline at sunrise, waves breaking on black rocks, mist rising'],
    ['Neon street in rain', 'Handheld walk down a neon-lit street in the rain at night, reflections on wet pavement, shallow focus'],
    ['Ink in water', 'Macro shot of blue ink blooming in clear water, slow motion, black background'],
    ['Dancer in white studio', 'Dancer spinning in an empty white studio, flowing fabric, camera orbiting slowly'],
  ],
} as const;
// Per-model limits — only a control shows up for a model if server/src/higgsfield.ts's createOne()
// actually forwards that param for it. ratios/res verified against Higgsfield's OpenAPI spec for
// soul and kling (neither has a format param either, nor does the documented Seedance request body —
// the real output extension comes from Higgsfield's response, not a client choice, so there's no
// Format control at all).
// Generic models (GENERIC_VIDEO/GENERIC_IMAGE in higgsfield.ts) all share one settings shape —
// ported from the official template's videoModel()/imageModel() defaults. Duration there is a
// continuous 4-10s range, not a discrete choice, so those models get no duration pill; the server
// sends the template's own default (5s) for every request.
const GENERIC_VIDEO_CAPS = { ratios: ['16:9', '9:16', '1:1'], res: ['720p', '1080p'] };
const GENERIC_IMAGE_CAPS = { ratios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'], res: ['1k', '2k', '4k'] };
const SOUL_V2_CAPS = { ratios: ['9:16', '16:9', '4:3', '3:4', '1:1', '2:3', '3:2'], res: ['720p', '1080p'] };

const MODEL_CAPS: Record<string, { ratios?: string[]; res?: string[]; duration?: boolean; durations?: number[]; audio?: boolean; negative?: boolean }> = {
  soul: { ratios: ['1:1', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '16:9', '9:16', '21:9'], res: ['2K', '4K'] },
  'soul-v2': SOUL_V2_CAPS,
  'soul-cinema': SOUL_V2_CAPS,
  seedance: { ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], res: ['480p', '720p', '1080p', '4k'], duration: true, durations: [5, 10], audio: true },
  kling: { duration: true, durations: [5, 10], negative: true },
  'kling-standard': { duration: true, durations: [5, 10], negative: true },
  minimax: { duration: true, durations: [6, 10] },
  'flux-2': GENERIC_IMAGE_CAPS,
  'grok-image': GENERIC_IMAGE_CAPS,
  ideogram: GENERIC_IMAGE_CAPS,
  'qwen-image': GENERIC_IMAGE_CAPS,
  recraft: GENERIC_IMAGE_CAPS,
  'z-image': GENERIC_IMAGE_CAPS,
  dop: GENERIC_VIDEO_CAPS,
  'flux-3': GENERIC_VIDEO_CAPS,
  'grok-video': GENERIC_VIDEO_CAPS,
  'happy-horse-1-0': GENERIC_VIDEO_CAPS,
  'happy-horse-1-1': GENERIC_VIDEO_CAPS,
  'kling-2-6': GENERIC_VIDEO_CAPS,
  'kling-o1': GENERIC_VIDEO_CAPS,
  'kling-o3': GENERIC_VIDEO_CAPS,
  'ltx-2-5-fast': GENERIC_VIDEO_CAPS,
  'ltx-2-5-pro': GENERIC_VIDEO_CAPS,
  'minimax-h3': GENERIC_VIDEO_CAPS,
  'pixverse-6': GENERIC_VIDEO_CAPS,
  'wan-2-6': GENERIC_VIDEO_CAPS,
  'wan-2-7': GENERIC_VIDEO_CAPS,
  'wan-3': GENERIC_VIDEO_CAPS,
  'wan-3-prime': GENERIC_VIDEO_CAPS,
  'seedance-2-5': { ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], res: ['480p', '720p'], audio: true },
  'kling-3-turbo': { ratios: ['16:9', '9:16', '1:1'], res: ['720p', '1080p'] },
  'kling-3-std': { ratios: ['16:9', '9:16', '1:1'], audio: true },
  'kling-3-pro': { ratios: ['16:9', '9:16', '1:1'], audio: true },
  'kling-3-4k': { ratios: ['16:9', '9:16', '1:1'], audio: true },
};
const MAX_REFS = 10;
const PAGE = 24;
const FEED_PAGE = 20;
const DRAFT_KEYS = ['prompt', 'negOn', 'negPrompt', 'model', 'ratio', 'res', 'fmt', 'duration', 'audio', 'batch'];
function loadDraft(): Record<string, unknown> {
  try {
    const d = JSON.parse(localStorage.getItem('studio.draft') || 'null');
    if (!d || typeof d !== 'object') return {};
    const o: Record<string, unknown> = {};
    DRAFT_KEYS.forEach((k) => { if (k in d) o[k] = d[k]; });
    return o;
  } catch { return {}; }
}
function loadTheme(): 'dark' | 'light' { try { return localStorage.getItem('studio.theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } }
function loadDefMode(): 'image' | 'video' { try { return localStorage.getItem('studio.defaultMode') === 'video' ? 'video' : DEFAULT_MODE; } catch { return DEFAULT_MODE; } }
function zip(files: { name: Uint8Array; data: Uint8Array }[]): Blob {
  const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (d: Uint8Array) => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = T[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const parts: (ArrayBuffer | Uint8Array)[] = [], cen: (ArrayBuffer | Uint8Array)[] = []; let off = 0;
  files.forEach((f) => {
    const c = crc(f.data), sz = f.data.length, nl = f.name.length, L = new DataView(new ArrayBuffer(30)), C = new DataView(new ArrayBuffer(46));
    L.setUint32(0, 0x04034b50, true); L.setUint16(4, 20, true); L.setUint16(12, 0x21, true); L.setUint32(14, c, true); L.setUint32(18, sz, true); L.setUint32(22, sz, true); L.setUint16(26, nl, true);
    C.setUint32(0, 0x02014b50, true); C.setUint16(4, 20, true); C.setUint16(6, 20, true); C.setUint16(14, 0x21, true); C.setUint32(16, c, true); C.setUint32(20, sz, true); C.setUint32(24, sz, true); C.setUint16(28, nl, true); C.setUint32(42, off, true);
    parts.push(L.buffer, f.name, f.data); cen.push(C.buffer, f.name); off += 30 + nl + sz;
  });
  const cs = cen.reduce((n: number, b) => n + (b as ArrayBuffer).byteLength, 0), E = new DataView(new ArrayBuffer(22));
  E.setUint32(0, 0x06054b50, true); E.setUint16(8, files.length, true); E.setUint16(10, files.length, true); E.setUint32(12, cs, true); E.setUint32(16, off, true);
  return new Blob([...parts, ...cen, E.buffer] as BlobPart[], { type: 'application/zip' });
}
function imgDims(u: string): Promise<[number, number] | null> {
  return new Promise((r) => { const im = new Image(); im.onload = () => r(im.naturalWidth && im.naturalHeight ? [im.naturalWidth, im.naturalHeight] : null); im.onerror = () => r(null); im.src = u; });
}
function ratioOf(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a), d = gcd(w, h), a = w / d, b = h / d;
  if (a <= 32 && b <= 32) return a + ':' + b;
  const r = w / h;
  for (const s of ['1:1', '5:4', '4:5', '4:3', '3:4', '3:2', '2:3', '16:10', '10:16', '16:9', '9:16', '21:9', '9:21']) {
    const [x, y] = s.split(':').map(Number); if (Math.abs(x / y - r) / r < 0.015) return s;
  }
  return r >= 1 ? +r.toFixed(2) + ':1' : '1:' + +(1 / r).toFixed(2);
}
function mediaMeta(url: string, kind: string): Promise<Record<string, number | null> | null> {
  return new Promise((res) => {
    if (kind === 'image') { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null); im.src = url; return; }
    const el = document.createElement(kind) as HTMLMediaElement; el.preload = 'metadata';
    el.onloadedmetadata = () => res({ dur: Math.round(el.duration) || null, ...(kind === 'video' ? { w: (el as HTMLVideoElement).videoWidth, h: (el as HTMLVideoElement).videoHeight } : {}) });
    el.onerror = () => res(null); el.src = url;
  });
}
function terms(q: string): string[] { return (q || '').trim().toLowerCase().split(/\s+/).filter(Boolean); }

// Polls every 250ms while mounted, for "Xm ago" / progress labels that must tick
// without a full re-render of everything else.
class Live extends ReactComponent<{ fn: () => React.ReactNode }> {
  static subs = new Set<Live>();
  static timer: ReturnType<typeof setInterval> | null = null;
  componentDidMount() { Live.subs.add(this); if (!Live.timer) Live.timer = setInterval(() => Live.subs.forEach((c) => c.forceUpdate()), 250); }
  componentWillUnmount() { Live.subs.delete(this); if (!Live.subs.size && Live.timer) { clearInterval(Live.timer); Live.timer = null; } }
  render() { return this.props.fn(); }
}

type AnyState = Record<string, any>;

export default class App extends ReactComponent<Record<string, never>, AnyState> {
  fileRef = createRef<HTMLInputElement>();
  feedRef = createRef<HTMLDivElement>();
  promptRef = createRef<HTMLTextAreaElement>();
  editorRef = createRef<HTMLTextAreaElement>();
  pillsRef = createRef<HTMLDivElement>();
  popRef = createRef<HTMLDivElement>();
  gridRef = createRef<HTMLDivElement>();
  searchRef = createRef<HTMLInputElement>();

  _loaded = new Set<string>();
  _fresh: Record<string, { d: number }> = {};
  _blobs = new Set<string>();
  _lists: Record<string, string[]> = {};
  _memo?: Map<string, { d: unknown[]; v: unknown }>;
  _memoNext?: Map<string, { d: unknown[]; v: unknown }>;
  dragDepth = 0;

  state: AnyState = {
    theme: loadTheme(),
    view: 'create', mode: loadDefMode(), defMode: loadDefMode(),
    projectId: null, projectsOpen: true, popover: null, menuPage: 'main',
    collapsed: (() => { try { return localStorage.getItem('studio.sidebarCollapsed') === '1'; } catch { return false; } })(),
    hasKey: false, keyLast4: '', checking: false, keyErr: '',
    walkHidden: (() => { try { return localStorage.getItem('studio.walkthroughDone') === '1'; } catch { return false; } })(),
    walkPrompt: false, walkGen: false, walkResult: false, modal: null, keyInput: '', replacing: false,
    prompt: '', negOn: false, negPrompt: '',
    model: { image: 'soul', video: 'seedance' }, ratio: { image: '3:4', video: '16:9' },
    res: { image: '2K', video: '720p' }, fmt: { image: 'PNG', video: 'MP4' },
    duration: 5, audio: true, batch: 2,
    refs: { start: null, end: null, list: [] },
    projects: [] as unknown[],
    counts: { assets: 0, favorites: 0, uploads: 0, uploadBytes: 0, projects: {} as Record<string, number> },
    newEmoji: null,
    uploads: [] as unknown[],
    gens: [] as unknown[],
    session: [] as string[],
    failed: [] as unknown[], expanded: {},
    pending: [] as unknown[], feedShown: FEED_PAGE, hoverId: null, projHover: null, lightbox: null, lbSource: 'feed',
    fType: 'all', fModel: 'all', fProject: 'all', fFav: 'all', fRatio: 'all', q: '', projDrop: null, projDragId: null, assetDrag: 0, sort: 'new', newName: '', renameId: null,
    selectMode: false, selected: [] as string[], confirm: null, shortcuts: false, gridIds: [] as string[], gridCursor: null, gridTotal: 0, gridDone: false, gridLoading: false, gridBoot: true, qd: '', catalog: null, catalogErr: false, submitting: false,
    upQ: '', upType: 'all', upUse: 'all', upSort: 'new', upSelect: false, upSel: [] as string[], upPv: null, upHover: null, zipping: false, exporting: false, toasts: [] as unknown[], dragging: false,
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false, rateUntil: null, copied: null,
    ...loadDraft(),
  };

  // ── Composer helpers ────────────────────────────────────────────────────
  autosize() { const el = this.promptRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 240) + 'px'; }
  openEditor = () => this.setState({ editorOpen: true, popover: null }, () => setTimeout(() => { const el = this.editorRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 30));
  closeEditor = () => this.setState({ editorOpen: false }, () => setTimeout(() => { const el = this.promptRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 30));
  markLoaded(src: string) { if (this._loaded.has(src)) return; this._loaded.add(src); if (!this._ldRaf) this._ldRaf = requestAnimationFrame(() => { this._ldRaf = 0; this.forceUpdate(); }); }
  _ldRaf = 0;
  live(key: string, fn: () => React.ReactNode) { return <Live key={key} fn={fn} />; }
  memo<T>(key: string, deps: unknown[], build: () => T): T {
    const prev = this._memo && this._memo.get(key);
    const hit = !!prev && prev.d.length === deps.length && prev.d.every((x, i) => x === deps[i]);
    const e = hit ? prev! : { d: deps, v: build() };
    this._memoNext!.set(key, e);
    return e.v as T;
  }
  maybeMoreFeed = () => {
    const el = this.feedRef.current; if (!el || (this.state.feedShown || 0) >= (this._feedTotal || 0)) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 1200) return;
    this.setState((st: AnyState) => ({ feedShown: (st.feedShown || FEED_PAGE) + FEED_PAGE }));
  };
  _feedTotal = 0;
  _anchor: any = null;
  openPop(key: string, e: any, pref: string, extra: AnyState = {}) {
    if (this.state.popover === key && pref !== 'point') { this.setState({ popover: null }); return; }
    this._anchor = pref === 'point' ? { pt: { x: e.clientX, y: e.clientY }, pref } : { el: e.currentTarget, pref };
    this.setState({ popover: key, popXY: null, ...extra });
  }
  placePop() {
    const el = this.popRef.current, a = this._anchor; if (!el || !a || !this.state.popover) return;
    const prev = el.style.maxHeight; el.style.maxHeight = 'none';
    const w = el.offsetWidth, h = el.offsetHeight; el.style.maxHeight = prev;
    const M = 8, vw = window.innerWidth, vh = window.innerHeight, pt = a.pt;
    let r: any; if (pt) r = { left: pt.x, right: pt.x, top: pt.y, bottom: pt.y }; else { if (!a.el || !a.el.isConnected) return; r = a.el.getBoundingClientRect(); }
    const G = pt ? 2 : 6, below = vh - r.bottom - G - M, above = r.top - G - M;
    let side = a.pref.startsWith('top') ? 'top' : 'bottom';
    if (side === 'bottom' && h > below && above > below) side = 'top';
    else if (side === 'top' && h > above && below > above) side = 'bottom';
    const room = Math.max(120, side === 'bottom' ? below : above), hh = Math.min(h, room);
    let left = a.pref.endsWith('end') ? r.right - w : r.left;
    if (pt && left + w > vw - M) left = r.left - w;
    left = Math.max(M, Math.min(left, vw - w - M));
    const xy = { left: Math.round(left), top: Math.round(side === 'bottom' ? r.bottom + G : r.top - G - hh), maxH: Math.floor(room) };
    const o = this.state.popXY; if (!o || o.left !== xy.left || o.top !== xy.top || o.maxH !== xy.maxH) this.setState({ popXY: xy });
  }
  _pillsEl: HTMLDivElement | null = null;
  _ro: ResizeObserver | null = null;
  fitPills() {
    const el = this.pillsRef.current;
    if (el !== this._pillsEl) {
      this._ro?.disconnect(); this._pillsEl = el;
      if (el && window.ResizeObserver) { let w = el.clientWidth; this._ro = new ResizeObserver(() => { const nw = el.clientWidth; if (nw > w + 24) { w = nw; this.setState({ pillLvl: 0 }); } else if (nw < w) w = nw; this.fitPills(); }); this._ro.observe(el); }
    }
    const s = this.state, lvl = s.pillLvl || 0;
    if (!el || String(s.popover || '').startsWith('pill:')) return;
    if (el.scrollWidth > el.clientWidth + 1 && lvl < 3) this.setState({ pillLvl: lvl + 1 });
  }

  // ── API key (real: server/src/routes/key.ts) ───────────────────────────
  async loadKey() {
    try {
      const r = await fetch('/api/key'); const d = await r.json();
      this.setState({ hasKey: !!d.connected, keyLast4: d.last4 || '' });
    } catch { /* server not reachable yet; stay disconnected */ }
  }
  submitKey = async () => {
    const k = this.state.keyInput.trim(); if (!k || this.state.checking) return;
    this.setState({ checking: true, keyErr: '' });
    try {
      const r = await fetch('/api/key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k }) });
      const d = await r.json();
      if (!r.ok) { this.setState({ checking: false, keyErr: d.error || "Higgsfield didn't accept this key." }); return; }
      this.setState({ checking: false, hasKey: true, keyLast4: d.last4 || '', keyInput: '', modal: null, replacing: false });
      this.notify('API key connected');
    } catch {
      this.setState({ checking: false, keyErr: "Couldn't reach the server. Try again." });
    }
  };
  removeKey = async () => {
    this.setState({ hasKey: false, modal: null });
    try { await fetch('/api/key', { method: 'DELETE' }); } catch { /* ignore */ }
    this.notify('API key removed', { kind: 'delete' });
  };
  recheckKey = async () => {
    if (this.state.checking) return;
    this.setState({ checking: true });
    await this.loadKey();
    this.setState({ checking: false });
    this.toastMsg(this.state.hasKey ? 'Key is working' : 'Key not connected', this.state.hasKey ? undefined : 'error');
  };
  keyVals() {
    const s = this.state;
    const info = s.hasKey ? { dot: 'var(--accent)', label: 'API key active', short: 'Active', meta: '' } : { dot: 'var(--text3)', label: '', short: '', meta: '' };
    return {
      keyChip: info,
      keyDetail: 'Each generation uses credits from the account that owns this key.',
      keyNeedsTopUp: false,
      keyCreditsLine: 'Connected',
      keyStatus: s.hasKey ? 'Connected. Ready to generate.' : 'Not connected. Connect a key to start generating.',
      checking: s.checking, keyErr: s.keyErr, keyInputBorder: s.keyErr ? 'var(--danger)' : 'var(--border2)',
      keySaveLabel: s.checking ? 'Checking…' : (s.replacing ? 'Replace API key' : 'Connect API key'),
      recheckLabel: s.checking ? 'Checking' : 'Recheck',
      recheckKey: this.recheckKey,
    };
  }

  // ── Projects / generations persistence (real: server/src/routes/*) ─────
  async loadProjects() {
    try {
      const r = await fetch('/api/projects');
      if (r.ok) this.setState({ projects: await r.json() });
    } catch { /* server not reachable yet */ }
  }
  persistProjects(list: AnyState[]) {
    fetch('/api/projects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(list) }).catch(() => {});
  }
  setTheme(theme: string) { this.setState({ theme }); try { localStorage.setItem('studio.theme', theme); } catch { /* ignore */ } }
  setDefMode(mode: string) { this.setState({ defMode: mode }); try { localStorage.setItem('studio.defaultMode', mode); } catch { /* ignore */ } }
  exportBackup = async () => {
    if (this.state.exporting) return;
    this.setState({ exporting: true });
    try {
      const r = await fetch('/api/export');
      if (!r.ok) throw new Error('export failed');
      const blob = await r.blob(), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `studio-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch {
      this.toastMsg("Couldn't prepare the backup. Try again.", 'error');
    } finally {
      this.setState({ exporting: false });
    }
  };
  persistFav(ids: string[], fav: boolean) {
    fetch('/api/generations/items/fav', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, fav }) }).catch(() => {});
  }
  async loadGenerations() {
    try {
      const r = await fetch('/api/generations');
      if (!r.ok) return;
      const rows: AnyState[] = await r.json();
      const gens = rows.filter((g) => g.status === 'completed');
      const failed = rows.filter((g) => g.status === 'failed').map((g) => ({ ...g, err: g.error }));
      const pending = rows.filter((g) => g.status === 'pending').map((g): AnyState => ({ ...g, t: g.t, dur: g.type === 'video' ? 60000 : 15000 }));
      this.setState((s: AnyState) => ({ gens: [...s.gens, ...gens], failed: [...s.failed, ...failed], pending: [...s.pending, ...pending], session: [...gens.map((g) => g.id).reverse(), ...s.session] }));
      pending.forEach((g) => this.pollGen(g.id, g));
    } catch { /* server not reachable yet */ }
  }
  // Sidebar totals used to be computed client-side from the (already fully hydrated) `gens` array —
  // that was already correct, just not routed through a real endpoint. This moves the same numbers
  // server-side per TODO.md's checklist; it's a parity swap, not a behavior fix.
  async loadCounts() {
    try {
      const r = await fetch('/api/counts');
      if (r.ok) this.setState({ counts: await r.json() });
    } catch { /* server not reachable yet */ }
  }
  async loadUploads() {
    try {
      const r = await fetch('/api/uploads');
      if (r.ok) this.setState({ uploads: (await r.json()).items });
    } catch { /* server not reachable yet */ }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  // ponytail: this used to be defined but never called anywhere — nothing wired
  // up on page load (key state, catalog, keyboard shortcuts, paste handler, all
  // dead). Needed a real mount hook for loadProjects/loadGenerations below
  // anyway, so fixing this at the root instead of adding a second one.
  componentDidMount() { this.mountEffects(); }
  mountEffects() {
    this.onKey = (e: KeyboardEvent) => {
      const s = this.state;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        const t = tag === 'INPUT' || tag === 'TEXTAREA' ? null : [...s.toasts].reverse().find((x: any) => x.undo && !x.leaving);
        if (t) { e.preventDefault(); this.runUndo(t.id); }
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && (s.view === 'assets' || s.view === 'uploads') && !s.modal && !s.confirm && !s.lightbox && !s.upPv && this.searchRef.current) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); this.searchRef.current.focus(); }
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !s.modal && !s.confirm) {
        const a = document.activeElement as HTMLElement, tag = a?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !a?.isContentEditable) { e.preventDefault(); this.setState({ shortcuts: !s.shortcuts, popover: null }); return; }
      }
      if (e.key === 'Escape') {
        if (s.popover) this.setState({ popover: null });
        else if (s.shortcuts) this.setState({ shortcuts: false });
        else if (s.modal === 'manage' && s.replacing) this.setState({ replacing: false, keyInput: '', keyErr: '' });
        else if (s.modal || s.confirm) this.setState({ modal: null, confirm: null, replacing: false, renameId: null });
        else if (s.editorOpen) this.closeEditor();
        else if (s.lightbox) this.setState({ lightbox: null });
        else if (s.upPv) this.setState({ upPv: null });
        else if (document.activeElement === this.searchRef.current) return;
        else if (s.selectMode) this.setState({ selectMode: false, selected: [] });
        else if (s.upSelect) this.setState({ upSelect: false, upSel: [] });
        else return;
        e.preventDefault();
      }
      if (s.view === 'uploads' && !s.modal && !s.confirm && !s.lightbox && !s.popover) {
        const tag = (document.activeElement as HTMLElement)?.tagName, typing = tag === 'INPUT' || tag === 'TEXTAREA';
        if (!typing && s.upPv) {
          if (e.key === 'ArrowRight') this.upStep(1);
          else if (e.key === 'ArrowLeft') this.upStep(-1);
          else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteUploads([s.upPv]); }
        } else if (!typing && s.upSelect) {
          if ((e.key === 'Delete' || e.key === 'Backspace') && s.upSel.length) { e.preventDefault(); this.deleteUploads(s.upSel); }
          else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); this.setState({ upSel: this._upIds || [] }); }
        }
      }
      if (s.lightbox && !s.modal && !s.confirm) {
        if (e.key === 'ArrowRight') this.lbStep(1);
        if (e.key === 'ArrowLeft') this.lbStep(-1);
        const k = e.key, z = this.lbZ(), m = this.lbMetrics();
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (k === 'f' || k === 'F') { e.preventDefault(); this.toggleFav(s.lightbox); }
        else if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); this.askDelete([s.lightbox]); }
        else if (k === '+' || k === '=') { e.preventDefault(); this.lbZoomTo(z.s * 1.25, 0, 0, true); }
        else if (k === '-') { e.preventDefault(); this.lbZoomTo(z.s / 1.25, 0, 0, true); }
        else if (k === '0') { e.preventDefault(); this.lbZoomTo(1, 0, 0, true); }
        else if (k === '1' && m) { e.preventDefault(); this.lbZoomTo(m.one, 0, 0, true); }
      }
    };
    this.onPaste = (e: ClipboardEvent) => {
      const s = this.state;
      if ((s.view !== 'create' && s.view !== 'uploads') || s.modal || s.confirm || s.lightbox) return;
      const files = [...(e.clipboardData?.files || [])].filter((f) => /^(image|video|audio)\//.test(f.type));
      if (files.length) { e.preventDefault(); if (s.view === 'uploads') this.libraryUpload(files); else this.addFiles(files); }
    };
    this.onScrollAny = (e: Event) => { if (!this.state.popover) return; const el = this.popRef.current; if (el && e.target instanceof Node && el.contains(e.target)) return; this.setState({ popover: null }); };
    window.addEventListener('scroll', this.onScrollAny, true); window.addEventListener('resize', this.onScrollAny);
    window.addEventListener('keydown', this.onKey);
    this.loadCatalog();
    this.loadKey();
    this.loadProjects();
    this.loadGenerations();
    this.loadCounts();
    this.loadUploads();
    window.addEventListener('paste', this.onPaste);
    this.onNet = () => { const on = navigator.onLine !== false; if (on === this.state.online) return; this.setState({ online: on }); if (on) this.notify('Back online', { kind: 'info' }); };
    window.addEventListener('online', this.onNet); window.addEventListener('offline', this.onNet);
    this.onHide = () => { if (this._dt) { clearTimeout(this._dt); this.saveDraft(); } }; window.addEventListener('pagehide', this.onHide);
    this.fitPills(); requestAnimationFrame(() => this.fitPills()); (document as any).fonts?.ready.then(() => this.fitPills());
    this.autosize();
    requestAnimationFrame(this.maybeMoreFeed);
  }
  onKey?: (e: KeyboardEvent) => void;
  onPaste?: (e: ClipboardEvent) => void;
  onScrollAny?: (e: Event) => void;
  onNet?: () => void;
  onHide?: () => void;
  _dt?: ReturnType<typeof setTimeout>;
  _rt?: ReturnType<typeof setInterval> | null;
  _ct?: ReturnType<typeof setTimeout>;
  _tt?: Record<string, ReturnType<typeof setTimeout>>;
  _dl?: Record<string, number>;
  _rem?: Record<string, number>;
  _gt?: Record<string, ReturnType<typeof setTimeout>>;
  _sweepT?: ReturnType<typeof setTimeout>;
  _qt?: ReturnType<typeof setTimeout>;
  _upIds?: string[];
  _upLast?: string;
  _lastSel?: string;
  _gTok = 0;
  _gk?: string;
  _gn?: number;
  _pillMode?: string;
  _lbStage?: HTMLElement | null;
  _lbBox?: HTMLElement | null;
  _moved = false;
  componentWillUnmount() {
    window.removeEventListener('scroll', this.onScrollAny as any, true); window.removeEventListener('resize', this.onScrollAny as any);
    window.removeEventListener('keydown', this.onKey as any); window.removeEventListener('paste', this.onPaste as any);
    window.removeEventListener('online', this.onNet as any); window.removeEventListener('offline', this.onNet as any);
    if (this._rt) clearInterval(this._rt); clearTimeout(this._ct);
    Object.values(this._tt || {}).forEach(clearTimeout);
    this._ro?.disconnect(); this._blobs.forEach((u) => URL.revokeObjectURL(u)); this._blobs.clear();
  }
  componentDidUpdate(_pp: unknown, ps: AnyState) {
    const s = this.state;
    const gk = this.gridKey(s); if (gk !== this._gk) { this._gk = gk; if (gk) this.resetGrid(); }
    const gn = s.gens.reduce((a: number, g: any) => a + g.items.length, 0); if (gk && this._gn !== undefined && gn > this._gn && !s.gridBoot) this.fetchPage(true); this._gn = gn;
    if (DRAFT_KEYS.some((k) => ps[k] !== s[k])) { clearTimeout(this._dt); this._dt = setTimeout(() => this.saveDraft(), 250); }
    if (s.popover && (s.popover !== ps.popover || s.menuPage !== ps.menuPage || !s.popXY)) this.placePop();
    if (ps.prompt !== s.prompt || ps.editorOpen !== s.editorOpen || ps.view !== s.view) requestAnimationFrame(() => this.autosize());
    if (this._pillMode !== undefined && this._pillMode !== s.mode && s.pillLvl) { this._pillMode = s.mode; this.setState({ pillLvl: 0 }); } else { this._pillMode = s.mode; this.fitPills(); }
    if (ps.pending && s.pending.length > ps.pending.length) { const el = this.feedRef.current; if (el) el.scrollTop = 0; }
    if (ps.projectId !== s.projectId) { if (s.feedShown !== FEED_PAGE) this.setState({ feedShown: FEED_PAGE }); }
    else if (ps.feedShown !== s.feedShown || ps.session !== s.session || ps.failed !== s.failed || ps.view !== s.view) requestAnimationFrame(this.maybeMoreFeed);
  }
  saveDraft() { try { const s = this.state, o: AnyState = {}; DRAFT_KEYS.forEach((k) => { o[k] = s[k]; }); localStorage.setItem('studio.draft', JSON.stringify(o)); } catch { /* ignore */ } }

  // ── Toasts ───────────────────────────────────────────────────────────────
  toastMsg(m: string, kind?: string) { return this.notify(m, { kind }); }
  notify(msg: string, o: AnyState = {}) {
    const id = 't' + Date.now() + Math.random().toString(36).slice(2, 5), kind = o.kind || 'success';
    const ms = o.duration || (o.undo ? 8000 : kind === 'error' ? 5000 : 3000);
    const t = { id, msg, kind, undo: o.undo || null, shown: false, leaving: false, paused: false, ms };
    this._tt = this._tt || {};
    this.setState((s: AnyState) => {
      const live = s.toasts.filter((x: any) => !x.leaving);
      live.slice(0, Math.max(0, live.length - 2)).forEach((x: any) => setTimeout(() => this.dismiss(x.id), 0));
      return { toasts: [...s.toasts, t] };
    }, () => requestAnimationFrame(() => requestAnimationFrame(() => this.setState((s: AnyState) => ({ toasts: s.toasts.map((x: any) => (x.id === id ? { ...x, shown: true } : x)) })))));
    this.arm(id, ms);
    return id;
  }
  arm(id: string, ms: number) { this._tt = this._tt || {}; this._dl = this._dl || {}; this._dl[id] = Date.now() + ms; clearTimeout(this._tt[id]); this._tt[id] = setTimeout(() => this.dismiss(id), ms); }
  pauseToast(id: string) {
    clearTimeout(this._tt?.[id]); this._rem = this._rem || {}; this._rem[id] = Math.max(300, (this._dl?.[id] || 0) - Date.now());
    this.setState((s: AnyState) => ({ toasts: s.toasts.map((x: any) => (x.id === id ? { ...x, paused: true } : x)) }));
  }
  resumeToast(id: string) {
    this.arm(id, this._rem?.[id] || 2500);
    this.setState((s: AnyState) => ({ toasts: s.toasts.map((x: any) => (x.id === id ? { ...x, paused: false } : x)) }));
  }
  dismiss(id: string) {
    clearTimeout(this._tt?.[id]); if (this._tt) delete this._tt[id];
    this.setState((s: AnyState) => ({ toasts: s.toasts.map((x: any) => (x.id === id ? { ...x, leaving: true } : x)) }));
    setTimeout(() => this.setState((s: AnyState) => ({ toasts: s.toasts.filter((x: any) => x.id !== id) })), 200);
  }
  runUndo(id: string) {
    const t = this.state.toasts.find((x: any) => x.id === id); if (!t || !t.undo || t.leaving) return;
    t.undo(); this.dismiss(id); this.notify('Restored', { kind: 'info' });
  }
  snap(extra: AnyState = {}) { const s = this.state; return { gens: s.gens, session: s.session, projects: s.projects, ...extra }; }
  restore(sn: AnyState) {
    this.setState((s: AnyState) => {
      const known = new Set(sn.gens.map((g: any) => g.id)), kp = new Set(sn.projects.map((p: any) => p.id));
      const out: AnyState = { gens: [...sn.gens, ...s.gens.filter((g: any) => !known.has(g.id))], session: [...s.session.filter((id: string) => !known.has(id)), ...sn.session.filter((id: string) => known.has(id))], projects: [...sn.projects, ...s.projects.filter((p: any) => !kp.has(p.id))] };
      if (sn.projectId !== undefined) out.projectId = sn.projectId;
      if (sn.fProject !== undefined) out.fProject = sn.fProject;
      if (sn.uploads) { const ku = new Set(sn.uploads.map((u: any) => u.id)); out.uploads = [...sn.uploads, ...s.uploads.filter((u: any) => !ku.has(u.id))]; }
      if (sn.refs) out.refs = sn.refs;
      return out;
    }, () => this.persistProjects(this.state.projects));
  }
  copy(text: string, key: string) {
    try { navigator.clipboard.writeText(text).catch(() => {}); } catch { /* ignore */ }
    clearTimeout(this._ct); this.setState({ copied: key });
    this._ct = setTimeout(() => this.setState({ copied: null }), 1600);
  }

  // ── Network / rate limit ────────────────────────────────────────────────
  offline() { return !this.state.online; }
  rateLeft() { return Math.max(0, (this.state.rateUntil || 0) - Date.now()); }
  startRate(sec: number) {
    if (this._rt) clearInterval(this._rt);
    this.setState({ rateUntil: Date.now() + sec * 1000 });
    this._rt = setInterval(() => {
      if (this.rateLeft() > 0) { this.forceUpdate(); return; }
      if (this._rt) clearInterval(this._rt); this._rt = null; this.setState({ rateUntil: null }); this.notify('You can generate again', { kind: 'info' });
    }, 1000);
  }
  stopRate() { if (this._rt) clearInterval(this._rt); this._rt = null; this.setState({ rateUntil: null }); }
  clock(ms: number) { const t = Math.floor(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
  progress(p: any, i: number) { const x = Math.min(1, Math.max(0, (Date.now() - p.t - i * 250) / (p.dur || 5000))); return Math.min(99, Math.round(100 * (1 - Math.pow(1 - x, 1.8)))); }
  spinner() { return <span style={{ width: 14, height: 14, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />; }

  // ── Generation (real: server/src/routes/generations.ts) ─────────────────
  genBlock(): any {
    const s = this.state, rl = this.rateLeft();
    if (s.submitting) return { reason: 'Sending…', title: 'Sending your generation to Higgsfield…' };
    if (this.offline()) return { reason: 'Offline', title: "You're offline. Generate is paused until you reconnect." };
    if (rl) return { reason: 'Rate limited · ' + this.clock(rl), title: 'Higgsfield is limiting requests from this key' };
    if (!s.hasKey) return { reason: 'Connect key', title: 'Connect your Higgsfield API key to generate', action: () => this.setState({ modal: 'connect', keyInput: '', keyErr: '', replacing: false, popover: null }) };
    if (!s.catalog) return { reason: s.catalogErr ? 'Models unavailable' : 'Loading models', title: s.catalogErr ? "Couldn't load the model list. Reload to try again." : 'Loading the model list…' };
    if (s.refs.start?.uploading || s.refs.end?.uploading || s.refs.list.some((x: any) => x.uploading)) return { reason: 'Uploading…', title: 'Waiting for a reference to finish uploading' };
    if (!s.prompt.trim()) return { reason: 'Add a prompt', title: 'Describe what you want to make' };
    return null;
  }
  // Generate always stops at a confirmation modal first (doGenerate actually submits) — guards
  // against an accidental click or an accidental ⌘/Ctrl+Enter firing off a real generation.
  generate = () => {
    const s = this.state, m = s.mode, b = this.genBlock();
    if (b) { if (b.action) b.action(); return; }
    const payload = { type: m, model: s.model[m], prompt: s.prompt.trim(), negative: s.negOn ? s.negPrompt.trim() : '', ratio: s.ratio[m], res: s.res[m], fmt: s.fmt[m], duration: s.duration, audio: s.audio, batch: s.batch, project: s.projectId,
      refs: [...(m === 'video' && s.refs.start ? [{ ...s.refs.start, kind: 'image', tag: 'Start' }] : []), ...(m === 'video' && s.refs.end ? [{ ...s.refs.end, kind: 'image', tag: 'End' }] : []),
        ...s.refs.list.filter((x: any) => x.mode === m).map((x: any) => ({ url: x.url, kind: x.kind, name: x.name, tag: '', uploadId: x.uploadId }))] };
    this.setState({ confirm: { kind: 'generate', payload }, popover: null });
  };
  doGenerate() {
    const c = this.state.confirm;
    if (!c || c.kind !== 'generate') return;
    this.setState({ confirm: null }, () => { if (this.runGen(c.payload)) this.setState({ prompt: '' }); });
  }
  // Real submission below (server/src/routes/generations.ts). The synchronous guards stay up front so
  // `generate()`'s `if (this.runGen(p)) clearPrompt()` contract is unchanged; the network round trip
  // (ref upload + POST + poll) runs detached, same shape as the old setTimeout it replaces.
  runGen(p: AnyState): boolean {
    const ks = this.state;
    if (ks.submitting) return false; // already sending one — ignore a double-click/double-Enter re-entry
    if (this.offline()) { this.toastMsg("You're offline. Try again when you reconnect.", 'error'); return false; }
    if (this.rateLeft()) { this.toastMsg(`Rate limited. Try again in ${this.clock(this.rateLeft())}.`, 'error'); return false; }
    if (!ks.hasKey) { this.setState({ modal: 'connect', keyErr: '', popover: null, lightbox: null }); return false; }
    if (!this.findModel(p.type, p.model)) { this.toastMsg("This model isn't available right now", 'error'); return false; }
    this.setState({ walkGen: true });
    const tempId = 'tmp' + Date.now() + Math.random().toString(36).slice(2, 5);
    const dur = (p.type === 'video' ? 60000 : 15000);
    this.setState((s: AnyState) => ({ pending: [{ id: tempId, ...p, t: Date.now(), dur }, ...s.pending], popover: null, view: 'create', lightbox: null, submitting: true }));
    this.submitGen(tempId, p);
    return true;
  }
  async submitGen(tempId: string, p: AnyState) {
    try {
      // Refs are already real by now (genBlock() blocks Generate while any are still uploading) —
      // just an uploadId (library/composer-attached files) or a bare local url (an existing Assets
      // output reused as a reference, from addRef()). The server resolves either to bytes and
      // relays them through Higgsfield itself; no file bytes need to cross this request at all.
      const jsonRefs = (p.refs || []).map((x: any) => (x.uploadId ? { uploadId: x.uploadId, kind: x.kind, tag: x.tag } : { url: x.url, kind: x.kind, name: x.name, tag: x.tag }));
      const { refs, ...meta } = p;
      const r = await fetch('/api/generations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...meta, refs: jsonRefs }) });
      const d = await r.json();
      if (!r.ok) {
        this.setState((s: AnyState) => ({ pending: s.pending.filter((x: any) => x.id !== tempId), submitting: false }));
        if (r.status === 429) { this.startRate(Number(r.headers.get('Retry-After')) || 15); this.setState({ prompt: p.prompt }); this.toastMsg(d.error?.title || 'Rate limited', 'error'); return; }
        this.setState((s: AnyState) => ({ failed: [{ id: tempId, ...p, t: Date.now(), err: d.error }, ...s.failed] }));
        this.toastMsg(d.error?.title || 'A generation failed', 'error');
        return;
      }
      const realId = d.id;
      this.setState((s: AnyState) => ({ pending: s.pending.map((x: any) => (x.id === tempId ? { ...x, id: realId } : x)), submitting: false }));
      this.pollGen(realId, p);
    } catch {
      this.setState((s: AnyState) => ({ pending: s.pending.filter((x: any) => x.id !== tempId), submitting: false }));
      this.toastMsg("Couldn't reach the server.", 'error');
    }
  }
  pollGen(id: string, p: AnyState) {
    this._gt = this._gt || {};
    const tick = async () => {
      let d: AnyState;
      try { d = await fetch(`/api/generations/${id}`).then((r) => r.json()); }
      catch { this._gt![id] = setTimeout(tick, 3000); return; }
      if (d.status === 'pending') { this._gt![id] = setTimeout(tick, 3000); return; }
      delete this._gt![id];
      this.setState((s: AnyState) => ({ pending: s.pending.filter((x: any) => x.id !== id) }));
      if (d.status === 'completed') {
        const ids = d.items.map((it: AnyState) => it.id); ids.forEach((x: string, i: number) => { this._fresh[x] = { d: i * 90 }; }); setTimeout(() => { ids.forEach((x: string) => delete this._fresh[x]); this.forceUpdate(); }, 6000);
        this.setState((s: AnyState) => ({ gens: [...s.gens, { ...p, id, t: d.t, items: d.items }], session: [id, ...s.session], walkResult: s.walkResult || s.walkGen }));
        this.loadCounts();
      } else {
        this.setState((s: AnyState) => ({ failed: [{ ...p, id, t: Date.now(), err: d.error }, ...s.failed] }));
        this.toastMsg('A generation failed', 'error');
      }
    };
    tick();
  }
  cancelGen(id: string) {
    const p = this.state.pending.find((x: any) => x.id === id); if (!p) return;
    clearTimeout(this._gt?.[id]); if (this._gt) delete this._gt[id];
    this.setState((s: AnyState) => ({ pending: s.pending.filter((x: any) => x.id !== id) }));
    if (!id.startsWith('tmp')) fetch(`/api/generations/${id}`, { method: 'DELETE' }).catch(() => {});
    this.notify('Generation cancelled.', { kind: 'info' });
  }
  retryFailed(f: AnyState) {
    const { id, err, ...rest } = f; const p = { ...rest };
    if (this.runGen(p)) this.setState((s: AnyState) => ({ failed: s.failed.filter((x: any) => x.id !== id) }));
  }
  toggleFav(id: string) {
    let next = false;
    this.setState((s: AnyState) => ({
      gens: s.gens.map((g: any) => ({
        ...g,
        items: g.items.map((it: any) => { if (it.id !== id) return it; next = !it.fav; return { ...it, fav: next }; }),
      })),
    }), () => { this.persistFav([id], next); this.loadCounts(); });
  }
  reuse(g: AnyState) {
    this.setState((s: AnyState) => ({
      view: 'create', mode: g.type, prompt: g.prompt, negPrompt: g.negative || '', negOn: !!g.negative, lightbox: null, popover: null, selectMode: false, selected: [],
      model: { ...s.model, [g.type]: g.model }, ratio: { ...s.ratio, [g.type]: g.ratio },
      res: { ...s.res, [g.type]: g.res }, fmt: { ...s.fmt, [g.type]: g.fmt },
      duration: g.type === 'video' ? g.duration : s.duration, audio: g.type === 'video' ? g.audio : s.audio, batch: g.items.length,
    }), () => setTimeout(() => { const el = this.promptRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 30));
  }
  insertSample(p: string) {
    this.setState({ prompt: p, walkPrompt: true }, () => { const el = this.promptRef?.current; if (el) { el.focus(); el.setSelectionRange(p.length, p.length); } });
  }
  walkVals(samples: AnyState[], feedEmpty: boolean) {
    const s = this.state;
    const k1 = s.hasKey, k2 = s.walkPrompt || s.walkGen, k3 = s.walkResult;
    const done = [k1, k2, k3], active = done.indexOf(false), generating = s.walkGen && !s.walkResult;
    const defs: [string, string, string, () => void][] = [
      ['Connect your API key', 'Links Studio to your Higgsfield account so you can generate.', s.hasKey ? 'Fix key' : 'Connect key', () => this.setState({ modal: s.hasKey ? 'manage' : 'connect', keyInput: '', keyErr: '', replacing: false })],
      ['Try a sample prompt', 'Pick one below, or write your own.', 'Insert a sample', () => samples[0] && this.insertSample(samples[0].prompt)],
      ['Get your first result', 'Results show up here and in Assets.', s.prompt.trim() ? 'Generate' : '', this.generate],
    ];
    const steps = defs.map(([title, text, cta, onCta], i) => {
      const isActive = i === active, d = done[i];
      return {
        n: i + 1, title, text, done: d, notDone: !d,
        cta: isActive && !(i === 2 && generating) && !(i === 1 && !samples.length) ? cta : '', onCta,
        busy: i === 2 && generating ? 'Generating…' : '',
        bg: isActive ? 'var(--raised)' : 'transparent', border: isActive ? 'var(--border2)' : 'var(--border)',
        color: d ? 'var(--text2)' : isActive ? 'var(--text)' : 'var(--text2)',
        dotBg: d ? 'var(--accent)' : isActive ? 'var(--active)' : 'transparent', dotColor: d ? 'var(--on-accent)' : isActive ? 'var(--text)' : 'var(--text3)',
      };
    });
    const n = done.filter(Boolean).length, all = n === 3;
    const show = SHOW_WALKTHROUGH && !s.walkHidden;
    return {
      showWalkFull: show && feedEmpty, showWalkStrip: show && !feedEmpty, walkSteps: steps,
      walkNext: steps[active] || { title: '', cta: '', busy: '' }, walkDismissLabel: all ? 'Done' : 'Skip',
      walkTitle: all ? "You're set up" : 'Get started', walkCount: n + ' of 3', walkAllDone: all, walkNotDone: !all,
      dismissWalk: () => { try { localStorage.setItem('studio.walkthroughDone', '1'); } catch { /* ignore */ } this.setState({ walkHidden: true }); },
    };
  }

  // ── References / uploads (TODO(backend): blob URLs today, see TODO.md) ──
  addRef(url: string, name: string) {
    const s = this.state, m = s.mode;
    if (s.refs.list.filter((x: any) => x.mode === m && x.kind === 'image').length >= MAX_REFS) { this.toastMsg('Reference limit reached (10 images)', 'error'); return; }
    this.setState((st: AnyState) => ({ refs: { ...st.refs, list: [...st.refs.list, { id: Math.random().toString(36).slice(2), mode: m, kind: 'image', url, name }] } }));
    this.toastMsg('Added as reference');
  }
  blobUrl(f: File) { const u = URL.createObjectURL(f); this._blobs.add(u); return u; }
  sweepBlobs = () => {
    if (!this._blobs.size) return;
    const s = this.state, used = new Set<string>(), r = s.refs;
    [r.start, r.end, ...r.list].forEach((x: any) => x && used.add(x.url));
    s.gens.forEach((g: any) => (g.refs || []).forEach((x: any) => used.add(x.url)));
    (s.failed || []).forEach((g: any) => (g.refs || []).forEach((x: any) => used.add(x.url)));
    (s.uploads || []).forEach((u: any) => used.add(u.url));
    this._blobs.forEach((u) => { if (!used.has(u)) { URL.revokeObjectURL(u); this._blobs.delete(u); } });
  };
  // Local-preview-only blob url while the real upload is in flight (see realUpload/swapUpload below)
  // — revoked by sweepBlobs() once nothing references it anymore.
  uploadRec(f: File, now: number, i: number) {
    const kind = f.type.startsWith('video') ? 'video' : f.type.startsWith('audio') ? 'audio' : 'image';
    return { id: 'tmp' + now.toString(36) + i + Math.random().toString(36).slice(2, 5), kind, name: f.name, url: this.blobUrl(f), size: f.size, t: now, uploading: true, _file: f };
  }
  // POST /api/uploads with the real bytes; w/h/dur come from the client's own imgDims()/mediaMeta()
  // read of the (already-created) preview blob url — no image/video processing library needed
  // server-side just to re-derive them. Returns the real record, or null on failure.
  async realUpload(rec: AnyState): Promise<AnyState | null> {
    const meta = await mediaMeta(rec.url, rec.kind).catch(() => null);
    const fd = new FormData();
    fd.append('file', rec._file, rec.name);
    if (meta?.w) fd.append('w', String(meta.w));
    if (meta?.h) fd.append('h', String(meta.h));
    if (meta?.dur) fd.append('dur', String(meta.dur));
    try {
      const r = await fetch('/api/uploads', { method: 'POST', body: fd });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }
  // Swaps a temp (uploading) record for its real server record everywhere it might appear: the
  // Uploads library list, and any of refs.start/end/list that referenced it by tmpId. null `real`
  // means the upload failed — the temp record/ref is dropped instead.
  swapUpload(tempId: string, real: AnyState | null) {
    this.setState((st: AnyState) => {
      const fix = (x: any) => (x && x.tmpId === tempId ? (real ? { url: real.url, name: real.name, uploadId: real.id } : null) : x);
      return {
        uploads: real ? st.uploads.map((u: any) => (u.id === tempId ? real : u)) : st.uploads.filter((u: any) => u.id !== tempId),
        refs: {
          start: fix(st.refs.start), end: fix(st.refs.end),
          list: st.refs.list
            .map((x: any) => (x.tmpId === tempId ? (real ? { ...x, url: real.url, uploadId: real.id, uploading: false, tmpId: undefined } : null) : x))
            .filter(Boolean),
        },
      };
    }, () => { this.sweepBlobs(); if (!real) this.toastMsg('A reference failed to upload', 'error'); });
  }
  addFiles(files: File[], k?: string) {
    let skipped = 0;
    const s = this.state, m = s.mode, now = Date.now(), r = { ...s.refs, list: [...s.refs.list] }, recs: AnyState[] = [];
    if (k === 'start' || k === 'end') { const rec = this.uploadRec(files[0], now, 0); recs.push(rec); r[k] = { url: rec.url, name: rec.name, uploading: true, tmpId: rec.id }; }
    else files.forEach((f, i) => {
      const kind = k || (f.type.startsWith('video') ? 'video' : f.type.startsWith('audio') ? 'audio' : 'image');
      if (m === 'image' && kind !== 'image') { skipped++; return; }
      if (r.list.filter((x: any) => x.mode === m && x.kind === kind).length >= MAX_REFS) { skipped++; return; }
      const rec = this.uploadRec(f, now, i); recs.push(rec);
      r.list.push({ id: Math.random().toString(36).slice(2), mode: m, kind, url: rec.url, name: f.name, uploading: true, tmpId: rec.id });
    });
    this.setState((st: AnyState) => ({ refs: r, uploads: [...recs, ...st.uploads] }), () => {
      if (skipped) this.toastMsg(`Skipped ${skipped} file${skipped > 1 ? 's' : ''}: ${this.state.mode === 'image' ? 'up to 10 images' : 'up to 10 of each type'}`, 'error');
      recs.forEach((rec) => this.realUpload(rec).then((real) => this.swapUpload(rec.id, real)));
    });
  }
  pendingKind?: string;
  pick(kind: string) {
    this.pendingKind = kind;
    const el = this.fileRef.current; if (!el) return;
    el.accept = kind === 'library' ? 'image/*,video/*,audio/*' : kind === 'audio' ? 'audio/*' : kind === 'video' ? 'video/*' : 'image/*';
    el.multiple = !(kind === 'start' || kind === 'end');
    el.value = ''; el.click();
    this.setState({ popover: null });
  }
  onFiles = (e: React.ChangeEvent<HTMLInputElement>) => { const files = [...(e.target.files || [])]; if (!files.length) return; if (this.pendingKind === 'library') this.libraryUpload(files); else this.addFiles(files, this.pendingKind); };
  hasFiles(e: React.DragEvent) { return !this._dragItems && !this._dragProj && [...(e.dataTransfer?.types || [])].includes('Files'); }
  _dragItems: string[] | null = null;
  _dragProj: string | null = null;
  dragGhost(e: React.DragEvent, n: number) {
    if (n < 2) return;
    const d = document.createElement('div'); d.textContent = n + ' items';
    Object.assign(d.style, { position: 'fixed', top: '-200px', left: '0', padding: '6px 11px', borderRadius: '7px', background: 'var(--raised)', color: 'var(--text)', border: '1px solid var(--border2)', font: '500 12.5px Geist, sans-serif', whiteSpace: 'nowrap' });
    e.currentTarget.appendChild(d); e.dataTransfer.setDragImage(d, -8, -8); setTimeout(() => d.remove(), 0);
  }
  uploadFiles(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith('image/')), skipped = files.length - imgs.length;
    if (skipped) this.toastMsg(`Skipped ${skipped} file${skipped > 1 ? 's' : ''}: only images can be uploaded to Assets`, 'error');
    if (imgs.length) {
      (async () => {
        const now = Date.now(), s = this.state, pid = s.view === 'assets' && s.fProject !== 'all' ? s.fProject : null;
        const urls = imgs.map((f) => URL.createObjectURL(f)), dims = await Promise.all(urls.map((u) => imgDims(u)));
        const added = imgs.map((f, i) => { const id = 'u' + now + i, dm = dims[i]; return { id, project: pid, type: 'image', model: 'upload', prompt: f.name, ratio: dm ? ratioOf(dm[0], dm[1]) : '1:1', px: dm, res: 'Original', fmt: (f.name.split('.').pop() || '').toUpperCase(), duration: 5, audio: false, uploaded: true, t: now, items: [{ id: id + '-0', seed: id, url: urls[i], fav: false }] }; });
        const ids = new Set(added.map((g) => g.id));
        added.forEach((g) => { this._fresh[g.id + '-0'] = { d: 0 }; });
        setTimeout(() => { added.forEach((g) => delete this._fresh[g.id + '-0']); this.forceUpdate(); }, 6000);
        const recs = added.map((g, i) => ({ id: 'up' + g.id, kind: 'image', name: imgs[i].name, url: urls[i], size: imgs[i].size, w: dims[i] ? dims[i]![0] : null, h: dims[i] ? dims[i]![1] : null, t: now, assetId: g.id }));
        this.setState((st: AnyState) => ({ gens: [...st.gens, ...added], uploads: [...recs, ...st.uploads] }));
        const n = imgs.length;
        this.notify(`Uploaded ${n} image${n > 1 ? 's' : ''} to Assets${pid ? ' · ' + this.projName(pid) : ''}`, { undo: () => this.setState((st: AnyState) => ({ gens: st.gens.filter((g: any) => !ids.has(g.id)), uploads: st.uploads.filter((u: any) => !ids.has(u.assetId)) })) });
      })();
    }
  }
  libraryUpload(files: File[]) {
    const ok = files.filter((f) => /^(image|video|audio)\//.test(f.type)), skipped = files.length - ok.length;
    if (skipped) this.toastMsg(`Skipped ${skipped} file${skipped > 1 ? 's' : ''}: only images, videos and audio`, 'error');
    if (!ok.length) return;
    const now = Date.now(), recs = ok.map((f, i) => this.uploadRec(f, now, i)), ids = new Set(recs.map((r) => r.id));
    this.setState((st: AnyState) => ({ uploads: [...recs, ...st.uploads], upType: 'all', upUse: 'all', upQ: '', upSort: 'new' }), () => {
      recs.forEach((rec) => this.realUpload(rec).then((real) => this.swapUpload(rec.id, real)));
    });
    const n = recs.length;
    // ponytail: undo here only removes local state — if a file already finished uploading by the
    // time undo is clicked, its real row/file stays on the server (same as any other orphaned-but-
    // harmless unused upload; the existing "select unused" cleanup catches it). TODO.md's undo ask
    // was specifically about DELETE (see deleteUploads), not this.
    this.notify(`Uploading ${n} file${n > 1 ? 's' : ''} · ${this.fmtSize(recs.reduce((a, r) => a + r.size, 0))}`, { undo: () => this.setState((st: AnyState) => ({ uploads: st.uploads.filter((u: any) => !ids.has(u.id)) })) });
  }
  useUploads(ids: string[]) {
    const s = this.state, ups = s.uploads.filter((u: any) => ids.includes(u.id) && u.url);
    if (!ups.length) return;
    const m = ups.some((u: any) => u.kind !== 'image') ? 'video' : s.mode, list = [...s.refs.list];
    let added = 0, skipped = 0;
    ups.forEach((u: any) => {
      if (list.some((x: any) => x.mode === m && x.url === u.url)) return;
      if (list.filter((x: any) => x.mode === m && x.kind === u.kind).length >= MAX_REFS) { skipped++; return; }
      list.push({ id: Math.random().toString(36).slice(2), mode: m, kind: u.kind, url: u.url, name: u.name, uploadId: u.id }); added++;
    });
    this.setState({ refs: { ...s.refs, list }, mode: m, view: 'create', projectId: null, upSelect: false, upSel: [], upPv: null, popover: null });
    if (added) this.notify(`Added ${added} reference${added > 1 ? 's' : ''}${skipped ? ` · skipped ${skipped} (10 of each type max)` : ''}`);
    else this.toastMsg(skipped ? 'Reference limit reached (10 of each type)' : 'Already attached in the composer', skipped ? 'error' : 'info');
  }
  deleteUploads(ids: string[]) {
    const s = this.state, del = new Set(ids), ups = s.uploads.filter((u: any) => del.has(u.id)); if (!ups.length) return;
    const urls = new Set(ups.map((u: any) => u.url).filter(Boolean)), aids = new Set(ups.map((u: any) => u.assetId).filter(Boolean));
    const sn = this.snap({ uploads: s.uploads, refs: s.refs }), keep = (x: any) => (x && !urls.has(x.url) ? x : null);
    let pv = s.upPv;
    if (pv && del.has(pv)) { const all = this._upIds || [], l = all.filter((id) => !del.has(id)); pv = l[Math.min(Math.max(all.indexOf(pv), 0), l.length - 1)] || null; }
    this.setState((st: AnyState) => ({ uploads: st.uploads.filter((u: any) => !del.has(u.id)), upSel: [], upSelect: false, upPv: pv, popover: null,
      refs: { start: keep(st.refs.start), end: keep(st.refs.end), list: st.refs.list.filter((x: any) => !urls.has(x.url)) },
      gens: aids.size ? st.gens.filter((g: any) => !aids.has(g.id)) : st.gens, session: st.session.filter((id: string) => !aids.has(id)) }));
    clearTimeout(this._sweepT); this._sweepT = setTimeout(this.sweepBlobs, 10000);
    // Real delete waits out the undo window instead of happening immediately (TODO.md's second
    // option) — clicking undo within ~10s just restores local state and never touches the server.
    const delIds = [...del];
    const delTimer = setTimeout(() => {
      fetch('/api/uploads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: delIds }) })
        .then(() => this.loadCounts()).catch(() => {});
    }, 10000);
    const n = ups.length;
    this.notify(`Deleted ${n} upload${n > 1 ? 's' : ''} · ${this.fmtSize(ups.reduce((a: number, u: any) => a + (u.size || 0), 0))} freed`, { kind: 'delete', undo: () => { clearTimeout(delTimer); this.restore(sn); } });
  }
  upStep(d: number) { const l = this._upIds || [], i = l.indexOf(this.state.upPv), n = l[i + d]; if (i >= 0 && n) this.setState({ upPv: n }); }
  upZip(ids: string[]) { this.zipUrls(this.state.uploads.filter((u: any) => ids.includes(u.id) && u.url).map((u: any) => ({ url: u.url, name: u.name })), 'studio-uploads'); }
  fmtSize(b: number) { if (!b) return '—'; if (b < 1e6) return Math.max(1, Math.round(b / 1e3)) + ' KB'; if (b < 1e9) return (b < 1e7 ? (b / 1e6).toFixed(1) : Math.round(b / 1e6)) + ' MB'; return (b / 1e9).toFixed(2) + ' GB'; }

  // ── Projects / delete / bulk actions ────────────────────────────────────
  reorderProject(from: string, to: string, pos: string) {
    if (from === to) return;
    this.setState((s: AnyState) => {
      const list = s.projects.filter((p: any) => p.id !== from), moved = s.projects.find((p: any) => p.id === from), i = list.findIndex((p: any) => p.id === to);
      if (!moved || i < 0) return null; list.splice(pos === 'after' ? i + 1 : i, 0, moved); return { projects: list };
    }, () => this.persistProjects(this.state.projects));
  }
  saveProject() {
    const s = this.state, n = s.newName.trim(); if (!n) return;
    const emoji = s.newEmoji || null;
    if (s.renameId) {
      this.setState((st: AnyState) => ({ projects: st.projects.map((p: any) => (p.id === st.renameId ? { ...p, name: n, emoji } : p)), modal: null, renameId: null, newName: '' }), () => this.persistProjects(this.state.projects));
      this.notify('Project saved'); return;
    }
    const id = 'p' + Date.now();
    this.setState((st: AnyState) => ({ projects: [...st.projects, { id, name: n, emoji }], modal: null, newName: '', view: 'create', projectId: id, projectsOpen: true }), () => this.persistProjects(this.state.projects));
    this.notify(`Created "${n}"`);
  }
  deleteProject(withAssets: boolean) {
    const c = this.state.confirm; if (!c) return;
    const pid = c.id, name = this.projName(pid), sn = this.snap({ projectId: this.state.projectId, fProject: this.state.fProject });
    this.setState((s: AnyState) => {
      let gens;
      if (withAssets) gens = s.gens.map((g: any) => ({ ...g, items: g.items.filter((it: any) => this.projOf(g, it) !== pid) })).filter((g: any) => g.items.length);
      else gens = s.gens.map((g: any) => ({ ...g, project: g.project === pid ? null : g.project, items: g.items.map((it: any) => (it.project === pid ? { ...it, project: null } : it)) }));
      const alive = new Set(gens.map((g: any) => g.id));
      return { projects: s.projects.filter((p: any) => p.id !== pid), gens, session: s.session.filter((id: string) => alive.has(id)), confirm: null,
        projectId: s.projectId === pid ? null : s.projectId, fProject: s.fProject === pid ? 'all' : s.fProject };
    }, () => this.persistProjects(this.state.projects));
    this.notify(withAssets ? `Deleted "${name}" and its assets` : `Deleted "${name}"`, { kind: 'delete', undo: () => this.restore(sn) });
  }
  moveTo(itemId: string, pid: string | null) {
    const sn = this.snap();
    this.setState((s: AnyState) => ({ gens: s.gens.map((g: any) => ({ ...g, items: g.items.map((it: any) => (it.id === itemId ? { ...it, project: pid } : it)) })) }));
    this.notify(pid ? `Moved to ${this.projName(pid)}` : 'Removed from project', { undo: () => this.restore(sn) });
  }
  askDelete(ids: string[], fromSelect?: boolean) { if (ids.length) this.doDelete({ ids, fromSelect: !!fromSelect }); }
  doDelete(c: AnyState = this.state.confirm) {
    if (!c) return;
    const del = new Set(c.ids), n = c.ids.length, sn = this.snap();
    this.setState((s: AnyState) => {
      let lightbox = s.lightbox;
      if (lightbox && del.has(lightbox)) {
        const old = this._lists[s.lbSource] || [], i = old.indexOf(lightbox), list = old.filter((x) => !del.has(x));
        lightbox = list[Math.min(Math.max(i, 0), list.length - 1)] || null;
      }
      const gens = s.gens.map((g: any) => ({ ...g, items: g.items.filter((it: any) => !del.has(it.id)) })).filter((g: any) => g.items.length);
      const alive = new Set(gens.map((g: any) => g.id));
      return { gens, session: s.session.filter((id: string) => alive.has(id)), selected: [], selectMode: c.fromSelect ? false : s.selectMode, confirm: null, popover: null, lightbox, hoverId: null };
    });
    this.notify(n > 1 ? `${n} assets deleted` : 'Asset deleted', { kind: 'delete', undo: () => this.restore(sn) });
  }
  bulkItems(ids: string[]) { const set = new Set(ids), out: AnyState[] = []; this.state.gens.forEach((g: any) => g.items.forEach((it: any) => { if (set.has(it.id)) out.push({ it, g }); })); return out; }
  bulkFav(ids: string[], on: boolean) {
    const set = new Set(ids), n = ids.length, sn = this.snap();
    this.setState((s: AnyState) => ({ gens: s.gens.map((g: any) => ({ ...g, items: g.items.map((it: any) => (set.has(it.id) ? { ...it, fav: on } : it)) })), selected: s.view === 'favorites' && !on ? [] : s.selected }), () => { this.persistFav(ids, on); this.loadCounts(); });
    this.notify(`${n} ${n > 1 ? 'items' : 'item'} ${on ? 'added to' : 'removed from'} Favorites`, { undo: () => { this.restore(sn); this.persistFav(ids, !on); this.loadCounts(); } });
  }
  bulkMove(ids: string[], pid: string | null) {
    const set = new Set(ids), n = ids.length, sn = this.snap();
    this.setState((s: AnyState) => ({ popover: null, gens: s.gens.map((g: any) => ({ ...g, items: g.items.map((it: any) => (set.has(it.id) ? { ...it, project: pid } : it)) })) }));
    this.notify(pid ? `Moved ${n} to ${this.projName(pid)}` : `Removed ${n} from projects`, { undo: () => this.restore(sn) });
  }
  bulkCopy(sel: AnyState[]) {
    const ps = [...new Set(sel.filter((x) => !x.g.uploaded).map((x) => x.g.prompt))];
    if (!ps.length) { this.toastMsg('Uploads have no prompt to copy', 'error'); return; }
    this.copy(ps.join('\n\n'), 'bulk');
    this.notify(`Copied ${ps.length} prompt${ps.length > 1 ? 's' : ''}`);
  }
  rerunPlan(sel: AnyState[]) {
    const by = new Map<string, AnyState>(); sel.forEach(({ g }) => { if (!g.uploaded) by.set(g.id, { g, n: (by.get(g.id)?.n || 0) + 1 }); });
    const runs = [...by.values()].map(({ g, n }) => ({ ...this.fields(g), batch: Math.min(4, n), project: g.project, refs: g.refs || [] }));
    return { runs };
  }
  bulkRerun(sel: AnyState[]) {
    const { runs } = this.rerunPlan(sel), s = this.state;
    if (!runs.length) { this.toastMsg("Uploads can't be rerun", 'error'); return; }
    if (this.offline() || this.rateLeft() || !s.hasKey) { this.runGen(runs[0]); return; }
    runs.forEach((r) => this.runGen(r));
    this.setState({ selectMode: false, selected: [] });
    const n = runs.length, skipped = sel.filter((x) => x.g.uploaded).length;
    this.notify(`Rerunning ${n} generation${n > 1 ? 's' : ''}${skipped ? ` · skipped ${skipped} upload${skipped > 1 ? 's' : ''}` : ''}`, { kind: 'info' });
  }
  zipDownload(ids: string[]) { return this.zipUrls(this.bulkItems(ids).map(({ it, g }, i) => ({ url: it.url, base: `${String(i + 1).padStart(3, '0')}-${g.model}-${it.id}` })), 'studio-assets'); }
  async zipUrls(list: AnyState[], prefix: string) {
    if (this.state.zipping || !list.length) return;
    const n = list.length, enc = new TextEncoder(), files: { name: Uint8Array; data: Uint8Array }[] = [];
    this.setState({ zipping: true });
    const tid = this.notify(`Downloading 0 of ${n}…`, { kind: 'info', duration: 120000 });
    const setMsg = (msg: string) => this.setState((s: AnyState) => ({ toasts: s.toasts.map((x: any) => (x.id === tid ? { ...x, msg } : x)) }));
    try {
      let next = 0, done = 0;
      const worker = async () => {
        while (next < n) {
          const i = next++, en = list[i], r = await fetch(en.url);
          if (!r.ok) throw new Error(String(r.status));
          const ext = (r.headers.get('content-type') || 'image/jpeg').split('/')[1].split(';')[0].replace('jpeg', 'jpg');
          files[i] = { name: enc.encode(en.name || `${en.base}.${ext}`), data: new Uint8Array(await r.arrayBuffer()) };
          setMsg(`Downloading ${++done} of ${n}…`);
        }
      };
      await Promise.all(Array.from({ length: Math.min(5, n) }, worker));
      setMsg(`Zipping ${n} file${n > 1 ? 's' : ''}…`);
      const a = document.createElement('a'); a.href = URL.createObjectURL(zip(files)); a.download = `${prefix}-${n}.zip`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      this.dismiss(tid); this.notify(`Downloaded ${n} file${n > 1 ? 's' : ''} as ${prefix}-${n}.zip`);
    } catch {
      this.dismiss(tid); this.toastMsg("Couldn't build the zip. Check your connection and try again.", 'error');
    }
    this.setState({ zipping: false });
  }

  // ── Data layer ───────────────────────────────────────────────────────────
  // Every call the UI makes to "the server" goes through `api`. TODO(backend):
  // replace each body with a fetch to the local server (see TODO.md). The one
  // exception already wired to a real endpoint is the API key (see loadKey/
  // submitKey/removeKey above, backed by server/src/routes/key.ts).
  api = {
    listModels: async () => {
      const r = await fetch('/api/models');
      if (!r.ok) throw new Error('listModels failed');
      return r.json();
    },
    listAssets: async (p: AnyState) => {
      const qs = new URLSearchParams({ view: p.view, fType: p.fType, fModel: p.fModel, fProject: p.fProject, fFav: p.fFav, fRatio: p.fRatio, sort: p.sort, q: p.q || '', limit: String(p.limit) });
      if (p.cursor) qs.set('cursor', p.cursor);
      const r = await fetch(`/api/assets?${qs}`);
      if (!r.ok) throw new Error('listAssets failed');
      return r.json();
    },
    listAssetIds: async (p: AnyState) => {
      const qs = new URLSearchParams({ view: p.view, fType: p.fType, fModel: p.fModel, fProject: p.fProject, fFav: p.fFav, fRatio: p.fRatio, sort: p.sort, q: p.q || '' });
      const r = await fetch(`/api/assets/ids?${qs}`);
      if (!r.ok) throw new Error('listAssetIds failed');
      return r.json();
    },
  };
  loadCatalog() {
    this.api.listModels().then((c) => this.setState((s: AnyState) => {
      const fix = (t: string) => ((c as any)[t] || []).some((m: any) => m.id === s.model[t]) ? s.model[t] : ((c as any)[t] && (c as any)[t][0] ? (c as any)[t][0].id : s.model[t]);
      return { catalog: c, catalogErr: false, model: { image: fix('image'), video: fix('video') } };
    })).catch(() => this.setState({ catalogErr: true }));
  }
  findModel(type: string, id: string): AnyState | null { const c = this.state.catalog; return c ? (c[type] || []).find((m: any) => m.id === id) : null; }
  gridParams(s: AnyState = this.state) { return { view: s.view, fType: s.fType, fModel: s.fModel, fProject: s.fProject, fFav: s.fFav, fRatio: s.fRatio, sort: s.sort, q: s.qd }; }
  assetMatch({ it, g }: AnyState, p: AnyState, qt: string[]) {
    if (p.view === 'favorites') return !!it.fav;
    return (p.fType === 'all' || g.type === p.fType) && (p.fModel === 'all' || g.model === p.fModel) && (p.fProject === 'all' || this.projOf(g, it) === p.fProject)
      && (p.fFav === 'all' || (p.fFav === 'fav' ? it.fav : !it.fav)) && (p.fRatio === 'all' || g.ratio === p.fRatio)
      && (!qt.length || qt.every((w) => (g.prompt || '').toLowerCase().includes(w)));
  }
  gridKey(s: AnyState) { return s.view === 'assets' || s.view === 'favorites' ? JSON.stringify(this.gridParams(s)) : ''; }
  resetGrid() {
    const el = this.gridRef.current; if (el) el.scrollTop = 0;
    this._gTok = (this._gTok || 0) + 1;
    this.setState({ gridIds: [], gridCursor: null, gridTotal: 0, gridDone: false, gridBoot: true, gridLoading: false }, () => this.fetchPage());
  }
  async fetchPage(refresh?: boolean) {
    const s = this.state; if (!refresh && (s.gridLoading || s.gridDone)) return;
    const tok = this._gTok;
    if (!refresh) this.setState({ gridLoading: true });
    try {
      const r = await this.api.listAssets({ ...this.gridParams(), cursor: refresh ? null : s.gridCursor, limit: refresh ? Math.max(PAGE, s.gridIds.length) : PAGE });
      if (tok !== this._gTok) return;
      this.setState((st: AnyState) => ({ gridIds: refresh ? r.ids : [...st.gridIds, ...r.ids], gridCursor: r.nextCursor, gridDone: !r.nextCursor, gridTotal: r.total, gridBoot: false, gridLoading: false }), () => requestAnimationFrame(() => this.maybeLoadMore()));
    } catch {
      if (tok !== this._gTok) return;
      this.setState({ gridBoot: false, gridLoading: false });
      this.toastMsg("Couldn't load assets. Scroll to try again.", 'error');
    }
  }
  maybeLoadMore() {
    const el = this.gridRef.current, s = this.state;
    if (!el || s.gridBoot || s.gridLoading || s.gridDone) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 600) return;
    this.fetchPage();
  }
  setQ(v: string, now?: boolean) { clearTimeout(this._qt); this.setState(now ? { q: v, qd: v } : { q: v }); if (!now) this._qt = setTimeout(() => this.setState((st: AnyState) => ({ qd: st.q })), 250); }

  // ── Misc helpers ─────────────────────────────────────────────────────────
  modelName(id: string) { if (id === 'upload') return 'Uploaded'; const c = this.state.catalog, m = c && [...(c.image || []), ...(c.video || [])].find((x: any) => x.id === id); return m ? m.name : id; }
  projName(id: string | null) { return (this.state.projects.find((p: any) => p.id === id) || {}).name || ''; }
  projOf(g: AnyState, it: AnyState) { return it && it.project !== undefined ? it.project : g.project; }
  ago(t: number) {
    const m = Math.max(1, Math.round((Date.now() - t) / 60000));
    if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
    return Math.round(h / 24) + 'd ago';
  }
  meta(g: AnyState, n: number) {
    const v = g.type === 'video';
    return [g.variation ? 'Variations' : null, this.modelName(g.model), g.ratio, v ? g.duration + 's' : null, g.res, v ? (g.audio ? 'Audio' : 'No audio') : null, g.fmt, n + '×'].filter(Boolean).map((x) => String(x).replace(/ /g, ' ')).join(' · ');
  }
  fields(g: AnyState) { return { type: g.type, model: g.model, prompt: g.prompt, negative: g.negative || '', ratio: g.ratio, res: g.res, fmt: g.fmt, duration: g.duration, audio: g.audio }; }
  seedNum(str: string) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  pxSize(g: AnyState) {
    if (g.px) return g.px;
    const [a, b] = g.ratio.split(':').map(Number), r8 = (n: number) => Math.round(n / 8) * 8;
    if (g.type === 'video') { const sh = parseInt(g.res) || 720; return a >= b ? [r8(sh * a / b), sh] : [sh, r8(sh * b / a)]; }
    const L = ({ '1K': 1024, '2K': 2048, '4K': 4096 } as any)[g.res] || 2048; return a >= b ? [L, r8(L * b / a)] : [r8(L * a / b), L];
  }

  // ── Lightbox ─────────────────────────────────────────────────────────────
  lbZ() { const z = this.state.lbZ; return z && z.id === this.state.lightbox ? z : { s: 1, x: 0, y: 0, anim: true }; }
  lbMetrics() {
    const el = this._lbBox, img = el && (el.querySelector('img') as HTMLImageElement | null);
    if (!img || !img.naturalWidth || !el.clientWidth) return null;
    const cw = el.clientWidth, ch = el.clientHeight, fit = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    return { cw, ch, fit, one: 1 / fit, w: img.naturalWidth * fit, h: img.naturalHeight * fit };
  }
  lbClamp(s: number, x: number, y: number, m: AnyState) {
    const mx = Math.max(0, (m.w * s - m.cw) / 2), my = Math.max(0, (m.h * s - m.ch) / 2);
    return [Math.max(-mx, Math.min(mx, x)), Math.max(-my, Math.min(my, y))];
  }
  lbZoomTo(s: number, cx: number, cy: number, anim: boolean) {
    const m = this.lbMetrics(); if (!m) return;
    const cur = this.lbZ();
    s = Math.max(Math.min(1, m.one), Math.min(Math.max(8, m.one * 2), s));
    if (Math.abs(s - 1) < 0.02) s = 1;
    const [x, y] = this.lbClamp(s, cx - (s / cur.s) * (cx - cur.x), cy - (s / cur.s) * (cy - cur.y), m);
    this.setState({ lbZ: { id: this.state.lightbox, s, x, y, anim } });
  }
  onLbWheel = (e: WheelEvent) => {
    e.preventDefault();
    const el = this._lbBox; if (!el) return;
    const r = el.getBoundingClientRect(), z = this.lbZ();
    this.lbZoomTo(z.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2, false);
  };
  lbStageRef = (el: HTMLDivElement | null) => {
    if (this._lbStage) this._lbStage.removeEventListener('wheel', this.onLbWheel as any);
    this._lbStage = el;
    if (el) el.addEventListener('wheel', this.onLbWheel as any, { passive: false });
  };
  lbBoxRef = (el: HTMLDivElement | null) => { this._lbBox = el; };
  lbDown = (e: React.MouseEvent) => {
    this._moved = false;
    const z = this.lbZ(), m = this.lbMetrics();
    if (e.button !== 0 || z.s <= 1 || !m) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, ox = z.x, oy = z.y;
    this.setState({ lbDrag: true });
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) this._moved = true;
      const [x, y] = this.lbClamp(z.s, ox + dx, oy + dy, m);
      this.setState({ lbZ: { id: this.state.lightbox, s: z.s, x, y, anim: false } });
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); this.setState({ lbDrag: false }); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  lbStageClick = () => {
    if (this._moved) { this._moved = false; return; }
    if (this.lbZ().s !== 1) return;
    this.setState({ lightbox: null });
  };
  lbStep(d: number) {
    const s = this.state, list = this._lists[s.lbSource] || [], n = list[list.indexOf(s.lightbox) + d];
    if (n) { this.setState({ lightbox: n }); return; }
    // Assets/Favorites only keep whatever's been scrolled into view (gridIds) — stepping past the
    // end of that means more exist on the server (gridDone false), not that this is the last item.
    if (d > 0 && (s.lbSource === 'assets' || s.lbSource === 'favorites') && !s.gridDone && !s.gridLoading) {
      this.fetchPage().then(() => this.lbStep(d));
    }
  }
  itemMenu(it: AnyState, g: AnyState, src: string): AnyState[] {
    const s = this.state, close = (fn: () => void) => () => { this.setState({ popover: null }); fn(); };
    const b = (label: string, fn: () => void, x: AnyState = {}) => ({ btn: true, sep: false, head: false, check: false, arrow: false, label, onClick: fn, ...x });
    const sep = { sep: true, btn: false, head: false };
    if (s.menuPage === 'move') {
      const cur = this.projOf(g, it) || null;
      return [b('Back', () => this.setState({ menuPage: 'main' })), sep, { head: true, sep: false, btn: false, label: 'Move to project' },
        ...[{ id: null, name: 'No project' }, ...s.projects].map((p: any) => b(p.name, close(() => this.moveTo(it.id, p.id)), { check: cur === p.id }))];
    }
    const url = it.url;
    return [
      b('Regenerate', close(() => this.runGen({ ...this.fields(g), batch: g.items.length, project: g.project }))),
      b('Edit prompt & retry', close(() => this.reuse(g))),
      b('Variations', close(() => this.runGen({ ...this.fields(g), batch: Math.max(2, g.items.length), project: this.projOf(g, it), variation: true }))),
      sep,
      b('Use as reference', close(() => this.addRef(url, 'Reference'))),
      b('Copy prompt', close(() => { try { navigator.clipboard.writeText(g.prompt).catch(() => {}); } catch { /* ignore */ } this.toastMsg('Prompt copied'); })),
      b('Download', close(() => window.open(url, '_blank'))),
      b('Move to project', () => this.setState({ menuPage: 'move' }), { arrow: true }),
      sep,
      src !== 'assets' ? b('Open in Assets', close(() => this.setState({ view: 'assets', fType: 'all', fModel: 'all', fProject: 'all', lightbox: it.id, lbSource: 'assets' }))) : null,
      b('Open fullscreen', close(() => this.setState({ lightbox: it.id, lbSource: src }))),
    ].filter(Boolean) as AnyState[];
  }

  // ── Uploads view derived state ──────────────────────────────────────────
  upVals(menu: any, set: any, seg: any) {
    const s = this.state;
    if (s.view !== 'uploads') return { notSelecting: true, selecting: false, tiles: [], menus: [], typeOpts: [], clean: [], pv: null, empty: false };
    const use = this.memo('upUse', [s.gens, s.refs], () => {
      const m = new Map<string, AnyState>(), get = (u: string) => { if (!m.has(u)) m.set(u, { gens: [], composer: false }); return m.get(u)!; };
      s.gens.forEach((g: any) => (g.refs || []).forEach((r: any) => r.url && get(r.url).gens.push(g)));
      const r = s.refs; [r.start, r.end, ...r.list].forEach((x: any) => { if (x && x.url) get(x.url).composer = true; });
      return m;
    });
    const info = (u: AnyState) => { const x = (u.url && use.get(u.url)) || { gens: [], composer: false }, gens = [...new Set(x.gens)], asset = !!u.assetId && s.gens.some((g: any) => g.id === u.assetId);
      return { gens, composer: x.composer, asset, used: gens.length > 0 || x.composer || asset }; };
    const all = s.uploads.map((u: any) => ({ u, i: info(u) })), qt = terms(s.upQ), now = Date.now();
    const list = all.filter(({ u, i }: any) => (s.upType === 'all' || u.kind === s.upType) && (s.upUse === 'all' || (s.upUse === 'used') === i.used) && (!qt.length || qt.every((w) => u.name.toLowerCase().includes(w))));
    const cmp: any = { new: (a: any, b: any) => b.u.t - a.u.t, old: (a: any, b: any) => a.u.t - b.u.t, large: (a: any, b: any) => (b.u.size || 0) - (a.u.size || 0), name: (a: any, b: any) => a.u.name.localeCompare(b.u.name) };
    list.sort(cmp[s.upSort] || cmp.new);
    const ids = list.map((x: any) => x.u.id); this._upIds = ids;
    const selSet = new Set(s.upSel), allSel = ids.length > 0 && ids.every((id: string) => selSet.has(id)), bytes = (arr: any[]) => arr.reduce((a, x) => a + ((x.u || x).size || 0), 0);
    const selUps = s.uploads.filter((u: any) => selSet.has(u.id)), hasSel = selUps.length > 0;
    const unused = all.filter((x: any) => !x.i.used), old = all.filter((x: any) => now - x.u.t > 30 * 86400000), big = all.filter((x: any) => (x.u.size || 0) > 25e6);
    // Duplicate = same content hash. Keep the newest copy of each group, select the rest.
    const byHash = new Map<string, AnyState[]>();
    all.forEach((x: any) => { if (x.u.hash) { if (!byHash.has(x.u.hash)) byHash.set(x.u.hash, []); byHash.get(x.u.hash)!.push(x); } });
    const dupes = [...byHash.values()].filter((g) => g.length > 1).flatMap((g) => g.sort((a, b) => b.u.t - a.u.t).slice(1));
    const pick = (arr: any[]) => () => this.setState({ upSelect: true, upSel: arr.map((x) => x.u.id), popover: null, upType: 'all', upUse: 'all', upQ: '' });
    const label = (x: any) => (x.i.gens.length ? `Used in ${x.i.gens.length}` : x.i.composer ? 'In composer' : x.i.asset ? 'In Assets' : 'Unused');
    const tiles = list.map((x: any) => {
      const { u } = x, on = selSet.has(u.id), sel = s.upSelect;
      return { id: u.id, name: u.name, src: u.url || '', isImage: u.kind === 'image', isVideo: u.kind === 'video', isAudio: u.kind === 'audio', badge: u.kind !== 'image',
        videoSrc: u.kind === 'video' && u.url ? u.url + '#t=0.1' : '', hasVideoSrc: u.kind === 'video' && !!u.url, dur: u.dur ? this.clock(u.dur * 1000) : (u.kind === 'video' ? 'Video' : 'Audio'),
        size: this.fmtSize(u.size), useLabel: label(x), useColor: x.i.used ? 'var(--text2)' : 'var(--text3)',
        selectable: sel, selected: on, outline: on ? '2px solid var(--accent-fg)' : 'none', imgOp: sel && !on ? 0.8 : 1,
        checkBg: on ? 'var(--accent)' : 'rgba(0,0,0,.3)', checkBorder: on ? 'var(--accent)' : 'rgba(255,255,255,.9)', cursor: sel ? 'pointer' : 'zoom-in', showRow: !sel && s.upHover === u.id,
        onOpen: (e: any) => {
          if (!sel) { this.setState({ upPv: u.id }); return; }
          const a = ids.indexOf(this._upLast), b = ids.indexOf(u.id);
          if (e && e.shiftKey && a >= 0 && b >= 0) { const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1); this.setState((st: AnyState) => ({ upSel: [...new Set([...st.upSel, ...range])] })); }
          else this.setState((st: AnyState) => ({ upSel: st.upSel.includes(u.id) ? st.upSel.filter((y: string) => y !== u.id) : [...st.upSel, u.id] }));
          this._upLast = u.id;
        },
        onEnter: () => this.setState({ upHover: u.id }), onLeave: () => this.setState({ upHover: null }),
        onUse: (e: any) => { e.stopPropagation(); this.useUploads([u.id]); }, onDelete: (e: any) => { e.stopPropagation(); this.deleteUploads([u.id]); },
      };
    });
    const pu = s.upPv && s.uploads.find((u: any) => u.id === s.upPv);
    let pv: AnyState | null = null;
    if (pu) {
      const gens = info(pu).gens, inf = info(pu), k = ids.indexOf(pu.id);
      pv = { name: pu.name, src: pu.url || '', url: pu.url || '', isImage: pu.kind === 'image', hasVideoSrc: pu.kind === 'video' && !!pu.url, isAudio: pu.kind === 'audio', hasAudioSrc: pu.kind === 'audio' && !!pu.url,
        rows: ([['Type', ({ image: 'Image', video: 'Video', audio: 'Audio' } as any)[pu.kind]], ['Size', this.fmtSize(pu.size)], pu.w ? ['Dimensions', pu.w + ' × ' + pu.h] : null, pu.dur ? ['Duration', this.clock(pu.dur * 1000)] : null, ['Uploaded', this.ago(pu.t)]].filter(Boolean) as [string, string][]).map(([a, b]) => ({ k: a, v: b })),
        usedHead: gens.length ? `Used in ${gens.length} generation${gens.length > 1 ? 's' : ''}` : 'Usage',
        used: gens.slice(0, 4).map((g: any) => ({ prompt: g.prompt, meta: this.modelName(g.model) + ' · ' + this.ago(g.t), onClick: () => g.items[0] && this.setState({ upPv: null, lightbox: g.items[0].id, lbSource: 'feed' }) })),
        usedMore: gens.length > 4 ? `+ ${gens.length - 4} more` : '',
        notUsed: gens.length ? '' : inf.composer ? 'Attached in the composer. Not generated with yet.' : inf.asset ? 'Saved in Assets. Not used as a reference yet.' : 'Not used in any generation yet.',
        pos: ids.length > 1 && k >= 0 ? `${k + 1} / ${ids.length}` : '', hasPrev: k > 0, hasNext: k >= 0 && k < ids.length - 1,
        onPrev: (e: any) => { e.stopPropagation(); this.upStep(-1); }, onNext: (e: any) => { e.stopPropagation(); this.upStep(1); },
        close: set({ upPv: null }), onUse: () => this.useUploads([pu.id]), onDownload: () => pu.url && window.open(pu.url, '_blank'), onDelete: () => this.deleteUploads([pu.id]) };
    }
    const filtered = !!qt.length || s.upType !== 'all' || s.upUse !== 'all', none = s.uploads.length === 0;
    return {
      notSelecting: !s.upSelect, selecting: s.upSelect, tiles, pv,
      q: s.upQ, hasQ: !!s.upQ, noQ: !s.upQ, qBg: s.upQ ? 'var(--hover)' : 'transparent',
      onQ: (e: any) => this.setState({ upQ: e.target.value }), clearQ: () => { this.setState({ upQ: '' }); this.searchRef.current?.focus(); },
      onQKey: (e: any) => { if (e.key === 'Escape' && !this.state.popover) { e.preventDefault(); if (s.upQ) this.setState({ upQ: '' }); else e.currentTarget.blur(); } },
      typeOpts: seg(['all', 'image', 'video', 'audio'], s.upType, (v: string) => this.setState({ upType: v }), ['All', 'Images', 'Videos', 'Audio']),
      menus: [menu('upUse', 'Usage', [{ id: 'all', label: 'All' }, { id: 'used', label: 'Used' }, { id: 'unused', label: 'Unused' }], s.upUse),
        { ...menu('upSort', 'Sort', [{ id: 'new', label: 'Newest first' }, { id: 'old', label: 'Oldest first' }, { id: 'large', label: 'Largest first' }, { id: 'name', label: 'Name (A–Z)' }], s.upSort), bg: 'transparent' }],
      filtersActive: filtered, clearFilters: set({ upQ: '', upType: 'all', upUse: 'all' }),
      cleanOpen: s.popover === 'upClean', cleanBg: s.popover === 'upClean' ? 'var(--active)' : 'transparent', cleanToggle: (e: any) => this.openPop('upClean', e, 'bottom-end'),
      clean: ([['Select unused', unused], ['Select older than 30 days', old], ['Select larger than 25 MB', big], ['Select duplicates (keep newest)', dupes]] as [string, any[]][]).map(([l, arr]) => ({ label: l, count: arr.length ? `${arr.length} · ${this.fmtSize(bytes(arr))}` : '0', op: arr.length ? 1 : 0.4, pe: arr.length ? 'auto' : 'none', onClick: pick(arr) })),
      delUnusedLabel: unused.length ? `Delete ${unused.length} unused · ${this.fmtSize(bytes(unused))}` : 'No unused files', delUnusedOp: unused.length ? 1 : 0.4, delUnusedPe: unused.length ? 'auto' : 'none', delUnused: () => this.deleteUploads(unused.map((x: any) => x.u.id)),
      startSelect: set({ upSelect: true, upSel: [], popover: null }), endSelect: set({ upSelect: false, upSel: [] }),
      onUpload: () => this.pick('library'),
      selLabel: hasSel ? `${selUps.length} selected · ${this.fmtSize(bytes(selUps))}` : 'Select files',
      selectAllLabel: allSel ? 'Deselect all' : `Select all ${ids.length}`, selectAll: () => this.setState({ upSel: allSel ? [] : ids }),
      bulkOp: hasSel ? 1 : 0.4, bulkPe: hasSel ? 'auto' : 'none',
      bulkUse: () => this.useUploads(s.upSel), bulkZip: () => this.upZip(s.upSel), zipLabel: s.zipping ? 'Zipping…' : 'Download .zip', bulkDelete: () => this.deleteUploads(s.upSel),
      empty: list.length === 0, emptyUpload: none, emptyFiltered: !none && filtered,
      emptyTitle: none ? 'No uploads yet' : 'Nothing here',
      emptyText: none ? 'Files you attach as references or upload here are kept in one place, so you can reuse or clean them up later.' : (s.upQ.trim() ? `No file names match "${s.upQ.trim()}".` : 'Nothing matches these filters.'),
    };
  }

  // ── Derived view state (ported from buildVals()) ────────────────────────
  renderVals() {
    this._memoNext = new Map();
    try { return this.buildVals(); } finally { this._memo = this._memoNext; }
  }
  buildVals(): AnyState {
    const s = this.state, M: AnyState = s.catalog || { image: [], video: [] }, mode: 'image' | 'video' = s.mode, isVideo = mode === 'video', MAX = MAX_REFS;
    const caps = MODEL_CAPS[s.model[mode]] || {};
    const set = (patch: AnyState) => () => this.setState(patch);
    const on = { bg: 'var(--seg)', color: 'var(--text)', shadow: s.theme === 'light' ? '0 1px 2px rgba(0,0,0,.08)' : 'none' };
    const off = { bg: 'transparent', color: 'var(--text3)', shadow: 'none' };
    const seg = (vals: any[], cur: any, fn: (v: any) => void, labels?: string[]) => vals.map((v, i) => ({ label: labels ? labels[i] : String(v), ...(v === cur ? on : off), onClick: () => fn(v) }));
    const navS = (a: boolean) => (a ? { bg: 'var(--active)', color: 'var(--text)' } : { bg: 'transparent', color: 'var(--text2)' });
    const per = (key: string, v: any) => this.setState((st: AnyState) => ({ [key]: { ...st[key], [st.mode]: v } }));
    const go = (view: string) => () => this.setState({ view, popover: null, selectMode: false, selected: [], upSelect: false, upSel: [], upPv: null, ...(view === 'create' ? { projectId: null } : {}) });
    const expanded = !s.collapsed;

    const flat = this.memo('flat', [s.gens], () => { const a: AnyState[] = []; s.gens.forEach((g: any) => g.items.forEach((it: any) => a.push({ it, g }))); return a; });
    const tileOf = ({ it, g }: AnyState, src: string) => {
      const src0 = it.url, ld = this._loaded.has(src0), fr = this._fresh[it.id];
      const hov = s.hoverId === it.id, menuOpen = s.popover === 'item:' + it.id, selecting = s.selectMode && src !== 'feed', sel = s.selected.includes(it.id);
      return this.memo('t:' + src + ':' + it.id, [it, g, src0, ld, fr, hov, menuOpen, selecting, sel, menuOpen && s.menuPage, menuOpen && s.projects], () => ({
        id: it.id, src: src0, onLoad: () => this.markLoaded(src0), blur: ld ? 0 : 14, scale: ld ? 1 : 1.06,
        pulse: fr && ld ? <span key={'pulse-' + it.id} style={{ position: 'absolute', inset: 0, zIndex: 1, borderRadius: 8, pointerEvents: 'none', animation: 'tilePulse 1.4s cubic-bezier(.2,.7,.3,1) ' + fr.d + 'ms both' }} /> : null,
        isVideo: g.type === 'video', dur: g.duration + 's', ar: g.ratio.replace(':', ' / '),
        showRow: !selecting && (hov || it.fav || menuOpen), showAll: !selecting && (hov || menuOpen),
        favFill: it.fav ? 'var(--accent)' : 'none', favStroke: it.fav ? 'var(--accent)' : '#fff',
        selectable: selecting, selected: sel, outline: sel ? '2px solid var(--accent-fg)' : 'none', imgOpacity: !ld ? 0 : selecting && !sel ? 0.8 : 1,
        checkBg: sel ? 'var(--accent)' : 'rgba(0,0,0,.3)', checkBorder: sel ? 'var(--accent)' : 'rgba(255,255,255,.9)',
        cursor: selecting ? 'pointer' : 'zoom-in',
        onOpen: (e: any) => {
          if (!selecting) { this.setState({ lightbox: it.id, lbSource: src }); return; }
          const list = this._lists[src] || [], a = list.indexOf(this._lastSel!), b = list.indexOf(it.id);
          if (e && e.shiftKey && a >= 0 && b >= 0) { const range = list.slice(Math.min(a, b), Math.max(a, b) + 1); this.setState((st: AnyState) => ({ selected: [...new Set([...st.selected, ...range])] })); }
          else this.setState((st: AnyState) => ({ selected: st.selected.includes(it.id) ? st.selected.filter((x: string) => x !== it.id) : [...st.selected, it.id] }));
          this._lastSel = it.id;
        },
        onFav: (e: any) => { e.stopPropagation(); this.toggleFav(it.id); },
        onDelete: (e: any) => { e.stopPropagation(); this.askDelete([it.id]); },
        onMore: (e: any) => { e.stopPropagation(); this.openPop('item:' + it.id, e, 'bottom-end', { menuPage: 'main' }); },
        onCtx: (e: any) => { e.preventDefault(); e.stopPropagation(); this.openPop('item:' + it.id, e, 'point', { menuPage: 'main' }); },
        menuOpen, menu: menuOpen ? this.itemMenu(it, g, src) : [],
        onEnter: () => this.setState({ hoverId: it.id }), onLeave: () => this.setState({ hoverId: null }),
        onDragStart: (e: any) => {
          const st = this.state, ids = st.selectMode && st.selected.includes(it.id) ? st.selected : [it.id];
          this._dragItems = ids; e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', g.prompt || ''); } catch { /* ignore */ }
          this.dragGhost(e, ids.length);
          setTimeout(() => this.setState({ assetDrag: ids.length, popover: null, hoverId: null, projectsOpen: true }), 0);
        },
        onDragEnd: () => { this._dragItems = null; this.setState({ assetDrag: 0, projDrop: null }); },
      }));
    };
    const sizing = (ratio: string, n: number) => { const [a, b] = ratio.split(':').map(Number); return { cols: `repeat(${n}, minmax(0, 1fr))`, maxW: Math.round(n * 290 * a / b + (n - 1) * 6) + 'px' }; };

    const cp = (key: string, text: string) => { const c = s.copied === key; return { copied: c, notCopied: !c, copyLabel: c ? 'Copied' : 'Copy', copyColor: c ? 'var(--accent-fg)' : 'var(--text3)', onCopy: (e: any) => { e && e.stopPropagation(); this.copy(text, key); } }; };
    const clampOf = (id: string, text: string) => { const long = (text || '').length > 160, open = !!s.expanded[id];
      return { long, expanded: open, clamp: long && !open ? 2 : 'none', toggleLabel: open ? 'Show less' : 'Show more', chevron: open ? 180 : 0, onToggle: () => this.setState((st: AnyState) => ({ expanded: { ...st.expanded, [id]: !st.expanded[id] } })) }; };
    const inProj = (g: AnyState, it: AnyState) => !s.projectId || this.projOf(g, it) === s.projectId;
    const pendingRows = s.pending.filter((p: any) => !s.projectId || p.project === s.projectId).map((p: any) => this.memo('p:' + p.id, [p, s.catalog, s.projectId, s.projects, s.copied === 'row:' + p.id, !!s.expanded[p.id]], () => ({
      id: p.id, prompt: p.prompt, ...cp('row:' + p.id, p.prompt), meta: this.meta(p, p.batch), time: this.live('tm', () => 'Generating · ' + this.clock(Date.now() - p.t)), timeColor: 'var(--text3)', project: s.projectId ? '' : this.projName(p.project), t: Date.now(), isPending: true, isFailed: false, onCancel: () => this.cancelGen(p.id), ...clampOf(p.id, p.prompt),
      ...sizing(p.ratio, p.batch), tiles: [], placeholders: Array.from({ length: p.batch }, (_, i) => ({ ar: p.ratio.replace(':', ' / '), spin: this.spinner(),
        pctLabel: this.live('pl', () => this.progress(p, i) + '%'), elapsed: this.live('el', () => this.clock(Date.now() - p.t)),
        bar: this.live('bar', () => <div style={{ height: '100%', width: this.progress(p, i) + '%', background: 'var(--accent)', transition: 'width .25s linear' }} />) })),
    })));
    const sessRows = s.session.map((id: string) => s.gens.find((g: any) => g.id === id)).filter(Boolean).map((g: any) => {
      const items = g.items.filter((it: any) => inProj(g, it));
      if (!items.length) return null;
      const tiles = items.map((it: any) => tileOf({ it, g }, 'feed')), ago = this.ago(g.t);
      return this.memo('s:' + g.id, [g, s.catalog, s.projectId, s.projects, s.copied === 'row:' + g.id, !!s.expanded[g.id], ago, tiles.length, ...tiles], () => ({ id: g.id, prompt: g.prompt, ...cp('row:' + g.id, g.prompt), meta: this.meta(g, items.length), time: ago, timeColor: 'var(--text3)', project: s.projectId ? '' : this.projName(g.project), t: g.t, isPending: false, isFailed: false, ...clampOf(g.id, g.prompt),
        ...sizing(g.ratio, items.length), placeholders: [], tiles }));
    }).filter(Boolean);
    const failedRows = s.failed.filter((f: any) => !s.projectId || f.project === s.projectId).map((f: any) => { const ago = this.ago(f.t); return this.memo('f:' + f.id, [f, s.catalog, s.projectId, s.projects, s.copied === 'row:' + f.id, !!s.expanded[f.id], ago], () => ({
      id: f.id, prompt: f.prompt, ...cp('row:' + f.id, f.prompt), meta: this.meta(f, f.batch), time: 'Failed · ' + ago, timeColor: 'var(--danger)', project: s.projectId ? '' : this.projName(f.project), t: f.t,
      isPending: false, isFailed: true, errTitle: f.err.title, errDetail: f.err.detail, cols: 'minmax(0, 1fr)', maxW: '560px', tiles: [], placeholders: [], ...clampOf(f.id, f.prompt),
      onRetry: () => this.retryFailed(f), onEdit: () => this.reuse(f), onDismiss: () => this.setState((st: AnyState) => ({ failed: st.failed.filter((x: any) => x.id !== f.id) })),
    })); });
    const feedAll = [...pendingRows, ...[...sessRows, ...failedRows].sort((a: any, b: any) => b.t - a.t)];
    this._feedTotal = feedAll.length;
    const feed = feedAll.slice(0, s.feedShown || feedAll.length);
    const dk = (t: number) => { const d = new Date(t); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); };
    const today = new Date(), yest = new Date(); yest.setDate(today.getDate() - 1);
    const dayLabel = (t: number) => { const d = new Date(t); if (dk(t) === dk(today.getTime())) return 'Today'; if (dk(t) === dk(yest.getTime())) return 'Yesterday';
      return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) }); };
    const feedDays = this.memo('days', [dk(today.getTime()), s.catalog, feed.length, ...feed], () => { const out: AnyState[] = [];
      feed.forEach((r: any) => { const k = dk(r.t), last = out[out.length - 1]; if (last && last.key === k) last.rows.push(r); else out.push({ key: k, label: dayLabel(r.t), rows: [r] }); });
      return out; });
    const feedIds = this.memo('feedIds', [sessRows.length, ...sessRows], () => sessRows.flatMap((r: any) => r.tiles.map((t: any) => t.id)));
    const feedEmpty = feedAll.length === 0;

    const isAssets = s.view === 'assets', isFavorites = s.view === 'favorites', gridSrc = isAssets ? 'assets' : 'favorites';
    const byId = this.memo('byId', [flat], () => new Map(flat.map((x: any) => [x.it.id, x])));
    const gp = this.gridParams(s), gqt = terms(gp.q);
    const gridList = this.memo('gridList', [byId, s.gridIds, s.view, s.fType, s.fModel, s.fProject, s.fFav, s.fRatio, s.qd], () => s.gridIds.map((id: string) => byId.get(id)).filter((x: any) => x && this.assetMatch(x, gp, gqt)));
    this._lists = this.memo('lists', [feedIds, gridList, s.view], () => ({ feed: feedIds, assets: isAssets ? gridList.map((a: any) => a.it.id) : [], favorites: isFavorites ? gridList.map((a: any) => a.it.id) : [] }));
    const gridIds = gridList.map((x: any) => x.it.id);
    const liveTotal = Math.max(gridList.length, s.gridTotal - (s.gridIds.length - gridList.length));

    const menu = (key: string, name: string, items: AnyState[], cur: any) => ({
      name, value: (items.find((i) => i.id === cur) || {} as any).label, open: s.popover === key, bg: cur !== 'all' && key !== 'sort' ? 'var(--hover)' : 'transparent',
      onToggle: (e: any) => this.openPop(key, e, 'bottom-start'),
      items: items.map((i) => ({ label: i.label, check: i.id === cur, onClick: () => this.setState({ [key]: i.id, popover: null }) })),
    });
    const filterMenus = this.memo('fm', [s.catalog, s.popover, s.fModel, s.fProject, s.fRatio, s.fFav, s.sort, s.projects, s.gens], () => [
      menu('fModel', 'Model', [{ id: 'all', label: 'All' }, ...[...M.image, ...M.video].map((m: any) => ({ id: m.id, label: m.name }))], s.fModel),
      menu('fProject', 'Project', [{ id: 'all', label: 'All' }, ...s.projects.map((p: any) => ({ id: p.id, label: p.name }))], s.fProject),
      menu('fRatio', 'Ratio', [{ id: 'all', label: 'All' }, ...[...new Set([...Object.values(MODEL_CAPS).flatMap((c) => c.ratios || []), ...s.gens.map((g: any) => g.ratio)])].map((r) => ({ id: r, label: r }))], s.fRatio),
      menu('fFav', 'Starred', [{ id: 'all', label: 'All' }, { id: 'fav', label: 'Favorites only' }, { id: 'nofav', label: 'Not favorited' }], s.fFav),
      menu('sort', 'Sort', [{ id: 'new', label: 'Newest first' }, { id: 'old', label: 'Oldest first' }, { id: 'fav', label: 'Favorites first' }, { id: 'model', label: 'Model (A–Z)' }, { id: 'project', label: 'Project (A–Z)' }, { id: 'type', label: 'Images, then videos' }], s.sort),
    ]);

    const seg2 = seg;
    const up = this.upVals(menu, set, seg2);
    let lb: AnyState = { rows: [] };
    const f = s.lightbox && flat.find((x: any) => x.it.id === s.lightbox);
    if (f) {
      const { it, g } = f, lsrc = it.url, lld = this._loaded.has(lsrc), v = g.type === 'video', list = this._lists[s.lbSource] || [], i = list.indexOf(it.id);
      const [pw, ph] = this.pxSize(g), mono = "'Geist Mono',monospace";
      const refs = (g.refs || []).map((r: any) => ({ ...r, isImage: r.kind === 'image', isMedia: r.kind !== 'image', hasTag: !!r.tag, tagTip: TAG_TIPS[r.tag] || '', title: r.name || r.kind }));
      lb = {
        src: lsrc, refs, hasRefs: refs.length > 0, refCount: refs.length, onLoad: () => this.markLoaded(lsrc), op: lld ? 1 : 0, blur: lld ? 0 : 16, isVideo: v, prompt: g.prompt, ...cp('lb:' + it.id, g.prompt), favLabel: it.fav ? 'Favorited' : 'Favorite',
        favFill: it.fav ? 'var(--accent)' : 'none', favStroke: it.fav ? 'var(--accent)' : 'currentColor',
        pos: i >= 0 ? `${i + 1} / ${list.length}` : '', hasPrev: i > 0, hasNext: i >= 0 && i < list.length - 1,
        rows: ([['Model', this.modelName(g.model)], ['Seed', String(this.seedNum(it.seed)), mono], ['Size', pw + ' × ' + ph, mono], ['Type', v ? 'Video' : 'Image'], ['Aspect ratio', g.ratio], ['Resolution', g.res],
          v ? ['Duration', g.duration + 's'] : null, v ? ['Audio', g.audio ? 'On' : 'Off'] : null, ['Format', g.fmt],
          ['Project', this.projName(this.projOf(g, it)) || '—'], ['Created', this.ago(g.t)]].filter(Boolean) as [string, string, string?][]).map(([k, val, ff]) => ({ k, v: val, ff: ff || 'inherit' })),
      };
    }

    const projCount = (pid: string) => s.counts.projects[pid] || 0;
    const crumb = s.view === 'create' ? (s.projectId ? this.projName(s.projectId) : 'Create') : isAssets ? 'Assets' : isFavorites ? 'Favorites' : s.view === 'uploads' ? 'Uploads' : 'Settings';
    // Counts/bytes come from /api/counts (the real totals), not s.uploads.length/size — that array
    // is only whatever page of uploads happened to load, so summing it undercounts past the first
    // page (see TODO.md's "Show storage used" item).
    const upCount = s.counts.uploads ?? s.uploads.length, upBytes = s.counts.uploadBytes ?? s.uploads.reduce((a: number, u: any) => a + (u.size || 0), 0);
    const headerMeta = (isAssets || isFavorites) ? (s.gridBoot ? '' : liveTotal + (liveTotal === 1 ? ' item' : ' items')) : s.view === 'uploads' ? `${upCount} file${upCount === 1 ? '' : 's'} · ${this.fmtSize(upBytes)}` : '';
    const pc = s.projectId ? projCount(s.projectId) : 0;
    const showKeyForm = s.modal === 'connect' || (s.modal === 'manage' && s.replacing);

    const modeRefs = s.refs.list.filter((x: any) => x.mode === mode);
    const kindCount = (k: string) => modeRefs.filter((x: any) => x.kind === k).length;
    const rm = (id: string) => () => this.setState((st: AnyState) => ({ refs: { ...st.refs, list: st.refs.list.filter((y: any) => y.id !== id) } }), this.sweepBlobs);
    const refChips = [
      ...(isVideo && s.refs.start ? [{ id: 'start', isImage: true, url: s.refs.start.url, tag: 'Start', tagTip: TAG_TIPS.Start, uploading: !!s.refs.start.uploading, onRemove: () => this.setState((st: AnyState) => ({ refs: { ...st.refs, start: null } }), this.sweepBlobs) }] : []),
      ...(isVideo && s.refs.end ? [{ id: 'end', isImage: true, url: s.refs.end.url, tag: 'End', tagTip: TAG_TIPS.End, uploading: !!s.refs.end.uploading, onRemove: () => this.setState((st: AnyState) => ({ refs: { ...st.refs, end: null } }), this.sweepBlobs) }] : []),
      ...modeRefs.map((x: any) => ({ ...x, isImage: x.kind === 'image', isVideo: x.kind === 'video', isAudio: x.kind === 'audio', thumb: x.kind === 'video' ? x.url + '#t=0.1' : x.url, tag: '', onRemove: rm(x.id) })),
    ].map((r: any) => ({ ...r, bg: r.isImage && r.url ? `url("${r.url}")` : 'none' }));

    const confirm = s.confirm, cProj = confirm && confirm.kind === 'project' ? confirm.id : null, cN = cProj ? projCount(cProj) : 0;
    const nItems = confirm && confirm.kind === 'items' ? confirm.ids.length : 0;
    const cGen = confirm && confirm.kind === 'generate' ? confirm.payload : null;
    const allSel = gridIds.length > 0 && s.selected.length >= liveTotal && gridIds.every((id: string) => s.selected.includes(id));

    const samples = (SAMPLES as any)[this.state.mode].map(([label, prompt]: [string, string]) => ({ label, prompt, insert: () => this.insertSample(prompt) }));
    return {
      theme: s.theme, isDark: s.theme === 'dark', isLight: s.theme === 'light',
      fileRef: this.fileRef, feedRef: this.feedRef, promptRef: this.promptRef, onFiles: this.onFiles,
      negSupported: !!caps.negative,
      negOn: s.negOn && !!caps.negative, negPrompt: s.negPrompt, onNeg: (e: any) => this.setState({ negPrompt: e.target.value }),
      toggleNeg: () => this.setState({ negOn: !s.negOn }), negTitle: s.negOn ? 'Hide negative prompt' : 'Negative prompt',
      negBtn: s.negOn ? { bg: 'var(--active)', color: 'var(--text)', border: 'var(--border2)' } : { bg: 'transparent', color: 'var(--text2)', border: 'var(--border)' },
      expanded, collapsed: s.collapsed, asideW: s.collapsed ? 48 : 232, collapseTitle: s.collapsed ? 'Expand sidebar' : 'Collapse sidebar',
      toggleCollapse: () => { const c = !s.collapsed; try { localStorage.setItem('studio.sidebarCollapsed', c ? '1' : '0'); } catch { /* ignore */ } this.setState({ collapsed: c, popover: null }); },
      nav: { create: navS(s.view === 'create' && !s.projectId), assets: navS(isAssets), favorites: navS(isFavorites), uploads: navS(s.view === 'uploads'), settings: navS(s.view === 'settings') },
      goCreate: go('create'), goAssets: go('assets'), goFavorites: go('favorites'), goUploads: go('uploads'), goSettings: go('settings'),
      assetTotal: s.counts.assets, favTotal: s.counts.favorites, upTotal: s.counts.uploads,
      projectsChevron: s.projectsOpen ? 0 : -90, toggleProjects: set({ projectsOpen: !s.projectsOpen }), showProjects: s.collapsed || s.projectsOpen,
      projectItems: s.projects.map((p: any) => this.memo('pr:' + p.id, [p, s.gens, s.counts, expanded, s.projHover === p.id, s.popover === 'proj:' + p.id, s.view === 'create' && s.projectId === p.id, s.projDrop && s.projDrop.id === p.id ? s.projDrop.pos : null, s.assetDrag > 0, s.projDragId === p.id], () => {
        const menuOpen = s.popover === 'proj:' + p.id, showMore = expanded && (s.projHover === p.id || menuOpen);
        const count = s.counts.projects[p.id] || 0;
        const dp = s.projDrop && s.projDrop.id === p.id ? s.projDrop.pos : null, nv = navS(s.view === 'create' && s.projectId === p.id);
        return { name: p.name, emoji: p.emoji || '', noEmoji: !p.emoji, count, showCount: !showMore && count > 0, expanded, showMore, menuOpen, padR: showMore ? 20 : 0, ...nv,
          ...(dp === 'into' ? { bg: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--text)' } : {}),
          dropOutline: dp === 'into' ? '1.5px solid var(--accent-fg)' : s.assetDrag ? '1px dashed var(--border2)' : 'none',
          lineTop: dp === 'before', lineBottom: dp === 'after', op: s.projDragId === p.id ? 0.4 : 1,
          onDragStart: (e: any) => { this._dragProj = p.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', p.name); } catch { /* ignore */ } setTimeout(() => this.setState({ projDragId: p.id, popover: null, projHover: null }), 0); },
          onDragEnd: () => { this._dragProj = null; this.setState({ projDragId: null, projDrop: null }); },
          onDragOver: (e: any) => {
            let pos: string | null = null;
            if (this._dragItems) pos = 'into';
            else if (this._dragProj && this._dragProj !== p.id) { const r = e.currentTarget.getBoundingClientRect(); pos = e.clientY < r.top + r.height / 2 ? 'before' : 'after'; }
            if (!pos) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move';
            const d = this.state.projDrop; if (!d || d.id !== p.id || d.pos !== pos) this.setState({ projDrop: { id: p.id, pos } });
          },
          onDragLeave: (e: any) => { if (e.currentTarget.contains(e.relatedTarget)) return; const d = this.state.projDrop; if (d && d.id === p.id) this.setState({ projDrop: null }); },
          onDrop: (e: any) => {
            e.preventDefault(); const d = this.state.projDrop; this.setState({ projDrop: null });
            if (this._dragItems) { const ids = this._dragItems; this._dragItems = null; this.bulkMove(ids, p.id); }
            else if (this._dragProj && d) { this.reorderProject(this._dragProj, p.id, d.pos); this._dragProj = null; }
          },
          onClick: () => this.setState({ view: 'create', projectId: p.id, popover: null, selectMode: false, selected: [] }),
          onEnter: () => this.setState({ projHover: p.id }), onLeave: () => this.setState({ projHover: null }),
          onMore: (e: any) => { e.stopPropagation(); this.openPop('proj:' + p.id, e, 'bottom-end'); },
          onCtx: (e: any) => { e.preventDefault(); this.openPop('proj:' + p.id, e, 'point'); },
          onRename: () => this.setState({ popover: null, modal: 'projName', renameId: p.id, newName: p.name, newEmoji: p.emoji || null }),
          onDelete: () => this.setState({ popover: null, confirm: { kind: 'project', id: p.id } }) };
      })),
      openNewProject: set({ modal: 'projName', renameId: null, newName: '', newEmoji: null }),
      emojiOpts: [null, '🌸', '🌊', '📦', '🎬', '📸', '🎨', '✨', '🔥', '🌙', '☀️', '🌿', '🍋', '🚀', '🎧', '🏔️', '👟', '💡'].map((c) => {
        const onP = (s.newEmoji || null) === c;
        return { char: c || '', isNone: !c, title: c ? c : 'No emoji', border: onP ? 'var(--text3)' : 'transparent', bg: onP ? 'var(--active)' : 'var(--hover)', onPick: () => this.setState({ newEmoji: c }) };
      }),
      toggleTheme: () => this.setTheme(s.theme === 'dark' ? 'light' : 'dark'),
      hasKey: s.hasKey, noKey: !s.hasKey,
      openKey: set({ modal: s.hasKey ? 'manage' : 'connect', keyInput: '', keyErr: '', replacing: false }),
      pricingUrl: (s.catalog && s.catalog.pricingUrl) || 'https://higgsfield.ai/pricing',
      exportBackup: this.exportBackup, exporting: s.exporting,
      ...this.keyVals(), ...this.walkVals(samples, feedEmpty), samples,

      crumb, crumbParent: s.view === 'create' && s.projectId ? 'Projects' : '', headerMeta,
      projLink: s.view === 'create' && s.projectId && pc ? { label: `View ${pc} in Assets`, onClick: () => this.setState({ view: 'assets', fType: 'all', fModel: 'all', fProject: s.projectId }) } : null,
      showClear: s.view === 'create' && sessRows.length > 0,
      clearSession: () => { const sn = this.snap(), nc = sessRows.length; this.setState((st: AnyState) => ({ failed: st.projectId ? st.failed.filter((f: any) => f.project !== st.projectId) : [], session: st.projectId ? st.session.filter((id: string) => { const g = st.gens.find((x: any) => x.id === id); return g && !g.items.some((it: any) => this.projOf(g, it) === st.projectId); }) : [], refs: { start: null, end: null, list: [] } }), this.sweepBlobs); this.notify(`Cleared ${nc} generation${nc === 1 ? '' : 's'} from this session. They're still in Assets.`, { kind: 'info', undo: () => this.restore(sn) }); },
      shortcutsOpen: !!s.shortcuts, closeShortcuts: set({ shortcuts: false }), openShortcuts: set({ shortcuts: true, popover: null }),
      isCreate: s.view === 'create', isGrid: isAssets || isFavorites, isAssets, isSettings: s.view === 'settings', isUploads: s.view === 'uploads', up,
      feed, feedDays, hasFeed: !feedEmpty, onFeedScroll: this.maybeMoreFeed, feedEmpty, emptyTitle: s.projectId ? `New in ${this.projName(s.projectId)}` : 'What do you want to make?',
      dock: feedEmpty ? { justify: 'flex-end', pad: '24px 24px 12vh', innerPad: '0', bg: 'transparent' } : { justify: 'flex-end', pad: '0', innerPad: '48px 24px 20px', bg: 'linear-gradient(to bottom, transparent, var(--panel) 45%)' },
      popRef: this.popRef, pp: s.popXY ? { left: s.popXY.left + 'px', top: s.popXY.top + 'px', maxH: s.popXY.maxH + 'px', vis: 'visible' } : { left: '0px', top: '0px', maxH: 'none', vis: 'hidden' },

      onDragEnter: (e: any) => { if (!this.hasFiles(e)) return; e.preventDefault(); this.dragDepth++; if (!this.state.dragging) this.setState({ dragging: true }); },
      onDragOver: (e: any) => { if (this.hasFiles(e)) e.preventDefault(); },
      onDragLeave: () => { this.dragDepth = Math.max(0, this.dragDepth - 1); if (!this.dragDepth && this.state.dragging) this.setState({ dragging: false }); },
      onDrop: (e: any) => { e.preventDefault(); this.dragDepth = 0; this.setState({ dragging: false }); const files = [...(e.dataTransfer?.files || [])]; if (files.length) this.addFiles(files); },
      onGridDrop: (e: any) => { e.preventDefault(); this.dragDepth = 0; this.setState({ dragging: false }); const files = [...(e.dataTransfer?.files || [])]; if (files.length) this.uploadFiles(files); },
      onUpDrop: (e: any) => { e.preventDefault(); this.dragDepth = 0; this.setState({ dragging: false }); const files = [...(e.dataTransfer?.files || [])]; if (files.length) this.libraryUpload(files); },
      dragging: s.dragging,
      dropTitle: s.view === 'create' ? 'Drop to add as reference' : s.view === 'uploads' ? 'Drop to upload' : 'Drop to upload to Assets',
      dropSub: s.view === 'uploads' ? 'Images, videos and audio · saved to Uploads' : s.view === 'create' ? (isVideo ? 'Images, videos or audio · up to 10 of each' : 'Images · up to 10') : 'Images are saved to Assets, not used as references',
      netBanner: this.offline()
        ? { dot: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 8%, var(--panel))', title: "You're offline", text: 'Generate is paused until your connection is back.', action: 'Retry',
            onAction: () => this.setState({ online: navigator.onLine !== false }, () => { if (this.offline()) this.toastMsg('Still offline', 'error'); else this.notify('Back online', { kind: 'info' }); }) }
        : this.rateLeft() ? { dot: 'var(--warn)', bg: 'color-mix(in srgb, var(--warn) 8%, var(--panel))', title: 'Rate limited', text: `Higgsfield is limiting requests from this key. You can generate again in ${this.clock(this.rateLeft())}.`, action: '', onAction: null } : null,

      isVideo, hasRefs: refChips.length > 0, refChips,
      refCount: isVideo ? `${refChips.length} added` : `${kindCount('image')}/${MAX}`,
      attachTitle: isVideo ? 'Add references' : `Add reference images (${kindCount('image')}/${MAX})`,
      attach: (e: any) => { this.openPop('attach', e, feedEmpty ? 'bottom-start' : 'top-start'); },
      // "Choose from Uploads" jumps straight to the Uploads page pre-armed in select mode — the
      // existing "Use as reference" bulk action there (useUploads()) already attaches and returns
      // to Create, so there's no separate picker UI to build.
      attachItems: [
        ...(isVideo ? [
          { label: 'Start frame', count: s.refs.start ? '1/1' : '', full: false, opacity: 1, onClick: () => this.pick('start') },
          { label: 'End frame', count: s.refs.end ? '1/1' : '', full: false, opacity: 1, onClick: () => this.pick('end') },
          ...(['image', 'video', 'audio'] as const).map((k) => { const c = kindCount(k); const label = k === 'image' ? 'Images' : k === 'video' ? 'Videos' : 'Audio'; return { label, count: c + '/' + MAX, full: c >= MAX, opacity: c >= MAX ? 0.4 : 1, onClick: () => this.pick(k) }; }),
        ] : [
          { label: 'Images', count: `${kindCount('image')}/${MAX}`, full: kindCount('image') >= MAX, opacity: kindCount('image') >= MAX ? 0.4 : 1, onClick: () => this.pick('image') },
        ]),
        { label: 'Choose from Uploads', count: '', full: false, opacity: 1, onClick: () => this.setState({ view: 'uploads', upSelect: true, upSel: [], popover: null }) },
      ],

      prompt: s.prompt, placeholder: isVideo ? 'Describe a video…' : 'Describe an image…',
      onPrompt: (e: any) => this.setState({ prompt: e.target.value }, () => requestAnimationFrame(() => this.autosize())),
      onPromptKey: (e: any) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (s.editorOpen && s.prompt.trim()) this.setState({ editorOpen: false }); this.generate(); } },
      editorOpen: !!s.editorOpen, openEditor: this.openEditor, closeEditor: this.closeEditor, editorRef: this.editorRef,
      editorMode: (isVideo ? 'Video' : 'Image') + ' · ' + this.modelName(s.model[mode]), promptLen: s.prompt.length + ' chars',
      editorGenerate: () => { if (this.genBlock()) return; this.setState({ editorOpen: false }); this.generate(); },
      modeSeg: { image: mode === 'image' ? on : off, video: isVideo ? on : off },
      setImage: set({ mode: 'image', popover: null }), setVideo: set({ mode: 'video', popover: null }),
      pop: { attach: s.popover === 'attach', settings: s.popover === 'settings' },
      popSettings: set({ popover: s.popover === 'settings' ? null : 'settings' }),
      popOpen: !!s.popover, closePop: set({ popover: null }),
      modelGroupLabel: isVideo ? 'Video model' : 'Image model',
      pillsRef: this.pillsRef,
      pills: (() => {
        const shape = (r: string, k0 = 13) => { const [a, b] = r.split(':').map(Number), k = k0 / Math.max(a, b); return { w: Math.max(5, Math.round(a * k)), h: Math.max(5, Math.round(b * k)) }; };
        const opt = (label: string, cur: boolean, fn: () => void, x: AnyState = {}) => ({ label, desc: '', shape: false, check: cur, bg: cur ? 'var(--hover)' : 'transparent', onClick: () => { fn(); this.setState({ popover: null }); }, ...x });
        const ic = (k: string) => ({ model: k === 'model', ratio: k === 'ratio', dur: k === 'dur', res: k === 'res', batch: k === 'batch', audio: k === 'audio', mute: k === 'mute' });
        const list = [
          { key: 'model', icon: 'model', title: isVideo ? 'Video model' : 'Image model', value: s.catalog ? this.modelName(s.model[mode]) : 'Loading…', menuW: 260,
            items: M[mode].map((m: any) => opt(m.name, m.id === s.model[mode], () => {
              per('model', m.id);
              const next = MODEL_CAPS[m.id] || {};
              if (next.durations && !next.durations.includes(s.duration)) this.setState({ duration: next.durations[0] });
              if (next.res && !next.res.includes(s.res[mode])) per('res', next.res[0]);
              if (next.ratios && !next.ratios.includes(s.ratio[mode])) per('ratio', next.ratios[0]);
            }, { desc: m.desc })) },
          caps.ratios ? { key: 'ratio', icon: 'ratio', title: 'Aspect ratio', value: s.ratio[mode], menuW: 150, ...shape(s.ratio[mode]),
            items: caps.ratios.map((r) => opt(r, r === s.ratio[mode], () => per('ratio', r), { shape: true, ...shape(r, 14) })) } : null,
          isVideo && caps.duration ? { key: 'dur', icon: 'dur', title: 'Duration', value: s.duration + 's', menuW: 140,
            items: (caps.durations || [5, 10]).map((v) => opt(v + 's', v === s.duration, () => this.setState({ duration: v }))) } : null,
          caps.res ? { key: 'res', icon: 'res', title: 'Resolution', value: s.res[mode], menuW: 140,
            items: caps.res.map((v) => opt(String(v), v === s.res[mode], () => per('res', v))) } : null,
          { key: 'batch', icon: 'batch', title: 'Batch size', value: s.batch + '×', menuW: 140,
            items: [1, 2, 3, 4].map((v) => opt(v + '×', v === s.batch, () => this.setState({ batch: v }))) },
          isVideo && caps.audio ? { key: 'audio', icon: s.audio ? 'audio' : 'mute', title: 'Audio', value: s.audio ? 'Audio on' : 'Audio off', menuW: 220,
            items: [opt('On', s.audio, () => this.setState({ audio: true }), { desc: 'Generate sound with the video' }), opt('Off', !s.audio, () => this.setState({ audio: false }))] } : null,
        ].filter(Boolean) as AnyState[];
        const lvl = s.pillLvl || 0, keep: string[] | null = lvl === 0 ? null : lvl === 1 ? ['model', 'ratio'] : lvl === 2 ? ['model'] : [];
        return list.map((p) => { const k = 'pill:' + p.key, open = s.popover === k, full = !keep || keep.includes(p.key);
          return { w: 0, h: 0, ...p, ic: ic(p.icon), full, pad: full ? '0 10px 0 9px' : '0 8px', tip: full ? p.title : p.title + ': ' + p.value, open, bg: open ? 'var(--active)' : 'var(--hover)', color: open ? 'var(--text)' : 'var(--text2)',
            onToggle: (e: any) => this.openPop(k, e, feedEmpty ? 'bottom-start' : 'top-start') }; });
      })(),
      generate: this.generate,
      gen: (() => { const b = this.genBlock(); return { disabled: !!b, hint: !b, reasonText: !!(b && !b.action), reasonAction: !!(b && b.action), reason: b ? b.reason : '', onReason: b && b.action ? b.action : null,
        title: b ? b.title : 'Generate (⌘↵)', bg: b ? 'var(--hover)' : 'var(--accent)', color: b ? 'var(--text3)' : 'var(--on-accent)', cursor: b ? 'not-allowed' : 'pointer' }; })(),

      fTypeOpts: seg(['all', 'image', 'video'], s.fType, (v: string) => this.setState({ fType: v }), ['All', 'Images', 'Videos']),
      filterMenus, filtersActive: !!s.q.trim() || s.fType !== 'all' || s.fModel !== 'all' || s.fProject !== 'all' || s.fFav !== 'all' || s.fRatio !== 'all',
      clearFilters: set({ q: '', qd: '', fType: 'all', fModel: 'all', fProject: 'all', fFav: 'all', fRatio: 'all' }),
      searchRef: this.searchRef, q: s.q, hasQ: !!s.q, noQ: !s.q, qBg: s.q ? 'var(--hover)' : 'transparent',
      onQ: (e: any) => this.setQ(e.target.value), clearQ: () => { this.setQ('', true); this.searchRef.current?.focus(); },
      onQKey: (e: any) => { if (e.key === 'Enter') this.setQ(e.currentTarget.value, true); if (e.key === 'Escape' && !this.state.popover) { e.preventDefault(); if (s.q) this.setQ('', true); else e.currentTarget.blur(); } },
      gridRef: this.gridRef, onGridScroll: () => this.maybeLoadMore(),
      gridTiles: s.gridBoot ? [] : gridList.map((a: any) => tileOf(a, gridSrc)), gridEmpty: !s.gridBoot && s.gridDone && gridList.length === 0,
      skelTiles: Array.from({ length: s.gridBoot ? 12 : s.gridLoading ? Math.min(PAGE, Math.max(0, s.gridTotal - s.gridIds.length)) : 0 }, (_, i) => ({
        el: <div key={'sk' + i} style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, var(--active), transparent)', animation: `skel 1.3s ease-in-out ${(i % 6) * 0.07}s infinite` }} /> })),
      gridEnd: !s.gridBoot && s.gridDone && gridList.length > PAGE, gridEndText: `That's everything · ${gridList.length} items`,
      gridEmptyTitle: isAssets ? (flat.length ? 'Nothing here' : 'No assets yet') : 'No favorites yet',
      gridEmptyCreate: isAssets && flat.length === 0, gridEmptyFiltered: isAssets && flat.length > 0 && gridList.length === 0,
      gridEmptyText: isAssets ? (flat.length ? (s.q.trim() ? `No prompts match "${s.q.trim()}".` : 'Nothing matches these filters.') : 'Everything you generate lands here.') : 'Star anything you create to keep it here.',
      selectMode: s.selectMode, notSelecting: !s.selectMode,
      startSelect: set({ selectMode: true, selected: [], popover: null }), endSelect: set({ selectMode: false, selected: [] }),
      selLabel: s.selected.length ? `${s.selected.length} selected` : 'Select items',
      selectAllLabel: allSel ? 'Deselect all' : `Select all ${liveTotal}`,
      bulkOp: s.selected.length ? 1 : 0.4, bulkPe: s.selected.length ? 'auto' : 'none',
      ...(() => { const sel = this.bulkItems(s.selected), allFav = sel.length > 0 && sel.every((x: any) => x.it.fav), open = s.popover === 'bulkMove';
        return { bulkFavLabel: allFav ? 'Unfavorite' : 'Favorite', bulkFavFill: allFav ? 'var(--accent)' : 'none', bulkFavStroke: allFav ? 'var(--accent)' : 'currentColor',
          bulkFav: () => this.bulkFav(s.selected, !allFav),
          bulkMoveOpen: open, bulkMoveBg: open ? 'var(--active)' : 'transparent', bulkMoveToggle: (e: any) => this.openPop('bulkMove', e, 'bottom-end'),
          bulkMoveHead: `Move ${sel.length} ${sel.length === 1 ? 'item' : 'items'} to`,
          bulkMoveItems: [{ id: null, name: 'No project' }, ...s.projects].map((p: any) => ({ label: p.name, check: sel.length > 0 && sel.every((x: any) => (this.projOf(x.g, x.it) || null) === p.id), onClick: () => this.bulkMove(s.selected, p.id) })),
          zipLabel: s.zipping ? 'Zipping…' : 'Download .zip', bulkZip: () => this.zipDownload(s.selected),
          bulkCopyLabel: s.copied === 'bulk' ? 'Copied' : 'Copy prompts', bulkCopy: () => this.bulkCopy(sel),
          rerunTitle: 'Rerun with same settings', bulkRerun: () => this.bulkRerun(sel) }; })(),
      selectAll: () => { if (allSel) { this.setState({ selected: [] }); return; } this.api.listAssetIds(this.gridParams()).then((ids) => this.setState({ selected: ids })); },
      deleteSelected: () => this.askDelete(s.selected, true), selDelOpacity: s.selected.length ? 1 : 0.4,

      keyButton: s.hasKey ? 'Manage API key' : 'Connect API key',
      themeOpts: seg(['dark', 'light'], s.theme, (v: string) => this.setTheme(v), ['Dark', 'Light']),
      defModeOpts: seg(['image', 'video'], s.defMode, (v: string) => this.setDefMode(v), ['Image', 'Video']),

      lbz: (() => { const z = this.lbZ(), m = f && this.lbMetrics(), act = 'rgba(255,255,255,.16)';
        return { s: z.s, x: z.x, y: z.y, dur: z.anim ? 0.18 : 0, cursor: z.s > 1 ? (s.lbDrag ? 'grabbing' : 'grab') : 'default',
          pct: m ? Math.round(z.s * m.fit * 100) + '%' : '—', fitBg: z.s === 1 ? act : 'transparent', oneBg: m && Math.abs(z.s - m.one) < 0.01 ? act : 'transparent' }; })(),
      lbStageRef: this.lbStageRef, lbBoxRef: this.lbBoxRef, lbDown: this.lbDown, lbStageClick: this.lbStageClick,
      lbZoomIn: () => this.lbZoomTo(this.lbZ().s * 1.25, 0, 0, true), lbZoomOut: () => this.lbZoomTo(this.lbZ().s / 1.25, 0, 0, true),
      lbFit: () => this.lbZoomTo(1, 0, 0, true), lbOne: () => { const m = this.lbMetrics(); if (m) this.lbZoomTo(m.one, 0, 0, true); },
      lbOpen: !!f, lb, closeLb: set({ lightbox: null }), stop: (e: any) => e.stopPropagation(),
      lbPrev: (e: any) => { e.stopPropagation(); this.lbStep(-1); }, lbNext: (e: any) => { e.stopPropagation(); this.lbStep(1); },
      lbFav: () => f && this.toggleFav(f.it.id),
      lbDownload: () => f && window.open(lb.src, '_blank'),
      lbReuse: () => f && this.reuse(f.g),
      lbDelete: () => f && this.askDelete([f.it.id]),

      modalOpen: !!s.modal || !!s.confirm, closeModal: set({ modal: null, confirm: null, replacing: false, renameId: null }),
      showKeyForm, showManage: s.modal === 'manage' && !s.replacing, showProjName: s.modal === 'projName',
      keyFormTitle: s.replacing ? 'Replace API key' : 'Connect API key',
      keyInput: s.keyInput, onKeyInput: (e: any) => this.setState({ keyInput: e.target.value, keyErr: '' }),
      keySaveOpacity: s.keyInput.trim() && !s.checking ? 1 : 0.45,
      saveKey: () => this.submitKey(),
      onKeyInputKey: (e: any) => { if (e.key === 'Enter') this.submitKey(); },
      cancelKeyForm: () => (s.replacing ? this.setState({ replacing: false, keyInput: '', keyErr: '' }) : this.setState({ modal: null, keyErr: '' })),
      keyMask: '•••• ' + s.keyLast4, removeKey: this.removeKey, startReplace: set({ replacing: true, keyInput: '' }),
      projModalTitle: s.renameId ? 'Edit project' : 'New project', projModalBtn: s.renameId ? 'Save' : 'Create project',
      newName: s.newName, onNewName: (e: any) => this.setState({ newName: e.target.value }), newProjOpacity: s.newName.trim() ? 1 : 0.45,
      saveProject: () => this.saveProject(), onNewNameKey: (e: any) => { if (e.key === 'Enter') this.saveProject(); },

      confirmItems: nItems > 0,
      confirmTitle: nItems > 1 ? `Delete ${nItems} assets?` : 'Delete this asset?',
      confirmBody: `${nItems > 1 ? 'They' : 'It'} will be removed from Create, Assets, Favorites and ${nItems > 1 ? 'their projects' : 'its project'}. This can't be undone.`,
      doDelete: () => this.doDelete(),
      confirmProject: !!cProj, projHasAssets: cN > 0,
      projConfirmTitle: cProj ? `Delete "${this.projName(cProj)}"?` : '',
      projConfirmBody: cN ? `This project has ${cN} asset${cN > 1 ? 's' : ''}. Keep them in Assets without a project, or delete them too.` : 'This project is empty.',
      projDeleteLabel: cN ? 'Delete assets too' : 'Delete project',
      deleteProjKeep: () => this.deleteProject(false), deleteProjAll: () => this.deleteProject(true),
      confirmGenerate: !!cGen,
      confirmGenTitle: cGen ? `Generate ${cGen.batch > 1 ? cGen.batch + ' ' : ''}${cGen.type === 'video' ? (cGen.batch > 1 ? 'videos' : 'a video') : (cGen.batch > 1 ? 'images' : 'an image')}?` : '',
      confirmGenPrompt: cGen ? cGen.prompt : '',
      confirmGenMeta: cGen ? [this.modelName(cGen.model), cGen.ratio, cGen.type === 'video' ? cGen.duration + 's' : null, cGen.res].filter(Boolean).join(' · ') : '',
      doGenerateConfirm: () => this.doGenerate(),

      toasts: s.toasts.map((t: any) => {
        const onT = t.shown && !t.leaving;
        return { id: t.id, msg: t.msg, role: t.kind === 'error' ? 'alert' : 'status', isSuccess: t.kind === 'success', isDelete: t.kind === 'delete', isError: t.kind === 'error', isInfo: t.kind === 'info', hasUndo: !!t.undo,
          op: onT ? 1 : 0, tf: onT ? 'translateY(0) scale(1)' : 'translateY(8px) scale(.98)',
          bar: t.undo ? <span key={'bar-' + t.id} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'var(--text3)', opacity: 0.6, transformOrigin: 'left', animation: `toastCountdown ${t.ms}ms linear forwards`, animationPlayState: t.paused ? 'paused' : 'running' }} /> : null,
          onEnter: () => !t.leaving && this.pauseToast(t.id), onLeave: () => !t.leaving && this.resumeToast(t.id),
          onUndo: () => this.runUndo(t.id), onClose: () => this.dismiss(t.id) };
      }),
    };
  }

  // ── Render: sidebar ──────────────────────────────────────────────────────
  renderSidebar(v: AnyState) {
    return (
      <aside style={css(`flex:0 0 ${v.asideW}px;width:${v.asideW}px;min-width:0;display:flex;flex-direction:column;padding:10px 8px;gap:2px;box-sizing:border-box;transition:width .15s;overflow:visible`)}>
        <div style={css('display:flex;align-items:center;gap:9px;height:36px;margin-bottom:10px')}>
          {v.expanded && (
            <div style={css('flex:1;display:flex;align-items:center;gap:9px;padding:0 8px;overflow:hidden;white-space:nowrap')}>
              <div style={css('width:18px;height:18px;flex-shrink:0;border-radius:5px;background:var(--accent);display:flex;align-items:center;justify-content:center')}>
                <div style={css('width:6px;height:6px;border-radius:2px;background:var(--on-accent)')} />
              </div>
              <span style={css('font-weight:600;font-size:14px;letter-spacing:-0.01em')}>Studio</span>
            </div>
          )}
          <button onClick={v.toggleCollapse} title={v.collapseTitle} className="u-hov-active-text" style={css('width:31px;height:30px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--text3);cursor:pointer')}>
            <svg width="15" height="15" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linejoin:round')}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9.5 4v16" /></svg>
          </button>
        </div>

        <button onClick={v.goCreate} title="Create" className="u-hov-active"
          onDragOver={(e: any) => { if (e.dataTransfer.types.includes('application/x-studio-upload')) e.preventDefault(); }}
          onDrop={(e: any) => { const id = e.dataTransfer.getData('application/x-studio-upload'); if (id) { e.preventDefault(); this.useUploads([id]); } }}
          style={css(`display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:${v.nav.create.bg};color:${v.nav.create.color};cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden`)}>
          <svg width="15" height="15" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 17v4M17 19h4" /></svg>
          {v.expanded && <span>Create</span>}
        </button>
        <button onClick={v.goAssets} title="Assets" className="u-hov-active" style={css(`display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:${v.nav.assets.bg};color:${v.nav.assets.color};cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden`)}>
          <svg width="15" height="15" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>
          {v.expanded && (<><span style={css('flex:1')}>Assets</span><span style={css("font-size:11.5px;color:var(--text3);font-family:'Geist Mono',monospace")}>{v.assetTotal}</span></>)}
        </button>
        <button onClick={v.goFavorites} title="Favorites" className="u-hov-active" style={css(`display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:${v.nav.favorites.bg};color:${v.nav.favorites.color};cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden`)}>
          <svg width="15" height="15" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>
          {v.expanded && (<><span style={css('flex:1')}>Favorites</span><span style={css("font-size:11.5px;color:var(--text3);font-family:'Geist Mono',monospace")}>{v.favTotal}</span></>)}
        </button>
        <button onClick={v.goUploads} title="Uploads" className="u-hov-active" style={css(`display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:${v.nav.uploads.bg};color:${v.nav.uploads.color};cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden`)}>
          <svg width="15" height="15" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15" /></svg>
          {v.expanded && (<><span style={css('flex:1')}>Uploads</span><span style={css("font-size:11.5px;color:var(--text3);font-family:'Geist Mono',monospace")}>{v.upTotal}</span></>)}
        </button>

        {v.expanded && (
          <div style={css('display:flex;align-items:center;height:28px;padding:0 4px 0 8px;margin-top:18px')}>
            <button onClick={v.toggleProjects} className="u-hov-text" style={css('flex:1;display:flex;align-items:center;gap:6px;height:24px;padding:0;border:0;background:transparent;color:var(--text3);font-size:12px;font-weight:500;cursor:pointer;text-align:left')}>
              <span>Projects</span>
              <svg width="12" height="12" viewBox="0 0 24 24" style={css(`fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transform:rotate(${v.projectsChevron}deg);transition:transform .15s`)}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <button onClick={v.openNewProject} title="New project" className="u-hov-active-text" style={css('width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:0;border-radius:5px;background:transparent;color:var(--text3);cursor:pointer')}>
              <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round')}><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        )}
        {v.collapsed && <div style={css('height:1px;margin:14px 6px 8px;background:var(--border)')} />}
        {v.showProjects && (
          <div style={css('display:flex;flex-direction:column;gap:1px')}>
            {v.projectItems.map((p: any, idx: number) => (
              <div key={idx} draggable onDragStart={p.onDragStart} onDragEnd={p.onDragEnd} onDragOver={p.onDragOver} onDragLeave={p.onDragLeave} onDrop={p.onDrop} onMouseEnter={p.onEnter} onMouseLeave={p.onLeave} onContextMenu={p.onCtx} style={css(`position:relative;border-radius:6px;outline:${p.dropOutline};outline-offset:-1px;opacity:${p.op}`)}>
                {p.lineTop && <div style={css('position:absolute;left:6px;right:6px;top:-1px;height:2px;border-radius:1px;background:var(--accent-fg);pointer-events:none;z-index:2')} />}
                {p.lineBottom && <div style={css('position:absolute;left:6px;right:6px;bottom:-1px;height:2px;border-radius:1px;background:var(--accent-fg);pointer-events:none;z-index:2')} />}
                <button onClick={p.onClick} title={p.name} className="u-hov-active" style={css(`width:100%;display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:${p.bg};color:${p.color};cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden`)}>
                  {p.emoji ? <span style={css('width:15px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1')}>{p.emoji}</span>
                    : <svg width="15" height="15" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linejoin:round;flex-shrink:0')}><path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></svg>}
                  {p.expanded && (<><span style={css('flex:1;overflow:hidden;text-overflow:ellipsis')}>{p.name}</span>{p.showCount && <span style={css('flex-shrink:0;font-size:12px;color:var(--text3);font-variant-numeric:tabular-nums')}>{p.count}</span>}<span style={{ width: p.padR, flexShrink: 0 }} /></>)}
                </button>
                {p.showMore && (
                  <button onClick={p.onMore} title="Project options" className="u-hov-text" style={css('position:absolute;right:4px;top:4px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:0;border-radius:5px;background:var(--active);color:var(--text2);cursor:pointer')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:currentColor')}><circle cx="5.5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18.5" cy="12" r="1.6" /></svg>
                  </button>
                )}
                {p.menuOpen && (
                  <div ref={this.popRef} style={css(`position:fixed;left:${v.pp.left};top:${v.pp.top};max-height:${v.pp.maxH};visibility:${v.pp.vis};overflow-y:auto;box-sizing:border-box;z-index:50;width:170px;background:var(--raised);border:1px solid var(--border2);border-radius:10px;box-shadow:var(--shadow);padding:5px;display:flex;flex-direction:column`)}>
                    <button onClick={p.onRename} className="u-hov-active" style={css('display:flex;align-items:center;height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text);cursor:pointer;text-align:left')}>Edit name &amp; emoji</button>
                    <button onClick={p.onDelete} className="u-hov-active" style={css('display:flex;align-items:center;height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--danger);cursor:pointer;text-align:left')}>Delete project</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={css('flex:1')} />

        {v.noKey && (
          <button onClick={v.openKey} title="Connect API key" className="u-hov-border3" style={css('display:flex;align-items:center;gap:10px;height:32px;padding:0 7px;border:1px solid var(--border2);border-radius:7px;background:var(--raised);color:var(--text);cursor:pointer;text-align:left;margin-bottom:6px;white-space:nowrap;overflow:hidden')}>
            <svg width="15" height="15" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><circle cx="7.5" cy="15.5" r="4" /><path d="M10.5 12.5L20 3M15.5 7.5l3 3M18 5l2 2" /></svg>
            {v.expanded && <span style={css('flex:1')}>Connect API key</span>}
          </button>
        )}
        {v.hasKey && (
          <button onClick={v.openKey} title={v.keyChip.label} className="u-hov-active-text" style={css('display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text2);cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden')}>
            <span style={css('width:15px;flex-shrink:0;display:flex;justify-content:center')}><span style={{ width: 7, height: 7, borderRadius: '50%', background: v.keyChip.dot }} /></span>
            {v.expanded && (<><span style={css('flex:1;overflow:hidden;text-overflow:ellipsis')}>{v.keyChip.label}</span><span style={css("font-family:'Geist Mono',monospace;font-size:11px;color:var(--text3)")}>{v.keyChip.meta}</span></>)}
          </button>
        )}
        <div style={css('display:flex;align-items:center;gap:2px')}>
          <button onClick={v.goSettings} title="Settings" className="u-hov-active" style={css(`flex:1;display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:${v.nav.settings.bg};color:${v.nav.settings.color};cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden`)}>
            <svg width="15" height="15" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.820-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.830l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            {v.expanded && <span>Settings</span>}
          </button>
          {v.expanded && (
            <button onClick={v.toggleTheme} title="Toggle theme" className="u-hov-active-text" style={css('width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--text3);cursor:pointer')}>
              {v.isDark && <svg width="15" height="15" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round')}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></svg>}
              {v.isLight && <svg width="15" height="15" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linejoin:round')}><path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z" /></svg>}
            </button>
          )}
        </div>
      </aside>
    );
  }

  // ── Render: header + net banner ─────────────────────────────────────────
  renderHeader(v: AnyState) {
    return (
      <>
        <header style={css('height:46px;flex-shrink:0;display:flex;align-items:center;gap:8px;padding:0 12px 0 18px;border-bottom:1px solid var(--border)')}>
          {v.crumbParent && (<><span style={{ color: 'var(--text3)' }}>{v.crumbParent}</span><svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:var(--text3);stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M9 6l6 6-6 6" /></svg></>)}
          <span style={css('font-weight:500')}>{v.crumb}</span>
          <div style={css('flex:1')} />
          <span style={css('font-size:12px;color:var(--text3);white-space:nowrap')}>{v.headerMeta}</span>
          {v.projLink && <button onClick={v.projLink.onClick} className="u-hov-surface-text" style={css('height:28px;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text2);font-size:12.5px;cursor:pointer')}>{v.projLink.label}</button>}
          {v.showClear && <button onClick={v.clearSession} title="Clear this session. Everything stays in Assets. You can undo." className="u-hov-surface-text" style={css('height:28px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:var(--text3);font-size:12.5px;cursor:pointer')}>Clear</button>}
          <button onClick={v.openShortcuts} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" className="u-hov-surface-text" style={css("width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:0;border-radius:7px;background:transparent;color:var(--text3);font-family:'Geist Mono',monospace;font-size:12.5px;cursor:pointer;padding:0")}>?</button>
        </header>
        {v.netBanner && (
          <div role="status" style={css(`flex-shrink:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 12px 8px 18px;border-bottom:1px solid var(--border);background:${v.netBanner.bg};font-size:12.5px;color:var(--text)`)}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: v.netBanner.dot }} />
            <span style={css('font-weight:500')}>{v.netBanner.title}</span>
            <span style={css('flex:1;min-width:200px;color:var(--text2);text-wrap:pretty')}>{v.netBanner.text}</span>
            {v.netBanner.action && <button onClick={v.netBanner.onAction} className="u-hov-surface" style={css('height:26px;padding:0 10px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);font:inherit;cursor:pointer')}>{v.netBanner.action}</button>}
          </div>
        )}
      </>
    );
  }

  // ── Render: a single media tile (feed row or grid) ──────────────────────
  renderTile(t: AnyState) {
    return (
      <div key={t.id} draggable onDragStart={t.onDragStart} onDragEnd={t.onDragEnd} onMouseEnter={t.onEnter} onMouseLeave={t.onLeave} onContextMenu={t.onCtx} style={css(`position:relative;aspect-ratio:${t.ar};border-radius:8px;outline:${t.outline};outline-offset:2px`)}>
        {t.pulse}
        <div onClick={t.onOpen} style={css(`position:absolute;inset:0;border-radius:8px;overflow:hidden;background:var(--hover);cursor:${t.cursor}`)}>
          <img src={t.src} onLoad={t.onLoad} alt="" loading="lazy" draggable={false} style={css(`width:100%;height:100%;object-fit:cover;display:block;opacity:${t.imgOpacity};filter:blur(${t.blur}px);transform:scale(${t.scale});transition:opacity .45s ease,filter .6s ease,transform .6s ease`)} />
          {t.isVideo && (
            <div style={css("position:absolute;left:8px;bottom:8px;display:flex;align-items:center;gap:5px;height:20px;padding:0 7px;border-radius:5px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;font-family:'Geist Mono',monospace;backdrop-filter:blur(6px)")}>
              <svg width="9" height="9" viewBox="0 0 24 24" style={css('fill:#fff')}><path d="M7 4v16l13-8z" /></svg>
              <span>{t.dur}</span>
            </div>
          )}
          {t.selectable && (
            <div style={css(`position:absolute;top:8px;left:8px;width:20px;height:20px;box-sizing:border-box;border-radius:50%;border:1.5px solid ${t.checkBorder};background:${t.checkBg};display:flex;align-items:center;justify-content:center`)}>
              {t.selected && <svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:var(--on-accent);stroke-width:3;stroke-linecap:round;stroke-linejoin:round')}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
            </div>
          )}
        </div>
        {t.showRow && (
          <div style={css('position:absolute;top:8px;right:8px;display:flex;gap:4px')}>
            <button onClick={t.onFav} title="Favorite" style={css('width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:rgba(0,0,0,.5);cursor:pointer;backdrop-filter:blur(6px)')}>
              <svg width="14" height="14" viewBox="0 0 24 24" style={css(`fill:${t.favFill};stroke:${t.favStroke};stroke-width:1.75;stroke-linejoin:round`)}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>
            </button>
            {t.showAll && (
              <>
                <button onClick={t.onDelete} title="Delete" style={css('width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;backdrop-filter:blur(6px)')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M4 6.5h16M9 6.5V4.5h6v2M6.5 6.5l1 13h9l1-13" /></svg>
                </button>
                <button onClick={t.onMore} title="More" style={css('width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;backdrop-filter:blur(6px)')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:currentColor')}><circle cx="5.5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18.5" cy="12" r="1.6" /></svg>
                </button>
              </>
            )}
          </div>
        )}
        {t.menuOpen && (
          <div ref={this.popRef} style={css(`position:fixed;left:${this.state.popXY?.left ?? 0}px;top:${this.state.popXY?.top ?? 0}px;max-height:${this.state.popXY?.maxH ?? 0}px;visibility:${this.state.popXY ? 'visible' : 'hidden'};overflow-y:auto;box-sizing:border-box;z-index:50;width:210px;background:var(--raised);border:1px solid var(--border2);border-radius:10px;box-shadow:var(--shadow);padding:5px;color:var(--text)`)}>
            {t.menu.map((i: any, idx: number) => (
              <React.Fragment key={idx}>
                {i.sep && <div style={css('height:1px;margin:4px 6px;background:var(--border)')} />}
                {i.head && <div style={css('padding:6px 8px 4px;font-size:11.5px;color:var(--text3)')}>{i.label}</div>}
                {i.btn && (
                  <button onClick={i.onClick} className="u-hov-active" style={css('width:100%;display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text);cursor:pointer;text-align:left')}>
                    <span style={css('flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{i.label}</span>
                    {i.check && <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:var(--accent-fg);stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round')}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                    {i.arrow && <svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:var(--text3);stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M9 6l6 6-6 6" /></svg>}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Create view ─────────────────────────────────────────────────
  renderCreate(v: AnyState) {
    return (
      <div onDragEnter={v.onDragEnter} onDragOver={v.onDragOver} onDragLeave={v.onDragLeave} onDrop={v.onDrop} style={css('flex:1;min-height:0;position:relative;display:flex;flex-direction:column')}>
        {v.hasFeed && (
          <div ref={this.feedRef} onScroll={v.onFeedScroll} style={css('flex:1;overflow-y:auto')}>
            <div style={css('max-width:900px;margin:0 auto;padding:8px 28px 300px;display:flex;flex-direction:column;gap:40px')}>
              {v.feedDays.map((d: any) => (
                <div key={d.key} style={css('display:flex;flex-direction:column;gap:40px')}>
                  <div style={css('position:sticky;top:0;z-index:3;margin:0 -28px -24px;padding:14px 28px 10px;background:var(--panel);font-size:12px;font-weight:500;color:var(--text2)')}>{d.label}</div>
                  {d.rows.map((g: any) => (
                    <div key={g.id} style={css('display:flex;flex-direction:column;gap:12px')}>
                      <div style={css('display:flex;flex-direction:column;gap:5px')}>
                        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text)', textWrap: 'pretty' as any, maxWidth: 680, display: '-webkit-box' as any, WebkitBoxOrient: 'vertical' as any, WebkitLineClamp: g.clamp as any, overflow: 'hidden' }}>{g.prompt}</div>
                        {g.long && (
                          <button onClick={g.onToggle} aria-expanded={g.expanded} className="u-hov-surface-text" style={css('align-self:flex-start;display:flex;align-items:center;gap:4px;height:20px;padding:0 6px;margin:-2px 0 0 -6px;border:0;border-radius:5px;background:transparent;color:var(--text2);font:inherit;font-size:12px;cursor:pointer')}>
                            <span>{g.toggleLabel}</span>
                            <svg width="11" height="11" viewBox="0 0 24 24" style={css(`fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transform:rotate(${g.chevron}deg)`)}><path d="M6 9l6 6 6-6" /></svg>
                          </button>
                        )}
                        <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;color:var(--text3)')}>
                          <span>{g.meta}</span>
                          {g.project && (<span style={css('display:flex;align-items:center;gap:5px;white-space:nowrap')}><svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linejoin:round')}><path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></svg><span>{g.project}</span></span>)}
                          <span style={css(`white-space:nowrap;color:${g.timeColor}`)}>{g.time}</span>
                          {g.isPending && (
                            <button onClick={g.onCancel} title="Cancel generation" className="u-hov-danger" style={css('display:flex;align-items:center;gap:4px;height:20px;padding:0 6px;margin-left:-2px;border:0;border-radius:5px;background:transparent;color:var(--text3);font:inherit;cursor:pointer')}>
                              <svg width="11" height="11" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round')}><path d="M18 6L6 18M6 6l12 12" /></svg>
                              <span>Cancel</span>
                            </button>
                          )}
                          <button onClick={g.onCopy} title="Copy prompt" className="u-hov-surface-text" style={css(`display:flex;align-items:center;gap:4px;height:20px;padding:0 6px;margin-left:-2px;border:0;border-radius:5px;background:transparent;color:${g.copyColor};font:inherit;cursor:pointer`)}>
                            {g.copied && <svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round')}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                            {g.notCopied && <svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linejoin:round')}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></svg>}
                            <span>{g.copyLabel}</span>
                          </button>
                        </div>
                      </div>
                      <div style={css(`display:grid;grid-template-columns:${g.cols};gap:6px;max-width:${g.maxW}`)}>
                        {g.isFailed && (
                          <div role="alert" style={css('display:flex;gap:12px;padding:14px 14px 14px 16px;border:1px solid color-mix(in srgb, var(--danger) 30%, var(--border));border-radius:10px;background:color-mix(in srgb, var(--danger) 6%, var(--panel))')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" style={css('flex-shrink:0;margin-top:1px;fill:none;stroke:var(--danger);stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></svg>
                            <div style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:3px')}>
                              <span style={css('font-weight:500;color:var(--text)')}>{g.errTitle}</span>
                              <span style={css('font-size:12.5px;line-height:1.5;color:var(--text2);text-wrap:pretty')}>{g.errDetail}</span>
                              <div style={css('display:flex;flex-wrap:wrap;gap:6px;margin-top:10px')}>
                                <button onClick={g.onRetry} style={css('display:flex;align-items:center;gap:6px;height:28px;padding:0 11px;border:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font:inherit;font-weight:500;cursor:pointer')}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round')}><path d="M20 12a8 8 0 1 1-2.3-5.6L20 8.5M20 4v4.5h-4.5" /></svg>
                                  <span>Retry</span>
                                </button>
                                <button onClick={g.onEdit} className="u-hov-surface" style={css('height:28px;padding:0 11px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);font:inherit;cursor:pointer')}>Edit prompt</button>
                                <button onClick={g.onDismiss} className="u-hov-surface-text" style={css('height:28px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:var(--text3);font:inherit;cursor:pointer')}>Dismiss</button>
                              </div>
                            </div>
                          </div>
                        )}
                        {g.placeholders.map((ph: any, i: number) => (
                          <div key={i} style={css(`position:relative;aspect-ratio:${ph.ar};border-radius:8px;overflow:hidden;background:var(--hover);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--text3)`)}>
                            {ph.spin}
                            <div style={css("display:flex;flex-direction:column;align-items:center;gap:3px;font-family:'Geist Mono',monospace")}>
                              <span style={css('font-size:13px;color:var(--text)')}>{ph.pctLabel}</span>
                              <span style={css('font-size:11px;color:var(--text3)')}>{ph.elapsed}</span>
                            </div>
                            <div style={css('position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--border)')}>{ph.bar}</div>
                          </div>
                        ))}
                        {g.tiles.map((t: any) => this.renderTile(t))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={css(`position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:${v.dock.justify};padding:${v.dock.pad};box-sizing:border-box`)}>
          {v.showWalkStrip && (
            <div style={css('pointer-events:auto;width:calc(100% - 48px);max-width:760px;box-sizing:border-box;margin-bottom:-36px;position:relative;z-index:1;display:flex;align-items:center;gap:10px;height:40px;padding:0 6px 0 12px;border:1px solid var(--border2);border-radius:10px;background:var(--panel);white-space:nowrap;overflow:hidden')}>
              <span style={css('font-weight:500')}>{v.walkTitle}</span>
              <span style={css("font-family:'Geist Mono',monospace;font-size:11.5px;color:var(--text3)")}>{v.walkCount}</span>
              {v.walkNotDone && <span style={css('flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--text2)')}>Next: {v.walkNext.title}</span>}
              {v.walkAllDone && <span style={css('flex:1')} />}
              {v.walkNext.busy && <span style={css('display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2)')}><span style={css('width:10px;height:10px;border:1.5px solid var(--border2);border-top-color:var(--accent-fg);border-radius:50%;animation:spin .8s linear infinite')} />{v.walkNext.busy}</span>}
              {v.walkNext.cta && <button onClick={v.walkNext.onCta} style={css('flex-shrink:0;height:26px;padding:0 10px;border:0;border-radius:6px;background:var(--accent);color:var(--on-accent);font-weight:500;font-size:12px;cursor:pointer;white-space:nowrap')}>{v.walkNext.cta}</button>}
              <button onClick={v.dismissWalk} className="u-hov-surface-text" style={css('flex-shrink:0;height:26px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text3);cursor:pointer;font-size:12px')}>{v.walkDismissLabel}</button>
            </div>
          )}
          {v.showWalkFull && (
            <div style={css('pointer-events:auto;width:100%;max-width:760px;box-sizing:border-box;margin-bottom:24px;border:1px solid var(--border2);border-radius:12px;background:var(--panel);padding:14px;display:flex;flex-direction:column;gap:12px')}>
              <div style={css('display:flex;align-items:center;gap:10px;padding:0 2px')}>
                <span style={css('font-weight:500')}>{v.walkTitle}</span>
                <span style={css("font-family:'Geist Mono',monospace;font-size:11.5px;color:var(--text3)")}>{v.walkCount}</span>
                <span style={css('flex:1')} />
                {v.walkAllDone && <button onClick={v.dismissWalk} style={css('height:28px;padding:0 12px;border:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font-weight:500;cursor:pointer')}>Done</button>}
                {v.walkNotDone && <button onClick={v.dismissWalk} title="Skip walkthrough" className="u-hov-surface-text" style={css('height:26px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text3);cursor:pointer;font-size:12px')}>Skip</button>}
              </div>
              <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px')}>
                {v.walkSteps.map((st: any) => (
                  <div key={st.n} style={css(`display:flex;gap:10px;padding:12px;border-radius:9px;border:1px solid ${st.border};background:${st.bg};min-width:0`)}>
                    <span style={css(`flex-shrink:0;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-family:'Geist Mono',monospace;background:${st.dotBg};color:${st.dotColor}`)}>
                      {st.done ? <svg width="11" height="11" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round')}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : st.n}
                    </span>
                    <div style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:3px')}>
                      <span style={{ fontWeight: 500, color: st.color }}>{st.title}</span>
                      <span style={css('font-size:12px;color:var(--text3);line-height:1.45;text-wrap:pretty')}>{st.text}</span>
                      {st.cta && <button onClick={st.onCta} style={css('align-self:flex-start;margin-top:6px;height:26px;padding:0 10px;border:0;border-radius:6px;background:var(--accent);color:var(--on-accent);font-weight:500;font-size:12px;cursor:pointer;white-space:nowrap')}>{st.cta}</button>}
                      {st.busy && <span style={css('margin-top:6px;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2)')}><span style={css('width:10px;height:10px;border:1.5px solid var(--border2);border-top-color:var(--accent-fg);border-radius:50%;animation:spin .8s linear infinite')} />{st.busy}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {v.feedEmpty && (
            <>
              <div style={css('display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:16px;text-align:center')}>
                <div style={css('font-size:22px;font-weight:500;letter-spacing:-0.015em')}>{v.emptyTitle}</div>
                <div style={{ color: 'var(--text3)' }}>Paste or drop images anywhere to use them as references.</div>
              </div>
              <div style={css('pointer-events:auto;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;max-width:760px;margin-bottom:16px')}>
                {v.samples.map((sp: any, i: number) => (
                  <button key={i} onClick={sp.insert} title={sp.prompt} className="u-hov-surface-text u-hov-border3" style={css('display:flex;align-items:center;gap:6px;height:28px;padding:0 11px;border:1px solid var(--border2);border-radius:999px;background:transparent;color:var(--text2);cursor:pointer;font-size:12.5px;white-space:nowrap')}>
                    <svg width="11" height="11" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M12 5v14M5 12h14" /></svg>{sp.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div style={css(`width:100%;box-sizing:border-box;display:flex;justify-content:center;padding:${v.dock.innerPad};background:${v.dock.bg}`)}>
            <div style={css('pointer-events:auto;width:100%;max-width:760px;background:var(--raised);border:1px solid var(--border2);border-radius:14px;box-shadow:var(--shadow);position:relative')}>
              {v.hasRefs && (
                <div style={css('padding:10px 12px 8px;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid var(--border)')}>
                  <div style={css('display:flex;justify-content:space-between;font-size:11.5px;color:var(--text3)')}>
                    <span>References</span><span style={css("font-family:'Geist Mono',monospace")}>{v.refCount}</span>
                  </div>
                  <div style={css('display:flex;gap:6px;overflow-x:auto;padding:5px 5px 0 0')}>
                    {v.refChips.map((r: any) => (
                      <div key={r.id} style={css('flex-shrink:0;position:relative;height:52px')}>
                        {r.isImage && <div style={css(`width:52px;height:52px;border-radius:8px;background-image:${r.bg};background-size:cover;background-position:center`)} />}
                        {r.isVideo && (
                          <div style={css('position:relative;width:52px;height:52px;border-radius:8px;overflow:hidden;background:#000')}>
                            <video src={r.thumb} preload="metadata" muted playsInline style={css('width:100%;height:100%;object-fit:cover;display:block')} />
                            <svg width="10" height="10" viewBox="0 0 24 24" style={css('position:absolute;left:5px;bottom:5px;fill:#fff')}><path d="M7 4v16l13-8z" /></svg>
                          </div>
                        )}
                        {r.isAudio && (
                          <div style={css('width:116px;height:52px;box-sizing:border-box;padding:0 10px;display:flex;align-items:center;gap:8px;border:1px solid var(--border2);border-radius:8px;background:var(--hover);color:var(--text2)')}>
                            <svg width="14" height="14" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                            <span style={css('font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{r.name}</span>
                          </div>
                        )}
                        {r.tag && <span title={r.tagTip} style={css('position:absolute;left:4px;bottom:4px;font-size:9.5px;padding:1px 4px;border-radius:3px;background:rgba(0,0,0,.6);color:#fff;cursor:help')}>{r.tag}</span>}
                        {r.uploading && <div title="Uploading…" style={css('position:absolute;inset:0;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);color:#fff')}>{this.spinner()}</div>}
                        <button onClick={r.onRemove} title="Remove" style={css('position:absolute;top:-5px;right:-5px;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border2);border-radius:50%;background:var(--raised);color:var(--text2);cursor:pointer;padding:0')}>
                          <svg width="8" height="8" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round')}><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={css('position:relative')}>
                <textarea ref={this.promptRef} value={v.prompt} onChange={v.onPrompt} onKeyDown={v.onPromptKey} placeholder={v.placeholder} rows={2} style={css('display:block;width:100%;box-sizing:border-box;resize:none;border:0;background:transparent;padding:14px 44px 6px 16px;font-size:14px;line-height:1.5;color:var(--text);min-height:62px;max-height:240px;overflow-y:auto')} />
                <button onClick={v.openEditor} title="Expand editor" className="u-hov-surface-text" style={css('position:absolute;top:10px;right:10px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--text3);cursor:pointer;padding:0')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round')}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                </button>
              </div>
              {v.negOn && (
                <div style={css('display:flex;align-items:flex-start;gap:8px;margin:2px 10px 0;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--hover)')}>
                  <span style={css('flex-shrink:0;font-size:12px;line-height:20px;color:var(--text3)')}>Avoid</span>
                  <textarea value={v.negPrompt} onChange={v.onNeg} placeholder="blur, extra fingers, watermark, text…" rows={1} style={{ ...css('flex:1;min-width:0;display:block;resize:none;border:0;background:transparent;padding:0;font-size:13px;line-height:20px;color:var(--text);max-height:100px;overflow-y:auto'), fieldSizing: 'content' } as any} />
                  <button onClick={v.toggleNeg} title="Remove negative prompt" className="u-hov-active-text" style={css('flex-shrink:0;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:0;border-radius:5px;background:transparent;color:var(--text3);cursor:pointer;padding:0')}>
                    <svg width="10" height="10" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round')}><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              <div style={css('display:flex;align-items:center;gap:6px;padding:8px 10px 10px')}>
                <div style={css('position:relative')}>
                  <button onClick={v.attach} title={v.attachTitle} className="u-hov-surface-text" style={css('width:30px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text2);cursor:pointer')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" /></svg>
                  </button>
                  {v.pop.attach && (
                    <div ref={this.popRef} style={css(`position:fixed;left:${v.pp.left};top:${v.pp.top};max-height:${v.pp.maxH};visibility:${v.pp.vis};overflow-y:auto;box-sizing:border-box;z-index:50;width:220px;background:var(--raised);border:1px solid var(--border2);border-radius:10px;box-shadow:var(--shadow);padding:5px`)}>
                      {v.attachItems.map((a: any, i: number) => (
                        <button key={i} onClick={a.onClick} disabled={a.full} className="u-hov-active" style={css(`width:100%;display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text);cursor:pointer;text-align:left;opacity:${a.opacity}`)}>
                          <span style={css('flex:1')}>{a.label}</span><span style={css("font-size:11.5px;color:var(--text3);font-family:'Geist Mono',monospace")}>{a.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {v.negSupported && (
                  <button onClick={v.toggleNeg} title={v.negTitle} className="u-hov-surface-text" style={css(`width:30px;height:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px solid ${v.negBtn.border};border-radius:7px;background:${v.negBtn.bg};color:${v.negBtn.color};cursor:pointer`)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round')}><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></svg>
                  </button>
                )}
                <div style={css('display:flex;flex-shrink:0;gap:2px;padding:2px;border-radius:8px;background:var(--hover);border:1px solid var(--border)')}>
                  <button onClick={v.setImage} style={css(`display:flex;align-items:center;gap:6px;height:24px;padding:0 9px;border:0;border-radius:6px;background:${v.modeSeg.image.bg};color:${v.modeSeg.image.color};box-shadow:${v.modeSeg.image.shadow};font-size:12.5px;cursor:pointer`)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.8" /><path d="M21 15l-5-5L5 21" /></svg>
                    <span>Image</span>
                  </button>
                  <button onClick={v.setVideo} style={css(`display:flex;align-items:center;gap:6px;height:24px;padding:0 9px;border:0;border-radius:6px;background:${v.modeSeg.video.bg};color:${v.modeSeg.video.color};box-shadow:${v.modeSeg.video.shadow};font-size:12.5px;cursor:pointer`)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="M15.5 10.5l6-3v9l-6-3z" /></svg>
                    <span>Video</span>
                  </button>
                </div>
                <div ref={this.pillsRef} style={css('flex:1 1 0;min-width:0;display:flex;flex-wrap:nowrap;align-items:center;gap:6px')}>
                  {v.pills.map((p: any) => (
                    <div key={p.key} style={css('position:relative')}>
                      <button onClick={p.onToggle} title={p.tip} className="u-hov-active-text" style={css(`display:flex;align-items:center;gap:6px;height:28px;padding:${p.pad};border:0;border-radius:14px;flex-shrink:0;background:${p.bg};color:${p.color};font-size:12.5px;cursor:pointer;white-space:nowrap`)}>
                        {p.ic.model && <svg width="13" height="13" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></svg>}
                        {p.ic.ratio && <span style={css('width:13px;height:13px;flex-shrink:0;display:flex;align-items:center;justify-content:center')}><span style={{ width: p.w, height: p.h, border: '1.5px solid currentColor', borderRadius: 2, boxSizing: 'border-box' }} /></span>}
                        {p.ic.dur && <svg width="13" height="13" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>}
                        {p.ic.res && <svg width="13" height="13" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>}
                        {p.ic.batch && <svg width="13" height="13" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>}
                        {p.ic.audio && <svg width="13" height="13" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>}
                        {p.ic.mute && <svg width="13" height="13" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></svg>}
                        {p.full && (<><span>{p.value}</span><svg width="10" height="10" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round;opacity:.6')}><path d="M6 9l6 6 6-6" /></svg></>)}
                      </button>
                      {p.open && (
                        <div ref={this.popRef} style={css(`position:fixed;left:${v.pp.left};top:${v.pp.top};max-height:${v.pp.maxH};visibility:${v.pp.vis};overflow-y:auto;box-sizing:border-box;z-index:50;width:${p.menuW}px;background:var(--raised);border:1px solid var(--border2);border-radius:10px;box-shadow:var(--shadow);padding:5px;display:flex;flex-direction:column;gap:2px`)}>
                          <span style={css('font-size:11.5px;color:var(--text3);padding:5px 8px 4px')}>{p.title}</span>
                          {p.items.map((o: any, i: number) => (
                            <button key={i} onClick={o.onClick} className="u-hov-active" style={css(`width:100%;display:flex;align-items:center;gap:10px;min-height:30px;padding:6px 8px;border:0;border-radius:6px;background:${o.bg};color:var(--text);cursor:pointer;text-align:left;box-sizing:border-box`)}>
                              {o.shape && <span style={css('width:16px;height:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--text2)')}><span style={{ width: o.w, height: o.h, border: '1.5px solid currentColor', borderRadius: 2, boxSizing: 'border-box' }} /></span>}
                              <span style={css('flex:1;display:flex;flex-direction:column;gap:3px;min-width:0')}>
                                <span style={css('line-height:1.25')}>{o.label}</span>
                                {o.desc && <span style={css('font-size:11.5px;line-height:1.35;color:var(--text3)')}>{o.desc}</span>}
                              </span>
                              {o.check && <svg width="14" height="14" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:var(--accent-fg);stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round')}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {v.gen.hint && <span style={css("font-size:11.5px;color:var(--text3);font-family:'Geist Mono',monospace;white-space:nowrap;flex-shrink:0;margin-left:4px")}>⌘↵</span>}
                {v.gen.reasonText && <span style={css('font-size:12px;color:var(--text3);white-space:nowrap;flex-shrink:0;margin-left:4px')}>{v.gen.reason}</span>}
                {v.gen.reasonAction && (
                  <button onClick={v.gen.onReason} className="u-hov-surface" style={css('display:flex;align-items:center;gap:4px;height:26px;padding:0 6px;margin-left:2px;border:0;border-radius:6px;background:transparent;color:var(--accent-fg);font:inherit;font-size:12px;white-space:nowrap;flex-shrink:0;cursor:pointer')}>
                    <span>{v.gen.reason}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round')}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </button>
                )}
                <button onClick={v.generate} disabled={v.gen.disabled} title={v.gen.title} style={css(`display:flex;align-items:center;gap:7px;height:30px;padding:0 13px;border:0;border-radius:8px;background:${v.gen.bg};color:${v.gen.color};font-weight:500;cursor:${v.gen.cursor};white-space:nowrap;flex-shrink:0;transition:background .15s ease,color .15s ease`)}>Generate</button>
              </div>
            </div>
          </div>
        </div>

        {v.dragging && (
          <div style={css('position:absolute;inset:10px;z-index:30;border:1.5px dashed var(--accent-fg);border-radius:10px;background:var(--overlay);display:flex;align-items:center;justify-content:center;pointer-events:none')}>
            <div style={css('display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 18px;border-radius:9px;background:var(--raised);border:1px solid var(--border2);text-align:center')}>
              <span style={css('font-weight:500;color:var(--text)')}>{v.dropTitle}</span>
              <span style={css('font-size:12px;color:var(--text3)')}>{v.dropSub}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Assets / Favorites grid ─────────────────────────────────────
  renderGrid(v: AnyState) {
    return (
      <div onDragEnter={v.onDragEnter} onDragOver={v.onDragOver} onDragLeave={v.onDragLeave} onDrop={v.onGridDrop} style={css('flex:1;display:flex;flex-direction:column;min-height:0;position:relative')}>
        {v.dragging && (
          <div style={css('position:absolute;inset:10px;z-index:30;border:1.5px dashed var(--accent-fg);border-radius:10px;background:var(--overlay);display:flex;align-items:center;justify-content:center;pointer-events:none')}>
            <div style={css('display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 18px;border-radius:9px;background:var(--raised);border:1px solid var(--border2);text-align:center')}>
              <span style={css('font-weight:500;color:var(--text)')}>{v.dropTitle}</span>
              <span style={css('font-size:12px;color:var(--text3)')}>{v.dropSub}</span>
            </div>
          </div>
        )}
        <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:10px 18px;min-height:49px;box-sizing:border-box;border-bottom:1px solid var(--border)')}>
          {v.notSelecting && (
            <>
              {v.isAssets && (
                <>
                  <div style={css('position:relative;display:flex;align-items:center;flex:0 1 240px;min-width:150px')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" style={css('position:absolute;left:9px;pointer-events:none;fill:none;stroke:var(--text3);stroke-width:2;stroke-linecap:round')}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
                    <input ref={this.searchRef} value={v.q} onChange={v.onQ} onKeyDown={v.onQKey} placeholder="Search prompts" aria-label="Search prompts" className="u-hov-border2" style={css(`width:100%;height:28px;box-sizing:border-box;padding:0 28px;border:1px solid var(--border);border-radius:7px;background:${v.qBg};font-size:12.5px`)} />
                    {v.hasQ && <button onClick={v.clearQ} title="Clear search" className="u-hov-active-text" style={css('position:absolute;right:4px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:0;border-radius:5px;background:transparent;color:var(--text3);cursor:pointer')}><svg width="11" height="11" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round')}><path d="M18 6L6 18M6 6l12 12" /></svg></button>}
                    {v.noQ && <span style={css("position:absolute;right:7px;min-width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:4px;font-size:10.5px;font-family:'Geist Mono',monospace;color:var(--text3);pointer-events:none")}>/</span>}
                  </div>
                  <div style={css('display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--hover);border:1px solid var(--border)')}>
                    {v.fTypeOpts.map((o: any, i: number) => (<button key={i} onClick={o.onClick} style={css(`height:24px;padding:0 10px;border:0;border-radius:6px;background:${o.bg};color:${o.color};box-shadow:${o.shadow};font-size:12.5px;cursor:pointer`)}>{o.label}</button>))}
                  </div>
                  {v.filterMenus.map((f: any, i: number) => (
                    <div key={i} style={css('position:relative')}>
                      <button onClick={f.onToggle} className="u-hov-surface-text" style={css(`display:flex;align-items:center;gap:6px;white-space:nowrap;flex-shrink:0;height:28px;padding:0 9px;border:1px solid var(--border);border-radius:7px;background:${f.bg};color:var(--text2);font-size:12.5px;cursor:pointer`)}>
                        <span style={css('color:var(--text3)')}>{f.name}</span><span style={css('color:var(--text)')}>{f.value}</span>
                        <svg width="11" height="11" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                      {f.open && (
                        <div ref={this.popRef} style={css(`position:fixed;left:${v.pp.left};top:${v.pp.top};max-height:${v.pp.maxH};visibility:${v.pp.vis};overflow-y:auto;box-sizing:border-box;z-index:50;min-width:200px;background:var(--raised);border:1px solid var(--border2);border-radius:10px;box-shadow:var(--shadow);padding:5px`)}>
                          {f.items.map((i: any, idx: number) => (
                            <button key={idx} onClick={i.onClick} className="u-hov-active" style={css('width:100%;display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text);cursor:pointer;text-align:left')}>
                              <span style={css('flex:1')}>{i.label}</span>
                              {i.check && <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:var(--accent-fg);stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round')}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {v.filtersActive && <button onClick={v.clearFilters} className="u-hov-text" style={css('height:28px;padding:0 8px;border:0;background:transparent;color:var(--text3);font-size:12.5px;cursor:pointer')}>Clear</button>}
                </>
              )}
              <div style={css('flex:1')} />
              <button onClick={v.startSelect} className="u-hov-surface-text" style={css('display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text2);font-size:12.5px;cursor:pointer')}>
                <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M8 12.5l3 3 5-6" /></svg>
                <span>Select</span>
              </button>
            </>
          )}
          {v.selectMode && (
            <>
              <span style={css('font-weight:500;padding:0 4px')}>{v.selLabel}</span>
              <button onClick={v.selectAll} className="u-hov-surface-text" style={css('height:28px;white-space:nowrap;flex-shrink:0;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--text2);font-size:12.5px;cursor:pointer')}>{v.selectAllLabel}</button>
              <span style={css('font-size:11.5px;color:var(--text3);padding:0 4px')}>Shift-click to select a range</span>
              <div style={css('flex:1')} />
              <div style={css(`display:flex;flex-wrap:wrap;align-items:center;gap:6px;opacity:${v.bulkOp};pointer-events:${v.bulkPe}`)}>
                <button onClick={v.bulkFav} className="u-hov-surface" style={css('display:flex;align-items:center;gap:6px;height:28px;white-space:nowrap;flex-shrink:0;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" style={css(`fill:${v.bulkFavFill};stroke:${v.bulkFavStroke};stroke-width:1.75;stroke-linejoin:round`)}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>
                  <span>{v.bulkFavLabel}</span>
                </button>
                <div style={css('position:relative')}>
                  <button onClick={v.bulkMoveToggle} className="u-hov-surface" style={css(`display:flex;align-items:center;gap:6px;height:28px;white-space:nowrap;flex-shrink:0;padding:0 9px 0 10px;border:1px solid var(--border);border-radius:7px;background:${v.bulkMoveBg};color:var(--text);font-size:12.5px;cursor:pointer`)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></svg>
                    <span>Move to project</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" style={css('fill:none;stroke:var(--text3);stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                  {v.bulkMoveOpen && (
                    <div ref={this.popRef} style={css(`position:fixed;left:${v.pp.left};top:${v.pp.top};max-height:${v.pp.maxH};visibility:${v.pp.vis};overflow-y:auto;box-sizing:border-box;z-index:50;width:220px;background:var(--raised);border:1px solid var(--border2);border-radius:10px;box-shadow:var(--shadow);padding:5px;color:var(--text)`)}>
                      <div style={css('padding:6px 8px 4px;font-size:11.5px;color:var(--text3)')}>{v.bulkMoveHead}</div>
                      {v.bulkMoveItems.map((i: any, idx: number) => (
                        <button key={idx} onClick={i.onClick} className="u-hov-active" style={css('width:100%;display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text);cursor:pointer;text-align:left')}>
                          <span style={css('flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{i.label}</span>
                          {i.check && <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:var(--accent-fg);stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round')}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={v.bulkCopy} title="Copy the prompts of the selected items" className="u-hov-surface" style={css('display:flex;align-items:center;gap:6px;height:28px;white-space:nowrap;flex-shrink:0;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></svg>
                  <span>{v.bulkCopyLabel}</span>
                </button>
                <button onClick={v.bulkRerun} title={v.rerunTitle} className="u-hov-surface" style={css('display:flex;align-items:center;gap:6px;height:28px;white-space:nowrap;flex-shrink:0;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M4.5 12a7.5 7.5 0 0 1 13-5.1L19.5 9M19.5 4.5V9H15M19.5 12a7.5 7.5 0 0 1-13 5.1L4.5 15M4.5 19.5V15H9" /></svg>
                  <span>Rerun</span>
                </button>
                <button onClick={v.bulkZip} title="Download selected as a .zip" className="u-hov-surface" style={css('display:flex;align-items:center;gap:6px;height:28px;white-space:nowrap;flex-shrink:0;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" /></svg>
                  <span>{v.zipLabel}</span>
                </button>
              </div>
              <button onClick={v.deleteSelected} style={css(`display:flex;align-items:center;gap:6px;height:28px;white-space:nowrap;flex-shrink:0;padding:0 11px;border:0;border-radius:7px;background:var(--danger);color:var(--on-danger);font-size:12.5px;font-weight:500;cursor:pointer;opacity:${v.selDelOpacity};pointer-events:${v.bulkPe}`)}>
                <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round')}><path d="M4 6.5h16M9 6.5V4.5h6v2M6.5 6.5l1 13h9l1-13" /></svg>
                <span>Delete</span>
              </button>
              <button onClick={v.endSelect} className="u-hov-surface" style={css('height:28px;white-space:nowrap;flex-shrink:0;padding:0 11px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer')}>Done</button>
            </>
          )}
        </div>
        <div ref={this.gridRef} onScroll={v.onGridScroll} style={css('flex:1;overflow-y:auto;padding:18px 18px 220px')}>
          {v.gridEmpty && (
            <div style={css('padding-top:16vh;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center')}>
              <div style={css('font-size:15px;font-weight:500')}>{v.gridEmptyTitle}</div>
              <div style={{ color: 'var(--text3)' }}>{v.gridEmptyText}</div>
              {v.gridEmptyCreate && (
                <button onClick={v.goCreate} style={css('margin-top:10px;display:flex;align-items:center;gap:7px;height:32px;padding:0 14px;border:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font-weight:500;cursor:pointer')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M12 5v14M5 12h14" /></svg>
                  <span>Start creating</span>
                </button>
              )}
              {v.gridEmptyFiltered && <button onClick={v.clearFilters} className="u-hov-surface" style={css('margin-top:10px;height:32px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>Clear filters</button>}
            </div>
          )}
          <div style={css('display:grid;grid-template-columns:repeat(auto-fill, minmax(190px, 1fr));gap:6px')}>
            {v.gridTiles.map((t: any) => this.renderTile(t))}
            {v.skelTiles.map((k: any, i: number) => (<div key={i} style={css('position:relative;aspect-ratio:1 / 1;border-radius:8px;overflow:hidden;background:var(--hover)')}>{k.el}</div>))}
          </div>
          {v.gridEnd && <div style={css('padding:28px 0 0;text-align:center;font-size:12px;color:var(--text3)')}>{v.gridEndText}</div>}
        </div>
      </div>
    );
  }

  // ── Render: Uploads view ────────────────────────────────────────────────
  renderUploads(v: AnyState) {
    const up = v.up;
    return (
      <div onDragEnter={v.onDragEnter} onDragOver={v.onDragOver} onDragLeave={v.onDragLeave} onDrop={v.onUpDrop} style={css('flex:1;display:flex;flex-direction:column;min-height:0;position:relative')}>
        {v.dragging && (
          <div style={css('position:absolute;inset:10px;z-index:30;border:1.5px dashed var(--accent-fg);border-radius:10px;background:var(--overlay);display:flex;align-items:center;justify-content:center;pointer-events:none')}>
            <div style={css('display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 18px;border-radius:9px;background:var(--raised);border:1px solid var(--border2);text-align:center')}>
              <span style={css('font-weight:500;color:var(--text)')}>{v.dropTitle}</span>
              <span style={css('font-size:12px;color:var(--text3)')}>{v.dropSub}</span>
            </div>
          </div>
        )}
        <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:10px 18px;min-height:49px;box-sizing:border-box;border-bottom:1px solid var(--border)')}>
          {up.notSelecting && (
            <>
              <div style={css('position:relative;display:flex;align-items:center;flex:0 1 240px;min-width:150px')}>
                <svg width="13" height="13" viewBox="0 0 24 24" style={css('position:absolute;left:9px;pointer-events:none;fill:none;stroke:var(--text3);stroke-width:2;stroke-linecap:round')}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
                <input ref={this.searchRef} value={up.q} onChange={up.onQ} onKeyDown={up.onQKey} placeholder="Search file names" aria-label="Search file names" className="u-hov-border2" style={css(`width:100%;height:28px;box-sizing:border-box;padding:0 28px;border:1px solid var(--border);border-radius:7px;background:${up.qBg};font-size:12.5px`)} />
                {up.hasQ && <button onClick={up.clearQ} title="Clear search" className="u-hov-active-text" style={css('position:absolute;right:4px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:0;border-radius:5px;background:transparent;color:var(--text3);cursor:pointer')}><svg width="11" height="11" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round')}><path d="M18 6L6 18M6 6l12 12" /></svg></button>}
                {up.noQ && <span style={css("position:absolute;right:7px;min-width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:4px;font-size:10.5px;font-family:'Geist Mono',monospace;color:var(--text3);pointer-events:none")}>/</span>}
              </div>
              <div style={css('display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--hover);border:1px solid var(--border)')}>
                {up.typeOpts.map((o: any, i: number) => (<button key={i} onClick={o.onClick} style={css(`height:24px;padding:0 10px;border:0;border-radius:6px;background:${o.bg};color:${o.color};box-shadow:${o.shadow};font-size:12.5px;cursor:pointer`)}>{o.label}</button>))}
              </div>
              {up.menus.map((f: any, i: number) => (
                <div key={i} style={css('position:relative')}>
                  <button onClick={f.onToggle} className="u-hov-surface-text" style={css(`display:flex;align-items:center;gap:6px;white-space:nowrap;flex-shrink:0;height:28px;padding:0 9px;border:1px solid var(--border);border-radius:7px;background:${f.bg};color:var(--text2);font-size:12.5px;cursor:pointer`)}>
                    <span style={css('color:var(--text3)')}>{f.name}</span><span style={css('color:var(--text)')}>{f.value}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                  {f.open && (
                    <div ref={this.popRef} style={css(`position:fixed;left:${v.pp.left};top:${v.pp.top};max-height:${v.pp.maxH};visibility:${v.pp.vis};overflow-y:auto;box-sizing:border-box;z-index:50;min-width:200px;background:var(--raised);border:1px solid var(--border2);border-radius:10px;box-shadow:var(--shadow);padding:5px`)}>
                      {f.items.map((i: any, idx: number) => (
                        <button key={idx} onClick={i.onClick} className="u-hov-active" style={css('width:100%;display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text);cursor:pointer;text-align:left')}>
                          <span style={css('flex:1')}>{i.label}</span>
                          {i.check && <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:var(--accent-fg);stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round')}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {up.filtersActive && <button onClick={up.clearFilters} className="u-hov-text" style={css('height:28px;padding:0 8px;border:0;background:transparent;color:var(--text3);font-size:12.5px;cursor:pointer')}>Clear</button>}
              <div style={css('flex:1')} />
              <div style={css('position:relative')}>
                <button onClick={up.cleanToggle} title="Find files to delete" className="u-hov-surface-text" style={css(`display:flex;align-items:center;gap:6px;height:28px;white-space:nowrap;padding:0 9px 0 10px;border:1px solid var(--border);border-radius:7px;background:${up.cleanBg};color:var(--text2);font-size:12.5px;cursor:pointer`)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round')}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
                  <span>Clean up</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" style={css('fill:none;stroke:var(--text3);stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {up.cleanOpen && (
                  <div ref={this.popRef} style={css(`position:fixed;left:${v.pp.left};top:${v.pp.top};max-height:${v.pp.maxH};visibility:${v.pp.vis};overflow-y:auto;box-sizing:border-box;z-index:50;width:290px;background:var(--raised);border:1px solid var(--border2);border-radius:10px;box-shadow:var(--shadow);padding:5px;color:var(--text)`)}>
                    <div style={css('padding:6px 8px 4px;font-size:11.5px;color:var(--text3)')}>Select files to review before deleting</div>
                    {up.clean.map((c: any, i: number) => (
                      <button key={i} onClick={c.onClick} className="u-hov-active" style={css(`width:100%;display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text);cursor:pointer;text-align:left;opacity:${c.op};pointer-events:${c.pe}`)}>
                        <span style={css('flex:1;white-space:nowrap')}>{c.label}</span>
                        <span style={css("font-family:'Geist Mono',monospace;font-size:11px;color:var(--text3);white-space:nowrap")}>{c.count}</span>
                      </button>
                    ))}
                    <div style={css('height:1px;margin:4px 6px;background:var(--border)')} />
                    <button onClick={up.delUnused} className="u-hov-active" style={css(`width:100%;display:flex;align-items:center;gap:10px;height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--danger);cursor:pointer;text-align:left;opacity:${up.delUnusedOp};pointer-events:${up.delUnusedPe}`)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M4 6.5h16M9 6.5V4.5h6v2M6.5 6.5l1 13h9l1-13" /></svg>
                      <span style={css('flex:1')}>{up.delUnusedLabel}</span>
                    </button>
                  </div>
                )}
              </div>
              <button onClick={up.startSelect} className="u-hov-surface-text" style={css('display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text2);font-size:12.5px;cursor:pointer')}>
                <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M8 12.5l3 3 5-6" /></svg>
                <span>Select</span>
              </button>
              <button onClick={up.onUpload} style={css('display:flex;align-items:center;gap:6px;height:28px;padding:0 11px;border:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font-size:12.5px;font-weight:500;cursor:pointer')}>
                <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15" /></svg>
                <span>Upload</span>
              </button>
            </>
          )}
          {up.selecting && (
            <>
              <span style={css('font-weight:500;padding:0 4px;white-space:nowrap')}>{up.selLabel}</span>
              <button onClick={up.selectAll} className="u-hov-surface-text" style={css('height:28px;white-space:nowrap;flex-shrink:0;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--text2);font-size:12.5px;cursor:pointer')}>{up.selectAllLabel}</button>
              <span style={css('font-size:11.5px;color:var(--text3);padding:0 4px')}>Shift-click to select a range · Delete key removes</span>
              <div style={css('flex:1')} />
              <div style={css(`display:flex;flex-wrap:wrap;align-items:center;gap:6px;opacity:${up.bulkOp};pointer-events:${up.bulkPe}`)}>
                <button onClick={up.bulkUse} title="Attach the selected files to the composer" className="u-hov-surface" style={css('display:flex;align-items:center;gap:6px;height:28px;white-space:nowrap;flex-shrink:0;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round')}><path d="M12 5v14M5 12h14" /></svg>
                  <span>Use as reference</span>
                </button>
                <button onClick={up.bulkZip} title="Download selected as a .zip" className="u-hov-surface" style={css('display:flex;align-items:center;gap:6px;height:28px;white-space:nowrap;flex-shrink:0;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" /></svg>
                  <span>{up.zipLabel}</span>
                </button>
              </div>
              <button onClick={up.bulkDelete} style={css(`display:flex;align-items:center;gap:6px;height:28px;white-space:nowrap;flex-shrink:0;padding:0 11px;border:0;border-radius:7px;background:var(--danger);color:var(--on-danger);font-size:12.5px;font-weight:500;cursor:pointer;opacity:${up.bulkOp};pointer-events:${up.bulkPe}`)}>
                <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round')}><path d="M4 6.5h16M9 6.5V4.5h6v2M6.5 6.5l1 13h9l1-13" /></svg>
                <span>Delete</span>
              </button>
              <button onClick={up.endSelect} className="u-hov-surface" style={css('height:28px;white-space:nowrap;flex-shrink:0;padding:0 11px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer')}>Done</button>
            </>
          )}
        </div>
        <div style={css('flex:1;overflow-y:auto;padding:18px 18px 120px')}>
          {up.empty && (
            <div style={css('padding-top:16vh;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center')}>
              <div style={css('font-size:15px;font-weight:500')}>{up.emptyTitle}</div>
              <div style={css('color:var(--text3);max-width:380px;text-wrap:pretty')}>{up.emptyText}</div>
              {up.emptyUpload && (
                <button onClick={up.onUpload} style={css('margin-top:10px;display:flex;align-items:center;gap:7px;height:32px;padding:0 14px;border:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font-weight:500;cursor:pointer')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15" /></svg>
                  <span>Upload files</span>
                </button>
              )}
              {up.emptyFiltered && <button onClick={up.clearFilters} className="u-hov-surface" style={css('margin-top:10px;height:32px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>Clear filters</button>}
            </div>
          )}
          <div style={css('display:grid;grid-template-columns:repeat(auto-fill, minmax(170px, 1fr));gap:16px 8px')}>
            {up.tiles.map((t: any) => (
              <div key={t.id} draggable onDragStart={(e: any) => { e.dataTransfer.setData('application/x-studio-upload', t.id); e.dataTransfer.effectAllowed = 'copy'; }} onMouseEnter={t.onEnter} onMouseLeave={t.onLeave} style={css('display:flex;flex-direction:column;gap:7px;min-width:0')}>
                <div onClick={t.onOpen} style={css(`position:relative;aspect-ratio:1 / 1;border-radius:8px;overflow:hidden;background:var(--hover);cursor:${t.cursor};outline:${t.outline};outline-offset:2px`)}>
                  {t.isImage && <img src={t.src} alt="" loading="lazy" draggable={false} style={css(`width:100%;height:100%;object-fit:cover;display:block;opacity:${t.imgOp}`)} />}
                  {t.hasVideoSrc && <video src={t.videoSrc} muted playsInline preload="metadata" style={css(`width:100%;height:100%;object-fit:cover;display:block;opacity:${t.imgOp}`)} />}
                  {t.isAudio && (
                    <div style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text3)')}>
                      <svg width="28" height="28" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round')}><path d="M9 18V5.5l11-2V16" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></svg>
                    </div>
                  )}
                  {t.badge && (
                    <div style={css("position:absolute;left:8px;bottom:8px;display:flex;align-items:center;gap:5px;height:20px;padding:0 7px;border-radius:5px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;font-family:'Geist Mono',monospace;backdrop-filter:blur(6px)")}>
                      {t.isVideo && <svg width="9" height="9" viewBox="0 0 24 24" style={css('fill:#fff')}><path d="M7 4v16l13-8z" /></svg>}
                      <span>{t.dur}</span>
                    </div>
                  )}
                  {t.selectable && (
                    <div style={css(`position:absolute;top:8px;left:8px;width:20px;height:20px;box-sizing:border-box;border-radius:50%;border:1.5px solid ${t.checkBorder};background:${t.checkBg};display:flex;align-items:center;justify-content:center`)}>
                      {t.selected && <svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:var(--on-accent);stroke-width:3;stroke-linecap:round;stroke-linejoin:round')}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                    </div>
                  )}
                  {t.showRow && (
                    <div style={css('position:absolute;top:8px;right:8px;display:flex;gap:4px')}>
                      <button onClick={t.onUse} title="Use as reference" style={css('width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;backdrop-filter:blur(6px)')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round')}><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                      <button onClick={t.onDelete} title="Delete" style={css('width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;backdrop-filter:blur(6px)')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M4 6.5h16M9 6.5V4.5h6v2M6.5 6.5l1 13h9l1-13" /></svg>
                      </button>
                    </div>
                  )}
                </div>
                <div style={css('display:flex;flex-direction:column;gap:2px;min-width:0;padding:0 2px')}>
                  <span title={t.name} style={css('font-size:12.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{t.name}</span>
                  <span style={css('display:flex;gap:6px;font-size:11.5px;color:var(--text3);white-space:nowrap;overflow:hidden')}>
                    <span style={css("font-family:'Geist Mono',monospace")}>{t.size}</span><span>·</span><span style={{ color: t.useColor }}>{t.useLabel}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {up.pv && (
          <div onClick={up.pv.close} style={css('position:fixed;inset:0;z-index:60;background:var(--overlay);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box')}>
            <div onClick={v.stop} role="dialog" aria-label={up.pv.name} style={css('width:100%;max-width:1040px;height:100%;max-height:680px;display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,300px);background:var(--raised);border:1px solid var(--border2);border-radius:12px;box-shadow:var(--shadow);overflow:hidden')}>
              <div style={css('position:relative;min-height:0;background:var(--app);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;overflow:hidden')}>
                {up.pv.isImage && <img src={up.pv.src} alt="" style={css('max-width:100%;max-height:100%;object-fit:contain;display:block;border-radius:4px')} />}
                {up.pv.hasVideoSrc && <video src={up.pv.url} controls playsInline style={css('max-width:100%;max-height:100%;display:block;border-radius:4px')} />}
                {up.pv.isAudio && (
                  <div style={css('display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;max-width:420px;color:var(--text3)')}>
                    <svg width="40" height="40" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round')}><path d="M9 18V5.5l11-2V16" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></svg>
                    {up.pv.hasAudioSrc && <audio src={up.pv.url} controls style={css('width:100%')} />}
                  </div>
                )}
                {up.pv.hasPrev && <button onClick={up.pv.onPrev} title="Previous (←)" style={css('position:absolute;left:12px;top:50%;transform:translateY(-50%);width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;backdrop-filter:blur(6px)')}><svg width="15" height="15" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M15 6l-6 6 6 6" /></svg></button>}
                {up.pv.hasNext && <button onClick={up.pv.onNext} title="Next (→)" style={css('position:absolute;right:12px;top:50%;transform:translateY(-50%);width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;backdrop-filter:blur(6px)')}><svg width="15" height="15" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M9 6l6 6-6 6" /></svg></button>}
                {up.pv.pos && <div style={css("position:absolute;bottom:12px;left:50%;transform:translateX(-50%);height:22px;padding:0 9px;display:flex;align-items:center;border-radius:6px;background:rgba(0,0,0,.5);color:#fff;font-size:11px;font-family:'Geist Mono',monospace;backdrop-filter:blur(6px)")}>{up.pv.pos}</div>}
              </div>
              <div style={css('display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--border)')}>
                <div style={css('display:flex;align-items:flex-start;gap:8px;padding:14px 10px 12px 16px;border-bottom:1px solid var(--border)')}>
                  <span style={css('flex:1;min-width:0;font-weight:500;line-height:1.45;word-break:break-all')}>{up.pv.name}</span>
                  <button onClick={up.pv.close} title="Close (Esc)" className="u-hov-surface-text" style={css('width:26px;height:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--text3);cursor:pointer')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round')}><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
                <div style={css('flex:1;min-height:0;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:22px')}>
                  <div style={css('display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 16px;font-size:12.5px')}>
                    {up.pv.rows.map((r: any, i: number) => (<React.Fragment key={i}><span style={css('color:var(--text3)')}>{r.k}</span><span style={css('color:var(--text)')}>{r.v}</span></React.Fragment>))}
                  </div>
                  <div style={css('display:flex;flex-direction:column;gap:8px')}>
                    <div style={css('font-size:12px;color:var(--text3)')}>{up.pv.usedHead}</div>
                    {up.pv.used.map((g: any, i: number) => (
                      <button key={i} onClick={g.onClick} title="Open this generation" className="u-hov-surface u-hov-border2" style={css('display:flex;flex-direction:column;gap:3px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text);text-align:left;cursor:pointer')}>
                        <span style={{ fontSize: 12.5, lineHeight: 1.45, display: '-webkit-box' as any, WebkitBoxOrient: 'vertical' as any, WebkitLineClamp: 2 as any, overflow: 'hidden' }}>{g.prompt}</span>
                        <span style={css('font-size:11.5px;color:var(--text3)')}>{g.meta}</span>
                      </button>
                    ))}
                    {up.pv.usedMore && <span style={css('font-size:12px;color:var(--text3)')}>{up.pv.usedMore}</span>}
                    {up.pv.notUsed && <span style={css('font-size:12.5px;line-height:1.5;color:var(--text2);text-wrap:pretty')}>{up.pv.notUsed}</span>}
                  </div>
                </div>
                <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:12px 16px;border-top:1px solid var(--border)')}>
                  <button onClick={up.pv.onUse} style={css('display:flex;align-items:center;gap:6px;height:30px;padding:0 11px;border:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font-weight:500;cursor:pointer')}>
                    <svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round')}><path d="M12 5v14M5 12h14" /></svg>
                    <span>Use as reference</span>
                  </button>
                  <button onClick={up.pv.onDownload} title="Download" className="u-hov-surface" style={css('height:30px;padding:0 10px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>Download</button>
                  <div style={css('flex:1')} />
                  <button onClick={up.pv.onDelete} title="Delete (⌫)" className="u-hov-surface" style={css('height:30px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:var(--danger);cursor:pointer')}>Delete</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Settings view ───────────────────────────────────────────────
  renderSettings(v: AnyState) {
    return (
      <div style={css('flex:1;overflow-y:auto')}>
        <div style={css('max-width:640px;margin:0 auto;padding:40px 28px;display:flex;flex-direction:column;gap:36px')}>
          <div style={css('display:flex;flex-direction:column;gap:12px')}>
            <div style={css('font-size:12px;font-weight:500;color:var(--text3)')}>Higgsfield API</div>
            <div style={css('border:1px solid var(--border);border-radius:10px')}>
              <div style={css('display:flex;align-items:center;gap:16px;padding:16px')}>
                <div style={css('flex:1;display:flex;flex-direction:column;gap:4px')}>
                  <span style={css('display:flex;align-items:center;gap:8px')}>
                    <span style={css('font-weight:500')}>API key</span>
                    {v.hasKey && <span style={css('display:flex;align-items:center;gap:5px;height:20px;padding:0 7px;border-radius:999px;background:var(--hover);font-size:11.5px;color:var(--text2)')}><span style={{ width: 6, height: 6, borderRadius: '50%', background: v.keyChip.dot }} />{v.keyChip.short}</span>}
                  </span>
                  <span style={css('color:var(--text3);line-height:1.5')}>{v.keyStatus}</span>
                </div>
                <button onClick={v.openKey} className="u-hov-surface" style={css('height:30px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer;flex-shrink:0')}>{v.keyButton}</button>
              </div>
              <div style={css('padding:12px 16px;border-top:1px solid var(--border);color:var(--text3);font-size:12px;line-height:1.55;display:flex;flex-direction:column;gap:6px')}>
                <span><span style={css('color:var(--text2)')}>What it's for.</span> The key authenticates every generation request to Higgsfield models. Credits are charged to the account that owns the key.</span>
                <span><span style={css('color:var(--text2)')}>Where it's stored.</span> Encrypted server-side, never kept in your browser. Only the last 4 characters are shown.</span>
                <span>Keys are created at <a href="https://open.higgsfield.ai/api-keys" target="_blank" rel="noreferrer">open.higgsfield.ai</a>.</span>
                <span>Credit costs vary by model and aren't available through the API — see <a href={v.pricingUrl} target="_blank" rel="noreferrer">current pricing</a>.</span>
              </div>
            </div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:12px')}>
            <div style={css('font-size:12px;font-weight:500;color:var(--text3)')}>Appearance</div>
            <div style={css('border:1px solid var(--border);border-radius:10px')}>
              <div style={css('display:flex;align-items:center;gap:16px;padding:16px')}>
                <div style={css('flex:1;display:flex;flex-direction:column;gap:4px')}>
                  <span style={css('font-weight:500')}>Theme</span>
                  <span style={{ color: 'var(--text3)' }}>Choose how Studio looks.</span>
                </div>
                <div style={css('display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--hover);border:1px solid var(--border)')}>
                  {v.themeOpts.map((o: any, i: number) => (<button key={i} onClick={o.onClick} style={css(`height:24px;padding:0 12px;border:0;border-radius:6px;background:${o.bg};color:${o.color};box-shadow:${o.shadow};font-size:12.5px;cursor:pointer`)}>{o.label}</button>))}
                </div>
              </div>
            </div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:12px')}>
            <div style={css('font-size:12px;font-weight:500;color:var(--text3)')}>Generation</div>
            <div style={css('border:1px solid var(--border);border-radius:10px')}>
              <div style={css('display:flex;align-items:center;gap:16px;padding:16px')}>
                <div style={css('flex:1;display:flex;flex-direction:column;gap:4px')}>
                  <span style={css('font-weight:500')}>Default mode</span>
                  <span style={{ color: 'var(--text3)' }}>What the Create page opens with.</span>
                </div>
                <div style={css('display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--hover);border:1px solid var(--border)')}>
                  {v.defModeOpts.map((o: any, i: number) => (<button key={i} onClick={o.onClick} style={css(`height:24px;padding:0 12px;border:0;border-radius:6px;background:${o.bg};color:${o.color};box-shadow:${o.shadow};font-size:12.5px;cursor:pointer`)}>{o.label}</button>))}
                </div>
              </div>
            </div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:12px')}>
            <div style={css('font-size:12px;font-weight:500;color:var(--text3)')}>Data</div>
            <div style={css('border:1px solid var(--border);border-radius:10px')}>
              <div style={css('display:flex;align-items:center;gap:16px;padding:16px')}>
                <div style={css('flex:1;display:flex;flex-direction:column;gap:4px')}>
                  <span style={css('font-weight:500')}>Backup</span>
                  <span style={{ color: 'var(--text3)' }}>Download the database and media files as a .zip.</span>
                </div>
                <button onClick={v.exportBackup} disabled={v.exporting} className="u-hov-surface" style={css(`height:30px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:${v.exporting ? 'default' : 'pointer'};flex-shrink:0;opacity:${v.exporting ? 0.6 : 1}`)}>{v.exporting ? 'Preparing…' : 'Export backup'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Lightbox ─────────────────────────────────────────────────────
  renderLightbox(v: AnyState) {
    const lb = v.lb, lbz = v.lbz;
    return (
      <div style={css('position:fixed;inset:0;z-index:80;display:flex;background:rgba(0,0,0,.86);backdrop-filter:blur(4px)')}>
        <div ref={v.lbStageRef} onClick={v.lbStageClick} onMouseDown={v.lbDown} style={css(`flex:1;min-width:0;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:56px 72px;cursor:${lbz.cursor};user-select:none`)}>
          <div ref={v.lbBoxRef} style={css('position:absolute;inset:56px 72px;display:flex')}>
            <img src={lb.src} onLoad={lb.onLoad} alt="" draggable={false} style={css(`flex:1;min-width:0;width:100%;height:100%;object-fit:contain;display:block;opacity:${lb.op};filter:blur(${lb.blur}px);transform:translate(${lbz.x}px, ${lbz.y}px) scale(${lbz.s});transition:opacity .4s ease,filter .5s ease,transform ${lbz.dur}s ease;will-change:transform`)} />
            {lb.isVideo && (
              <div style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none')}>
                <div style={css('width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" style={css('fill:#fff;margin-left:3px')}><path d="M7 4v16l13-8z" /></svg>
                </div>
              </div>
            )}
          </div>
          <button onClick={v.closeLb} className="u-hov-w16" style={css('position:absolute;top:14px;left:14px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:0;border-radius:8px;background:rgba(255,255,255,.08);color:#fff;cursor:pointer')}>
            <svg width="15" height="15" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round')}><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
          <span style={css("position:absolute;top:22px;left:0;right:0;text-align:center;color:rgba(255,255,255,.55);font-size:12px;font-family:'Geist Mono',monospace;pointer-events:none")}>{lb.pos}</span>
          {lb.hasPrev && <button onClick={v.lbPrev} className="u-hov-w16" style={css('position:absolute;left:16px;top:50%;margin-top:-18px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;cursor:pointer')}><svg width="16" height="16" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M15 6l-6 6 6 6" /></svg></button>}
          <div onClick={v.stop} onMouseDown={v.stop} style={css('position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:2px;padding:3px;border-radius:9px;background:rgba(20,20,20,.72);backdrop-filter:blur(8px);color:#fff;font-size:12px;cursor:default')}>
            <button onClick={v.lbZoomOut} title="Zoom out (−)" className="u-hov-w12" style={css('width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:#fff;cursor:pointer')}><svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round')}><path d="M6 12h12" /></svg></button>
            <span style={css("min-width:44px;text-align:center;font-family:'Geist Mono',monospace;color:rgba(255,255,255,.8)")}>{lbz.pct}</span>
            <button onClick={v.lbZoomIn} title="Zoom in (+)" className="u-hov-w12" style={css('width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:#fff;cursor:pointer')}><svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round')}><path d="M6 12h12M12 6v12" /></svg></button>
            <span style={css('width:1px;height:16px;margin:0 3px;background:rgba(255,255,255,.18)')} />
            <button onClick={v.lbFit} title="Fit (0)" className="u-hov-w12" style={css(`height:28px;padding:0 10px;border:0;border-radius:6px;background:${lbz.fitBg};color:#fff;font:inherit;cursor:pointer`)}>Fit</button>
            <button onClick={v.lbOne} title="Actual size (1)" className="u-hov-w12" style={css(`height:28px;padding:0 10px;border:0;border-radius:6px;background:${lbz.oneBg};color:#fff;font:inherit;cursor:pointer`)}>100%</button>
          </div>
          {lb.hasNext && <button onClick={v.lbNext} className="u-hov-w16" style={css('position:absolute;right:16px;top:50%;margin-top:-18px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;cursor:pointer')}><svg width="16" height="16" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M9 6l6 6-6 6" /></svg></button>}
        </div>
        <div style={css('width:340px;flex-shrink:0;background:var(--panel);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto')}>
          <div style={css('padding:20px;display:flex;flex-direction:column;gap:10px;border-bottom:1px solid var(--border)')}>
            <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-4px -6px -4px 0')}>
              <span style={css('font-size:12px;color:var(--text3)')}>Prompt</span>
              <button onClick={lb.onCopy} title="Copy prompt" className="u-hov-surface-text" style={css(`display:flex;align-items:center;gap:5px;height:24px;padding:0 7px;border:0;border-radius:6px;background:transparent;color:${lb.copyColor};font:inherit;font-size:12px;cursor:pointer`)}>
                {lb.copied && <svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round')}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                {lb.notCopied && <svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linejoin:round')}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></svg>}
                <span>{lb.copyLabel}</span>
              </button>
            </div>
            <div style={css('font-size:13.5px;line-height:1.55;text-wrap:pretty')}>{lb.prompt}</div>
          </div>
          <div style={css('padding:16px 20px;display:grid;grid-template-columns:110px minmax(0, 1fr);row-gap:10px;border-bottom:1px solid var(--border)')}>
            {lb.rows.map((row: any, i: number) => (<React.Fragment key={i}><span style={css('color:var(--text3)')}>{row.k}</span><span style={{ fontFamily: row.ff }}>{row.v}</span></React.Fragment>))}
          </div>
          {lb.hasRefs && (
            <div style={css('padding:16px 20px;display:flex;flex-direction:column;gap:10px;border-bottom:1px solid var(--border)')}>
              <span style={css('font-size:12px;color:var(--text3)')}>References · {lb.refCount}</span>
              <div style={css('display:grid;grid-template-columns:repeat(5, minmax(0, 1fr));gap:6px')}>
                {lb.refs.map((r: any, i: number) => (
                  <div key={i} title={r.title} style={css('position:relative;aspect-ratio:1;border-radius:6px;overflow:hidden;background:var(--hover);border:1px solid var(--border)')}>
                    {r.isImage && <img src={r.url} alt="" style={css('width:100%;height:100%;object-fit:cover;display:block')} />}
                    {r.isMedia && <div style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3);text-transform:capitalize')}>{r.kind}</div>}
                    {r.hasTag && <span title={r.tagTip} style={css('position:absolute;left:3px;bottom:3px;padding:1px 4px;border-radius:3px;background:rgba(0,0,0,.6);color:#fff;font-size:9.5px;cursor:help')}>{r.tag}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={css('padding:16px 20px;display:flex;flex-direction:column;gap:6px')}>
            <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:6px')}>
              <button onClick={v.lbFav} className="u-hov-surface" style={css('display:flex;align-items:center;justify-content:center;gap:7px;height:32px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>
                <svg width="14" height="14" viewBox="0 0 24 24" style={css(`fill:${lb.favFill};stroke:${lb.favStroke};stroke-width:1.75;stroke-linejoin:round`)}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>
                <span>{lb.favLabel}</span>
              </button>
              <button onClick={v.lbDownload} className="u-hov-surface" style={css('display:flex;align-items:center;justify-content:center;gap:7px;height:32px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>
                <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></svg>
                <span>Download</span>
              </button>
            </div>
            <button onClick={v.lbReuse} className="u-hov-bright" style={css('display:flex;align-items:center;justify-content:center;gap:7px;height:32px;border:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font-weight:500;cursor:pointer')}>
              <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.3 6.4L3 16M3 21v-5h5" /></svg>
              <span>Edit prompt &amp; retry</span>
            </button>
            <button onClick={v.lbDelete} className="u-hov-danger-surface" style={css('display:flex;align-items:center;justify-content:center;gap:7px;height:32px;margin-top:6px;border:0;border-radius:7px;background:transparent;color:var(--text3);cursor:pointer')}>
              <svg width="14" height="14" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M4 6.5h16M9 6.5V4.5h6v2M6.5 6.5l1 13h9l1-13" /></svg>
              <span>Delete</span>
            </button>
          </div>
          <div style={css('margin-top:auto;padding:14px 20px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px 14px;font-size:11.5px;color:var(--text3)')}>
            <span style={css('display:flex;align-items:center;gap:5px')}><span style={css("font-family:'Geist Mono',monospace;padding:0 5px;border:1px solid var(--border2);border-radius:4px")}>← →</span>Navigate</span>
            <span style={css('display:flex;align-items:center;gap:5px')}><span style={css("font-family:'Geist Mono',monospace;padding:0 5px;border:1px solid var(--border2);border-radius:4px")}>F</span>Favorite</span>
            <span style={css('display:flex;align-items:center;gap:5px')}><span style={css("font-family:'Geist Mono',monospace;padding:0 5px;border:1px solid var(--border2);border-radius:4px")}>⌫</span>Delete</span>
            <span style={css('display:flex;align-items:center;gap:5px')}><span style={css("font-family:'Geist Mono',monospace;padding:0 5px;border:1px solid var(--border2);border-radius:4px")}>Esc</span>Close</span>
            <span style={css('display:flex;align-items:center;gap:5px')}><span style={css("font-family:'Geist Mono',monospace;padding:0 5px;border:1px solid var(--border2);border-radius:4px")}>Scroll</span>Zoom</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: editor modal ─────────────────────────────────────────────────
  renderEditor(v: AnyState) {
    return (
      <div onClick={v.closeEditor} style={css('position:fixed;inset:0;z-index:85;display:flex;align-items:center;justify-content:center;padding:32px;box-sizing:border-box;background:var(--overlay);backdrop-filter:blur(2px)')}>
        <div onClick={v.stop} style={css('width:860px;max-width:100%;height:min(680px, 100%);display:flex;flex-direction:column;background:var(--raised);border:1px solid var(--border2);border-radius:12px;box-shadow:var(--shadow);overflow:hidden')}>
          <div style={css('display:flex;align-items:center;gap:10px;height:48px;padding:0 10px 0 18px;border-bottom:1px solid var(--border);flex-shrink:0')}>
            <span style={css('font-size:13px;font-weight:500;color:var(--text)')}>Prompt</span>
            <span style={css('font-size:12px;color:var(--text3)')}>{v.editorMode}</span>
            <span style={css('flex:1')} />
            <span style={css("font-size:11.5px;color:var(--text3);font-family:'Geist Mono',monospace")}>{v.promptLen}</span>
            <button onClick={v.closeEditor} title="Collapse editor" className="u-hov-surface-text" style={css('width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--text2);cursor:pointer;padding:0')}>
              <svg width="13" height="13" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round')}><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg>
            </button>
          </div>
          <textarea ref={this.editorRef} value={v.prompt} onChange={v.onPrompt} onKeyDown={v.onPromptKey} placeholder={v.placeholder} style={css('flex:1;display:block;width:100%;box-sizing:border-box;resize:none;border:0;background:transparent;padding:20px 22px;font-size:15px;line-height:1.65;color:var(--text)')} />
          <div style={css('display:flex;align-items:center;gap:8px;padding:10px 12px 12px 18px;border-top:1px solid var(--border);flex-shrink:0')}>
            <span style={css('font-size:12px;color:var(--text3)')}>Esc to close · ⌘↵ to generate</span>
            <span style={css('flex:1')} />
            <button onClick={v.closeEditor} className="u-hov-surface" style={css('height:30px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>Done</button>
            {v.gen.reason && <span style={css('font-size:12px;color:var(--text3);white-space:nowrap')}>{v.gen.reason}</span>}
            <button onClick={v.editorGenerate} disabled={v.gen.disabled} title={v.gen.title} style={css(`height:30px;padding:0 14px;border:0;border-radius:7px;background:${v.gen.bg};color:${v.gen.color};font-weight:500;cursor:${v.gen.cursor}`)}>Generate</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: key / project / confirm modal ───────────────────────────────
  renderModal(v: AnyState) {
    return (
      <div onClick={v.closeModal} style={css('position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:var(--overlay);backdrop-filter:blur(2px)')}>
        <div onClick={v.stop} style={css('width:420px;max-width:calc(100vw - 32px);background:var(--raised);border:1px solid var(--border2);border-radius:12px;box-shadow:var(--shadow);padding:20px;display:flex;flex-direction:column;gap:16px;color:var(--text)')}>
          {v.showKeyForm && (
            <>
              <div style={css('display:flex;flex-direction:column;gap:6px')}>
                <div style={css('font-size:15px;font-weight:500')}>{v.keyFormTitle}</div>
                <div style={css('color:var(--text2);line-height:1.5')}>Paste the API key copied from open.higgsfield.ai. Paste it as-is.</div>
              </div>
              <div style={css('display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--border);border-radius:8px;font-size:12px;line-height:1.5;color:var(--text3)')}>
                <div style={css('display:flex;gap:10px')}><svg width="14" height="14" viewBox="0 0 24 24" style={css('flex-shrink:0;margin-top:1px;fill:none;stroke:var(--text2);stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg><span><span style={css('color:var(--text2)')}>Used for</span> sending your prompts to Higgsfield models. Each generation uses credits from the account that owns the key.</span></div>
                <div style={css('display:flex;gap:10px')}><svg width="14" height="14" viewBox="0 0 24 24" style={css('flex-shrink:0;margin-top:1px;fill:none;stroke:var(--text2);stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg><span><span style={css('color:var(--text2)')}>Stored</span> encrypted on our server, never in your browser. We check it with Higgsfield when you save.</span></div>
              </div>
              <input type="password" value={v.keyInput} onChange={v.onKeyInput} onKeyDown={v.onKeyInputKey} autoFocus placeholder="API key" autoComplete="off" className="u-foc-border3" style={css(`height:38px;padding:0 12px;border:1px solid ${v.keyInputBorder};border-radius:8px;background:var(--hover);font-family:'Geist Mono',monospace;font-size:13px`)} />
              {v.keyErr && <div style={css('font-size:12px;color:var(--danger);line-height:1.5;margin-top:-8px')}>{v.keyErr}</div>}
              <div style={css('font-size:12px;color:var(--text3);line-height:1.5')}>Don't have one? Create a key at <a href="https://open.higgsfield.ai/api-keys" target="_blank" rel="noreferrer">open.higgsfield.ai</a>.</div>
              <div style={css('display:flex;justify-content:flex-end;gap:8px')}>
                <button onClick={v.cancelKeyForm} className="u-hov-surface" style={css('height:32px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>Cancel</button>
                <button onClick={v.saveKey} style={css(`height:32px;padding:0 14px;border:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font-weight:500;cursor:pointer;opacity:${v.keySaveOpacity};display:flex;align-items:center;gap:7px`)}>
                  {v.checking && <span style={css('width:11px;height:11px;border:1.5px solid rgba(0,0,0,.25);border-top-color:var(--on-accent);border-radius:50%;animation:spin .8s linear infinite')} />}
                  {v.keySaveLabel}
                </button>
              </div>
            </>
          )}
          {v.showManage && (
            <>
              <div style={css('font-size:15px;font-weight:500')}>Manage API key</div>
              <div style={css('display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--border);border-radius:8px')}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.keyChip.dot }} />
                <div style={css('flex:1;display:flex;flex-direction:column;gap:2px;min-width:0')}>
                  <span>{v.keyChip.label}</span>
                  <span style={css('font-size:12px;color:var(--text3)')}>{v.keyCreditsLine}</span>
                </div>
                <span style={css("font-family:'Geist Mono',monospace;color:var(--text3);font-size:12px")}>{v.keyMask}</span>
                <button onClick={v.recheckKey} title="Check key again" className="u-hov-surface-text" style={css('height:26px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text2);cursor:pointer;font-size:12px;display:flex;align-items:center;gap:6px')}>
                  {v.checking && <span style={css('width:10px;height:10px;border:1.5px solid var(--border2);border-top-color:var(--text);border-radius:50%;animation:spin .8s linear infinite')} />}
                  {v.recheckLabel}
                </button>
              </div>
              <div style={css('font-size:12px;color:var(--text3);line-height:1.5')}>{v.keyDetail}{v.keyNeedsTopUp && <> <a href="https://open.higgsfield.ai" target="_blank" rel="noreferrer">Top up credits</a></>}</div>
              <div style={css('display:flex;gap:8px')}>
                <button onClick={v.removeKey} className="u-hov-danger-surface" style={css('height:32px;padding:0 12px;border:0;border-radius:7px;background:transparent;color:var(--text3);cursor:pointer')}>Remove API key</button>
                <div style={css('flex:1')} />
                <button onClick={v.startReplace} className="u-hov-surface" style={css('height:32px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>Replace API key</button>
                <button onClick={v.closeModal} style={css('height:32px;padding:0 14px;border:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font-weight:500;cursor:pointer')}>Done</button>
              </div>
            </>
          )}
          {v.showProjName && (
            <>
              <div style={css('font-size:15px;font-weight:500')}>{v.projModalTitle}</div>
              <input value={v.newName} onChange={v.onNewName} onKeyDown={v.onNewNameKey} autoFocus placeholder="Project name" className="u-foc-border3" style={css('height:38px;padding:0 12px;border:1px solid var(--border2);border-radius:8px;background:var(--hover);font-size:13.5px')} />
              <div style={css('display:flex;flex-direction:column;gap:8px')}>
                <div style={css('font-size:12px;color:var(--text3)')}>Emoji</div>
                <div style={css('display:grid;grid-template-columns:repeat(9, minmax(0, 1fr));gap:4px')}>
                  {v.emojiOpts.map((e: any, i: number) => (
                    <button key={i} onClick={e.onPick} title={e.title} className="u-hov-active" style={css(`aspect-ratio:1;display:flex;align-items:center;justify-content:center;border:1px solid ${e.border};border-radius:7px;background:${e.bg};color:var(--text3);font-size:16px;line-height:1;cursor:pointer;padding:0`)}>
                      {e.isNone ? <svg width="15" height="15" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:1.75;stroke-linejoin:round')}><path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></svg> : <span>{e.char}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div style={css('display:flex;justify-content:flex-end;gap:8px')}>
                <button onClick={v.closeModal} className="u-hov-surface" style={css('height:32px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>Cancel</button>
                <button onClick={v.saveProject} style={css(`height:32px;padding:0 14px;border:0;border-radius:7px;background:var(--accent);color:var(--on-accent);font-weight:500;cursor:pointer;opacity:${v.newProjOpacity}`)}>{v.projModalBtn}</button>
              </div>
            </>
          )}
          {v.confirmItems && (
            <>
              <div style={css('display:flex;flex-direction:column;gap:6px')}>
                <div style={css('font-size:15px;font-weight:500')}>{v.confirmTitle}</div>
                <div style={css('color:var(--text2);line-height:1.5')}>{v.confirmBody}</div>
              </div>
              <div style={css('display:flex;justify-content:flex-end;gap:8px')}>
                <button onClick={v.closeModal} className="u-hov-surface" style={css('height:32px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>Cancel</button>
                <button onClick={v.doDelete} autoFocus style={css('height:32px;padding:0 14px;border:0;border-radius:7px;background:var(--danger);color:var(--on-danger);font-weight:500;cursor:pointer')}>Delete</button>
              </div>
            </>
          )}
          {v.confirmProject && (
            <>
              <div style={css('display:flex;flex-direction:column;gap:6px')}>
                <div style={css('font-size:15px;font-weight:500')}>{v.projConfirmTitle}</div>
                <div style={css('color:var(--text2);line-height:1.5')}>{v.projConfirmBody}</div>
              </div>
              <div style={css('display:flex;justify-content:flex-end;gap:8px')}>
                <button onClick={v.closeModal} className="u-hov-surface" style={css('height:32px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>Cancel</button>
                {v.projHasAssets && <button onClick={v.deleteProjKeep} className="u-hov-surface" style={css('height:32px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>Keep assets</button>}
                <button onClick={v.deleteProjAll} style={css('height:32px;padding:0 14px;border:0;border-radius:7px;background:var(--danger);color:var(--on-danger);font-weight:500;cursor:pointer')}>{v.projDeleteLabel}</button>
              </div>
            </>
          )}
          {v.confirmGenerate && (
            <>
              <div style={css('display:flex;flex-direction:column;gap:6px')}>
                <div style={css('font-size:15px;font-weight:500')}>{v.confirmGenTitle}</div>
                <div style={css('color:var(--text2);line-height:1.5;max-height:160px;overflow-y:auto')}>&ldquo;{v.confirmGenPrompt}&rdquo;</div>
                <div style={css('font-size:12px;color:var(--text3)')}>{v.confirmGenMeta}</div>
              </div>
              <div style={css('display:flex;justify-content:flex-end;gap:8px')}>
                <button onClick={v.closeModal} className="u-hov-surface" style={css('height:32px;padding:0 12px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text);cursor:pointer')}>Cancel</button>
                <button onClick={v.doGenerateConfirm} disabled={v.gen.disabled} autoFocus style={css(`height:32px;padding:0 14px;border:0;border-radius:7px;background:${v.gen.bg};color:${v.gen.color};font-weight:500;cursor:${v.gen.cursor}`)}>{v.gen.disabled && v.gen.reasonText ? v.gen.reason : 'Generate'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Render: shortcuts sheet ─────────────────────────────────────────────
  renderShortcuts(v: AnyState) {
    const row = (label: string, keys: string) => (<><span>{label}</span><span style={css('font-family:\'Geist Mono\',monospace;font-size:11.5px;color:var(--text);padding:1px 6px;border:1px solid var(--border2);border-radius:4px;justify-self:end')}>{keys}</span></>);
    return (
      <div onClick={v.closeShortcuts} style={css('position:fixed;inset:0;z-index:92;display:flex;align-items:center;justify-content:center;background:var(--overlay);backdrop-filter:blur(2px)')}>
        <div onClick={v.stop} role="dialog" aria-label="Keyboard shortcuts" style={css('width:460px;max-width:calc(100vw - 32px);max-height:calc(100vh - 64px);overflow-y:auto;box-sizing:border-box;background:var(--raised);border:1px solid var(--border2);border-radius:12px;box-shadow:var(--shadow);padding:20px;display:flex;flex-direction:column;gap:18px;color:var(--text)')}>
          <div style={css('display:flex;align-items:center')}>
            <div style={css('flex:1;font-size:15px;font-weight:500')}>Keyboard shortcuts</div>
            <button onClick={v.closeShortcuts} title="Close" aria-label="Close" className="u-hov-surface-text" style={css('width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--text2);cursor:pointer;padding:0')}>
              <svg width="12" height="12" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round')}><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:8px')}>
            <div style={css('font-size:12px;color:var(--text3)')}>General</div>
            <div style={css('display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 16px;align-items:center;font-size:13px;color:var(--text2)')}>
              {row('Show shortcuts', '?')}{row('Close the topmost menu or dialog', 'Esc')}{row('Undo the last action', '⌘Z')}
            </div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:8px')}>
            <div style={css('font-size:12px;color:var(--text3)')}>Create</div>
            <div style={css('display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 16px;align-items:center;font-size:13px;color:var(--text2)')}>
              {row('Generate', '⌘↵')}{row('Paste images or video as references', '⌘V')}
            </div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:8px')}>
            <div style={css('font-size:12px;color:var(--text3)')}>Assets</div>
            <div style={css('display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 16px;align-items:center;font-size:13px;color:var(--text2)')}>
              {row('Search prompts', '/')}
            </div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:8px')}>
            <div style={css('font-size:12px;color:var(--text3)')}>Uploads</div>
            <div style={css('display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 16px;align-items:center;font-size:13px;color:var(--text2)')}>
              {row('Search', '/')}{row('Previous / next in preview', '← →')}{row('Delete', '⌫')}{row('Select all', '⌘A')}
            </div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:8px')}>
            <div style={css('font-size:12px;color:var(--text3)')}>Viewer</div>
            <div style={css('display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 16px;align-items:center;font-size:13px;color:var(--text2)')}>
              {row('Previous / next', '← →')}{row('Favorite', 'F')}{row('Delete', '⌫')}{row('Zoom in / out', '+ −')}{row('Fit to screen', '0')}{row('Actual size', '1')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: toasts ───────────────────────────────────────────────────────
  renderToasts(v: AnyState) {
    return (
      <div role="region" aria-live="polite" aria-label="Notifications" style={css('position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:95;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;width:max-content;max-width:calc(100vw - 32px)')}>
        {v.toasts.map((t: any) => (
          <div key={t.id} role={t.role} onMouseEnter={t.onEnter} onMouseLeave={t.onLeave} style={css(`pointer-events:auto;position:relative;overflow:hidden;display:flex;align-items:center;gap:10px;min-width:240px;max-width:440px;min-height:40px;padding:6px 6px 6px 12px;border-radius:10px;background:var(--raised);border:1px solid var(--border2);box-shadow:var(--shadow);color:var(--text);opacity:${t.op};transform:${t.tf};transition:opacity .18s ease,transform .18s ease`)}>
            {t.isSuccess && <svg width="15" height="15" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:var(--accent);stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.9" /></svg>}
            {t.isDelete && <svg width="15" height="15" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:var(--text2);stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round')}><path d="M4 6.5h16M9 6.5V4.5h6v2M6.5 6.5l.9 12.6a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.6" /></svg>}
            {t.isError && <svg width="15" height="15" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:var(--danger);stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5M12 16.4v.1" /></svg>}
            {t.isInfo && <svg width="15" height="15" viewBox="0 0 24 24" style={css('flex-shrink:0;fill:none;stroke:var(--text3);stroke-width:2;stroke-linecap:round;stroke-linejoin:round')}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.6v.1" /></svg>}
            {t.bar}
            <span style={css('flex:1;min-width:0;line-height:1.4;text-wrap:pretty')}>{t.msg}</span>
            {t.hasUndo && <button onClick={t.onUndo} title="Undo (⌘Z)" className="u-hov-surface" style={css('flex-shrink:0;height:28px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:var(--text);font:inherit;font-weight:500;cursor:pointer')}>Undo</button>}
            <button onClick={t.onClose} title="Dismiss" aria-label="Dismiss" className="u-hov-surface-text" style={css('flex-shrink:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--text3);cursor:pointer')}>
              <svg width="11" height="11" viewBox="0 0 24 24" style={css('fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round')}><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
    );
  }

  // ── Render: root ─────────────────────────────────────────────────────────
  render() {
    const v = this.renderVals();
    return (
      <div data-theme={v.theme} style={css("height:100vh;display:flex;font-variant-numeric:tabular-nums;background:var(--app);color:var(--text);font-family:Geist,ui-sans-serif,system-ui,sans-serif;font-size:13px;overflow:hidden")}>
        <input type="file" ref={this.fileRef} onChange={v.onFiles} style={css('display:none')} />
        {this.renderSidebar(v)}
        <main style={css('flex:1;min-width:0;margin:8px 8px 8px 0;background:var(--panel);border:1px solid var(--border);border-radius:10px;display:flex;flex-direction:column;position:relative;overflow:hidden')}>
          {this.renderHeader(v)}
          {v.isCreate && this.renderCreate(v)}
          {v.isGrid && this.renderGrid(v)}
          {v.isUploads && this.renderUploads(v)}
          {v.isSettings && this.renderSettings(v)}
        </main>
        {v.popOpen && <div onClick={v.closePop} style={css('position:fixed;inset:0;z-index:40')} />}
        {v.lbOpen && this.renderLightbox(v)}
        {v.editorOpen && this.renderEditor(v)}
        {v.modalOpen && this.renderModal(v)}
        {v.shortcutsOpen && this.renderShortcuts(v)}
        {this.renderToasts(v)}
      </div>
    );
  }
}
