# yt-history-ndjson

A standalone DevTools browser script designed to stream and export your full YouTube watch history from **Google My Activity** into **NDJSON (.jsonl)** format with zero memory leaks and strict deduplication.

## 🚀 Features

* **NDJSON Streaming:** Streams data into auto-downloaded `.jsonl` files every 250 items to keep memory footprint minimal.
* **Strict Deduplication:** Extracts unique 11-character YouTube video IDs (`videoId`) ensuring **0 duplicates** across exported files.
* **Zero-Leak RAM Engine:** Employs the `stripMediaAndClean` engine to destroy heavy media elements (`img`, `svg`, `canvas`, `video`) and empty processed DOM nodes in real time. Works smoothly even on low-spec/low-RAM PCs.
* **Anti-Blocking Auto-Clicker:** Emulates physical pointer events (`pointerdown`, `mouseup`) alongside micro-scrolling to pass Google's "Load More" prompts and anti-bot pauses automatically.

## 📦 Data Schema

Each line in the output `.jsonl` files contains a valid JSON object formatted as follows:

```json
{
  "id": "ahw_tVTtG84",
  "url": "[https://www.youtube.com/watch?v=ahw_tVTtG84](https://www.youtube.com/watch?v=ahw_tVTtG84)",
  "title": "Video Title Example",
  "date_raw": "20260816",
  "extracted_at": "2026-08-17T13:28:20.000Z"
}
