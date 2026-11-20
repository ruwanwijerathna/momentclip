import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** lg breakpoint: sidebar layout vs. mobile bottom-sheet layout */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
export const useIsTouch = () => useMediaQuery("(pointer: coarse)");
