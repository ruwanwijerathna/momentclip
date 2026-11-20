import { useEffect, useState } from "react";
import { Crosshair, Minus, Plus } from "lucide-react";
import { Input, Tooltip } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatTime, parseTime } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Microwave-style mask: digits fill from the right → "10205" shows as "1:02:05". */
export function maskDigits(value: string) {
  if (!/^[\d:]*$/.test(value)) return value; // leave "1h2m", "1:02.5" etc. alone
  const d = value.replace(/:/g, "").replace(/^0+(?=\d)/, "").slice(-6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, -2)}:${d.slice(-2)}`;
  return `${d.slice(0, -4)}:${d.slice(-4, -2)}:${d.slice(-2)}`;
}

type Props = {
  id?: string;
  value: number;
  onChange: (sec: number) => void;
  max?: number;
  onUsePlayer?: () => void;
  forceHours?: boolean;
  className?: string;
  compact?: boolean;
};

/**
 * Timestamp field. Type "1:02:03", "62:03", "3723" or "1h2m3s" and press
 * Enter/Tab. ↑/↓ nudge by 1s (Shift = 10s, Alt = 0.1s).
 */
export function TimeInput({ id, value, onChange, max = Infinity, onUsePlayer, forceHours, className, compact }: Props) {
  const fmt = (v: number) => formatTime(v, { forceHours, tenths: true });
  const [draft, setDraft] = useState(fmt(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(fmt(value));
    setInvalid(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, forceHours]);

  const commit = () => {
    const sec = parseTime(draft);
    if (sec === null || sec > max) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(Math.round(sec * 10) / 10);
    setDraft(fmt(sec));
  };

  const nudge = (d: number) => onChange(Math.min(max, Math.max(0, Math.round((value + d) * 10) / 10)));

  return (
    <div className={cn("flex items-center gap-1", !compact && "w-full sm:w-auto", className)}>
      {!compact && (
        <Button type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-11" aria-label="Back 1 second" onClick={() => nudge(-1)}>
          <Minus />
        </Button>
      )}
      <Input
        id={id}
        value={draft}
        inputMode="numeric"
        enterKeyHint="done"
        autoComplete="off"
        onFocus={(e) => e.currentTarget.select()}
        spellCheck={false}
        aria-invalid={invalid}
        placeholder="0:00:00"
        className={cn(
          "tabular font-mono text-center",
          compact ? "h-8 w-24 text-xs pointer-coarse:h-10 pointer-coarse:text-sm" : "w-28 pointer-coarse:h-11 pointer-coarse:text-base flex-1 sm:flex-none"
        )}
        onChange={(e) => setDraft(maskDigits(e.target.value))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
            nudge(e.key === "ArrowUp" ? step : -step);
          } else if (e.key === "Escape") {
            setDraft(fmt(value));
            setInvalid(false);
          }
        }}
      />
      {!compact && (
        <Button type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-11" aria-label="Forward 1 second" onClick={() => nudge(1)}>
          <Plus />
        </Button>
      )}
      {onUsePlayer && (
        <Tooltip content="Use the player's current time">
          <Button type="button" variant="outline" size="icon-sm" className="pointer-coarse:size-11" aria-label="Use player time" onClick={onUsePlayer}>
            <Crosshair />
          </Button>
        </Tooltip>
      )}
    </div>
  );
}
