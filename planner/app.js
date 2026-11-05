(function () {
  'use strict';
  const K = window.KitchenState;
  const $ = id => document.getElementById(id);
  let catalog = {};
  let weeksDoc = { weeks: [] };
  let session = null;
  let recovery = '';

  function announce(text) { $('live').textContent = text; }

  function allowedLink(url) {
    return /^https:\/\/(commons\.wikimedia\.org|creativecommons\.org)\//.test(url || '');
  }

  function creditHtml(photo) {
    const license = photo.licenseUrl && allowedLink(photo.licenseUrl)
      ? '<a href="' + K.esc(photo.licenseUrl) + '">' + K.esc(photo.license) + '</a>'
      : K.esc(photo.license || '');
    const source = allowedLink(photo.sourceUrl) ? ' · <a href="' + K.esc(photo.sourceUrl) + '">Source</a>' : '';
    return K.esc(photo.author || '') + (license ? ' · ' + license : '') + source;
  }

  function publishedWeek(id) {
    return (weeksDoc.weeks || []).find(function (week) { return week.id === id; }) || null;
  }

  function defaultWeekId() {
    const today = K.localISODate();
    const weeks = weeksDoc.weeks || [];
    const containing = weeks.find(function (week) { return today >= week.startsOn && today <= week.endsOn; });
    if (containing) return containing.id;
    let best = weeks[0];
    let bestDistance = Infinity;
    weeks.forEach(function (week) {
      const distance = Math.abs(Date.parse(week.startsOn) - Date.parse(today));
      if (distance < bestDistance) { best = week; bestDistance = distance; }
    });
    return best ? best.id : K.sundayOf(today);
  }

  function viewSunday() {
    return K.sundayOf(session.viewWeekId || defaultWeekId());
  }

  function loadSession() {
    const raw = localStorage.getItem(K.PLANNER_STORAGE_KEY);
    if (!raw) return K.emptyPlannerSession(K.newSessionId());
    try {
      const result = K.validatePlannerSession(K.parseSessionJson(raw));
      if (!result.ok) throw new Error(result.errors.join('\n'));
      return result.value;
    } catch (error) {
      localStorage.setItem(K.PLANNER_STORAGE_KEY + '.unreadable', raw);
      recovery = 'The saved week session on this device could not be read. A copy remains under the local key kitchen.planner.session.v1.unreadable. A new session was started.\n' + error.message;
      return K.emptyPlannerSession(K.newSessionId());
    }
  }

  function persist() {
    const now = new Date();
    session.updatedAt = now.toISOString();
    const text = JSON.stringify(session, null, 2);
    localStorage.setItem(K.PLANNER_STORAGE_KEY, text);
    const stamp = $('savedAt');
    if (stamp) stamp.textContent = 'Saved on this device at ' + now.toLocaleString() + '. Not sent anywhere.';
    const preview = $('jsonPreview');
    if (preview && document.activeElement !== preview) preview.value = text;
  }

  function dayRecord(week, date) {
    return ((week && week.days) || []).find(function (day) { return day.date === date; }) || null;
  }

  function stateFor(date, create) {
    const sunday = viewSunday();
    const week = publishedWeek(sunday);
    const record = dayRecord(week, date);
    if (!session.weeks[sunday]) {
      if (!create && !record) return null;
      session.weeks[sunday] = { notes: '', days: {} };
    }
    const bucket = session.weeks[sunday];
    if (!bucket.days[date]) {
      if (!create && !record) return null;
      const recipe = record ? catalog[record.recipeId] : null;
      bucket.days[date] = {
        plannedRecipeId: record ? record.recipeId : null,
        overrideRecipeId: null,
        servings: record ? record.servings : 6,
        notes: '',
        favorite: false,
        rating: null,
        cookedAt: null,
        status: 'planned',
        tasks: {},
        customTasks: []
      };
      if (recipe) recipe.tasks.forEach(function (task) { bucket.days[date].tasks[task.id] = { checked: false }; });
    } else if (record) {
      bucket.days[date].plannedRecipeId = record.recipeId;
      const recipeId = K.effectiveRecipeId(record, bucket.days[date]);
      const recipe = catalog[recipeId];
      if (recipe) recipe.tasks.forEach(function (task) {
        if (!bucket.days[date].tasks[task.id]) bucket.days[date].tasks[task.id] = { checked: false };
      });
    }
    return bucket.days[date];
  }

  function photoSrc(recipe) {
    return '../recipes/' + recipe.photo.src;
  }

  function checkedCount(state, recipe) {
    if (!recipe) return { done: 0, total: 0 };
    const total = recipe.tasks.length + state.customTasks.length;
    const done = recipe.tasks.filter(function (task) { return state.tasks[task.id] && state.tasks[task.id].checked; }).length
      + state.customTasks.filter(function (task) { return task.checked; }).length;
    return { done: done, total: total };
  }

  function render() {
    const sunday = viewSunday();
    session.viewWeekId = sunday;
    const week = publishedWeek(sunday);
    const dates = Array.from({ length: 7 }, function (_, index) { return K.addDays(sunday, index); });
    if (!session.selectedDate || dates.indexOf(session.selectedDate) === -1) {
      const today = K.localISODate();
      session.selectedDate = dates.indexOf(today) !== -1 ? today : dates[0];
    }
    dates.forEach(function (date) { if (dayRecord(week, date)) stateFor(date, true); });
    const today = K.localISODate();
    const todayInside = today >= sunday && today <= K.addDays(sunday, 6);
    let intro = week
      ? week.title + '. ' + (weeksDoc.household || '')
      : 'No meals are published for ' + K.formatLong(sunday) + ' through ' + K.formatLong(K.addDays(sunday, 6)) + '. Empty days are not filled with guessed dinners.';
    if (week && !todayInside) intro = 'Showing the published week of ' + week.title + '. Today is ' + K.formatLong(today) + '.';
    const cards = dates.map(function (date) {
      const record = dayRecord(week, date);
      const state = record ? stateFor(date, false) : (session.weeks[sunday] && session.weeks[sunday].days[date]);
      const recipeId = record ? K.effectiveRecipeId(record, state) : null;
      const recipe = recipeId ? catalog[recipeId] : null;
      const title = record ? (record.title || (recipe ? recipe.title : 'Dinner')) : 'Nothing planned';
      const counts = state && recipe ? checkedCount(state, recipe) : { done: 0, total: 0 };
      const pressed = session.selectedDate === date;
      const image = recipe ? '<img src="' + K.esc(photoSrc(recipe)) + '" alt="">' : '';
      const swapped = state && state.overrideRecipeId;
      const extra = !recipe ? '<span class="meta">No dinner in the cookbook for this date.</span>'
        : (swapped || recipe.title !== title ? '<span class="meta">' + K.esc(recipe.title) + (swapped ? ' · swapped' : '') + '</span>' : '');
      return '<button type="button" class="day' + (recipe ? '' : ' empty') + '" data-act="select" data-date="' + date + '" aria-pressed="' + pressed + '">' + image + '<div><span class="meta">' + K.esc(K.formatLong(date)) + '</span><strong>' + K.esc(title) + '</strong>' + extra + (counts.total ? '<span class="meta">' + counts.done + ' of ' + counts.total + ' prep tasks</span>' : '') + (state && state.cookedAt ? '<span class="meta">Cooked</span>' : '') + '</div></button>';
    }).join('');
    $('app').innerHTML =
      (recovery ? '<div class="banner" role="alert">' + K.esc(recovery) + '</div>' : '') +
      '<p class="banner"><strong>Saved on this device only.</strong> Download the planner JSON and share that file if Scorpy should read your checks, swaps, notes, or ratings. Keeping them here does not sync another device, and this public page cannot store them for you.</p>' +
      '<p class="lede">' + K.esc(intro) + '</p>' +
      '<div class="row"><button type="button" class="btn-quiet" data-act="prev-week">Previous week</button><strong>' + K.esc(K.formatLong(sunday)) + ' – ' + K.esc(K.formatLong(K.addDays(sunday, 6))) + '</strong><button type="button" class="btn-quiet" data-act="next-week">Next week</button><button type="button" class="btn herb" data-act="published">Published week</button></div>' +
      '<div class="days" id="days">' + cards + '</div>' +
      detailHtml(sunday, week) +
      groceryHtml(sunday, week) +
      historyHtml() +
      savePanel();
    const dayNotes = $('day-notes');
    if (dayNotes) dayNotes.value = (stateFor(session.selectedDate, false) || {}).notes || '';
    const weekNotes = $('week-notes');
    if (weekNotes) weekNotes.value = (session.weeks[sunday] && session.weeks[sunday].notes) || '';
    const preview = $('jsonPreview');
    if (preview) preview.value = JSON.stringify(session, null, 2);
    const stamp = $('savedAt');
    if (stamp) stamp.textContent = 'Saved on this device at ' + new Date(session.updatedAt).toLocaleString() + '. Not sent anywhere.';
  }

  function detailHtml(sunday, week) {
    const date = session.selectedDate;
    const record = dayRecord(week, date);
    const state = stateFor(date, false);
    if (!record || !state) {
      return '<section class="card"><h2>' + K.esc(K.formatLong(date)) + '</h2><p>Nothing is planned. The week file has no dinner for this date, so this page does not invent one.</p><label class="field">Note for this date<textarea id="day-notes" maxlength="' + K.NOTE_MAX + '"></textarea></label></section>';
    }
    const recipeId = K.effectiveRecipeId(record, state);
    const recipe = catalog[recipeId];
    const options = Object.keys(catalog).map(function (id) {
      return '<option value="' + K.esc(id) + '"' + (id === recipeId ? ' selected' : '') + '>' + K.esc(catalog[id].title) + '</option>';
    }).join('');
    const tasks = (recipe ? recipe.tasks : []).map(function (task) {
      const checked = state.tasks[task.id] && state.tasks[task.id].checked;
      return '<label class="check' + (checked ? ' on' : '') + '"><input type="checkbox" data-kind="task" data-id="' + K.esc(task.id) + '"' + (checked ? ' checked' : '') + '><span>' + K.esc(task.label) + '</span></label>';
    }).join('');
    const custom = state.customTasks.map(function (task) {
      return '<label class="check' + (task.checked ? ' on' : '') + '"><input type="checkbox" data-kind="custom" data-id="' + K.esc(task.id) + '"' + (task.checked ? ' checked' : '') + '><span>' + K.esc(task.label) + '</span></label><button type="button" class="btn-quiet" data-act="remove-task" data-id="' + K.esc(task.id) + '">Remove</button>';
    }).join('');
    const stars = [1, 2, 3, 4, 5].map(function (score) {
      return '<button type="button" data-act="rate" data-score="' + score + '" aria-pressed="' + (state.rating === score) + '" aria-label="' + score + ' star' + (score > 1 ? 's' : '') + '">' + score + '</button>';
    }).join('');
    const swapNote = state.overrideRecipeId ? '<p class="meta">The published plan says ' + K.esc(record.title) + '.</p>' : '';
    return '<section class="card"><p class="kicker">' + K.esc(K.formatLong(date)) + '</p><h2>' + K.esc(record.title) + '</h2>' +
      (recipe ? '<div class="frame"><img src="' + K.esc(photoSrc(recipe)) + '" alt="' + K.esc(recipe.photo.alt) + '"></div><p class="caption">' + K.esc(recipe.photo.caption) + '</p><p class="credit">Photo: ' + creditHtml(recipe.photo) + '</p>' : '') +
      '<label class="field">Dinner<select id="swap">' + options + '</select></label>' + swapNote +
      '<label class="field">Servings<input id="servings" inputmode="numeric" value="' + state.servings + '"></label>' +
      '<p class="meta">' + K.esc(recipe ? recipe.summary : '') + '</p>' +
      '<div class="row"><a class="btn herb" href="../recipes/?recipe=' + encodeURIComponent(recipeId) + '">Cook in the recipe app</a><button type="button" class="btn-quiet" data-act="favorite" aria-pressed="' + state.favorite + '">' + (state.favorite ? 'Favorited' : 'Favorite') + '</button><button type="button" class="btn" data-act="cooked">' + (state.cookedAt ? 'Clear cooked mark' : 'Mark cooked') + '</button></div>' +
      '<div class="stars row" role="group" aria-label="Rating">' + stars + '</div>' +
      '<h3 class="group-label">Prep tasks</h3>' + tasks + custom +
      '<div class="row"><input id="new-task" type="text" maxlength="160" placeholder="Add a prep task" aria-label="New prep task"><button type="button" class="btn-quiet" data-act="add-task">Add task</button></div>' +
      '<label class="field">Notes for this dinner<textarea id="day-notes" maxlength="' + K.NOTE_MAX + '"></textarea></label></section>';
  }

  function groceryHtml(sunday, week) {
    if (!week) return '<section class="card"><h2>Grocery checklist</h2><p>No published plan for this week, so there is no grocery list to build. This checklist never orders food.</p></section>';
    const dayStates = {};
    (session.weeks[sunday] ? Object.keys(session.weeks[sunday].days) : []).forEach(function (date) {
      const state = session.weeks[sunday].days[date];
      dayStates[date] = { overrideRecipeId: state.overrideRecipeId, servings: state.servings };
    });
    const list = K.aggregateGrocery(week, catalog, dayStates);
    if (!session.groceryChecked[sunday]) session.groceryChecked[sunday] = {};
    const checks = session.groceryChecked[sunday];
    function rows(items, kind) {
      return items.map(function (item) {
        const checked = !!checks[item.key];
        const pantry = kind === 'pantry'
          ? '<label class="meta">Pantry <select data-pantry="' + K.esc(item.groceryKey) + '"><option value="unsure"' + ((session.pantry[item.groceryKey] || 'unsure') === 'unsure' ? ' selected' : '') + '>Not sure</option><option value="have"' + (session.pantry[item.groceryKey] === 'have' ? ' selected' : '') + '>In the pantry</option><option value="need"' + (session.pantry[item.groceryKey] === 'need' ? ' selected' : '') + '>Need to buy</option></select></label>'
          : '';
        return '<label class="check' + (checked ? ' on' : '') + '"><input type="checkbox" data-kind="grocery" data-key="' + K.esc(item.key) + '"' + (checked ? ' checked' : '') + '><span>' + K.esc(item.label) + '</span></label>' + pantry;
      }).join('');
    }
    const plain = list.unscaled.map(function (item) {
      const checked = !!checks[item.key];
      return '<label class="check' + (checked ? ' on' : '') + '"><input type="checkbox" data-kind="grocery" data-key="' + K.esc(item.key) + '"' + (checked ? ' checked' : '') + '><span>' + K.esc(item.name) + (item.detail ? ' · ' + K.esc(item.detail) : '') + '</span></label>';
    }).join('');
    return '<section class="card"><h2>Grocery checklist</h2><p class="meta">Amounts add up only when the cookbook lists a number and the same unit. Optional kid starch stays in its own list. Nothing here orders food.</p><h3 class="group-label">Shop</h3>' + (rows(list.shop, 'shop') || '<p>No numbered shop items.</p>') + '<h3 class="group-label">Pantry</h3>' + (rows(list.pantry, 'pantry') || '<p>No pantry items.</p>') + '<h3 class="group-label">Optional starch for kids</h3>' + (rows(list.kidsStarch, 'kids') || '<p>No optional starch on this plan.</p>') + (plain ? '<h3 class="group-label">Listed without a sum</h3>' + plain : '') + '<label class="field">Notes for the week<textarea id="week-notes" maxlength="' + K.NOTE_MAX + '"></textarea></label></section>';
  }

  function historyHtml() {
    const rows = [];
    Object.keys(session.weeks).forEach(function (weekId) {
      const days = session.weeks[weekId].days || {};
      Object.keys(days).forEach(function (date) {
        const day = days[date];
        if (!day.cookedAt && !day.favorite && !day.rating) return;
        const recipe = catalog[day.overrideRecipeId || day.plannedRecipeId];
        rows.push({ date: date, day: day, title: recipe ? recipe.title : 'Dinner' });
      });
    });
    rows.sort(function (a, b) { return (b.day.cookedAt || '').localeCompare(a.day.cookedAt || '') || b.date.localeCompare(a.date); });
    const body = rows.length ? rows.map(function (row) {
      const bits = [K.formatLong(row.date), row.title];
      if (row.day.cookedAt) bits.push('cooked ' + new Date(row.day.cookedAt).toLocaleString());
      if (row.day.favorite) bits.push('favorite');
      if (row.day.rating) bits.push(row.day.rating + ' of 5');
      return '<li>' + K.esc(bits.join(' · ')) + '</li>';
    }).join('') : '<li>Nothing is marked cooked, favorited, or rated yet.</li>';
    return '<section class="card"><h2>Cook history</h2><ul>' + body + '</ul><p class="meta">This list is read from the day records in the session file. It is not a second copy.</p></section>';
  }

  function savePanel() {
    return '<section class="card save-panel"><h2>Session file</h2><p class="meta">Session <span id="sessionId">' + K.esc(session.sessionId) + '</span></p><p id="savedAt" class="meta"></p><div class="row"><button type="button" class="btn" data-act="export">Download planner JSON</button><button type="button" class="btn-quiet" data-act="import">Load planner JSON</button><button type="button" class="btn-quiet" data-act="copy">Copy JSON</button><button type="button" class="btn-danger" data-act="reset">Reset this device</button></div><p class="meta">Schema kitchen.planner-session version 1. The daily recipe app keeps a separate file. Scorpy can read this one only after you send it.</p><details><summary>View saved JSON</summary><textarea id="jsonPreview" readonly aria-label="Saved planner session JSON"></textarea></details></section>';
  }

  function ask(title, body, okLabel) {
    $('gateTitle').textContent = title;
    $('gateBody').textContent = body;
    $('gateOk').hidden = !okLabel;
    if (okLabel) $('gateOk').textContent = okLabel;
    $('gateCancel').textContent = okLabel ? 'Cancel' : 'Close';
    $('gate').showModal();
    return new Promise(function (resolve) {
      $('gate').addEventListener('close', function () { resolve($('gate').returnValue === 'ok'); }, { once: true });
    });
  }

  function download() {
    persist();
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'kitchen-planner-session-' + session.sessionId + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    announce('Planner JSON downloaded. It stays on this device until you share the file.');
  }

  async function copyJson() {
    persist();
    const text = JSON.stringify(session, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      announce('Planner JSON copied.');
    } catch (e) {
      const preview = $('jsonPreview');
      if (preview) { preview.parentElement.open = true; preview.focus(); preview.select(); }
      announce('Clipboard is unavailable. The JSON box is selected so you can copy it.');
    }
  }

  async function importFile(file) {
    const text = await file.text();
    let result;
    try { result = K.validatePlannerSession(K.parseSessionJson(text)); }
    catch (error) { result = { ok: false, errors: [error.message] }; }
    if (!result.ok) {
      await ask('That file was not loaded', result.errors.join('\n'));
      return;
    }
    const ok = await ask('Replace this device’s week session?', 'Checks, swaps, notes, ratings, and the session id will be replaced with the file. The daily recipe session is not changed.', 'Replace');
    if (!ok) return;
    session = result.value;
    recovery = '';
    if (!session.viewWeekId) session.viewWeekId = defaultWeekId();
    render();
    persist();
    announce('Planner session loaded.');
  }

  async function resetSession() {
    const ok = await ask('Reset the week plan on this device?', 'Checks, swaps, notes, ratings, and the session id will be cleared. Download a backup first if you want to keep them. The cookbook and the daily recipe session stay as they are.', 'Reset');
    if (!ok) return;
    session = K.emptyPlannerSession(K.newSessionId());
    session.viewWeekId = defaultWeekId();
    recovery = '';
    render();
    persist();
    announce('Week session reset on this device.');
  }

  function onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const act = button.dataset.act;
    if (act === 'select') {
      session.selectedDate = button.dataset.date;
      render();
      persist();
    }
    if (act === 'prev-week' || act === 'next-week') {
      session.viewWeekId = K.addDays(viewSunday(), act === 'next-week' ? 7 : -7);
      session.selectedDate = session.viewWeekId;
      render();
      persist();
    }
    if (act === 'published') {
      session.viewWeekId = defaultWeekId();
      session.selectedDate = null;
      render();
      persist();
    }
    if (act === 'favorite') {
      const state = stateFor(session.selectedDate, true);
      state.favorite = !state.favorite;
      render();
      persist();
    }
    if (act === 'cooked') {
      const state = stateFor(session.selectedDate, true);
      if (state.cookedAt) {
        state.cookedAt = null;
        if (state.status === 'cooked') state.status = 'planned';
      } else {
        state.cookedAt = new Date().toISOString();
        state.status = 'cooked';
      }
      render();
      persist();
    }
    if (act === 'rate') {
      const state = stateFor(session.selectedDate, true);
      const score = Number(button.dataset.score);
      state.rating = state.rating === score ? null : score;
      render();
      persist();
    }
    if (act === 'add-task') {
      const input = $('new-task');
      const label = (input.value || '').trim();
      if (!label) return;
      const state = stateFor(session.selectedDate, true);
      state.customTasks.push({ id: K.newTaskId(), label: label.slice(0, 160), checked: false });
      render();
      persist();
    }
    if (act === 'remove-task') {
      const state = stateFor(session.selectedDate, true);
      state.customTasks = state.customTasks.filter(function (task) { return task.id !== button.dataset.id; });
      render();
      persist();
    }
    if (act === 'export') download();
    if (act === 'import') $('file').click();
    if (act === 'copy') copyJson();
    if (act === 'reset') resetSession();
  }

  function onChange(event) {
    const input = event.target;
    if (input.dataset.kind === 'task' || input.dataset.kind === 'custom' || input.dataset.kind === 'grocery') {
      const state = stateFor(session.selectedDate, true);
      if (input.dataset.kind === 'task') state.tasks[input.dataset.id].checked = input.checked;
      if (input.dataset.kind === 'custom') {
        const task = state.customTasks.find(function (item) { return item.id === input.dataset.id; });
        if (task) task.checked = input.checked;
      }
      if (input.dataset.kind === 'grocery') {
        const sunday = viewSunday();
        if (!session.groceryChecked[sunday]) session.groceryChecked[sunday] = {};
        session.groceryChecked[sunday][input.dataset.key] = input.checked;
      }
      input.closest('.check').classList.toggle('on', input.checked);
      persist();
    }
    if (input.id === 'swap') {
      const state = stateFor(session.selectedDate, true);
      state.overrideRecipeId = input.value === state.plannedRecipeId ? null : input.value;
      const recipe = catalog[input.value];
      if (recipe) recipe.tasks.forEach(function (task) {
        if (!state.tasks[task.id]) state.tasks[task.id] = { checked: false };
      });
      render();
      persist();
    }
    if (input.dataset.pantry) {
      session.pantry[input.dataset.pantry] = input.value;
      persist();
    }
    if (input.id === 'servings') {
      const value = parseInt(input.value, 10);
      if (!Number.isInteger(value)) return;
      stateFor(session.selectedDate, true).servings = Math.min(24, Math.max(1, value));
      render();
      persist();
    }
  }

  function onInput(event) {
    if (event.target.id === 'day-notes') {
      stateFor(session.selectedDate, true).notes = event.target.value.slice(0, K.NOTE_MAX);
      persist();
    }
    if (event.target.id === 'week-notes') {
      const sunday = viewSunday();
      if (!session.weeks[sunday]) session.weeks[sunday] = { notes: '', days: {} };
      session.weeks[sunday].notes = event.target.value.slice(0, K.NOTE_MAX);
      persist();
    }
  }

  async function boot() {
    const responses = await Promise.all([
      fetch('../recipes/data/recipes.json', { cache: 'no-cache' }),
      fetch('data/weeks.json', { cache: 'no-cache' })
    ]);
    if (responses.some(function (response) { return !response.ok; })) throw new Error('plan');
    const recipesDoc = await responses[0].json();
    weeksDoc = await responses[1].json();
    recipesDoc.recipes.forEach(function (item) { catalog[item.id] = item; });
    session = loadSession();
    if (!session.viewWeekId) session.viewWeekId = defaultWeekId();
    render();
    persist();
    document.body.addEventListener('click', onClick);
    document.body.addEventListener('change', onChange);
    document.body.addEventListener('input', onInput);
    $('file').addEventListener('change', function () {
      const file = $('file').files && $('file').files[0];
      $('file').value = '';
      if (file) importFile(file);
    });
  }

  boot().catch(function () {
    $('app').innerHTML = '<p class="banner" role="alert">The week plan could not be loaded. Check the connection and reopen this page.</p>';
  });
})();
