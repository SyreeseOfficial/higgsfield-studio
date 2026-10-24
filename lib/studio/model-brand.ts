/** Accent colour per model company (keyed by the catalog `icon`), used for glows and badges. */
const BRAND_COLOR: Record<string, string> = {
  flux: "#f59e0b",
  grok: "#d4d4d8",
  "happy-horse": "#facc15",
  higgsfield: "#c8f031",
  ideogram: "#f472b6",
  kling: "#22d3ee",
  ltx: "#34d399",
  minimax: "#f87171",
  pixverse: "#fb923c",
  qwen: "#818cf8",
  recraft: "#2dd4bf",
  seedance: "#3b82f6",
  wan: "#a78bfa",
  "z-image": "#60a5fa",
}

export function brandColor(icon: string | undefined): string | undefined {
  return icon ? BRAND_COLOR[icon] : undefined
}
