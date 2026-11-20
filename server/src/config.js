import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load the project-root .env (Docker passes env vars directly; real env vars always win).
const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

const num = (v, d) => (v !== undefined && v !== "" && !Number.isNaN(+v) ? +v : d);

export const config = {
  port: num(process.env.PORT, 8787),
  ytdlp: process.env.YTDLP_PATH || "yt-dlp",
  dataDir: path.resolve(process.env.DATA_DIR || "./data"),
  cookiesFile: process.env.YTDLP_COOKIES ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../", process.env.YTDLP_COOKIES) : "",
  extraArgs: (process.env.YTDLP_EXTRA_ARGS || "").split(" ").filter(Boolean),
  maxSegments: num(process.env.MAX_SEGMENTS, 10),
  maxSegmentSeconds: num(process.env.MAX_SEGMENT_SECONDS, 30 * 60),
  concurrency: num(process.env.CONCURRENCY, 2),
  jobTtlMs: num(process.env.JOB_TTL_MINUTES, 60) * 60_000,
  clipTimeoutMs: num(process.env.CLIP_TIMEOUT_MINUTES, 20) * 60_000,
  rateLimitPerMin: num(process.env.RATE_LIMIT_PER_MIN, 30),
  corsOrigin: process.env.CORS_ORIGIN || "",
  catalogFile: path.resolve(process.env.CATALOG_FILE || "./catalog/convocations.json"),
  // true = only videos listed in the catalog can be loaded/exported
  catalogOnly: /^(1|true|yes)$/i.test(process.env.CATALOG_ONLY || ""),
};
