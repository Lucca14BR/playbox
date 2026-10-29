// Service worker do PlayBox: deixa instalar como app, abre rápido e funciona sem internet
// (jogar com outras pessoas precisa de rede; sozinho com bots funciona offline).
// Ao publicar uma versão nova do index.html, quem abrir com internet já recebe a nova.
const VERSION = 'playbox-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './playbox-icon-192.png', './playbox-logo.png', './playbox-maskable-192.png', './playbox-maskable-512.png'];
// Bibliotecas, fontes e mapas que vêm de fora (MQTT, QR code, fontes do Google, contornos do mapa).
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // A página: sempre tenta a versão mais nova; sem internet, usa a última guardada.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) { const c = await caches.open(VERSION); c.put(req, res.clone()); }
        return res;
      } catch {
        const c = await caches.open(VERSION);
        return (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }
  // Arquivos do próprio site e das CDNs: entrega a cópia guardada na hora e atualiza por trás.
  if (url.origin === location.origin || CDN.test(req.url)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION), hit = await c.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit || Response.error());
      return hit || net;
    })());
  }
});
