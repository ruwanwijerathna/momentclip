import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Download, Link2, Moon, Scissors, Search, Sun, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Separator } from "@/components/ui/primitives";
import { CustomVideoDialog } from "@/components/custom-video-dialog";
import { Timeline } from "@/components/timeline";
import { SegmentEditor, type Draft } from "@/components/segment-editor";
import { SegmentList } from "@/components/segment-list";
import { ExportPanel, type ExportOptions } from "@/components/export-panel";
import { JobPanel } from "@/components/job-panel";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useJob } from "@/hooks/use-job";
import { CatalogBrowser } from "@/components/catalog-browser";
import { SessionBar } from "@/components/session-bar";
import { findByVideo, findSession, flatten, type SessionEntry } from "@/lib/catalog";
import { useTheme } from "@/hooks/use-theme";
import { useYouTubePlayer } from "@/hooks/use-youtube-player";
import { api, extractStartHint, extractVideoId, type Job, type Segment, type ServerConfig, type VideoInfo } from "@/lib/api";
import { formatDuration, formatTime } from "@/lib/time";

const DEFAULT_CFG: ServerConfig = { maxSegments: 10, maxSegmentSeconds: 1800, qualities: [], formats: [], jobTtlMinutes: 60 };
const uid = () => Math.random().toString(36).slice(2, 9);

export default function App() {
  const { dark, toggle } = useTheme();
  const [cfg, setCfg] = useState<ServerConfig>(DEFAULT_CFG);
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft>({ start: 0, end: 30, label: "" });
  const [segments, setSegments] = useState<Segment[]>([]);
  const [options, setOptions] = useState<ExportOptions>({ format: "mp4", quality: "1080", precise: true });
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [active, setActive] = useState<SessionEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const { job: liveJob, lost } = useJob(job);

  const player = useYouTubePlayer(info?.id ?? null, draft.start);

  useEffect(() => {
    api.config().then(setCfg).catch(() => {});
    api
      .catalog()
      .then((c) => setEntries(flatten(c)))
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, []);

  const setUrlParams = (params: Record<string, string> | null) => {
    const u = new URL(window.location.href);
    u.search = params ? `?${new URLSearchParams(params)}` : "";
    window.history.replaceState(null, "", u);
  };

  /** Returns true when the video opened. */
  const load = async (u: string, entryArg?: SessionEntry | null): Promise<boolean> => {
    setLoading(true);
    const vid = extractVideoId(u);
    const entry = entryArg ?? (vid ? findByVideo(entries, vid) : null);
    try {
      let data: VideoInfo;
      try {
        data = await api.info(u);
      } catch (err) {
        // Catalog sessions carry their own duration, so the editor still works if lookup fails.
        if (!entry?.session.video.duration) throw err;
        toast.warning(`Couldn't fetch video details (${(err as Error).message}). Using catalog data.`);
        data = {
          id: entry.session.video.youtubeId,
          title: entry.session.video.title || `${entry.university.shortName} · ${entry.convocation.title} · ${entry.session.name}`,
          channel: entry.university.name,
          duration: entry.session.video.duration,
          thumbnail: `https://i.ytimg.com/vi/${entry.session.video.youtubeId}/hqdefault.jpg`,
          isLive: false,
          heights: [1080, 720, 480, 360],
          chapters: [],
        };
      }
      setActive(entry);
      setUrlParams(entry ? { session: entry.session.id, ...(extractStartHint(u) ? { t: String(extractStartHint(u)) } : {}) } : { v: data.id });
      if (data.isLive) toast.warning("This stream is still live — clips can be exported once it ends.");
      const hint = extractStartHint(u) ?? 0;
      setInfo(data);
      setUrl(u);
      setSegments([]);
      setJob(null);
      setDraft({ start: Math.min(hint, data.duration), end: Math.min(hint + 30, data.duration), label: "" });
      setOptions((o) => ({ ...o, quality: data.heights[0] && data.heights[0] < 1080 ? String(data.heights[0]) : "1080" }));
      // A pasted link that turns out to be a catalog session gets its markers too.
      if (!entryArg && entry) toast.success(`Found in our list: ${entry.university.shortName} · ${entry.session.name}. Markers added.`);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const openEntry = (e: SessionEntry, t?: number) =>
    load(`https://www.youtube.com/watch?v=${e.session.video.youtubeId}${t ? `&t=${Math.floor(t)}` : ""}`, e);

  // Deep links: ?session=<id>[&t=<sec>] or ?v=<youtubeId>
  const [deepLinked, setDeepLinked] = useState(false);
  useEffect(() => {
    if (deepLinked || catalogLoading) return;
    setDeepLinked(true);
    const q = new URLSearchParams(window.location.search);
    const e = findSession(entries, q.get("session"));
    const t = Number(q.get("t")) || undefined;
    if (e) openEntry(e, t);
    else if (q.get("v")) load(`https://www.youtube.com/watch?v=${q.get("v")}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogLoading, entries]);

  const goHome = () => {
    setInfo(null);
    setJob(null);
    setActive(null);
    setUrlParams(null);
  };

  const timelineMarks = useMemo(
    () => [
      ...(info?.chapters ?? []).map((c) => ({ title: c.title, start: c.start })),
      ...(active?.session.markers ?? []).map((m) => ({ title: m.label, start: m.t })),
    ],
    [info, active]
  );

  const duration = info?.duration ?? 0;
  const draftError = useMemo(() => {
    if (!info) return null;
    if (draft.end <= draft.start) return "End time must be after the start time.";
    if (draft.end > duration + 0.5) return `End time is past the video's end (${formatTime(duration)}).`;
    if (draft.end - draft.start > cfg.maxSegmentSeconds) return `Segments can be up to ${formatDuration(cfg.maxSegmentSeconds)}.`;
    return null;
  }, [draft, duration, info, cfg.maxSegmentSeconds]);

  const canAdd = !draftError && segments.length < cfg.maxSegments;

  const addSegment = useCallback(() => {
    if (!canAdd) {
      if (segments.length >= cfg.maxSegments) toast.error(`Up to ${cfg.maxSegments} segments per export.`);
      return;
    }
    const n = segments.length + 1;
    setSegments((s) => [...s, { id: uid(), label: draft.label.trim() || `Clip ${n}`, start: draft.start, end: draft.end }]);
    const len = draft.end - draft.start;
    setDraft({ start: draft.end, end: Math.min(duration, draft.end + len), label: "" });
    toast.success(`Added ${formatTime(draft.start)} → ${formatTime(draft.end)}`);
  }, [canAdd, segments.length, cfg.maxSegments, draft, duration]);

  const markStart = useCallback(() => {
    const t = Math.round(player.getTime() * 10) / 10;
    setDraft((d) => ({ ...d, start: t, end: d.end <= t ? Math.min(duration, t + 10) : d.end }));
    navigator.vibrate?.(10);
  }, [player, duration]);
  const markEnd = useCallback(() => {
    const t = Math.round(player.getTime() * 10) / 10;
    setDraft((d) => ({ ...d, end: t }));
    navigator.vibrate?.(10);
  }, [player]);

  // Keyboard shortcuts: I = set start, O = set end, Space = play/pause, A = add
  useEffect(() => {
    if (!info || job) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [role=combobox], [role=listbox]") || e.metaKey || e.ctrlKey) return;
      if (e.key === "i") markStart();
      else if (e.key === "o") markEnd();
      else if (e.key === "a") addSegment();
      else if (e.key === " ") {
        e.preventDefault();
        player.toggle();
      } else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [info, job, player, addSegment, markStart, markEnd]);

  const totalSeconds = segments.reduce((a, s) => a + Math.max(0, s.end - s.start), 0);
  const segmentsValid = segments.length > 0 && segments.every((s) => s.end > s.start);

  const startExport = async () => {
    if (!info) return;
    setSubmitting(true);
    try {
      const created = await api.createJob({
        url,
        segments: segments.map(({ start, end, label }) => ({ start, end, label })),
        ...options,
      });
      setJob(created);
      if (!isDesktop) setSheetOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const clipsSummary = `${segments.length}/${cfg.maxSegments} segments · ${formatDuration(totalSeconds)} total`;
  const clipsBody = info && (
    <>
      <SegmentList
        segments={segments}
        duration={duration}
        onChange={(s) => setSegments((all) => all.map((x) => (x.id === s.id ? s : x)))}
        onRemove={(id) => setSegments((all) => all.filter((x) => x.id !== id))}
        onPlay={(s) => {
          player.playRange(s.start, s.end);
          if (!isDesktop) setSheetOpen(false);
        }}
      />
      <Separator />
      <ExportPanel
        options={options}
        setOptions={setOptions}
        heights={info.heights}
        count={segments.length}
        totalSeconds={totalSeconds}
        onExport={startExport}
        busy={submitting}
        disabled={!segmentsValid || info.isLive}
      />
    </>
  );
  const disclaimer = (
    <p className="text-muted-foreground px-1 text-xs leading-relaxed">
      Only download videos you own or have permission to use. Clips are deleted from our servers after {cfg.jobTtlMinutes} minutes.
    </p>
  );

  return (
    <div className="bg-grain min-h-dvh">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-4">
        <button className="flex cursor-pointer items-center gap-2" onClick={goHome}>
          <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
            <Scissors className="size-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight">MomentClip</span>
        </button>
        <div className="flex items-center gap-2">
          {!cfg.catalogOnly && (
            <Button variant="outline" size="sm" className="pointer-coarse:h-10" onClick={() => setCustomOpen(true)}>
              <Link2 /> Custom video
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {dark ? <Sun /> : <Moon />}
          </Button>
        </div>
      </header>

      <CustomVideoDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        loading={loading}
        onSubmit={async (u) => {
          if (await load(u)) setCustomOpen(false);
        }}
      />

      {!info ? (
        <main className="mx-auto flex max-w-4xl flex-col items-center px-4 pt-8 pb-24 text-center sm:pt-24">
          <Badge variant="outline" className="bg-background/50 mb-5 max-w-full truncate backdrop-blur sm:mb-6">
            <span className="bg-primary size-1.5 rounded-full" /> Graduations · recitals · keynotes · livestream replays
          </Badge>
          <h1 className="font-display text-[2.6rem] leading-[1.02] tracking-tight text-balance sm:text-7xl">
            Skip the three-hour stream.
            <br />
            <span className="text-primary italic">Keep your moment.</span>
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-base sm:mt-6 sm:text-lg">
            Find your convocation session, set the start and end time, and download just your moment as an MP4 or MP3.
          </p>
          <div className="mt-8 w-full max-w-4xl text-left sm:mt-10">
            <CatalogBrowser
              entries={entries}
              loading={catalogLoading}
              onOpen={openEntry}
              onCustom={cfg.catalogOnly ? undefined : () => setCustomOpen(true)}
            />
            {!catalogLoading && !entries.length && !cfg.catalogOnly && (
              <div className="flex justify-center">
                <Button size="lg" onClick={() => setCustomOpen(true)}>
                  <Link2 /> Use a YouTube link
                </Button>
              </div>
            )}
          </div>
          <div className="mt-12 grid w-full gap-3 text-left sm:mt-16 sm:grid-cols-3 sm:gap-4">
            {[
              [Search, "Find your session", "Search by university, faculty, degree or date. Not listed? Use Custom video with any YouTube link."],
              [Clock, "Set start & end", "Type exact times like 1:42:05, or mark them while you watch."],
              [Download, "Download", "Get frame-accurate clips in up to 4K, or audio-only, one by one or as a ZIP."],
            ].map(([Icon, title, body], i) => {
              const I = Icon as typeof Link2;
              return (
                <div key={i} className="bg-card/60 rounded-xl border p-5 backdrop-blur">
                  <div className="text-primary mb-3 flex items-center gap-2 font-mono text-xs">
                    <I className="size-4" /> 0{i + 1}
                  </div>
                  <p className="font-medium">{title as string}</p>
                  <p className="text-muted-foreground mt-1 text-sm">{body as string}</p>
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        <main className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4 px-4 pb-48 sm:gap-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-16">
          <div className="space-y-4 sm:space-y-6">
            {/* Player pins to the top on phones so it stays visible while you set times */}
            <div className="sticky top-0 z-30 -mx-4 !mb-0 overflow-hidden bg-black shadow-lg sm:mx-0 sm:rounded-t-xl sm:border sm:border-b-0 lg:static lg:shadow-none [@media(max-height:520px)]:static">
              <div className="relative aspect-video">
                <div ref={player.mountRef} className="absolute inset-0 [&>iframe]:size-full" />
                {!player.ready && (
                  <img src={info.thumbnail} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
                )}
              </div>
            </div>
            <Card className="!mt-0 gap-0 rounded-t-none border-t-0 py-0 max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0">
              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold sm:text-lg">{info.title}</h2>
                    <p className="text-muted-foreground truncate text-sm">{info.channel}</p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    {info.isLive && <Badge variant="destructive"><Tv /> Live</Badge>}
                    <Badge variant="secondary" className="tabular font-mono">
                      {formatTime(player.time)} / {formatTime(duration)}
                    </Badge>
                  </div>
                </div>
                {duration > 0 && (
                  <Timeline
                    duration={duration}
                    time={player.time}
                    draft={[draft.start, Math.min(draft.end, duration)]}
                    onDraftChange={([start, end]) => setDraft({ ...draft, start, end })}
                    segments={segments}
                    onSeek={player.seek}
                    chapters={timelineMarks}
                  />
                )}
              </div>
            </Card>

            {active && (
              <SessionBar
                entry={active}
                onBrowse={goHome}
                onSeek={player.seek}
                onSetStart={(t) => {
                  player.seek(t);
                  setDraft((d) => ({ ...d, start: t, end: d.end > t ? d.end : Math.min(duration, t + 30) }));
                }}
              />
            )}

            {!job && (
              <SegmentEditor
                draft={draft}
                setDraft={setDraft}
                duration={duration}
                playerReady={player.ready}
                getTime={player.getTime}
                onPreview={() => player.playRange(draft.start, draft.end)}
                onAdd={addSegment}
                canAdd={canAdd}
                error={draftError}
              />
            )}
          </div>

          {isDesktop ? (
            <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              {liveJob ? (
                <JobPanel job={liveJob} lost={lost} onReset={() => setJob(null)} />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Your clips</CardTitle>
                    <CardDescription>{clipsSummary}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">{clipsBody}</CardContent>
                </Card>
              )}
              {disclaimer}
            </aside>
          ) : (
            <>
              <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
                <DrawerContent>
                  {liveJob ? (
                    <div className="overflow-y-auto px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
                      <JobPanel job={liveJob} lost={lost} onReset={() => { setJob(null); setSheetOpen(false); }} className="border-0 bg-transparent shadow-none" />
                    </div>
                  ) : (
                    <>
                      <DrawerHeader>
                        <DrawerTitle>Your clips</DrawerTitle>
                        <DrawerDescription>{clipsSummary}</DrawerDescription>
                      </DrawerHeader>
                      <div className="space-y-6 overflow-y-auto px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                        {clipsBody}
                        {disclaimer}
                      </div>
                    </>
                  )}
                </DrawerContent>
              </Drawer>
              <MobileActionBar
                time={player.time}
                playing={player.playing}
                playerReady={player.ready}
                draft={draft}
                draftError={draftError}
                onToggle={player.toggle}
                onMarkStart={markStart}
                onMarkEnd={markEnd}
                onAdd={addSegment}
                canAdd={canAdd}
                clipCount={segments.length}
                onOpenClips={() => setSheetOpen(true)}
                job={liveJob}
              />
            </>
          )}
        </main>
      )}
    </div>
  );
}
