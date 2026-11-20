import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { config } from "./config.js";
import { baseArgs, canonicalUrl, cleanError } from "./youtube.js";

/** In-memory job store. Swap for Redis/Postgres + a worker queue (BullMQ) when you scale out. */
const jobs = new Map();
const bus = new EventEmitter();
bus.setMaxListeners(0);

const queue = [];
let running = 0;

export const QUALITIES = ["best", "2160", "1440", "1080", "720", "480", "360"];
export const FORMATS = ["mp4", "mp3"];

export function createJob({ videoId, title, segments, format, quality, precise }) {
  const id = randomUUID();
  const dir = path.join(config.dataDir, id);
  fs.mkdirSync(dir, { recursive: true });

  const job = {
    id,
    videoId,
    title,
    format,
    quality,
    precise,
    createdAt: Date.now(),
    dir,
    clips: segments.map((s, i) => ({
      id: `c${i + 1}`,
      index: i,
      label: s.label || `Clip ${i + 1}`,
      start: s.start,
      end: s.end,
      status: "queued", // queued | downloading | processing | done | error
      progress: 0,
      size: 0,
      file: null,
      error: null,
    })),
  };
  jobs.set(id, job);
  for (const clip of job.clips) queue.push({ job, clip });
  pump();
  return job;
}

export const getJob = (id) => jobs.get(id);

export function publicJob(job) {
  const clips = job.clips.map(({ file, ...c }) => c);
  const done = clips.filter((c) => c.status === "done").length;
  const failed = clips.filter((c) => c.status === "error").length;
  const status =
    done + failed < clips.length ? "running" : failed === clips.length ? "error" : "done";
  const progress = clips.reduce((a, c) => a + c.progress, 0) / clips.length;
  return {
    id: job.id,
    videoId: job.videoId,
    title: job.title,
    format: job.format,
    quality: job.quality,
    createdAt: job.createdAt,
    expiresAt: job.createdAt + config.jobTtlMs,
    status,
    progress,
    clips,
  };
}

export function subscribe(jobId, fn) {
  const h = (id) => id === jobId && fn();
  bus.on("update", h);
  return () => bus.off("update", h);
}

let lastEmit = new Map();
function emit(job, force = false) {
  const now = Date.now();
  if (!force && now - (lastEmit.get(job.id) || 0) < 250) return; // throttle progress spam
  lastEmit.set(job.id, now);
  bus.emit("update", job.id);
}

function pump() {
  while (running < config.concurrency && queue.length) {
    const task = queue.shift();
    if (!jobs.has(task.job.id)) continue;
    running++;
    runClip(task.job, task.clip)
      .catch((e) => {
        task.clip.status = "error";
        task.clip.error = e.message;
      })
      .finally(() => {
        running--;
        emit(task.job, true);
        pump();
      });
  }
}

const hms = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(2).padStart(5, "0");
  return `${h}:${String(m).padStart(2, "0")}:${sec}`;
};
const toSec = (t) => {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

function formatArgs(job) {
  if (job.format === "mp3") {
    return ["-f", "ba/b", "-x", "--audio-format", "mp3", "--audio-quality", "0"];
  }
  const h = job.quality === "best" ? "" : `[height<=${job.quality}]`;
  return [
    "-f",
    `bv*${h}[ext=mp4]+ba[ext=m4a]/bv*${h}+ba/b${h}/b`,
    "--merge-output-format",
    "mp4",
  ];
}

function runClip(job, clip) {
  return new Promise((resolve, reject) => {
    clip.status = "downloading";
    emit(job, true);

    const length = clip.end - clip.start;
    const args = [
      ...baseArgs(),
      "--newline",
      "--progress",
      "--progress-template",
      "download:MCPROG %(progress._percent_str)s",
      "--download-sections",
      `*${hms(clip.start)}-${hms(clip.end)}`,
      ...(job.precise ? ["--force-keyframes-at-cuts"] : []),
      ...formatArgs(job),
      "-o",
      path.join(job.dir, `${clip.id}.%(ext)s`),
      canonicalUrl(job.videoId),
    ];

    const p = spawn(config.ytdlp, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => p.kill("SIGKILL"), config.clipTimeoutMs);

    const onLine = (line) => {
      // yt-dlp's native progress
      const pct = line.match(/MCPROG\s+([\d.]+)%/);
      if (pct) clip.progress = Math.max(clip.progress, Math.min(0.9, (+pct[1] / 100) * 0.9));
      // section downloads go through ffmpeg, which reports time=HH:MM:SS.xx
      const t = line.match(/time=(\d+:\d+:\d+(?:\.\d+)?)/);
      if (t && length > 0) clip.progress = Math.max(clip.progress, Math.min(0.9, (toSec(t[1]) / length) * 0.9));
      if (/\[(Merger|ExtractAudio|FixupM3u8|VideoConvertor|ModifyChapters)\]/.test(line)) {
        clip.status = "processing";
        clip.progress = Math.max(clip.progress, 0.92);
      }
      emit(job);
    };

    const split = (stream, collect) => {
      let buf = "";
      stream.on("data", (d) => {
        const s = d.toString();
        if (collect) stderr += s;
        buf += s;
        const parts = buf.split(/\r|\n/);
        buf = parts.pop();
        parts.forEach(onLine);
      });
    };
    split(p.stdout, false);
    split(p.stderr, true);

    p.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Could not start yt-dlp: ${e.message}`));
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(cleanError(stderr) || `yt-dlp exited with ${code}`));
      const file = fs
        .readdirSync(job.dir)
        .find((f) => f.startsWith(`${clip.id}.`) && !/\.(part|ytdl|temp)/.test(f));
      if (!file) return reject(new Error("Output file not found"));
      clip.file = path.join(job.dir, file);
      clip.size = fs.statSync(clip.file).size;
      clip.status = "done";
      clip.progress = 1;
      resolve();
    });
  });
}

export function clipFilename(job, clip) {
  const ext = path.extname(clip.file || "") || `.${job.format}`;
  const safe = (s) =>
    s.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "clip";
  return `${String(clip.index + 1).padStart(2, "0")}-${safe(clip.label)}${ext}`;
}

/** Remove expired jobs and their files. */
export function startJanitor() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (now - job.createdAt > config.jobTtlMs) {
        jobs.delete(id);
        lastEmit.delete(id);
        fs.rm(job.dir, { recursive: true, force: true }, () => {});
      }
    }
  }, 60_000).unref();
}
