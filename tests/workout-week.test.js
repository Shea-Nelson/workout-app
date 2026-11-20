const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const W = require('../week.js');

const root = path.join(__dirname, '..');
const week = JSON.parse(fs.readFileSync(path.join(root, 'workout.json'), 'utf8'));

test('the file covers Fri Nov 20 lower plus the week of Nov 23 split', () => {
  assert.equal(week.schema, 'workout.week');
  assert.equal(week.weekStart, '2026-11-16');
  assert.equal(week.weekEnd, '2026-11-29');
  assert.equal(week.timezone, 'America/New_York');
  assert.deepEqual(week.schedule.split, {
    effective: '2026-11-23',
    Monday: 'Lower Body',
    Wednesday: 'Upper Body',
    Friday: 'Full Body'
  });
  const plan = W.normalize(week);
  assert.deepEqual(plan.days.map(d => d.id), [
    '2026-11-20-lower',
    '2026-11-23-lower',
    '2026-11-25-upper',
    '2026-11-27-full'
  ]);
  assert.deepEqual(plan.days.map(d => d.date), [
    '2026-11-20',
    '2026-11-23',
    '2026-11-25',
    '2026-11-27'
  ]);
  assert.deepEqual(plan.days.map(d => d.time), ['08:00', '08:00', '08:00', '08:00']);
  assert.equal(W.weekdayLong('2026-11-20'), 'Friday');
  assert.equal(W.weekdayLong('2026-11-23'), 'Monday');
  assert.equal(W.weekdayLong('2026-11-25'), 'Wednesday');
  assert.equal(W.weekdayLong('2026-11-27'), 'Friday');
  assert.deepEqual(plan.days.map(d => d.title), [
    'Lower Body Day',
    'Lower Body Day',
    'Upper Body Day',
    'Full Body Day'
  ]);
});

test('Friday Nov 20 and Monday Nov 23 are lower body at current weights, with step-ups instead of lunges', () => {
  const ids = ['2026-11-20-lower', '2026-11-23-lower'];
  ids.forEach(id => {
    const day = week.days.find(d => d.id === id);
    assert.equal(day.title, 'Lower Body Day');
    assert.deepEqual(day.exercises.map(e => [e.id, e.sets, e.reps, e.weight]), [
      ['goblet-squat', 3, 10, 30],
      ['rdl', 3, 10, 30],
      ['step-up', 3, 8, 0],
      ['glute-bridge', 3, 12, 30],
      ['calf-raise', 3, 12, 25],
      ['rear-delt-fly', 3, 10, 10],
      ['dead-bug', 2, 12, 0],
      ['chin-tuck', 2, 12, 0]
    ]);
    assert.equal(day.exercises.some(e => e.id === 'reverse-lunge'), false);
    const step = day.exercises.find(e => e.id === 'step-up');
    assert.match(step.weightNote, /rail/i);
    assert.match(step.safety, /rail|wall/i);
    const bridge = day.exercises.find(e => e.id === 'glute-bridge');
    assert.match(bridge.name, /floor/i);
    const tuck = day.exercises.find(e => e.id === 'chin-tuck');
    assert.match(tuck.safety, /pain, numbness, or tingling/i);
    const fly = day.exercises.find(e => e.id === 'rear-delt-fly');
    assert.match(fly.safety, /pain, numbness, or tingling/i);
  });
});

test('Wednesday is upper and Friday Nov 27 is full body, with a floor press and no lunges', () => {
  const wed = week.days.find(d => d.id === '2026-11-25-upper');
  const fri = week.days.find(d => d.id === '2026-11-27-full');
  assert.equal(wed.title, 'Upper Body Day');
  assert.equal(fri.title, 'Full Body Day');
  assert.deepEqual(wed.exercises.map(e => [e.id, e.sets, e.reps, e.weight]), [
    ['floor-press', 3, 10, 20],
    ['one-arm-row', 3, 10, 25],
    ['seated-press', 3, 10, 15],
    ['biceps-curl', 3, 10, 15],
    ['overhead-triceps', 3, 10, 15],
    ['rear-delt-fly', 3, 10, 10],
    ['dead-bug', 2, 12, 0],
    ['chin-tuck', 2, 12, 0]
  ]);
  assert.deepEqual(fri.exercises.map(e => [e.id, e.sets, e.reps, e.weight]), [
    ['goblet-squat', 3, 10, 30],
    ['floor-press', 3, 10, 20],
    ['one-arm-row', 3, 10, 25],
    ['rdl', 3, 10, 30],
    ['seated-press', 3, 10, 15],
    ['glute-bridge', 3, 12, 30],
    ['dead-bug', 2, 12, 0],
    ['chin-tuck', 2, 12, 0]
  ]);
  const lower = fri.exercises.filter(e => ['goblet-squat', 'rdl', 'glute-bridge'].includes(e.id));
  const upper = fri.exercises.filter(e => ['floor-press', 'one-arm-row', 'seated-press'].includes(e.id));
  const core = fri.exercises.filter(e => ['dead-bug', 'chin-tuck'].includes(e.id));
  assert.equal(lower.length, 3);
  assert.equal(upper.length, 3);
  assert.equal(core.length, 2);
  assert.equal(fri.exercises.some(e => e.id === 'reverse-lunge'), false);
  assert.match(fri.exercises.find(e => e.id === 'glute-bridge').name, /floor/i);
  assert.ok(fri.cooldown.some(line => /doorway/i.test(line)));
  wed.exercises.filter(e => e.id === 'chin-tuck' || e.id === 'rear-delt-fly').forEach(e => {
    assert.ok(e.safety && /pain, numbness, or tingling/i.test(e.safety), e.id);
  });
});

test('every exercise has cues, a common mistake, and the day has warm-up and cool-down', () => {
  const banned = /hip thrust|bulgarian|bench edge|slide off the bench|reverse lunge/i;
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
  assert.deepEqual(pick('2026-11-20'), { index: 0, reason: 'today' });
  assert.deepEqual(pick('2026-11-23'), { index: 1, reason: 'today' });
  assert.deepEqual(pick('2026-11-25'), { index: 2, reason: 'today' });
  assert.deepEqual(pick('2026-11-27'), { index: 3, reason: 'today' });
  assert.deepEqual(pick('2026-11-21'), { index: 1, reason: 'upcoming' });
  assert.deepEqual(pick('2026-11-24'), { index: 2, reason: 'upcoming' });
  assert.deepEqual(pick('2026-11-26'), { index: 3, reason: 'upcoming' });
  assert.deepEqual(pick('2026-11-19'), { index: 0, reason: 'upcoming' });
  assert.deepEqual(pick('2026-11-28'), { index: 3, reason: 'past' });
  assert.deepEqual(pick('2026-11-29'), { index: 3, reason: 'past' });

  assert.equal(W.restMessage('2026-11-20', days[0], 'today'), '');
  const tue = W.restMessage('2026-11-24', days[2], 'upcoming');
  assert.match(tue, /rest or treadmill day/);
  assert.match(tue, /Wed Nov 25/);
  assert.match(tue, /8:00 AM/);
  assert.match(tue, /Upper Body/);
  const sat = W.restMessage('2026-11-28', days[3], 'past');
  assert.match(sat, /rest or treadmill day/);
  assert.match(sat, /finished/);
  assert.match(sat, /Fri Nov 27/);
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
  const day = W.normalize(week).days.find(d => d.id === '2026-11-25-upper');
  const state = W.freshState(day);
  assert.equal(W.stateFits(day, state), true);
  const press = day.exercises.findIndex(e => e.id === 'floor-press');
  assert.ok(press >= 0);
  state.ex[press].sets[0].done = true;
  state.ex[press].sets[0].weight = 20;
  state.ex[press].sets[0].reps = 10;
  const sent = '2026-11-25T13:00:00.000Z';
  const body = W.buildPayload(day, state, 'finished', {
    finishedAt: sent,
    log: W.logText(day, state)
  }, sent);
  assert.deepEqual(Object.keys(body), ['event', 'date', 'workout', 'workoutId', 'sentAt', 'finishedAt', 'log', 'exercises']);
  assert.equal(body.event, 'finished');
  assert.equal(body.date, '2026-11-25');
  assert.equal(body.workout, 'Upper Body Day');
  assert.equal(body.workoutId, '2026-11-25-upper');
  assert.equal(body.exercises[press].sets[0].weight, 20);
  assert.equal(body.exercises[press].sets[0].done, true);
  const bug = day.exercises.findIndex(e => e.id === 'dead-bug');
  if (bug >= 0) assert.equal(body.exercises[bug].sets[0].weight, 0);
  assert.match(body.log, /Upper Body Day · Wed Nov 25 · 2026-11-25-upper/);
  assert.match(body.log, /20 lb × 10/);

  const setBody = W.buildPayload(day, state, 'set', { exercise: 'floor-press', set: 1 }, sent);
  assert.equal(setBody.event, 'set');
  assert.equal(setBody.exercise, 'floor-press');
  assert.equal(setBody.set, 1);
  assert.equal(setBody.workoutId, '2026-11-25-upper');
  assert.ok(Array.isArray(setBody.exercises));
});
