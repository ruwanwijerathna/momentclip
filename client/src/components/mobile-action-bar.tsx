import { ArrowLeftToLine, ArrowRightToLine, ChevronUp, Download, Layers, Loader2, Pause, Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** True while a text field has focus (i.e. the on-screen keyboard is likely open). */
function useTyping() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (el: EventTarget | null) => el instanceof HTMLElement && el.matches("input:not([type=checkbox]):not([type=radio]), textarea");
    const on = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const off = (e: FocusEvent) => isField(e.target) && !isField(e.relatedTarget) && setTyping(false);
    document.addEventListener("focusin", on);
    document.addEventListener("focusout", off);
    return () => {
      document.removeEventListener("focusin", on);
      document.removeEventListener("focusout", off);
    };
  }, []);
  return typing;
}
import { formatDuration, formatTime } from "@/lib/time";
import type { Job } from "@/lib/api";

/**
 * Thumb-zone controls for phones (hidden on lg+). Replaces the I / O / A / Space
 * keyboard shortcuts and opens the clips sheet.
 */
export function MobileActionBar({
  time,
  playing,
  playerReady,
  draft,
  draftError,
  onToggle,
  onMarkStart,
  onMarkEnd,
  onAdd,
  canAdd,
  clipCount,
  onOpenClips,
  job,
}: {
  time: number;
  playing: boolean;
  playerReady: boolean;
  draft: { start: number; end: number };
  draftError: string | null;
  onToggle: () => void;
  onMarkStart: () => void;
  onMarkEnd: () => void;
  onAdd: () => void;
  canAdd: boolean;
  clipCount: number;
  onOpenClips: () => void;
  job: Job | null;
}) {
  const typing = useTyping();
  return (
    <div
      className={cn(
        "bg-background/85 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl transition-transform duration-200 lg:hidden",
        typing && "pointer-coarse:translate-y-full"
      )}
    >
      <div className="mx-auto max-w-2xl px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {job ? (
          <BarButton primary wide onClick={onOpenClips}>
            {job.status === "running" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Exporting… {Math.round(job.progress * 100)}%
              </>
            ) : (
              <>
                <Download className="size-4" />
                {job.clips.filter((c) => c.status === "done").length} clips ready, tap to download
              </>
            )}
          </BarButton>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs">
              <button
                onClick={onToggle}
                disabled={!playerReady}
                className="text-foreground flex cursor-pointer items-center gap-1.5 font-mono tabular disabled:opacity-50"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {formatTime(time)}
              </button>
              <span className={cn("truncate font-mono tabular", draftError ? "text-destructive" : "text-muted-foreground")}>
                {formatTime(draft.start)} → {formatTime(draft.end)}
                {!draftError && ` · ${formatDuration(draft.end - draft.start)}`}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_1fr_1.3fr] gap-2">
              <BarButton onClick={onMarkStart} disabled={!playerReady} label="Start">
                <ArrowLeftToLine className="size-4" />
              </BarButton>
              <BarButton onClick={onMarkEnd} disabled={!playerReady} label="End">
                <ArrowRightToLine className="size-4" />
              </BarButton>
              <BarButton onClick={onAdd} disabled={!canAdd} label="Add">
                <Plus className="size-4" />
              </BarButton>
              <BarButton primary onClick={onOpenClips} label={clipCount ? `${clipCount} clip${clipCount > 1 ? "s" : ""}` : "Clips"}>
                <span className="flex items-center gap-1">
                  <Layers className="size-4" />
                  <ChevronUp className="size-3" />
                </span>
              </BarButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BarButton({
  children,
  label,
  primary,
  wide,
  ...props
}: React.ComponentProps<"button"> & { label?: string; primary?: boolean; wide?: boolean }) {
  return (
    <button
      {...props}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-xl text-xs font-medium transition-colors active:scale-[0.97] disabled:opacity-40",
        wide ? "h-12 w-full gap-2 text-sm" : "h-14 flex-col gap-1",
        primary ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
      )}
    >
      {children}
      {label && <span>{label}</span>}
    </button>
  );
}
