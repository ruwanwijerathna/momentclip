export type VideoInfo = {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  isLive: boolean;
  heights: number[];
  chapters: { title: string; start: number; end: number }[];
  catalog?: { university: string; convocation: string; date: string; session: string } | null;
};

export type Segment = { id: string; label: string; start: number; end: number };

export type ClipStatus = "queued" | "downloading" | "processing" | "done" | "error";

export type Job = {
  id: string;
  videoId: string;
  title: string;
  format: "mp4" | "mp3";
  quality: string;
  status: "running" | "done" | "error";
  progress: number;
  expiresAt: number;
  clips: {
    id: string;
    index: number;
    label: string;
    start: number;
    end: number;
    status: ClipStatus;
    progress: number;
    size: number;
    error: string | null;
  }[];
};

export type ServerConfig = {
  maxSegments: number;
  maxSegmentSeconds: number;
  qualities: string[];
  formats: string[];
  jobTtlMinutes: number;
  catalogOnly?: boolean;
};

const BASE = import.meta.env.VITE_API_URL ?? "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  config: () => req<ServerConfig>("/api/config"),
  catalog: () => req<import("./catalog").Catalog>("/api/catalog"),
  info: (url: string) => req<VideoInfo>(`/api/info?url=${encodeURIComponent(url)}`),
  createJob: (payload: {
    url: string;
    segments: { start: number; end: number; label: string }[];
    format: string;
    quality: string;
    precise: boolean;
  }) => req<Job>("/api/jobs", { method: "POST", body: JSON.stringify(payload) }),
  eventsUrl: (id: string) => `${BASE}/api/jobs/${id}/events`,
  clipUrl: (jobId: string, clipId: string) => `${BASE}/api/jobs/${jobId}/clips/${clipId}`,
  zipUrl: (jobId: string) => `${BASE}/api/jobs/${jobId}/zip`,
};

/** Client-side mirror of the server's URL parsing, for instant feedback + embed. */
export function extractVideoId(input: string): string | null {
  const raw = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
    if (host === "youtu.be") return u.pathname.slice(1, 12) || null;
    if (host === "youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = u.pathname.match(/^\/(?:live|shorts|embed)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    /* noop */
  }
  return null;
}

/** Reads ?t= / &t= start hints like youtu.be/xyz?t=754 */
export function extractStartHint(input: string): number | null {
  try {
    const u = new URL(input.trim());
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    if (!t) return null;
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (!m) return null;
    return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + +(m[3] || 0);
  } catch {
    return null;
  }
}
