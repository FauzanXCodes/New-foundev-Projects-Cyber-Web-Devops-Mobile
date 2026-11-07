const CACHE_NAME = 'cloud-cost-calculator-v5';
const APP_SHELL = [
  './',
  './index.html',
  './site.webmanifest',
  './icons/cloud-cost-calculator.svg',
  './src/styles.css',
  './src/app.js',
  './src/allocation.js',
  './src/calculator.js',
  './src/charts.js',
  './src/commitments.js',
  './src/compare.js',
  './src/estimate-name.js',
  './src/export.js',
  './src/forecast.js',
  './src/pricing.js',
  './src/recommendations.js',
  './src/readiness.js',
  './src/review-brief.js',
  './src/risk.js',
  './src/savings.js',
  './src/scenarios.js',
  './src/share.js',
  './src/state.js',
  './src/theme.js',
  './src/undo.js',
  './src/validation.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function fromNetworkOrCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (request.mode === 'navigate') {
      return (await caches.match('./index.html')) ?? Response.error();
    }
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(fromNetworkOrCache(request));
});
