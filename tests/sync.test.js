const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../sync.js');

test('webhook URL is checked without storing it', () => {
  assert.equal(S.validateWebhookUrl('  https://example.com/hook  ').ok, true);
  assert.equal(S.validateWebhookUrl('"https://example.com/hook"').url, 'https://example.com/hook');
  assert.equal(S.validateWebhookUrl('http://127.0.0.1:9/hook').ok, true);
  assert.equal(S.validateWebhookUrl('http://example.com/hook').code, 'https');
  assert.equal(S.validateWebhookUrl('').code, 'empty');
  assert.equal(S.validateWebhookUrl('not a url').code, 'bad');
  assert.match(S.urlError('https'), /Nothing was saved/);
});

test('the key is masked and never shortened to the secret itself', () => {
  assert.equal(S.maskSecret(''), '');
  assert.equal(S.maskSecret('short'), '••••');
  assert.equal(S.maskSecret('Bearer test-key-1234'), '••••1234');
  assert.equal(S.maskSecret('Bearer test-key-1234').includes('test-key'), false);
});

test('save and reopen copy say Saved and that a webhook is configured', () => {
  const note = S.saveNote('https://example.com/hook', true);
  assert.match(note, /^Saved\./);
  assert.match(note, /key is hidden/);
  assert.match(S.configuredNote('https://example.com/hook', 'Bearer test-key-1234'), /configured/);
  assert.match(S.configuredNote('https://example.com/hook', 'Bearer test-key-1234'), /••••1234/);
  assert.equal(S.configuredNote('', '').includes('Bearer'), false);
  assert.match(S.configuredNote('', ''), /relay address is filled in/);
  assert.match(S.saveNote('https://api2.cursor.sh/v1/channels/log', true), /cursor\.com/);
  assert.equal(S.isCursorApiHost('https://api.cursor.com/v1/channels/log'), true);
  assert.equal(S.isCursorApiHost('https://example.com/hook'), false);
});

test('the default relay is offered when nothing usable is saved', () => {
  const relay = S.DEFAULT_RELAY_URL;
  assert.equal(S.isDefaultRelayUrl(relay), true);
  assert.equal(S.isDefaultRelayUrl(relay + '/'), true);
  assert.equal(S.isDefaultRelayUrl('https://example.com/hook'), false);
  assert.equal(S.suggestedWebhookUrl(''), relay);
  assert.equal(S.suggestedWebhookUrl('https://api2.cursor.sh/automations/webhook/demo'), relay);
  assert.equal(S.suggestedWebhookUrl('https://example.com/hook'), 'https://example.com/hook');
  assert.equal(S.authKeptOnSave(relay, '', 'Bearer leftover'), '');
  assert.equal(S.authKeptOnSave(relay, 'Bearer typed-key-1234', 'Bearer leftover'), 'Bearer typed-key-1234');
  assert.equal(S.authKeptOnSave('https://example.com/hook', '', 'Bearer leftover'), 'Bearer leftover');
  assert.match(S.saveNote(relay, false), /No key is needed/);
  assert.match(S.configuredNote(relay, ''), /No key is needed for the relay/);
  assert.match(S.configuredNote(relay, 'Bearer leftover'), /drop the leftover key/);
});

test('unsent logs stay queued and a newer finish replaces the old one', () => {
  const setA = { event: 'set', workoutId: 'd1', set: 1 };
  const setB = { event: 'set', workoutId: 'd1', set: 2 };
  const fin1 = { event: 'finished', workoutId: 'd1', log: 'first' };
  const fin2 = { event: 'finished', workoutId: 'd1', log: 'second' };
  let q = S.enqueue([], setA);
  q = S.enqueue(q, setB);
  q = S.enqueue(q, fin1);
  q = S.enqueue(q, fin2);
  assert.deepEqual(q.map(item => item.body), [setA, setB, fin2]);
  const legacy = S.normalizeQueue([setA, { id: 'keep', body: fin2 }]);
  assert.equal(legacy[0].body, setA);
  assert.equal(legacy[1].id, 'keep');
  const after = S.dropSent(q, q[0]);
  assert.equal(after.length, 2);
  assert.equal(after[0].body, setB);
  const replaced = S.enqueue(q, { event: 'finished', workoutId: 'd1', log: 'third' });
  assert.equal(S.dropSent(replaced, q[2]).some(item => item.body.log === 'third'), true);
});

test('queue cap drops old set events before a finished log', () => {
  let q = [];
  for (let i = 0; i < 5; i++) q = S.enqueue(q, { event: 'set', workoutId: 'd', set: i });
  q = S.enqueue(q, { event: 'finished', workoutId: 'd', log: 'end' }, 4);
  assert.equal(q.length, 4);
  assert.equal(q[q.length - 1].body.event, 'finished');
  assert.equal(q.some(item => item.body.set === 0), false);
});

test('send errors are plain and do not echo the key', () => {
  const secret = 'Bearer super-secret-value';
  const detail = S.safeDetail('nope Bearer super-secret-value <ignored>', secret);
  assert.equal(detail.includes('super-secret'), false);
  const denied = S.explainSendFailure({ kind: 'http', status: 401, detail: detail }, 'https://example.com/hook', 'https://shea-nelson.github.io');
  assert.match(denied, /HTTP 401/);
  assert.equal(denied.includes('super-secret'), false);
  const blocked = S.explainSendFailure(
    { kind: 'network', online: true },
    'https://api2.cursor.sh/v1/channels/log',
    'https://shea-nelson.github.io'
  );
  assert.match(blocked, /did not receive it/);
  assert.match(blocked, /saved on this phone/);
  const offline = S.explainSendFailure({ kind: 'network', online: false }, 'https://example.com/hook', 'https://shea-nelson.github.io');
  assert.match(offline, /offline/);
  const other = S.explainSendFailure({ kind: 'network', online: true }, 'https://hooks.example/log', 'https://shea-nelson.github.io');
  assert.match(other, /Authorization header/);
  assert.match(other, /saved on this phone/);
});

test('a test payload is small and a finish summary names the day', () => {
  const body = S.testPayload('2026-11-12T16:00:00.000Z');
  assert.equal(body.event, 'test');
  assert.equal(body.date, '2026-11-12');
  assert.equal(body.workoutId, 'connection-test');
  assert.equal('exercises' in body, false);
  const line = S.finishSummary({ dateLabel: 'Wed Nov 11', title: 'Upper Body' }, { d: 1, tot: 22, sk: 0 });
  assert.match(line, /Wed Nov 11 · Upper Body/);
  assert.match(line, /1 of 22 sets done/);
  assert.equal(S.syncMessage({ url: '', pending: 1 }).kind, 'setup');
  assert.equal(S.syncMessage({ url: 'https://example.com', pending: 0, error: '' }).text, 'Sent to your webhook.');
  assert.equal(S.syncMessage({ url: 'https://example.com', pending: 2, error: 'HTTP 500.' }).kind, 'bad');
});

test('the public page has no webhook URL or key in source', () => {
  const root = path.join(__dirname, '..');
  const files = ['index.html', 'sync.js', 'week.js', 'sw.js', 'README.md'];
  files.forEach(name => {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    assert.equal(/Bearer\s+[A-Za-z0-9._\-]{12,}/.test(text), false, name);
    assert.equal(/api2\.cursor\.sh\/\S+/.test(text), false, name);
    assert.equal(/hooks\.slack\.com|webhook\.site|ngrok/.test(text), false, name);
  });
});
