import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import apiRouter from "./api.mjs";
import { mountStatic } from "./static.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "..", "dist");
const PORT = process.env.PORT || 8787;

const app = express();
app.use(express.json());

// Deliberately DB-independent -- must stay green regardless of DB state.
app.get("/health", (req, res) => res.status(200).json({ status: "healthy" }));

app.use("/api", apiRouter);
mountStatic(app, DIST_DIR);

app.listen(PORT, () => console.log(`roadmap-hub listening on :${PORT}`));
