/* Episode list lives in data/episodes.json. To publish another study:
   1. Add bible/data/<id>.json (copy matthew-1.json and replace the text).
   2. Copy bible/matthew-1/index.html to bible/<id>/index.html and set data-study.
   3. Set that episode's "page" to "<id>/" in data/episodes.json. */
const data = await fetch(new URL("data/episodes.json", import.meta.url).href).then((r) => {
  if (!r.ok) throw new Error("episodes");
  return r.json();
});

const app = document.querySelector("#app");
const accents = ["var(--coral)", "var(--teal)", "var(--gold)", "var(--violet)", "var(--sky)"];
const PLAY = data.playlistId;

function chapterOf(p) {
  const m = /Matthew (\d+)/.exec(p || "");
  return m ? parseInt(m[1], 10) : 0;
}
function lsbLink(p) {
  return "https://read.lsbible.org/?q=Matthew" + chapterOf(p);
}
function readStudied() {
  try { return JSON.parse(localStorage.getItem("bible-studied") || "{}"); }
  catch (e) { return {}; }
}
function writeStudied(v) { localStorage.setItem("bible-studied", JSON.stringify(v)); }

const ready = data.episodes.filter((e) => e.page).length;
const total = data.episodes.length;
const pct = Math.max(2, Math.round((ready / total) * 100));

const hero = document.createElement("header");
hero.className = "bible-hero wrap";
hero.innerHTML = "";
const kicker = document.createElement("p");
kicker.className = "kicker";
kicker.textContent = "Study hub · " + total + " videos · LSB";
const h1 = document.createElement("h1");
h1.append("The Gospel of ", Object.assign(document.createElement("em"), { textContent: "Matthew" }), ", Every Word");
const hand = document.createElement("p");
hand.className = "hand";
hand.style.color = "var(--coral)";
hand.textContent = data.hand;
const intro = document.createElement("p");
intro.className = "lede";
intro.textContent = data.intro;
const meta = document.createElement("div");
meta.className = "meta";
function pill(href, text) {
  const a = document.createElement("a");
  a.className = "pill";
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = text;
  return a;
}
meta.append(
  pill(data.playlistUrl, "Full playlist on YouTube"),
  pill("https://read.lsbible.org/?q=Matthew1", "Read Matthew in the LSB")
);
const prog = document.createElement("div");
prog.className = "prog";
const top = document.createElement("div");
top.className = "prog-top";
const pk = document.createElement("span");
pk.className = "kicker";
pk.textContent = "Study pages ready";
const pn = document.createElement("span");
pn.className = "prog-n";
pn.textContent = ready + " of " + total;
top.append(pk, pn);
const track = document.createElement("div");
track.className = "track";
track.setAttribute("role", "progressbar");
track.setAttribute("aria-valuemin", "0");
track.setAttribute("aria-valuemax", String(total));
track.setAttribute("aria-valuenow", String(ready));
track.setAttribute("aria-label", "Study pages ready");
const fill = document.createElement("div");
fill.className = "fill";
fill.style.setProperty("--w", pct + "%");
track.append(fill);
const yours = document.createElement("p");
yours.className = "note";
yours.setAttribute("aria-live", "polite");
prog.append(top, track, yours);
hero.append(kicker, h1, hand, intro, meta, prog);

const main = document.createElement("div");
main.className = "wrap";
const tools = document.createElement("div");
tools.className = "tools noprint";
const filters = [
  ["all", "All " + total],
  ["ready", "Study page ready"],
  ["soon", "Coming soon"],
  ["bonus", "Bonus"],
];
let filter = "all";
let query = "";
const buttons = filters.map(([k, label]) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.textContent = label;
  b.setAttribute("aria-pressed", k === "all" ? "true" : "false");
  b.addEventListener("click", () => { filter = k; draw(); });
  return b;
});
const search = document.createElement("input");
search.className = "search";
search.type = "search";
search.placeholder = "Search a title or passage, e.g. Matthew 13";
search.setAttribute("aria-label", "Search episodes");
search.addEventListener("input", () => { query = search.value; draw(); });
tools.append(...buttons, search);
const count = document.createElement("p");
count.className = "note";
const grid = document.createElement("div");
grid.className = "grid";
const note = document.createElement("div");
note.className = "callout-note";
note.textContent = data.note;
const foot = document.createElement("p");
foot.className = "note";
foot.textContent = data.foot;
main.append(tools, count, grid, note, foot);
app.replaceChildren(hero, main);

function studiedCount() {
  const s = readStudied();
  return data.episodes.filter((e) => s[e.id]).length;
}
function updateYours() {
  yours.textContent = studiedCount() + " of " + total + " marked studied on this device.";
}

function draw() {
  buttons.forEach((b, i) => b.setAttribute("aria-pressed", filters[i][0] === filter ? "true" : "false"));
  const q = query.trim().toLowerCase();
  const shown = data.episodes.filter((e) => {
    if (filter === "ready" && !e.page) return false;
    if (filter === "soon" && e.page) return false;
    if (filter === "bonus" && !e.bonus) return false;
    if (!q) return true;
    return (e.title + " " + e.passage + " ep " + e.ep).toLowerCase().includes(q);
  });
  count.textContent = "Showing " + shown.length + " of " + total;
  grid.replaceChildren();
  const studied = readStudied();
  updateYours();
  if (!shown.length) {
    const empty = document.createElement("p");
    empty.textContent = "No episodes match that search.";
    grid.append(empty);
    return;
  }
  shown.forEach((e) => {
    const acc = e.bonus ? "var(--gold)" : accents[(chapterOf(e.passage) - 1 + accents.length) % accents.length];
    const yt = "https://www.youtube.com/watch?v=" + e.id + "&list=" + PLAY + "&index=" + e.n;
    const card = document.createElement("article");
    card.className = "ep reveal" + (e.page ? " ready" : "") + (e.bonus ? " bonus" : "");
    card.style.setProperty("--acc", acc);
    const topRow = document.createElement("div");
    topRow.className = "note";
    const num = document.createElement("span");
    num.style.fontFamily = "var(--kicker)";
    num.style.color = "var(--acc)";
    num.textContent = e.bonus ? "Bible Night Live " + e.ep.replace("BNL ", "Ep. ") : "Episode " + e.ep;
    topRow.append(num, document.createTextNode(" · #" + e.n + " in playlist · " + e.len));
    const pass = document.createElement("div");
    pass.className = "pass";
    pass.textContent = e.bonus ? "Bonus episode" : e.passage;
    const h3 = document.createElement("h3");
    h3.textContent = e.title;
    const tags = document.createElement("div");
    if (e.page) {
      const t = document.createElement("span");
      t.className = "tag v";
      const dot = document.createElement("span");
      dot.className = "pulse";
      dot.setAttribute("aria-hidden", "true");
      t.append(dot, document.createTextNode(" Study page ready"));
      tags.append(t);
    } else {
      const t = document.createElement("span");
      t.className = "tag d";
      t.textContent = "Coming soon";
      tags.append(t);
    }
    if (e.bonus) {
      const b = document.createElement("span");
      b.className = "tag b";
      b.textContent = "Bonus";
      tags.append(document.createTextNode(" "), b);
    }
    const links = document.createElement("div");
    links.className = "links";
    if (e.page) {
      const a = document.createElement("a");
      a.className = "pill go";
      a.href = e.page;
      a.textContent = "Open study page";
      links.append(a);
    }
    const y = document.createElement("a");
    y.className = "pill";
    y.href = yt;
    y.target = "_blank";
    y.rel = "noopener noreferrer";
    y.textContent = "YouTube";
    links.append(y);
    if (e.passage) {
      const l = document.createElement("a");
      l.className = "pill";
      l.href = lsbLink(e.passage);
      l.target = "_blank";
      l.rel = "noopener noreferrer";
      l.textContent = "LSB";
      links.append(l);
    }
    const lab = document.createElement("label");
    lab.className = "checkline noprint";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = !!studied[e.id];
    box.addEventListener("change", () => {
      const all = readStudied();
      all[e.id] = box.checked;
      writeStudied(all);
      updateYours();
    });
    lab.append(box, document.createTextNode(" Mark studied"));
    card.append(topRow, pass, h3, tags, links, lab);
    grid.append(card);
  });
}

draw();
requestAnimationFrame(() => fill.classList.add("on"));
