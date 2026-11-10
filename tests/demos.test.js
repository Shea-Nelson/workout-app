const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Demos = require('../demos.js');

const week = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workout.json'), 'utf8'));

function axis(rot) {
  const a = Math.abs(rot % 180);
  return Math.min(a, 180 - a);
}
function horiz(db) { return !db.end && axis(db.rot) < 20; }
function vert(db) { return !db.end && axis(db.rot) > 70; }

function each(id, fn) {
  ['side', 'front'].forEach(view => {
    [0, 0.5, 1].forEach(p => fn(Demos.sample(id, view, p), view, p));
  });
}

test('every programmed exercise has a demo', () => {
  const ids = new Set();
  week.days.forEach(day => day.exercises.forEach(ex => ids.add(ex.id)));
  ids.forEach(id => {
    assert.notEqual(Demos.resolve(id), 'generic', id);
    assert.ok(Demos.ids.includes(Demos.resolve(id)), id);
  });
});

test('figures stay on screen and dumbbells stay on the body', () => {
  Demos.ids.concat(['generic']).forEach(id => {
    each(id, (s, view, p) => {
      assert.ok(s.points.length >= 6, id + ' ' + view + ' ' + p);
      s.points.forEach(pt => {
        assert.ok(Number.isFinite(pt[0]) && Number.isFinite(pt[1]), id);
        assert.ok(pt[0] > -20 && pt[0] < 220, id + ' x ' + pt[0] + ' ' + view + ' p=' + p);
        assert.ok(pt[1] > -30 && pt[1] < 190, id + ' y ' + pt[1] + ' ' + view + ' p=' + p);
      });
      s.dbs.forEach(db => {
        const near = s.points.some(pt => Math.hypot(pt[0] - db.x, pt[1] - db.y) < 36);
        assert.equal(near, true, id + ' dumbbell is off the body ' + view);
      });
    });
  });
});

test('presses, rows, and flies are horizontal, not standing on end', () => {
  ['bench-press', 'seated-press', 'one-arm-row', 'incline-fly', 'rdl'].forEach(id => {
    each(id, (s) => {
      assert.ok(s.dbs.length >= 1, id);
      s.dbs.forEach(db => assert.equal(horiz(db), true, id + ' rot ' + db.rot + ' end ' + db.end));
    });
  });
});

test('goblet and overhead triceps stay vertical', () => {
  ['goblet-squat', 'overhead-triceps'].forEach(id => {
    each(id, (s) => {
      assert.ok(s.dbs.length >= 1, id);
      s.dbs.forEach(db => assert.equal(vert(db), true, id + ' rot ' + db.rot));
    });
  });
  each('goblet-squat', s => assert.equal(s.dbs.length, 1));
});

test('hammer curl is neutral and a palms-up curl is not', () => {
  each('hammer-curl', (s, view, p) => {
    // Side view: the handle points forward with the arm down, then turns with the forearm as it curls.
    if (view === 'side') s.dbs.forEach(db => {
      assert.equal(db.end, false, 'hammer side shows the handle');
      if (p === 0) assert.equal(horiz(db), true, 'hammer side at the bottom');
    });
    if (view === 'front') s.dbs.forEach(db => assert.equal(db.end, true, 'hammer front end-on'));
  });
  each('biceps-curl', (s, view) => {
    if (view === 'front') s.dbs.forEach(db => assert.equal(horiz(db), true, 'curl front'));
    if (view === 'side') s.dbs.forEach(db => assert.equal(db.end, true, 'curl side end-on'));
  });
});

test('lunges and calf raises hold the bells at the sides', () => {
  ['reverse-lunge', 'calf-raise'].forEach(id => {
    const front = Demos.sample(id, 'front', 0.7);
    assert.equal(front.dbs.length, 2, id);
    front.dbs.forEach(db => assert.equal(horiz(db), true, id));
    const xs = front.dbs.map(db => db.x).sort((a, b) => a - b);
    assert.ok(xs[0] < 78, id + ' left bell ' + xs[0]);
    assert.ok(xs[1] > 122, id + ' right bell ' + xs[1]);
    const side = Demos.sample(id, 'side', 0.7);
    assert.ok(side.dbs.length >= 1, id);
    side.dbs.forEach(db => assert.equal(db.end, true, id + ' side should show the plate, held at the side'));
  });
});

test('the floor bridge shows one bell across the hips', () => {
  const side = Demos.sample('glute-bridge', 'side', 1);
  assert.equal(side.dbs.length, 1);
  assert.equal(side.dbs[0].end, true);
  const front = Demos.sample('glute-bridge', 'front', 1);
  assert.equal(front.dbs.length, 1);
  assert.equal(horiz(front.dbs[0]), true);
  assert.ok(front.dbs[0].x > 70 && front.dbs[0].x < 130);
});

test('dead bug and push-up have no dumbbell', () => {
  ['dead-bug', 'push-up'].forEach(id => {
    each(id, s => assert.equal(s.dbs.length, 0));
  });
});

test('markup has two labeled views', () => {
  const html = Demos.html('hammer-curl', '#5b3df5');
  assert.match(html, /Side view of hammer curl/);
  assert.match(html, /Front view of hammer curl/);
  assert.match(html, /data-view="side"/);
  assert.match(html, /data-view="front"/);
  assert.match(Demos.html('bench-press', '#000'), /Above view of bench press/);
});

test('chin tuck, Y-T raise, and rear-delt fly have their own demos', () => {
  ['chin-tuck', 'yt-raise', 'rear-delt-fly'].forEach(id => {
    assert.equal(Demos.resolve(id), id);
    assert.ok(Demos.ids.includes(id));
  });
  assert.equal(Demos.resolve('chin-tucks'), 'chin-tuck');
  assert.equal(Demos.resolve('prone-yt'), 'yt-raise');
  assert.equal(Demos.resolve('rear-delt-flyes'), 'rear-delt-fly');
  each('chin-tuck', s => assert.equal(s.dbs.length, 0));
  each('yt-raise', s => assert.equal(s.dbs.length, 0));
  each('rear-delt-fly', s => {
    assert.ok(s.dbs.length >= 1);
    s.dbs.forEach(db => assert.equal(horiz(db), true, 'rear-delt rot ' + db.rot + ' end ' + db.end));
  });
  assert.match(Demos.html('chin-tuck', '#000'), /Side view of chin tuck/);
  assert.match(Demos.html('chin-tuck', '#000'), /Front view of chin tuck/);
  assert.match(Demos.html('yt-raise', '#000'), /Above view of yt raise/);
  assert.match(Demos.html('rear-delt-fly', '#000'), /Front view of rear delt fly/);
});
