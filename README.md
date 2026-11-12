# Shea's Workout

Home-screen strength workouts, served by GitHub Pages from this repo. Open the app, log each set, and tap **Finish**. Finish saves the workout on the phone and posts the log to the webhook saved in Settings (the Grok Bot routine "Workout log from app").

**⚙ Settings**, on the Auto-sync screen, is pre-filled with the public relay at `https://workout-relay.shea-nelson.workers.dev`. Leave the Authorization header blank, tap **Save**, then **Send test**. Settings stay on this phone only. Save leaves a **Saved** confirmation on that screen. The Authorization header is optional: the relay does not need a key in the app, and a blank field is enough. If you point Settings at a different webhook that does need a key, paste it and Save. Opening Settings again says a webhook is configured and hides any key. Finish shows a summary and one of three results: sent, failed with Retry, or webhook not set up. A log that did not send stays on the phone and is tried again.

The app POSTs `Content-Type: application/json` and the same JSON keys as before. It sends an `Authorization` header only when a key is saved. That request is cross-origin, so the browser asks the webhook for permission first. If the webhook does not allow this website, the summary says the browser blocked the send and the log stays on the phone. `api2.cursor.sh` and `api.cursor.com` only allow that browser check from cursor.com, so this page talks to the relay instead. The relay forwards the log to the Grok Bot webhook. Tap **Send test** on the Auto-sync screen to see the result in plain words.

The plan for the week lives in [`workout.json`](workout.json). A scheduled job edits that file by hand and pushes it once a week, or the night before.

## Week file

`workout.json` is one week. The app picks the day from the calendar date in `America/New_York`.

```json
{
  "schema": "workout.week",
  "schemaVersion": 1,
  "timezone": "America/New_York",
  "weekStart": "2026-11-09",
  "weekEnd": "2026-11-15",
  "title": "Week of Nov 9, 2026",
  "schedule": {
    "strengthDays": ["Monday", "Wednesday", "Friday"],
    "time": "08:00",
    "timeLabel": "8:00 AM",
    "offDays": "Rest or treadmill day. No strength workout."
  },
  "days": []
}
```

`weekStart` is the Monday the week opens on (`YYYY-MM-DD`). `days` lists only the strength workouts, in any order. The app sorts them by `date`. Tuesday, Thursday, and the weekend are rest or treadmill days because they are not in `days`.

Each day:

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | Stable id for this session, like `2026-11-11-upper`. This is `workoutId` in the Finish payload, and the on-device log key. |
| `date` | yes | `YYYY-MM-DD` in New York. |
| `dateLabel` | yes | Short label, like `Wed Nov 11`. Shown on the tab and in the log. |
| `time` | yes | `08:00` for the 8:00 AM sessions. |
| `timeLabel` | yes | `8:00 AM`. |
| `title` | yes | `Full Body Day`, `Upper Body`, or `Lower Body`. This is the `workout` field in the payload. |
| `subtitle` | no | One line under the title. |
| `defaultRestSec` | no | Rest timer default. 90 if omitted. |
| `notes` | yes | Safety lines. Keep the glucose-tab note, the walk-after note, and the light-first-set note. |
| `warmup` | yes | List of warm-up lines for the day. |
| `cooldown` | yes | List of cool-down lines for the day. |
| `exercises` | yes | The lifts, in order. |

Each exercise:

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | Demo and log id. Use a known id when you can: `goblet-squat`, `bench-press`, `one-arm-row`, `rdl`, `seated-press`, `glute-bridge`, `dead-bug`, `reverse-lunge`, `calf-raise`, `hammer-curl`, `biceps-curl`, `overhead-triceps`, `incline-fly`, `push-up`, `chin-tuck`, `yt-raise`, `rear-delt-fly`. Anything else gets a generic figure. |
| `name` | yes | What he reads on the card. |
| `sets`, `reps`, `weight` | yes | `weight` is pounds per hand, or the one dumbbell, or `0` for bodyweight. |
| `weightNote` | yes | `Per hand`, `One dumbbell held at your chest`, `Reps per side`, and so on. |
| `muscles` | no | Short muscle line. |
| `restSec` | no | Rest after this move. Falls back to the day's default. |
| `cues` | yes | Three short form cues. |
| `avoid` | yes | The common mistake. The card labels it "Common mistake". |
| `safety` | no | A short safety line under the mistake, labeled "Safety". Use it for neck or joint-sensitive moves. |
| `lastTime` | no | What he lifted last time, so the weight has a reason. |

Logged sets for each day stay on the device under `wk.log.<id>`. A new id starts a blank card.

### Which day opens

- On a strength day, that workout opens.
- On a rest or treadmill day, the next strength day in the file opens, and a yellow banner says today is a rest or treadmill day and names the next session.
- After Friday, the Friday workout stays open and the banner says this week's strength workouts are finished.
- Add `?asof=YYYY-MM-DD` to preview another date. It is not saved.

### Older single-day files

A file with `exercises` at the top and no `days` array still loads, as a one-day plan. That was the shape before the week of Nov 9, 2026. Prefer the week shape above.

### Finish payload

Finish, and each completed set, POST JSON to the saved webhook when the browser is allowed to. The keys are the same:

```json
{
  "event": "finished",
  "date": "2026-11-11",
  "workout": "Upper Body",
  "workoutId": "2026-11-11-upper",
  "sentAt": "2026-11-11T13:05:00.000Z",
  "finishedAt": "2026-11-11T13:05:00.000Z",
  "log": "Upper Body · Wed Nov 11 · 2026-11-11-upper\n…",
  "exercises": []
}
```

`event` is `finished` or `set`. `date`, `workout`, and `workoutId` are the day on screen, so the log says which workout was logged. The first line of `log` repeats the title, the date label, and the id. Set events also include `exercise` and either `set` or `skipped`.

## What to program

Shea is 50, has type 2 diabetes, and is rebuilding fitness. Equipment is dumbbells (one pair is 30 lb) and an adjustable bench. No barbell.

Keep loads conservative, and base them on what he has already done in this file: goblet squat 20 lb, bench press 20 lb per hand, one-arm row 25 lb (30 lb fell apart), Romanian deadlift 20 lb per hand, seated press 15 lb per hand, floor glute bridge 25 lb.

Do not program a bench hip thrust, a Bulgarian split squat, or any move where he balances or could slide on the bench edge. Glutes are a floor glute bridge with one dumbbell on the hip bones, 3×12. A hand on the bench for balance is fine. A foot on the bench is not.

## Motion graphics

Each exercise draws a side view and a second view (front, or from above when he is lying down). Dumbbells follow the grip: vertical at the chest for a goblet squat, horizontal for presses, rows, and flies, neutral (thumbs up) for hammer curls, at the sides for lunges and calf raises, across the hips for the floor bridge. The line under the figures is a form cue timed to the rep. If the phone asks for reduced motion, the figures start paused on that cue. Pause and play are saved on the device.

## Other apps

This repo holds only the workout app. The other apps moved to their own repos on Nov 10, 2026:

| App | Repo | Site |
| --- | --- | --- |
| Kitchen (recipes, planner, shopping) | [Shea-Nelson/kitchen](https://github.com/Shea-Nelson/kitchen) | https://shea-nelson.github.io/kitchen/ |
| Gospel of Matthew study | [Shea-Nelson/bible-study](https://github.com/Shea-Nelson/bible-study) | https://shea-nelson.github.io/bible-study/bible/ |
| Grok Bot weekly lessons | [Shea-Nelson/grok-lessons](https://github.com/Shea-Nelson/grok-lessons) | https://shea-nelson.github.io/grok-lessons/ |
| Family time | [Shea-Nelson/family-time](https://github.com/Shea-Nelson/family-time) | https://shea-nelson.github.io/family-time/ |
| Board games | [Shea-Nelson/game-library](https://github.com/Shea-Nelson/game-library) | https://shea-nelson.github.io/game-library/ |
| All pages | [Shea-Nelson/shea-nelson.github.io](https://github.com/Shea-Nelson/shea-nelson.github.io) | https://shea-nelson.github.io/ |

The old folders here are now one-line redirect pages, and `404.html` forwards any other old `/workout-app/...` link (PDFs, data files) to the same file at its new home. Don't add app content back to those folders.
