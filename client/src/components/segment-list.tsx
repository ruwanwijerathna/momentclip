import { Film, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Tooltip } from "@/components/ui/primitives";
import { TimeInput } from "@/components/time-input";
import { clipColor } from "@/components/timeline";
import type { Segment } from "@/lib/api";
import { formatDuration } from "@/lib/time";

export function SegmentList({
  segments,
  duration,
  onChange,
  onRemove,
  onPlay,
}: {
  segments: Segment[];
  duration: number;
  onChange: (s: Segment) => void;
  onRemove: (id: string) => void;
  onPlay: (s: Segment) => void;
}) {
  if (!segments.length) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center text-sm">
        <Film className="size-6 opacity-60" />
        <p>
          No segments yet. Set a start and end time, then <span className="text-foreground font-medium">Add segment</span>.
        </p>
      </div>
    );
  }
  const hours = duration >= 3600;

  return (
    <ul className="space-y-2">
      {segments.map((s, i) => {
        const bad = s.end <= s.start;
        return (
          <li key={s.id} className="bg-background/40 group animate-in fade-in-0 slide-in-from-top-1 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: clipColor(i) }} />
              <Input
                value={s.label}
                aria-label={`Label for segment ${i + 1}`}
                onChange={(e) => onChange({ ...s, label: e.target.value })}
                className="h-7 border-transparent bg-transparent px-1.5 font-medium shadow-none hover:border-input dark:bg-transparent"
              />
              <Tooltip content="Preview">
                <Button variant="ghost" size="icon-sm" className="pointer-coarse:size-10" onClick={() => onPlay(s)} aria-label="Preview segment">
                  <Play />
                </Button>
              </Tooltip>
              <Tooltip content="Remove">
                <Button variant="ghost" size="icon-sm" onClick={() => onRemove(s.id)} aria-label="Remove segment" className="hover:text-destructive pointer-coarse:size-10">
                  <Trash2 />
                </Button>
              </Tooltip>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-4.5 text-xs">
              <TimeInput compact forceHours={hours} value={s.start} max={duration} onChange={(start) => onChange({ ...s, start })} />
              <span className="text-muted-foreground">→</span>
              <TimeInput compact forceHours={hours} value={s.end} max={duration} onChange={(end) => onChange({ ...s, end })} />
              <span className={bad ? "text-destructive ml-auto" : "text-muted-foreground tabular ml-auto"}>
                {bad ? "End must be after start" : formatDuration(s.end - s.start)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
