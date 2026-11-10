# Grok Bot weekly lessons

Published at [https://shea-nelson.github.io/workout-app/grok-lessons/](https://shea-nelson.github.io/workout-app/grok-lessons/).

- `index.html` — newest lesson first, then the archive.
- `YYYY-MM-DD/index.html` — one page per lesson.
- `lessons.json` — machine-readable index (`date`, `title`, `slug`, `fullText`). Append a new Monday lesson at the top.
- `guides/` — official xAI / SpaceXSI Grok and Grok Bot guides. The index links to the official URLs. Local copies are not saved; see the note on that page. `guides.json` stores `title`, `sourceUrl`, `localFile`, `retrievedDate`, and `contentHash` so a weekly run can detect new or updated guides and keep older hashes.

Last guides retrieval: 2026-11-10 (America/New_York).
