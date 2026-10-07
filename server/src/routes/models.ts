import { Router } from "express";

export const modelsRouter = Router();

// ponytail: Higgsfield has no catalog/pricing API (same gap documented in higgsfield.ts
// for balance) — checked their OpenAPI spec and docs. So this lists exactly the 3 models
// createOne() in higgsfield.ts actually has a real endpoint for; nothing placeholder, no
// invented cost numbers. `pricingUrl` links out to their real pricing page instead of
// faking a credit cost here.
const CATALOG = {
  image: [
    { id: "soul", name: "Higgsfield Soul", desc: "Photoreal people and fashion" },
  ],
  video: [
    { id: "seedance", name: "Seedance 2.0", desc: "Cinematic motion, native audio" },
    { id: "kling", name: "Kling 2.5", desc: "Realistic physics" },
  ],
  pricingUrl: "https://higgsfield.ai/pricing",
};

modelsRouter.get("/", (_req, res) => res.json(CATALOG));
