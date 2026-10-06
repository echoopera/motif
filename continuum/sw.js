// Network-first shell cache: always fresh when online, still opens offline. Bump VERSION on every release.
const VERSION='0.9.1',CACHE='continuum-'+VERSION;
const SHELL=['./','./index.html','./prd.html','./product.html','./hud.css','./fonts.css','./app.js','./shell.js','./transition-scene.js','./effects-rack.js','./audio-import.js','./queue.js','./audio-analysis.js','./audio-player.js','./granular-fx.js','./lofi-fx.js','./slow-fx.js','./working-session.js','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png','./fonts/ibm-plex-mono-400-normal.woff2','./fonts/ibm-plex-mono-500-normal.woff2','./fonts/ibm-plex-sans-300-normal.woff2','./fonts/oxanium-200-500-normal.woff2'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('continuum-')&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin||r.headers.has('range'))return;
  e.respondWith(fetch(r).then(res=>{
    if(res.ok&&res.type==='basic'){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{})}
    return res;
  }).catch(()=>caches.match(r).then(m=>m||caches.match('./index.html'))));
});
