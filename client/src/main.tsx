import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/primitives";
import App from "./App";
import { useIsDesktop } from "@/hooks/use-media-query";

function Toasts() {
  // Phones: top, clear of the bottom bar and sheet. Desktop: bottom.
  return <Toaster richColors theme="system" position={useIsDesktop() ? "bottom-center" : "top-center"} />;
}
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <App />
      <Toasts />
    </TooltipProvider>
  </StrictMode>
);
