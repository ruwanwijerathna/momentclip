import { ChevronRight, CornerDownRight, Flag, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/primitives";
import { formatDate, type SessionEntry } from "@/lib/catalog";
import { formatTime } from "@/lib/time";

/**
 * Shows which ceremony session is open and its markers as quick jumps.
 * Clicking a marker seeks there; "Use as start" sets the segment start.
 */
export function SessionBar({
  entry,
  onBrowse,
  onSeek,
  onSetStart,
}: {
  entry: SessionEntry;
  onBrowse: () => void;
  onSeek: (t: number) => void;
  onSetStart: (t: number) => void;
}) {
  const { university, convocation, day, session } = entry;

  return (
    <div className="bg-card/70 space-y-3 rounded-xl border p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <nav aria-label="Session" className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
          <button className="hover:text-foreground cursor-pointer" onClick={onBrowse}>{university.shortName}</button>
          <ChevronRight className="size-3.5" />
          <span className="hidden sm:inline">{convocation.title}</span>
          <ChevronRight className="hidden size-3.5 sm:block" />
          <span>{day.label} · {formatDate(day.date, { day: "numeric", month: "short" })}</span>
          <ChevronRight className="size-3.5" />
          <span className="text-foreground font-medium">{session.name}</span>
        </nav>
        <Tooltip content="Copy a link to this session">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy session link"
            onClick={() => {
              const u = new URL(window.location.href);
              u.search = `?session=${session.id}`;
              navigator.clipboard?.writeText(u.toString()).then(() => toast.success("Session link copied"));
            }}
          >
            <LinkIcon />
          </Button>
        </Tooltip>
      </div>

      {session.markers.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {session.markers.map((m) => (
            <div key={m.t} className="bg-background/60 flex shrink-0 items-center overflow-hidden rounded-md border text-xs whitespace-nowrap">
              <button className="hover:bg-accent flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 pointer-coarse:py-2.5" onClick={() => onSeek(m.t)}>
                <Flag className="text-primary size-3" />
                <span className="font-medium">{m.label}</span>
                <span className="text-muted-foreground font-mono">{formatTime(m.t)}</span>
              </button>
              <Tooltip content="Use as segment start">
                <button className="hover:bg-accent text-muted-foreground cursor-pointer self-stretch border-l px-2 py-1.5 pointer-coarse:px-3" onClick={() => onSetStart(m.t)} aria-label={`Set start to ${m.label}`}>
                  <CornerDownRight className="size-3" />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
      {session.notes && <p className="text-muted-foreground text-xs">{session.notes}</p>}
    </div>
  );
}
