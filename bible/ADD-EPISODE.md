# Adding an episode (for example Episode 3, Matthew 3)

Every study page is the same `study.js` reading one data file. A new episode needs four things, and the hub, the "Next up" card and the previous/next links pick it up by themselves.

| Step | File | What to do |
|---|---|---|
| 1 | `data/matthew-3.json` | The episode's content (see "Making the data file" below). |
| 2 | `matthew-3/index.html` | Copy `_template/index.html`, then replace `matthew-N` with `matthew-3`, and `Matthew N`/`TITLE` in the title and description. |
| 3 | `assets/Matthew-Ep03-<Name>.pdf` | The full-color PDF Solomon made for Goodnotes (from `/workspace/bible-study/offline/`). Images go in `assets/` too. |
| 4 | `data/episodes.json` | On the Episode 3 entry, set `"page": "matthew-3/"` and `"pdf": "assets/Matthew-Ep03-<Name>.pdf"`. |

## Making the data file

Solomon builds each episode as a Canvas first. Its data constants (VIDEO, SUMMARY, QUOTES, PASSAGES, LSB_QUOTES, PEOPLE, TERMS, WORDS, BACKGROUND, DEBATES, TIMELINE, XREFS, QUESTIONS, APPLICATION_*, MAP, PLACES, CAREFUL, NOTES, and any episode-specific ones such as FULFIL or ECHOES) convert automatically. The tools live outside this folder, in `/workspace/bible-study/github/tools/` on Solomon's box:

```sh
# 1. Save the Canvas source (ReadCanvas) to a file, then:
node tools/canvas-to-json.js ep03_canvas.txt matthew-3 bible/data/matthew-2.json > /tmp/draft3.json
# 2. Clean it up: verse-exact LSB links, hub/page/PDF lines and Logos links in the copy-ready notes
python3 tools/finalize_episode.py /tmp/draft3.json bible/data/matthew-3.json \
  --pdf Matthew-Ep03-<Name>.pdf --pages <n> --size "<x.x> MB" --factbook "Jesus,..."
```

Then fill in by hand, reading the Canvas JSX: `kicker`, `heroBefore`, `heroEm`, `hand`, `handColor`, `star`, `nav`, `sections` (headings, tags, subtitles, notes, quote indexes), `method` or `listen`, `foot`, `figures` and `mapDecor` (labels and routes). Delete the `_todo` list when done. Never invent quotes or sources.

### Sections

`nav` is an ordered list of `[sectionId, label]`. Built-in ids: `summary`, `passages`, `tree`, `fulfil`, `exodus`, `people`, `map`, `terms`, `words`, `background`, `timeline`, `xrefs`, `questions`, `apply`, `export`. A "Look it up in Logos" section is added before `export` when the episode has a `factbook` list. Section numbers are counted automatically.

For an episode-specific section (for example `baptism`), add it to `nav` and give `sections.baptism` any of:

```json
{ "tags": ["v"], "h": "Heading", "sub": "Subtitle",
  "list": ["bullet", "bullet"],
  "cards": [{ "h": "Title", "p": "Text", "tag": "b", "ref": "Matthew 3:13-17", "book": "Matthew", "ch": 3, "fb": ["Jesus"] }],
  "quote": 2 }
```

### LSB links

Any reference label like `Matthew 3:13-17`, `Isaiah 40:3; Malachi 3:1` or `Psalm 2:7` opens those exact verses on read.lsbible.org. Labels that are not references fall back to `book` + `ch`.

### Logos Factbook links

Only ids in `data/factbook.json` are used. They were looked up in Logos; **never guess one**. To add a person or place, look it up in the Logos Factbook first, then add `"Key": {"label": "...", "id": "%23Name.1"}` (`%23` = person/thing, `%40` or `%25` = place/topic, `%24` = thing). Add new keys to `FACTBOOK` in `tools/update_data.py` and rerun it, so a rerun never drops them. When the verified value is not a `bk.` id (for example `lsto.KingdomOfGod`), store it as `"ref": "lsto.KingdomOfGod"` instead of `"id"`; the link becomes `https://ref.ly/logos4/Factbook?ref=lsto.KingdomOfGod`. Link items with `"fb": ["Key"]` on PEOPLE, PLACES, TERMS, WORDS or custom cards, and list the episode's keys in `"factbook"`.

### PDF

`"pdf": {"file": "...pdf", "href": "../assets/...pdf", "pages": 18, "size": "1.7 MB"}` adds the Download PDF for Goodnotes button. No share-sheet buttons: they fail silently in some in-app browsers.

### Episode-specific sections (added with Episode 3)

- `voices`: Old Testament radar cards from a `VOICES` array (`n, ot, otBook, otCh, otText, nt, ntText, note, src`). Each numbered badge pings when it scrolls into view.
- Any section with `"echoes": true` renders the `ECHOES` then/now cards (Episode 2 uses `exodus`, Episode 3 uses `elijah`).
- `WITNESSES` (`who, when, src, text`) adds an "Early witnesses" block to Background; `CAREFUL_INTRO` adds a note above the Careful reading list.
- Section `quote`, `quoteCite` and `quoteBg` (gold, teal, violet, coral, sky) set the closing quote. `quoteBgs` sets the two summary quote colors.
- `heroIcon: "dove"` swaps the star for a descending dove with ripples and a sky title gradient. `method.mark` picks the highlighted phrase.
- `mapDecor` accepts `viewBox`, `areas` (dashed shaded regions), `lakeStroke`, `riverWidth`, `riverFlow` (animated current), `pinSize`, `noLeaders`, and decorative labels (`"decor": true`).
- `tools/canvas-to-json.js` now keeps every upper-case data array it finds, not only the known list.

### Added with Episode 4

- `tests`: three "test" cards from a `TESTS` array (`n, theme, emoji, color, title, offer, offerRef, answer, answerRef, src, srcBook, srcCh, srcText, misused?, israel, israelSrc, israelRefs, note`). Each card stamps "It is written" as it scrolls in. An optional `EDEN` object (`h, text, ref, book, ch, video, added, refs`) adds a Genesis card below, and `figures.tests` adds pictures.
- `heroIcon: {"emoji": "📜", "orbit": ["🍞", "🏛️", "👑"], "gradient": "desert"}` shows any emoji hero with orbiting icons (hidden on phones) and a coral-gold-teal title.
- Episodes without a Canvas: write a `tools/build_ep0N.py` like `build_ep04.py`. It builds the data and the copy-clean NOTES, then adds the hub, PDF and Factbook lines.
- Offline copy and PDF: `python3 build/offline_gh.py matthew-N offline/<name>.html "<title>"`, then `node build/pdf.js offline/<name>.html offline/<name>.pdf`, then copy the PDF into `assets/` and rerun the builder with `--pages` and `--size`.

### Added with Episodes 5 to 9

- `feature: "<KEY>"` on any section renders cards from the data array `KEY`: `{n, emoji, color, kicker, title, stamp, left?, right?, src?, lines[], note?}`. `left`/`right` are `{who, ref, book, ch, text, tone, plain?}`. `src` is `{ref, book, ch, text, icon}` for an LSB verse, or `{who, text, icon}` (no `ref`) for a non-LSB source. `lines` are `{tag: "v" | "b", text, refs[], label?}` (video or background).
- `ladder: {title, rows: [{ref, short, book, ch, text, tail, lvl, hl, hlnote, color, mark}], note}` draws stepped rows (chiasms, Beatitudes, the Lord's Prayer). `lvl` sets the indent, `hl` marks the peak, `tail` is the repeated refrain. It renders before the feature cards.
- `figures[<section id>]` adds pictures under any section; `tools/episode_lib.py` `fig()` builds them from `img/ep5_9/meta.json`.
- Checks: `python3 tools/check_quotes.py matthew-N` (write other books' refs in full; bare "c:v" is read as Matthew) and `python3 tools/check_words.py matthew-N`.
- Logos notes: `python3 build/logos_ep.py N` writes `logos/epNN/` (8 notes plus `00_index.txt`) from the data file; `build/needs_ids_ep5_9.py` writes the needs_ids lists.

