import { Play, Plus, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Kbd, Label } from "@/components/ui/primitives";
import { TimeInput } from "@/components/time-input";
import { formatDuration } from "@/lib/time";

export type Draft = { start: number; end: number; label: string };

/** Primary input: explicit start + end timestamps for the portion to export. */
export function SegmentEditor({
  draft,
  setDraft,
  duration,
  playerReady,
  getTime,
  onPreview,
  onAdd,
  canAdd,
  error,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  duration: number;
  playerReady: boolean;
  getTime: () => number;
  onPreview: () => void;
  onAdd: () => void;
  canAdd: boolean;
  error: string | null;
}) {
  const len = draft.end - draft.start;
  const hours = duration >= 3600;

  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scissors className="text-primary size-4" /> Cut a segment
        </CardTitle>
        <CardDescription>
          <span className="pointer-coarse:hidden">
            Type the start and end times, or scrub the player and hit <Kbd>I</Kbd> / <Kbd>O</Kbd>.
          </span>
          <span className="hidden pointer-coarse:inline">
            Type times (digits fill in: <span className="font-mono">10205</span> → <span className="font-mono">1:02:05</span>) or tap
            Start / End at the bottom while the video plays.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="seg-start">Start time</Label>
            <TimeInput
              id="seg-start"
              value={draft.start}
              max={duration}
              forceHours={hours}
              onChange={(start) => setDraft({ ...draft, start, end: Math.max(draft.end, Math.min(duration, start + 1)) })}
              onUsePlayer={playerReady ? () => setDraft({ ...draft, start: round(getTime()) }) : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seg-end">End time</Label>
            <TimeInput
              id="seg-end"
              value={draft.end}
              max={duration}
              forceHours={hours}
              onChange={(end) => setDraft({ ...draft, end })}
              onUsePlayer={playerReady ? () => setDraft({ ...draft, end: round(getTime()) }) : undefined}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seg-label">Label (optional)</Label>
          <Input
            id="seg-label"
            value={draft.label}
            maxLength={80}
            placeholder="e.g. Ruwan crossing the stage"
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && canAdd && onAdd()}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={error ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>
            {error ?? (
              <>
                Length <span className="text-foreground tabular font-medium">{formatDuration(len)}</span>
              </>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="pointer-coarse:h-11" onClick={onPreview} disabled={!playerReady || !!error}>
              <Play /> Preview
            </Button>
            <Button className="pointer-coarse:h-11" onClick={onAdd} disabled={!canAdd}>
              <Plus /> Add segment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;
