/**
 * Parse a user-entered timestamp. Accepts:
 *   "1:02:03", "62:03", "3723", "1:02:03.5", "1h2m3s", "2m30s", "45s"
 * Returns seconds, or null if it can't be parsed.
 */
export function parseTime(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  const unit = s.match(/^(?:(\d+(?:\.\d+)?)h)?\s*(?:(\d+(?:\.\d+)?)m)?\s*(?:(\d+(?:\.\d+)?)s)?$/);
  if (unit && (unit[1] || unit[2] || unit[3])) {
    return (+(unit[1] || 0)) * 3600 + (+(unit[2] || 0)) * 60 + +(unit[3] || 0);
  }

  if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(s)) return null;
  const parts = s.split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** 3723.4 -> "1:02:03.4" (tenths shown only when present). Always h:mm:ss if hours, else m:ss. */
export function formatTime(sec: number, opts: { forceHours?: boolean; tenths?: boolean } = {}) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const whole = Math.floor(sec);
  const tenth = Math.round((sec - whole) * 10);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const ss = String(s).padStart(2, "0");
  const frac = opts.tenths && tenth > 0 && tenth < 10 ? `.${tenth}` : "";
  if (h || opts.forceHours) return `${h}:${String(m).padStart(2, "0")}:${ss}${frac}`;
  return `${m}:${ss}${frac}`;
}

export function formatDuration(sec: number) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}
