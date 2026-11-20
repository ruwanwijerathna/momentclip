import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { config } from "./config.js";

/**
 * Convocation catalog: University → Convocation → Day → Session → Video.
 * The JSON is human-edited, so times may be written as "1:02:05" strings;
 * they're normalised to seconds here.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const PLACEHOLDER_RE = /^REPLACE/i;

export function toSeconds(v) {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v !== "string" || !/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(v.trim())) return null;
  const parts = v.trim().split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return null;
  return parts.reduce((a, p) => a * 60 + p, 0);
}

/** Returns { catalog, errors, warnings, stats }. Never throws on bad data. */
export function validateCatalog(raw) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const videos = new Map();
  const stats = { universities: 0, convocations: 0, days: 0, sessions: 0, markers: 0 };

  const id = (v, where) => {
    if (typeof v !== "string" || !SLUG.test(v)) errors.push(`${where}: id "${v}" must be a lowercase slug (a-z, 0-9, -)`);
    else if (ids.has(v)) errors.push(`${where}: duplicate id "${v}"`);
    else ids.add(v);
  };
  const str = (v, where, field) => {
    if (typeof v !== "string" || !v.trim()) errors.push(`${where}: "${field}" is required`);
  };

  if (!raw || !Array.isArray(raw.universities)) {
    return { catalog: null, errors: ['Root must be an object with a "universities" array'], warnings, stats };
  }

  const catalog = {
    version: raw.version ?? 1,
    updatedAt: raw.updatedAt ?? null,
    universities: raw.universities.map((u, ui) => {
      const uw = `universities[${ui}]${u?.id ? ` (${u.id})` : ""}`;
      id(u?.id, uw);
      str(u?.name, uw, "name");
      stats.universities++;
      return {
        id: u.id,
        name: u.name,
        shortName: u.shortName || u.name,
        location: u.location || null,
        timezone: u.timezone || "UTC",
        website: u.website || null,
        convocations: (u.convocations || []).map((c, ci) => {
          const cw = `${uw}.convocations[${ci}]${c?.id ? ` (${c.id})` : ""}`;
          id(c?.id, cw);
          str(c?.title, cw, "title");
          stats.convocations++;
          return {
            id: c.id,
            title: c.title,
            year: c.year ?? (c.days?.[0]?.date ? +c.days[0].date.slice(0, 4) : null),
            days: (c.days || [])
              .map((d, di) => {
                const dw = `${cw}.days[${di}]`;
                if (!DATE.test(d?.date || "")) errors.push(`${dw}: "date" must be YYYY-MM-DD`);
                stats.days++;
                return {
                  date: d.date,
                  label: d.label || `Day ${di + 1}`,
                  sessions: (d.sessions || []).map((s, si) => {
                    const sw = `${dw}.sessions[${si}]${s?.id ? ` (${s.id})` : ""}`;
                    id(s?.id, sw);
                    str(s?.name, sw, "name");
                    if (s?.startsAt && !HHMM.test(s.startsAt)) errors.push(`${sw}: "startsAt" must be HH:MM (24h)`);
                    stats.sessions++;

                    const yt = s?.video?.youtubeId;
                    if (!yt || !YT_ID.test(yt)) errors.push(`${sw}: video.youtubeId must be an 11-character YouTube id`);
                    else if (PLACEHOLDER_RE.test(yt)) warnings.push(`${sw}: video.youtubeId is a placeholder`);
                    else if (videos.has(yt)) warnings.push(`${sw}: same video as ${videos.get(yt)}`);
                    else videos.set(yt, s.id);

                    const duration = s?.video?.duration != null ? toSeconds(s.video.duration) : null;
                    if (s?.video?.duration != null && duration === null) errors.push(`${sw}: video.duration is not a valid time`);

                    const markers = (s?.markers || []).map((m, mi) => {
                      const t = toSeconds(m?.t);
                      if (t === null) errors.push(`${sw}.markers[${mi}]: "t" must be seconds or "h:mm:ss"`);
                      if (duration && t > duration) errors.push(`${sw}.markers[${mi}]: time is after the video ends`);
                      str(m?.label, `${sw}.markers[${mi}]`, "label");
                      stats.markers++;
                      return { t: t ?? 0, label: m.label, kind: m.kind || "section" };
                    });
                    markers.sort((a, b) => a.t - b.t);

                    return {
                      id: s.id,
                      name: s.name,
                      startsAt: s.startsAt || null,
                      faculties: s.faculties || [],
                      degrees: s.degrees || [],
                      notes: s.notes || null,
                      video: { youtubeId: yt, duration, title: s?.video?.title || null },
                      markers,
                    };
                  }),
                };
              })
              .sort((a, b) => (a.date < b.date ? -1 : 1)),
          };
        }),
      };
    }),
  };

  return { catalog: errors.length ? null : catalog, errors, warnings, stats };
}

/* ---------- runtime store with hot reload ---------- */

let state = { catalog: { version: 1, universities: [] }, etag: '"empty"', byVideo: new Map(), bySession: new Map(), mtime: 0 };

function index(catalog) {
  const byVideo = new Map();
  const bySession = new Map();
  for (const u of catalog.universities)
    for (const c of u.convocations)
      for (const d of c.days)
        for (const s of d.sessions) {
          const ctx = { university: u.id, convocation: c.id, date: d.date, session: s.id };
          bySession.set(s.id, { ...ctx, youtubeId: s.video.youtubeId });
          if (!byVideo.has(s.video.youtubeId)) byVideo.set(s.video.youtubeId, ctx);
        }
  return { byVideo, bySession };
}

export function loadCatalog() {
  const file = config.catalogFile;
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    console.warn(`[catalog] ${file} not found — catalog is empty`);
    return;
  }
  if (stat.mtimeMs === state.mtime) return;
  try {
    const text = fs.readFileSync(file, "utf8");
    const { catalog, errors, warnings, stats } = validateCatalog(JSON.parse(text));
    if (!catalog) {
      console.error(`[catalog] ${errors.length} error(s) — keeping previous version:\n  ${errors.join("\n  ")}`);
      state.mtime = stat.mtimeMs;
      return;
    }
    warnings.slice(0, 5).forEach((w) => console.warn(`[catalog] warning: ${w}`));
    if (warnings.length > 5) console.warn(`[catalog] …and ${warnings.length - 5} more warnings (run npm run catalog:validate)`);
    state = {
      catalog,
      etag: `"${createHash("sha1").update(text).digest("hex").slice(0, 16)}"`,
      mtime: stat.mtimeMs,
      ...index(catalog),
    };
    console.log(`[catalog] loaded ${path.basename(file)}: ${stats.universities} universities, ${stats.sessions} sessions`);
  } catch (e) {
    console.error(`[catalog] failed to read: ${e.message}`);
    state.mtime = stat.mtimeMs;
  }
}

export function watchCatalog() {
  loadCatalog();
  // Polling is reliable across Docker bind mounts and editors that swap files.
  setInterval(loadCatalog, 3000).unref();
}

export const getCatalog = () => state;
export const isCatalogVideo = (youtubeId) => state.byVideo.has(youtubeId);
export const findByVideo = (youtubeId) => state.byVideo.get(youtubeId) || null;
