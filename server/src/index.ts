import "dotenv/config";
import express from "express";
import { keyRouter } from "./routes/key.js";
import { generationsRouter } from "./routes/generations.js";
import { projectsRouter } from "./routes/projects.js";
import { assetsRouter, countsRouter } from "./routes/assets.js";
import { uploadsRouter } from "./routes/uploads.js";
import { modelsRouter } from "./routes/models.js";
import { exportRouter } from "./routes/export.js";

const app = express();
app.use(express.json());

app.use("/media", express.static(new URL("../data/media/", import.meta.url).pathname));
app.use("/api/key", keyRouter);
app.use("/api/generations", generationsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/counts", countsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/models", modelsRouter);
app.use("/api/export", exportRouter);

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`studio server on http://localhost:${port}`));
