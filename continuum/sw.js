// Network-first shell cache: always fresh when online, still opens offline.
const CACHE='continuum-shell-v1';
const SHELL=['./','./index.html','./hud.css','./app.js','./shell.js','./transition-scene.js','./effects-rack.js','./audio-import.js','./audio-analysis.js','./audio-player.js','./granular-fx.js','./lofi-fx.js','./queue.js','./working-session.js','./manifest.webmanifest','./icon.svg','./icon-180.png','./prd.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()).catch(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return res}).catch(()=>caches.match(r).then(m=>m||caches.match('./index.html'))));
});
