const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const W = require('../week.js');

const root = path.join(__dirname, '..');
const week = JSON.parse(fs.readFileSync(path.join(root, 'workout.json'), 'utf8'));

test('this week is Mon Nov 9 through Sun Nov 15, three strength days', () => {
  assert.equal(week.schema, 'workout.week');
  assert.equal(week.weekStart, '2026-11-09');
  assert.equal(week.timezone, 'America/New_York');
  const plan = W.normalize(week);
  assert.deepEqual(plan.days.map(d => d.id), [
    '2026-11-09-full',
    '2026-11-11-upper',
    '2026-11-13-lower'
  ]);
  assert.deepEqual(plan.days.map(d => d.date), ['2026-11-09', '2026-11-11', '2026-11-13']);
  assert.deepEqual(plan.days.map(d => d.time), ['08:00', '08:00', '08:00']);
  assert.equal(W.weekdayLong('2026-11-09'), 'Monday');
  assert.equal(W.weekdayLong('2026-11-11'), 'Wednesday');
  assert.equal(W.weekdayLong('2026-11-13'), 'Friday');
});

test('Monday keeps the full-body loads already in the plan', () => {
  const mon = week.days[0];
  assert.equal(mon.title, 'Full Body Day');
  assert.deepEqual(mon.exercises.map(e => [e.id, e.sets, e.reps, e.weight]), [
    ['goblet-squat', 3, 10, 20],
    ['bench-press', 3, 10, 20],
    ['one-arm-row', 3, 10, 25],
    ['rdl', 3, 10, 20],
    ['seated-press', 3, 10, 15],
    ['glute-bridge', 3, 12, 25],
    ['dead-bug', 2, 8, 0]
  ]);
  assert.match(mon.exercises[2].lastTime, /30 lb/);
  assert.match(mon.exercises[5].lastTime, /bench hip thrust/);
});

test('Wednesday is upper, Friday is lower, glutes stay a floor bridge', () => {
  const wed = week.days[1];
  const fri = week.days[2];
  assert.equal(wed.title, 'Upper Body');
  assert.equal(fri.title, 'Lower Body');
  assert.deepEqual(wed.exercises.map(e => [e.id, e.sets, e.reps, e.weight]), [
    ['chin-tuck', 2, 10, 0],
    ['bench-press', 3, 10, 20],
    ['one-arm-row', 3, 10, 25],
    ['seated-press', 3, 10, 15],
    ['incline-fly', 3, 12, 10],
    ['hammer-curl', 3, 10, 15],
    ['overhead-triceps', 3, 10, 15],
    ['yt-raise', 2, 10, 0]
  ]);
  wed.exercises.filter(e => e.id === 'chin-tuck' || e.id === 'yt-raise').forEach(e => {
    assert.ok(e.safety && /pain, numbness, or tingling/i.test(e.safety), e.id);
    assert.match(e.safety, /gentle|light|neck/i);
  });
  const bridge = fri.exercises.find(e => e.id === 'glute-bridge');
  assert.equal(bridge.sets, 3);
  assert.equal(bridge.reps, 12);
  assert.equal(bridge.weight, 25);
  assert.match(bridge.name, /floor/i);
  const lunge = fri.exercises.find(e => e.id === 'reverse-lunge');
  assert.equal(lunge.weight, 10);
  assert.match(lunge.avoid, /bench/i);
  const tuck = fri.exercises.find(e => e.id === 'chin-tuck');
  assert.equal(tuck.sets, 2);
  assert.equal(tuck.reps, 10);
  assert.equal(tuck.weight, 0);
  assert.match(tuck.safety, /pain, numbness, or tingling/i);
  const fly = fri.exercises.find(e => e.id === 'rear-delt-fly');
  assert.equal(fly.sets, 2);
  assert.equal(fly.reps, 10);
  assert.equal(fly.weight, 10);
  assert.match(fly.safety, /pain, numbness, or tingling/i);
  assert.ok(fri.cooldown.some(line => /doorway/i.test(line)));
});

test('every exercise has cues, a common mistake, and the day has warm-up and cool-down', () => {
  const banned = /hip thrust|bulgarian|bench edge|slide off the bench/i;
  week.days.forEach(day => {
    assert.ok(day.warmup.length >= 3, day.id);
    assert.ok(day.cooldown.length >= 3, day.id);
    assert.ok(day.notes.length >= 3, day.id);
    day.exercises.forEach(ex => {
      assert.ok(ex.cues && ex.cues.length >= 3, ex.id);
      assert.ok(ex.avoid && ex.avoid.length > 8, ex.id);
      assert.equal(banned.test(ex.name), false, ex.name);
    });
  });
});

test('the app opens the right day, and rest days say so', () => {
  const days = W.normalize(week).days;
  const pick = (iso) => W.pickDay(days, iso);
  assert.deepEqual(pick('2026-11-09'), { index: 0, reason: 'today' });
  assert.deepEqual(pick('2026-11-11'), { index: 1, reason: 'today' });
  assert.deepEqual(pick('2026-11-13'), { index: 2, reason: 'today' });
  assert.deepEqual(pick('2026-11-10'), { index: 1, reason: 'upcoming' });
  assert.deepEqual(pick('2026-11-12'), { index: 2, reason: 'upcoming' });
  assert.deepEqual(pick('2026-11-08'), { index: 0, reason: 'upcoming' });
  assert.deepEqual(pick('2026-11-14'), { index: 2, reason: 'past' });
  assert.deepEqual(pick('2026-11-15'), { index: 2, reason: 'past' });

  assert.equal(W.restMessage('2026-11-09', days[0], 'today'), '');
  const tue = W.restMessage('2026-11-10', days[1], 'upcoming');
  assert.match(tue, /rest or treadmill day/);
  assert.match(tue, /Wed Nov 11/);
  assert.match(tue, /8:00 AM/);
  assert.match(tue, /Upper Body/);
  const sat = W.restMessage('2026-11-14', days[2], 'past');
  assert.match(sat, /rest or treadmill day/);
  assert.match(sat, /finished/);
  assert.match(sat, /Fri Nov 13/);
});

test('New York date does not follow UTC across midnight', () => {
  assert.equal(W.nyToday(new Date('2026-11-10T02:30:00Z')), '2026-11-09');
  assert.equal(W.nyToday(new Date('2026-11-10T06:00:00Z')), '2026-11-10');
  assert.equal(W.formatTime('08:00'), '8:00 AM');
  assert.equal(W.formatTime('15:05'), '3:05 PM');
});

test('a single-day file still loads', () => {
  const legacy = W.normalize({
    id: '2026-11-06-full',
    date: '2026-11-06',
    dateLabel: 'Fri Nov 6',
    title: 'Full Body Day',
    exercises: [{ id: 'goblet-squat', sets: 3, reps: 10, weight: 20 }]
  });
  assert.equal(legacy.legacy, true);
  assert.equal(legacy.days.length, 1);
  assert.equal(legacy.days[0].id, '2026-11-06-full');
  assert.match(W.legacyMismatch('2026-11-09', legacy.days[0]), /Fri Nov 6/);
  assert.equal(W.legacyMismatch('2026-11-06', legacy.days[0]), '');
});

test('Finish payload keeps the old keys and names the day', () => {
  const day = W.normalize(week).days[1];
  const state = W.freshState(day);
  assert.equal(W.stateFits(day, state), true);
  const bench = day.exercises.findIndex(e => e.id === 'bench-press');
  assert.ok(bench >= 0);
  state.ex[bench].sets[0].done = true;
  state.ex[bench].sets[0].weight = 20;
  state.ex[bench].sets[0].reps = 10;
  const sent = '2026-11-11T13:00:00.000Z';
  const body = W.buildPayload(day, state, 'finished', {
    finishedAt: sent,
    log: W.logText(day, state)
  }, sent);
  assert.deepEqual(Object.keys(body), ['event', 'date', 'workout', 'workoutId', 'sentAt', 'finishedAt', 'log', 'exercises']);
  assert.equal(body.event, 'finished');
  assert.equal(body.date, '2026-11-11');
  assert.equal(body.workout, 'Upper Body');
  assert.equal(body.workoutId, '2026-11-11-upper');
  assert.equal(body.exercises[bench].sets[0].weight, 20);
  assert.equal(body.exercises[bench].sets[0].done, true);
  const bug = day.exercises.findIndex(e => e.id === 'dead-bug');
  if (bug >= 0) assert.equal(body.exercises[bug].sets[0].weight, 0);
  assert.match(body.log, /Upper Body · Wed Nov 11 · 2026-11-11-upper/);
  assert.match(body.log, /20 lb × 10/);

  const setBody = W.buildPayload(day, state, 'set', { exercise: 'bench-press', set: 1 }, sent);
  assert.equal(setBody.event, 'set');
  assert.equal(setBody.exercise, 'bench-press');
  assert.equal(setBody.set, 1);
  assert.equal(setBody.workoutId, '2026-11-11-upper');
  assert.ok(Array.isArray(setBody.exercises));
});
