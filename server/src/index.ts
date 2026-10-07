import "dotenv/config";
import express from "express";
import { keyRouter } from "./routes/key.js";

const app = express();
app.use(express.json());

app.use("/api/key", keyRouter);

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`studio server on http://localhost:${port}`));
