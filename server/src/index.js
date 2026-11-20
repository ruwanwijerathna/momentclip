import express from "express";
import rateLimit from "express-rate-limit";
import { ZipArchive } from "archiver";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { extractVideoId, getVideoInfo } from "./youtube.js";
import { watchCatalog, getCatalog, isCatalogVideo, findByVideo } from "./catalog.js";
import {
  createJob,
  getJob,
  publicJob,
  subscribe,
  clipFilename,
  startJanitor,
  QUALITIES,
  FORMATS,
} from "./jobs.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

if (config.corsOrigin) {
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
}

const limiter = rateLimit({ windowMs: 60_000, limit: config.rateLimitPerMin, standardHeaders: true, legacyHeaders: false });

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/config", (_req, res) =>
  res.json({
    maxSegments: config.maxSegments,
    maxSegmentSeconds: config.maxSegmentSeconds,
    qualities: QUALITIES,
    formats: FORMATS,
    jobTtlMinutes: config.jobTtlMs / 60_000,
    catalogOnly: config.catalogOnly,
  })
);

app.get("/api/catalog", (req, res) => {
  const { catalog, etag } = getCatalog();
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "public, max-age=60");
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  res.json(catalog);
});

const notInCatalog = (id) => config.catalogOnly && !isCatalogVideo(id);

app.get("/api/info", limiter, async (req, res) => {
  const id = extractVideoId(req.query.url);
  if (!id) return res.status(400).json({ error: "That doesn't look like a YouTube link." });
  if (notInCatalog(id)) return res.status(403).json({ error: "This video isn't in the convocation catalog." });
  try {
    res.json({ ...(await getVideoInfo(id)), catalog: findByVideo(id) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post("/api/jobs", limiter, async (req, res) => {
  const { url, segments, format = "mp4", quality = "1080", precise = true } = req.body || {};
  const id = extractVideoId(url);
  if (!id) return res.status(400).json({ error: "Invalid YouTube URL." });
  if (notInCatalog(id)) return res.status(403).json({ error: "This video isn't in the convocation catalog." });
  if (!FORMATS.includes(format)) return res.status(400).json({ error: "Unsupported format." });
  if (!QUALITIES.includes(String(quality))) return res.status(400).json({ error: "Unsupported quality." });
  if (!Array.isArray(segments) || segments.length === 0)
    return res.status(400).json({ error: "Add at least one segment." });
  if (segments.length > config.maxSegments)
    return res.status(400).json({ error: `Max ${config.maxSegments} segments per job.` });

  let info;
  try {
    info = await getVideoInfo(id);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  if (info.isLive) return res.status(400).json({ error: "This stream is still live. Try again once it has ended." });

  const clean = [];
  for (const [i, s] of segments.entries()) {
    const start = Number(s?.start);
    const end = Number(s?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start)
      return res.status(400).json({ error: `Segment ${i + 1}: end must be after start.` });
    if (info.duration && end > info.duration + 1)
      return res.status(400).json({ error: `Segment ${i + 1} goes past the end of the video.` });
    if (end - start > config.maxSegmentSeconds)
      return res.status(400).json({ error: `Segment ${i + 1} is longer than ${Math.round(config.maxSegmentSeconds / 60)} min.` });
    clean.push({ start, end, label: String(s.label || "").slice(0, 80) });
  }

  const job = createJob({ videoId: id, title: info.title, segments: clean, format, quality: String(quality), precise: !!precise });
  res.status(201).json(publicJob(job));
});

app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found or expired." });
  res.json(publicJob(job));
});

// Server-Sent Events: live progress
app.get("/api/jobs/:id/events", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).end();
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  const send = () => res.write(`data: ${JSON.stringify(publicJob(job))}\n\n`);
  send();
  const off = subscribe(job.id, send);
  const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
  req.on("close", () => {
    off();
    clearInterval(ping);
  });
});

app.get("/api/jobs/:id/clips/:clipId", (req, res) => {
  const job = getJob(req.params.id);
  const clip = job?.clips.find((c) => c.id === req.params.clipId);
  if (!clip?.file || clip.status !== "done") return res.status(404).json({ error: "Clip not ready." });
  res.download(clip.file, clipFilename(job, clip));
});

app.get("/api/jobs/:id/zip", (req, res) => {
  const job = getJob(req.params.id);
  const ready = job?.clips.filter((c) => c.status === "done" && c.file) || [];
  if (!ready.length) return res.status(404).json({ error: "No clips ready." });
  res.attachment(`momentclip-${job.videoId}.zip`);
  const zip = new ZipArchive({ store: true }); // media is already compressed
  zip.on("error", () => res.end());
  zip.pipe(res);
  for (const c of ready) zip.file(c.file, { name: clipFilename(job, c) });
  zip.finalize();
});

// Serve the built SPA in production
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

startJanitor();
watchCatalog();
app.listen(config.port, () => console.log(`MomentClip API on http://localhost:${config.port}`));
