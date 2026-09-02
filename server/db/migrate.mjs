/**
 * Creates the roadmap-hub schema (idempotent). Run once per environment
 * with admin DB credentials: `npm run db:migrate`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../db.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(here, "schema.sql"), "utf8");

const client = await pool.connect();
try {
  await client.query(sql);
  console.log("Schema is up to date.");
} finally {
  client.release();
  await pool.end();
}
