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
