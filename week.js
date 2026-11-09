/* Week plan: pick today's strength workout, and build the Finish payload.
   Classic script in the browser (window.WorkoutWeek) and CommonJS in tests.
   The webhook contract is buildPayload. Keep its keys stable. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WorkoutWeek = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Workout file is empty');
    if (Array.isArray(raw.days)) {
      const days = raw.days.filter(function (d) {
        return d && Array.isArray(d.exercises) && d.exercises.length;
      }).slice().sort(function (a, b) {
        return String(a.date).localeCompare(String(b.date));
      });
      if (!days.length) throw new Error('Week file has no workouts');
      return {
        schema: 'workout.week',
        schemaVersion: raw.schemaVersion || 1,
        weekStart: raw.weekStart || days[0].date || '',
        weekEnd: raw.weekEnd || '',
        timezone: raw.timezone || 'America/New_York',
        title: raw.title || '',
        schedule: raw.schedule || null,
        days: days,
        legacy: false
      };
    }
    if (Array.isArray(raw.exercises)) {
      return {
        schema: 'workout.week',
        schemaVersion: 1,
        weekStart: raw.date || '',
        weekEnd: raw.date || '',
        timezone: 'America/New_York',
        title: raw.title || '',
        schedule: null,
        days: [raw],
        legacy: true
      };
    }
    throw new Error('Workout file is not a week or a single day');
  }

  /* today is YYYY-MM-DD. Strength days are the entries. Rest days are everything else. */
  function pickDay(days, today) {
    const dates = days.map(function (d) { return d.date; });
    const exact = dates.indexOf(today);
    if (exact >= 0) return { index: exact, reason: 'today' };
    const next = dates.findIndex(function (d) { return d > today; });
    if (next >= 0) return { index: next, reason: 'upcoming' };
    return { index: Math.max(0, days.length - 1), reason: 'past' };
  }

  function nyToday(date, timeZone) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date || new Date());
  }

  function weekdayLong(iso, timeZone) {
    const m = DATE_RE.exec(iso || '');
    if (!m) return iso || '';
    const utc = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 17, 0, 0));
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'America/New_York',
      weekday: 'long'
    }).format(utc);
  }

  function formatTime(hhmm) {
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '');
    if (!m) return '';
    const h = Number(m[1]);
    const hr = h % 12 || 12;
    return hr + ':' + m[2] + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  function restMessage(today, day, reason) {
    if (reason === 'today' || !day) return '';
    const todayName = weekdayLong(today);
    const shown = day.dateLabel || day.date;
    const when = day.timeLabel || formatTime(day.time || '');
    if (reason === 'upcoming') {
      return 'Today is ' + todayName + ', a rest or treadmill day. Next strength workout is ' +
        shown + (when ? ' at ' + when : '') + ' (' + day.title + ').';
    }
    return 'Today is ' + todayName + ', a rest or treadmill day. This week\'s strength workouts are finished. Showing ' + shown + '.';
  }

  function legacyMismatch(today, day) {
    if (!day || !today || day.date === today) return '';
    return 'Today is ' + weekdayLong(today) + '. This file has one workout, for ' +
      (day.dateLabel || day.date) + '. Showing that workout.';
  }

  function isBodyweight(exercise) {
    return !exercise.weight;
  }

  function freshState(day) {
    return {
      finished: false,
      ex: day.exercises.map(function (e) {
        return {
          skipped: false,
          note: '',
          sets: Array.from({ length: e.sets }, function () {
            return { weight: e.weight ? e.weight : '', reps: e.reps ?? '', done: false };
          })
        };
      })
    };
  }

  function stateFits(day, state) {
    if (!state || !Array.isArray(state.ex) || state.ex.length !== day.exercises.length) return false;
    return day.exercises.every(function (e, i) {
      return state.ex[i] && Array.isArray(state.ex[i].sets) && state.ex[i].sets.length === e.sets;
    });
  }

  function counts(state) {
    let tot = 0, d = 0, sk = 0;
    (state.ex || []).forEach(function (x) {
      if (x.skipped) { sk += (x.sets || []).length; return; }
      (x.sets || []).forEach(function (s) { tot += 1; if (s.done) d += 1; });
    });
    return { tot: tot, d: d, sk: sk };
  }

  function exercisesOut(day, state) {
    return day.exercises.map(function (e, i) {
      const s = state.ex[i];
      return {
        id: e.id,
        name: e.name,
        plannedWeight: e.weight,
        plannedReps: e.reps,
        skipped: s.skipped,
        note: s.note || '',
        sets: s.sets.map(function (x, j) {
          return {
            set: j + 1,
            weight: isBodyweight(e) ? 0 : (x.weight === '' ? null : x.weight),
            reps: x.reps === '' ? null : x.reps,
            done: x.done
          };
        })
      };
    });
  }

  /* Same keys the app has always posted. extras (finishedAt, log, exercise, set) sit
     between the header and exercises, and cannot replace the exercises array. */
  function buildPayload(day, state, event, extra, sentAt) {
    return Object.assign({
      event: event,
      date: day.date,
      workout: day.title,
      workoutId: day.id || day.date,
      sentAt: sentAt
    }, extra || {}, { exercises: exercisesOut(day, state) });
  }

  function logText(day, state) {
    const c = counts(state);
    const lines = [
      day.title + ' · ' + (day.dateLabel || day.date) + ' · ' + (day.id || day.date),
      c.d + ' of ' + c.tot + ' sets done' + (c.sk ? ', ' + c.sk + ' skipped' : ''),
      ''
    ];
    day.exercises.forEach(function (e, i) {
      const s = state.ex[i];
      if (s.skipped) {
        lines.push('• ' + e.name + ': skipped' + (s.note ? ' (' + s.note + ')' : ''));
        return;
      }
      const done = s.sets.filter(function (x) { return x.done; });
      lines.push('• ' + e.name + ': ' + (done.length
        ? done.map(function (x) {
          return isBodyweight(e) ? ((x.reps ?? '?') + ' reps') : ((x.weight ?? '?') + ' lb × ' + (x.reps ?? '?'));
        }).join(', ')
        : 'not done'));
    });
    return lines.join('\n');
  }

  return {
    normalize: normalize,
    pickDay: pickDay,
    nyToday: nyToday,
    weekdayLong: weekdayLong,
    formatTime: formatTime,
    restMessage: restMessage,
    legacyMismatch: legacyMismatch,
    isBodyweight: isBodyweight,
    freshState: freshState,
    stateFits: stateFits,
    counts: counts,
    exercisesOut: exercisesOut,
    buildPayload: buildPayload,
    logText: logText
  };
});
