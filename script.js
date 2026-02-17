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

// Proper renderYelpResults function
function renderYelpResults(items, total, offset, doSearch) {
  const out = document.getElementById('yelp-results');
  out.innerHTML = '';
  // Single grid for all businesses
  const section = document.createElement('div');
  section.className = 'card';
  section.style.marginBottom = '24px';
  const table = document.createElement('table');
  table.className = 'yelp-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Rating</th>
        <th>Reviews</th>
        <th>Categories</th>
        <th>Distance</th>
        <th>Address</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  items.forEach(b => {
    const tr = document.createElement('tr');
    let distanceMiles = '';
    if (typeof b.distance === 'number') {
      distanceMiles = (b.distance / 1609.34).toFixed(2) + ' mi';
    }
    tr.innerHTML = `
      <td><img class="yelp-thumb" src="${b.image_url || ''}" alt="${b.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;margin-right:8px;vertical-align:middle;"> <strong>${b.name}</strong></td>
      <td>${b.rating}</td>
      <td>${b.review_count}</td>
      <td>${(b.categories||[]).map(c=>c.title).join(', ')}</td>
      <td>${distanceMiles}</td>
      <td>${formatAddress(b.location)}</td>
      <td>
        <a class="btn ghost" href="${b.url}" target="_blank" rel="noopener">Open</a>
      </td>
    `;
    tbody.appendChild(tr);
  });
  section.appendChild(table);
  out.appendChild(section);

  // Pagination controls
  if (typeof total === 'number' && typeof offset === 'number' && typeof doSearch === 'function') {
    const pageSize = items.length;
    if (total > offset + pageSize) {
      const moreBtn = document.createElement('button');
      moreBtn.textContent = 'Show more results';
      moreBtn.className = 'btn primary';
      moreBtn.style.margin = '16px auto 0 auto';
      moreBtn.onclick = () => doSearch(offset + pageSize);
      out.appendChild(moreBtn);
    }
  }
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

  // CTA smooth scroll removed for production

  // Counters and contact form removed for production

  // Yelp UI
  setupYelpUI();

  // Initialize map (if Leaflet is available). If Leaflet hasn't loaded yet
  // (rare), wait for the window `load` event and try again.
  if (typeof L !== 'undefined') {
    initMap();
  } else {
    window.addEventListener('load', () => { if (typeof L !== 'undefined') initMap(); });
  }
}

document.addEventListener('DOMContentLoaded', init);

/* ---------- Yelp frontend (calls server-side proxy) --------------------- */
function showYelpMessage(html) {
  const el = document.getElementById('yelp-results');
  if (!el) return;
  el.innerHTML = `<div class="card muted small" style="padding:12px">${html}</div>`;
}

async function yelpSearch({ term = 'coffee', latitude, longitude, location = '', price = '', sort_by = 'rating', limit = 6 } = {}) {
  try {
    const params = new URLSearchParams();
    params.set('term', term);
    params.set('limit', String(limit));
      if (price) {
        params.set('price', price);
        console.log('Sending price param:', price);
      }
    if (sort_by) params.set('sort_by', sort_by);

    if (latitude && longitude) {
      params.set('latitude', String(latitude));
      params.set('longitude', String(longitude));
    } else if (location) {
      params.set('location', location);
    }
    // Add radius if present
    if (arguments[0] && arguments[0].radius) {
      params.set('radius', arguments[0].radius);
    }
      const url = `/api/yelp/search?${params.toString()}`;
      console.log('Yelp search URL:', url);
      const resp = await fetch(url);
    if (!resp.ok) throw new Error('Search failed');
    return resp.json();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function formatAddress(loc = {}) {
  return [loc.address1, loc.address2, loc.address3, loc.city, loc.state, loc.zip_code].filter(Boolean).join(', ');
}

function ratingStars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

function renderYelpResults(items) {
  const out = document.getElementById('yelp-results');
  out.innerHTML = '';
  if (!items || items.length === 0) {
    showYelpMessage('No results found. Try a different search.');
    return;
  }
  // Create table
  const table = document.createElement('table');
  table.className = 'yelp-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Rating</th>
        <th>Reviews</th>
        <th>Categories</th>
        <th>Price</th>
        <th>Distance</th>
        <th>Address</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
    // Get selected price from UI for frontend filtering fallback
    const priceSelect = document.getElementById('yelp-price');
    const selectedPrice = priceSelect ? priceSelect.value : '';
    let priceMatched = items;
    let noPrice = [];
    if (selectedPrice) {
      const priceStr = '$'.repeat(Number(selectedPrice));
      priceMatched = items.filter(b => b.price && b.price.trim() === priceStr);
      noPrice = items.filter(b => !b.price);
    } else {
      noPrice = items.filter(b => !b.price);
    }

    // Clear output
    out.innerHTML = '';

    // Price-matched section
    const priceSection = document.createElement('div');
    priceSection.style.marginBottom = '24px';
    if (selectedPrice && priceMatched.length === 0) {
      priceSection.innerHTML = '<div class="card muted small" style="padding:12px">No results found for selected price tier.</div>';
    } else if (priceMatched.length > 0) {
      const table = document.createElement('table');
      table.className = 'yelp-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Name</th>
            <th>Rating</th>
            <th>Reviews</th>
            <th>Categories</th>
            <th>Price</th>
            <th>Distance</th>
            <th>Address</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');
      priceMatched.forEach(b => {
        const tr = document.createElement('tr');
        let distanceMiles = '';
        if (typeof b.distance === 'number') {
          distanceMiles = (b.distance / 1609.34).toFixed(2) + ' mi';
        }
        let priceDisplay = b.price || '';
        tr.innerHTML = `
          <td><img class="yelp-thumb" src="${b.image_url || ''}" alt="${b.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;margin-right:8px;vertical-align:middle;"> <strong>${b.name}</strong></td>
          <td>${b.rating}</td>
          <td>${b.review_count}</td>
          <td>${(b.categories||[]).map(c=>c.title).join(', ')}</td>
          <td>${priceDisplay}</td>
          <td>${distanceMiles}</td>
          <td>${formatAddress(b.location)}</td>
          <td>
            <a class="btn ghost" href="${b.url}" target="_blank" rel="noopener">Open</a>
          </td>
        `;
        tbody.appendChild(tr);
      });
      priceSection.appendChild(table);
    }
    out.appendChild(priceSection);

    // No-price section
    if (noPrice.length > 0) {
      const noPriceSection = document.createElement('div');
      noPriceSection.style.marginBottom = '24px';
      const label = document.createElement('div');
      label.className = 'muted small';
      label.style.margin = '12px 0 4px 0';
      label.textContent = 'Restaurants without price info:';
      noPriceSection.appendChild(label);
      const noPriceTable = document.createElement('table');
      noPriceTable.className = 'yelp-table';
      noPriceTable.innerHTML = `
        <thead>
          <tr>
            <th>Name</th>
            <th>Rating</th>
            <th>Reviews</th>
            <th>Categories</th>
            <th>Price</th>
            <th>Distance</th>
            <th>Address</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = noPriceTable.querySelector('tbody');
      noPrice.forEach(b => {
        const tr = document.createElement('tr');
        let distanceMiles = '';
        if (typeof b.distance === 'number') {
          distanceMiles = (b.distance / 1609.34).toFixed(2) + ' mi';
        }
        let priceDisplay = b.price || '';
        tr.innerHTML = `
          <td><img class="yelp-thumb" src="${b.image_url || ''}" alt="${b.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;margin-right:8px;vertical-align:middle;"> <strong>${b.name}</strong></td>
          <td>${b.rating}</td>
          <td>${b.review_count}</td>
          <td>${(b.categories||[]).map(c=>c.title).join(', ')}</td>
          <td>${priceDisplay}</td>
          <td>${distanceMiles}</td>
          <td>${formatAddress(b.location)}</td>
          <td>
            <a class="btn ghost" href="${b.url}" target="_blank" rel="noopener">Open</a>
          </td>
        `;
        tbody.appendChild(tr);
      });
      noPriceSection.appendChild(noPriceTable);
      out.appendChild(noPriceSection);
    }
}

async function showYelpDetails(id) {
  const detailsEl = document.getElementById('yelp-details');
  detailsEl.classList.remove('hidden');
  detailsEl.innerHTML = '<div class="small muted">Loading details…</div>';
  try {
    const resp = await fetch(`/api/yelp/business/${encodeURIComponent(id)}`);
    if (!resp.ok) throw new Error('Failed to load business');
    const data = await resp.json();
    const d = data.details || {};
    const reviews = data.reviews || [];

    detailsEl.innerHTML = `
      <h4 style="margin:0 0 8px 0">${d.name}</h4>
      <div class="small muted">${d.rating} ★ — ${d.review_count} reviews — ${d.price || ''}</div>
      <div style="margin-top:8px">${formatAddress(d.location)}</div>
      <div style="margin-top:8px">${d.display_phone || ''} <a href="${d.url}" target="_blank" rel="noopener">(Yelp)</a></div>
      <hr />
      <strong>Recent reviews</strong>
      <div style="margin-top:8px">${reviews.map(r=>`<div class="card small" style="margin:8px 0;padding:8px"><strong>${r.user.name}</strong> — <span class="small muted">${r.rating} ★</span><div style="margin-top:6px">${r.text}</div></div>`).join('')}</div>
    `;
  } catch (err) {
    console.error(err);
    detailsEl.innerHTML = '<div class="small muted">Failed to load details.</div>';
  }
}

function setupYelpUI() {
  const term = $('#yelp-term');
  const locationInput = $('#yelp-location');
  const useLoc = $('#yelp-use-location');
  const searchBtn = $('#yelp-search');
  const distanceSelect = $('#yelp-distance');
  const priceSelect = $('#yelp-price');
  // ZIP field removed for production

  useLoc.addEventListener('click', () => {
    if (!navigator.geolocation) return alert('Geolocation not supported by your browser');
    useLoc.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition((p) => {
      locationInput.value = `${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`;
      useLoc.textContent = '📍 Use my location';
    }, (err) => { alert('Unable to get location: '+err.message); useLoc.textContent = '📍 Use my location'; }, { timeout: 5000 });
  });

  async function doSearch() {
    const q = term.value.trim() || 'coffee';
    const loc = locationInput.value.trim();
    const price = priceSelect.value;
    const distanceMiles = parseFloat(distanceSelect.value);
    let radius;
    if (!isNaN(distanceMiles) && distanceMiles > 0) {
      // Yelp API max radius is 40000 meters (about 24.85 miles)
      radius = Math.round(Math.min(distanceMiles * 1609.34, 40000));
    }
    showYelpMessage('Searching…');
    try {
      let res;
      if (/^[-0-9.,\s]+$/.test(loc) && loc.includes(',')) {
        // lat,lng input
        const [lat, lon] = loc.split(',').map(s => parseFloat(s.trim()));
        res = await yelpSearch({ term: q, latitude: lat, longitude: lon, limit: 8, radius, price, sort_by: 'rating' });
      } else {
        res = await yelpSearch({ term: q, location: loc || undefined, limit: 8, radius, price, sort_by: 'rating' });
      }
      renderYelpResults(res.businesses || []);
    } catch (err) {
      showYelpMessage('Search failed.');
    }
  }

  searchBtn.addEventListener('click', doSearch);
  term.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  // Trigger search when price or distance is changed
  priceSelect.addEventListener('change', doSearch);
  distanceSelect.addEventListener('change', doSearch);
}

