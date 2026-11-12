/* Browser checks for Save, Finish, and the webhook POST.
   Run: node tests/browser-sync.mjs
   Serves this repo on 127.0.0.1 and posts to a local webhook, never a real one.
   No URL or key from this file is a credential. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = '/tmp/workout-shots';
fs.mkdirSync(shots, { recursive: true });

const KEY = 'Bearer test-key-1234';
const SECRET = 'zz-secret-token';

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json';
  if (file.endsWith('.webmanifest')) return 'application/manifest+json';
  if (file.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function startStatic() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('missing'); return;
    }
    res.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function startHook({ cors, onPost }) {
  const hits = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const hit = {
        method: req.method,
        auth: req.headers.authorization || '',
        type: req.headers['content-type'] || '',
        origin: req.headers.origin || '',
        body: Buffer.concat(chunks).toString('utf8')
      };
      hits.push(hit);
      if (cors && hit.origin) {
        res.setHeader('Access-Control-Allow-Origin', hit.origin);
        res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') { res.writeHead(cors ? 204 : 204); res.end(); return; }
      const decided = onPost ? onPost(hit, hits) : { status: 200, body: '{"ok":true}' };
      res.writeHead(decided.status, { 'Content-Type': 'application/json' });
      res.end(decided.body || '');
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    resolve({ server, hits, url: 'http://127.0.0.1:' + port + '/hook' });
  }));
}

function phone() {
  return {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  };
}

async function openApp(context, app) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(app + '/?asof=2026-11-11', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /Wed/.test(document.getElementById('finish').textContent));
  return { page, errors };
}

async function saveWebhook(page, url, key) {
  await page.locator('#gear').click();
  await page.locator('#overlay').waitFor({ state: 'visible' });
  await page.fill('#sUrl', url);
  await page.fill('#sAuth', key);
  await page.locator('#sSave').click();
  await page.waitForFunction(() => document.getElementById('sMsg').textContent.startsWith('Saved'));
}

const failures = [];
function check(name, cond, detail) {
  if (cond) console.log('ok  ' + name);
  else { console.error('FAIL ' + name + (detail ? ' — ' + detail : '')); failures.push(name); }
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const appServer = await startStatic();
const app = 'http://127.0.0.1:' + appServer.address().port;

try {
  // Phone: Save stays on screen, persists, and reopen masks the key.
  {
    const context = await browser.newContext(phone());
    const { page, errors } = await openApp(context, app);
    await saveWebhook(page, 'https://example.invalid/hook', KEY);
    const msg = await page.locator('#sMsg').innerText();
    check('phone save says Saved', msg.startsWith('Saved'), msg);
    check('phone settings stay open', await page.locator('#overlay').isVisible());
    const box = await page.locator('#sMsg').boundingBox();
    check('phone Saved is on screen', box && box.y >= 0 && box.y < 844, JSON.stringify(box));
    await page.screenshot({ path: path.join(shots, 'phone-saved.png') });
    const stored = await page.evaluate(() => ({
      url: localStorage.getItem('wk.webhookUrl'),
      auth: localStorage.getItem('wk.authHeader')
    }));
    check('phone localStorage keeps url and key', stored.url === 'https://example.invalid/hook' && stored.auth === KEY);
    await page.locator('#sUrl').fill('http://example.com/nope');
    await page.locator('#sSave').click();
    const bad = await page.locator('#sMsg').innerText();
    check('bad url is visible and unsaved', /Nothing was saved/.test(bad), bad);
    const still = await page.evaluate(() => localStorage.getItem('wk.webhookUrl'));
    check('bad url does not replace the saved one', still === 'https://example.invalid/hook');
    await page.locator('#sClose').click();
    await page.locator('#gear').click();
    const again = await page.locator('#sMsg').innerText();
    check('reopen says configured', /configured/.test(again), again);
    check('reopen masks the key', /••••1234/.test(again) && !again.includes(KEY), again);
    check('key field is empty', (await page.locator('#sAuth').inputValue()) === '');
    check('url field is filled', (await page.locator('#sUrl').inputValue()) === 'https://example.invalid/hook');
    const html = await page.locator('#overlay').innerHTML();
    check('open settings HTML hides the key', !html.includes(KEY));
    await page.screenshot({ path: path.join(shots, 'phone-reopen.png') });
    check('no page errors on save', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // Phone: Finish with no webhook still saves and says so.
  {
    const context = await browser.newContext(phone());
    const { page, errors } = await openApp(context, app);
    await page.locator('#finish').click();
    await page.waitForFunction(() => !document.getElementById('donePanel').classList.contains('hidden'));
    const sync = await page.locator('#doneSync').innerText();
    const summary = await page.locator('#doneSummary').innerText();
    check('finish without webhook explains that', /not set up/.test(sync) && /saved on this phone/i.test(sync), sync);
    check('finish summary names the day', /Wed Nov 11/.test(summary) && /Upper Body/.test(summary), summary);
    check('settings action is visible', await page.locator('#doneSettings').isVisible());
    const saved = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('wk.log.2026-11-11-upper'));
      const queue = JSON.parse(localStorage.getItem('wk.queue') || '[]');
      return { finished: state && state.finished, events: queue.map(item => (item.body || item).event) };
    });
    check('finish is stored locally and queued', saved.finished === true && saved.events.includes('finished'), JSON.stringify(saved));
    await page.screenshot({ path: path.join(shots, 'phone-finish-unset.png') });
    check('no page errors without webhook', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // Desktop: a webhook that allows this origin receives the JSON and the header.
  {
    const hook = await startHook({
      cors: true,
      onPost: () => ({ status: 200, body: '{"ok":true}' })
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const { page, errors } = await openApp(context, app);
    await saveWebhook(page, hook.url, KEY);
    await page.locator('#sClose').click();
    await page.locator('[data-chk="1,0"]').click();
    await page.locator('#finish').click();
    await page.waitForFunction(() => /Sent to your webhook/.test(document.getElementById('doneSync').textContent), null, { timeout: 10000 });
    const posts = hook.hits.filter(hit => hit.method === 'POST').map(hit => ({ auth: hit.auth, type: hit.type, body: JSON.parse(hit.body) }));
    const finished = posts.find(hit => hit.body.event === 'finished');
    check('desktop finish says sent', /Sent to your webhook/.test(await page.locator('#doneSync').innerText()));
    check('webhook got the finished log', !!finished, JSON.stringify(posts.map(p => p.body.event)));
    check('Authorization header is the pasted value', finished && finished.auth === KEY, finished && finished.auth);
    check('body is JSON with the workout', finished && finished.type.includes('application/json') && finished.body.workout === 'Upper Body' && finished.body.date === '2026-11-11' && Array.isArray(finished.body.exercises));
    check('a done set is in the log', finished && finished.body.exercises.some(ex => ex.sets.some(set => set.done)));
    const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('wk.queue') || '[]'));
    check('queue is empty after a confirmed send', queued.length === 0, JSON.stringify(queued));
    await page.screenshot({ path: path.join(shots, 'desktop-sent.png') });
    check('no page errors on send', errors.length === 0, errors.join(' | '));
    await context.close();
    await new Promise(resolve => hook.server.close(resolve));
  }

  // Phone: preflight without Allow-Origin never delivers the POST, and the page says so.
  {
    const hook = await startHook({ cors: false, onPost: () => ({ status: 200, body: '{"ok":true}' }) });
    const context = await browser.newContext(phone());
    const { page, errors } = await openApp(context, app);
    await saveWebhook(page, hook.url, KEY);
    await page.locator('#sClose').click();
    await page.locator('#finish').click();
    await page.waitForFunction(() => /blocked the send/i.test(document.getElementById('doneSync').textContent), null, { timeout: 10000 });
    const sync = await page.locator('#doneSync').innerText();
    const posts = hook.hits.filter(hit => hit.method === 'POST');
    const options = hook.hits.filter(hit => hit.method === 'OPTIONS');
    check('blocked finish says the browser stopped it', /blocked the send/i.test(sync) && /saved on this phone/i.test(sync), sync);
    check('retry is visible', await page.locator('#doneRetry').isVisible());
    check('preflight was the only call', options.length >= 1 && posts.length === 0, 'options ' + options.length + ' posts ' + posts.length);
    const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('wk.queue') || '[]').length);
    check('blocked log stays queued', queued >= 1, String(queued));
    await page.screenshot({ path: path.join(shots, 'phone-blocked.png') });
    check('no page errors on blocked send', errors.length === 0, errors.join(' | '));
    await context.close();
    await new Promise(resolve => hook.server.close(resolve));
  }

  // Phone: HTTP 401 is shown, the key is not echoed, and Retry can then succeed.
  {
    let posts = 0;
    const hook = await startHook({
      cors: true,
      onPost: (hit) => {
        if (hit.body.includes('"event":"test"') || hit.body.includes('"event": "test"')) {
          return { status: 401, body: 'rejected ' + SECRET };
        }
        posts += 1;
        return posts === 1
          ? { status: 500, body: 'unavailable ' + SECRET }
          : { status: 200, body: '{"ok":true}' };
      }
    });
    const context = await browser.newContext(phone());
    const { page, errors } = await openApp(context, app);
    await page.locator('#gear').click();
    await page.fill('#sUrl', hook.url);
    await page.fill('#sAuth', 'Bearer ' + SECRET);
    await page.locator('#sTest').click();
    await page.waitForFunction(() => /HTTP 401/.test(document.getElementById('sMsg').textContent), null, { timeout: 10000 });
    const testMsg = await page.locator('#sMsg').innerText();
    check('send test shows HTTP 401', /Saved/.test(testMsg) && /HTTP 401/.test(testMsg), testMsg);
    check('send test does not echo the key', !testMsg.includes(SECRET), testMsg);
    await page.locator('#sClose').click();
    await page.locator('#finish').click();
    await page.waitForFunction(() => /HTTP 500/.test(document.getElementById('doneSync').textContent), null, { timeout: 10000 });
    const failed = await page.locator('#doneSync').innerText();
    check('finish shows HTTP 500 and keeps the log', /HTTP 500/.test(failed) && /waiting on this phone/.test(failed), failed);
    check('failure text hides the key', !failed.includes(SECRET));
    await page.locator('#doneRetry').click();
    await page.waitForFunction(() => /Sent to your webhook/.test(document.getElementById('doneSync').textContent), null, { timeout: 10000 });
    check('retry sends the queued log', /Sent to your webhook/.test(await page.locator('#doneSync').innerText()));
    const finished = hook.hits.filter(hit => hit.method === 'POST' && hit.body.includes('"finished"'));
    check('retry delivered Authorization and finished', finished.some(hit => hit.auth === 'Bearer ' + SECRET));
    await page.screenshot({ path: path.join(shots, 'phone-retry.png') });
    check('no page errors on retry', errors.length === 0, errors.join(' | '));
    await context.close();
    await new Promise(resolve => hook.server.close(resolve));
  }
} finally {
  await new Promise(resolve => appServer.close(resolve));
  await browser.close();
}

if (failures.length) {
  console.error(failures.length + ' failed');
  process.exit(1);
}
console.log('browser checks passed');
