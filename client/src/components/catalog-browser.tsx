import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Clock, GraduationCap, Link2, MapPin, Search, SearchX, Video, X } from "lucide-react";
import { Badge, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatDate, isPlaceholder, matchingMarkers, searchSessions, type SessionEntry } from "@/lib/catalog";
import { formatDuration, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type Group = { key: string; entry: SessionEntry; days: { date: string; label: string; items: SessionEntry[] }[] };

function group(entries: SessionEntry[]): Group[] {
  const map = new Map<string, Group>();
  for (const e of entries) {
    const key = `${e.university.id}/${e.convocation.id}`;
    if (!map.has(key)) map.set(key, { key, entry: e, days: [] });
    const g = map.get(key)!;
    let day = g.days.find((d) => d.date === e.day.date);
    if (!day) g.days.push((day = { date: e.day.date, label: e.day.label, items: [] }));
    day.items.push(e);
  }
  for (const g of map.values()) g.days.sort((a, b) => a.date.localeCompare(b.date));
  return [...map.values()];
}

export function CatalogBrowser({
  entries,
  loading,
  onOpen,
  onCustom,
}: {
  entries: SessionEntry[];
  loading: boolean;
  onOpen: (e: SessionEntry, startAt?: number) => void;
  /** Omit to hide the custom-link entry points (e.g. CATALOG_ONLY deployments). */
  onCustom?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [uni, setUni] = useState<string | null>(null);
  const [convo, setConvo] = useState<string | null>(null);

  const universities = useMemo(() => {
    const m = new Map<string, SessionEntry["university"]>();
    entries.forEach((e) => m.set(e.university.id, e.university));
    return [...m.values()];
  }, [entries]);

  const convocations = useMemo(
    () => (uni ? universities.find((u) => u.id === uni)?.convocations ?? [] : []),
    [uni, universities]
  );

  const results = useMemo(() => {
    const scoped = entries.filter((e) => (!uni || e.university.id === uni) && (!convo || e.convocation.id === convo));
    return searchSessions(scoped, query);
  }, [entries, uni, convo, query]);

  const groups = useMemo(() => group(results), [results]);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted/50 h-32 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }
  if (!entries.length) return null;

  return (
    <section className="space-y-5" aria-labelledby="browse-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="browse-title" className="sr-only">Find your ceremony</h2>
          <p className="text-muted-foreground text-sm whitespace-nowrap">
            {universities.length} universities · {entries.length} sessions
          </p>
        </div>
        {onCustom && (
          <button onClick={onCustom} className="text-muted-foreground hover:text-foreground flex shrink-0 cursor-pointer items-center gap-1.5 text-sm whitespace-nowrap underline-offset-4 hover:underline pointer-coarse:min-h-10">
            <Link2 className="size-3.5" />
            <span className="hidden sm:inline">Not listed? Use a custom link</span>
            <span className="sm:hidden">Not listed?</span>
          </button>
        )}
      </div>

      <div className="bg-card relative rounded-xl border shadow-sm focus-within:ring-ring/40 focus-within:ring-[3px]">
        <Search className="text-muted-foreground absolute top-1/2 left-4 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. computer science 2026, MBA, Northfield day 2…"
          aria-label="Search sessions"
          type="search"
          enterKeyHint="search"
          className="h-12 border-0 bg-transparent pr-10 pl-11 [&::-webkit-search-cancel-button]:hidden shadow-none focus-visible:ring-0 dark:bg-transparent md:text-base"
        />
        {query && (
          <Button variant="ghost" size="icon-sm" className="absolute top-1/2 right-2 -translate-y-1/2" onClick={() => setQuery("")} aria-label="Clear search">
            <X />
          </Button>
        )}
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="toolbar" aria-label="Filter by university">
        <Chip active={!uni} onClick={() => { setUni(null); setConvo(null); }}>All universities</Chip>
        {universities.map((u) => (
          <Chip key={u.id} active={uni === u.id} onClick={() => { setUni(uni === u.id ? null : u.id); setConvo(null); }}>
            {u.shortName}
            <span className="text-muted-foreground hidden sm:inline">· {u.name}</span>
          </Chip>
        ))}
      </div>
      {convocations.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-1" role="toolbar" aria-label="Filter by convocation">
          {convocations.map((c) => (
            <Chip key={c.id} small active={convo === c.id} onClick={() => setConvo(convo === c.id ? null : c.id)}>
              {c.title}
            </Chip>
          ))}
        </div>
      )}

      {!groups.length ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center text-sm">
          <SearchX className="size-6 opacity-60" />
          <p>
            No sessions match <span className="text-foreground font-medium">“{query}”</span>.
            {onCustom && " If your ceremony isn't listed yet, you can still use its YouTube link."}
          </p>
          {onCustom && (
            <Button variant="outline" onClick={onCustom}>
              <Link2 /> Use a custom YouTube link
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <div key={g.key} className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-lg font-semibold">{g.entry.university.name}</h3>
                <span className="text-primary text-sm font-medium">{g.entry.convocation.title}</span>
                {g.entry.university.location && (
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <MapPin className="size-3" /> {g.entry.university.location}
                  </span>
                )}
              </div>
              {g.days.map((d) => (
                <div key={d.date} className="space-y-2">
                  <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                    <CalendarDays className="size-3.5" /> {d.label} · {formatDate(d.date)}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {d.items.map((e) => (
                      <SessionCard key={e.session.id} entry={e} query={query} onOpen={onOpen} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SessionCard({ entry, query, onOpen }: { entry: SessionEntry; query: string; onOpen: (e: SessionEntry, t?: number) => void }) {
  const { session } = entry;
  const hits = matchingMarkers(session, query).slice(0, 3);
  const placeholder = isPlaceholder(session.video.youtubeId);

  return (
    <div className="bg-card/70 hover:border-primary/50 group relative flex flex-col gap-3 rounded-xl border p-4 text-left backdrop-blur transition-colors">
      <button className="absolute inset-0 cursor-pointer rounded-xl" onClick={() => onOpen(entry)} aria-label={`Open ${session.name}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{session.name}</p>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
            {session.startsAt && (
              <span className="flex items-center gap-1"><Clock className="size-3" /> {session.startsAt}</span>
            )}
            {session.video.duration && (
              <span className="flex items-center gap-1"><Video className="size-3" /> {formatDuration(session.video.duration)}</span>
            )}
            {session.markers.length > 0 && <span>{session.markers.length} markers</span>}
          </p>
        </div>
        <ChevronRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {session.faculties.map((f) => (
          <Badge key={f} variant="secondary"><GraduationCap /> {f}</Badge>
        ))}
        {placeholder && <Badge variant="outline" className="text-amber-500">Video ID not set</Badge>}
      </div>
      {session.degrees.length > 0 && (
        <p className="text-muted-foreground line-clamp-2 text-xs">{session.degrees.join(" · ")}</p>
      )}
      {hits.length > 0 && (
        <div className="relative z-10 flex flex-wrap gap-1.5 border-t pt-3">
          <span className="text-muted-foreground text-xs">Jump to</span>
          {hits.map((m) => (
            <button
              key={m.t}
              onClick={() => onOpen(entry, m.t)}
              className="bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium pointer-coarse:py-1.5"
            >
              {m.label} <span className="font-mono opacity-70">{formatTime(m.t)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, small, onClick, children }: { active: boolean; small?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border font-medium whitespace-nowrap transition-colors pointer-coarse:min-h-10",
        small ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
        active ? "bg-primary text-primary-foreground border-primary [&_span]:text-primary-foreground/70" : "bg-card/60 hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}
