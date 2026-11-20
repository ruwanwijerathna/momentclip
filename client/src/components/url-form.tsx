import { useState } from "react";
import { ArrowRight, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { extractVideoId } from "@/lib/api";
import { cn } from "@/lib/utils";

export function UrlForm({
  onSubmit,
  loading,
  defaultValue = "",
  size = "lg",
  autoFocus,
}: {
  onSubmit: (url: string) => void;
  loading: boolean;
  defaultValue?: string;
  size?: "lg" | "sm";
  autoFocus?: boolean;
}) {
  const [url, setUrl] = useState(defaultValue);
  const valid = !!extractVideoId(url);
  const big = size === "lg";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !loading) onSubmit(url.trim());
      }}
      className={cn(
        "bg-card flex w-full items-center gap-2 rounded-xl border shadow-sm focus-within:ring-ring/40 focus-within:ring-[3px] transition-shadow",
        big ? "p-2 pl-4" : "p-1.5 pl-3"
      )}
    >
      <Link2 className="text-muted-foreground size-4 shrink-0" />
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (extractVideoId(text)) {
            e.preventDefault();
            setUrl(text);
            onSubmit(text.trim());
          }
        }}
        placeholder="https://youtube.com/watch?v=…"
        aria-label="YouTube URL"
        autoFocus={autoFocus}
        type="url"
        inputMode="url"
        enterKeyHint="go"
        className={cn(
          "border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent px-1",
          big ? "h-11 text-base md:text-base" : "h-8"
        )}
      />
      <Button type="submit" size={big ? "lg" : "sm"} disabled={!valid || loading}>
        {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {loading ? "Loading" : "Load video"}
      </Button>
    </form>
  );
}
