import { spawn } from "node:child_process";
import { config } from "./config.js";

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accepts any common YouTube URL shape and returns the 11-char video id.
 * We never pass the user's raw string to yt-dlp — only a canonical URL we
 * rebuild ourselves — so arbitrary sites / flags can't be injected.
 */
export function extractVideoId(input) {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (ID_RE.test(raw)) return raw;
  let u;
  try {
    u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1, 12);
    return ID_RE.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v");
    if (v && ID_RE.test(v)) return v;
    const m = u.pathname.match(/^\/(?:live|shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

export const canonicalUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

export function baseArgs() {
  const args = ["--no-playlist", "--no-warnings", "--no-color"];
  if (config.cookiesFile) args.push("--cookies", config.cookiesFile);
  if (config.extraArgs.length) args.push(...config.extraArgs);
  return args;
}

/** Run yt-dlp and collect stdout. */
function run(args, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const p = spawn(config.ytdlp, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => {
      clearTimeout(t);
      reject(new Error(`Could not start yt-dlp (${e.message}). Is it installed?`));
    });
    p.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) resolve(out);
      else reject(new Error(cleanError(err) || `yt-dlp exited with code ${code}`));
    });
  });
}

export function cleanError(stderr) {
  const line = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("ERROR:"))
    .pop();
  return line ? line.replace(/^ERROR:\s*(\[[^\]]+\]\s*[\w-]+:\s*)?/, "") : stderr.trim().split("\n").pop();
}

const infoCache = new Map(); // id -> { at, data }

export async function getVideoInfo(id) {
  const hit = infoCache.get(id);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.data;

  const json = JSON.parse(await run([...baseArgs(), "-J", canonicalUrl(id)]));
  const heights = [
    ...new Set(
      (json.formats || [])
        .filter((f) => f.vcodec && f.vcodec !== "none" && f.height)
        .map((f) => f.height)
    ),
  ].sort((a, b) => b - a);

  const data = {
    id,
    title: json.title,
    channel: json.channel || json.uploader,
    duration: json.duration ?? 0,
    thumbnail: json.thumbnail,
    isLive: json.is_live === true,
    uploadDate: json.upload_date,
    heights,
    chapters: (json.chapters || []).map((c) => ({
      title: c.title,
      start: c.start_time,
      end: c.end_time,
    })),
  };
  infoCache.set(id, { at: Date.now(), data });
  return data;
}
