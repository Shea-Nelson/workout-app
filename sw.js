const CACHE='wk-v12';
const SHELL=['./','index.html','manifest.webmanifest','workout.json','week.js','sync.js','demos.js','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
// Network-first for same-origin GETs (so a new workout.json shows up right away), cache fallback offline.
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin) return;
  // These paths are redirect stubs for apps that moved to their own repos; never cache them.
  if(/\/(recipes|planner|shopping|kitchen|bible|lesson|grok-lessons|family-time|games|hub|shelf)(\/|$)/.test(u.pathname)) return;
  e.respondWith(fetch(e.request).then(r=>{const key=u.pathname.endsWith('workout.json')?'workout.json':e.request; const cp=r.clone(); caches.open(CACHE).then(c=>c.put(key,cp)); return r;})
    .catch(()=>caches.match(u.pathname.endsWith('workout.json')?'workout.json':e.request).then(r=>r||caches.match('index.html'))));
});
