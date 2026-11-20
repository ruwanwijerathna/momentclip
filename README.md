# MomentClip

Paste a YouTube link, enter a **start time** and an **end time**, and download only that portion as MP4 (up to 4K) or MP3. Built for long recordings like graduation ceremonies, where you only want the 15 seconds when your name is called.

- **Frontend:** React 19 + Vite SPA, Tailwind CSS v4, shadcn/ui (new-york) components, Radix, lucide, sonner
- **Backend:** Node + Express. Uses `yt-dlp --download-sections` with `ffmpeg`, so only the requested part is downloaded, not the whole video.

## Features
- **The home page leads with the catalog.** Users search for their university, faculty, degree or date. Pasting a YouTube link is a secondary path through **Custom video**, found in the header, as "Not listed?" next to the search, and in the no-results state. It opens a dialog on desktop and a bottom sheet on phones. A pasted link that turns out to be a catalog video picks up that session's markers automatically. With `CATALOG_ONLY=true`, every custom-link entry point is hidden.
- Start/End time inputs that accept `1:02:05`, `62:05`, `1h2m5s` or `1:02:05.5`. Plain digits fill in from the right like a microwave (`10205` → `1:02:05`), so phone number pads work without a ":" key. Arrow keys nudge by 1s (Shift = 10s, Alt = 0.1s).
- **Mobile-first editor (<1024 px):**
  - The player is pinned to the top while you scroll.
  - A thumb-zone bottom bar has **Start / End / Add / Clips** buttons, plus the current time and the selected range. It hides while the keyboard is open.
  - Clips, export settings and progress open in a bottom sheet. It opens automatically when an export starts.
  - Touch targets are at least 40–44 px and the slider thumbs are larger on touch screens.
  - Filter chips and marker rows scroll horizontally, and the layout respects safe-area insets (notch / home bar).
  - Toasts appear at the top on phones and at the bottom on desktop.
- Embedded player with a crosshair button that copies the current time into a field. Keyboard shortcuts: `I` sets start, `O` sets end, `Space` plays/pauses, `A` adds the segment.
- Multiple segments per export. Each segment has a label, editable times and a Preview button that plays just that range.
- A whole-video timeline showing saved segments, the draft range and chapter marks. Click to seek.
- MP4 at a chosen quality, or MP3. Optional frame-accurate cuts (`--force-keyframes-at-cuts`).
- Live progress over Server-Sent Events, a download button per clip, and Download all as ZIP.
- Timestamped links (`?t=3725`) pre-fill the start time.
- Safety: only YouTube IDs are accepted, and the server rebuilds the URL itself. `spawn` is called without a shell, inputs are validated, requests are rate-limited, and files are deleted automatically after `JOB_TTL_MINUTES`.

## Convocation catalog
Universities hold convocations over several days, with several sessions a day, and each session has its own YouTube video. All of this lives in one JSON file, **`server/catalog/convocations.json`**:

```
universities[] ─ id, name, shortName, location, timezone
 └ convocations[] ─ id, title, year
    └ days[] ─ date (YYYY-MM-DD), label
       └ sessions[] ─ id, name, startsAt (HH:MM), faculties[], degrees[], notes
          ├ video ─ youtubeId, duration ("2:48:10" or seconds)
          └ markers[] ─ { t: "0:41:05", label: "Civil Engineering", kind: degree|faculty|speech|ceremony|section }
```

- **IDs** are lowercase slugs and must be unique across the whole file, e.g. `northfield-2026-d1-s1`. Session IDs appear in shareable links: `/?session=northfield-2026-d1-s1&t=2465`.
- **Times** can be written as `"1:02:05"` or as seconds.
- **Markers** are what make a 3-hour video easy to navigate. Users can search them ("civil engineering"), jump straight to one from a search result, or set one as the segment start with a single click. They also appear as ticks on the timeline.
- `convocations.schema.json` gives VS Code autocomplete and validation while you edit.
- The server checks the file on start and every 3 s. A broken edit is logged and the previous version stays live.
- `CATALOG_ONLY=true` limits the app to catalog videos, which is useful for an official university-partner deployment.
- The sample data uses fictional universities and `REPLACE000x` placeholder IDs. Replace them with real ones; the validator warns about any placeholders left.

**Editing at scale with a spreadsheet:** keep one row per session in Google Sheets or Excel, export it as CSV, and convert it:
```bash
cd server
npm run catalog:from-csv -- catalog/templates/sessions.csv catalog/templates/markers.csv > catalog/convocations.json
npm run catalog:validate
```
The templates in `server/catalog/templates/` list the columns. Separate multiple faculties or degrees with `|`. The `youtube_url` column accepts full URLs or bare IDs.

| API | |
|---|---|
| GET `/api/catalog` | the normalised catalog (times in seconds, ETag-cached) |
| GET `/api/info?url=` | also returns `catalog: { university, convocation, date, session }` when the video is in the catalog |

## Run locally
Requirements: Node 20+, `ffmpeg`, and [`yt-dlp`](https://github.com/yt-dlp/yt-dlp#installation) on your PATH.

```bash
cp .env.example .env
npm install && npm run setup
npm run dev          # API on :8787, SPA on :5173 (proxied /api)
```

Production (one process serves both the API and the SPA):
```bash
npm run build && npm start   # http://localhost:8787
# or
docker compose up --build
```

## API
| Method | Path | Notes |
|---|---|---|
| GET | `/api/info?url=` | title, duration, available heights, chapters |
| POST | `/api/jobs` | `{ url, segments:[{start,end,label}], format:"mp4"\|"mp3", quality:"1080"…, precise }` (times in seconds) |
| GET | `/api/jobs/:id/events` | SSE stream of job state |
| GET | `/api/jobs/:id/clips/:clipId` | download one clip |
| GET | `/api/jobs/:id/zip` | download all finished clips |

## Production notes
- **YouTube blocking:** YouTube often blocks downloads from datacenter IPs with a "Sign in to confirm you're not a bot" error. The usual fixes are a cookies file (`YTDLP_COOKIES`), a residential proxy (`YTDLP_EXTRA_ARGS="--proxy …"`) and keeping yt-dlp updated. The Docker image runs `yt-dlp -U` on every start.
- **Scaling:** the job store and queue are in memory, so this runs on a single node. To run several workers, move jobs to Redis with BullMQ and the output files to S3/R2 behind signed URLs.
- **Still to build for a full SaaS:** authentication (Clerk/Supabase), per-plan limits on segment length, quality and monthly minutes, Stripe billing, and usage metering.
- **Legal:** downloading may break YouTube's Terms of Service unless you own the content or have the rights holder's permission. The UI already shows a notice, but you should also add proper Terms and a takedown process before you launch publicly.
