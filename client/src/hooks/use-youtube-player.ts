import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the YouTube IFrame API */
type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  seekTo(s: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
};
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: { PLAYING: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise<void>((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

export function useYouTubePlayer(videoId: string | null, startAt = 0) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!videoId || !mountRef.current) return;
    let cancelled = false;
    const host = document.createElement("div");
    mountRef.current.replaceChildren(host);
    setReady(false);

    loadApi().then(() => {
      if (cancelled || !window.YT) return;
      playerRef.current = new window.YT.Player(host, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { modestbranding: 1, rel: 0, playsinline: 1, start: Math.floor(startAt) },
        events: {
          onReady: () => !cancelled && setReady(true),
          onStateChange: (e: { data: number }) => setPlaying(e.data === window.YT!.PlayerState.PLAYING),
        },
      });
    });

    const tick = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      const t = p.getCurrentTime();
      setTime(t);
      if (stopAtRef.current !== null && t >= stopAtRef.current) {
        p.pauseVideo();
        stopAtRef.current = null;
      }
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(tick);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const seek = useCallback((s: number) => {
    stopAtRef.current = null;
    playerRef.current?.seekTo(Math.max(0, s), true);
    setTime(s);
  }, []);

  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    stopAtRef.current = null;
    if (p.getPlayerState() === 1) p.pauseVideo();
    else p.playVideo();
  }, []);

  const playRange = useCallback((start: number, end: number) => {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo(start, true);
    p.playVideo();
    stopAtRef.current = end;
  }, []);

  const getTime = useCallback(() => playerRef.current?.getCurrentTime?.() ?? time, [time]);

  return { mountRef, ready, time, playing, seek, toggle, playRange, getTime };
}
