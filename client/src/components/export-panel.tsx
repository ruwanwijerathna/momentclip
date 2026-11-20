import { Download, Loader2, Music, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Switch } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDuration } from "@/lib/time";
import { cn } from "@/lib/utils";

export type ExportOptions = { format: "mp4" | "mp3"; quality: string; precise: boolean };

const LABELS: Record<string, string> = { best: "Best available", "2160": "4K · 2160p", "1440": "1440p", "1080": "1080p HD", "720": "720p", "480": "480p", "360": "360p" };

export function ExportPanel({
  options,
  setOptions,
  heights,
  count,
  totalSeconds,
  onExport,
  busy,
  disabled,
}: {
  options: ExportOptions;
  setOptions: (o: ExportOptions) => void;
  heights: number[];
  count: number;
  totalSeconds: number;
  onExport: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const maxH = heights[0] ?? 1080;
  const qualities = ["best", "2160", "1440", "1080", "720", "480", "360"].filter((q) => q === "best" || +q <= maxH);

  return (
    <div className="space-y-4">
      <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1" role="radiogroup" aria-label="Output format">
        {(
          [
            ["mp4", Video, "Video", "MP4"],
            ["mp3", Music, "Audio only", "MP3"],
          ] as const
        ).map(([value, Icon, label, ext]) => (
          <button
            key={value}
            role="radio"
            aria-checked={options.format === value}
            onClick={() => setOptions({ ...options, format: value })}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all pointer-coarse:py-2.5",
              options.format === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" /> {label}
            <span className="text-muted-foreground font-mono text-[10px]">{ext}</span>
          </button>
        ))}
      </div>

      {options.format === "mp4" && (
        <div className="flex items-center justify-between gap-3">
          <Label>Quality</Label>
          <Select value={options.quality} onValueChange={(quality) => setOptions({ ...options, quality })}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {qualities.map((q) => (
                <SelectItem key={q} value={q}>
                  {LABELS[q]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor="precise">Frame-accurate cuts</Label>
          <p className="text-muted-foreground mt-1 text-xs">Re-encodes at the cut points so clips start exactly on time. A bit slower.</p>
        </div>
        <Switch id="precise" checked={options.precise} onCheckedChange={(precise) => setOptions({ ...options, precise })} />
      </div>

      <Button size="lg" className="w-full" onClick={onExport} disabled={disabled || busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />}
        {count ? `Export ${count} clip${count > 1 ? "s" : ""} · ${formatDuration(totalSeconds)}` : "Export clips"}
      </Button>
    </div>
  );
}
