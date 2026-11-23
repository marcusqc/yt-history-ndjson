# yt-history-ndjson

Stand-alone DevTools script to export full YouTube watch history to NDJSON (.jsonl) with zero memory leaks.

> **Note:** If this tool helped you backup your data, please give it a ⭐️!

---

## 💡 Why this instead of Google Takeout?

Google Takeout can be slow, fail on large accounts, or deliver formats difficult to parse. This script streams data instantly from your browser with zero RAM leaks.

---

## 🛠️ Prerequisites

Any modern desktop browser (Chrome, Brave, Edge, Firefox) with **Developer Tools** enabled.

---

## 🚀 Getting Started

1. Open your **YouTube Watch History** page or **Google My Activity**.
2. Open your browser's **Developer Tools** (`F12` or `Ctrl+Shift+I` / `Cmd+Option+I`).
3. Navigate to the **Console** tab.
4. Paste the script and press `Enter`.
5. Your data will be exported line-by-line into an `.ndjson` (`.jsonl`) file automatically!

---

## 📦 Output Format

The data is saved in **NDJSON** (Newline Delimited JSON), making it lightweight and easy to parse or stream into big data tools:

```json
{"id": "video_id_1", "title": "Video Title", "timestamp": "2026-08-17T00:00:00Z"}
{"id": "video_id_2", "title": "Another Video", "timestamp": "2026-08-17T01:00:00Z"}

---

## 🆕 v1 API — `yt_history_api_v1.js` (recommended)

No DOM scraping at all: the script replays the internal request My Activity itself uses when you scroll (`batchexecute`, rpcid `y3VFHd`), 100 items per request, following the continuation token. Memory stays flat whatever the size of the history.

**Usage**

1. Open `https://myactivity.google.com/product/youtube` (signed in).
2. `F12` → **Console** (avoid leaving the Network tab recording: it keeps a copy of every response).
3. Paste `yt_history_api_v1.js`, then run `ytx.start()`.
4. A file `yt_history_partNNN.ndjson` is downloaded every 25,000 items (Chrome may ask once to allow multiple downloads).

| Command | Effect |
|---|---|
| `ytx.start()` | start, or resume from the last downloaded part |
| `ytx.stop()` | stop after the current page and download the partial chunk |
| `ytx.status()` | show progress (count, oldest date reached) |
| `ytx.reset()` | forget the resume point |

If the session expires (HTTP 400/401), reload the page, paste the script again and run `ytx.start()`: it resumes where it stopped.

**Fields (one JSON object per line)**

```json
{"id":"…","ts_us":1795443226378250,"activity_date":"2026-11-23T14:13:46.378Z","action":"Vous avez regardé","title":"…","url":"https://www.youtube.com/watch?v=…","video_id":"…","channel":"…","channel_url":"…","duration":"30:53","device":"Web","is_ad":false}
```

- `action`: watched / viewed (posts) / searched, in your account language
- `device`: `Web`, `Android`, … (may be empty for older entries)
- `is_ad`: `true` for ads recorded in the history
- `duration`: full length of the video, not the time actually watched

Unofficial internal endpoint: Google may change it without notice. Requests are spaced 1.2 s apart with exponential backoff on errors.
