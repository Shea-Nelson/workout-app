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
    const ankY = FLOOR - 4;
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
    const props = [
      { k: 'rect', x: x, y: y, w: w, h: 8 },
      { k: 'rect', x: x + 12, y: y + 8, w: 6, h: 22, fill: '#b0aac6' },
      { k: 'rect', x: x + w - 18, y: y + 8, w: 6, h: 22, fill: '#b0aac6' }
    ];
    if (back) props.push({ k: 'rect', x: back.x, y: back.y, w: 8, h: back.h });
    return props;
  }

  function shadowAt(x) { return [x, FLOOR]; }

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
    const sho = [76, 102];
    const hip = polar(sho[0], sho[1], L.torso, 8);
    const head = polar(sho[0], sho[1], L.neck, 170);
    const ank = [146, FLOOR - 4];
    const leg = ikPrefer(hip, ank, L.thigh, L.shin, function (s) { return -s.mid[1]; });
    const hand = [sho[0] + lerp(6, 14, p), sho[1] + lerp(-43, 6, p)];
    const arm = reach(sho, hand, function (s) { return s.mid[1] - hand[1]; });
    const j = {
      head: [r1(head[0]), r1(head[1])], sho: sho, hip: [r1(hip[0]), r1(hip[1])],
      knee: leg.mid, ank: leg.end,
      toe: [r1(leg.end[0] + 12), leg.end[1]], heel: [r1(leg.end[0] - 4), leg.end[1]],
      elb: arm.mid, hand: arm.end
    };
    j.elb2 = [r1(arm.mid[0] - 6), r1(arm.mid[1] - 7)];
    j.hand2 = [r1(arm.end[0] - 6), r1(arm.end[1] - 7)];
    const seatY = j.hip[1] - 2;
    return fig({
      j: j, face: 'up',
      lines: sideLinks(j, { arm: true }),
      dbs: [bell(j.hand2[0], j.hand2[1], 0, { opacity: 0.45 }), bell(j.hand[0], j.hand[1], 0)],
      glow: [mid(j.sho, j.elb)],
      props: benchProps(j.head[0] - 8, seatY, 92),
      shadow: shadowAt(120)
    });
  }

  function benchAbove(p) {
    const cx = 100;
    const shoL = [cx - 26, 58], shoR = [cx + 26, 58];
    const hipL = [cx - 14, 102], hipR = [cx + 14, 102];
    const kneeL = [cx - 16, 128], kneeR = [cx + 16, 128];
    const ankL = [cx - 18, 154], ankR = [cx + 18, 154];
    const spread = lerp(16, 34, p);
    const handY = lerp(34, 84, p);
    const left = reach(shoL, [cx - spread, handY], function (s) { return shoL[0] - s.mid[0] + (s.mid[1] - shoL[1]); });
    const right = reach(shoR, [cx + spread, handY], function (s) { return s.mid[0] - shoR[0] + (s.mid[1] - shoR[1]); });
    const j = {
      head: [cx, 30], neck: [cx, 48],
      shoL: shoL, shoR: shoR, hipL: hipL, hipR: hipR, hip: [cx, 102],
      kneeL: kneeL, kneeR: kneeR, ankL: ankL, ankR: ankR,
      toeL: [ankL[0] - 4, ankL[1] + 4], toeR: [ankR[0] + 4, ankR[1] + 4],
      elbL: left.mid, handL: left.end, elbR: right.mid, handR: right.end
    };
    return fig({
      j: j, face: 'up',
      torso: [shoL, shoR, hipR, hipL],
      lines: frontLinks(j, { arm: true }),
      dbs: [bell(j.handL[0], j.handL[1], 0), bell(j.handR[0], j.handR[1], 0)],
      glow: [mid(j.elbL, j.shoL), mid(j.elbR, j.shoR)],
      props: [{ k: 'rect', x: 62, y: 90, w: 76, h: 70, fill: '#ddd8ee' }],
      ground: false
    });
  }

  function rowSide(p) {
    const hip = [132, 96];
    const sho = polar(hip[0], hip[1], L.torso, -174);
    const head = polar(sho[0], sho[1], L.neck, -150);
    const kneeOn = [118, 104];
    const foot = [156, FLOOR - 4];
    const support = polar(sho[0], sho[1], 28, 36);
    const hang = polar(sho[0], sho[1], L.uarm + L.farm - 2, 78);
    const pulled = [hip[0] - 10, hip[1] + 2];
    const hand = [lerp(hang[0], pulled[0], p), lerp(hang[1], pulled[1], p)];
    const arm = reach([r1(sho[0]), r1(sho[1])], hand, function (s) { return s.mid[1]; });
    const j = {
      head: [r1(head[0]), r1(head[1])],
      sho: [r1(sho[0]), r1(sho[1])], hip: hip,
      knee: kneeOn, ank: [kneeOn[0] + 8, kneeOn[1] + 4],
      toe: [kneeOn[0] + 16, kneeOn[1] + 4], heel: [kneeOn[0] - 2, kneeOn[1] + 4],
      knee2: [148, 124], ank2: foot, toe2: [foot[0] + 12, foot[1]], heel2: [foot[0] - 4, foot[1]],
      elb: arm.mid, hand: arm.end,
      elb2: [r1(support[0]), r1(support[1] - 10)],
      hand2: [r1(support[0]), r1(support[1])]
    };
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { arm: true, torso: true }),
      dbs: [bell(j.hand[0], j.hand[1] + 2, 0)],
      glow: [[hip[0] - 16, hip[1] - 4]],
      props: benchProps(70, 100, 78),
      shadow: shadowAt(120)
    });
  }

  function rowFront(p) {
    const cx = 112;
    const shoY = 64;
    const hipY = 96;
    const j = {
      head: [cx, 42], neck: [cx, shoY - 4],
      shoL: [cx - 28, shoY], shoR: [cx + 18, shoY],
      hip: [cx, hipY], hipL: [cx - 18, hipY], hipR: [cx + 10, hipY],
      kneeL: [cx - 26, 118], kneeR: [cx + 6, 132],
      ankL: [cx - 30, 128], ankR: [cx + 8, 158],
      toeL: [cx - 38, 132], toeR: [cx + 16, 162],
      elbL: [cx - 46, shoY + 6],
      handL: [58, shoY + 18]
    };
    const handR = [cx + lerp(26, 6, p), lerp(150, hipY + 8, p)];
    const arm = reach(j.shoR, handR, function (s) { return s.mid[1] - j.shoR[1]; });
    j.elbR = arm.mid;
    j.handR = arm.end;
    return fig({
      j: j, face: 'front',
      torso: [j.shoL, j.shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { arm: true }),
      dbs: [bell(j.handR[0], j.handR[1] + 1, 0)],
      glow: [mid(j.shoR, j.hipR)],
      props: [{ k: 'rect', x: 28, y: shoY + 14, w: 46, h: 8 }],
      ground: false
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
    const j = sideFigure({
      torso: -84,
      thigh: 10,
      shin: 92,
      ax: 154
    });
    const hand = [j.sho[0] + lerp(10, 4, p), j.sho[1] + lerp(2, -44, p)];
    const arm = reach(j.sho, hand, function (s) { return (s.mid[1] - j.sho[1]) + (j.sho[0] - s.mid[0]); });
    j.elb = arm.mid;
    j.hand = arm.end;
    j.elb2 = [r1(arm.mid[0] - 5), r1(arm.mid[1] - 4)];
    j.hand2 = [r1(arm.end[0] - 5), r1(arm.end[1] - 4)];
    const seatY = j.hip[1] - 4;
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { arm: true }),
      dbs: [bell(j.hand2[0], j.hand2[1], 0, { opacity: 0.45 }), bell(j.hand[0], j.hand[1], 0)],
      glow: [[j.sho[0] + 2, j.sho[1] - 4]],
      props: benchProps(j.hip[0] - 18, seatY, 64, { x: j.hip[0] - 26, y: seatY - 48, h: 52 }),
      shadow: shadowAt(j.ank[0])
    });
  }

  function pressFront(p) {
    const hipY = 112, shoY = 70;
    const j = {
      head: [100, shoY - 18], neck: [100, shoY],
      shoL: [78, shoY], shoR: [122, shoY],
      hip: [100, hipY], hipL: [88, hipY], hipR: [112, hipY],
      kneeL: [84, hipY + 28], kneeR: [116, hipY + 28],
      ankL: [84, FLOOR - 4], ankR: [116, FLOOR - 4],
      toeL: [76, FLOOR - 2], toeR: [124, FLOOR - 2]
    };
    const handY = lerp(shoY + 2, shoY - 46, p);
    const spread = lerp(20, 14, p);
    const left = reach(j.shoL, [100 - spread, handY], function (s) { return j.shoL[0] - s.mid[0]; });
    const right = reach(j.shoR, [100 + spread, handY], function (s) { return s.mid[0] - j.shoR[0]; });
    j.elbL = left.mid; j.handL = left.end;
    j.elbR = right.mid; j.handR = right.end;
    return fig({
      j: j, face: 'front',
      torso: [j.shoL, j.shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { arm: true }),
      dbs: [bell(j.handL[0], j.handL[1], 0), bell(j.handR[0], j.handR[1], 0)],
      glow: [[88, shoY - 6], [112, shoY - 6]],
      props: benchProps(68, hipY - 2, 64, { x: 64, y: shoY - 10, h: hipY - shoY + 12 }),
      shadow: shadowAt(100)
    });
  }

  function bridgeSide(p) {
    const sho = [52, 148];
    const hip = polar(sho[0], sho[1], L.torso, lerp(8, -36, p));
    const ank = [150, FLOOR - 4];
    const leg = ikPrefer(hip, ank, L.thigh, L.shin, function (s) { return -s.mid[1]; });
    const head = polar(sho[0], sho[1], L.neck, 168);
    const db = [r1(hip[0]), r1(hip[1] - 8)];
    const j = {
      head: [r1(head[0]), r1(head[1])], sho: sho, hip: [r1(hip[0]), r1(hip[1])],
      knee: leg.mid, ank: leg.end,
      toe: [r1(leg.end[0] + 12), leg.end[1]], heel: [r1(leg.end[0] - 5), leg.end[1]],
      elb: [r1(hip[0] - 8), r1(hip[1] - 4)], hand: [db[0], db[1] + 2]
    };
    return fig({
      j: j, face: 'up',
      lines: sideLinks(j, { thigh: true }),
      dbs: [bell(db[0], db[1], 0, { end: true })],
      glow: [[j.hip[0], j.hip[1] + 2]],
      props: [{ k: 'rect', x: 18, y: FLOOR - 2, w: 164, h: 4, fill: '#d5d0e6' }],
      shadow: shadowAt(100)
    });
  }

  function bridgeFront(p) {
    const cx = 100;
    const hipY = lerp(124, 108, p);
    const j = {
      head: [cx, 34], neck: [cx, 50],
      shoL: [cx - 24, 60], shoR: [cx + 24, 60],
      hip: [cx, hipY], hipL: [cx - 16, hipY], hipR: [cx + 16, hipY],
      kneeL: [cx - 40, hipY + 26], kneeR: [cx + 40, hipY + 26],
      ankL: [cx - 18, hipY + 6], ankR: [cx + 18, hipY + 6],
      toeL: [cx - 18, hipY - 6], toeR: [cx + 18, hipY - 6],
      elbL: [cx - 30, 78], elbR: [cx + 30, 78],
      handL: [cx - 20, hipY - 8], handR: [cx + 20, hipY - 8]
    };
    return fig({
      j: j, face: 'up',
      torso: [j.shoL, j.shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { thigh: true }),
      dbs: [bell(cx, hipY - 2, 0)],
      glow: [[cx, hipY + 8]],
      props: [{ k: 'rect', x: 28, y: 44, w: 144, h: 112, fill: '#e4dff3' }],
      ground: false
    });
  }

  function bugSide(p) {
    const sho = [74, 146];
    const hip = [116, 148];
    const j = {
      head: [52, 140], sho: sho, hip: hip,
      knee: [r1(lerp(124, 150, p)), r1(lerp(118, 142, p))],
      ank: [r1(lerp(142, 178, p)), r1(lerp(108, 146, p))],
      toe: [r1(lerp(150, 186, p)), r1(lerp(108, 146, p))],
      heel: [r1(lerp(136, 172, p)), r1(lerp(112, 148, p))],
      knee2: [120, 116], ank2: [136, 104], toe2: [144, 100], heel2: [130, 108],
      elb: [r1(lerp(66, 42, p)), r1(lerp(124, 142, p))],
      hand: [r1(lerp(58, 24, p)), r1(lerp(106, 144, p))]
    };
    return fig({
      j: j, face: 'up',
      lines: sideLinks(j, { torso: true }),
      dbs: [],
      glow: [mid(sho, hip)],
      props: [{ k: 'rect', x: 16, y: 150, w: 170, h: 8, fill: '#d5d0e6' }],
      ground: false
    });
  }

  function bugAbove(p) {
    const cx = 100;
    const shoY = 70, hipY = 112;
    const j = {
      head: [cx, 36], neck: [cx, shoY - 8],
      shoL: [cx - 22, shoY], shoR: [cx + 22, shoY],
      hip: [cx, hipY], hipL: [cx - 12, hipY], hipR: [cx + 12, hipY],
      kneeL: [lerp(cx - 18, cx - 34, p), lerp(hipY + 22, hipY + 8, p)],
      kneeR: [lerp(cx + 18, cx + 16, p), lerp(hipY + 22, hipY + 28, p)],
      ankL: [lerp(cx - 10, cx - 46, p), lerp(hipY + 8, hipY + 4, p)],
      ankR: [lerp(cx + 10, cx + 14, p), lerp(hipY + 8, FLOOR - 16, p)],
      toeL: [0, 0], toeR: [0, 0]
    };
    j.toeL = [j.ankL[0] - 6, j.ankL[1]];
    j.toeR = [j.ankR[0] + 4, j.ankR[1] + 6];
    const handL = [lerp(cx - 10, cx - 48, p), lerp(28, 22, p)];
    const handR = [lerp(cx + 10, cx + 14, p), lerp(28, 48, p)];
    const left = reach(j.shoL, handL, function (s) { return -s.mid[1]; });
    const right = reach(j.shoR, handR, function (s) { return -s.mid[1]; });
    j.elbL = left.mid; j.handL = left.end;
    j.elbR = right.mid; j.handR = right.end;
    return fig({
      j: j, face: 'up',
      torso: [j.shoL, j.shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { torso: true }),
      dbs: [],
      glow: [[cx, (shoY + hipY) / 2]],
      props: [{ k: 'rect', x: 28, y: 48, w: 144, h: 108, fill: '#e6e1f4' }],
      ground: false
    });
  }

  function lungeSide(p) {
    const hip = [lerp(108, 104, p), lerp(96, 118, p)];
    const sho = polar(hip[0], hip[1], L.torso, lerp(-90, -78, p));
    const head = polar(sho[0], sho[1], L.neck, -90);
    const frontAnk = [lerp(112, 126, p), FLOOR - 4];
    const backAnk = [lerp(104, 64, p), FLOOR - 4];
    const front = ikPrefer(hip, frontAnk, L.thigh, L.shin, function (s) { return -s.mid[1]; });
    const back = ikPrefer(hip, backAnk, L.thigh, L.shin, function (s) { return -s.mid[1]; });
    const hand = [hip[0] + 2, hip[1] + 32];
    const arm = reach([r1(sho[0]), r1(sho[1])], hand, function (s) { return s.mid[1]; });
    const j = {
      head: [r1(head[0]), r1(head[1])],
      sho: [r1(sho[0]), r1(sho[1])], hip: [r1(hip[0]), r1(hip[1])],
      knee: front.mid, ank: front.end,
      toe: [r1(front.end[0] + 12), front.end[1]], heel: [r1(front.end[0] - 4), front.end[1]],
      knee2: back.mid, ank2: back.end,
      toe2: [r1(back.end[0] + 10), back.end[1]], heel2: [r1(back.end[0] - 4), back.end[1]],
      elb: arm.mid, hand: arm.end
    };
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { thigh: true }),
      dbs: [bell(j.hand[0] + 2, j.hand[1], 0, { end: true })],
      glow: [mid(j.hip, j.knee)],
      props: [{ k: 'rect', x: 156, y: 78, w: 10, h: 84, fill: '#d5d0e6' }],
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
      foot: lerp(0, 58, p),
      plant: 'toe',
      ax: 124
    });
    const hand = [j.hip[0] + 2, j.hip[1] + 34];
    const arm = reach(j.sho, hand, function (s) { return s.mid[1]; });
    j.elb = arm.mid;
    j.hand = arm.end;
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { shin: true }),
      dbs: [bell(j.hand[0] + 2, j.hand[1], 0, { end: true })],
      glow: [mid(j.knee, j.ank)],
      shadow: shadowAt(j.toe[0])
    });
  }

  function calfFront(p) {
    const lift = lerp(0, 12, p);
    const j = frontStand({
      hipY: 100 - lift, shoY: 58 - lift, shoW: 22, hipW: 12, ankleX: 14, straight: true
    });
    j.head[1] -= 0;
    j.elbL = [j.shoL[0] - 6, j.shoL[1] + 24];
    j.elbR = [j.shoR[0] + 6, j.shoR[1] + 24];
    j.handL = [j.elbL[0] - 10, j.elbL[1] + 20];
    j.handR = [j.elbR[0] + 10, j.elbR[1] + 20];
    if (p > 0.2) {
      j.heelL = [j.ankL[0], r1(j.ankL[1] - lift)];
      j.heelR = [j.ankR[0], r1(j.ankR[1] - lift)];
    }
    return fig({
      j: j, face: 'front', torso: j.torso,
      lines: frontLinks(j, { shin: true }).concat(p > 0.2 ? link(j, [['ankL', 'heelL', 4, true, false], ['ankR', 'heelR', 4, true, false]]) : []),
      dbs: [bell(j.handL[0], j.handL[1], 0), bell(j.handR[0], j.handR[1], 0)],
      glow: [mid(j.ankL, j.kneeL), mid(j.ankR, j.kneeR)],
      shadow: shadowAt(100)
    });
  }

  function curlSide(p, neutral) {
    const j = sideFigure({ torso: -90, thigh: 84, shin: 96, ax: 108 });
    const elb = [r1(j.sho[0] + 4), r1(j.sho[1] + L.uarm)];
    const deg = lerp(80, -30, p);
    const hand = polar(elb[0], elb[1], L.farm, deg);
    j.elb = elb;
    j.hand = [r1(hand[0]), r1(hand[1])];
    const db = neutral
      ? bell(j.hand[0] + 8, j.hand[1], 0)
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
    const j = sideFigure({ torso: -86, thigh: 12, shin: 90, ax: 150 });
    const elb = polar(j.sho[0], j.sho[1], L.uarm, lerp(-78, -104, p));
    const hand = polar(elb[0], elb[1], L.farm, lerp(-78, 150, p));
    j.elb = [r1(elb[0]), r1(elb[1])];
    j.hand = [r1(hand[0]), r1(hand[1])];
    const seatY = j.hip[1] - 4;
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { arm: true }),
      dbs: [bell(j.hand[0], j.hand[1] - 2, 90)],
      glow: [j.elb],
      props: benchProps(j.hip[0] - 16, seatY, 60, { x: j.hip[0] - 24, y: seatY - 46, h: 50 }),
      shadow: shadowAt(j.ank[0])
    });
  }

  function triFront(p) {
    const hipY = 114, shoY = 72;
    const j = {
      head: [100, shoY - 18], neck: [100, shoY],
      shoL: [80, shoY], shoR: [120, shoY],
      hip: [100, hipY], hipL: [88, hipY], hipR: [112, hipY],
      kneeL: [86, hipY + 26], kneeR: [114, hipY + 26],
      ankL: [86, FLOOR - 4], ankR: [114, FLOOR - 4],
      toeL: [78, FLOOR - 2], toeR: [122, FLOOR - 2]
    };
    const elbY = lerp(shoY - 22, shoY - 18, p);
    j.elbL = [92, elbY];
    j.elbR = [108, elbY];
    const handY = lerp(shoY - 44, shoY - 4, p);
    j.handL = [98, handY];
    j.handR = [102, handY];
    return fig({
      j: j, face: 'front',
      torso: [j.shoL, j.shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { arm: true }),
      dbs: [bell(100, handY - 8, 90)],
      glow: [j.elbL, j.elbR],
      props: benchProps(70, hipY - 2, 60, { x: 66, y: shoY - 8, h: hipY - shoY + 10 }),
      shadow: shadowAt(100)
    });
  }

  function flySide(p) {
    const hip = [138, 118];
    const sho = polar(hip[0], hip[1], L.torso, -150);
    const head = polar(sho[0], sho[1], L.neck, -150);
    const ank = [168, FLOOR - 4];
    const leg = ikPrefer(hip, ank, L.thigh, L.shin, function (s) { return -s.mid[1]; });
    const together = polar(sho[0], sho[1], 36, -50);
    const open = polar(sho[0], sho[1], 42, 46);
    const hand = [lerp(together[0], open[0], p), lerp(together[1], open[1], p)];
    const arm = reach([r1(sho[0]), r1(sho[1])], hand, function (s) { return s.mid[1] - hand[1]; });
    const j = {
      head: [r1(head[0]), r1(head[1])],
      sho: [r1(sho[0]), r1(sho[1])], hip: hip,
      knee: leg.mid, ank: leg.end,
      toe: [r1(leg.end[0] + 10), leg.end[1]], heel: [r1(leg.end[0] - 4), leg.end[1]],
      elb: arm.mid, hand: arm.end
    };
    j.elb2 = [r1(arm.mid[0]), r1(arm.mid[1] - 6)];
    j.hand2 = [r1(arm.end[0]), r1(arm.end[1] - 6)];
    return fig({
      j: j, face: 'up',
      lines: sideLinks(j, { arm: true }),
      dbs: [bell(j.hand2[0], j.hand2[1], 0, { opacity: 0.45 }), bell(j.hand[0], j.hand[1], 0)],
      glow: [[j.sho[0] + 8, j.sho[1] + 8]],
      props: [{ k: 'rot', x: j.hip[0] - 70, y: j.hip[1] - 4, w: 78, h: 8, deg: -28 }],
      shadow: shadowAt(140)
    });
  }

  function flyAbove(p) {
    const cx = 100;
    const shoL = [cx - 22, 72], shoR = [cx + 22, 72];
    const spread = lerp(16, 52, p);
    const handY = lerp(48, 78, p);
    const left = reach(shoL, [cx - spread, handY], function (s) { return shoL[0] - s.mid[0]; });
    const right = reach(shoR, [cx + spread, handY], function (s) { return s.mid[0] - shoR[0]; });
    const j = {
      head: [cx, 40], neck: [cx, 58],
      shoL: shoL, shoR: shoR,
      hip: [cx, 118], hipL: [cx - 14, 118], hipR: [cx + 14, 118],
      kneeL: [cx - 16, 140], kneeR: [cx + 16, 140],
      ankL: [cx - 16, 156], ankR: [cx + 16, 156],
      toeL: [cx - 22, 160], toeR: [cx + 22, 160],
      elbL: left.mid, handL: left.end, elbR: right.mid, handR: right.end
    };
    return fig({
      j: j, face: 'up',
      torso: [shoL, shoR, j.hipR, j.hipL],
      lines: frontLinks(j, { arm: true }),
      dbs: [bell(j.handL[0], j.handL[1], 0), bell(j.handR[0], j.handR[1], 0)],
      glow: [[cx, 80]],
      props: [{ k: 'rect', x: 70, y: 100, w: 60, h: 56, fill: '#ddd8ee' }],
      ground: false
    });
  }

  function pushSide(p) {
    const hand = [62, FLOOR - 4];
    const sho = [62, lerp(112, 140, p)];
    const hip = [112, lerp(118, 142, p)];
    const ank = [164, FLOOR - 6];
    const leg = ikPrefer(hip, ank, L.thigh, L.shin, function (s) { return -s.mid[1]; });
    const arm = reach(sho, hand, function (s) { return s.mid[0] - sho[0]; });
    const head = polar(sho[0], sho[1], L.neck, 168);
    const j = {
      head: [r1(head[0]), r1(head[1])], sho: sho, hip: hip,
      knee: leg.mid, ank: leg.end,
      toe: [r1(leg.end[0] + 10), FLOOR - 4], heel: [r1(leg.end[0] - 3), r1(leg.end[1])],
      elb: arm.mid, hand: arm.end
    };
    return fig({
      j: j, face: 'right',
      lines: sideLinks(j, { arm: true, torso: true }),
      dbs: [],
      glow: [mid(j.sho, j.elb)],
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
      props: [{ k: 'rect', x: 40, y: 32, w: 120, h: 136, fill: '#e4dff3' }],
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
    return '<g transform="translate(' + d.x + ',' + d.y + ') rotate(' + (d.rot || 0) + ')" opacity="' + op + '">' +
      '<rect x="-16" y="-2.3" width="32" height="4.6" rx="2" fill="#f2c14b"/>' +
      '<rect x="-20" y="-8" width="7.5" height="16" rx="2" fill="#d4920a"/>' +
      '<rect x="-18.6" y="-6" width="2.2" height="12" rx="1" fill="#f8dc9a"/>' +
      '<rect x="12.5" y="-8" width="7.5" height="16" rx="2" fill="#d4920a"/>' +
      '<rect x="14" y="-6" width="2.2" height="12" rx="1" fill="#f8dc9a"/></g>';
  }

  function headMarkup(h, face) {
    if (!h) return '';
    const x = h[0], y = h[1];
    const skull = '<circle cx="' + x + '" cy="' + y + '" r="' + L.head + '" fill="#1d1b2e"/>';
    if (face === 'front' || face === 'up') {
      const dy = face === 'up' ? -3 : -1;
      return skull +
        '<circle cx="' + (x - 3.1) + '" cy="' + (y + dy) + '" r="1.35" fill="#fff"/>' +
        '<circle cx="' + (x + 3.1) + '" cy="' + (y + dy) + '" r="1.35" fill="#fff"/>';
    }
    const dir = face === 'left' ? -1 : 1;
    return skull +
      '<circle cx="' + (x + dir * 2.4) + '" cy="' + (y - 1.6) + '" r="1.3" fill="#fff"/>' +
      '<circle cx="' + (x + dir * 8) + '" cy="' + (y + 0.6) + '" r="2.3" fill="#f0b89a"/>';
  }

  function draw(svg, pose, col) {
    const parts = ['<rect x="0" y="-8" width="200" height="182" fill="#fbfaff"/>'];
    if (pose.ground !== false) {
      parts.push('<line x1="14" y1="' + FLOOR + '" x2="186" y2="' + FLOOR + '" stroke="#d4cfe6" stroke-width="3" stroke-linecap="round"/>');
    }
    if (pose.ground !== false && pose.shadow) {
      parts.push('<ellipse cx="' + pose.shadow[0] + '" cy="' + FLOOR + '" rx="26" ry="3.5" fill="#1d1b2e" opacity=".08"/>');
    }
    (pose.props || []).forEach(function (p) {
      if (p.k === 'rot') {
        parts.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="3" fill="' + (p.fill || '#c9c3dc') + '" transform="rotate(' + p.deg + ' ' + p.x + ' ' + (p.y + 4) + ')"/>');
      } else {
        parts.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="3" fill="' + (p.fill || '#c9c3dc') + '"/>');
      }
    });
    (pose.glow || []).forEach(function (g) {
      parts.push('<circle cx="' + g[0] + '" cy="' + g[1] + '" r="16" fill="' + col + '" opacity=".2"/>');
    });
    if (pose.torso && pose.torso.length === 4) {
      const t = pose.torso;
      parts.push('<path d="M' + t[0][0] + ' ' + t[0][1] + ' L' + t[1][0] + ' ' + t[1][1] + ' L' + t[2][0] + ' ' + t[2][1] + ' L' + t[3][0] + ' ' + t[3][1] + ' Z" fill="#2c2942"/>');
    }
    const lines = pose.lines || [];
    lines.filter(function (l) { return l.back; }).concat(lines.filter(function (l) { return !l.back; })).forEach(function (l) {
      const color = l.hot ? col : '#1d1b2e';
      const op = l.back ? 0.38 : 1;
      const w = l.w || 6;
      if (l.hot && !l.back) {
        parts.push('<line x1="' + l.a[0] + '" y1="' + l.a[1] + '" x2="' + l.b[0] + '" y2="' + l.b[1] + '" stroke="' + col + '" stroke-width="' + (w + 7) + '" stroke-linecap="round" opacity=".18"/>');
      }
      parts.push('<line x1="' + l.a[0] + '" y1="' + l.a[1] + '" x2="' + l.b[0] + '" y2="' + l.b[1] + '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" opacity="' + op + '"/>');
    });
    lines.forEach(function (l) {
      if (l.back) return;
      parts.push('<circle cx="' + l.a[0] + '" cy="' + l.a[1] + '" r="2.3" fill="#1d1b2e"/>');
    });
    parts.push(headMarkup(pose.head, pose.face));
    (pose.dbs || []).slice().sort(function (a, b) { return (a.opacity || 1) - (b.opacity || 1); }).forEach(function (d) {
      parts.push(dbMarkup(d));
    });
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
