#!/usr/bin/env node
/**
 * Build convocations.json from flat spreadsheets — far easier to maintain
 * for dozens of sessions than hand-editing nested JSON.
 *
 *   node scripts/csv-to-catalog.js sessions.csv [markers.csv] > catalog/convocations.json
 *
 * sessions.csv columns (header row required, order free):
 *   university_id, university_name, university_short, location, timezone,
 *   convocation_id, convocation_title, date, day_label,
 *   session_id, session_name, starts_at, faculties, degrees, youtube_url, duration, notes
 *   (faculties / degrees are separated by "|")
 *
 * markers.csv columns: session_id, time, label, kind
 */
import fs from "node:fs";
import { validateCatalog } from "../src/catalog.js";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") row.push(field), (field = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  const keys = head.map((h) => h.trim().toLowerCase().replace(/^﻿/, ""));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const ytId = (s) => {
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : s;
};
const list = (s) => (s ? s.split("|").map((x) => x.trim()).filter(Boolean) : []);

const [sessionsFile, markersFile] = process.argv.slice(2);
if (!sessionsFile) {
  console.error("Usage: node scripts/csv-to-catalog.js sessions.csv [markers.csv] > convocations.json");
  process.exit(1);
}

const markers = new Map();
if (markersFile) {
  for (const m of parseCsv(fs.readFileSync(markersFile, "utf8"))) {
    if (!markers.has(m.session_id)) markers.set(m.session_id, []);
    markers.get(m.session_id).push({ t: m.time, label: m.label, ...(m.kind ? { kind: m.kind } : {}) });
  }
}

const unis = new Map();
for (const r of parseCsv(fs.readFileSync(sessionsFile, "utf8"))) {
  if (!unis.has(r.university_id))
    unis.set(r.university_id, {
      id: r.university_id,
      name: r.university_name,
      ...(r.university_short && { shortName: r.university_short }),
      ...(r.location && { location: r.location }),
      timezone: r.timezone || "Asia/Colombo",
      convocations: new Map(),
    });
  const u = unis.get(r.university_id);
  if (!u.convocations.has(r.convocation_id))
    u.convocations.set(r.convocation_id, { id: r.convocation_id, title: r.convocation_title, days: new Map() });
  const c = u.convocations.get(r.convocation_id);
  if (!c.days.has(r.date)) c.days.set(r.date, { date: r.date, ...(r.day_label && { label: r.day_label }), sessions: [] });
  c.days.get(r.date).sessions.push({
    id: r.session_id,
    name: r.session_name,
    ...(r.starts_at && { startsAt: r.starts_at }),
    faculties: list(r.faculties),
    degrees: list(r.degrees),
    ...(r.notes && { notes: r.notes }),
    video: { youtubeId: ytId(r.youtube_url), ...(r.duration && { duration: r.duration }) },
    markers: markers.get(r.session_id) || [],
  });
}

const out = {
  $schema: "./convocations.schema.json",
  version: 1,
  updatedAt: new Date().toISOString().slice(0, 10),
  universities: [...unis.values()].map((u) => ({
    ...u,
    convocations: [...u.convocations.values()].map((c) => ({
      ...c,
      days: [...c.days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    })),
  })),
};

const { errors, warnings } = validateCatalog(out);
warnings.forEach((w) => console.error(`! ${w}`));
if (errors.length) {
  errors.forEach((e) => console.error(`✗ ${e}`));
  process.exit(1);
}
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
