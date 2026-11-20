export type Marker = { t: number; label: string; kind: "ceremony" | "speech" | "faculty" | "degree" | "section" };

export type CatalogSession = {
  id: string;
  name: string;
  startsAt: string | null;
  faculties: string[];
  degrees: string[];
  notes: string | null;
  video: { youtubeId: string; duration: number | null; title: string | null };
  markers: Marker[];
};
export type CatalogDay = { date: string; label: string; sessions: CatalogSession[] };
export type Convocation = { id: string; title: string; year: number | null; days: CatalogDay[] };
export type University = {
  id: string;
  name: string;
  shortName: string;
  location: string | null;
  timezone: string;
  website: string | null;
  convocations: Convocation[];
};
export type Catalog = { version: number; updatedAt: string | null; universities: University[] };

/** One row per session with its full context — what search and the UI work on. */
export type SessionEntry = {
  session: CatalogSession;
  day: CatalogDay;
  convocation: Convocation;
  university: University;
  /** lowercased haystack for search */
  text: string;
};

export function flatten(catalog: Catalog): SessionEntry[] {
  const out: SessionEntry[] = [];
  for (const university of catalog.universities)
    for (const convocation of university.convocations)
      for (const day of convocation.days)
        for (const session of day.sessions)
          out.push({
            session,
            day,
            convocation,
            university,
            text: [
              university.name,
              university.shortName,
              university.location,
              convocation.title,
              convocation.year,
              day.label,
              day.date,
              formatDate(day.date),
              session.name,
              ...session.faculties,
              ...session.degrees,
              ...session.markers.map((m) => m.label),
            ]
              .filter(Boolean)
              .join(" · ")
              .toLowerCase(),
          });
  return out;
}

/** All query words must appear somewhere (order-free). Ranks by how early / how many fields match. */
export function searchSessions(entries: SessionEntry[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return entries;
  return entries
    .filter((e) => words.every((w) => e.text.includes(w)))
    .map((e) => ({ e, score: words.reduce((a, w) => a + e.text.indexOf(w), 0) }))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.e);
}

/** Markers inside a session whose labels match the query — used to deep-jump from search. */
export function matchingMarkers(session: CatalogSession, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return session.markers.filter((m) => words.some((w) => m.label.toLowerCase().includes(w)));
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(+d) ? iso : d.toLocaleDateString(undefined, opts);
}

export function findSession(entries: SessionEntry[], id: string | null) {
  return id ? entries.find((e) => e.session.id === id) ?? null : null;
}

export function findByVideo(entries: SessionEntry[], youtubeId: string) {
  return entries.find((e) => e.session.video.youtubeId === youtubeId) ?? null;
}

export const isPlaceholder = (id: string) => /^REPLACE/i.test(id);
