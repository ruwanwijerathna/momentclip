import { AlertCircle, CheckCircle2, Download, FileArchive, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, Progress } from "@/components/ui/primitives";
import { clipColor } from "@/components/timeline";
import { api, type Job } from "@/lib/api";
import { formatTime } from "@/lib/time";
import { cn, formatBytes } from "@/lib/utils";

const STATUS: Record<string, string> = { queued: "Queued", downloading: "Cutting", processing: "Finalising", done: "Ready", error: "Failed" };

export function JobPanel({ job, lost, onReset, className }: { job: Job; lost: boolean; onReset: () => void; className?: string }) {
  const ready = job.clips.filter((c) => c.status === "done").length;
  const running = job.status === "running";
  const mins = Math.max(0, Math.round((job.expiresAt - Date.now()) / 60000));

  return (
    <Card className={cn("animate-in fade-in-0 slide-in-from-bottom-2", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {running ? <Loader2 className="text-primary size-4 animate-spin" /> : ready ? <CheckCircle2 className="size-4 text-emerald-500" /> : <AlertCircle className="text-destructive size-4" />}
          {running ? "Exporting your clips…" : ready ? `${ready} clip${ready > 1 ? "s" : ""} ready` : "Export failed"}
        </CardTitle>
        <CardDescription>
          {lost && running ? "Reconnecting…" : running ? "Keep this tab open — downloads appear as each clip finishes." : `Files are kept for about ${mins} min.`}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw /> New export
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {running && <Progress value={job.progress * 100} />}
        <ul className="divide-y rounded-lg border">
          {job.clips.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: clipColor(c.index) }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{c.label}</p>
                  <Badge variant={c.status === "done" ? "secondary" : c.status === "error" ? "destructive" : "outline"}>{STATUS[c.status]}</Badge>
                </div>
                <p className="text-muted-foreground tabular mt-0.5 font-mono text-xs">
                  {formatTime(c.start)} → {formatTime(c.end)}
                  {c.status === "done" && ` · ${formatBytes(c.size)}`}
                </p>
                {c.status === "error" && <p className="text-destructive mt-1 text-xs">{c.error}</p>}
                {(c.status === "downloading" || c.status === "processing") && <Progress value={c.progress * 100} className="mt-2 h-1" />}
              </div>
              {c.status === "done" && (
                <Button asChild size="sm" variant="outline" className="pointer-coarse:h-10">
                  <a href={api.clipUrl(job.id, c.id)} download>
                    <Download /> {job.format.toUpperCase()}
                  </a>
                </Button>
              )}
            </li>
          ))}
        </ul>
        {ready > 1 && (
          <Button asChild className="w-full" disabled={running}>
            <a href={api.zipUrl(job.id)} download>
              <FileArchive /> Download all ({ready}) as ZIP
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
