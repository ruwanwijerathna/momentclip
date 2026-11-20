import { useRef } from "react";
import type { Segment } from "@/lib/api";
import { formatTime } from "@/lib/time";
import { Slider } from "@/components/ui/slider";

export const clipColor = (i: number) => `var(--clip-${(i % 5) + 1})`;

/**
 * Whole-video timeline: saved segments are drawn as coloured bands, the
 * draft range is a two-thumb slider, and the playhead is a thin line.
 * Click anywhere on the band strip to seek.
 */
export function Timeline({
  duration,
  time,
  draft,
  onDraftChange,
  segments,
  onSeek,
  chapters,
}: {
  duration: number;
  time: number;
  draft: [number, number];
  onDraftChange: (v: [number, number]) => void;
  segments: Segment[];
  onSeek: (s: number) => void;
  chapters: { title: string; start: number }[];
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const pct = (s: number) => `${(Math.min(s, duration) / duration) * 100}%`;
  const ticks = Array.from({ length: 5 }, (_, i) => (duration * i) / 4);

  return (
    <div className="space-y-2 select-none">
      <div
        ref={stripRef}
        className="bg-muted/60 relative h-9 pointer-coarse:h-11 cursor-pointer overflow-hidden rounded-md border"
        onClick={(e) => {
          const r = stripRef.current!.getBoundingClientRect();
          onSeek(((e.clientX - r.left) / r.width) * duration);
        }}
        role="presentation"
      >
        {chapters.map((c) => (
          <div key={c.start} title={c.title} className="bg-border absolute inset-y-0 w-px" style={{ left: pct(c.start) }} />
        ))}
        {segments.map((s, i) => (
          <div
            key={s.id}
            title={`${s.label} · ${formatTime(s.start)}–${formatTime(s.end)}`}
            className="absolute inset-y-1.5 rounded-sm opacity-80"
            style={{ left: pct(s.start), width: `max(3px, calc(${pct(s.end)} - ${pct(s.start)}))`, background: clipColor(i) }}
          />
        ))}
        <div
          className="border-primary bg-primary/15 absolute inset-y-0 border-x-2 border-dashed"
          style={{ left: pct(draft[0]), width: `calc(${pct(draft[1])} - ${pct(draft[0])})` }}
        />
        <div className="bg-foreground absolute inset-y-0 w-0.5 shadow" style={{ left: pct(time) }} />
      </div>

      <Slider
        min={0}
        max={duration}
        step={0.5}
        minStepsBetweenThumbs={1}
        value={draft}
        onValueChange={(v) => onDraftChange([v[0], v[1]] as [number, number])}
        aria-label="Segment range"
      />

      <div className="text-muted-foreground tabular flex justify-between font-mono text-[11px]">
        {ticks.map((t) => (
          <span key={t}>{formatTime(t)}</span>
        ))}
      </div>
    </div>
  );
}
