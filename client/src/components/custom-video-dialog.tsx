import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link2, X } from "lucide-react";
import { UrlForm } from "@/components/url-form";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";

const TITLE = "Use a custom YouTube link";
const DESCRIPTION = "For any video that isn't in our ceremony list: a department event, a recital, a livestream replay.";

function Tips() {
  return (
    <ul className="text-muted-foreground space-y-1.5 text-xs">
      <li>• Works with youtube.com/watch, youtu.be, /live and /shorts links.</li>
      <li>• Timestamped links (…?t=1h02m05s) pre-fill the start time.</li>
      <li>• Only download videos you own or have permission to use.</li>
    </ul>
  );
}

/** Dialog on desktop, bottom sheet on phones. */
export function CustomVideoDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (url: string) => void;
  loading: boolean;
}) {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2"><Link2 className="text-primary size-4" /> {TITLE}</DrawerTitle>
            <DrawerDescription>{DESCRIPTION}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <UrlForm size="sm" autoFocus onSubmit={onSubmit} loading={loading} />
            <Tips />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[30%] left-1/2 z-50 grid w-full max-w-xl -translate-x-1/2 -translate-y-1/2 gap-5 rounded-xl border p-6 shadow-2xl">
          <div className="space-y-1.5">
            <DialogPrimitive.Title className="flex items-center gap-2 text-lg font-semibold">
              <Link2 className="text-primary size-4" /> {TITLE}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-muted-foreground text-sm">{DESCRIPTION}</DialogPrimitive.Description>
          </div>
          <UrlForm size="sm" autoFocus onSubmit={onSubmit} loading={loading} />
          <Tips />
          <DialogPrimitive.Close className="text-muted-foreground hover:text-foreground absolute top-4 right-4 cursor-pointer rounded-sm" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
