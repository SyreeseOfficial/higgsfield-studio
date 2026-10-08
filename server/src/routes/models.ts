import { Router } from "express";

export const modelsRouter = Router();

// Catalog discovered via https://open.higgsfield.ai/explore (checked 2026-10-08) — Higgsfield has
// no catalog/pricing API (same gap as the balance endpoint in higgsfield.ts), so this is hand-synced
// against the explore page, not generated. `desc` says "schema not yet verified" for every model
// whose request body isn't confirmed in docs.higgsfield.ai/docs/openapi.json or a model-specific doc
// page: per the integration brief, missing verification doesn't authorize dropping a real model from
// the catalog, only reporting it as unverified. createOne() in higgsfield.ts only has real endpoint
// logic for soul, seedance, kling and minimax — picking any other model surfaces the honest "Model
// not connected yet" error instead of guessing an endpoint/schema. Excluded entirely: Ads Studio,
// Product Shots, Graphic Ads, Marketplace Design, Marketing Studio Image and AI Influencer — those
// are brand/product-asset workflows, not plain prompt-to-image/video models, so they don't fit this
// composer's shape.
const CATALOG = {
  image: [
    { id: "soul", name: "Higgsfield Soul", desc: "Photoreal people and fashion" },
    { id: "soul-v2", name: "Higgsfield Soul 2", desc: "Portraits, fashion — schema not yet verified" },
    { id: "grok-image", name: "Grok Imagine 2.0", desc: "Text-to-image, image editing — schema not yet verified" },
    { id: "ideogram", name: "Ideogram 4.0", desc: "Text-to-image, image editing — schema not yet verified" },
    { id: "recraft", name: "Recraft 4.1", desc: "Text-to-image — schema not yet verified" },
    { id: "qwen-image", name: "Qwen Image 3", desc: "Text-to-image, English/Chinese — schema not yet verified" },
    { id: "z-image", name: "Z-Image Turbo", desc: "Rapid text-to-image — schema not yet verified" },
  ],
  video: [
    { id: "seedance", name: "Seedance 2.0", desc: "Cinematic motion, native audio" },
    { id: "kling", name: "Kling 2.5", desc: "Realistic physics" },
    { id: "minimax", name: "MiniMax Hailuo 2.3", desc: "Text or image to video" },
    { id: "seedance-2-5", name: "Seedance 2.5", desc: "Text/image/video-to-video, audio-to-video — schema not yet verified" },
    { id: "kling-3", name: "Kling 3.0", desc: "Text-to-video, image-to-video — schema not yet verified" },
    { id: "genjutsu", name: "Genjutsu", desc: "Motion transfer from a reference video — schema not yet verified" },
    { id: "cinema-studio", name: "Cinema Studio 4.0", desc: "Text/image/video-to-video — schema not yet verified" },
    { id: "wan-3-prime", name: "Wan 3.0 Prime", desc: "Text-to-video, media-to-video — schema not yet verified" },
    { id: "wan-3", name: "Wan 3.0", desc: "Text-to-video, image-to-video — schema not yet verified" },
    { id: "wan-2-7", name: "Wan 2.7", desc: "Text-to-video, image-to-video — schema not yet verified" },
    { id: "happy-horse-1-1", name: "Happy Horse 1.1", desc: "Text-to-video, image-to-video — schema not yet verified" },
    { id: "happy-horse-1-0", name: "Happy Horse 1.0", desc: "Text-to-video, image-to-video — schema not yet verified" },
    { id: "ltx-2-5-fast", name: "LTX 2.5 Fast", desc: "Text-to-video, image-to-video — schema not yet verified" },
    { id: "ltx-2-5-pro", name: "LTX 2.5 Pro", desc: "Text-to-video, image-to-video — schema not yet verified" },
    { id: "grok-video", name: "Grok Imagine Video 1.5", desc: "Text-to-video, image-to-video — schema not yet verified" },
  ],
  pricingUrl: "https://higgsfield.ai/pricing",
};

modelsRouter.get("/", (_req, res) => res.json(CATALOG));
