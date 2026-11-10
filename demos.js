/* Exercise demos: two angles, fixed-length limbs, dumbbells in the real grip.
   Side and front (or above) share one clock. p=0 and p=1 match the cue sequence.
   No images, no filters. Off-screen demos do not paint. Reduced motion starts paused. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Demos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const L = { torso: 40, thigh: 34, shin: 32, uarm: 24, farm: 22, neck: 15, foot: 14, head: 9 };
  const FLOOR = 162;
  /* Neutral equipment and ink on the warm paper; the accent is only for the working muscles. */
  const INK = '#221f1b', TORSO = '#38332d', SKIN = '#e9b597';
  const BENCH = '#cfc7b9', LEG = '#b3aa9b', PAD = '#e3ddd2', MAT = '#e6e0d5', FLOORC = '#d6cfc2';
  const VIEWS = {
    stand: [{ k: 'side', label: 'Side' }, { k: 'front', label: 'Front' }],
    floor: [{ k: 'side', label: 'Side' }, { k: 'front', label: 'Above' }]
  };

  function r1(n) { return Math.round(n * 10) / 10; }
  function polar(x, y, len, deg) {
    const a = deg * Math.PI / 180;
    return [x + Math.cos(a) * len, y + Math.sin(a) * len];
  }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function mid(a, b) { return [r1((a[0] + b[0]) / 2), r1((a[1] + b[1]) / 2)]; }

  /* A lighter, livelier shade of the page accent, so the working muscles stand out from the dark body. */
  function tint(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return hex || '#6f62d6';
    const n = parseInt(m[1], 16);
    let r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l0 = (mx + mn) / 2, d = mx - mn;
    let h = 0, s0 = 0;
    if (d) {
      s0 = d / (1 - Math.abs(2 * l0 - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    const l = Math.max(l0, 0.6), s = Math.min(1, Math.max(s0, 0.6));
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), o = l - c / 2;
    const k = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + k.map(function (v) { return ('0' + Math.round((v + o) * 255).toString(16)).slice(-2); }).join('');
  }

  function ik(from, to, len1, len2, bend) {
    let dx = to[0] - from[0];
    let dy = to[1] - from[1];
    let d = Math.hypot(dx, dy) || 0.001;
    const max = len1 + len2 - 0.6;
    const min = Math.abs(len1 - len2) + 0.6;
    if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    else if (d < min) { dx *= min / d; dy *= min / d; d = min; }
    const ang = Math.atan2(dy, dx);
    const cosB = (len1 * len1 + d * d - len2 * len2) / (2 * len1 * d);
    const bendAng = Math.acos(Math.max(-1, Math.min(1, cosB))) * (bend >= 0 ? 1 : -1);
    const a = ang + bendAng;
    return {
      mid: [r1(from[0] + Math.cos(a) * len1), r1(from[1] + Math.sin(a) * len1)],
      end: [r1(from[0] + dx), r1(from[1] + dy)]
    };
  }

  function ikPrefer(from, to, len1, len2, score) {
    const a = ik(from, to, len1, len2, 1);
    const b = ik(from, to, len1, len2, -1);
    return score(a) >= score(b) ? a : b;
  }

  function sideFigure(a) {
    const hip = [0, 0];
    const sho = polar(0, 0, L.torso, a.torso);
    const head = polar(sho[0], sho[1], L.neck, a.neck == null ? -90 : a.neck);
    const knee = polar(0, 0, L.thigh, a.thigh);
    const ank = polar(knee[0], knee[1], L.shin, a.shin);
    const footAng = a.foot == null ? 0 : a.foot;
    const toe = polar(ank[0], ank[1], L.foot, footAng);
    const heel = polar(ank[0], ank[1], 5, footAng + 180);
    const raw = { hip: hip, sho: sho, head: head, knee: knee, ank: ank, toe: toe, heel: heel };
    const plant = a.plant === 'toe' ? toe : ank;
    const dx = (a.ax == null ? 112 : a.ax) - plant[0];
    const dy = (a.fy == null ? FLOOR - 4 : a.fy) - plant[1] - (a.rise || 0);
    const j = {};
    Object.keys(raw).forEach(function (k) {
      j[k] = [r1(raw[k][0] + dx), r1(raw[k][1] + dy)];
    });
    return j;
  }

  function bell(x, y, rot, extra) {
    return Object.assign({ x: r1(x), y: r1(y), rot: rot || 0, end: false, opacity: 1 }, extra || {});
  }

  function fig(o) {
    const pts = [];
    Object.keys(o.j).forEach(function (k) {
      const p = o.j[k];
      if (Array.isArray(p) && typeof p[0] === 'number') pts.push(p);
    });
    (o.dbs || []).forEach(function (d) { pts.push([d.x, d.y]); });
    return {
      lines: o.lines,
      dbs: o.dbs || [],
      head: o.j.head,
      face: o.face || 'right',
      props: o.props || [],
      glow: o.glow || [],
      pts: pts,
      shadow: o.shadow || null,
      torso: o.torso || null,
      ground: o.ground !== false
    };
  }

  function link(j, list) {
    return list.map(function (ln) {
      return { a: j[ln[0]], b: j[ln[1]], w: ln[2], hot: !!ln[3], back: !!ln[4] };
    }).filter(function (ln) { return ln.a && ln.b; });
  }

  function sideLinks(j, hot) {
    const arm = !!hot.arm, thigh = !!hot.thigh, shin = !!hot.shin;
    const list = [
      ['sho', 'hip', 14, !!hot.torso, false],
      ['hip', 'knee', 9, thigh, false],
      ['knee', 'ank', 7, shin, false],
      ['heel', 'toe', 5, false, false],
      ['sho', 'elb', 7, arm, false],
      ['elb', 'hand', 6, arm, false]
    ];
    if (j.knee2) list.unshift(['hip', 'knee2', 8, thigh, true], ['knee2', 'ank2', 6, shin, true], ['heel2', 'toe2', 4, false, true]);
    if (j.elb2) list.unshift(['sho', 'elb2', 6, arm, true], ['elb2', 'hand2', 5, arm, true]);
    return link(j, list);
  }

  function frontLinks(j, hot) {
    const arm = !!hot.arm, thigh = !!hot.thigh, shin = !!hot.shin;
    return link(j, [
      ['neck', 'head', 6, false, false],
      ['shoL', 'elbL', 7, arm, false],
      ['elbL', 'handL', 6, arm, false],
      ['shoR', 'elbR', 7, arm, false],
      ['elbR', 'handR', 6, arm, false],
      ['hipL', 'kneeL', 9, thigh, false],
      ['kneeL', 'ankL', 7, shin, false],
      ['ankL', 'toeL', 5, false, false],
      ['hipR', 'kneeR', 9, thigh, false],
      ['kneeR', 'ankR', 7, shin, false],
      ['ankR', 'toeR', 5, false, false]
    ]);
  }

  function frontStand(spec) {
    const cx = spec.cx || 100;
    const hipY = spec.hipY;
    const shoY = spec.shoY;
    const hipW = spec.hipW;
    const shoW = spec.shoW;
    const ankleX = spec.ankleX;
    const ankY = FLOOR - 4 - (spec.rise || 0);
    const hipL = [cx - hipW, hipY], hipR = [cx + hipW, hipY];
    const ankL = [cx - ankleX, ankY], ankR = [cx + ankleX, ankY];
    let kneeL, kneeR, ankEndL, ankEndR;
    if (spec.straight) {
      const t = L.thigh / (L.thigh + L.shin);
      kneeL = [r1(hipL[0] + (ankL[0] - hipL[0]) * t), r1(hipL[1] + (ankY - hipY) * t)];
      kneeR = [r1(hipR[0] + (ankR[0] - hipR[0]) * t), r1(hipR[1] + (ankY - hipY) * t)];
      ankEndL = ankL;
      ankEndR = ankR;
    } else {
      const legL = ikPrefer(hipL, ankL, L.thigh, L.shin, function (s) { return hipL[0] - s.mid[0]; });
      const legR = ikPrefer(hipR, ankR, L.thigh, L.shin, function (s) { return s.mid[0] - hipR[0]; });
      kneeL = legL.mid; kneeR = legR.mid; ankEndL = legL.end; ankEndR = legR.end;
    }
    const j = {
      head: [cx, shoY - 18],
      neck: [cx, shoY],
      shoL: [cx - shoW, shoY], shoR: [cx + shoW, shoY],
      hip: [cx, hipY], hipL: hipL, hipR: hipR,
      kneeL: kneeL, kneeR: kneeR,
      ankL: ankEndL, ankR: ankEndR,
      toeL: [r1(ankEndL[0] - 7), r1(ankEndL[1] + 2)],
      toeR: [r1(ankEndR[0] + 7), r1(ankEndR[1] + 2)]
    };
    j.torso = [j.shoL, j.shoR, j.hipR, j.hipL];
    return j;
  }

  function hangArms(j, p, low, high) {
    const y = lerp(low, high, p);
    j.elbL = [r1(j.shoL[0] - 2), r1(j.shoL[1] + L.uarm)];
    j.elbR = [r1(j.shoR[0] + 2), r1(j.shoR[1] + L.uarm)];
    j.handL = [r1(j.elbL[0] - 1), r1(y)];
    j.handR = [r1(j.elbR[0] + 1), r1(y)];
  }

  function reach(sho, hand, prefer) {
    return ikPrefer(sho, hand, L.uarm, L.farm, prefer);
  }

  function benchProps(x, y, w, back) {
    const legH = Math.max(4, FLOOR - (y + 8));
    const props = [
      { k: 'rect', x: x, y: y, w: w, h: 8 },
      { k: 'rect', x: x + 10, y: y + 8, w: 6, h: legH, fill: LEG },
      { k: 'rect', x: x + w - 16, y: y + 8, w: 6, h: legH, fill: LEG }
    ];
    if (back) props.push({ k: 'rect', x: back.x, y: back.y, w: 8, h: back.h });
    return props;
  }

  function shadowAt(x) { return [x, FLOOR]; }

  function seatedBase() {
    return sideFigure({ torso: -86, thigh: 4, shin: 92, ax: 152 });
  }

  function seatedSideProps(j) {
    const seatY = r1(j.hip[1] + 5);
    return benchProps(r1(j.hip[0] - 18), seatY, 56, { x: r1(j.hip[0] - 17), y: r1(seatY - 54), h: 54 });
  }

  function seatedFront(cx) {
    const hipY = 114, shoY = 72;
    const j = {
      head: [cx, shoY - 18], neck: [cx, shoY],
      shoL: [cx - 22, shoY], shoR: [cx + 22, shoY],
      hip: [cx, hipY], hipL: [cx - 13, hipY], hipR: [cx + 13, hipY],
      kneeL: [cx - 19, hipY + 12], kneeR: [cx + 19, hipY + 12],
      ankL: [cx - 19, FLOOR - 4], ankR: [cx + 19, FLOOR - 4],
      toeL: [cx - 25, FLOOR - 2], toeR: [cx + 25, FLOOR - 2]
    };
    j.torso = [j.shoL, j.shoR, j.hipR, j.hipL];
    const props = [
      { k: 'rect', x: cx - 24, y: shoY - 12, w: 48, h: hipY - shoY + 12, fill: PAD },
      { k: 'rect', x: cx - 30, y: hipY + 4, w: 60, h: 8 },
      { k: 'rect', x: cx - 4, y: hipY + 12, w: 8, h: FLOOR - hipY - 12, fill: LEG }
    ];
    return { j: j, props: props, shoY: shoY };
  }

  /* ---------- poses ---------- */

  function gobletSide(p) {
    const j = sideFigure({
      torso: lerp(-92, -72, p),
      thigh: lerp(84, 20, p),
      shin: lerp(96, 104, p),
      ax: lerp(108, 116, p)
    });
    const dbx = j.sho[0] + lerp(14, 16, p);
    const dby = j.sho[1] + (j.hip[1] - j.sho[1]) * 0.34 + 6;
    const arm = reach(j.sho, [dbx, dby - 12], function (s) { return s.mid[1] - j.sho[1]; });
    j.elb = arm.mid;
    j.hand = arm.end;
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { thigh: true }),
      dbs: [bell(dbx, dby, 90)],
      glow: [mid(j.hip, j.knee)],
      shadow: shadowAt(j.ank[0])
    });
  }

  function gobletFront(p) {
    const j = frontStand({
      hipY: lerp(98, 128, p),
      shoY: lerp(56, 92, p),
      shoW: 22, hipW: lerp(11, 13, p), ankleX: lerp(14, 20, p)
    });
    const db = [100, j.shoL[1] + lerp(24, 20, p)];
    const left = reach(j.shoL, [db[0] - 7, db[1] - 11], function (s) { return j.shoL[0] - s.mid[0]; });
    const right = reach(j.shoR, [db[0] + 7, db[1] - 11], function (s) { return s.mid[0] - j.shoR[0]; });
    j.elbL = left.mid; j.handL = left.end;
    j.elbR = right.mid; j.handR = right.end;
    return fig({
      j: j, face: 'front', torso: j.torso,
      lines: frontLinks(j, { thigh: true }),
      dbs: [bell(db[0], db[1], 90)],
      glow: [mid(j.kneeL, j.hipL), mid(j.kneeR, j.hipR)],
      shadow: shadowAt(100)
    });
  }

  function benchSide(p) {
    const sho = [70, 124];
    const hip = [110, 124];
    const ank = [148, FLOOR - 4];
    const leg = ikPrefer(hip, ank, L.thigh, L.shin, function (s) { return -s.mid[1]; });
    const hand = [r1(sho[0] + lerp(4, 10, p)), r1(sho[1] - lerp(44, 16, p))];
    const elb = [r1(sho[0] + lerp(3, 11, p)), r1(sho[1] - lerp(22, -5, p))];
    const j = {
      head: [55, 121], sho: sho, hip: hip,
      knee: leg.mid, ank: leg.end,
      toe: [r1(leg.end[0] + 12), leg.end[1]], heel: [r1(leg.end[0] - 4), leg.end[1]],
      elb: elb, hand: hand,
      elb2: [r1(elb[0] - 4), r1(elb[1] - 5)], hand2: [r1(hand[0] - 4), r1(hand[1] - 5)]
    };
    return fig({
      j: j, face: 'up',
      lines: sideLinks(j, { arm: true }),
      dbs: [bell(j.hand2[0], j.hand2[1], 0, { opacity: 0.45, sx: 0.5 }), bell(hand[0], hand[1], 0, { sx: 0.5 })],
      glow: [[sho[0] + 12, sho[1] - 6]],
      props: benchProps(46, sho[1] + 7, 78),
      shadow: shadowAt(110)
    });
  }

  function benchAbove(p) {
    const cx = 100;
    const shoL = [cx - 22, 52], shoR = [cx + 22, 52];
    const hipY = 94;
    const elbL = [r1(lerp(cx - 23, cx - 40, p)), r1(lerp(56, 68, p))];
    const elbR = [r1(2 * cx - elbL[0]), elbL[1]];
    const handL = [r1(lerp(cx - 21, cx - 36, p)), r1(lerp(57, 64, p))];
    const handR = [r1(2 * cx - handL[0]), handL[1]];
    const j = {
      head: [cx, 28], neck: [cx, 42],
      shoL: shoL, shoR: shoR, hip: [cx, hipY], hipL: [cx - 13, hipY], hipR: [cx + 13, hipY],
      kneeL: [cx - 24, 126], kneeR: [cx + 24, 126],
      ankL: [cx - 28, 136], ankR: [cx + 28, 136],
      toeL: [cx - 30, 145], toeR: [cx + 30, 145],
      elbL: elbL, handL: handL, elbR: elbR, handR: handR
    };
    return fig({
      j: j, face: 'up',
      torso: [shoL, shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { arm: true }),
      dbs: [bell(handL[0], handL[1], 0), bell(handR[0], handR[1], 0)],
      glow: [[cx - 11, 62], [cx + 11, 62]],
      props: [{ k: 'rect', x: cx - 20, y: 18, w: 40, h: 88, fill: PAD }],
      ground: false
    });
  }

  function rowSide(p) {
    const BY = 132;
    const hip = [128, BY - 3 - L.thigh];
    const shoF = polar(hip[0], hip[1], L.torso, -164);
    const sho = [r1(shoF[0]), r1(shoF[1])];
    const head = polar(sho[0], sho[1], L.neck, -166);
    const knee2 = [128, BY - 3];
    const ank2 = [r1(knee2[0] + L.shin), BY - 3];
    const foot = [hip[0] + 14, FLOOR - 4];
    const stand = ikPrefer(hip, foot, L.thigh, L.shin, function (s) { return -s.mid[0]; });
    const support = reach(sho, [sho[0] - 4, BY - 3], function (s) { return s.mid[0]; });
    const hang = [sho[0] + 2, sho[1] + 44];
    const pulled = [sho[0] + 22, sho[1] + 10];
    const hand = [lerp(hang[0], pulled[0], p), lerp(hang[1], pulled[1], p)];
    const arm = reach(sho, hand, function (s) { return -s.mid[1] + 0.3 * s.mid[0]; });
    const j = {
      head: [r1(head[0]), r1(head[1])], sho: sho, hip: hip,
      knee: stand.mid, ank: stand.end,
      toe: [r1(stand.end[0] - 12), stand.end[1]], heel: [r1(stand.end[0] + 4), stand.end[1]],
      knee2: knee2, ank2: ank2, toe2: [ank2[0] + 9, BY - 2], heel2: [ank2[0] - 2, BY - 6],
      elb: arm.mid, hand: arm.end,
      elb2: support.mid, hand2: support.end
    };
    return fig({
      j: j, face: 'left',
      lines: sideLinks(j, { arm: true, torso: true }),
      dbs: [bell(j.hand[0], j.hand[1] + 1, 0)],
      glow: [[sho[0] + 16, sho[1] - 2]],
      props: benchProps(sho[0] - 14, BY + 1, ank2[0] - sho[0] + 26),
      shadow: shadowAt(120)
    });
  }

  function rowFront(p) {
    const cx = 100, shoY = 85, BY = 132;
    const j = {
      head: [cx, shoY - 4], neck: [cx, shoY - 4],
      shoL: [cx - 22, shoY], shoR: [cx + 22, shoY],
      hip: [cx, shoY + 8], hipL: [cx - 13, shoY + 10], hipR: [cx + 13, shoY + 10],
      kneeL: [cx - 17, 128], kneeR: [cx + 15, BY - 3],
      ankL: [cx - 18, FLOOR - 4], ankR: [cx + 15, BY - 5],
      toeL: [cx - 19, FLOOR - 1], toeR: [cx + 15, BY - 6]
    };
    const sup = reach(j.shoR, [cx + 25, BY - 3], function (s) { return s.mid[0]; });
    j.elbR = sup.mid; j.handR = sup.end;
    /* The working elbow drives up past the back, so from the front the upper arm shortens and rises. */
    j.elbL = [r1(lerp(cx - 24, cx - 28, p)), r1(lerp(shoY + 22, shoY - 12, p))];
    j.handL = [r1(lerp(cx - 24, cx - 27, p)), r1(lerp(shoY + 44, shoY + 8, p))];
    return fig({
      j: j, face: 'front',
      torso: [j.shoL, j.shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { arm: true }),
      dbs: [bell(j.handL[0], j.handL[1] + 1, 0)],
      glow: [[cx - 20, shoY + 8]],
      props: [
        { k: 'rect', x: cx + 2, y: BY, w: 40, h: 8 },
        { k: 'rect', x: cx + 18, y: BY + 8, w: 8, h: FLOOR - BY - 8, fill: LEG }
      ],
      shadow: shadowAt(cx)
    });
  }

  function rdlSide(p) {
    const j = sideFigure({
      torso: lerp(-88, -24, p),
      neck: lerp(-88, -30, p),
      thigh: lerp(80, 62, p),
      shin: lerp(100, 104, p),
      ax: lerp(108, 124, p)
    });
    const hand = [j.sho[0] + 4, j.sho[1] + L.uarm + L.farm - 2];
    const arm = reach(j.sho, hand, function (s) { return s.mid[1] - j.sho[1]; });
    j.elb = arm.mid;
    j.hand = arm.end;
    j.elb2 = [r1(arm.mid[0] - 5), r1(arm.mid[1] + 2)];
    j.hand2 = [r1(arm.end[0] - 5), r1(arm.end[1] + 2)];
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { thigh: true }),
      dbs: [bell(j.hand2[0], j.hand2[1], 0, { opacity: 0.45 }), bell(j.hand[0], j.hand[1], 0)],
      glow: [mid(j.hip, j.knee)],
      shadow: shadowAt(j.ank[0] - 4)
    });
  }

  function rdlFront(p) {
    const shoY = lerp(58, 84, p);
    const hipY = lerp(100, 104, p);
    const j = {
      head: [100, shoY - 16], neck: [100, shoY],
      shoL: [76, shoY], shoR: [124, shoY],
      hip: [100, hipY], hipL: [88, hipY], hipR: [112, hipY],
      kneeL: [86, 134], kneeR: [114, 134],
      ankL: [84, FLOOR - 4], ankR: [116, FLOOR - 4],
      toeL: [76, FLOOR - 2], toeR: [124, FLOOR - 2],
      elbL: [88, shoY + 22], elbR: [112, shoY + 22],
      handL: [84, Math.min(shoY + 46, 148)], handR: [116, Math.min(shoY + 46, 148)]
    };
    return fig({
      j: j, face: 'front',
      torso: [j.shoL, j.shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { thigh: true }),
      dbs: [bell(j.handL[0], j.handL[1], 0), bell(j.handR[0], j.handR[1], 0)],
      glow: [mid(j.hip, j.kneeL), mid(j.hip, j.kneeR)],
      shadow: shadowAt(100)
    });
  }

  function pressSide(p) {
    const j = seatedBase();
    /* Elbows start below the dumbbells with the forearms vertical, then straighten overhead. */
    const arm = {
      mid: [r1(j.sho[0] + lerp(7, 3, p)), r1(j.sho[1] + lerp(12, -23, p))],
      end: [r1(j.sho[0] + lerp(9, 2, p)), r1(j.sho[1] - lerp(10, 45, p))]
    };
    j.elb = arm.mid;
    j.hand = arm.end;
    j.elb2 = [r1(arm.mid[0] - 5), r1(arm.mid[1] - 3)];
    j.hand2 = [r1(arm.end[0] - 5), r1(arm.end[1] - 3)];
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { arm: true }),
      dbs: [bell(j.hand2[0], j.hand2[1], 0, { opacity: 0.45, sx: 0.5 }), bell(j.hand[0], j.hand[1], 0, { sx: 0.5 })],
      glow: [[j.sho[0] + 1, j.sho[1] - 2]],
      props: seatedSideProps(j),
      shadow: shadowAt(j.ank[0])
    });
  }

  function pressFront(p) {
    const s = seatedFront(100);
    const j = s.j;
    const dx = lerp(21, 5, p);
    const hy = lerp(s.shoY - 12, s.shoY - 45, p);
    const left = reach(j.shoL, [j.shoL[0] - dx, hy], function (q) { return j.shoL[0] - q.mid[0]; });
    const right = reach(j.shoR, [j.shoR[0] + dx, hy], function (q) { return q.mid[0] - j.shoR[0]; });
    j.elbL = left.mid; j.handL = left.end;
    j.elbR = right.mid; j.handR = right.end;
    return fig({
      j: j, face: 'front', torso: j.torso,
      lines: frontLinks(j, { arm: true }),
      dbs: [bell(j.handL[0], j.handL[1], 0), bell(j.handR[0], j.handR[1], 0)],
      glow: [[j.shoL[0] + 2, s.shoY - 2], [j.shoR[0] - 2, s.shoY - 2]],
      props: s.props,
      shadow: shadowAt(100)
    });
  }

  function bridgeSide(p) {
    const sho = [50, 148];
    const hipF = polar(sho[0], sho[1], L.torso, lerp(6, -18, p));
    const hip = [r1(hipF[0]), r1(hipF[1])];
    const ank = [125, FLOOR - 4];
    const leg = ikPrefer(hip, ank, L.thigh, L.shin, function (s) { return -s.mid[1]; });
    const head = polar(sho[0], sho[1], L.neck, 172);
    const db = [hip[0], r1(hip[1] - 8)];
    const arm = reach(sho, [db[0] - 3, db[1] + 3], function (s) { return s.mid[1]; });
    const j = {
      head: [r1(head[0]), r1(head[1])], sho: sho, hip: hip,
      knee: leg.mid, ank: leg.end,
      toe: [r1(leg.end[0] + 12), leg.end[1]], heel: [r1(leg.end[0] - 5), leg.end[1]],
      elb: arm.mid, hand: arm.end
    };
    return fig({
      j: j, face: 'up',
      lines: sideLinks(j, { thigh: true }),
      dbs: [bell(db[0], db[1], 0, { end: true })],
      glow: [[hip[0], hip[1] + 2]],
      props: [{ k: 'rect', x: 18, y: FLOOR - 2, w: 164, h: 4, fill: MAT }],
      shadow: shadowAt(96)
    });
  }

  function bridgeFront(p) {
    const cx = 100;
    const shoY = 66;
    const hipY = r1(lerp(108, 100, p));
    const kneeY = r1(lerp(134, 140, p));
    const j = {
      head: [cx, 42], neck: [cx, 56],
      shoL: [cx - 22, shoY], shoR: [cx + 22, shoY],
      hip: [cx, hipY], hipL: [cx - 13, hipY], hipR: [cx + 13, hipY],
      kneeL: [cx - 18, kneeY], kneeR: [cx + 18, kneeY],
      ankL: [cx - 17, r1(kneeY - 6)], ankR: [cx + 17, r1(kneeY - 6)],
      toeL: [cx - 17, r1(kneeY + 6)], toeR: [cx + 17, r1(kneeY + 6)]
    };
    const left = reach(j.shoL, [cx - 16, hipY + 2], function (s) { return j.shoL[0] - s.mid[0]; });
    const right = reach(j.shoR, [cx + 16, hipY + 2], function (s) { return s.mid[0] - j.shoR[0]; });
    j.elbL = left.mid; j.handL = left.end; j.elbR = right.mid; j.handR = right.end;
    return fig({
      j: j, face: 'up',
      torso: [j.shoL, j.shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { thigh: true }),
      dbs: [bell(cx, hipY - 3, 0)],
      glow: [[cx - 9, hipY + 6], [cx + 9, hipY + 6]],
      props: [{ k: 'rect', x: 40, y: 22, w: 120, h: 140, fill: MAT }],
      ground: false
    });
  }

  function bugSide(p) {
    const sho = [72, 146];
    const hip = [112, 147];
    const up = polar(sho[0], sho[1], L.uarm + L.farm - 1, -88);
    const reachHand = polar(sho[0], sho[1], L.uarm + L.farm - 1, lerp(-88, -172, p));
    const arm = reach(sho, reachHand, function (s) { return -s.mid[1]; });
    const still = reach(sho, up, function (s) { return -s.mid[1]; });
    const tableKnee = polar(hip[0], hip[1], L.thigh, -88);
    const tableAnk = polar(tableKnee[0], tableKnee[1], L.shin, 2);
    const knee2 = polar(hip[0], hip[1], L.thigh, lerp(-88, -10, p));
    const ank2 = polar(knee2[0], knee2[1], L.shin, lerp(2, -8, p));
    function P(a) { return [r1(a[0]), r1(a[1])]; }
    const j = {
      head: [50, 141], sho: sho, hip: hip,
      knee: P(tableKnee), ank: P(tableAnk),
      toe: P([tableAnk[0] + 9, tableAnk[1] - 3]), heel: P([tableAnk[0] - 3, tableAnk[1] + 1]),
      knee2: P(knee2), ank2: P(ank2),
      toe2: P(polar(ank2[0], ank2[1], 9, lerp(-60, -40, p))), heel2: P(polar(ank2[0], ank2[1], 3, lerp(120, 140, p))),
      elb: arm.mid, hand: arm.end,
      elb2: still.mid, hand2: still.end
    };
    return fig({
      j: j, face: 'up',
      lines: sideLinks(j, { torso: true }),
      dbs: [],
      glow: [mid(sho, hip)],
      props: [{ k: 'rect', x: 16, y: 152, w: 170, h: 8, fill: MAT }],
      shadow: null,
      ground: true
    });
  }

  function bugAbove(p) {
    const cx = 100;
    const shoY = 58, hipY = 100;
    const j = {
      head: [cx, 40], neck: [cx, shoY - 8],
      shoL: [cx - 22, shoY], shoR: [cx + 22, shoY],
      hip: [cx, hipY], hipL: [cx - 12, hipY], hipR: [cx + 12, hipY],
      kneeL: [cx - 14, hipY + 4], kneeR: [cx + 14, r1(lerp(hipY + 4, hipY + 28, p))],
      ankL: [cx - 14, hipY + 34], ankR: [cx + 14, r1(lerp(hipY + 34, hipY + 56, p))]
    };
    j.toeL = [j.ankL[0], j.ankL[1] + 6];
    j.toeR = [j.ankR[0], j.ankR[1] + 6];
    j.elbR = [cx + 22, shoY - 2]; j.handR = [cx + 21, shoY - 4];
    j.elbL = [cx - 22, r1(lerp(shoY - 2, shoY - 23, p))];
    j.handL = [cx - 21, r1(lerp(shoY - 4, shoY - 44, p))];
    return fig({
      j: j, face: 'up',
      torso: [j.shoL, j.shoR, j.hipR, j.hipL],
      lines: frontLinks(j, {}),
      dbs: [],
      glow: [[cx, (shoY + hipY) / 2 + 6]],
      props: [{ k: 'rect', x: 40, y: 4, w: 120, h: 162, fill: MAT }],
      ground: false
    });
  }

  function lungeSide(p) {
    const hip = [lerp(108, 106, p), lerp(96, 120, p)];
    const sho = polar(hip[0], hip[1], L.torso, lerp(-90, -82, p));
    const head = polar(sho[0], sho[1], L.neck, -90);
    const frontAnk = [lerp(112, 128, p), FLOOR - 4];
    const backAnk = [lerp(106, 66, p), FLOOR - 4 - lerp(0, 6, p)];
    const front = ikPrefer(hip, frontAnk, L.thigh, L.shin, function (s) { return s.mid[0]; });
    const back = ikPrefer(hip, backAnk, L.thigh, L.shin, function (s) { return s.mid[0]; });
    const hand = [hip[0] + 2, hip[1] + 4];
    const arm = reach([r1(sho[0]), r1(sho[1])], [sho[0] + 2, sho[1] + 45], function (s) { return s.mid[0]; });
    const j = {
      head: [r1(head[0]), r1(head[1])],
      sho: [r1(sho[0]), r1(sho[1])], hip: [r1(hip[0]), r1(hip[1])],
      knee: front.mid, ank: front.end,
      toe: [r1(front.end[0] + 12), front.end[1]], heel: [r1(front.end[0] - 4), front.end[1]],
      knee2: back.mid, ank2: back.end,
      toe2: [r1(back.end[0] + 10), FLOOR - 3], heel2: [r1(back.end[0] - 4), r1(back.end[1] - lerp(0, 3, p))],
      elb: arm.mid, hand: arm.end
    };
    void hand;
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { thigh: true }),
      dbs: [bell(j.hand[0] + 1, j.hand[1] + 2, 0, { end: true })],
      glow: [mid(j.hip, j.knee)],
      shadow: shadowAt(100)
    });
  }

  function lungeFront(p) {
    const hipY = lerp(98, 122, p);
    const cx = 100;
    const j = {
      head: [cx, hipY - 58], neck: [cx, hipY - 40],
      shoL: [cx - 22, hipY - 40], shoR: [cx + 22, hipY - 40],
      hip: [cx, hipY], hipL: [cx - 12, hipY], hipR: [cx + 12, hipY],
      kneeL: [cx - lerp(14, 22, p), lerp(hipY + 32, hipY + 22, p)],
      kneeR: [cx + lerp(14, 16, p), lerp(hipY + 32, FLOOR - 28, p)],
      ankL: [cx - lerp(14, 24, p), FLOOR - 4],
      ankR: [cx + lerp(14, 18, p), FLOOR - 4],
      toeL: [0, 0], toeR: [0, 0]
    };
    j.toeL = [j.ankL[0] - 6, FLOOR - 2];
    j.toeR = [j.ankR[0] + 6, FLOOR - 2];
    j.elbL = [j.shoL[0] - 4, j.shoL[1] + 22];
    j.elbR = [j.shoR[0] + 4, j.shoR[1] + 22];
    j.handL = [j.elbL[0] - 8, j.elbL[1] + 20];
    j.handR = [j.elbR[0] + 8, j.elbR[1] + 20];
    return fig({
      j: j, face: 'front',
      torso: [j.shoL, j.shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { thigh: true }),
      dbs: [bell(j.handL[0], j.handL[1], 0), bell(j.handR[0], j.handR[1], 0)],
      glow: [mid(j.kneeL, j.hipL)],
      shadow: shadowAt(cx)
    });
  }

  function calfSide(p) {
    const j = sideFigure({
      torso: -90,
      thigh: 86,
      shin: 92,
      foot: lerp(0, 38, p),
      plant: 'toe',
      ax: 120
    });
    const arm = reach(j.sho, [j.sho[0] + 2, j.sho[1] + 45], function (s) { return s.mid[0]; });
    j.elb = arm.mid;
    j.hand = arm.end;
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { shin: true }),
      dbs: [bell(j.hand[0] + 1, j.hand[1] + 2, 0, { end: true })],
      glow: [mid(j.knee, j.ank)],
      shadow: shadowAt(j.toe[0])
    });
  }

  function calfFront(p) {
    const lift = lerp(0, 8, p);
    const j = frontStand({
      hipY: 100 - lift, shoY: 58 - lift, shoW: 22, hipW: 12, ankleX: 14, straight: true, rise: lift
    });
    j.toeL = [r1(j.ankL[0] - 6), FLOOR - 2];
    j.toeR = [r1(j.ankR[0] + 6), FLOOR - 2];
    j.elbL = [j.shoL[0] - 5, j.shoL[1] + 24];
    j.elbR = [j.shoR[0] + 5, j.shoR[1] + 24];
    j.handL = [j.elbL[0] - 7, j.elbL[1] + 21];
    j.handR = [j.elbR[0] + 7, j.elbR[1] + 21];
    return fig({
      j: j, face: 'front', torso: j.torso,
      lines: frontLinks(j, { shin: true }),
      dbs: [bell(j.handL[0], j.handL[1], 0), bell(j.handR[0], j.handR[1], 0)],
      glow: [mid(j.ankL, j.kneeL), mid(j.ankR, j.kneeR)],
      shadow: shadowAt(100)
    });
  }

  function curlSide(p, neutral) {
    const j = sideFigure({ torso: -90, thigh: 84, shin: 96, ax: 108 });
    const elb = [r1(j.sho[0] + 4), r1(j.sho[1] + L.uarm)];
    const deg = lerp(84, -36, p);
    const hand = polar(elb[0], elb[1], L.farm, deg);
    j.elb = elb;
    j.hand = [r1(hand[0]), r1(hand[1])];
    const db = neutral
      ? bell(j.hand[0], j.hand[1], r1(deg - 90))
      : bell(j.hand[0], j.hand[1], 0, { end: true });
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { arm: true }),
      dbs: [db],
      glow: [mid(j.elb, j.sho)],
      shadow: shadowAt(j.ank[0])
    });
  }

  function curlFront(p, neutral) {
    const j = frontStand({ hipY: 100, shoY: 58, shoW: 24, hipW: 12, ankleX: 14, straight: true });
    hangArms(j, p, j.shoL[1] + 48, j.shoL[1] + 8);
    const dbs = neutral
      ? [bell(j.handL[0], j.handL[1], 0, { end: true }), bell(j.handR[0], j.handR[1], 0, { end: true })]
      : [bell(j.handL[0], j.handL[1], 0), bell(j.handR[0], j.handR[1], 0)];
    return fig({
      j: j, face: 'front', torso: j.torso,
      lines: frontLinks(j, { arm: true }),
      dbs: dbs,
      glow: [mid(j.elbL, j.shoL), mid(j.elbR, j.shoR)],
      shadow: shadowAt(100)
    });
  }

  function triSide(p) {
    const j = seatedBase();
    const elb = polar(j.sho[0], j.sho[1], L.uarm, lerp(-82, -98, p));
    const hand = polar(elb[0], elb[1], L.farm, lerp(-82, -218, p));
    j.elb = [r1(elb[0]), r1(elb[1])];
    j.hand = [r1(hand[0]), r1(hand[1])];
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { arm: true }),
      dbs: [bell(j.hand[0], j.hand[1] + 13, 90, { under: p > 0.35 })],
      glow: [mid(j.sho, j.elb)],
      props: seatedSideProps(j),
      shadow: shadowAt(j.ank[0])
    });
  }

  function triFront(p) {
    const s = seatedFront(100);
    const j = s.j;
    const shoY = s.shoY;
    const elbY = lerp(shoY - 23, shoY - 20, p);
    j.elbL = [91, r1(elbY)];
    j.elbR = [109, r1(elbY)];
    const handY = r1(lerp(shoY - 45, shoY - 6, p));
    j.handL = [98, handY];
    j.handR = [102, handY];
    return fig({
      j: j, face: 'front', torso: j.torso,
      lines: frontLinks(j, { arm: true }),
      dbs: [bell(100, handY + 13, 90, { under: p > 0.35 })],
      glow: [mid(j.shoL, j.elbL), mid(j.shoR, j.elbR)],
      props: s.props,
      shadow: shadowAt(100)
    });
  }

  function flySide(p) {
    const hip = [134, 124];
    const shoF = polar(hip[0], hip[1], L.torso, -150);
    const sho = [r1(shoF[0]), r1(shoF[1])];
    const head = polar(sho[0], sho[1], L.neck, -152);
    const ank = [166, FLOOR - 4];
    const leg = ikPrefer(hip, ank, L.thigh, L.shin, function (s) { return -s.mid[1]; });
    const hTop = polar(sho[0], sho[1], 43, -62), hOpen = polar(sho[0], sho[1], 9, 112);
    const eTop = polar(sho[0], sho[1], 23, -68), eOpen = polar(sho[0], sho[1], 9, 70);
    const hand = [r1(lerp(hTop[0], hOpen[0], p)), r1(lerp(hTop[1], hOpen[1], p))];
    const elb = [r1(lerp(eTop[0], eOpen[0], p)), r1(lerp(eTop[1], eOpen[1], p))];
    const j = {
      head: [r1(head[0]), r1(head[1])], sho: sho, hip: hip,
      knee: leg.mid, ank: leg.end,
      toe: [r1(leg.end[0] + 10), leg.end[1]], heel: [r1(leg.end[0] - 4), leg.end[1]],
      elb: elb, hand: hand,
      elb2: [r1(elb[0] - 3), r1(elb[1] - 5)], hand2: [r1(hand[0] - 3), r1(hand[1] - 5)]
    };
    const back = polar(hip[0], hip[1], 10, 120);
    return fig({
      j: j, face: 'up',
      lines: sideLinks(j, { arm: true }),
      dbs: [bell(j.hand2[0], j.hand2[1], 0, { opacity: 0.45, sx: 0.5 }), bell(hand[0], hand[1], 0, { sx: 0.5 })],
      glow: [[sho[0] + 10, sho[1] + 2]],
      props: [
        { k: 'rot', x: r1(back[0]), y: r1(back[1] - 4), w: 66, h: 8, deg: -150 },
        { k: 'rect', x: hip[0] - 12, y: hip[1] + 6, w: 30, h: 8 },
        { k: 'rect', x: hip[0] - 2, y: hip[1] + 14, w: 6, h: FLOOR - hip[1] - 14, fill: LEG },
        { k: 'rect', x: r1(back[0] - 36), y: r1(back[1] - 18), w: 6, h: r1(FLOOR - back[1] + 18), fill: LEG }
      ],
      shadow: shadowAt(130)
    });
  }

  function flyAbove(p) {
    const cx = 100;
    const shoL = [cx - 22, 54], shoR = [cx + 22, 54];
    const hipY = 90;
    const elbL = [r1(lerp(cx - 19, cx - 43, p)), r1(lerp(60, 64, p))];
    const handL = [r1(lerp(cx - 9, cx - 62, p)), r1(lerp(64, 60, p))];
    const j = {
      head: [cx, 30], neck: [cx, 44],
      shoL: shoL, shoR: shoR, hip: [cx, hipY], hipL: [cx - 13, hipY], hipR: [cx + 13, hipY],
      kneeL: [cx - 18, 122], kneeR: [cx + 18, 122],
      ankL: [cx - 21, 133], ankR: [cx + 21, 133],
      toeL: [cx - 23, 142], toeR: [cx + 23, 142],
      elbL: elbL, handL: handL, elbR: [r1(2 * cx - elbL[0]), elbL[1]], handR: [r1(2 * cx - handL[0]), handL[1]]
    };
    return fig({
      j: j, face: 'up',
      torso: [shoL, shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { arm: true }),
      dbs: [bell(j.handL[0], j.handL[1], 0), bell(j.handR[0], j.handR[1], 0)],
      glow: [[cx - 11, 64], [cx + 11, 64]],
      props: [{ k: 'rect', x: cx - 20, y: 20, w: 40, h: 92, fill: PAD }],
      ground: false
    });
  }

  function pushSide(p) {
    const A = [166, FLOOR - 4];
    const ang = lerp(25.5, 9, p) * Math.PI / 180;
    function along(d) { return [r1(A[0] - Math.cos(ang) * d), r1(A[1] - Math.sin(ang) * d)]; }
    const knee = along(L.shin);
    const hip = along(L.shin + L.thigh);
    const sho = along(L.shin + L.thigh + L.torso);
    const headP = along(L.shin + L.thigh + L.torso + L.neck);
    const hand = [66, FLOOR - 4];
    const arm = reach(sho, hand, function (s) { return s.mid[0]; });
    const j = {
      head: headP, sho: sho, hip: hip,
      knee: knee, ank: A,
      toe: [A[0] + 4, FLOOR - 2], heel: [A[0] + 4, A[1] - 7],
      elb: arm.mid, hand: arm.end
    };
    return fig({
      j: j, face: 'left',
      lines: sideLinks(j, { arm: true, torso: true }),
      dbs: [],
      glow: [[sho[0] + 6, sho[1] + 4]],
      shadow: shadowAt(110)
    });
  }

  function pushAbove(p) {
    const cx = 100;
    const shoY = 72;
    const out = lerp(6, 26, p);
    const j = {
      head: [cx, 40], neck: [cx, shoY - 8],
      shoL: [cx - 18, shoY], shoR: [cx + 18, shoY],
      hip: [cx, 112], hipL: [cx - 12, 112], hipR: [cx + 12, 112],
      kneeL: [cx - 10, 136], kneeR: [cx + 10, 136],
      ankL: [cx - 8, 156], ankR: [cx + 8, 156],
      toeL: [cx - 14, 162], toeR: [cx + 14, 162],
      elbL: [cx - 18 - out, shoY + lerp(8, 4, p)],
      elbR: [cx + 18 + out, shoY + lerp(8, 4, p)],
      handL: [cx - 30, shoY + 16],
      handR: [cx + 30, shoY + 16]
    };
    return fig({
      j: j, face: 'up',
      torso: [j.shoL, j.shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { arm: true, torso: true }),
      dbs: [],
      glow: [mid(j.shoL, j.elbL), mid(j.shoR, j.elbR)],
      props: [{ k: 'rect', x: 40, y: 32, w: 120, h: 136, fill: MAT }],
      ground: false
    });
  }

  function genericSide(p) {
    const j = sideFigure({ torso: -90, thigh: 84, shin: 96, ax: 108 });
    const hand = [j.sho[0] + lerp(8, 20, p), j.sho[1] + lerp(40, 8, p)];
    const arm = reach(j.sho, hand, function (s) { return s.mid[1]; });
    j.elb = arm.mid;
    j.hand = arm.end;
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, {}),
      dbs: [bell(j.hand[0], j.hand[1], 0)],
      glow: [],
      shadow: shadowAt(j.ank[0])
    });
  }

  function genericFront(p) {
    const j = frontStand({ hipY: 100, shoY: 58, shoW: 22, hipW: 12, ankleX: 14, straight: true });
    hangArms(j, p, j.shoL[1] + 46, j.shoL[1] + 16);
    return fig({
      j: j, face: 'front', torso: j.torso,
      lines: frontLinks(j, {}),
      dbs: [bell(j.handL[0], j.handL[1], 0), bell(j.handR[0], j.handR[1], 0)],
      glow: [],
      shadow: shadowAt(100)
    });
  }

  const D = {
    'goblet-squat': {
      grip: 'vertical', views: VIEWS.stand,
      seq: [[1, 3, 'Sit back · 3 sec'], [1, 0.5, 'Knees track over toes'], [0, 1.5, 'Drive through your feet'], [0, 0.8, 'Stand tall']],
      pose: function (v, p) { return v === 'front' ? gobletFront(p) : gobletSide(p); }
    },
    'bench-press': {
      grip: 'horizontal', views: VIEWS.floor,
      seq: [[1, 3, 'Lower to chest · 3 sec'], [1, 0.4, 'Elbows about 45°'], [0, 1.5, 'Press up'], [0, 0.7, 'Soft lockout']],
      pose: function (v, p) { return v === 'front' ? benchAbove(p) : benchSide(p); }
    },
    'one-arm-row': {
      grip: 'horizontal', views: VIEWS.stand,
      seq: [[1, 1.5, 'Pull toward your hip'], [1, 0.6, 'Squeeze the shoulder blade'], [0, 2.5, 'Lower slow'], [0, 0.5, 'Arm straight']],
      pose: function (v, p) { return v === 'front' ? rowFront(p) : rowSide(p); }
    },
    rdl: {
      grip: 'horizontal', views: VIEWS.stand,
      seq: [[1, 3, 'Hips back · 3 sec'], [1, 0.4, 'Soft knees, flat back'], [0, 1.5, 'Squeeze glutes to stand'], [0, 0.7, 'Stand tall']],
      pose: function (v, p) { return v === 'front' ? rdlFront(p) : rdlSide(p); }
    },
    'seated-press': {
      grip: 'horizontal', views: VIEWS.stand,
      seq: [[1, 1.5, 'Press up'], [1, 0.4, 'Biceps by your ears'], [0, 2.5, 'Lower slow'], [0, 0.6, 'Dumbbells at ear height']],
      pose: function (v, p) { return v === 'front' ? pressFront(p) : pressSide(p); }
    },
    'glute-bridge': {
      grip: 'across-hips', views: VIEWS.floor,
      seq: [[1, 1.5, 'Drive hips up'], [1, 1, 'Squeeze glutes · 1 sec'], [0, 2, 'Lower slowly'], [0, 0.6, 'On the floor']],
      pose: function (v, p) { return v === 'front' ? bridgeFront(p) : bridgeSide(p); }
    },
    'dead-bug': {
      grip: 'none', views: VIEWS.floor,
      seq: [[1, 2, 'Reach out, back stays down'], [1, 0.5, 'Low back glued down'], [0, 2, 'Come back in'], [0, 0.5, 'Knees over hips']],
      pose: function (v, p) { return v === 'front' ? bugAbove(p) : bugSide(p); }
    },
    'reverse-lunge': {
      grip: 'sides', views: VIEWS.stand,
      seq: [[1, 2.5, 'Step back and lower'], [1, 0.4, 'Front knee over the foot'], [0, 1.5, 'Drive through the front foot'], [0, 0.6, 'Dumbbells at your sides']],
      pose: function (v, p) { return v === 'front' ? lungeFront(p) : lungeSide(p); }
    },
    'calf-raise': {
      grip: 'sides', views: VIEWS.stand,
      seq: [[1, 1, 'Rise onto the balls of your feet'], [1, 0.6, 'Pause at the top'], [0, 2, 'Lower · 2 sec'], [0, 0.4, 'Heels down']],
      pose: function (v, p) { return v === 'front' ? calfFront(p) : calfSide(p); }
    },
    'biceps-curl': {
      grip: 'supinated', views: VIEWS.stand,
      seq: [[1, 1.5, 'Curl, palms up'], [1, 0.4, 'Elbows pinned'], [0, 2.5, 'Lower slow'], [0, 0.5, 'Arms straight']],
      pose: function (v, p) { return v === 'front' ? curlFront(p, false) : curlSide(p, false); }
    },
    'hammer-curl': {
      grip: 'neutral', views: VIEWS.stand,
      seq: [[1, 1.5, 'Curl, thumbs up'], [1, 0.4, 'Elbows pinned'], [0, 2.5, 'Lower slow · 3 sec'], [0, 0.5, 'Arms straight, palms in']],
      pose: function (v, p) { return v === 'front' ? curlFront(p, true) : curlSide(p, true); }
    },
    'overhead-triceps': {
      grip: 'vertical', views: VIEWS.stand,
      seq: [[1, 2.5, 'Lower behind the head'], [1, 0.3, 'Elbows point forward'], [0, 1.5, 'Straighten the elbows'], [0, 0.6, 'Dumbbell overhead']],
      pose: function (v, p) { return v === 'front' ? triFront(p) : triSide(p); }
    },
    'incline-fly': {
      grip: 'horizontal', views: VIEWS.floor,
      seq: [[1, 3, 'Open wide · 3 sec'], [1, 0.3, 'Soft elbows'], [0, 1.5, 'Hug together'], [0, 0.6, 'Over the chest']],
      pose: function (v, p) { return v === 'front' ? flyAbove(p) : flySide(p); }
    },
    'push-up': {
      grip: 'none', views: VIEWS.floor,
      seq: [[1, 2.5, 'Lower slow, body straight'], [1, 0.3, 'Chest near the floor'], [0, 1.5, 'Push the floor away'], [0, 0.6, 'Body in one line']],
      pose: function (v, p) { return v === 'front' ? pushAbove(p) : pushSide(p); }
    },
    generic: {
      grip: 'horizontal', views: VIEWS.stand,
      seq: [[1, 1.5, ''], [0, 1.5, '']],
      pose: function (v, p) { return v === 'front' ? genericFront(p) : genericSide(p); }
    }
  };

  const ALIAS = {
    squat: 'goblet-squat', 'db-bench-press': 'bench-press', bench: 'bench-press',
    row: 'one-arm-row', 'dumbbell-row': 'one-arm-row', 'romanian-deadlift': 'rdl',
    'shoulder-press': 'seated-press', ohp: 'seated-press', 'hip-bridge': 'glute-bridge',
    'glute-bridges': 'glute-bridge', deadbug: 'dead-bug', lunge: 'reverse-lunge',
    curl: 'biceps-curl', hammer: 'hammer-curl', triceps: 'overhead-triceps',
    'triceps-extension': 'overhead-triceps', fly: 'incline-fly', 'pushup': 'push-up'
  };

  function resolve(id) {
    id = String(id || '').toLowerCase();
    if (D[id]) return id;
    if (ALIAS[id] && D[ALIAS[id]]) return ALIAS[id];
    const keys = Object.keys(D);
    for (let i = 0; i < keys.length; i++) if (id && id.indexOf(keys[i]) !== -1) return keys[i];
    const aliases = Object.keys(ALIAS);
    for (let n = 0; n < aliases.length; n++) if (id && id.indexOf(aliases[n]) !== -1 && D[ALIAS[aliases[n]]]) return ALIAS[aliases[n]];
    return 'generic';
  }

  function find(id) { return D[resolve(id)]; }

  const ease = function (t) {
    const x = Math.min(1, Math.max(0, t));
    return (1 - Math.cos(Math.PI * x)) / 2;
  };

  function at(seq, t) {
    const total = seq.reduce(function (s, x) { return s + x[1]; }, 0);
    t = ((t % total) + total) % total;
    let prev = seq[seq.length - 1][0];
    for (let i = 0; i < seq.length; i++) {
      const to = seq[i][0], dur = seq[i][1], lab = seq[i][2];
      if (t < dur) return { p: prev + (to - prev) * ease(dur ? t / dur : 1), label: lab || '' };
      t -= dur;
      prev = to;
    }
    return { p: prev, label: '' };
  }

  function stillPhase(seq) {
    return at(seq, Math.max(0.02, seq[0][1] - 0.04));
  }

  function sample(id, view, p) {
    const d = find(id);
    const pose = d.pose(view === 'front' ? 'front' : 'side', Math.max(0, Math.min(1, p)));
    return {
      id: resolve(id),
      grip: d.grip,
      label: view === 'front' ? d.views[1].label : d.views[0].label,
      dbs: (pose.dbs || []).map(function (db) {
        return { x: db.x, y: db.y, rot: db.rot || 0, end: !!db.end };
      }),
      points: pose.pts || [],
      head: pose.head
    };
  }

  function dbMarkup(d) {
    const op = d.opacity == null ? 1 : d.opacity;
    if (d.end) {
      return '<g transform="translate(' + d.x + ',' + d.y + ')" opacity="' + op + '">' +
        '<circle r="9" fill="#e09a12"/><circle r="5.2" fill="#f6c453"/><circle r="2" fill="#8a5a00"/></g>';
    }
    const sx = d.sx == null ? 1 : d.sx;
    return '<g transform="translate(' + d.x + ',' + d.y + ') rotate(' + (d.rot || 0) + ')' + (sx !== 1 ? ' scale(' + sx + ',1)' : '') + '" opacity="' + op + '">' +
      '<rect x="-16" y="-2.3" width="32" height="4.6" rx="2" fill="#f2c14b"/>' +
      '<rect x="-20" y="-8" width="7.5" height="16" rx="2" fill="#d4920a"/>' +
      '<rect x="-18.6" y="-6" width="2.2" height="12" rx="1" fill="#f8dc9a"/>' +
      '<rect x="12.5" y="-8" width="7.5" height="16" rx="2" fill="#d4920a"/>' +
      '<rect x="14" y="-6" width="2.2" height="12" rx="1" fill="#f8dc9a"/></g>';
  }

  function headMarkup(h, face) {
    if (!h) return '';
    const x = h[0], y = h[1];
    const skull = '<circle cx="' + x + '" cy="' + y + '" r="' + L.head + '" fill="' + INK + '"/>';
    if (face === 'front' || face === 'up') {
      const dy = face === 'up' ? -3 : -1;
      return skull +
        '<circle cx="' + (x - 3.1) + '" cy="' + (y + dy) + '" r="1.35" fill="#fff"/>' +
        '<circle cx="' + (x + 3.1) + '" cy="' + (y + dy) + '" r="1.35" fill="#fff"/>';
    }
    const dir = face === 'left' ? -1 : 1;
    return skull +
      '<circle cx="' + (x + dir * 2.4) + '" cy="' + (y - 1.6) + '" r="1.3" fill="#fff"/>' +
      '<circle cx="' + (x + dir * 8) + '" cy="' + (y + 0.6) + '" r="2.3" fill="' + SKIN + '"/>';
  }

  function draw(svg, pose, col) {
    const hot = tint(col);
    const parts = [];
    if (pose.ground !== false) {
      parts.push('<line x1="14" y1="' + FLOOR + '" x2="186" y2="' + FLOOR + '" stroke="' + FLOORC + '" stroke-width="3" stroke-linecap="round"/>');
    }
    if (pose.ground !== false && pose.shadow) {
      parts.push('<ellipse cx="' + pose.shadow[0] + '" cy="' + FLOOR + '" rx="26" ry="3.5" fill="' + INK + '" opacity=".08"/>');
    }
    (pose.props || []).forEach(function (p) {
      if (p.k === 'rot') {
        parts.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="3" fill="' + (p.fill || BENCH) + '" transform="rotate(' + p.deg + ' ' + p.x + ' ' + (p.y + 4) + ')"/>');
      } else {
        parts.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="3" fill="' + (p.fill || BENCH) + '"/>');
      }
    });
    (pose.glow || []).forEach(function (g) {
      parts.push('<circle cx="' + g[0] + '" cy="' + g[1] + '" r="16" fill="' + hot + '" opacity=".22"/>');
    });
    const dbs = (pose.dbs || []).slice().sort(function (a, b) { return (a.opacity || 1) - (b.opacity || 1); });
    dbs.filter(function (d) { return d.under; }).forEach(function (d) { parts.push(dbMarkup(d)); });
    if (pose.torso && pose.torso.length === 4) {
      const t = pose.torso;
      parts.push('<path d="M' + t[0][0] + ' ' + t[0][1] + ' L' + t[1][0] + ' ' + t[1][1] + ' L' + t[2][0] + ' ' + t[2][1] + ' L' + t[3][0] + ' ' + t[3][1] + ' Z" fill="' + TORSO + '"/>');
    }
    const lines = pose.lines || [];
    lines.filter(function (l) { return l.back; }).concat(lines.filter(function (l) { return !l.back; })).forEach(function (l) {
      const color = l.hot ? hot : INK;
      const op = l.back ? 0.38 : 1;
      const w = l.w || 6;
      if (l.hot && !l.back) {
        parts.push('<line x1="' + l.a[0] + '" y1="' + l.a[1] + '" x2="' + l.b[0] + '" y2="' + l.b[1] + '" stroke="' + hot + '" stroke-width="' + (w + 7) + '" stroke-linecap="round" opacity=".22"/>');
      }
      parts.push('<line x1="' + l.a[0] + '" y1="' + l.a[1] + '" x2="' + l.b[0] + '" y2="' + l.b[1] + '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" opacity="' + op + '"/>');
    });
    lines.forEach(function (l) {
      if (l.back) return;
      parts.push('<circle cx="' + l.a[0] + '" cy="' + l.a[1] + '" r="2.3" fill="' + INK + '"/>');
    });
    parts.push(headMarkup(pose.head, pose.face));
    dbs.filter(function (d) { return !d.under; }).forEach(function (d) { parts.push(dbMarkup(d)); });
    svg.innerHTML = parts.join('');
  }

  function niceName(id) {
    return String(id || 'exercise').replace(/-/g, ' ');
  }

  function html(id, col) {
    const d = find(id);
    const views = d.views.map(function (v) {
      return '<figure><figcaption>' + v.label + '</figcaption><svg viewBox="0 -8 200 174" data-view="' + v.k + '" role="img" aria-label="' + v.label + ' view of ' + niceName(resolve(id)) + '"></svg></figure>';
    }).join('');
    return '<div class="demo" data-demo="' + resolve(id) + '" data-col="' + (col || '') + '"><div class="dviews">' + views + '</div><div class="dbar"><span class="dlab">&nbsp;</span><button class="dplay" type="button">❚❚ Pause</button></div></div>';
  }

  const api = {
    ids: Object.keys(D).filter(function (k) { return k !== 'generic'; }),
    resolve: resolve,
    sample: sample,
    html: html,
    mount: function () {},
    toggle: function () {},
    renderStill: function () {}
  };

  if (typeof document === 'undefined') return api;

  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  let stored = null;
  try { stored = localStorage.getItem('wk.demoPlay'); } catch (e) { stored = null; }
  let playing = stored === null ? !mq.matches : stored === '1';
  const live = new Set();
  let t0 = 0;
  let raf = 0;
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) live.add(e.target); else live.delete(e.target); });
    kick();
  }, { rootMargin: '120px' }) : null;

  function paintOne(el, t) {
    const d = find(el.dataset.demo);
    const phase = playing ? at(d.seq, t) : stillPhase(d.seq);
    const col = el.dataset.col || '#5b3df5';
    el.querySelectorAll('svg').forEach(function (svg) {
      draw(svg, d.pose(svg.dataset.view || 'side', phase.p), col);
    });
    const cue = phase.label || '';
    const lab = el.querySelector('.dlab');
    if (lab) lab.textContent = playing ? (cue || '\u00a0') : ('Paused' + (cue ? ' · ' + cue : ''));
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    live.forEach(function (el) {
      if (!el.isConnected) { live.delete(el); return; }
      try { paintOne(el, t); } catch (err) { /* keep the other demos running */ }
    });
    raf = playing && live.size ? requestAnimationFrame(frame) : 0;
  }

  function kick() {
    if (playing && live.size && !raf) {
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function syncBtns() {
    document.querySelectorAll('.dplay').forEach(function (b) {
      b.textContent = playing ? '❚❚ Pause' : '▶ Play';
      b.setAttribute('aria-pressed', String(playing));
      b.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
    });
  }

  api.mount = function (rootEl) {
    (rootEl || document).querySelectorAll('.demo').forEach(function (el) {
      if (io) io.observe(el);
      else live.add(el);
      try { paintOne(el, playing ? (performance.now() - t0) / 1000 : 0); } catch (err) { /* ignore a bad pose */ }
    });
    syncBtns();
    kick();
  };

  api.toggle = function () {
    playing = !playing;
    try { localStorage.setItem('wk.demoPlay', playing ? '1' : '0'); } catch (e) { /* private mode */ }
    syncBtns();
    if (playing) kick();
    else document.querySelectorAll('.demo').forEach(function (el) { paintOne(el, 0); });
  };

  api.renderStill = function (svg, id, view, p, col) {
    draw(svg, find(id).pose(view === 'front' ? 'front' : 'side', Math.max(0, Math.min(1, p))), col || '#5b3df5');
  };

  if (mq.addEventListener) {
    mq.addEventListener('change', function () {
      if (mq.matches) {
        playing = false;
        try { localStorage.setItem('wk.demoPlay', '0'); } catch (e) { /* ignore */ }
        syncBtns();
        document.querySelectorAll('.demo').forEach(function (el) { paintOne(el, 0); });
      }
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('.dplay') || e.target.closest('.demo svg')) api.toggle();
  });

  return api;
});
