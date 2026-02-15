/*
  script.js — vanilla JavaScript for small interactive features
  - theme toggle (stores preference in localStorage)
  - responsive nav toggle (mobile)
  - animated counters triggered by IntersectionObserver
  - simple demo form handler (client-side only)
*/

// Helper: query selector shorthand
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// THEME TOGGLE --------------------------------------------------------------
// Toggle between light and dark theme. We add/remove the `light-theme` class
// on the documentElement and persist the choice to localStorage so preference
// is preserved across visits.
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light-theme');
    $('#theme-toggle').textContent = '☀️';
    $('#theme-toggle').setAttribute('aria-pressed', 'true');
  } else {
    root.classList.remove('light-theme');
    $('#theme-toggle').textContent = '🌙';
    $('#theme-toggle').setAttribute('aria-pressed', 'false');
  }
  localStorage.setItem('site-theme', theme);
}

function toggleTheme() {
  const isLight = document.documentElement.classList.contains('light-theme');
  applyTheme(isLight ? 'dark' : 'light');
}

// NAVIGATION TOGGLE (MOBILE) -----------------------------------------------
function toggleNav() {
  const list = $('#nav-list');
  const btn = document.querySelector('.nav-toggle');
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!expanded));
  list.classList.toggle('show');
}

// ANIMATED COUNTERS ---------------------------------------------------------
// Use IntersectionObserver to trigger counter animation when visible.
function animateCounter(el, target) {
  // Simple incremental counter — good for small numbers.
  let start = 0;
  const duration = 900; // ms
  const stepTime = Math.max(Math.floor(duration / target), 8);
  const timer = setInterval(() => {
    start += 1;
    el.textContent = start;
    if (start >= target) clearInterval(timer);
  }, stepTime);
}

function setupCounters() {
  const counters = $$('.counter');
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-target'), 10) || 0;
        if (!el.classList.contains('started')) {
          el.classList.add('started');
          animateCounter(el, target);
        }
        obs.unobserve(el);
      }
    });
  }, {threshold: 0.6});

  counters.forEach(c => io.observe(c));
}

// FORM HANDLER (demo-only) -------------------------------------------------
function setupForm() {
  const form = $('#contact-form');
  const status = $('#form-status');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    // Demo behaviour: show captured inputs and reset after 2s
    status.textContent = `Captured (demo): ${data.get('name') || '—'} — "${(data.get('message')||'').slice(0,60)}"`;
    status.style.color = 'var(--accent)';
    setTimeout(() => { status.textContent = ''; form.reset(); }, 2000);
  });
}

// MAP INITIALIZATION (Leaflet + Geolocation + controls) --------------------
function showMapStatus(html) {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  let st = mapEl.querySelector('.map-status');
  if (!st) {
    st = document.createElement('div');
    st.className = 'map-status hidden';
    st.innerHTML = `<div class="map-status-inner" role="status" aria-live="polite"></div>`;
    mapEl.appendChild(st);
  }
  st.querySelector('.map-status-inner').innerHTML = html;
  st.classList.remove('hidden');
}
function hideMapStatus() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  const st = mapEl.querySelector('.map-status');
  if (st) st.classList.add('hidden');
}
function cleanupMap() {
  if (window._map) {
    try { if (window._map.map) window._map.map.remove(); } catch (e) { /* ignore */ }
    if (window._map._tileTimeout) { clearTimeout(window._map._tileTimeout); window._map._tileTimeout = null; }
    if (window._map._retryTimer) { clearTimeout(window._map._retryTimer); window._map._retryTimer = null; }
    if (window._map._retryInterval) { clearInterval(window._map._retryInterval); window._map._retryInterval = null; }
    delete window._map;
  }
  const mapEl = document.getElementById('map');
  if (mapEl) {
    const st = mapEl.querySelector('.map-status');
    if (st) st.remove();
  }
}

function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  mapEl.style.position = mapEl.style.position || 'relative';
  hideMapStatus();

  // Automatic retry config (exponential backoff)
  const AUTO_RETRY_MAX = 4;      // maximum attempts
  const AUTO_RETRY_BASE = 1000;  // base delay in ms (doubles each attempt)
  const AUTO_RETRY_MAX_DELAY = 30000; // cap delay

  function clearRetryState() {
    if (!window._map) return;
    if (window._map._retryTimer) { clearTimeout(window._map._retryTimer); window._map._retryTimer = null; }
    if (window._map._retryInterval) { clearInterval(window._map._retryInterval); window._map._retryInterval = null; }
    if (window._map._retryState) delete window._map._retryState;
  }

  function startAutoRetry(reason) {
    // prevent multiple concurrent retry sequences
    if (!window._map) window._map = {};
    if (window._map._retryState && window._map._retryState.active) return;

    window._map._retryState = { attempt: 0, max: AUTO_RETRY_MAX, active: true };

    const runAttempt = () => {
      const state = window._map._retryState;
      state.attempt += 1;
      const attempt = state.attempt;
      const delay = Math.min(AUTO_RETRY_BASE * Math.pow(2, attempt - 1), AUTO_RETRY_MAX_DELAY);
      let remaining = Math.ceil(delay / 1000);

      showMapStatus(`<strong>Map load problem</strong><div class="small muted">${reason} — automatic retry in <span class="retry-countdown">${remaining}</span>s (attempt ${attempt} of ${state.max}).</div>`);

      // update countdown every second
      window._map._retryInterval = setInterval(() => {
        remaining -= 1;
        const el = document.querySelector('#map .retry-countdown');
        if (el) el.textContent = String(remaining);
        if (remaining <= 0) { clearInterval(window._map._retryInterval); window._map._retryInterval = null; }
      }, 1000);

      window._map._retryTimer = setTimeout(() => {
        // attempt re-init: clear any prior map instance then try again
        clearRetryState();
        cleanupMap();
        if (typeof L === 'undefined') {
          // if Leaflet library is missing, reload the page to try fetch external script
          location.reload();
          return;
        }

        if (attempt >= AUTO_RETRY_MAX) {
          // final attempt: try to init, then show final message if still failing
          initMap();
          // leave it to initMap / tile handlers to restart retry if needed
          return;
        }

        // otherwise, try to initialize map again; tile errors/timeouts will trigger further retries
        initMap();
      }, delay);
    };

    runAttempt();
  }

  // If Leaflet isn't available at all, start auto-retry (which will reload page if needed)
  if (typeof L === 'undefined') {
    startAutoRetry('Leaflet library not available (network blocked)');
    return console.warn('Leaflet not available');
  }

  cleanupMap(); // remove any previous instance

  const fallback = [40.7128, -74.0060]; // fallback to New York
  const map = L.map('map', { scrollWheelZoom: true }).setView(fallback, 12);
  const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // show loading status until tiles load
  showMapStatus('<strong>Loading map…</strong>');

  let tileErrors = 0;
  let tilesLoaded = false;
  const TILE_ERROR_THRESHOLD = 3;
  const tileErrorHandler = () => {
    tileErrors += 1;
    if (tileErrors > TILE_ERROR_THRESHOLD) {
      // start automatic retry sequence (if not already running)
      startAutoRetry('Many tile errors (network/CORS)');
    }
  };
  tileLayer.on('tileerror', tileErrorHandler);

  // If tiles successfully load, hide the status overlay and clear retry state
  tileLayer.once('load', () => {
    tilesLoaded = true;
    hideMapStatus();
    clearRetryState();
    setTimeout(() => map.invalidateSize(), 200);
  });

  // timeout fallback: if tiles haven't loaded in 8s, start auto-retry
  const tileLoadTimeout = setTimeout(() => {
    if (!tilesLoaded && tileErrors === 0) {
      startAutoRetry('Tile load timeout');
    }
  }, 8000);

  const marker = L.marker(fallback, { draggable: true }).addTo(map);
  marker.bindPopup(`Latitude: ${fallback[0].toFixed(5)}<br>Longitude: ${fallback[1].toFixed(5)}`).openPopup();

  function updateMarker(lat, lng, zoom = 13) {
    marker.setLatLng([lat, lng]);
    marker.setPopupContent(`Latitude: ${lat.toFixed(5)}<br>Longitude: ${lng.toFixed(5)}`).openPopup();
    map.setView([lat, lng], zoom);
  }

  marker.on('dragend', () => {
    const p = marker.getLatLng();
    marker.setPopupContent(`Latitude: ${p.lat.toFixed(5)}<br>Longitude: ${p.lng.toFixed(5)}`).openPopup();
  });

  // Try to center on the user's location. Fallback remains if denied/failed.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      updateMarker(pos.coords.latitude, pos.coords.longitude, 13);
    }, (err) => {
      console.warn('Geolocation unavailable — using fallback', err);
    }, { enableHighAccuracy: true, timeout: 5000 });
  }

  // Geolocate control (custom Leaflet control)
  const geoCtl = L.control({ position: 'topleft' });
  geoCtl.onAdd = function () {
    const el = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    const a = L.DomUtil.create('a', '', el);
    a.href = '#'; a.title = 'Center on your location'; a.innerHTML = '📍';
    L.DomEvent.on(a, 'click', (ev) => {
      L.DomEvent.stopPropagation(ev); L.DomEvent.preventDefault(ev);
      if (!navigator.geolocation) return alert('Geolocation not supported by your browser');
      navigator.geolocation.getCurrentPosition((p) => updateMarker(p.coords.latitude, p.coords.longitude, 14),
        (err) => alert('Unable to get location: ' + err.message), { enableHighAccuracy: true, timeout: 5000 });
    });
    return el;
  };
  geoCtl.addTo(map);

  // Fullscreen toggle (uses Fullscreen API + CSS class)
  const fsCtl = L.control({ position: 'topleft' });
  fsCtl.onAdd = function () {
    const el = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    const a = L.DomUtil.create('a', '', el);
    a.href = '#'; a.title = 'Toggle fullscreen'; a.innerHTML = '⛶';
    L.DomEvent.on(a, 'click', (ev) => {
      L.DomEvent.stopPropagation(ev); L.DomEvent.preventDefault(ev);
      const mapEl = document.getElementById('map');
      if (!document.fullscreenElement) {
        mapEl.requestFullscreen?.();
        mapEl.classList.add('map-fullscreen');
      } else {
        document.exitFullscreen?.();
        mapEl.classList.remove('map-fullscreen');
      }
      setTimeout(() => map.invalidateSize(), 300);
    });
    return el;
  };
  fsCtl.addTo(map);

  document.addEventListener('fullscreenchange', () => {
    const mapEl = document.getElementById('map');
    if (!document.fullscreenElement) mapEl.classList.remove('map-fullscreen');
    map.invalidateSize();
  });

  // expose for debugging
  window._map = { map, marker, updateMarker, _tileTimeout: tileLoadTimeout };
}

// INITIALIZATION -----------------------------------------------------------
function init() {
  // Apply saved theme or default to dark
  const saved = localStorage.getItem('site-theme') || 'dark';
  applyTheme(saved);

  // Theme toggle button
  $('#theme-toggle').addEventListener('click', toggleTheme);

  // Mobile nav toggle
  const navBtn = document.querySelector('.nav-toggle');
  if (navBtn) navBtn.addEventListener('click', toggleNav);

  // CTA smooth scroll
  $('#cta-demo').addEventListener('click', () => {
    document.querySelector('#contact').scrollIntoView({behavior:'smooth'});
  });

  // Counters and form
  setupCounters();
  setupForm();

  // Initialize map (if Leaflet is available). If Leaflet hasn't loaded yet
  // (rare), wait for the window `load` event and try again.
  if (typeof L !== 'undefined') {
    initMap();
  } else {
    window.addEventListener('load', () => { if (typeof L !== 'undefined') initMap(); });
  }
}

document.addEventListener('DOMContentLoaded', init);
