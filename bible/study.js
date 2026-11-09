/* Study pages read bible/data/<id>.json. Add an episode by copying a data file
   and a folder (see bible/hub.js). Scripture strings are rendered as text, not HTML. */
const id = document.body.dataset.study;
const d = await fetch(new URL("data/" + id + ".json", import.meta.url).href).then((r) => {
  if (!r.ok) throw new Error("study");
  return r.json();
});

const app = document.querySelector("#app");
const S = d.sections;
const accents = ["var(--coral)", "var(--teal)", "var(--gold)", "var(--violet)", "var(--sky)"];

function lsb(book, ch) {
  if (d.lsb === "plus") return "https://read.lsbible.org/?q=" + book.replace(/ /g, "+") + "+" + ch;
  return "https://read.lsbible.org/?q=" + book.replace(/ /g, "") + ch;
}
function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}
function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
function write(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

const TAG = { v: "From the video", b: "Background", d: "Debated", l: "LSB text" };

function head(sec) {
  const k = el("p", "kicker");
  k.append(sec.n);
  (sec.tags || []).forEach((t) => {
    k.append(" · ");
    const s = el("span", "tag " + t);
    s.textContent = TAG[t] || t;
    k.append(s);
  });
  const h = el("h2");
  h.textContent = sec.h;
  const bits = [k, h];
  if (sec.sub) {
    const p = el("p", "note");
    p.textContent = sec.sub;
    bits.push(p);
  }
  return bits;
}
function quote(text, cite, bg) {
  const q = el("blockquote", "pq reveal");
  if (bg === "gold") q.style.background = "var(--tint-g)";
  if (bg === "teal") q.style.background = "var(--tint-t)";
  if (bg === "violet") q.style.background = "var(--tint-v)";
  q.append(text);
  const c = el("cite");
  c.textContent = cite;
  q.append(c);
  return q;
}
function markPhrase(parent, text) {
  const phrases = ["not typical", "listen for the Old Testament"];
  const phrase = phrases.find((p) => text.includes(p));
  if (!phrase) { parent.append(text); return; }
  const i = text.indexOf(phrase);
  parent.append(text.slice(0, i));
  const m = el("mark", "hl");
  m.textContent = phrase;
  parent.append(m, text.slice(i + phrase.length));
}
function figures(list) {
  if (!list || !list.length) return null;
  const box = el("div", "figs");
  list.forEach((f) => {
    const fig = el("figure", "fig");
    fig.style.transform = "rotate(" + f.tilt + "deg)";
    const img = el("img");
    img.src = f.src;
    img.alt = f.alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", () => fig.remove());
    const cap = el("figcaption");
    const hand = el("span", "hand");
    hand.textContent = f.cap;
    const a = el("a");
    a.href = f.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = f.credit;
    cap.append(hand, a);
    fig.append(img, cap);
    box.append(fig);
  });
  return box;
}
function card(kids) {
  const c = el("div", "card reveal");
  kids.forEach((k) => { if (k) c.append(k); });
  return c;
}

function svg(name, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
  return n;
}
const FILL = { soft: "var(--soft)", sky: "var(--sky)", coral: "var(--coral)", gold: "var(--gold)", teal: "var(--teal)", violet: "var(--violet)", ink: "var(--ink)" };

function mapBlock() {
  const decor = d.mapDecor;
  const wrap = el("div", "card map reveal");
  const s = svg("svg", { viewBox: "0 0 700 438", role: "img" });
  const title = svg("title", {});
  title.textContent = decor.aria;
  s.append(title);
  s.setAttribute("aria-label", decor.aria);
  s.append(svg("rect", { x: 0, y: 0, width: 700, height: 438, fill: "var(--sea)" }));
  s.append(svg("path", { d: d.MAP.land, fill: "var(--land)", stroke: "var(--land-edge)", "stroke-width": 1 }));
  s.append(svg("path", { d: d.MAP.lakes, fill: "var(--sea)" }));
  s.append(svg("path", { d: d.MAP.rivers, fill: "none", stroke: "var(--sky)", "stroke-width": 1.6, opacity: 0.8 }));
  (decor.labels || []).forEach((lb) => {
    const t = svg("text", {
      x: lb.x, y: lb.y, "font-size": lb.size || 12,
      fill: FILL[lb.fill] || "var(--ink)",
      "font-family": lb.family === "display" ? "Playfair Display, Georgia, serif" : "Nunito, sans-serif",
      "font-weight": lb.weight || 400,
      "font-style": lb.italic ? "italic" : "normal",
    });
    if (lb.rotate) t.setAttribute("transform", "rotate(" + lb.rotate + ")");
    if (lb.spacing) t.setAttribute("letter-spacing", lb.spacing);
    t.textContent = lb.text;
    s.append(t);
  });
  (decor.routes || []).forEach((r) => {
    s.append(svg("path", { class: "route", d: r.d, fill: "none", stroke: FILL[r.stroke], "stroke-width": 2.6 }));
  });
  d.PLACES.forEach((p, i) => {
    const col = p.video ? "var(--teal)" : "var(--gold)";
    const g = svg("g", {});
    const pulse = svg("circle", { class: "dot", cx: p.x, cy: p.y, r: 5, fill: col });
    pulse.style.animationDelay = (i * 0.3) + "s";
    g.append(pulse);
    g.append(svg("circle", { cx: p.x, cy: p.y, r: 4.5, fill: col, stroke: "var(--paper)", "stroke-width": 1.5 }));
    if (Math.abs(p.lx - p.x) > 30) {
      g.append(svg("line", {
        x1: p.x, y1: p.y,
        x2: p.anchor === "end" ? p.lx + 3 : p.lx - 3,
        y2: p.ly - 4, stroke: "var(--soft)", "stroke-width": 0.8,
      }));
    }
    const t = svg("text", {
      x: p.lx, y: p.ly, "text-anchor": p.anchor, "font-size": 14, "font-weight": 800,
      fill: "var(--ink)", "font-family": "Nunito, sans-serif",
    });
    t.textContent = p.name;
    g.append(t);
    s.append(g);
  });
  wrap.append(s);
  if (decor.legend) {
    const leg = el("div", "legend");
    decor.legend.forEach((item) => {
      const span = el("span");
      const i = el("i");
      i.style.borderColor = FILL[item.stroke];
      span.append(i, document.createTextNode(item.label));
      leg.append(span);
    });
    wrap.append(leg);
  }
  const note = el("p", "note");
  note.textContent = decor.note;
  wrap.append(note);
  const grid = el("div", "grid two");
  d.PLACES.forEach((p) => {
    const c = card([]);
    const strong = el("strong");
    strong.textContent = p.name + " ";
    const tag = el("span", "tag " + (p.video ? "v" : "b"));
    tag.textContent = p.video ? "Video" : "Background";
    const line = el("div");
    line.style.fontSize = "14px";
    line.textContent = p.note;
    c.append(strong, tag, line);
    grid.append(c);
  });
  const frag = el("div");
  frag.append(wrap, grid);
  const extra = figures(d.figures && d.figures.map);
  if (extra) frag.append(extra);
  return frag;
}

function section(sid) {
  const sec = S[sid];
  const node = el("section", "sec");
  node.id = sid;
  head(sec).forEach((n) => node.append(n));
  if (sid === "summary") {
    const split = el("div", "split");
    const list = el("ul", "li");
    d.SUMMARY.forEach((s) => { const li = el("li"); li.textContent = s; list.append(li); });
    const left = el("div", "card reveal");
    left.style.borderLeft = "6px solid var(--teal)";
    left.append(list);
    const right = el("div");
    right.style.display = "grid";
    right.style.gap = "14px";
    d.QUOTES.slice(0, 2).forEach((q, i) => right.append(quote(q, "From the video (auto-captions, lightly cleaned)", i === 0 && d.star ? "gold" : i === 1 && d.star ? "violet" : "")));
    split.append(left, right);
    node.append(split);
    const pics = figures(d.figures && d.figures.summary);
    if (pics) node.append(pics);
    const method = d.method || d.listen;
    if (method) {
      const box = el("div", "card reveal");
      box.style.background = "var(--tint-g)";
      const h = el("h3");
      h.textContent = method.h;
      const p = el("p");
      p.style.margin = "0";
      markPhrase(p, method.p);
      box.append(h, p);
      node.append(box);
    }
    if (sec.note) {
      const n = el("p", "note");
      n.textContent = sec.note;
      node.append(n);
    }
  }
  if (sid === "passages") {
    const grid = el("div", "grid two");
    d.PASSAGES.forEach((p, i) => {
      const c = card([]);
      c.style.borderTop = "6px solid " + accents[i % 5];
      const h = el("h3");
      const a = el("a");
      a.href = lsb(p.book, p.ch);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = p.ref;
      h.append(a);
      const note = el("div");
      note.textContent = p.note;
      c.append(h, note);
      grid.append(c);
    });
    const h3 = el("h3");
    h3.textContent = "Key verses in the LSB";
    h3.style.marginTop = "22px";
    const verses = el("div", "grid two");
    d.LSB_QUOTES.forEach((q) => {
      const v = el("div", "verse reveal");
      v.append("“" + q.text + "”");
      v.append(el("br"));
      const a = el("a");
      a.href = lsb(q.book, q.ch);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = q.ref;
      v.append(a);
      verses.append(v);
    });
    node.append(grid, h3, verses);
  }
  if (sid === "tree" && d.GEN) {
    const grid = el("div", "grid");
    grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(240px, 1fr))";
    const color = { coral: "var(--coral)", teal: "var(--teal)", violet: "var(--violet)" };
    d.GEN.forEach((g) => {
      const c = card([]);
      c.style.borderTop = "6px solid " + (color[g.color] || "var(--coral)");
      const k = el("p", "kicker");
      k.style.color = color[g.color];
      k.textContent = g.label;
      const h = el("h3");
      h.textContent = g.span;
      const chips = el("div", "chips");
      g.names.forEach((x) => {
        const chip = el("span", "mini");
        chip.textContent = x.n;
        chips.append(chip);
        if (x.w) {
          const w = el("span", "mini w");
          w.textContent = "✦ " + x.w;
          chips.append(w);
        }
      });
      c.append(k, h, chips);
      grid.append(c);
    });
    node.append(grid);
    if (sec.note) {
      const n = el("p", "note");
      n.textContent = sec.note;
      node.append(n);
    }
    if (sec.quote != null) node.append(quote(d.QUOTES[sec.quote], "From the video", "teal"));
  }
  if (sid === "fulfil" && d.FULFIL) {
    d.FULFIL.forEach((f, i) => {
      const c = el("article", "card lock reveal");
      c.style.borderLeft = "6px solid " + accents[i % 4];
      const icon = el("div", "lockicon");
      icon.style.setProperty("--accent", accents[i % 4]);
      icon.textContent = "🔓";
      icon.setAttribute("aria-hidden", "true");
      const body = el("div");
      const h = el("h3");
      h.append(f.n + ". " + f.mt + " ← ");
      if (f.n === 4) h.append(f.ot);
      else {
        const a = el("a");
        a.href = lsb(f.otBook, f.otCh);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = f.ot;
        h.append(a);
      }
      const pair = el("div", "pair");
      const left = el("div");
      left.style.background = "var(--tint-t)";
      const lb = el("b");
      lb.style.color = "var(--teal)";
      lb.textContent = "Matthew (LSB)";
      left.append(lb, "“" + f.mtText + "”");
      const right = el("div");
      right.style.background = f.n === 4 ? "var(--tint-v)" : "var(--tint-c)";
      const rb = el("b");
      rb.style.color = f.n === 4 ? "var(--violet)" : "var(--coral)";
      rb.textContent = f.n === 4 ? "No single source verse" : f.ot + " (LSB)";
      right.append(rb, f.n === 4 ? f.otText : "“" + f.otText + "”");
      pair.append(left, right);
      const note = el("p", "note");
      note.textContent = f.note;
      body.append(h, pair, note);
      c.append(icon, body);
      node.append(c);
    });
    if (sec.quote != null) node.append(quote(d.QUOTES[sec.quote], sec.quoteCite || "From the video", sec.quoteBg));
  }
  if (sid === "exodus" && d.ECHOES) {
    const stack = el("div");
    stack.style.display = "grid";
    stack.style.gap = "12px";
    d.ECHOES.forEach((e) => {
      const row = el("div", "echo reveal");
      const then = el("div", "side");
      then.style.background = "var(--tint-g)";
      const tk = el("div", "kicker");
      tk.style.color = "var(--gold)";
      tk.append("Then · ");
      const ta = el("a");
      ta.href = lsb(e.thenBook, e.thenCh);
      ta.target = "_blank";
      ta.rel = "noopener noreferrer";
      ta.textContent = e.thenRef;
      tk.append(ta);
      then.append(tk, document.createTextNode(e.then));
      const arrow = el("div", "arrow");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "➜";
      const now = el("div", "side");
      now.style.background = "var(--tint-t)";
      const nk = el("div", "kicker");
      nk.style.color = "var(--teal)";
      nk.append("Now · " + e.nowRef + " ");
      if (e.src === "added") {
        const tag = el("span", "tag b");
        tag.textContent = "Added";
        nk.append(tag);
      }
      now.append(nk, document.createTextNode(e.now));
      row.append(then, arrow, now);
      stack.append(row);
    });
    node.append(stack);
    if (sec.quote != null) node.append(quote(d.QUOTES[sec.quote], "From the video"));
  }
  if (sid === "people") {
    const grid = el("div", "grid two");
    d.PEOPLE.forEach((p, i) => {
      const c = card([]);
      const h = el("h3");
      h.style.color = accents[i % 5];
      h.textContent = p.name;
      const v = el("p");
      const vt = el("span", "tag v");
      vt.textContent = "Video";
      v.append(vt, " " + p.video);
      const b = el("p");
      const bt = el("span", "tag b");
      bt.textContent = "Background";
      b.append(bt, " " + p.bg);
      const chips = el("div", "chips");
      p.refs.forEach((r) => {
        const a = el("a", "mini");
        a.href = lsb(r.book, r.ch);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = r.label;
        chips.append(a);
      });
      c.append(h, v, b, chips);
      grid.append(c);
    });
    node.append(grid);
    const pics = figures(d.figures && d.figures.people);
    if (pics) node.append(pics);
  }
  if (sid === "map") node.append(mapBlock());
  if (sid === "terms") {
    const grid = el("div", "grid two");
    d.TERMS.forEach((t) => {
      const c = card([]);
      const h = el("h3");
      const m = el("mark", "hl");
      m.textContent = t.term;
      h.append(m);
      const tag = el("span", "tag " + (t.src === "video" ? "v" : "b"));
      tag.textContent = t.src === "video" ? "Video" : "Background";
      const p = el("p");
      p.textContent = t.def;
      c.append(h, tag, p);
      grid.append(c);
    });
    node.append(grid);
  }
  if (sid === "words") {
    const seg = el("div", "seg noprint");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Language");
    const grid = el("div", "grid two");
    let lang = read("bible-lang-" + id, "All");
    const buttons = ["All", "Greek", "Hebrew"].map((k) => {
      const b = el("button", "chip");
      b.type = "button";
      b.textContent = k;
      b.addEventListener("click", () => { lang = k; write("bible-lang-" + id, lang); apply(); });
      return b;
    });
    seg.append(...buttons);
    function apply() {
      buttons.forEach((b) => b.setAttribute("aria-pressed", b.textContent === lang ? "true" : "false"));
      grid.replaceChildren();
      d.WORDS.filter((w) => lang === "All" || w.lang === lang).forEach((w) => {
        const c = card([]);
        const o = el("div", "orig" + (w.lang === "Hebrew" ? " heb" : ""));
        o.style.color = w.lang === "Hebrew" ? "var(--coral)" : "var(--teal)";
        o.textContent = w.orig;
        const tr = el("div");
        const strong = el("span", "strong");
        strong.textContent = w.s;
        tr.append(w.tr + " ", strong);
        tr.style.fontWeight = "800";
        tr.style.fontStyle = "italic";
        const gloss = el("div");
        gloss.textContent = w.gloss;
        const where = el("div", "note");
        where.textContent = w.lang + " · " + w.where;
        c.append(o, tr, gloss, where);
        grid.append(c);
      });
    }
    apply();
    node.append(seg, grid);
  }
  if (sid === "background") {
    const hEst = el("h3");
    const t1 = el("span", "tag b");
    t1.textContent = "Established";
    hEst.append(t1, " Facts most interpreters agree on");
    const g1 = el("div", "grid two");
    d.BACKGROUND.forEach((b) => {
      const c = card([]);
      c.style.borderLeft = "6px solid var(--gold)";
      const h = el("h3");
      h.textContent = b.h;
      const p = el("p");
      p.textContent = b.p;
      c.append(h, p);
      g1.append(c);
    });
    const hDeb = el("h3");
    const t2 = el("span", "tag d");
    t2.textContent = "Debated";
    hDeb.append(t2, " Where scholars differ");
    const g2 = el("div", "grid two");
    d.DEBATES.forEach((b) => {
      const c = card([]);
      c.style.borderLeft = "6px solid var(--violet)";
      c.style.background = "var(--tint-v)";
      const h = el("h3");
      h.textContent = b.h;
      const p = el("p");
      p.textContent = b.p;
      c.append(h, p);
      g2.append(c);
    });
    node.append(hEst, g1, hDeb, g2);
    if (d.CAREFUL) {
      const hC = el("h3");
      const t3 = el("span", "tag l");
      t3.textContent = "Careful reading";
      hC.append(t3, " Small slips in the video");
      const c = card([]);
      c.style.borderLeft = "6px solid var(--coral)";
      const ul = el("ul", "li");
      d.CAREFUL.forEach((line) => { const li = el("li"); li.textContent = line; ul.append(li); });
      c.append(ul);
      node.append(hC, c);
    }
  }
  if (sid === "timeline") {
    const tl = el("div", "tl");
    d.TIMELINE.forEach((t) => {
      const item = el("div", "ti" + (t.marker ? " m" : ""));
      const when = el("div", "when");
      when.append(t.when + " ");
      if (t.debated) {
        const tag = el("span", "tag d");
        tag.textContent = "debated";
        when.append(tag);
      }
      const what = el("div");
      what.style.fontWeight = "800";
      what.textContent = t.what;
      const ref = el("div");
      const a = el("a");
      a.href = lsb(t.book, t.ch);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = t.ref;
      ref.append(a);
      if (t.marker) {
        const hand = el("span", "hand");
        hand.style.color = "var(--coral)";
        hand.style.marginLeft = "10px";
        hand.textContent = t.marker;
        ref.append(hand);
      }
      item.append(when, what, ref);
      tl.append(item);
    });
    node.append(tl);
  }
  if (sid === "xrefs") {
    const grid = el("div", "grid two");
    d.XREFS.forEach((x) => {
      const c = card([]);
      const a = el("a");
      a.href = lsb(x.book, x.ch);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.fontWeight = "800";
      a.textContent = x.label;
      const why = el("div");
      why.textContent = x.why;
      const tag = el("span", "tag " + (x.src === "lsb" ? "l" : "b"));
      tag.textContent = x.src === "lsb" ? "LSB cross-ref" : "Added";
      c.append(a, why, tag);
      grid.append(c);
    });
    node.append(grid);
  }
  if (sid === "questions") {
    const saved = read("bible-q-" + id, {});
    const box = el("div", "qs");
    const live = el("p", "note");
    live.setAttribute("aria-live", "polite");
    function count() {
      const n = d.QUESTIONS.filter((_, i) => saved[i]).length;
      live.textContent = n + " of " + d.QUESTIONS.length + " questions marked on this device.";
    }
    d.QUESTIONS.forEach((q, i) => {
      const c = el("div", "card q reveal");
      const label = el("label");
      const input = el("input");
      input.type = "checkbox";
      input.checked = !!saved[i];
      input.addEventListener("change", () => {
        saved[i] = input.checked;
        write("bible-q-" + id, saved);
        count();
      });
      const span = el("span");
      span.textContent = q;
      label.append(input, span);
      c.append(label);
      box.append(c);
    });
    count();
    node.append(live, box);
  }
  if (sid === "apply") {
    const split = el("div", "split");
    const a = card([]);
    a.style.borderTop = "6px solid var(--teal)";
    const ta = el("span", "tag v");
    ta.textContent = "From the video";
    const pa = el("p");
    pa.textContent = d.APPLICATION_VIDEO;
    a.append(ta, pa);
    const b = card([]);
    b.style.borderTop = "6px solid var(--gold)";
    const tb = el("span", "tag b");
    tb.textContent = "Study note (added)";
    const pb = el("p");
    pb.textContent = d.APPLICATION_ADDED.replace("Study note (added): ", "");
    b.append(tb, pb);
    split.append(a, b);
    node.append(split);
    if (sec.quote != null) node.append(quote(d.QUOTES[sec.quote], "From the video", sec.quoteBg));
  }
  if (sid === "export") node.append(exportBlock());
  return node;
}

let copyState = "idle";
let showText = false;
let printTried = false;
const live = el("div");
live.setAttribute("aria-live", "polite");

function legacyCopy() {
  const ta = el("textarea");
  ta.value = d.NOTES;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  document.body.append(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}
async function copyAll() {
  if (legacyCopy()) { copyState = "copied"; refreshCopy(); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(d.NOTES);
      copyState = "copied";
    } catch (e) {
      copyState = "manual";
      showText = true;
    }
    refreshCopy();
    return;
  }
  copyState = "manual";
  showText = true;
  refreshCopy();
}
function doPrint() {
  printTried = true;
  refreshCopy();
  try { window.print(); } catch (e) { printTried = true; refreshCopy(); }
}
function shareNotes() {
  if (navigator.share) navigator.share({ title: d.kicker, text: d.NOTES }).catch(() => {});
}

let exportHost = null;
function statusLine() {
  live.replaceChildren();
  if (copyState === "copied") {
    const p = el("p", "ok");
    p.textContent = "Copied to the clipboard.";
    live.append(p);
  } else if (copyState === "manual") {
    const p = el("p", "note");
    p.textContent = d.manualCopy;
    live.append(p);
  }
  if (printTried) {
    const p = el("p", "note");
    p.textContent = d.printFail;
    live.append(p);
  }
}
function buttonRow() {
  const row = el("div", "btn-row");
  const copy = el("button", "btn");
  copy.type = "button";
  copy.textContent = "Copy all notes";
  copy.addEventListener("click", copyAll);
  const print = el("button", "btn teal");
  print.type = "button";
  print.textContent = "Print / Save as PDF";
  print.addEventListener("click", doPrint);
  row.append(copy, print);
  if (d.share && navigator.share) {
    const share = el("button", "btn violet");
    share.type = "button";
    share.textContent = "Share to Notes / Goodnotes";
    share.addEventListener("click", shareNotes);
    row.append(share);
  }
  return row;
}
function exportBlock() {
  const box = el("div");
  const row = buttonRow();
  const toggle = el("button", "btn ghost");
  toggle.type = "button";
  toggle.textContent = showText ? "Hide the text" : "Show the text";
  toggle.addEventListener("click", () => { showText = !showText; refreshCopy(); });
  row.append(toggle);
  box.append(row, live);
  if (showText) {
    const ta = el("textarea", "ta");
    ta.readOnly = true;
    ta.value = d.NOTES;
    ta.addEventListener("focus", () => ta.select());
    box.append(ta);
  }
  if (S.export.iphone) {
    const p = el("p", "note");
    p.textContent = S.export.iphone;
    box.append(p);
  }
  exportHost = box;
  statusLine();
  return box;
}
function refreshCopy() {
  if (!exportHost) return;
  const parent = exportHost.parentElement;
  const fresh = exportBlock();
  if (parent) parent.replaceChild(fresh, exportHost);
  const heroLive = document.querySelector("[data-hero-live]");
  if (heroLive) {
    heroLive.replaceChildren();
    if (copyState === "copied") {
      const p = el("p", "ok");
      p.textContent = d.copiedMsg;
      heroLive.append(p);
    } else if (copyState === "manual") {
      const p = el("p", "note");
      p.textContent = d.manualCopy;
      heroLive.append(p);
    }
    if (printTried) {
      const p = el("p", "note");
      p.textContent = d.printFail;
      heroLive.append(p);
    }
  }
}

const hero = el("header", "study-hero wrap");
if (d.star) {
  const star = el("div", "star");
  star.setAttribute("aria-hidden", "true");
  star.textContent = "✦";
  hero.append(star);
}
const kicker = el("p", "kicker");
kicker.textContent = d.kicker;
const h1 = el("h1");
h1.append(d.heroBefore, Object.assign(el("em"), { textContent: d.heroEm }));
const hand = el("p", "hand");
hand.style.color = "var(--" + (d.handColor || "coral") + ")";
hand.textContent = d.hand;
const meta = el("div", "meta");
function pillLink(href, text, external) {
  const a = el("a", "pill");
  a.href = href;
  a.textContent = text;
  if (external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
  return a;
}
meta.append(
  pillLink(d.VIDEO.url, "Watch on YouTube", true),
  Object.assign(el("span", "pill"), { textContent: "Channel: " + d.VIDEO.channel }),
  Object.assign(el("span", "pill"), { textContent: d.VIDEO.length }),
  Object.assign(el("span", "pill"), { textContent: "LSB references" })
);
const full = el("p", "note");
full.append("Full title: " + d.VIDEO.title + ". Series: ");
const series = el("a");
series.href = d.VIDEO.playlist;
series.target = "_blank";
series.rel = "noopener noreferrer";
series.textContent = d.VIDEO.series;
full.append(series);
if (d.links && d.links.hub) full.append(" · ", pillLink(d.links.hub, "Study hub", false));
if (d.links && d.links.prev) full.append(" · ", pillLink(d.links.prev, "Previous episode", false));
if (d.links && d.links.next) full.append(" · ", pillLink(d.links.next, "Next episode", false));
const tags = el("div", "meta");
["v", "b", "d", "l"].forEach((t) => {
  const s = el("span", "tag " + t);
  s.textContent = { v: "From the video", b: "Background (added)", d: "Debated", l: "LSB text" }[t];
  tags.append(s);
});
const actions = buttonRow();
actions.classList.add("noprint");
const heroLive = el("div");
heroLive.dataset.heroLive = "1";
const studied = read("bible-studied", {});
const mark = el("label", "checkline noprint");
const box = el("input");
box.type = "checkbox";
box.checked = !!studied[d.VIDEO.url.split("v=")[1]];
const vid = (d.VIDEO.url.split("v=")[1] || "").split("&")[0];
box.checked = !!studied[vid];
box.addEventListener("change", () => {
  const all = read("bible-studied", {});
  all[vid] = box.checked;
  write("bible-studied", all);
});
mark.append(box, document.createTextNode(" Mark this episode studied"));
hero.append(kicker, h1, hand, meta, full, tags, actions, heroLive, mark);

const nav = el("nav", "nav-sec noprint wrap");
nav.setAttribute("aria-label", "Sections");
d.nav.forEach(([sid, label]) => {
  const b = el("button", "chip");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", () => {
    const target = document.getElementById(sid);
    if (target) target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  nav.append(b);
});

const body = el("div", "wrap");
d.nav.forEach(([sid]) => body.append(section(sid)));
const foot = el("p", "note");
foot.style.marginTop = "28px";
foot.textContent = d.foot;
body.append(foot);

app.replaceChildren(hero, nav, body);
statusLine();
