/* Episode list lives in data/episodes.json. To publish another study, see bible/ADD-EPISODE.md:
   1. Add bible/data/<id>.json.  2. Copy bible/_template/index.html to bible/<id>/index.html and set data-study.
   3. Set that episode's "page" (and "pdf") in data/episodes.json. Prev/next links and "Next up" update themselves. */
const data = await fetch(new URL("data/episodes.json", import.meta.url).href).then((r) => {
  if (!r.ok) throw new Error("episodes");
  return r.json();
});

const app = document.querySelector("#app");
const accents = ["var(--coral)", "var(--teal)", "var(--gold)", "var(--violet)", "var(--sky)"];
const PLAY = data.playlistId;
const total = data.episodes.length;
const readyList = data.episodes.filter((e) => e.page);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function external(a) {
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.append(el("span", "sr", " (opens in a new tab)"));
  return a;
}
function link(href, text, cls) {
  const a = el("a", cls, text);
  a.href = href;
  return /^https?:/.test(href) ? external(a) : a;
}
function chapterOf(p) {
  const m = /Matthew (\d+)/.exec(p || "");
  return m ? parseInt(m[1], 10) : 0;
}
function lsbLink(p) {
  return "https://read.lsbible.org/?q=" + encodeURIComponent(p).replace(/%20/g, "+").replace(/%3A/g, ":");
}
function readStudied() {
  try { return JSON.parse(localStorage.getItem("bible-studied") || "{}"); }
  catch (e) { return {}; }
}
function writeStudied(v) { try { localStorage.setItem("bible-studied", JSON.stringify(v)); } catch (e) {} }
function epName(e) { return e.bonus ? "Bible Night Live " + e.ep.replace("BNL ", "Ep. ") : "Episode " + e.ep; }

/* ---------- hero ---------- */
const hero = el("header", "bible-hero wrap");
const h1 = el("h1");
h1.append("The Gospel of ", el("em", null, "Matthew"), ", Every Word");
const hand = el("p", "hand", data.hand);
hand.style.color = "var(--coral)";
const meta = el("div", "meta");
meta.append(link(data.playlistUrl, "▶ Full playlist on YouTube", "pill"), link("https://read.lsbible.org/?q=Matthew+1", "Read Matthew in the LSB", "pill"));

function bar(label, n, cls) {
  const box = el("div", "bar " + cls);
  const top = el("div", "prog-top");
  top.append(el("span", "kicker", label), el("span", "prog-n", n + " of " + total));
  const track = el("div", "track");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", String(total));
  track.setAttribute("aria-valuenow", String(n));
  track.setAttribute("aria-label", label);
  const fill = el("div", "fill");
  fill.style.setProperty("--w", (n ? Math.max(2, (n / total) * 100) : 0) + "%");
  track.append(fill);
  box.append(top, track);
  return box;
}
const prog = el("div", "prog");
const nextUp = el("div", "nextup");
nextUp.setAttribute("aria-live", "polite");
hero.append(el("p", "kicker", "Study hub · " + total + " videos · LSB"), h1, hand, el("p", "lede", data.intro), meta, nextUp, prog);

function drawProgress() {
  const studied = readStudied();
  const done = data.episodes.filter((e) => studied[e.id]).length;
  prog.replaceChildren(bar("Study pages ready", readyList.length, "ready"), bar("Marked studied on this device", done, "done"));
  requestAnimationFrame(() => requestAnimationFrame(() => prog.querySelectorAll(".fill").forEach((f) => f.classList.add("on"))));
}

/* The next episode to study: the first ready page not yet marked studied; otherwise the next page being written. */
function nextEpisode() {
  const studied = readStudied();
  const todo = readyList.find((e) => !studied[e.id]);
  if (todo) return { e: todo, ready: true };
  const last = readyList[readyList.length - 1];
  const i = last ? data.episodes.indexOf(last) + 1 : 0;
  return data.episodes[i] ? { e: data.episodes[i], ready: false } : null;
}
function drawNextUp() {
  const nx = nextEpisode();
  nextUp.replaceChildren();
  if (!nx) { nextUp.append(el("p", "hand", "Every episode studied. Well done!")); return; }
  const e = nx.e;
  const card = el("div", "nextcard" + (nx.ready ? "" : " waiting"));
  const k = el("p", "kicker", nx.ready ? "Next up for you" : "You're caught up · next study page");
  const h = el("h2", null, epName(e) + " · " + e.passage);
  const t = el("p", "nt", e.title);
  const row = el("div", "links");
  if (nx.ready) {
    row.append(link(e.page, "Open the study page", "pill go"));
    if (e.pdf) { const p = link(e.pdf, "Download PDF", "pill"); p.setAttribute("download", ""); row.append(p); }
  }
  row.append(link("https://www.youtube.com/watch?v=" + e.id + "&list=" + PLAY + "&index=" + e.n, "Watch on YouTube", "pill"));
  if (!nx.ready) row.append(el("span", "note", "Its study page is on the way. Tell Solomon when you finish the video."));
  card.append(k, h, t, row);
  nextUp.append(card);
}

/* ---------- list ---------- */
const main = el("div", "wrap");
const tools = el("div", "tools noprint");
const filters = [["all", "All " + total], ["ready", "Study page ready"], ["todo", "Not studied yet"], ["soon", "Coming soon"], ["bonus", "Bonus"]];
let filter = "all";
let drawn = false;
let query = "";
const buttons = filters.map(([k, label]) => {
  const b = el("button", "chip", label);
  b.type = "button";
  b.addEventListener("click", () => { filter = k; draw(); });
  return b;
});
const search = el("input", "search");
search.type = "search";
search.placeholder = "Search a title or passage, e.g. Matthew 13";
search.setAttribute("aria-label", "Search episodes");
search.addEventListener("input", () => { query = search.value; draw(); });
const fgroup = el("div", "fgroup");
fgroup.setAttribute("role", "group");
fgroup.setAttribute("aria-label", "Filter episodes");
fgroup.append(...buttons);
tools.append(fgroup, search);
const count = el("p", "note");
count.setAttribute("aria-live", "polite");
const grid = el("div", "grid");
main.append(tools, count, grid, el("div", "callout-note", data.note), el("p", "note", data.foot));
app.replaceChildren(hero, main);

function draw() {
  buttons.forEach((b, i) => b.setAttribute("aria-pressed", filters[i][0] === filter ? "true" : "false"));
  const q = query.trim().toLowerCase();
  const studied = readStudied();
  const nx = nextEpisode();
  const shown = data.episodes.filter((e) => {
    if (filter === "ready" && !e.page) return false;
    if (filter === "soon" && e.page) return false;
    if (filter === "bonus" && !e.bonus) return false;
    if (filter === "todo" && studied[e.id]) return false;
    if (!q) return true;
    return (e.title + " " + e.passage + " episode ep " + e.ep).toLowerCase().includes(q);
  });
  count.textContent = "Showing " + shown.length + " of " + total;
  grid.replaceChildren();
  if (!shown.length) { grid.append(el("p", null, "No episodes match that search.")); return; }
  shown.forEach((e, idx) => {
    const acc = e.bonus ? "var(--gold)" : accents[(chapterOf(e.passage) - 1 + accents.length) % accents.length];
    const yt = "https://www.youtube.com/watch?v=" + e.id + "&list=" + PLAY + "&index=" + e.n;
    const isNext = nx && nx.e === e;
    const card = el("article", "ep" + (drawn ? "" : " reveal") + (e.page ? " ready" : "") + (e.bonus ? " bonus" : "") + (studied[e.id] ? " studied" : "") + (isNext ? " next" : ""));
    card.style.setProperty("--acc", acc);
    card.style.animationDelay = Math.min(idx, 12) * 40 + "ms";
    const topRow = el("div", "note");
    const num = el("span", "epnum", epName(e));
    topRow.append(num, document.createTextNode(" · #" + e.n + " in playlist · " + e.len));
    const h3 = el("h3", null, e.title);
    const tags = el("div", "tagrow");
    if (isNext) tags.append(el("span", "tag nexttag", nx.ready ? "★ Next up" : "★ Next page"));
    if (e.page) {
      const t = el("span", "tag v");
      const dot = el("span", "pulse");
      dot.setAttribute("aria-hidden", "true");
      t.append(dot, document.createTextNode(" Study page ready"));
      tags.append(t);
    } else tags.append(el("span", "tag d", "Coming soon"));
    if (studied[e.id]) tags.append(el("span", "tag l", "✓ Studied"));
    if (e.bonus) tags.append(el("span", "tag b", "Bonus"));
    const links = el("div", "links");
    if (e.page) links.append(link(e.page, "Open study page", "pill go"));
    if (e.pdf) { const p = link(e.pdf, "PDF", "pill"); p.setAttribute("download", ""); p.setAttribute("aria-label", "Download the PDF for " + epName(e)); links.append(p); }
    links.append(link(yt, "YouTube", "pill"));
    if (e.passage) links.append(link(lsbLink(e.passage), "LSB", "pill"));
    const lab = el("label", "checkline noprint");
    const box = el("input");
    box.type = "checkbox";
    box.checked = !!studied[e.id];
    box.setAttribute("aria-label", "Mark " + epName(e) + " studied");
    box.dataset.ep = e.id;
    box.addEventListener("change", () => {
      const all = readStudied();
      all[e.id] = box.checked;
      writeStudied(all);
      drawProgress();
      drawNextUp();
      draw();
      const again = grid.querySelector('input[data-ep="' + e.id + '"]');
      if (again) again.focus();
    });
    lab.append(box, document.createTextNode(" Studied"));
    card.append(topRow, el("div", "pass", e.bonus ? "Bonus episode" : e.passage), h3, tags, links, lab);
    grid.append(card);
  });
  drawn = true;
}

drawProgress();
drawNextUp();
draw();
addEventListener("storage", (ev) => { if (ev.key === "bible-studied") { drawProgress(); drawNextUp(); draw(); } });
addEventListener("pageshow", (ev) => { if (ev.persisted) { drawProgress(); drawNextUp(); draw(); } });
