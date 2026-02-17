// yelp.js — Yelp UI logic (modularized)
// All Yelp-related UI and API logic is moved here for clarity and maintainability.

// Helper: query selector shorthand
const $ = (s) => document.querySelector(s);

function showYelpMessage(html) {
  const el = document.getElementById('yelp-results');
  if (!el) return;
  el.innerHTML = `<div class="card muted small" style="padding:12px">${html}</div>`;
}

function formatAddress(loc = {}) {
  return [loc.address1, loc.address2, loc.address3, loc.city, loc.state, loc.zip_code].filter(Boolean).join(', ');
}

function buildYelpRow(b) {
  let distanceMiles = '';
  if (typeof b.distance === 'number') {
    distanceMiles = (b.distance / 1609.34).toFixed(2) + ' mi';
  }
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><img class="yelp-thumb yelp-thumb-table" src="${b.image_url || ''}" alt="${b.name}"> <strong>${b.name}</strong></td>
    <td>${b.rating}</td>
    <td>${b.review_count}</td>
    <td>${(b.categories||[]).map(c=>c.title).join(', ')}</td>
    <td>${distanceMiles}</td>
    <td>${formatAddress(b.location)}</td>
    <td>
      <a class="btn ghost" href="${b.url}" target="_blank" rel="noopener">Open</a>
    </td>
  `;
  return tr;
}

function buildYelpTable(items) {
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
  items.forEach(b => tbody.appendChild(buildYelpRow(b)));
  return table;
}

function renderYelpResults(items = [], total = 0, offset = 0, doSearch) {
  const out = document.getElementById('yelp-results');
  out.innerHTML = '';
  if (!items || items.length === 0) {
    showYelpMessage('No results found. Try a different search.');
    return;
  }
  // Create section and table
  const section = document.createElement('div');
  section.className = 'card yelp-results-section';
  section.appendChild(buildYelpTable(items));
  out.appendChild(section);

  // Pagination controls
  if (typeof total === 'number' && typeof offset === 'number' && typeof doSearch === 'function') {
    const pageSize = items.length;
    if (total > offset + pageSize) {
      const moreBtn = document.createElement('button');
      moreBtn.textContent = 'Show more results';
      moreBtn.className = 'btn primary yelp-more-btn';
      moreBtn.onclick = () => doSearch(offset + pageSize);
      out.appendChild(moreBtn);
    }
  }
}

export { showYelpMessage, formatAddress, buildYelpRow, buildYelpTable, renderYelpResults };
