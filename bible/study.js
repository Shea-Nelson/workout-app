/* Study pages render bible/data/<id>.json (set by <body data-study="<id>">).
   Shared data: data/factbook.json (verified Logos Factbook ids) and data/episodes.json
   (episode order, used for the previous/next links). To add an episode, see bible/ADD-EPISODE.md.
   Scripture and note strings are rendered as text, never as HTML. */
const id = document.body.dataset.study;
const here = (p) => new URL(p, import.meta.url).href;
const getJSON = (p) => fetch(here(p)).then((r) => { if (!r.ok) throw new Error(p); return r.json(); });
const [d, FB, EPS] = await Promise.all([
  getJSON("data/" + id + ".json"),
  getJSON("data/factbook.json").catch(() => null),
  getJSON("data/episodes.json").catch(() => null),
]);

const app = document.querySelector("#app");
const S = d.sections;
const accents = ["var(--coral)", "var(--teal)", "var(--gold)", "var(--violet)", "var(--sky)"];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- small helpers ---------- */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function hidden(n) { n.setAttribute("aria-hidden", "true"); return n; }
function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
  catch (e) { return fallback; }
}
function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
function external(a) {
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.append(el("span", "sr", " (opens in a new tab)"));
  return a;
}
function link(href, text, cls) {
  const a = el("a", cls);
  a.href = href;
  a.textContent = text;
  return /^https?:/.test(href) ? external(a) : a;
}

/* LSB links. A reference label such as "Matthew 2:1-12" or "Micah 5:2; Luke 2:4-7" opens those exact
   verses on read.lsbible.org; anything else falls back to the whole chapter. */
const REF = /^(?:[1-3] )?[A-Z][a-z]+ \d+(?::\d+(?:-\d+)?)?(?:-\d+)?(?:(?:, |; )(?:(?:[1-3] )?[A-Z][a-z]+ )?\d+(?::\d+(?:-\d+)?)?(?:-\d+)?)*$/;
function lsbChapter(book, ch) { return "https://read.lsbible.org/?q=" + book.replace(/ /g, "+") + "+" + ch; }
function lsb(label, book, ch) {
  const clean = String(label || "").replace(/ \(LSB\)$/, "").trim();
  if (REF.test(clean)) return "https://read.lsbible.org/?q=" + encodeURIComponent(clean).replace(/%20/g, "+").replace(/%3A/g, ":").replace(/%3B/g, ";").replace(/%2C/g, ",");
  return lsbChapter(book, ch);
}
function lsbLink(label, book, ch, text, cls) { return link(lsb(label, book, ch), text || label, cls); }

/* Logos Factbook links (ref.ly opens the Logos app). Only ids listed in data/factbook.json are used. */
function fbKey(name) {
  if (!FB) return null;
  if (FB.terms[name]) return name;
  if (FB.aliases && FB.aliases[name]) return FB.aliases[name];
  return null;
}
function fbHref(key) { const t = FB.terms[key]; return "https://ref.ly/logos4/Factbook?ref=" + (t.ref || "bk." + t.id); }
function fbChip(key, short) {
  const a = el("a", "mini fb");
  a.href = fbHref(key);
  a.title = "Open " + FB.terms[key].label + " in the Logos Factbook";
  const ic = el("span", "fbi", "◆");
  ic.setAttribute("aria-hidden", "true");
  a.append(ic, (short ? "" : "Factbook: ") + FB.terms[key].label);
  return external(a);
}
function fbRow(keys) {
  const list = (keys || []).filter((k) => FB && FB.terms[k]);
  if (!list.length) return null;
  const row = el("div", "chips fbrow");
  list.forEach((k) => row.append(fbChip(k)));
  return row;
}

const TAG = { v: "From the video", b: "Background", d: "Debated", l: "LSB text" };
function head(sid, sec, n) {
  const k = el("p", "kicker");
  k.append(String(n).padStart(2, "0"));
  (sec.tags || []).forEach((t) => {
    k.append(" · ");
    k.append(el("span", "tag " + t, TAG[t] || t));
  });
  const h = el("h2", null, sec.h);
  h.id = sid + "-h";
  const bits = [k, h];
  if (sec.sub) bits.push(el("p", "note sub", sec.sub));
  return bits;
}
function quote(text, cite, bg) {
  const q = el("blockquote", "pq reveal");
  if (bg) q.style.background = "var(--tint-" + { gold: "g", teal: "t", violet: "v", coral: "c", sky: "s" }[bg] + ")";
  q.append(text);
  q.append(el("cite", null, cite));
  return q;
}
function markPhrase(parent, text, extra) {
  const phrases = [extra, "not typical", "listen for the Old Testament"].filter(Boolean);
  const phrase = phrases.find((p) => text.includes(p));
  if (!phrase) { parent.append(text); return; }
  const i = text.indexOf(phrase);
  parent.append(text.slice(0, i), el("mark", "hl", phrase), text.slice(i + phrase.length));
}
function figures(list) {
  if (!list || !list.length) return null;
  const box = el("div", "figs");
  list.forEach((f) => {
    const fig = el("figure", "fig reveal");
    fig.style.setProperty("--tilt", f.tilt + "deg");
    const img = el("img");
    img.src = f.src;
    img.alt = f.alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", () => fig.remove());
    const cap = el("figcaption");
    cap.append(el("span", "hand", f.cap), link(f.href, f.credit));
    fig.append(img, cap);
    box.append(fig);
  });
  return box;
}
function card(kids, cls) {
  const c = el("div", "card reveal" + (cls ? " " + cls : ""));
  kids.forEach((k) => { if (k) c.append(k); });
  return c;
}

/* ---------- map ---------- */
function svg(name, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
  return n;
}
const FILL = { soft: "var(--soft)", sky: "var(--sky)", coral: "var(--coral)", gold: "var(--gold)", teal: "var(--teal)", violet: "var(--violet)", ink: "var(--ink)" };

function mapBlock() {
  const decor = d.mapDecor;
  const wrap = el("div", "card map reveal");
  const [VW, VH] = decor.viewBox || [700, 438];
  const s = svg("svg", { viewBox: "0 0 " + VW + " " + VH, role: "img", "aria-labelledby": "map-title" });
  const title = svg("title", { id: "map-title" });
  title.textContent = decor.aria;
  s.append(title);
  s.append(svg("rect", { x: 0, y: 0, width: VW, height: VH, fill: "var(--sea)" }));
  s.append(svg("path", { d: d.MAP.land, fill: "var(--land)", stroke: "var(--land-edge)", "stroke-width": 1 }));
  (decor.areas || []).forEach((a) => s.append(svg("path", { d: a.d, fill: "var(--" + (a.fill || "desert") + ")", stroke: FILL[a.stroke] || "none", "stroke-width": 1.2, "stroke-dasharray": "4 4" })));
  s.append(svg("path", decor.lakeStroke ? { d: d.MAP.lakes, fill: "var(--sea)", stroke: "var(--sky)", "stroke-width": 0.8 } : { d: d.MAP.lakes, fill: "var(--sea)" }));
  s.append(svg("path", { d: d.MAP.rivers, fill: "none", stroke: "var(--sky)", "stroke-width": decor.riverWidth || 1.6, opacity: decor.riverWidth ? 0.9 : 0.8 }));
  if (decor.riverFlow) s.append(svg("path", { class: "flow", d: d.MAP.rivers, fill: "none", stroke: "var(--flow)", "stroke-width": 1.2, opacity: 0.9 }));
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
    if (lb.text === "✦") t.setAttribute("class", "twinkle");
    if (lb.decor) { t.setAttribute("aria-hidden", "true"); t.setAttribute("class", "float"); }
    t.textContent = lb.text;
    s.append(t);
  });
  (decor.routes || []).forEach((r, i) => {
    const p = svg("path", { class: "route", d: r.d, fill: "none", stroke: FILL[r.stroke], "stroke-width": 2.6, "stroke-linecap": "round" });
    p.style.setProperty("--d", (i * 0.9) + "s");
    s.append(p);
  });
  d.PLACES.forEach((p, i) => {
    const col = p.video ? "var(--teal)" : "var(--gold)";
    const g = svg("g", { class: "pin" });
    const pulse = svg("circle", { class: "dot", cx: p.x, cy: p.y, r: 5, fill: col });
    pulse.style.animationDelay = (i * 0.3) + "s";
    g.append(pulse);
    g.append(svg("circle", { cx: p.x, cy: p.y, r: 4.5, fill: col, stroke: "var(--paper)", "stroke-width": 1.5 }));
    if (!decor.noLeaders && Math.abs(p.lx - p.x) > 30) {
      g.append(svg("line", {
        x1: p.x, y1: p.y, x2: p.anchor === "end" ? p.lx + 3 : p.lx - 3, y2: p.ly - 4,
        stroke: "var(--soft)", "stroke-width": 0.8,
      }));
    }
    const t = svg("text", {
      x: p.lx, y: p.ly, "text-anchor": p.anchor, "font-size": decor.pinSize || 14, "font-weight": 800,
      fill: "var(--ink)", "font-family": "Nunito, sans-serif", "paint-order": "stroke",
      stroke: "var(--land)", "stroke-width": 3, "stroke-linejoin": "round",
    });
    t.textContent = p.name;
    g.append(t);
    s.append(g);
  });
  const scroller = el("div", "mapscroll");
  scroller.append(s);
  wrap.append(scroller);
  const keyRow = el("div", "legend");
  const pinV = el("span"); pinV.append(Object.assign(el("b", "pinkey"), { style: "background:var(--teal)" }), "Named in the video");
  const pinB = el("span"); pinB.append(Object.assign(el("b", "pinkey"), { style: "background:var(--gold)" }), "Background");
  keyRow.append(pinV, pinB);
  (decor.legend || []).forEach((item) => {
    const span = el("span");
    const i = el("i");
    i.style.borderColor = FILL[item.stroke];
    span.append(i, document.createTextNode(item.label));
    keyRow.append(span);
  });
  wrap.append(keyRow, el("p", "note", decor.note));
  const grid = el("div", "grid two");
  d.PLACES.forEach((p) => {
    const strong = el("strong", null, p.name + " ");
    const tag = el("span", "tag " + (p.video ? "v" : "b"), p.video ? "Video" : "Background");
    const line = el("div", "small", p.note);
    grid.append(card([strong, tag, line, fbRow(p.fb)], "place"));
  });
  const frag = el("div");
  frag.append(wrap, grid);
  const extra = figures(d.figures && d.figures.map);
  if (extra) frag.append(extra);
  return frag;
}

/* ---------- sections ---------- */
const HANDLED = new Set(["summary", "passages", "tree", "fulfil", "exodus", "voices", "elijah", "tests", "israel", "people", "map", "terms", "words", "background", "timeline", "xrefs", "questions", "apply", "factbook", "export"]);
function section(sid, n) {
  const sec = S[sid] || {};
  const node = el("section", "sec");
  node.id = sid;
  node.setAttribute("aria-labelledby", sid + "-h");
  head(sid, sec, n).forEach((x) => node.append(x));

  if (sid === "summary") {
    const split = el("div", "split");
    const list = el("ul", "li");
    d.SUMMARY.forEach((s) => list.append(el("li", null, s)));
    const left = card([list], "accent-l");
    const right = el("div", "stack");
    const qbg = d.quoteBgs || (d.star ? ["gold", "violet"] : ["", "teal"]);
    d.QUOTES.slice(0, 2).forEach((q, i) => right.append(quote(q, "From the video (auto-captions, lightly cleaned)", qbg[i])));
    split.append(left, right);
    node.append(split);
    const pics = figures(d.figures && d.figures.summary);
    if (pics) node.append(pics);
    const method = d.method || d.listen;
    if (method) {
      const p = el("p");
      p.style.margin = "0";
      markPhrase(p, method.p, method.mark);
      node.append(card([el("h3", null, method.h), p], "tint-g"));
    }
    if (sec.note) node.append(el("p", "note", sec.note));
  }

  if (sid === "passages") {
    const grid = el("div", "grid two");
    d.PASSAGES.forEach((p, i) => {
      const h = el("h3");
      h.append(lsbLink(p.ref || p.label, p.book, p.ch));
      const c = card([h, el("div", null, p.note)]);
      c.style.borderTop = "6px solid " + accents[i % 5];
      grid.append(c);
    });
    const h3 = el("h3", "mt", "Key verses in the LSB");
    const verses = el("div", "grid two");
    d.LSB_QUOTES.forEach((q) => {
      const v = el("div", "verse reveal");
      v.append("“" + q.text + "”", el("br"), lsbLink(q.ref, q.book, q.ch));
      verses.append(v);
    });
    node.append(grid, h3, verses);
  }

  if (sid === "tree" && d.GEN) {
    const grid = el("div", "grid three");
    const color = { coral: "var(--coral)", teal: "var(--teal)", violet: "var(--violet)" };
    d.GEN.forEach((g) => {
      const k = el("p", "kicker", g.label);
      k.style.color = color[g.color];
      const chips = el("div", "chips");
      g.names.forEach((x, i) => {
        const key = fbKey(x.n);
        const chip = key ? el("a", "mini") : el("span", "mini");
        chip.style.setProperty("--i", i);
        chip.textContent = x.n;
        if (key) { chip.href = fbHref(key); chip.title = "Logos Factbook: " + FB.terms[key].label; external(chip); }
        chips.append(chip);
        if (x.w) {
          const wk = fbKey(x.w);
          const w = wk ? el("a", "mini w") : el("span", "mini w");
          w.style.setProperty("--i", i);
          w.textContent = "✦ " + x.w;
          if (wk) { w.href = fbHref(wk); w.title = "Logos Factbook: " + FB.terms[wk].label; external(w); }
          chips.append(w);
        }
      });
      const c = card([k, el("h3", null, g.span), chips], "gen");
      c.style.borderTop = "6px solid " + (color[g.color] || "var(--coral)");
      grid.append(c);
    });
    node.append(grid);
    if (FB) node.append(el("p", "note", "Underlined names open their Logos Factbook article."));
    if (sec.note) node.append(el("p", "note", sec.note));
    if (sec.quote != null) node.append(quote(d.QUOTES[sec.quote], "From the video", "teal"));
  }

  if (sid === "fulfil" && d.FULFIL) {
    const rowWrap = el("div", "stack");
    d.FULFIL.forEach((f, i) => {
      const c = el("article", "card lock reveal");
      c.style.borderLeft = "6px solid " + accents[i % 4];
      const icon = el("div", "lockicon");
      icon.style.background = accents[i % 4];
      icon.style.setProperty("--delay", (0.3 + i * 0.25) + "s");
      icon.setAttribute("aria-hidden", "true");
      icon.append(el("span", "c", "🔒"), el("span", "o", "🔓"));
      const body = el("div");
      const single = !!f.otBook && REF.test(f.ot);
      const h = el("h3");
      h.append(f.n + ". ", lsbLink(f.mt, "Matthew", 1), " ");
      h.append(hidden(el("span", "soft", "←")), " ");
      h.append(single ? lsbLink(f.ot, f.otBook, f.otCh) : f.ot);
      const pair = el("div", "pair");
      const left = el("div", "tint-t");
      left.append(Object.assign(el("b", null, "Matthew (LSB)"), { style: "color:var(--teal)" }), "“" + f.mtText + "”");
      const right = el("div", single ? "tint-c" : "tint-v");
      right.append(Object.assign(el("b", null, single ? f.ot + " (LSB)" : "No single source verse"), { style: "color:" + (single ? "var(--coral)" : "var(--violet)") }), single ? "“" + f.otText + "”" : f.otText);
      pair.append(left, right);
      body.append(h, pair, el("p", "note", f.note));
      c.append(icon, body);
      rowWrap.append(c);
    });
    node.append(rowWrap);
    if (sec.quote != null) node.append(quote(d.QUOTES[sec.quote], sec.quoteCite || "From the video", sec.quoteBg));
  }

  if (sid === "tests" && d.TESTS) {
    const stack = el("div", "stack");
    const tone = { coral: "var(--coral)", gold: "var(--gold)", violet: "var(--violet)", teal: "var(--teal)", sky: "var(--sky)" };
    d.TESTS.forEach((t, i) => {
      const c = el("article", "card test reveal");
      c.style.setProperty("--accent", tone[t.color] || accents[i % 5]);
      const top = el("div", "testtop");
      const badge = hidden(el("div", "testbadge", t.emoji));
      const hh = el("div");
      hh.append(el("p", "kicker", "Test " + t.n + " · " + t.theme), el("h3", null, t.title));
      top.append(badge, hh);
      const pair = el("div", "pair");
      const left = el("div", "tint-c");
      const lb = el("b", null, "The tempter · ");
      lb.style.color = "var(--coral)";
      lb.append(lsbLink(t.offerRef, "Matthew", 4));
      left.append(lb, "“" + t.offer + "”");
      const right = el("div", "tint-t");
      const rb = el("b", null, "Jesus · ");
      rb.style.color = "var(--teal)";
      rb.append(lsbLink(t.answerRef, "Matthew", 4));
      right.append(rb, "“" + t.answer + "”");
      pair.append(left, right);
      const src = el("div", "written");
      const stamp = hidden(el("span", "stamp", "It is written"));
      stamp.style.setProperty("--delay", (0.35 + i * 0.15) + "s");
      const sb = el("b", null, "📜 ");
      sb.append(lsbLink(t.src, t.srcBook, t.srcCh), " (LSB)");
      src.append(stamp, sb, el("span", "srctext", "“" + t.srcText + "”"));
      const kids = [top, pair, src];
      if (t.misused) {
        const m = el("p", "small misuse");
        m.append(el("span", "tag l", "Psalm in context"), " ", t.misused);
        kids.push(m);
      }
      const isr = el("p", "small");
      isr.append(el("span", "tag " + (t.israelSrc === "video" ? "v" : "b"), "Israel in the wilderness"), " " + t.israel + " ");
      (t.israelRefs || []).forEach((r) => isr.append(lsbLink(r.label, r.book, r.ch, r.label, "mini"), " "));
      kids.push(isr);
      if (t.note) kids.push(el("p", "note", t.note));
      kids.forEach((k) => c.append(k));
      stack.append(c);
    });
    node.append(stack);
    if (d.EDEN) {
      const e = d.EDEN;
      const h = el("h3", null, e.h);
      const v = el("div", "verse");
      v.append("“" + e.text + "”", el("br"), lsbLink(e.ref, e.book, e.ch));
      const vp = el("p");
      vp.append(el("span", "tag v", "Video"), " " + e.video);
      const ap = el("p");
      ap.append(el("span", "tag d", "Debated"), " " + e.added + " ");
      (e.refs || []).forEach((r) => ap.append(lsbLink(r.label, r.book, r.ch, r.label, "mini"), " "));
      node.append(card([h, v, vp, ap], "tint-g eden"));
    }
    const pics = figures(d.figures && d.figures.tests);
    if (pics) node.append(pics);
    if (sec.quote != null) node.append(quote(d.QUOTES[sec.quote], sec.quoteCite || "From the video", sec.quoteBg));
  }

  if (sid === "voices" && d.VOICES) {
    const stack = el("div", "stack");
    d.VOICES.forEach((v, i) => {
      const c = el("article", "card lock voice reveal");
      c.style.borderLeft = "6px solid " + accents[i % 5];
      const radar = el("div", "radar", String(v.n));
      radar.style.background = accents[i % 5];
      radar.style.setProperty("--ring", accents[i % 5]);
      radar.style.setProperty("--delay", (0.15 + (i % 3) * 0.2) + "s");
      hidden(radar);
      const h = el("h3");
      h.append(lsbLink(v.ot, v.otBook, v.otCh), " ", hidden(el("span", "soft", "→")), " ", lsbLink(v.nt, "Matthew", 3));
      if (v.src === "lsb") h.append(" ", el("span", "tag b", "Added"));
      const pair = el("div", "pair");
      const left = el("div", "tint-c");
      left.append(Object.assign(el("b", null, v.ot + " (LSB)"), { style: "color:var(--coral)" }), "“" + v.otText + "”");
      const right = el("div", "tint-t");
      right.append(Object.assign(el("b", null, v.nt + " (LSB)"), { style: "color:var(--teal)" }), "“" + v.ntText + "”");
      pair.append(left, right);
      const body = el("div");
      body.append(h, pair, el("p", "note", v.note));
      c.append(radar, body);
      stack.append(c);
    });
    node.append(stack);
    if (sec.quote != null) node.append(quote(d.QUOTES[sec.quote], sec.quoteCite || "From the video", sec.quoteBg));
  }

  if ((sid === "exodus" || sec.echoes) && d.ECHOES) {
    const stack = el("div", "stack");
    d.ECHOES.forEach((e) => {
      const row = el("div", "echo reveal");
      const then = el("div", "side tint-g");
      const tk = el("div", "kicker");
      tk.style.color = "var(--gold)";
      tk.append("Then · ", lsbLink(e.thenRef, e.thenBook, e.thenCh));
      then.append(tk, document.createTextNode(e.then));
      const arrow = el("div", "arrow", "➜");
      arrow.setAttribute("aria-hidden", "true");
      const now = el("div", "side tint-t");
      const nk = el("div", "kicker");
      nk.style.color = "var(--teal)";
      nk.append("Now · ");
      if (REF.test(e.nowRef)) nk.append(lsbLink(e.nowRef, "Matthew", 1)); else nk.append(e.nowRef);
      if (e.src === "added") nk.append(" ", el("span", "tag b", "Added"));
      now.append(nk, document.createTextNode(e.now));
      row.append(then, arrow, now);
      stack.append(row);
    });
    node.append(stack);
    const echoPics = figures(d.figures && d.figures[sid]);
    if (echoPics && sid !== "tests") node.append(echoPics);
    if (sec.quote != null) node.append(quote(d.QUOTES[sec.quote], sec.quoteCite || "From the video", sec.quoteBg));
  }

  if (sid === "people") {
    const grid = el("div", "grid two");
    d.PEOPLE.forEach((p, i) => {
      const h = el("h3", null, p.name);
      h.style.color = accents[i % 5];
      const v = el("p");
      v.append(el("span", "tag v", "Video"), " " + p.video);
      const b = el("p");
      b.append(el("span", "tag b", "Background"), " " + p.bg);
      const chips = el("div", "chips");
      p.refs.forEach((r) => chips.append(lsbLink(r.label, r.book, r.ch, r.label, "mini")));
      (p.fb || []).forEach((k) => { if (FB && FB.terms[k]) chips.append(fbChip(k, true)); });
      grid.append(card([h, v, b, chips]));
    });
    node.append(grid);
    const pics = figures(d.figures && d.figures.people);
    if (pics) node.append(pics);
  }

  if (sid === "map") node.append(mapBlock());

  if (sid === "terms") {
    const grid = el("div", "grid two");
    d.TERMS.forEach((t) => {
      const h = el("h3");
      h.append(el("mark", "hl", t.term));
      const tag = el("span", "tag " + (t.src === "video" ? "v" : "b"), t.src === "video" ? "Video" : "Background");
      grid.append(card([h, tag, el("p", null, t.def), fbRow(t.fb)]));
    });
    node.append(grid);
  }

  if (sid === "words") {
    const seg = el("div", "seg noprint");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Show words in");
    const grid = el("div", "grid two");
    let lang = read("bible-lang-" + id, "All");
    const buttons = ["All", "Greek", "Hebrew"].map((k) => {
      const b = el("button", "chip", k);
      b.type = "button";
      b.addEventListener("click", () => { lang = k; write("bible-lang-" + id, lang); apply(); });
      return b;
    });
    seg.append(...buttons);
    function apply() {
      buttons.forEach((b) => b.setAttribute("aria-pressed", b.textContent === lang ? "true" : "false"));
      grid.replaceChildren();
      d.WORDS.filter((w) => lang === "All" || w.lang === lang).forEach((w) => {
        const heb = w.lang === "Hebrew";
        const o = el("div", "orig" + (heb ? " heb" : ""), w.orig);
        o.lang = heb ? "he" : "grc";
        if (heb) o.dir = "rtl";
        o.style.color = heb ? "var(--coral)" : "var(--teal)";
        const tr = el("div", "tr");
        tr.append(Object.assign(el("i", null, w.tr), { lang: heb ? "he-Latn" : "grc-Latn" }), " ", el("span", "strong", w.s));
        const c = card([o, tr, el("div", null, w.gloss), el("div", "note", w.lang + " · " + w.where), fbRow(w.fb)]);
        c.classList.add("in");
        grid.append(c);
      });
    }
    apply();
    node.append(seg, grid);
  }

  if (sid === "background") {
    const hEst = el("h3", "mt");
    hEst.append(el("span", "tag b", "Established"), " Facts most interpreters agree on");
    const g1 = el("div", "grid two");
    d.BACKGROUND.forEach((b) => {
      const c = card([el("h3", null, b.h), el("p", null, b.p)]);
      c.style.borderLeft = "6px solid var(--gold)";
      g1.append(c);
    });
    const hDeb = el("h3", "mt");
    hDeb.append(el("span", "tag d", "Debated"), " Where scholars differ");
    const g2 = el("div", "grid two");
    d.DEBATES.forEach((b) => {
      const c = card([el("h3", null, b.h), el("p", null, b.p)], "tint-v");
      c.style.borderLeft = "6px solid var(--violet)";
      g2.append(c);
    });
    node.append(hEst, g1);
    if (d.WITNESSES) {
      const hW = el("h3", "mt");
      hW.append(el("span", "tag b", "Sourced"), " Early witnesses");
      const st = el("div", "stack");
      d.WITNESSES.forEach((w, i) => st.append(quote(w.text, w.who + ", " + w.when + ". " + w.src, i === 0 ? "sky" : "teal")));
      node.append(hW, st);
    }
    node.append(hDeb, g2);
    if (d.CAREFUL) {
      const hC = el("h3", "mt");
      hC.append(el("span", "tag l", "Careful reading"), " Small slips in the video");
      const ul = el("ul", "li");
      d.CAREFUL.forEach((line) => ul.append(el("li", null, line)));
      const c = card([d.CAREFUL_INTRO ? el("p", "note", d.CAREFUL_INTRO) : null, ul]);
      c.style.borderLeft = "6px solid var(--coral)";
      node.append(hC, c);
    }
  }

  if (sid === "timeline") {
    const tl = el("div", "tl reveal");
    d.TIMELINE.forEach((t, i) => {
      const item = el("div", "ti" + (t.marker ? " m" : ""));
      item.style.setProperty("--delay", (0.15 + i * 0.18) + "s");
      const when = el("div", "when", t.when + " ");
      if (t.debated) when.append(el("span", "tag d", "debated"));
      const ref = el("div", "small");
      ref.append(lsbLink(t.ref, t.book, t.ch));
      if (t.marker) ref.append(el("span", "hand marker", t.marker));
      item.append(when, el("div", "what", t.what), ref);
      tl.append(item);
    });
    node.append(tl);
  }

  if (sid === "xrefs") {
    const grid = el("div", "grid two");
    d.XREFS.forEach((x) => {
      const a = lsbLink(x.label, x.book, x.ch);
      a.classList.add("b");
      grid.append(card([a, el("div", "small", x.why), el("span", "tag " + (x.src === "lsb" ? "l" : "b"), x.src === "lsb" ? "LSB cross-ref" : "Added")]));
    });
    node.append(grid);
  }

  if (sid === "questions") {
    const saved = read("bible-q-" + id, {});
    const box = el("div", "qs");
    const live = el("p", "note");
    live.setAttribute("aria-live", "polite");
    function count() {
      const k = d.QUESTIONS.filter((_, i) => saved[i]).length;
      live.textContent = k + " of " + d.QUESTIONS.length + " questions marked done on this device.";
    }
    d.QUESTIONS.forEach((q, i) => {
      const c = el("div", "card q reveal");
      const label = el("label");
      const input = el("input");
      input.type = "checkbox";
      input.checked = !!saved[i];
      input.addEventListener("change", () => { saved[i] = input.checked; write("bible-q-" + id, saved); count(); });
      label.append(input, el("span", null, q));
      c.append(label);
      box.append(c);
    });
    count();
    node.append(live, box);
  }

  if (sid === "apply") {
    const split = el("div", "split");
    const a = card([el("span", "tag v", "From the video"), el("p", null, d.APPLICATION_VIDEO)]);
    a.style.borderTop = "6px solid var(--teal)";
    const b = card([el("span", "tag b", "Study note (added)"), el("p", null, d.APPLICATION_ADDED.replace("Study note (added): ", ""))]);
    b.style.borderTop = "6px solid var(--gold)";
    split.append(a, b);
    node.append(split);
    if (sec.quote != null) node.append(quote(d.QUOTES[sec.quote], "From the video", sec.quoteBg));
  }

  if (sid === "factbook") {
    const grid = el("div", "fbgrid");
    d.factbook.filter((k) => FB.terms[k]).forEach((k) => {
      const a = fbChip(k, true);
      a.classList.add("reveal");
      grid.append(a);
    });
    node.append(grid);
  }

  /* Generic blocks for new episode-specific sections: any section may carry
     "list": ["..."], "cards": [{ "h", "p", "tag": "v|b|d|l", "ref", "book", "ch", "fb": [] }],
     and "quote": <index into QUOTES>. */
  if (!HANDLED.has(sid)) {
    /* "ladder": rows drawn as a stepped mountain ({ ref, text, tail, lvl, hl, color }), for chiasms
       and repeated patterns. lvl sets the indent; hl marks the peak; tail is the repeated refrain. */
    if (sec.ladder) {
      const lad = el("div", "ladder card reveal");
      if (sec.ladder.title) lad.append(el("p", "kicker", sec.ladder.title));
      const tone = { coral: "var(--coral)", gold: "var(--gold)", violet: "var(--violet)", teal: "var(--teal)", sky: "var(--sky)" };
      sec.ladder.rows.forEach((r, i) => {
        const row = el("div", "rung" + (r.hl ? " peak" : ""));
        row.style.setProperty("--lvl", r.lvl || 0);
        row.style.setProperty("--i", i);
        row.style.setProperty("--accent", tone[r.color] || accents[i % 5]);
        if (r.mark) row.append(hidden(el("span", "rmark", r.mark)));
        const tx = el("span", "rtext");
        if (r.ref) tx.append(lsbLink(r.ref, r.book || "Matthew", r.ch || 1, r.short || r.ref, "mini"), " ");
        tx.append(r.text);
        if (r.tail) tx.append(" ", el("mark", "hl", r.tail));
        row.append(tx);
        lad.append(row);
      });
      if (sec.ladder.note) lad.append(el("p", "note", sec.ladder.note));
      node.append(lad);
    }
    /* "feature": <key of a list in the data> renders paired cards: a badge, two tinted panels
       (left / right, each { who, ref, book, ch, text, tone }), an optional stamped source box,
       tagged extra lines and Factbook chips. Used for Episodes 5-9 (fulfilment, beatitudes, antitheses...). */
    if (sec.feature && Array.isArray(d[sec.feature])) {
      const stack = el("div", "stack");
      const tone = { coral: "var(--coral)", gold: "var(--gold)", violet: "var(--violet)", teal: "var(--teal)", sky: "var(--sky)" };
      const tint = { coral: "tint-c", teal: "tint-t", gold: "tint-g", violet: "tint-v", sky: "tint-s" };
      const panel = (p, fallback) => {
        const box = el("div", tint[p.tone || fallback] || "tint-t");
        const b = el("b", null, (p.who || "") + (p.ref ? " · " : ""));
        b.style.color = tone[p.tone || fallback] || "var(--teal)";
        if (p.ref) b.append(lsbLink(p.ref, p.book || "Matthew", p.ch || 1));
        box.append(b, p.plain ? p.text : "“" + p.text + "”");
        return box;
      };
      d[sec.feature].forEach((t, i) => {
        const c = el("article", "card test feat reveal");
        c.style.setProperty("--accent", tone[t.color] || accents[i % 5]);
        const top = el("div", "testtop");
        const badge = hidden(el("div", "testbadge", t.emoji || String(t.n)));
        const hh = el("div");
        hh.append(el("p", "kicker", t.kicker || ""), el("h3", null, t.title));
        top.append(badge, hh);
        const kids = [top];
        if (t.left || t.right) {
          const pair = el("div", "pair");
          if (t.left) pair.append(panel(t.left, "coral"));
          if (t.right) pair.append(panel(t.right, "teal"));
          kids.push(pair);
        }
        if (t.src) {
          const src = el("div", "written");
          if (t.stamp || sec.stamp) {
            const st = hidden(el("span", "stamp", t.stamp || sec.stamp));
            st.style.setProperty("--delay", (0.35 + (i % 4) * 0.15) + "s");
            src.append(st);
          }
          const sb = el("b", null, (t.src.icon || "📜") + " ");
          if (t.src.ref) sb.append(lsbLink(t.src.ref, t.src.book, t.src.ch), t.src.plain ? "" : " (LSB)");
          else sb.append(t.src.who || "");
          src.append(sb, el("span", "srctext", t.src.plain ? t.src.text : "“" + t.src.text + "”"));
          kids.push(src);
        }
        (t.lines || []).forEach((ln) => {
          const p = el("p", "small");
          p.append(el("span", "tag " + (ln.tag || "b"), ln.label || TAG[ln.tag || "b"]), " " + ln.text + " ");
          (ln.refs || []).forEach((r) => p.append(lsbLink(r.label, r.book, r.ch, r.label, "mini"), " "));
          kids.push(p);
        });
        if (t.note) kids.push(el("p", "note", t.note));
        const fr = fbRow(t.fb);
        if (fr) kids.push(fr);
        kids.forEach((k) => c.append(k));
        stack.append(c);
      });
      node.append(stack);
    }
    if (sec.verse) {
      const v = el("div", "verse reveal");
      v.append("“" + sec.verse.text + "”", el("br"), lsbLink(sec.verse.ref, sec.verse.book, sec.verse.ch));
      node.append(v);
    }
    if (sec.list) {
      const ul = el("ul", "li");
      sec.list.forEach((x) => ul.append(el("li", null, x)));
      node.append(card([ul], "accent-l"));
    }
    if (sec.cards) {
      const grid = el("div", "grid two");
      sec.cards.forEach((c, i) => {
        const kids = [el("h3", null, c.h)];
        if (c.tag) kids.push(el("span", "tag " + c.tag, TAG[c.tag] || c.tag));
        kids.push(el("p", null, c.p));
        if (c.ref) { const r = el("div", "small"); r.append(lsbLink(c.ref, c.book, c.ch)); kids.push(r); }
        kids.push(fbRow(c.fb));
        const k = card(kids);
        k.style.borderTop = "6px solid " + accents[i % 5];
        grid.append(k);
      });
      node.append(grid);
    }
    const extraPics = figures(d.figures && d.figures[sid]);
    if (extraPics) node.append(extraPics);
    if (sec.quote != null && d.QUOTES[sec.quote]) node.append(quote(d.QUOTES[sec.quote], sec.quoteCite || "From the video", sec.quoteBg));
  }
  if (sid === "export") node.append(exportBlock());
  return node;
}

/* ---------- copy, PDF and print ---------- */
let copyState = "idle";
let showText = false;
let printTried = false;
const live = el("div");
live.setAttribute("aria-live", "polite");
const heroLive = el("div");
heroLive.setAttribute("aria-live", "polite");

function legacyCopy() {
  const ta = el("textarea");
  ta.value = d.NOTES;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
  document.body.append(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, d.NOTES.length);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}
async function copyAll() {
  if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
    try { await navigator.clipboard.writeText(d.NOTES); copyState = "copied"; refresh(); return; }
    catch (e) { /* fall through */ }
  }
  if (legacyCopy()) copyState = "copied";
  else { copyState = "manual"; showText = true; }
  refresh();
}
function revealAll() { document.querySelectorAll(".reveal").forEach((n) => n.classList.add("in")); }
function doPrint() {
  printTried = true;
  revealAll();
  refresh();
  try { window.print(); } catch (e) {}
}
function pdfLink(cls) {
  if (!d.pdf) return null;
  const a = el("a", "btn " + (cls || "gold"));
  a.href = d.pdf.href;
  a.setAttribute("download", d.pdf.file);
  a.append("Download PDF for Goodnotes ", el("span", "btn-sub", "(" + d.pdf.pages + " pages, color, " + d.pdf.size + ")"));
  return a;
}
function buttonRow(withToggle) {
  const row = el("div", "btn-row noprint");
  const pdf = pdfLink("gold");
  if (pdf) row.append(pdf);
  const copy = el("button", "btn", "Copy all notes");
  copy.type = "button";
  copy.addEventListener("click", copyAll);
  const print = el("button", "btn teal", "Print");
  print.type = "button";
  print.addEventListener("click", doPrint);
  row.append(copy, print);
  if (withToggle) {
    const toggle = el("button", "btn ghost", showText ? "Hide the text" : "Show the text");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", showText ? "true" : "false");
    toggle.addEventListener("click", () => { showText = !showText; refresh(); });
    row.append(toggle);
  }
  return row;
}
function status(target, copiedMsg) {
  target.replaceChildren();
  if (copyState === "copied") target.append(el("p", "ok", copiedMsg));
  else if (copyState === "manual") target.append(el("p", "note", d.manualCopy));
  if (printTried) target.append(el("p", "note", d.printFail));
}
let exportHost = null;
function exportBlock() {
  const box = el("div");
  box.append(buttonRow(true), live);
  if (showText) {
    const ta = el("textarea", "ta");
    ta.readOnly = true;
    ta.value = d.NOTES;
    ta.setAttribute("aria-label", "All notes as plain text");
    ta.addEventListener("focus", () => ta.select());
    box.append(ta);
  }
  if (S.export && S.export.iphone) box.append(el("p", "note", S.export.iphone));
  exportHost = box;
  status(live, "Copied to the clipboard.");
  return box;
}
function refresh() {
  if (exportHost && exportHost.parentElement) exportHost.parentElement.replaceChild(exportBlock(), exportHost);
  status(heroLive, d.copiedMsg);
}

/* ---------- episode neighbours (from episodes.json, so new episodes link up automatically) ---------- */
const eps = EPS ? EPS.episodes : [];
const pageOf = (e) => (e && e.page ? "../" + e.page : null);
const meIdx = eps.findIndex((e) => e.page === id + "/");
const prevEp = meIdx > 0 ? eps[meIdx - 1] : null;
const nextEp = meIdx >= 0 ? eps[meIdx + 1] : null;
function epLabel(e) { return "Episode " + e.ep + " · " + (e.passage || "Bonus"); }

/* ---------- hero ---------- */
const hero = el("header", "study-hero wrap");
if (d.heroIcon === "dove") {
  hero.classList.add("hero-sky");
  const wrapD = hidden(el("div", "dovewrap"));
  wrapD.append(el("div", "dove", "🕊️"), el("div", "ripple"), el("div", "ripple r2"));
  hero.append(wrapD);
} else if (d.heroIcon && d.heroIcon.emoji) {
  if (d.heroIcon.gradient) hero.classList.add("hero-" + d.heroIcon.gradient);
  const wrapE = hidden(el("div", "heroemoji"));
  wrapE.append(el("div", "glyph", d.heroIcon.emoji));
  (d.heroIcon.orbit || []).forEach((o, i) => { const sp = el("span", "orbit", o); sp.style.setProperty("--i", i); wrapE.append(sp); });
  hero.append(wrapE);
} else if (d.star) {
  hero.append(hidden(el("div", "star", "✦")));
}
const crumbs = el("nav", "crumbs noprint");
crumbs.setAttribute("aria-label", "Breadcrumb");
crumbs.append(link("../", "Matthew study hub"), hidden(el("span", null, " / ")), el("span", null, "Episode " + (meIdx >= 0 ? eps[meIdx].ep : "")));
const h1 = el("h1");
h1.append(d.heroBefore, el("em", null, d.heroEm));
const hand = el("p", "hand", d.hand);
hand.style.color = "var(--" + (d.handColor || "coral") + ")";
const meta = el("div", "meta");
const chapter = d.chapterRef || (d.PASSAGES[0] && d.PASSAGES[0].ref.split(":")[0]);
meta.append(
  link(d.VIDEO.url, "▶ Watch on YouTube", "pill"),
  lsbLink(chapter, "Matthew", 1, "Read " + chapter + " in the LSB", "pill"),
  el("span", "pill", d.VIDEO.length),
  el("span", "pill", "Channel: " + d.VIDEO.channel)
);
const full = el("p", "note");
full.append("Full title: " + d.VIDEO.title + ". Series: ", link(d.VIDEO.playlist, d.VIDEO.series), ".");
const tags = el("div", "meta");
["v", "b", "d", "l"].forEach((t) => tags.append(el("span", "tag " + t, { v: "From the video", b: "Background (added)", d: "Debated", l: "LSB text" }[t])));
if (FB && d.factbook) tags.append(Object.assign(el("span", "tag fbtag"), { textContent: "◆ Logos Factbook link" }));
const actions = buttonRow(false);
const vid = (d.VIDEO.url.split("v=")[1] || "").split("&")[0];
const mark = el("label", "checkline noprint");
const box = el("input");
box.type = "checkbox";
box.checked = !!read("bible-studied", {})[vid];
box.addEventListener("change", () => {
  const all = read("bible-studied", {});
  all[vid] = box.checked;
  write("bible-studied", all);
});
mark.append(box, document.createTextNode(" I've studied this episode"));
hero.append(crumbs, el("p", "kicker", d.kicker), h1, hand, meta, full, tags, actions, heroLive, mark);

/* ---------- section nav ---------- */
const navList = d.nav.slice();
if (FB && d.factbook && d.factbook.length && !navList.some(([s]) => s === "factbook")) {
  const at = navList.findIndex(([s]) => s === "export");
  navList.splice(at < 0 ? navList.length : at, 0, ["factbook", "Logos links"]);
  S.factbook = { tags: [], h: "Look it up in Logos", sub: "Each link opens that person, place or topic in the Logos Factbook, inside the Logos app on iPad, Mac or PC. The same links are in Copy all notes." };
}
const nav = el("nav", "nav-sec noprint");
nav.setAttribute("aria-label", "Sections on this page");
const navInner = el("div", "wrap nav-inner");
const navLinks = {};
navList.forEach(([sid, label]) => {
  const a = el("a", "chip", label);
  a.href = "#" + sid;
  navLinks[sid] = a;
  navInner.append(a);
});
nav.append(navInner);

const body = el("div", "wrap");
navList.forEach(([sid], i) => body.append(section(sid, i + 1)));

/* previous / next */
const pn = el("nav", "pn noprint");
pn.setAttribute("aria-label", "Episodes");
function pnCard(e, dir) {
  if (!e) return el("span");
  const href = pageOf(e);
  const c = href ? el("a", "pncard " + dir) : el("div", "pncard soon " + dir);
  if (href) c.href = href;
  c.append(el("span", "kicker", (dir === "prev" ? "← Previous" : "Next →") + (href ? "" : " · coming soon")), el("strong", null, epLabel(e)), el("span", "small", e.title));
  return c;
}
pn.append(pnCard(prevEp, "prev"), pnCard(nextEp, "next"));
const foot = el("p", "note foot", d.foot);
body.append(pn, foot);

const top = el("a", "totop noprint", "↑");
top.href = "#app";
top.setAttribute("aria-label", "Back to top");

app.replaceChildren(hero, nav, body, top);
status(heroLive, d.copiedMsg);

/* ---------- motion: reveal on scroll, active section ---------- */
const reveals = Array.from(document.querySelectorAll(".reveal"));
if (reduced || typeof IntersectionObserver === "undefined") revealAll();
else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.08, rootMargin: "0px 0px -4% 0px" });
  reveals.forEach((n) => io.observe(n));
  setTimeout(() => { if (document.visibilityState === "hidden") revealAll(); }, 2500);
}
addEventListener("beforeprint", revealAll);

if (typeof IntersectionObserver !== "undefined") {
  let current = null;
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const sid = en.target.id;
      if (current === sid) return;
      current = sid;
      Object.entries(navLinks).forEach(([k, a]) => { if (k === sid) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
      const a = navLinks[sid];
      if (a) navInner.scrollTo({ left: a.offsetLeft - navInner.clientWidth / 2 + a.offsetWidth / 2, behavior: reduced ? "auto" : "smooth" });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("section.sec").forEach((s) => spy.observe(s));
}
const showTop = () => top.classList.toggle("on", scrollY > 900);
addEventListener("scroll", showTop, { passive: true });
showTop();
if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
