const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../kitchen/state.js');

const root = path.join(__dirname, '..');
const recipesDoc = JSON.parse(fs.readFileSync(path.join(root, 'recipes/data/recipes.json'), 'utf8'));
const schedule = JSON.parse(fs.readFileSync(path.join(root, 'recipes/data/schedule.json'), 'utf8'));
const weeksDoc = JSON.parse(fs.readFileSync(path.join(root, 'planner/data/weeks.json'), 'utf8'));
const credits = JSON.parse(fs.readFileSync(path.join(root, 'recipes/assets/photos/credits.json'), 'utf8'));
const catalog = Object.fromEntries(recipesDoc.recipes.map(recipe => [recipe.id, recipe]));
const week = weeksDoc.weeks[0];
const removed = ['shrimp-scampi', 'tuscan-chicken'];

test('Eastern time decides today, including the evening before midnight', () => {
  assert.equal(K.easternISODate(new Date('2026-11-09T04:30:00.000Z')), '2026-11-08');
  assert.equal(K.easternISODate(new Date('2026-11-09T05:00:00.000Z')), '2026-11-09');
  assert.equal(K.easternISODate(new Date('2026-11-09T17:00:00.000Z')), '2026-11-09');
  assert.equal(K.defaultWeekId(weeksDoc, '2026-11-09'), '2026-11-08');
  assert.equal(K.weekContaining('2026-11-09', weeksDoc).id, '2026-11-08');
  assert.equal(K.weekContaining('2026-11-15', weeksDoc), null);
});

test('this week matches the final dinner order and drops the removed dinners', () => {
  assert.deepEqual(week.days.map(day => day.recipeId), [
    null,
    'keto-pizza-bowls',
    'garlic-parmesan-chicken',
    'steak-bites',
    'broccoli-ham-bake',
    'egg-roll-bowl',
    'pork-carnitas'
  ]);
  const blob = JSON.stringify(weeksDoc) + JSON.stringify(recipesDoc);
  removed.forEach(id => {
    assert.equal(catalog[id], undefined);
    assert.equal(week.days.some(day => day.recipeId === id), false);
  });
  week.days.forEach(day => {
    assert.doesNotMatch(JSON.stringify(day), /shrimp|tuscan/i);
  });
  recipesDoc.recipes.forEach(recipe => {
    assert.doesNotMatch(recipe.id + recipe.title, /shrimp|tuscan/i);
  });
  assert.doesNotMatch(blob, /Nicole|Shea|Scorpy|discord/i);
  assert.equal(week.days[0].dinnerNote.includes('Tuesday'), true);
  assert.match(week.days[1].lunch, /Turkey and cheese roll-ups/);
  assert.match(week.days[4].lunch, /pickles and string cheese/);
  assert.match(week.days[6].lunch, /hot dogs/);
});

test('each dinner has a temperature or a cooked-meat note, kid side, and timers', () => {
  const expectTimers = {
    'keto-pizza-bowls': { 'brown-sausage': 480, 'bake-bowls': 900 },
    'garlic-parmesan-chicken': { 'bake-20': 1200 },
    'steak-bites': { 'sear-side': 120, 'rest-steak': 180 },
    'broccoli-ham-bake': { 'bake-ham': 1500 },
    'egg-roll-bowl': { 'check-beef': 480 },
    'pork-carnitas': { 'slow-8h': 28800 }
  };
  week.days.forEach(day => {
    assert.ok(day.breakfast);
    assert.ok(day.lunch);
    if (!day.recipeId) return;
    const recipe = catalog[day.recipeId];
    assert.equal(recipe.servings, 6);
    assert.ok(recipe.safety);
    assert.ok(recipe.kidSide);
    assert.ok(recipe.steps.length >= 4);
    recipe.steps.forEach((step, index) => {
      assert.match(step.text, /\S/);
      assert.equal(index >= 0, true);
    });
    const timers = {};
    recipe.steps.forEach(step => (step.timers || []).forEach(timer => { timers[timer.id] = timer.seconds; }));
    Object.keys(expectTimers[day.recipeId]).forEach(id => {
      assert.equal(timers[id], expectTimers[day.recipeId][id], day.recipeId + ' ' + id);
    });
  });
  assert.match(catalog['garlic-parmesan-chicken'].safety, /165°F/);
  assert.match(catalog['steak-bites'].safety, /145°F/);
  assert.match(catalog['egg-roll-bowl'].safety, /160°F/);
  assert.match(catalog['keto-pizza-bowls'].safety, /160°F/);
  assert.match(catalog['pork-carnitas'].safety, /145°F/);
  assert.match(catalog['broccoli-ham-bake'].safety, /already cooked/i);
  assert.match(JSON.stringify(catalog['keto-pizza-bowls']), /400°F/);
  assert.match(JSON.stringify(catalog['broccoli-ham-bake']), /375°F/);
  assert.equal(catalog['egg-roll-bowl'].ingredients.some(item => item.id === 'beef' && item.amount === 3), true);
  assert.equal(catalog['garlic-parmesan-chicken'].ingredients.find(item => item.id === 'chicken').group, 'on-hand');
  assert.equal(catalog['pork-carnitas'].ingredients.some(item => item.group === 'kids-starch'), true);
});

test('the written grocery list is grouped and checkable', () => {
  const sections = K.grocerySections(week);
  assert.deepEqual(sections.map(section => section.id), ['meat', 'dairy', 'produce', 'pantry', 'snacks', 'kids']);
  const labels = sections.flatMap(section => section.items.map(item => item.label)).join('\n');
  ['Sirloin', 'already on hand', 'Grass-fed ground beef, 3 lb', 'Pork shoulder', '3 bags', 'Rao', 'Takeout pizza', 'Tortillas', 'Hot dog buns'].forEach(bit => {
    assert.match(labels, new RegExp(bit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.doesNotMatch(labels, /shrimp|lemon|zucchini|sun-dried|spinach/i);
  const keys = [];
  sections.forEach(section => {
    assert.equal(section.pantry === true || section.id !== 'pantry', true);
    section.items.forEach(item => {
      assert.match(item.key, /^list\|[a-z0-9-]+\|[a-z0-9-]+$/);
      keys.push(item.key);
      if (section.id === 'pantry') assert.equal(item.pantry, true);
    });
  });
  assert.equal(new Set(keys).size, keys.length);
  const empty = { days: [{ date: '2026-11-16', recipeId: 'garlic-parmesan-chicken', servings: 6 }] };
  assert.deepEqual(K.grocerySections(empty), []);
});

test('a later week can be added without code changes', () => {
  const next = {
    id: '2026-11-15',
    startsOn: '2026-11-15',
    endsOn: '2026-11-21',
    title: 'Sun Nov 15 – Sat Nov 21, 2026',
    days: [
      { date: '2026-11-15', weekday: 'Sunday', title: 'No dinner', recipeId: null, servings: 6 },
      { date: '2026-11-16', weekday: 'Monday', title: 'Garlic Parmesan chicken', recipeId: 'garlic-parmesan-chicken', servings: 6 }
    ]
  };
  const doc = { weeks: weeksDoc.weeks.concat([next]) };
  assert.equal(K.recipeIdForDate('2026-11-16', schedule, doc), 'garlic-parmesan-chicken');
  assert.equal(K.recipeIdForDate('2026-11-09', schedule, doc), 'keto-pizza-bowls');
  assert.equal(K.recipeIdForDate('2026-11-15', schedule, doc), null);
  assert.equal(K.defaultWeekId(doc, '2026-11-18'), '2026-11-15');
  assert.equal(K.weekContaining('2026-11-08', doc).days[0].title, 'No dinner');
});

test('pages share a kitchen nav and images are credited', () => {
  const recipeHtml = fs.readFileSync(path.join(root, 'recipes/index.html'), 'utf8');
  const plannerHtml = fs.readFileSync(path.join(root, 'planner/index.html'), 'utf8');
  const recipeApp = fs.readFileSync(path.join(root, 'recipes/app.js'), 'utf8');
  const plannerApp = fs.readFileSync(path.join(root, 'planner/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'kitchen/hearth.css'), 'utf8');
  assert.match(recipeHtml, /aria-label="Kitchen"/);
  assert.match(plannerHtml, /aria-label="Kitchen"/);
  assert.match(recipeHtml, /href="\.\.\/planner\/"/);
  assert.match(plannerHtml, /href="\.\.\/recipes\/"/);
  assert.match(recipeApp, /easternISODate/);
  assert.match(plannerApp, /easternISODate/);
  assert.equal(recipeApp.includes('keto-pizza-bowls'), false);
  assert.equal(plannerApp.includes('steak-bites'), false);
  assert.match(css, /prefers-reduced-motion/);
  const credited = new Set(credits.photos.map(photo => photo.file));
  recipesDoc.recipes.forEach(recipe => {
    const file = path.join('recipes', recipe.photo.src);
    assert.equal(credited.has(file), true, file);
    assert.ok(recipe.photo.caption);
    assert.ok(recipe.photo.author);
  });
  assert.equal(credited.has('recipes/assets/photos/shrimp-scampi.jpg'), false);
  assert.equal(credited.has('recipes/assets/photos/tuscan-chicken.jpg'), false);
});
