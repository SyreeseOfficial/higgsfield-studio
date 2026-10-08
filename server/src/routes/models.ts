import { Router } from "express";

export const modelsRouter = Router();

// Catalog hand-synced against two sources (Higgsfield has no catalog/pricing API — same gap as the
// balance endpoint in higgsfield.ts):
//   1. https://open.higgsfield.ai/explore (checked 2026-10-08) — which real models exist.
//   2. Higgsfield's own official Next.js template registry (`pnpm dlx shadcn@latest view
//      higgsfield-ai/app-templates/<model>`, checked 2026-10-09) — their real request schema.
// Most of the catalog is now verified this way; `desc` says "schema not yet verified" only for
// models with no entry in that template registry either (Kling 3.0's six variants, Seedance 2.5's
// three, Genjutsu, Cinema Studio) — picking one of those surfaces the honest "Model not connected
// yet" error instead of a guessed call. Excluded entirely: Ads Studio, Product Shots, Graphic Ads,
// Marketplace Design, Marketing Studio Image and AI Influencer — brand/product-asset workflows, not
// plain prompt-to-image/video models, so they don't fit this composer's shape.
const CATALOG = {
  image: [
    { id: "soul", name: "Higgsfield Soul", desc: "Photoreal people and fashion" },
    { id: "soul-v2", name: "Higgsfield Soul 2", desc: "Portraits, fashion" },
    { id: "soul-cinema", name: "Higgsfield Soul Cinema", desc: "Cinematic portraits, fashion" },
    { id: "flux-2", name: "Flux 2", desc: "Text-to-image" },
    { id: "grok-image", name: "Grok Imagine 2.0", desc: "Text-to-image, image editing" },
    { id: "ideogram", name: "Ideogram 4.0", desc: "Text-to-image, image editing" },
    { id: "recraft", name: "Recraft 4.1", desc: "Text-to-image" },
    { id: "qwen-image", name: "Qwen Image 3", desc: "Text-to-image, English/Chinese" },
    { id: "z-image", name: "Z-Image Turbo", desc: "Rapid text-to-image" },
  ],
  video: [
    { id: "seedance", name: "Seedance 2.0", desc: "Cinematic motion, native audio" },
    { id: "kling", name: "Kling 2.5", desc: "Realistic physics" },
    { id: "kling-standard", name: "Kling 2.5 Standard", desc: "Image-to-video, lower cost" },
    { id: "kling-2-6", name: "Kling 2.6", desc: "Realistic physics" },
    { id: "kling-o1", name: "Kling O1 (Omni)", desc: "First-and-last-frame video" },
    { id: "kling-o3", name: "Kling O3", desc: "First-and-last-frame video" },
    { id: "minimax", name: "MiniMax Hailuo 2.3", desc: "Text or image to video" },
    { id: "minimax-h3", name: "MiniMax H3", desc: "Text or image to video" },
    { id: "flux-3", name: "Flux 3", desc: "Text or image to video" },
    { id: "dop", name: "DoP", desc: "Image-to-video" },
    { id: "pixverse-6", name: "PixVerse 6", desc: "Text or image to video" },
    { id: "wan-2-6", name: "Wan 2.6", desc: "Text or image to video" },
    { id: "wan-2-7", name: "Wan 2.7", desc: "Text or image to video" },
    { id: "wan-3", name: "Wan 3.0", desc: "Text or image to video" },
    { id: "wan-3-prime", name: "Wan 3.0 Prime", desc: "Text or image to video" },
    { id: "happy-horse-1-1", name: "Happy Horse 1.1", desc: "Text or image to video" },
    { id: "happy-horse-1-0", name: "Happy Horse 1.0", desc: "Text or image to video" },
    { id: "ltx-2-5-fast", name: "LTX 2.5 Fast", desc: "Text-to-video" },
    { id: "ltx-2-5-pro", name: "LTX 2.5 Pro", desc: "Text-to-video" },
    { id: "grok-video", name: "Grok Imagine Video 1.5", desc: "Reference-to-video" },
    { id: "seedance-2-5", name: "Seedance 2.5", desc: "Text/image/video-to-video, audio-to-video — schema not yet verified" },
    { id: "kling-3", name: "Kling 3.0", desc: "Text-to-video, image-to-video — schema not yet verified" },
    { id: "genjutsu", name: "Genjutsu", desc: "Motion transfer from a reference video — schema not yet verified" },
    { id: "cinema-studio", name: "Cinema Studio 4.0", desc: "Text/image/video-to-video — schema not yet verified" },
  ],
  pricingUrl: "https://higgsfield.ai/pricing",
};

modelsRouter.get("/", (_req, res) => res.json(CATALOG));
