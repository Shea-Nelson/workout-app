/* Webhook queue and the words the page shows for Save, Finish, and Send test.
   Classic script in the browser (window.WorkoutSync) and CommonJS in tests.
   Posted bodies stay the payload from WorkoutWeek.buildPayload. Queue wrappers
   are local only and are never sent. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WorkoutSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* Hosts checked from this app: their preflight answer has no
     Access-Control-Allow-Origin for a GitHub Pages origin, so the browser
     never sends the POST. */
  const CURSOR_API_HOSTS = {
    'api2.cursor.sh': true,
    'api.cursor.com': true
  };

  function validateWebhookUrl(raw) {
    let url = String(raw || '').trim().replace(/^[`'"]+|[`'"]+$/g, '').trim();
    url = url.replace(/\s+/g, '');
    if (!url) return { ok: false, url: '', code: 'empty' };
    let parsed;
    try { parsed = new URL(url); }
    catch (e) { return { ok: false, url: url, code: 'bad' }; }
    const local = parsed.hostname === 'localhost' || parsed.hostname.indexOf('127.') === 0;
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && local)) {
      return { ok: true, url: url, code: '' };
    }
    return { ok: false, url: url, code: 'https' };
  }

  function urlError(code) {
    if (code === 'empty') return 'Enter the webhook URL first. Nothing was saved.';
    if (code === 'https') return 'The URL must start with https://. Nothing was saved.';
    return 'That URL could not be read. Nothing was saved.';
  }

  function maskSecret(value) {
    const s = String(value || '');
    if (!s) return '';
    if (s.length <= 8) return '••••';
    return '••••' + s.slice(-4);
  }

  function hostOf(url) {
    try { return new URL(url).host; }
    catch (e) { return ''; }
  }

  function isCursorApiHost(url) {
    return CURSOR_API_HOSTS[hostOf(url)] === true;
  }

  function saveNote(url, hasKey) {
    let note = 'Saved. This phone will send workout logs to that webhook.';
    note += hasKey ? ' The key is hidden.' : ' No key was entered.';
    if (isCursorApiHost(url)) {
      note += ' This address only allows browser calls from cursor.com, so this page can be blocked before the webhook sees the log. Tap Send test to check.';
    }
    return note;
  }

  function configuredNote(url, auth) {
    if (!url) return 'No webhook is saved on this device yet. Paste the URL and the Authorization header value, then tap Save.';
    const keyBit = auth ? (' Key saved (' + maskSecret(auth) + ').') : ' No key saved.';
    return 'A webhook is configured on this device.' + keyBit;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') return null;
    if (item.body && typeof item.body === 'object' && item.body.event) {
      return { id: String(item.id || ''), body: item.body };
    }
    if (item.event) return { id: '', body: item };
    return null;
  }

  function normalizeQueue(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const out = [];
    list.forEach(function (item) {
      const n = normalizeItem(item);
      if (n) out.push(n);
    });
    return out;
  }

  function enqueue(queue, body, limit) {
    const cap = limit || 40;
    let next = normalizeQueue(queue);
    if (body && body.event === 'finished') {
      next = next.filter(function (item) {
        return !(item.body.event === 'finished' && item.body.workoutId === body.workoutId);
      });
    }
    next.push({ id: uid(), body: body });
    while (next.length > cap) {
      const setIdx = next.findIndex(function (item) { return item.body.event === 'set'; });
      if (setIdx >= 0) next.splice(setIdx, 1);
      else next.shift();
    }
    return next;
  }

  /* Drop the item that was posted. If a newer copy replaced it while the
     request was in flight, leave the newer copy in the queue. */
  function dropSent(queue, sent) {
    const next = normalizeQueue(queue);
    if (!sent) return next;
    if (sent.id) {
      const byId = next.findIndex(function (item) { return item.id === sent.id; });
      if (byId >= 0) next.splice(byId, 1);
      return next;
    }
    const sentJson = JSON.stringify(sent.body);
    const byBody = next.findIndex(function (item) { return JSON.stringify(item.body) === sentJson; });
    if (byBody >= 0) next.splice(byBody, 1);
    return next;
  }

  function safeDetail(detail, secret) {
    let s = String(detail || '').replace(/\s+/g, ' ').trim();
    if (!s || s.charAt(0) === '<') return '';
    const raw = String(secret || '');
    if (raw) {
      s = s.split(raw).join('…');
      const bearer = raw.replace(/^Bearer\s+/i, '');
      if (bearer && bearer !== raw) s = s.split(bearer).join('…');
    }
    s = s.replace(/Bearer\s+\S+/gi, 'Bearer …');
    return s.slice(0, 160);
  }

  function explainSendFailure(result, url, origin) {
    const host = hostOf(url);
    const where = origin || 'this website';
    if (!result || result.kind === 'timeout') {
      return 'The webhook did not answer in time. The log is saved on this phone. Tap Retry.';
    }
    if (result.kind === 'http') {
      const extra = result.detail ? ' ' + result.detail : '';
      if (result.status === 401) {
        return 'The webhook rejected the key (HTTP 401). Open Settings, paste the Authorization header value again, and tap Send test.' + extra;
      }
      if (result.status === 403) return 'The webhook refused the log (HTTP 403).' + extra;
      if (result.status === 404) return 'The webhook URL was not found (HTTP 404). Check the URL in Settings.';
      return 'The webhook returned HTTP ' + result.status + '.' + extra;
    }
    if (result.online === false) {
      return 'This phone is offline. The log is saved here and will send when you are back online.';
    }
    if (isCursorApiHost(url)) {
      return 'The browser blocked the send to ' + host + ' before it left this phone. That server only allows browser calls from cursor.com, and this page is ' + where + '. The log is saved on this phone. The webhook did not receive it.';
    }
    return 'The browser blocked the send' + (host ? ' to ' + host : '') + ' before it left this phone. The webhook has to allow ' + where + ' to POST JSON with an Authorization header. The log is saved on this phone. Tap Retry or Send test.';
  }

  function testPayload(iso) {
    const sent = iso || new Date().toISOString();
    return {
      event: 'test',
      date: sent.slice(0, 10),
      workout: 'Connection test',
      workoutId: 'connection-test',
      sentAt: sent,
      note: 'Test from the workout app settings. No workout was logged.'
    };
  }

  function finishSummary(day, counts) {
    const when = (day && (day.dateLabel || day.date)) || 'This workout';
    const title = (day && day.title) || '';
    const head = title ? (when + ' · ' + title) : when;
    const c = counts || { d: 0, tot: 0, sk: 0 };
    return head + '. ' + c.d + ' of ' + c.tot + ' sets done' + (c.sk ? ', ' + c.sk + ' skipped.' : '.');
  }

  function syncMessage(opts) {
    const url = opts && opts.url;
    const pending = opts && opts.pending || 0;
    const error = opts && opts.error || '';
    if (!url) {
      return {
        kind: 'setup',
        text: 'Webhook is not set up, so nothing was sent. This workout is saved on this phone.'
      };
    }
    if (error) {
      return {
        kind: 'bad',
        text: error + (pending ? ' ' + pending + (pending === 1 ? ' update is' : ' updates are') + ' still waiting on this phone.' : '')
      };
    }
    if (pending) {
      return {
        kind: 'info',
        text: pending + (pending === 1 ? ' update is' : ' updates are') + ' waiting to send. They stay on this phone until the webhook accepts them.'
      };
    }
    return { kind: 'ok', text: 'Sent to your webhook.' };
  }

  return {
    validateWebhookUrl: validateWebhookUrl,
    urlError: urlError,
    maskSecret: maskSecret,
    hostOf: hostOf,
    isCursorApiHost: isCursorApiHost,
    saveNote: saveNote,
    configuredNote: configuredNote,
    normalizeQueue: normalizeQueue,
    enqueue: enqueue,
    dropSent: dropSent,
    safeDetail: safeDetail,
    explainSendFailure: explainSendFailure,
    testPayload: testPayload,
    finishSummary: finishSummary,
    syncMessage: syncMessage
  };
});
