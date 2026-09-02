import fs from "node:fs";
import pg from "pg";

// Env vars match chamber's export convention (uppercase). Defaults match
// docker-compose.yml for local dev.
const host = process.env.DB_HOST || "localhost";
const isLocal = ["localhost", "127.0.0.1", "db"].includes(host);

// Managed Postgres (RDS etc.) commonly forces SSL, refusing unencrypted
// connections outright. Default to TLS for anything that isn't the local
// compose database.
const sslmode = process.env.DB_SSLMODE || (isLocal ? "disable" : "require");
const caPath = process.env.DB_SSL_CA;

let ssl = false;
if (sslmode !== "disable") {
  if (caPath) {
    ssl = { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  } else if (sslmode === "verify-full") {
    throw new Error('DB_SSLMODE="verify-full" requires DB_SSL_CA to point at a CA bundle');
  } else {
    ssl = { rejectUnauthorized: false };
  }
}

export default new pg.Pool({
  host,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "roadmap_hub",
  user: process.env.DB_USER || "roadmap_admin",
  password: process.env.DB_PASSWORD || "localdev",
  ssl,
  max: 5,
});
