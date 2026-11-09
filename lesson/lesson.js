/* lessons.json is newest-first.
   A full lesson: { id, date, dateLong, title, summary, sources, tree }.
   tree nodes are { t, p, c } — Section, Text, Steps, Callout, Quote, Rows, LinkCards, BulletList, Table.
   A title with no write-up yet is { id, date, dateLong, title } and stays in the archive. */
import { renderPage } from "../shelf/doc.js";

const data = await fetch(new URL("data/lessons.json", import.meta.url).href).then((r) => {
  if (!r.ok) throw new Error("lessons");
  return r.json();
});

const app = document.querySelector("#app");
const KEY = "lesson-steps";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch (e) { return {}; }
}
function write(v) { localStorage.setItem(KEY, JSON.stringify(v)); }

function chosenId() {
  const q = new URLSearchParams(location.search).get("id");
  if (q && data.lessons.some((l) => l.id === q)) return q;
  try {
    const saved = localStorage.getItem("lesson-open");
    if (saved && data.lessons.some((l) => l.id === saved)) return saved;
  } catch (e) {}
  return data.lessons[0].id;
}

function paint(id) {
  const lesson = data.lessons.find((l) => l.id === id) || data.lessons[0];
  try { localStorage.setItem("lesson-open", lesson.id); } catch (e) {}
  const url = new URL(location.href);
  url.searchParams.set("id", lesson.id);
  history.replaceState(null, "", url);

  app.replaceChildren();
  const bar = document.createElement("div");
  bar.className = "wrap archive";
  const label = document.createElement("p");
  label.className = "kicker";
  label.textContent = "Lesson archive";
  bar.append(label);
  const nav = document.createElement("div");
  nav.className = "seg";
  nav.setAttribute("role", "group");
  nav.setAttribute("aria-label", "Lessons");
  data.lessons.forEach((l) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = l.date;
    b.setAttribute("aria-pressed", l.id === lesson.id ? "true" : "false");
    b.addEventListener("click", () => paint(l.id));
    nav.append(b);
  });
  bar.append(nav);
  app.append(bar);

  const host = document.createElement("div");
  app.append(host);
  if (lesson.tree) {
    renderPage(lesson.tree, host);
    const saved = read()[lesson.id] || {};
    const inputs = [...host.querySelectorAll("input[data-step]")];
    const live = document.createElement("p");
    live.className = "note wrap";
    live.setAttribute("aria-live", "polite");
    function count() {
      const n = inputs.filter((i) => i.checked).length;
      live.textContent = n + " of " + inputs.length + " steps marked on this device.";
    }
    inputs.forEach((input) => {
      input.checked = !!saved[input.dataset.step];
      input.addEventListener("change", () => {
        const all = read();
        all[lesson.id] = all[lesson.id] || {};
        all[lesson.id][input.dataset.step] = input.checked;
        write(all);
        count();
      });
    });
    count();
    const steps = host.querySelector(".steps");
    if (steps) steps.before(live);
  } else {
    const sec = document.createElement("section");
    sec.className = "wrap";
    const k = document.createElement("p");
    k.className = "kicker";
    k.textContent = lesson.dateLong || lesson.date;
    const h = document.createElement("h1");
    h.textContent = lesson.title;
    const p = document.createElement("p");
    p.className = "lede";
    p.textContent = "This title is in the lesson archive. The source page listed it and did not include the full write-up, so nothing is added here.";
    sec.append(k, h, p);
    host.append(sec);
  }
}

paint(chosenId());
