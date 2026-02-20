/*
 * MANUAL TEST PROCEDURE:
 * 1. Load jpml-mdl-map.html with query params: start=2025-12-02&end=2026-02-02
 * 2. Click expand on Pending Increase row 1, confirm SINGLE section with current month (2026-02-02) only
 * 3. Click expand on another row, confirm previous closes
 * 4. Verify inline details show: section title, table headers (MDL | Title | Count), data rows, total footer
 * 5. Confirm NO horizontal scrollbar in inline details
 * 6. Confirm long titles wrap normally (no vertical letter stacking)
 * 7. Test narrow viewport (DevTools responsive ~900px and ~600px) - still no horizontal scroll
 * 8. Verify Total row appears at bottom with correct sum
 * 9. To enable debug outlines, add class="debug" to <html> tag in DevTools
 */

// Debug flag (set to true to enable console logging)
const DEBUG_INLINE_DETAILS = false;

// Test harness flag (set to true to inject synthetic test rows with extreme titles)
const ENABLE_INLINE_TABLE_TEST_HARNESS = false;

// Global state
let districts = {};
let months = [];
let dataByMonth = {};
let startMonth = null;
let endMonth = null;
let metric = 'count';
let shortToLongDistrictMap = {};
let currentEndData = []; // raw row data for the currently displayed end month
let currentStartData = []; // raw row data for the currently displayed start month

// Sort state for tables
const sortState = {
  'pending-increase-table': { column: null, direction: 'asc' },
  'total-increase-table': { column: null, direction: 'asc' },
  'mdl-pending-increase-table': { column: null, direction: 'asc' },
  'mdl-total-increase-table': { column: null, direction: 'asc' },
  'dashboard-mdl-table': { column: null, direction: 'desc' },
  'top-districts-table': { column: null, direction: 'desc' },
  'district-detail-table': { column: null, direction: 'desc' },
  'current-new-mdls-table': { column: null, direction: 'desc' },
  'current-removed-mdls-table': { column: null, direction: 'desc' }
};

// Metric state for movers tables
const metricState = {
  'district': 'absolute',  // district-metric radio buttons
  'mdl': 'absolute',       // mdl-metric radio buttons
  'trends': 'pending'      // trends-metric radio buttons
};

// Helper to close any open inline details row in a table
function closeOpenDetails(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const open = table.querySelector('.inline-details-row');
  if (open) open.remove();
  
  // Remove expanded class from all buttons
  const buttons = table.querySelectorAll('.expand-btn');
  buttons.forEach(btn => btn.classList.remove('expanded'));
}

// Helper to render compact MDL breakdown table for inline details (current month only)
function renderInlineMdlsSection(mdls, total, mdlsAvailable, label) {
  if (!mdlsAvailable) {
    return `<div class="inline-no-data">This month's file does not include MDL-level rows. Showing district totals only.<br><strong>Total:</strong> ${total.toLocaleString()}</div>`;
  }
  
  if (!mdls || mdls.length === 0) {
    return `<div class="inline-no-data">No ${label} MDLs found for this district.</div>`;
  }
  
  // DEV TEST HARNESS: Inject synthetic test rows if enabled
  if (ENABLE_INLINE_TABLE_TEST_HARNESS) {
    mdls = [...mdls];
    // Test 1: Very long title with spaces (300+ chars)
    mdls.push({
      mdlNum: 'TEST-8888',
      title: 'In Re: Aqueous Film Forming Foams Products Liability Litigation Involving Multiple Districts And Extensive Case Management Coordination Requirements With Numerous Plaintiffs Complex Discovery Proceedings Bellwether Trials Settlement Negotiations Expert Witness Depositions Motion Practice Summary Judgment Briefing Class Certification Issues Multi-District Transfer Coordination',
      count: 888888
    });
    // Test 2: Very long unbroken token (200+ chars, no spaces)
    mdls.push({
      mdlNum: 'TEST-9999',
      title: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      count: 999999
    });
  }
  
  // Build table with colgroup for fixed column widths, headers, ALL rows, and total footer
  let html = `<table class="inline-mdl-table">
    <colgroup>
      <col class="col-mdl">
      <col class="col-title">
      <col class="col-count">
    </colgroup>
    <thead>
      <tr>
        <th>MDL</th>
        <th class="title">Title</th>
        <th class="count">Count</th>
      </tr>
    </thead>
    <tbody>`;
  
  // Render ALL MDLs - no slicing, no "+ X more" row
  mdls.forEach(m => {
    // Render full title - no truncation
    html += `<tr><td>${m.mdlNum}</td><td class="title">${m.title}</td><td class="count">${m.count.toLocaleString()}</td></tr>`;
  });
  
  html += `</tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:right;font-weight:600;padding-top:12px;">Total:</td>
        <td class="count" style="font-weight:600;padding-top:12px;">${total.toLocaleString()}</td>
      </tr>
    </tfoot>
  </table>`;
  
  return html;
}

function injectDetailsModal() {
  if (document.getElementById('mdl-details-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'mdl-details-modal';
  modal.className = 'mdl-details-modal';
  modal.innerHTML = `
    <div class="mdl-details-modal-content">
      <span class="mdl-details-modal-close">&times;</span>
      <div id="mdl-details-modal-body"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.mdl-details-modal-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

function calculateHHI(items) {
  let hhi = 0;
  items.forEach(d => {
    let share = typeof d.share === 'number' ? d.share * 100 : 0;
    hhi += share * share;
  });
  return Math.round(hhi);
}

function getConcentrationLabel(hhi) {
  if (hhi < 1000) return "Low";
  if (hhi <= 1800) return "Moderate";
  return "High";
}

async function loadDistricts() {
  try {
    const res = await fetch('/data/districts.json');
    const obj = await res.json();
    if (Array.isArray(obj)) {
      obj.forEach(d => {
        districts[d.abbreviation] = d;
        districts[d.name] = d;
        shortToLongDistrictMap[d.abbreviation] = d.name;
      });
    } else {
      Object.entries(obj).forEach(([abbr, d]) => {
        districts[abbr] = d;
        districts[d.name] = d;
        shortToLongDistrictMap[abbr] = d.name;
      });
    }
  } catch (err) {
    console.error('Failed to fetch /data/districts.json:', err);
  }
}

// Helper to format date as "Month Year" for display
function formatMonthYear(dateStr) {
  const [year, month] = dateStr.split('-');
  const date = new Date(year, parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Helper to get full district name from abbreviation
function getFullDistrictName(abbr) {
  if (!abbr) return '';
  
  // First try direct lookup
  const district = districts[abbr];
  if (!district) return abbr;
  
  // Get the medium form name (e.g., "D.N.J.")
  const mediumName = district.name;
  if (!mediumName) return abbr;
  
  // Look up the medium form to get the full name
  const fullDistrict = districts[mediumName];
  if (fullDistrict && fullDistrict.name && fullDistrict.name !== abbr) {
    return fullDistrict.name.replace(/^D\.([^\s])/, 'D. $1');
  }
  
  // If the medium form is already the full name, return it
  // Add a space after leading "D." for readability: "D.N.J." → "D. N.J."
  return mediumName.replace(/^D\.([^\s])/, 'D. $1');
}

async function loadMonths() {
  try {
    const res = await fetch('/data/mdl/index.json');
    months = await res.json();
    const startSelect = document.getElementById('start-month-select');
    const endSelect = document.getElementById('end-month-select');
    
    if (!startSelect || !endSelect) {
      console.error('Month select elements not found');
      return;
    }
    
    startSelect.innerHTML = '';
    endSelect.innerHTML = '';
    months.slice().reverse().forEach(m => {
      const opt1 = document.createElement('option');
      opt1.value = m;
      opt1.textContent = formatMonthYear(m);
      startSelect.appendChild(opt1);
      const opt2 = document.createElement('option');
      opt2.value = m;
      opt2.textContent = formatMonthYear(m);
      endSelect.appendChild(opt2);
    });
    
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlStart = urlParams.get('start');
    const urlEnd = urlParams.get('end');
    
    if (urlEnd && months.includes(urlEnd)) {
      endSelect.value = urlEnd;
    } else {
      endSelect.selectedIndex = 0;
    }
    
    if (urlStart && months.includes(urlStart)) {
      startSelect.value = urlStart;
    } else {
      startSelect.selectedIndex = 1 < months.length ? 1 : 0;
    }
    
    startSelect.addEventListener('change', () => validateAndUpdate());
    endSelect.addEventListener('change', () => validateAndUpdate());
    
    return true;
  } catch (err) {
    console.error('Failed to fetch /data/mdl/index.json:', err);
    return false;
  }
}

async function validateAndUpdate() {
  const startSelect = document.getElementById('start-month-select');
  const endSelect = document.getElementById('end-month-select');
  
  if (!startSelect || !endSelect || !startSelect.value || !endSelect.value) {
    console.warn('Cannot validate and update: selects not ready');
    return;
  }
  
  startMonth = startSelect.value;
  endMonth = endSelect.value;
  
  if (months.indexOf(endMonth) < months.indexOf(startMonth)) {
    endSelect.value = startMonth;
    endMonth = startMonth;
    return;
  }
  
  updateURLParams();
  await updateDashboard();
  await renderCurrentMonthNewMDLs();
}

function updateURLParams() {
  if (!startMonth || !endMonth) return;
  const url = new URL(window.location);
  url.searchParams.set('start', startMonth);
  url.searchParams.set('end', endMonth);
  window.history.replaceState({}, '', url);
}

async function loadDataForMonth(month) {
  if (!dataByMonth[month]) {
    try {
      const res = await fetch(`/data/mdl/${month}.json`);
      dataByMonth[month] = await res.json();
    } catch (err) {
      dataByMonth[month] = [];
    }
  }
  return dataByMonth[month];
}

function computeSummary(currentData, priorData) {
  const byDistrict = {};
  const priorByDistrict = {};
  const byMDL = {};
  const priorByMDL = {};
  
  // Aggregate by district
  for (const row of currentData) {
    const d = row.District;
    if (!byDistrict[d]) byDistrict[d] = { District: d, abs: 0, pending: 0, total: 0 };
    byDistrict[d].abs += row["Pending"] || 0;
    byDistrict[d].pending += row["Pending"] || 0;
    byDistrict[d].total += row["Total"] || 0;
    
    // Aggregate by MDL
    const mdl = row['MDL'] || row['MDL Name'];
    if (mdl) {
      if (!byMDL[mdl]) byMDL[mdl] = { 
        MDL: mdl, 
        Title: row['Title'] || '', 
        District: d,
        abs: 0, 
        pending: 0, 
        total: 0 
      };
      byMDL[mdl].abs += row["Pending"] || 0;
      byMDL[mdl].pending += row["Pending"] || 0;
      byMDL[mdl].total += row["Total"] || 0;
    }
  }
  
  for (const row of priorData) {
    const d = row.District;
    if (!priorByDistrict[d]) priorByDistrict[d] = { abs: 0, pending: 0, total: 0 };
    priorByDistrict[d].abs += row["Pending"] || 0;
    priorByDistrict[d].pending += row["Pending"] || 0;
    priorByDistrict[d].total += row["Total"] || 0;
    
    // Aggregate prior MDL data
    const mdl = row['MDL'] || row['MDL Name'];
    if (mdl) {
      if (!priorByMDL[mdl]) priorByMDL[mdl] = { abs: 0, pending: 0, total: 0 };
      priorByMDL[mdl].abs += row["Pending"] || 0;
      priorByMDL[mdl].pending += row["Pending"] || 0;
      priorByMDL[mdl].total += row["Total"] || 0;
    }
  }
  
  let nationalTotalAbs = 0, priorTotalAbs = 0;
  
  // Compute district deltas
  for (const d in byDistrict) {
    const curr = byDistrict[d];
    const prior = priorByDistrict[d] || { abs: 0, pending: 0, total: 0 };
    curr.prior = prior.abs;
    curr.delta = curr.abs - prior.abs;
    curr.pctDelta = prior.abs ? ((curr.abs - prior.abs) / prior.abs) * 100 : (curr.abs ? 100 : 0);
    curr.priorPending = prior.pending;
    curr.pendingDelta = curr.pending - prior.pending;
    curr.pendingPctDelta = prior.pending ? ((curr.pending - prior.pending) / prior.pending) * 100 : (curr.pending ? 100 : 0);
    curr.priorTotal = prior.total;
    curr.totalDelta = curr.total - prior.total;
    curr.totalPctDelta = prior.total ? ((curr.total - prior.total) / prior.total) * 100 : (curr.total ? 100 : 0);
    curr.share = 0;
    nationalTotalAbs += curr.abs;
    priorTotalAbs += prior.abs;
  }
  
  // Compute MDL deltas
  for (const mdl in byMDL) {
    const curr = byMDL[mdl];
    const prior = priorByMDL[mdl] || { abs: 0, pending: 0, total: 0 };
    curr.prior = prior.abs;
    curr.delta = curr.abs - prior.abs;
    curr.pctDelta = prior.abs ? ((curr.abs - prior.abs) / prior.abs) * 100 : (curr.abs ? 100 : 0);
    curr.priorPending = prior.pending;
    curr.pendingDelta = curr.pending - prior.pending;
    curr.pendingPctDelta = prior.pending ? ((curr.pending - prior.pending) / prior.pending) * 100 : (curr.pending ? 100 : 0);
    curr.priorTotal = prior.total;
    curr.totalDelta = curr.total - prior.total;
    curr.totalPctDelta = prior.total ? ((curr.total - prior.total) / prior.total) * 100 : (curr.total ? 100 : 0);
  }
  
  for (const d in byDistrict) {
    byDistrict[d].share = nationalTotalAbs ? byDistrict[d].abs / nationalTotalAbs : 0;
  }
  
  const sorted = Object.values(byDistrict).sort((a, b) => b.abs - a.abs);
  const top5 = sorted.slice(0, 5);
  const top5Share = top5.reduce((sum, d) => sum + d.share, 0);
  
  const pendingIncrease = sorted.filter(d => d.pendingDelta > 0).sort((a, b) => b.pendingDelta - a.pendingDelta).slice(0, 10);
  const totalIncrease = sorted.filter(d => d.totalDelta > 0).sort((a, b) => b.totalDelta - a.totalDelta).slice(0, 10);
  
  // MDL-level movers
  const mdlValues = Object.values(byMDL);
  const mdlPendingIncrease = mdlValues.filter(d => d.pendingDelta > 0).sort((a, b) => b.pendingDelta - a.pendingDelta).slice(0, 10);
  const mdlTotalIncrease = mdlValues.filter(d => d.totalDelta > 0).sort((a, b) => b.totalDelta - a.totalDelta).slice(0, 10);
  
  // Find new MDLs (present in current but not in prior)
  const newMDLs = mdlValues.filter(mdl => !priorByMDL[mdl.MDL]);
  
  // Find removed MDLs (present in prior but not in current)
  const removedMDLs = Object.keys(priorByMDL)
    .filter(mdlKey => !byMDL[mdlKey])
    .map(mdlKey => {
      // Find the title and district from prior data
      const priorRow = priorData.find(row => (row['MDL'] || row['MDL Name']) === mdlKey);
      return {
        MDL: mdlKey,
        Title: priorRow ? (priorRow['Title'] || '') : '',
        District: priorRow ? (priorRow['District'] || '') : '',
        abs: priorByMDL[mdlKey].abs,
        pending: priorByMDL[mdlKey].pending,
        total: priorByMDL[mdlKey].total
      };
    });
  
  const nationalDelta = nationalTotalAbs - priorTotalAbs;
  const nationalPctDelta = priorTotalAbs ? ((nationalTotalAbs - priorTotalAbs) / priorTotalAbs) * 100 : (nationalTotalAbs ? 100 : 0);
  const hhi = calculateHHI(Object.values(byDistrict));
  const concentration = getConcentrationLabel(hhi);
  
  return {
    total: nationalTotalAbs,
    priorTotal: priorTotalAbs,
    nationalDelta,
    nationalPctDelta,
    hhi,
    concentration,
    top5Share,
    byDistrict,
    byMDL,
    pendingIncrease,
    totalIncrease,
    mdlPendingIncrease,
    mdlTotalIncrease,
    newMDLs,
    removedMDLs
  };
}

function renderPanels(summary) {
  const el = document.getElementById('dashboard-panels');
  const deltaClass = summary.nationalDelta >= 0 ? 'delta-positive' : 'delta-negative';
  el.innerHTML = `
    <div class="panel">
      <div class="panel-label">National Total Pending MDL Cases</div>
      <div class="panel-value">${summary.total.toLocaleString()}</div>
    </div>
    <div class="panel">
      <div class="panel-label">National Pending MoM Δ</div>
      <div class="panel-value"><span class="${deltaClass}">${summary.nationalDelta >= 0 ? '+' : ''}${summary.nationalDelta.toLocaleString()}</span> (${summary.nationalPctDelta >= 0 ? '+' : ''}${summary.nationalPctDelta.toFixed(1)}%)</div>
    </div>
    <div class="panel">
      <div class="panel-label">HHI Concentration</div>
      <div class="panel-value">${summary.hhi} <span class="score-label ${summary.concentration.toLowerCase()}">${summary.concentration}</span></div>
    </div>
    <div class="panel">
      <div class="panel-label">Top 5 Districts Combined %</div>
      <div class="panel-value">${(summary.top5Share * 100).toFixed(1)}%</div>
    </div>
  `;
}

function sortTable(tableId, column) {
  const state = sortState[tableId];
  
  // Toggle direction if same column, otherwise reset to desc
  if (state.column === column) {
    state.direction = state.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.column = column;
    state.direction = 'desc';
  }
  
  // Update dashboard to re-render with new sort
  updateDashboard();
}

// Generic function to sort an array based on column and direction
function sortData(data, column, direction, columnMapping = {}) {
  if (!column || !data || data.length === 0) return data;
  
  return [...data].sort((a, b) => {
    // Map column name to actual property name if mapping exists
    const prop = columnMapping[column] || column;
    let aVal = a[prop];
    let bVal = b[prop];
    
    // Special handling for District column - use full names for comparison
    if (prop === 'District') {
      aVal = getFullDistrictName(aVal) || '';
      bVal = getFullDistrictName(bVal) || '';
    } else {
      // Handle undefined/null
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
    }
    
    // Determine comparison
    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else {
      comparison = aVal - bVal;
    }
    
    return direction === 'asc' ? comparison : -comparison;
  });
}

// Helper to update sortable headers with visual indicators
function updateSortHeaders(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const thead = table.querySelector('thead');
  if (!thead) return;
  
  const ths = thead.querySelectorAll('th.sortable');
  ths.forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    const col = th.getAttribute('data-column');
    if (sortState[tableId] && sortState[tableId].column === col) {
      th.classList.add(sortState[tableId].direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

function renderMoversTable(summary, tableType, metric = 'absolute') {
  const tableId = tableType === 'pending' ? 'pending-increase-table' : 'total-increase-table';
  const tbody = document.querySelector(`#${tableId} tbody`);
  const thead = document.querySelector(`#${tableId} thead`);
  
  if (!tbody) return;
  
  // Update header sort indicators
  if (thead) {
    const ths = thead.querySelectorAll('th.sortable');
    ths.forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      const col = th.getAttribute('data-column');
      if (sortState[tableId].column === col) {
        th.classList.add(sortState[tableId].direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }
  
  // Get all districts and filter/sort based on metric
  const allDistricts = Object.values(summary.byDistrict || {});
  
  // Determine which field to use for sorting
  const deltaField = tableType === 'pending' 
    ? (metric === 'percentage' ? 'pendingPctDelta' : 'pendingDelta')
    : (metric === 'percentage' ? 'totalPctDelta' : 'totalDelta');
  
  // Filter for positive changes and sort by the selected metric
  let data = allDistricts
    .filter(d => d[deltaField] > 0)
    .sort((a, b) => b[deltaField] - a[deltaField])
    .slice(0, 10);
  
  // Apply column sorting if active
  const sortCol = sortState[tableId].column;
  const sortDir = sortState[tableId].direction;
  
  if (sortCol && data.length > 0) {
    data = [...data];
    data.sort((a, b) => {
      let aVal, bVal;
      
      switch(sortCol) {
        case 'District':
          aVal = getFullDistrictName(a.District) || '';
          bVal = getFullDistrictName(b.District) || '';
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'Current':
          aVal = tableType === 'pending' ? (a.pending || 0) : (a.total || 0);
          bVal = tableType === 'pending' ? (b.pending || 0) : (b.total || 0);
          break;
        case 'Prior':
          aVal = tableType === 'pending' ? (a.priorPending || 0) : (a.priorTotal || 0);
          bVal = tableType === 'pending' ? (b.priorPending || 0) : (b.priorTotal || 0);
          break;
        case 'Delta':
          aVal = tableType === 'pending' ? (a.pendingDelta || 0) : (a.totalDelta || 0);
          bVal = tableType === 'pending' ? (b.pendingDelta || 0) : (b.totalDelta || 0);
          break;
        case 'PctDelta':
          aVal = tableType === 'pending' ? (a.pendingPctDelta || 0) : (a.totalPctDelta || 0);
          bVal = tableType === 'pending' ? (b.pendingPctDelta || 0) : (b.totalPctDelta || 0);
          break;
        default:
          aVal = 0;
          bVal = 0;
      }
      
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }
  
  tbody.innerHTML = '';
  
  // top 10 positive movers (for display) — All Others = everything else, Total = all districts
  const allPositive = allDistricts.filter(d => d[deltaField] > 0).sort((a, b) => b[deltaField] - a[deltaField]);
  const top10Set = new Set(allPositive.slice(0, 10).map(d => d.District));
  const othersData = allDistricts.filter(d => !top10Set.has(d.District));

  if (Array.isArray(data) && data.length > 0) {
    data.forEach((d, idx) => {
      const row = document.createElement('tr');
      
      const current = tableType === 'pending' ? d.pending : d.total;
      const prior = tableType === 'pending' ? d.priorPending : d.priorTotal;
      const delta = tableType === 'pending' ? d.pendingDelta : d.totalDelta;
      const pctDelta = tableType === 'pending' ? d.pendingPctDelta : d.totalPctDelta;
      
      const deltaClass = delta >= 0 ? 'delta-positive' : 'delta-negative';
      
      row.innerHTML = `
        <td style="color:var(--color-text-secondary);font-size:0.78rem;text-align:right;padding-right:6px">${idx + 1}</td>
        <td>${getFullDistrictName(d.District) || ''}</td>
        <td>${current != null ? current.toLocaleString() : ''}</td>
        <td>${prior != null ? prior.toLocaleString() : ''}</td>
        <td class="${deltaClass}">${delta >= 0 ? '+' : ''}${delta != null ? delta.toLocaleString() : ''}</td>
        <td class="${deltaClass}">${pctDelta >= 0 ? '+' : ''}${pctDelta != null ? pctDelta.toFixed(1) : ''}%</td>
      `;
      
      // Add expand button in last cell
      const expandCell = document.createElement('td');
      const expandBtn = document.createElement('button');
      expandBtn.className = 'expand-btn';
      expandBtn.setAttribute('data-district', d.District);
      expandBtn.innerHTML = '<span class="chevron-icon"></span>';
      expandCell.appendChild(expandBtn);
      row.appendChild(expandCell);
      
      tbody.appendChild(row);
    });

    // All Others row
    if (othersData.length > 0) {
      const oCurrent = othersData.reduce((s, d) => s + (tableType === 'pending' ? (d.pending || 0) : (d.total || 0)), 0);
      const oPrior   = othersData.reduce((s, d) => s + (tableType === 'pending' ? (d.priorPending || 0) : (d.priorTotal || 0)), 0);
      const oDelta   = othersData.reduce((s, d) => s + (tableType === 'pending' ? (d.pendingDelta || 0) : (d.totalDelta || 0)), 0);
      const oPct     = oPrior ? (oDelta / oPrior * 100) : 0;
      const oDc = oDelta >= 0 ? 'delta-positive' : 'delta-negative';
      const othersRow = document.createElement('tr');
      othersRow.innerHTML = `
        <td style="color:var(--color-text-secondary);font-size:0.78rem;text-align:right;padding-right:6px">11</td>
        <td style="color:var(--color-text-secondary)">All Others</td>
        <td style="color:var(--color-text-secondary)">${oCurrent.toLocaleString()}</td>
        <td style="color:var(--color-text-secondary)">${oPrior.toLocaleString()}</td>
        <td class="${oDc}">${oDelta >= 0 ? '+' : ''}${oDelta.toLocaleString()}</td>
        <td class="${oDc}">${oPct >= 0 ? '+' : ''}${oPct.toFixed(1)}%</td>
        <td></td>
      `;
      tbody.appendChild(othersRow);
    }

    // Total row
    const tCurrent = allDistricts.reduce((s, d) => s + (tableType === 'pending' ? (d.pending || 0) : (d.total || 0)), 0);
    const tPrior   = allDistricts.reduce((s, d) => s + (tableType === 'pending' ? (d.priorPending || 0) : (d.priorTotal || 0)), 0);
    const tDelta   = allDistricts.reduce((s, d) => s + (tableType === 'pending' ? (d.pendingDelta || 0) : (d.totalDelta || 0)), 0);
    const tPct     = tPrior ? (tDelta / tPrior * 100) : 0;
    const tDc = tDelta >= 0 ? 'delta-positive' : 'delta-negative';
    const totalRow = document.createElement('tr');
    totalRow.style.borderTop = '1px solid var(--color-border)';
    totalRow.innerHTML = `
      <td></td>
      <td style="font-weight:700">Total</td>
      <td style="font-weight:700">${tCurrent.toLocaleString()}</td>
      <td style="font-weight:700">${tPrior.toLocaleString()}</td>
      <td class="${tDc}" style="font-weight:700">${tDelta >= 0 ? '+' : ''}${tDelta.toLocaleString()}</td>
      <td class="${tDc}" style="font-weight:700">${tPct >= 0 ? '+' : ''}${tPct.toFixed(1)}%</td>
      <td></td>
    `;
    tbody.appendChild(totalRow);
  } else {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="7" style="text-align:center;">No data</td>';
    tbody.appendChild(row);
  }
  
  // Setup expand button listeners using event delegation (handled in DOMContentLoaded)
}

function renderMDLMoversTable(summary, tableType, metric = 'absolute') {
  const tableId = tableType === 'pending' ? 'mdl-pending-increase-table' : 'mdl-total-increase-table';
  const tbody = document.querySelector(`#${tableId} tbody`);
  
  if (!tbody) return;
  
  // Get all MDLs and filter/sort based on metric
  const allMDLs = Object.values(summary.byMDL || {});
  
  // Determine which field to use for sorting
  const deltaField = tableType === 'pending' 
    ? (metric === 'percentage' ? 'pendingPctDelta' : 'pendingDelta')
    : (metric === 'percentage' ? 'totalPctDelta' : 'totalDelta');
  
  // Filter for positive changes and sort by the selected metric
  let data = allMDLs
    .filter(d => d[deltaField] > 0)
    .sort((a, b) => b[deltaField] - a[deltaField])
    .slice(0, 10);
  
  // Apply column sorting if sort state exists
  const sortCol = sortState[tableId]?.column;
  const sortDir = sortState[tableId]?.direction || 'desc';
  
  if (sortCol && data && data.length > 0) {
    const columnMapping = {
      'Current': tableType === 'pending' ? 'pending' : 'total',
      'Prior': tableType === 'pending' ? 'priorPending' : 'priorTotal',
      'Delta': tableType === 'pending' ? 'pendingDelta' : 'totalDelta',
      'PctDelta': tableType === 'pending' ? 'pendingPctDelta' : 'totalPctDelta'
    };
    data = sortData(data, sortCol, sortDir, columnMapping);
  }
  
  // Update sort headers
  updateSortHeaders(tableId);
  
  tbody.innerHTML = '';
  
  if (Array.isArray(data) && data.length > 0) {
    data.forEach(d => {
      const row = document.createElement('tr');
      
      const current = tableType === 'pending' ? d.pending : d.total;
      const prior = tableType === 'pending' ? d.priorPending : d.priorTotal;
      const delta = tableType === 'pending' ? d.pendingDelta : d.totalDelta;
      const pctDelta = tableType === 'pending' ? d.pendingPctDelta : d.totalPctDelta;
      
      const deltaClass = delta >= 0 ? 'delta-positive' : 'delta-negative';
      
      row.innerHTML = `
        <td>${d.MDL || ''}</td>
        <td>${d.Title || ''}</td>
        <td>${current != null ? current.toLocaleString() : ''}</td>
        <td>${prior != null ? prior.toLocaleString() : ''}</td>
        <td class="${deltaClass}">${delta >= 0 ? '+' : ''}${delta != null ? delta.toLocaleString() : ''}</td>
        <td class="${deltaClass}">${pctDelta >= 0 ? '+' : ''}${pctDelta != null ? pctDelta.toFixed(1) : ''}%</td>
      `;
      
      tbody.appendChild(row);
    });
  } else {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="6" style="text-align:center;">No data</td>';
    tbody.appendChild(row);
  }
}

function renderNewMDLsTable(summary, tableId = 'current-new-mdls-table') {
  const tbody = document.querySelector(`#${tableId} tbody`);
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  let newMDLs = summary.newMDLs || [];
  
  // Apply sorting if sort state exists
  const sortCol = sortState[tableId]?.column;
  const sortDir = sortState[tableId]?.direction || 'desc';
  
  if (sortCol && newMDLs.length > 0) {
    const columnMapping = { 'Count': 'abs' };
    newMDLs = sortData(newMDLs, sortCol, sortDir, columnMapping);
  }
  
  // Update sort headers
  updateSortHeaders(tableId);
  
  if (newMDLs.length > 0) {
    newMDLs.forEach(mdl => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${mdl.MDL || ''}</td>
        <td>${mdl.Title || ''}</td>
        <td>${getFullDistrictName(mdl.District) || ''}</td>
        <td>${mdl.abs != null ? mdl.abs.toLocaleString() : ''}</td>
      `;
      tbody.appendChild(row);
    });
  } else {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4" style="text-align:center;">No new MDLs</td>';
    tbody.appendChild(row);
  }
}

function renderRemovedMDLsTable(summary, tableId = 'current-removed-mdls-table') {
  const tbody = document.querySelector(`#${tableId} tbody`);
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  let removedMDLs = summary.removedMDLs || [];
  
  // Apply sorting if sort state exists
  const sortCol = sortState[tableId]?.column;
  const sortDir = sortState[tableId]?.direction || 'desc';
  
  if (sortCol && removedMDLs.length > 0) {
    const columnMapping = { 'Count': 'abs' };
    removedMDLs = sortData(removedMDLs, sortCol, sortDir, columnMapping);
  }
  
  // Update sort headers
  updateSortHeaders(tableId);
  
  if (removedMDLs.length > 0) {
    removedMDLs.forEach(mdl => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${mdl.MDL || ''}</td>
        <td>${mdl.Title || ''}</td>
        <td>${getFullDistrictName(mdl.District) || ''}</td>
        <td>${mdl.abs != null ? mdl.abs.toLocaleString() : ''}</td>
      `;
      tbody.appendChild(row);
    });
  } else {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4" style="text-align:center;">No removed MDLs</td>';
    tbody.appendChild(row);
  }
}

async function renderCurrentMonthNewMDLs() {
  // Get the latest month and the previous month
  if (!months || months.length < 2) {
    console.warn('renderCurrentMonthNewMDLs: Insufficient months data', { months, length: months?.length });
    const newTbody = document.querySelector('#current-new-mdls-table tbody');
    const removedTbody = document.querySelector('#current-removed-mdls-table tbody');
    if (newTbody) {
      newTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Insufficient data</td></tr>';
    }
    if (removedTbody) {
      removedTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Insufficient data</td></tr>';
    }
    return;
  }
  
  const latestMonth = months[months.length - 1];
  const previousMonth = months[months.length - 2];
  
  console.log('renderCurrentMonthNewMDLs: Comparing', { latestMonth, previousMonth });
  
  const latestData = await loadDataForMonth(latestMonth);
  const previousData = await loadDataForMonth(previousMonth);
  
  console.log('renderCurrentMonthNewMDLs: Data loaded', { 
    latestCount: latestData?.length, 
    previousCount: previousData?.length 
  });
  
  // Compute summary to get new and removed MDLs
  const summary = computeSummary(latestData, previousData);
  
  console.log('renderCurrentMonthNewMDLs: Summary computed', { 
    newMDLs: summary.newMDLs?.length, 
    removedMDLs: summary.removedMDLs?.length 
  });
  
  // Render both new and removed MDLs tables
  renderNewMDLsTable(summary, 'current-new-mdls-table');
  renderRemovedMDLsTable(summary, 'current-removed-mdls-table');
}

function getDistrictBreakdownForMonth(monthData, districtName) {
  const longName = shortToLongDistrictMap[districtName] || districtName;
  const rows = monthData.filter(d => d.District === districtName || d.District === longName);
  
  let mdlsAvailable = false;
  let activeMdls = [], pendingMdls = [], totalMdls = [];
  let activeTotal = 0, pendingTotal = 0, totalTotal = 0;
  
  if (rows.length > 0 && rows.some(d => d.MDL || d['MDL Name'] || d['Case Name'])) {
    mdlsAvailable = true;
    rows.forEach(d => {
      const mdlNum = d.MDL || d['MDL Name'] || d['Case Name'] || '';
      const title = d.Title || d['Case Name'] || '';
      const active = d['Pending'] || d['Active'] || 0;
      const pending = d['Pending'] || 0;
      const total = d['Total'] || 0;
      
      if (active > 0) activeMdls.push({ mdlNum, title, count: active });
      if (pending > 0) pendingMdls.push({ mdlNum, title, count: pending });
      if (total > 0) totalMdls.push({ mdlNum, title, count: total });
      
      activeTotal += active;
      pendingTotal += pending;
      totalTotal += total;
    });
    
    activeMdls.sort((a, b) => b.count - a.count);
    pendingMdls.sort((a, b) => b.count - a.count);
    totalMdls.sort((a, b) => b.count - a.count);
  } else {
    mdlsAvailable = false;
    const d = rows[0] || {};
    activeTotal = d['Pending'] || d['Active'] || 0;
    pendingTotal = d['Pending'] || 0;
    totalTotal = d['Total'] || 0;
  }
  
  return {
    activeMdls,
    pendingMdls,
    totalMdls,
    totals: { active: activeTotal, pending: pendingTotal, total: totalTotal },
    mdlsAvailable
  };
}

async function handleExpandClick(btn) {
  const tr = btn.closest('tr');
  const table = btn.closest('table');
  if (!tr || !table) return;
  
  const tableId = table.id;
  const district = btn.getAttribute('data-district');
  
  // Check if this row is already expanded
  const isExpanded = btn.classList.contains('expanded');
  
  // Close any open details in this table
  closeOpenDetails(tableId);
  
  // If was already expanded, just collapse and return
  if (isExpanded) {
    return;
  }
  
  // Mark this button as expanded
  btn.classList.add('expanded');
  
  // Determine which data to show based on table
  const isPendingTable = tableId === 'pending-increase-table';
  
  // Fetch ONLY current month breakdown
  const currentData = await loadDataForMonth(endMonth);
  const currentBreakdown = getDistrictBreakdownForMonth(currentData, district);
  
  // Choose which MDLs to display based on table type
  const currentMdls = isPendingTable ? currentBreakdown.pendingMdls : currentBreakdown.totalMdls;
  const currentTotal = isPendingTable ? currentBreakdown.totals.pending : currentBreakdown.totals.total;
  const label = isPendingTable ? 'Pending Count' : 'Total Count';
  
  // Debug logging
  if (DEBUG_INLINE_DETAILS) {
    console.log('=== Inline Details Debug (Current Only) ===');
    console.log('tableId:', tableId);
    console.log('district:', district);
    console.log('isPendingTable:', isPendingTable);
    console.log('endMonth:', endMonth);
    console.log('currentMdls count:', currentMdls.length);
    console.log('currentTotal:', currentTotal);
    console.log('mdlsAvailable:', currentBreakdown.mdlsAvailable);
  }
  
  // Insert inline details row with SINGLE current month section
  const colCount = table.querySelectorAll('thead th').length;
  const detailsRow = document.createElement('tr');
  detailsRow.className = 'inline-details-row';
  detailsRow.setAttribute('data-district', district);
  
  detailsRow.innerHTML = `<td colspan="${colCount}">
    <div class="inline-details-single">
      <div class="inline-section-title">${label}: ${endMonth}</div>
      ${renderInlineMdlsSection(currentMdls, currentTotal, currentBreakdown.mdlsAvailable, label)}
    </div>
  </td>`;
  
  tr.parentNode.insertBefore(detailsRow, tr.nextSibling);
  
  // Debug: confirm insertion
  if (DEBUG_INLINE_DETAILS) {
    console.log('detailsRow inserted (current only), colspan:', colCount);
    console.log('thead th count:', table.querySelectorAll('thead th').length);
  }
}

function renderTrendChart() {}

// Global variable to store the trends overview chart instance
let trendsOverviewChart = null;

// ─── Forecasting helpers & state ─────────────────────────────────────────────────────────
let fcAggChart = null;
let fcDistrictChart = null;

function linReg(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const Sxx = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const Sxy = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const slope = Sxx < 1e-9 ? 0 : Sxy / Sxx;
  const intercept = yMean - slope * xMean;
  const yHat = xs.map(x => slope * x + intercept);
  const ss_res = ys.reduce((s, y, i) => s + (y - yHat[i]) ** 2, 0);
  const ss_tot = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);
  const r2 = ss_tot < 1 ? 1 : Math.max(0, 1 - ss_res / ss_tot);
  const se = n > 2 ? Math.sqrt(ss_res / (n - 2)) : 0;
  return { slope, intercept, r2, se, xMean, Sxx, n };
}

function predCI(reg, x, z = 1.96) {
  const { slope, intercept, se, xMean, Sxx, n } = reg;
  const yHat = slope * x + intercept;
  const margin = z * se * Math.sqrt(1 + 1 / n + (x - xMean) ** 2 / (Sxx || 1));
  return { yHat: Math.max(0, yHat), lower: Math.max(0, yHat - margin), upper: yHat + margin };
}

function shiftMonth(dateStr, n) {
  const [y, m] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function momentumLabel(slope) {
  if (slope > 150)  return { text: '⬆ Rapidly Rising',    cls: 'fc-up2' };
  if (slope > 30)   return { text: '↑ Rising',           cls: 'fc-up1' };
  if (slope > -30)  return { text: '→ Stable',           cls: 'fc-flat' };
  if (slope > -150) return { text: '↓ Declining',        cls: 'fc-dn1' };
  return               { text: '⬇ Rapidly Declining', cls: 'fc-dn2' };
}

function r2Badge(r2) {
  const pct = (r2 * 100).toFixed(0);
  const cls = r2 >= 0.7 ? 'fc-r2-hi' : r2 >= 0.4 ? 'fc-r2-mid' : 'fc-r2-lo';
  return `<span class="fc-r2 ${cls}">${pct}%</span>`;
}

function fcChartColors() {
  const light = document.documentElement.classList.contains('light-theme');
  return {
    text:       light ? '#333' : '#ddd',
    grid:       light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)',
    tooltipBg:  light ? 'rgba(255,255,255,0.95)' : 'rgba(18,18,18,0.93)'
  };
}

async function renderForecastingTab() {
  const container = document.getElementById('forecasting-tab');
  if (!container || container.dataset.loaded) return;

  // ─ Load all months ───────────────────────────────────────────────────────────
  const allData = {};
  for (const m of months) allData[m] = await loadDataForMonth(m);

  const FORECAST_N    = 6;
  const WINDOW        = 12;
  const lastMonth     = months[months.length - 1];
  const futureMonths  = Array.from({ length: FORECAST_N }, (_, i) => shiftMonth(lastMonth, i + 1));

  // ─ Aggregate totals per month ────────────────────────────────────────────────
  const aggPending = months.map(m =>
    allData[m].reduce((s, r) => s + (r.Pending || 0), 0)
  );
  const xs     = months.map((_, i) => i);
  const aggReg = linReg(xs, aggPending);
  const histLen = months.length;

  // Build full label array (historical + forecast markers)
  const allLabels = [
    ...months.map(formatMonthYear),
    ...futureMonths.map(m => formatMonthYear(m) + ' ▸')
  ];
  const totalLen  = histLen + FORECAST_N;

  // Regression line across full span
  const regLine = Array.from({ length: totalLen }, (_, i) => predCI(aggReg, i).yHat);

  // Forecast bars and CI
  const fcVals  = Array.from({ length: FORECAST_N }, (_, i) =>
    Math.max(0, aggReg.slope * (histLen + i) + aggReg.intercept));
  const ciUpper = Array.from({ length: FORECAST_N }, (_, i) => predCI(aggReg, histLen + i).upper);
  const ciLower = Array.from({ length: FORECAST_N }, (_, i) => predCI(aggReg, histLen + i).lower);

  // Padded arrays
  const histBars = [...aggPending,             ...Array(FORECAST_N).fill(null)];
  const fcBars   = [...Array(histLen).fill(null), ...fcVals];
  const ciUArr   = [...Array(histLen).fill(null), ...ciUpper];
  const ciLArr   = [...Array(histLen).fill(null), ...ciLower];

  // ─ Aggregate forecast chart ───────────────────────────────────────────────────
  if (fcAggChart) { fcAggChart.destroy(); fcAggChart = null; }
  const c = fcChartColors();
  const aggCanvas = document.getElementById('fc-agg-chart');

  fcAggChart = new Chart(aggCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: allLabels,
      datasets: [
        {
          type: 'bar', label: 'Actual (Pending)',
          data: histBars,
          backgroundColor: 'rgba(54,162,235,0.6)',
          borderColor: 'rgba(54,162,235,1)', borderWidth: 1, order: 3
        },
        {
          type: 'bar', label: 'Forecast',
          data: fcBars,
          backgroundColor: 'rgba(255,165,0,0.45)',
          borderColor: 'rgba(255,165,0,0.85)', borderWidth: 1, order: 3
        },
        {
          type: 'line', label: 'Regression line',
          data: regLine,
          borderColor: 'rgba(255,99,132,0.85)', borderWidth: 2,
          borderDash: [6, 3], pointRadius: 0, tension: 0, order: 1, fill: false
        },
        {
          type: 'line', label: '95% CI upper',
          data: ciUArr,
          borderColor: 'transparent',
          backgroundColor: 'rgba(255,165,0,0.15)',
          pointRadius: 0, tension: 0, fill: '+1', order: 2
        },
        {
          type: 'line', label: '95% CI lower',
          data: ciLArr,
          borderColor: 'transparent', backgroundColor: 'transparent',
          pointRadius: 0, tension: 0, fill: false, order: 2
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        datalabels: { display: false },
        legend: {
          position: 'top',
          labels: {
            filter: item => !item.text.startsWith('95%'),
            color: c.text, usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: c.tooltipBg, titleColor: c.text, bodyColor: c.text,
          callbacks: {
            label: ctx => {
              if (ctx.parsed.y === null || ctx.dataset.label.startsWith('95%')) return null;
              return `${ctx.dataset.label}: ${Math.round(ctx.parsed.y).toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45, minRotation: 45,
            color: ctx => ctx.index >= histLen ? 'rgba(255,165,0,0.9)' : c.text
          },
          grid: { color: c.grid }
        },
        y: {
          beginAtZero: false,
          title: { display: true, text: 'Pending Cases', color: c.text },
          ticks: { color: c.text, callback: v => v.toLocaleString() },
          grid: { color: c.grid }
        }
      }
    },
    plugins: [ChartDataLabels]
  });

  // Stats bar
  const nxt = predCI(aggReg, histLen);
  const sDir = aggReg.slope >= 0 ? '+' : '';
  document.getElementById('fc-agg-stats').innerHTML =
    `<span class="fc-stat">Trend slope <strong>${sDir}${Math.round(aggReg.slope).toLocaleString()} cases/mo</strong></span>` +
    `<span class="fc-stat">Model fit (R²) <strong>${(aggReg.r2 * 100).toFixed(1)}%</strong></span>` +
    `<span class="fc-stat">Next month projection <strong>${Math.round(nxt.yHat).toLocaleString()}</strong>` +
    ` <span class="fc-ci">(95% CI: ${Math.round(nxt.lower).toLocaleString()} – ${Math.round(nxt.upper).toLocaleString()})</span></span>`;

  // ─ Per-MDL momentum (last WINDOW months) ───────────────────────────────────────
  const recentMonths = months.slice(-WINDOW);
  const mdlHistory = {};
  for (let i = 0; i < recentMonths.length; i++) {
    for (const row of allData[recentMonths[i]] || []) {
      const mdl = row.MDL || ''; if (!mdl) continue;
      if (!mdlHistory[mdl]) mdlHistory[mdl] = { title: row.Title || '', pending: Array(recentMonths.length).fill(null) };
      mdlHistory[mdl].pending[i] = row.Pending || 0;
    }
  }

  const mdlStats = [];
  for (const [mdl, info] of Object.entries(mdlHistory)) {
    const valid = info.pending.reduce((a, v, i) => { if (v !== null) a.push({ x: i, y: v }); return a; }, []);
    if (valid.length < 6) continue;
    const r = linReg(valid.map(v => v.x), valid.map(v => v.y));
    if (!r) continue;
    const lastPending = info.pending.filter(v => v !== null).pop();
    if ((lastPending || 0) < 10) continue;
    const proj6 = Math.max(0, r.slope * (WINDOW + 6) + r.intercept);
    const projDelta = proj6 - (lastPending || 0);
    mdlStats.push({ mdl, title: info.title, slope: r.slope, r2: r.r2, lastPending, proj6, projDelta });
  }
  mdlStats.sort((a, b) => b.slope - a.slope);

  function mdlRows(list) {
    return list.map(s => {
      const mom  = momentumLabel(s.slope);
      const sStr = (s.slope >= 0 ? '+' : '') + Math.round(s.slope).toLocaleString();
      const dStr = (s.projDelta >= 0 ? '+' : '') + Math.round(s.projDelta).toLocaleString();
      return `<tr>
        <td style="font-size:.74rem;font-weight:600">${s.mdl}</td>
        <td class="ks-clamp">${s.title}</td>
        <td class="ks-num">${Math.round(s.lastPending).toLocaleString()}</td>
        <td class="ks-num"><span class="fc-mom ${mom.cls}">${mom.text}</span></td>
        <td class="ks-num">${sStr}</td>
        <td class="ks-num">${dStr}</td>
        <td class="ks-num">${r2Badge(s.r2)}</td>
      </tr>`;
    }).join('');
  }

  document.getElementById('fc-rising-tbody').innerHTML   = mdlRows(mdlStats.slice(0, 10));
  document.getElementById('fc-declining-tbody').innerHTML = mdlRows([...mdlStats].reverse().slice(0, 10));

  // ─ District momentum horizontal bar chart ───────────────────────────────────────
  const distHistory = {};
  for (let i = 0; i < recentMonths.length; i++) {
    for (const row of allData[recentMonths[i]] || []) {
      const d = row.District || ''; if (!d) continue;
      if (!distHistory[d]) distHistory[d] = Array(recentMonths.length).fill(0);
      distHistory[d][i] += row.Pending || 0;
    }
  }

  const distStats = [];
  for (const [dist, pending] of Object.entries(distHistory)) {
    const nzIdx = pending.reduce((a, v, i) => { if (v > 0) a.push(i); return a; }, []);
    if (nzIdx.length < 6) continue;
    const r = linReg(nzIdx, nzIdx.map(i => pending[i]));
    if (!r) continue;
    distStats.push({ dist, slope: r.slope, r2: r.r2 });
  }
  distStats.sort((a, b) => b.slope - a.slope);

  const topRising   = distStats.slice(0, 8);
  const topDecline  = [...distStats].reverse().slice(0, 8);
  const seen        = new Set(topRising.map(d => d.dist));
  const distDisplay = [
    ...topDecline.filter(d => !seen.has(d.dist)),
    ...topRising
  ].sort((a, b) => a.slope - b.slope);

  if (fcDistrictChart) { fcDistrictChart.destroy(); fcDistrictChart = null; }
  const distCanvas = document.getElementById('fc-district-chart');

  fcDistrictChart = new Chart(distCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: distDisplay.map(d => d.dist),
      datasets: [{
        label: 'Monthly trend (pending cases/mo)',
        data: distDisplay.map(d => d.slope),
        backgroundColor: distDisplay.map(d =>
          d.slope >= 0 ? 'rgba(72,199,142,0.72)' : 'rgba(255,99,132,0.72)'),
        borderColor: distDisplay.map(d =>
          d.slope >= 0 ? 'rgba(72,199,142,1)' : 'rgba(255,99,132,1)'),
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        datalabels: { display: false },
        legend: { display: false },
        tooltip: {
          backgroundColor: c.tooltipBg, titleColor: c.text, bodyColor: c.text,
          callbacks: {
            label: ctx => {
              const s = ctx.parsed.x;
              return `Trend: ${s >= 0 ? '+' : ''}${Math.round(s)} cases/mo`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Monthly trend (pending cases / mo)', color: c.text },
          grid: { color: c.grid }, ticks: { color: c.text }
        },
        y: { ticks: { color: c.text } }
      }
    },
    plugins: [ChartDataLabels]
  });

  container.dataset.loaded = '1';
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Source Reports ──────────────────────────────────────────────────────────
async function renderSourceReports() {
  const grid = document.getElementById('source-reports-grid');
  if (!grid || grid.dataset.loaded) return;

  let files;
  try {
    const res = await fetch('/data/pdfs/index.json');
    files = await res.json();
  } catch (e) {
    grid.innerHTML = '<p style="color:var(--color-text-secondary)">Unable to load source files.</p>';
    return;
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Parse filename → { month, day, year, label }
  function parsePdf(filename) {
    const noExt = filename.replace(/\.pdf$/i, '');
    const parts = noExt.split('By_District-');
    const raw = parts.length > 1 ? parts[1] : noExt;
    const segs = raw.replace(/_\d+$/, '').split('-');  // strip _0 suffix
    const [month, day, year] = segs;
    return { month, day, year: Number(year), label: month, filename };
  }

  const parsed = files.map(parsePdf).filter(p => p.year);

  parsed.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month);
  });

  // Group by year
  const byYear = {};
  for (const p of parsed) {
    if (!byYear[p.year]) byYear[p.year] = [];
    byYear[p.year].push(p);
  }

  grid.innerHTML = Object.keys(byYear)
    .sort((a, b) => Number(b) - Number(a))
    .map(year => {
      const chips = byYear[year].map(p => {
        const url = `/data/pdfs/${encodeURIComponent(p.filename)}`;
        return `<a class="sr-chip" href="${url}" target="_blank" rel="noopener">${p.label}</a>`;
      }).join('');
      return `<div class="sr-year-group">
        <span class="sr-year">${year}</span>
        <div class="sr-chips">${chips}</div>
      </div>`;
    }).join('');

  grid.dataset.loaded = '1';
}
// ─────────────────────────────────────────────────────────────────────────────

async function renderTrendsOverview(mode = 'pending') {
  const canvas = document.getElementById('trends-overview-chart');
  if (!canvas) {
    console.error('Trends overview canvas not found');
    return;
  }
  
  if (!months || months.length === 0) {
    console.warn('No months data available for trends chart');
    return;
  }
  
  // Load data for all months and calculate totals + dominant MDLs
  const chartData = [];
  
  for (const month of months) {
    const data = await loadDataForMonth(month);
    
    // Calculate totals
    let totalPending = 0;
    let totalAll = 0;
    const mdlCounts = {};
    
    for (const row of data) {
      const pending = row['Pending'] || 0;
      const total = row['Total'] || 0;
      const mdl = row['MDL'] || row['MDL Name'] || '';
      const title = row['Title'] || '';
      
      totalPending += pending;
      totalAll += total;
      
      if (mdl) {
        if (!mdlCounts[mdl]) {
          mdlCounts[mdl] = { pending: 0, total: 0, title: title };
        }
        mdlCounts[mdl].pending += pending;
        mdlCounts[mdl].total += total;
      }
    }
    
    const totalTerminated = totalAll - totalPending;
    
    // Find MDLs that are >20% of total based on selected mode
    const dominantMDLs = [];
    const referenceTotal = mode === 'total' ? totalAll : totalPending;
    
    for (const [mdl, info] of Object.entries(mdlCounts)) {
      const count = mode === 'total' ? info.total : info.pending;
      const percentage = (count / referenceTotal) * 100;
      if (percentage > 20) {
        dominantMDLs.push({
          mdl: mdl,
          title: info.title,
          count: count,
          percentage: percentage
        });
      }
    }
    
    // Sort dominant MDLs by percentage descending
    dominantMDLs.sort((a, b) => b.percentage - a.percentage);
    
    chartData.push({
      month: month,
      pending: totalPending,
      total: totalAll,
      terminated: totalTerminated,
      dominantMDLs: dominantMDLs
    });
  }
  
  // Calculate 3-month moving average
  const movingAverage = [];
  const windowSize = 3;
  
  for (let i = 0; i < chartData.length; i++) {
    if (i < windowSize - 1) {
      // Not enough data for full window, use null
      movingAverage.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        const value = mode === 'total' ? chartData[i - j].total : chartData[i - j].pending;
        sum += value;
      }
      movingAverage.push(sum / windowSize);
    }
  }
  
  // Prepare Chart.js data
  const labels = chartData.map(d => formatMonthYear(d.month));
  
  // Destroy existing chart if it exists
  if (trendsOverviewChart) {
    trendsOverviewChart.destroy();
    trendsOverviewChart = null;
  }
  
  const ctx = canvas.getContext('2d');
  
  // Create datasets based on mode
  let datasets = [];
  let yAxisLabel = '';
  let stacked = false;
  
  if (mode === 'all') {
    // Stacked bar chart
    stacked = true;
    yAxisLabel = 'Total Cases';
    datasets = [
      {
        type: 'bar',
        label: 'Pending Cases',
        data: chartData.map(d => d.pending),
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        stack: 'cases',
        order: 2
      },
      {
        type: 'bar',
        label: 'Terminated Cases',
        data: chartData.map(d => d.terminated),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        stack: 'cases',
        order: 2
      },
      {
        type: 'line',
        label: '3-Month Moving Average',
        data: movingAverage,
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.4,
        order: 1,
        spanGaps: true,
        pointStyle: 'line'
      }
    ];
  } else if (mode === 'pending') {
    yAxisLabel = 'Pending Cases';
    datasets = [
      {
        type: 'bar',
        label: 'Pending Cases',
        data: chartData.map(d => d.pending),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        order: 2
      },
      {
        type: 'line',
        label: '3-Month Moving Average',
        data: movingAverage,
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.4,
        order: 1,
        spanGaps: true,
        pointStyle: 'line'
      }
    ];
  } else {
    // total mode
    yAxisLabel = 'Total Cases';
    datasets = [
      {
        type: 'bar',
        label: 'Total Cases',
        data: chartData.map(d => d.total),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
        order: 2
      },
      {
        type: 'line',
        label: '3-Month Moving Average',
        data: movingAverage,
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.4,
        order: 1,
        spanGaps: true,
        pointStyle: 'line'
      }
    ];
  }
  
  trendsOverviewChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
          display: false
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            color: function(context) {
              return document.documentElement.classList.contains('light-theme') ? '#333' : '#fff';
            }
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: function(context) {
            return document.documentElement.classList.contains('light-theme') 
              ? 'rgba(255, 255, 255, 0.95)' 
              : 'rgba(0, 0, 0, 0.85)';
          },
          titleColor: function(context) {
            return document.documentElement.classList.contains('light-theme') ? '#333' : '#fff';
          },
          bodyColor: function(context) {
            return document.documentElement.classList.contains('light-theme') ? '#333' : '#fff';
          },
          borderColor: function(context) {
            return document.documentElement.classList.contains('light-theme') ? '#ccc' : '#555';
          },
          borderWidth: 1,
          padding: 15,
          titleFont: {
            size: 16,
            weight: 'bold'
          },
          bodyFont: {
            size: 14
          },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += Math.round(context.parsed.y).toLocaleString();
              }
              return label;
            },
            afterBody: function(context) {
              const index = context[0].dataIndex;
              const dominantMDLs = chartData[index].dominantMDLs;
              
              if (dominantMDLs.length > 0) {
                const lines = ['\nDominant MDLs (>20%):'];
                dominantMDLs.forEach(mdl => {
                  lines.push(`${mdl.mdl} - ${mdl.title}`);
                  lines.push(`  ${Math.round(mdl.count).toLocaleString()} cases (${mdl.percentage.toFixed(1)}%)`);
                });
                return lines;
              }
              return [];
            }
          }
        },
        datalabels: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          stacked: stacked,
          title: {
            display: true,
            text: yAxisLabel,
            color: function(context) {
              return document.documentElement.classList.contains('light-theme') ? '#333' : '#fff';
            }
          },
          ticks: {
            color: function(context) {
              return document.documentElement.classList.contains('light-theme') ? '#333' : '#fff';
            },
            callback: function(value) {
              return value.toLocaleString();
            }
          },
          grid: {
            color: function(context) {
              return document.documentElement.classList.contains('light-theme') ? '#e0e0e0' : '#333';
            }
          }
        },
        x: {
          stacked: stacked,
          title: {
            display: true,
            text: 'Month',
            color: function(context) {
              return document.documentElement.classList.contains('light-theme') ? '#333' : '#fff';
            }
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            color: function(context) {
              return document.documentElement.classList.contains('light-theme') ? '#333' : '#fff';
            }
          },
          grid: {
            color: function(context) {
              return document.documentElement.classList.contains('light-theme') ? '#e0e0e0' : '#333';
            }
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
  
  console.log('Trends overview chart rendered with', chartData.length, 'months in', mode, 'mode');
}


function renderTopDistrictsTable(summary) {
  const tbody = document.getElementById('top-districts-list');
  
  if (!tbody) {
    console.error('Top districts table tbody not found');
    return;
  }
  
  // Determine default sort: if user hasn't sorted, use pending desc
  const tableId = 'top-districts-table';
  const sortCol = sortState[tableId]?.column;
  const sortDir = sortState[tableId]?.direction || 'desc';
  
  // Determine which field drives the "top 10" selection (pending unless user sorted by Total)
  const rankField = (sortCol === 'Total') ? 'total' : 'pending';
  const rankLabel = (sortCol === 'Total') ? 'Total Cases' : 'Pending Cases';
  
  // Update subtitle to reflect current ranking
  const subtitle = document.getElementById('top-districts-subtitle');
  if (subtitle) subtitle.textContent = `Ranked by ${rankLabel} · Click any row to see its individual MDLs below`;
  
  // Get all districts sorted by rank field, take top 10
  let topDistricts = Object.values(summary.byDistrict || {})
    .map(d => ({
      ...d,
      terminated: (d.total || 0) - (d.pending || 0)
    }))
    .sort((a, b) => b[rankField] - a[rankField])
    .slice(0, 10);
  
  // Apply secondary column sort if active
  if (sortCol && topDistricts.length > 0) {
    const columnMapping = {
      'Pending': 'pending',
      'Terminated': 'terminated',
      'Total': 'total'
    };
    topDistricts = sortData(topDistricts, sortCol, sortDir, columnMapping);
  }
  
  // Update sort headers
  updateSortHeaders(tableId);
  
  // All districts for All Others / Total
  const allDistrictsSorted = Object.values(summary.byDistrict || {})
    .map(d => ({ ...d, terminated: (d.total || 0) - (d.pending || 0) }))
    .sort((a, b) => b[rankField] - a[rankField]);
  const othersDistricts = allDistrictsSorted.slice(10);

  const top10Rows = topDistricts.map((d, i) => {
    return `<tr class="clickable-row" data-district="${d.District || ''}" style="cursor:pointer;">
      <td style="color:var(--color-text-secondary);font-size:0.78rem;text-align:right;padding-right:6px">${i + 1}</td>
      <td>${getFullDistrictName(d.District) || ''}</td>
      <td class="num">${d.pending != null ? d.pending.toLocaleString() : '0'}</td>
      <td class="num">${d.terminated != null ? d.terminated.toLocaleString() : '0'}</td>
      <td class="num">${d.total != null ? d.total.toLocaleString() : '0'}</td>
    </tr>`;
  });

  // All Others row
  if (othersDistricts.length > 0) {
    const oPending    = othersDistricts.reduce((s, d) => s + (d.pending || 0), 0);
    const oTerminated = othersDistricts.reduce((s, d) => s + (d.terminated || 0), 0);
    const oTotal      = othersDistricts.reduce((s, d) => s + (d.total || 0), 0);
    top10Rows.push(`<tr>
      <td style="color:var(--color-text-secondary);font-size:0.78rem;text-align:right;padding-right:6px">11</td>
      <td style="color:var(--color-text-secondary)">All Others</td>
      <td class="num" style="color:var(--color-text-secondary)">${oPending.toLocaleString()}</td>
      <td class="num" style="color:var(--color-text-secondary)">${oTerminated.toLocaleString()}</td>
      <td class="num" style="color:var(--color-text-secondary)">${oTotal.toLocaleString()}</td>
    </tr>`);
  }

  // Total row
  const tPending    = allDistrictsSorted.reduce((s, d) => s + (d.pending || 0), 0);
  const tTerminated = allDistrictsSorted.reduce((s, d) => s + (d.terminated || 0), 0);
  const tTotal      = allDistrictsSorted.reduce((s, d) => s + (d.total || 0), 0);
  top10Rows.push(`<tr style="border-top:1px solid var(--color-border)">
    <td></td>
    <td style="font-weight:700">Total</td>
    <td class="num" style="font-weight:700">${tPending.toLocaleString()}</td>
    <td class="num" style="font-weight:700">${tTerminated.toLocaleString()}</td>
    <td class="num" style="font-weight:700">${tTotal.toLocaleString()}</td>
  </tr>`);

  tbody.innerHTML = top10Rows.join('');
  
  // Wire up row click handlers
  tbody.querySelectorAll('tr.clickable-row').forEach(row => {
    row.addEventListener('click', () => {
      const districtAbbr = row.getAttribute('data-district');
      if (districtAbbr && currentEndData.length > 0) {
        // Highlight selected row
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('row-selected'));
        row.classList.add('row-selected');
        renderDistrictDetails(districtAbbr, currentEndData, summary);
      }
    });
  });
}

// Global variable to store the chart instance
let districtPieChart = null;

function renderDistrictPieChart(summary, currentMonthData = []) {
  const canvas = document.getElementById('district-pie-chart');
  const legendEl = document.getElementById('pie-chart-legend');
  
  console.log('renderDistrictPieChart called', { 
    canvas: !!canvas, 
    legendEl: !!legendEl,
    summaryByDistrict: Object.keys(summary?.byDistrict || {}).length,
    currentMonthData: currentMonthData?.length
  });
  
  if (!canvas) {
    console.error('Pie chart canvas not found');
    return;
  }
  
  // Get top 5 districts by case count
  const allDistricts = Object.values(summary.byDistrict)
    .sort((a, b) => b.abs - a.abs);
  
  console.log('renderDistrictPieChart: All districts', allDistricts.length);
  
  const top5 = allDistricts.slice(0, 5);
  const others = allDistricts.slice(5);
  const othersTotal = others.reduce((sum, d) => sum + d.abs, 0);
  
  // Prepare data
  const labels = top5.map(d => d.District);
  const data = top5.map(d => d.abs);
  
  if (othersTotal > 0) {
    labels.push('All Others');
    data.push(othersTotal);
  }
  
  // Color palette
  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // green
    '#6b7280'  // gray for "All Others"
  ];
  
  // Calculate total for percentages
  const total = data.reduce((a, b) => a + b, 0);
  
  // Destroy existing chart if it exists
  if (districtPieChart) {
    districtPieChart.destroy();
  }
  
  // Get current theme colors from CSS variables
  const textColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-text-primary').trim() || '#e6edf3';
  const tooltipBg = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-bg-tertiary').trim() || '#21262d';
  const borderColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-bg-secondary').trim() || '#161b22';
  
  // Create new chart with datalabels
  districtPieChart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: borderColor
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          const districtName = labels[index];
          
          // Skip if "All Others" is clicked
          if (districtName === 'All Others') {
            return;
          }
          
          // Show district details
          renderDistrictDetails(districtName, currentMonthData, summary);
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            padding: 15,
            font: {
              size: 12
            },
            color: textColor,
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const percentage = ((value / total) * 100).toFixed(1);
                  return {
                    text: `${label} (${percentage}%)`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    fontColor: textColor,
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          callbacks: {
            title: function(context) {
              const label = context[0].label || '';
              const value = context[0].parsed || 0;
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value.toLocaleString()} (${percentage}%)`;
            },
            label: function(context) {
              const districtName = context.label || '';
              
              // Skip MDL list for "All Others"
              if (districtName === 'All Others') {
                return '';
              }
              
              // Get MDLs for this district from current month data
              const districtMDLs = currentMonthData
                .filter(row => row.District === districtName)
                .map(row => ({
                  mdl: row['MDL'] || row['MDL Name'] || '',
                  count: row['Pending'] || 0
                }))
                .filter(m => m.mdl) // Only include rows with MDL numbers
                .sort((a, b) => b.count - a.count) // Sort by count descending
                .slice(0, 10); // Top 10 MDLs
              
              // Return empty if no MDLs
              if (districtMDLs.length === 0) {
                return '';
              }
              
              // Format as array of strings for multi-line tooltip
              return districtMDLs.map(m => `  ${m.mdl}: ${m.count.toLocaleString()}`);
            },
            footer: function(context) {
              const districtName = context[0].label || '';
              if (districtName === 'All Others') {
                return ['', 'Click on a district slice to see full MDL details'];
              }
              
              const districtMDLs = currentMonthData
                .filter(row => row.District === districtName)
                .filter(row => row['MDL'] || row['MDL Name']);
              
              const lines = [];
              if (districtMDLs.length > 10) {
                lines.push(`  ... and ${districtMDLs.length - 10} more`);
              }
              lines.push('', 'Click to see full details');
              return lines;
            }
          },
          backgroundColor: tooltipBg,
          titleColor: textColor,
          bodyColor: textColor,
          footerColor: getComputedStyle(document.documentElement)
            .getPropertyValue('--color-text-secondary').trim() || '#7d8590',
          padding: 12,
          displayColors: false,
          bodyFont: {
            family: 'monospace',
            size: 11
          },
          titleFont: {
            size: 13,
            weight: 'bold'
          }
        },
        datalabels: {
          display: false
        }
      }
    }
  });
}

function renderDistrictDetails(districtName, currentMonthData, summary) {
  const detailSection = document.getElementById('district-detail-section');
  const detailTitle = document.getElementById('district-detail-title');
  const detailTable = document.getElementById('district-detail-table');
  const tbody = detailTable.querySelector('tbody');
  
  if (!detailSection || !detailTitle || !tbody) return;
  
  // Get MDLs for this district
  let districtMDLs = currentMonthData
    .filter(row => row.District === districtName)
    .filter(row => row['MDL'] || row['MDL Name'])
    .map(row => ({
      mdl: row['MDL'] || row['MDL Name'] || '',
      title: row['Title'] || '',
      pending: row['Pending'] || 0,
      total: row['Total'] || 0,
      terminated: (row['Total'] || 0) - (row['Pending'] || 0)
    }));
  
  // Apply sorting if sort state exists
  const tableId = 'district-detail-table';
  const sortCol = sortState[tableId]?.column;
  const sortDir = sortState[tableId]?.direction || 'desc';
  
  if (sortCol && districtMDLs.length > 0) {
    const columnMapping = { 'MDL': 'mdl', 'Title': 'title', 'Pending': 'pending', 'Total': 'total', 'Terminated': 'terminated' };
    districtMDLs = sortData(districtMDLs, sortCol, sortDir, columnMapping);
  } else if(!sortCol) {
    // Default sort by pending desc
    districtMDLs.sort((a, b) => b.pending - a.pending);
  }
  
  // Update sort headers
  updateSortHeaders(tableId);
  
  // Get district summary stats
  const districtSummary = summary.byDistrict[districtName] || {};
  const districtPending = districtSummary.pending || 0;
  const districtTotal = districtSummary.total || 0;
  const districtTerminated = districtTotal - districtPending;
  const percentage = districtPending && summary.total ? 
    ((districtPending / summary.total) * 100).toFixed(1) : '0.0';
  
  // Update title
  detailTitle.textContent = `${getFullDistrictName(districtName)} - ${districtPending.toLocaleString()} pending cases (${percentage}%)`;
  
  // Populate table
  tbody.innerHTML = '';
  
  if (districtMDLs.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="5" style="text-align:center;">No MDL data available</td>';
    tbody.appendChild(row);
  } else {
    // Add summary row first
    const summaryRow = document.createElement('tr');
    summaryRow.style.fontWeight = '600';
    summaryRow.style.background = 'var(--color-bg-tertiary)';
    summaryRow.innerHTML = `
      <td colspan="2">District Total</td>
      <td>${districtTerminated.toLocaleString()}</td>
      <td>${districtPending.toLocaleString()}</td>
      <td>${districtTotal.toLocaleString()}</td>
    `;
    tbody.appendChild(summaryRow);
    
    // Add individual MDLs
    districtMDLs.forEach(mdl => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${mdl.mdl}</td>
        <td>${mdl.title}</td>
        <td>${mdl.terminated.toLocaleString()}</td>
        <td>${mdl.pending.toLocaleString()}</td>
        <td>${mdl.total.toLocaleString()}</td>
      `;
      tbody.appendChild(row);
    });
  }
  
  // Show section
  detailSection.hidden = false;
  
  // Scroll to detail section
  detailSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Executive Summary Tab ──────────────────────────────────────────────────
function renderExecutiveSummary(summary, endData) {
  const el = document.getElementById('executive-summary-tab');
  if (!el) return;

  const allMDLArr  = Object.values(summary.byMDL || {});
  const allDistArr = Object.values(summary.byDistrict || {});

  // Derived counts
  const activeMDLCount  = allMDLArr.filter(m => m.pending > 0).length;
  const activeDistCount = allDistArr.filter(d => d.pending > 0).length;
  const nationalTotal   = allDistArr.reduce((s, d) => s + (d.total || 0), 0);

  // Top MDL by pending
  const topMDL = allMDLArr.slice().sort((a, b) => b.pending - a.pending)[0] || {};
  // Fastest growing MDL MoM
  const fastMDL = (summary.mdlPendingIncrease || [])[0] || null;
  // Top districts sorted
  const topDist = allDistArr.slice().sort((a, b) => b.pending - a.pending);
  const topDistrict = topDist[0] || {};
  // Fastest growing district
  const fastDist = (summary.pendingIncrease || [])[0] || null;

  const newCount     = (summary.newMDLs     || []).length;
  const removedCount = (summary.removedMDLs || []).length;

  const deltaClass = summary.nationalDelta >= 0 ? 'delta-positive' : 'delta-negative';
  const deltaSign  = summary.nationalDelta >= 0 ? '+' : '';
  const pctSign    = summary.nationalPctDelta >= 0 ? '+' : '';

  const topDistShare  = summary.total ? (topDistrict.pending / summary.total * 100) : 0;
  const topMDLShare   = summary.total ? (topMDL.pending   / summary.total * 100) : 0;
  const top1BarWidth  = topDist[0]?.pending || 1; // denominator for relative bars

  el.innerHTML = `
    <!-- ── Row 1: Key Metrics ── -->
    <div class="es-section">
      <div class="es-section-header">
        <h3 class="es-section-title">National Overview</h3>
      </div>
      <div class="es-metrics-grid">
        <div class="es-metric-tile es-tile-primary">
          <div class="es-metric-label">National Pending Cases</div>
          <div class="es-metric-value">${summary.total.toLocaleString()}</div>
        </div>
        <div class="es-metric-tile">
          <div class="es-metric-label">National Total Cases</div>
          <div class="es-metric-value">${nationalTotal.toLocaleString()}</div>
        </div>
        <div class="es-metric-tile">
          <div class="es-metric-label">MoM Pending Δ</div>
          <div class="es-metric-value"><span class="${deltaClass}">${deltaSign}${summary.nationalDelta.toLocaleString()}</span></div>
          <div class="es-metric-sub">${pctSign}${summary.nationalPctDelta.toFixed(2)}%</div>
        </div>
        <div class="es-metric-tile">
          <div class="es-metric-label">Active MDL Proceedings</div>
          <div class="es-metric-value">${activeMDLCount.toLocaleString()}</div>
          <div class="es-metric-sub">with &ge;1 pending case</div>
        </div>
        <div class="es-metric-tile">
          <div class="es-metric-label">Active Jurisdictions</div>
          <div class="es-metric-value">${activeDistCount}</div>
        </div>
        <div class="es-metric-tile">
          <div class="es-metric-label">Top 5 District Share</div>
          <div class="es-metric-value">${(summary.top5Share * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>

    <!-- ── Row 2: Spotlight Cards ── -->
    <div class="es-section">
      <div class="es-section-header">
        <h3 class="es-section-title">Spotlight</h3>
      </div>
      <div class="es-spotlight-grid">

        <div class="dashboard-card es-spotlight-card">
          <div class="es-spotlight-label">Largest MDL by Pending</div>
          <div class="es-spotlight-mdl-num">${topMDL.MDL || 'N/A'}</div>
          <div class="es-spotlight-mdl-title">${topMDL.Title || ''}</div>
          <div class="es-spotlight-stats">
            <span class="es-stat-chip">${(topMDL.pending || 0).toLocaleString()} pending</span>
            <span class="es-stat-chip es-chip-accent">${topMDLShare.toFixed(1)}% of national</span>
          </div>
          <div class="es-spotlight-dist">${getFullDistrictName(topMDL.District) || ''}</div>
        </div>

        ${fastMDL ? `
        <div class="dashboard-card es-spotlight-card">
          <div class="es-spotlight-label">Fastest Growing MDL (MoM)</div>
          <div class="es-spotlight-mdl-num">${fastMDL.MDL}</div>
          <div class="es-spotlight-mdl-title">${fastMDL.Title}</div>
          <div class="es-spotlight-stats">
            <span class="es-stat-chip delta-positive">+${fastMDL.pendingDelta.toLocaleString()} pending</span>
            <span class="es-stat-chip delta-positive">+${fastMDL.pendingPctDelta.toFixed(1)}% Δ</span>
          </div>
          <div class="es-spotlight-dist">${getFullDistrictName(fastMDL.District)}</div>
        </div>` : ''}

        <div class="dashboard-card es-spotlight-card">
          <div class="es-spotlight-label">Leading Jurisdiction</div>
          <div class="es-spotlight-dist-name">${getFullDistrictName(topDistrict.District) || 'N/A'}</div>
          <div class="es-spotlight-stats">
            <span class="es-stat-chip">${(topDistrict.pending || 0).toLocaleString()} pending</span>
            <span class="es-stat-chip es-chip-accent">${topDistShare.toFixed(1)}% of national</span>
          </div>
          ${fastDist && fastDist.District !== topDistrict.District ? `
          <div class="es-spotlight-secondary">Fastest growing: <strong>${getFullDistrictName(fastDist.District)}</strong> (+${fastDist.pendingDelta.toLocaleString()})</div>` : ''}
        </div>

        <div class="dashboard-card es-spotlight-card">
          <div class="es-spotlight-label">Proceedings Activity (This Period)</div>
          <div class="es-activity-row">
            <div class="es-activity-item">
              <span class="es-activity-val delta-positive">+${newCount}</span>
              <span class="es-activity-label">New</span>
            </div>
            <div class="es-activity-divider"></div>
            <div class="es-activity-item">
              <span class="es-activity-val es-activity-neg">−${removedCount}</span>
              <span class="es-activity-label">Removed</span>
            </div>
            <div class="es-activity-divider"></div>
            <div class="es-activity-item">
              <span class="es-activity-val">${activeMDLCount}</span>
              <span class="es-activity-label">Active Total</span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ── Row 3: Jurisdiction Distribution ── -->
    <div class="es-section">
      <div class="es-section-header">
        <h3 class="es-section-title">Jurisdiction Distribution: Top 10 by Pending</h3>
      </div>
      <div class="dashboard-card es-dist-card">
        <div class="es-dist-list">
          ${(() => {
            const top10 = topDist.slice(0, 10);
            const others = topDist.slice(10);
            const othersPending = others.reduce((s, d) => s + (d.pending || 0), 0);
            const othersDelta   = others.reduce((s, d) => s + (d.pendingDelta || 0), 0);
            const rows = top10.map((d, i) => {
              const pct = summary.total ? (d.pending / summary.total * 100) : 0;
              const relWidth = (d.pending / top1BarWidth * 100).toFixed(1);
              const dc = d.pendingDelta >= 0 ? 'delta-positive' : 'delta-negative';
              const ds = d.pendingDelta >= 0 ? '+' : '';
              return `
              <div class="es-dist-row">
                <div class="es-dist-rank">${i + 1}</div>
                <div class="es-dist-name">${getFullDistrictName(d.District)}</div>
                <div class="es-dist-bar-wrap">
                  <div class="es-dist-bar" style="width:${relWidth}%"></div>
                </div>
                <div class="es-dist-pct">${pct.toFixed(1)}%</div>
                <div class="es-dist-count">${d.pending.toLocaleString()}</div>
                <div class="es-dist-delta ${dc}">${ds}${d.pendingDelta.toLocaleString()}</div>
              </div>`;
            });
            if (others.length > 0) {
              const pct = summary.total ? (othersPending / summary.total * 100) : 0;
              const relWidth = (othersPending / top1BarWidth * 100).toFixed(1);
              const dc = othersDelta >= 0 ? 'delta-positive' : 'delta-negative';
              const ds = othersDelta >= 0 ? '+' : '';
              rows.push(`
              <div class="es-dist-row es-dist-row-others">
                <div class="es-dist-rank">11</div>
                <div class="es-dist-name" style="color:var(--color-text-secondary)">All Others</div>
                <div class="es-dist-bar-wrap">
                  <div class="es-dist-bar" style="width:${relWidth}%;opacity:0.45"></div>
                </div>
                <div class="es-dist-pct" style="color:var(--color-text-secondary)">${pct.toFixed(1)}%</div>
                <div class="es-dist-count" style="color:var(--color-text-secondary)">${othersPending.toLocaleString()}</div>
                <div class="es-dist-delta ${dc}">${ds}${othersDelta.toLocaleString()}</div>
              </div>`);
            }
            // Total row
            const allPending = topDist.reduce((s, d) => s + (d.pending || 0), 0);
            const allDelta   = topDist.reduce((s, d) => s + (d.pendingDelta || 0), 0);
            const totalDc = allDelta >= 0 ? 'delta-positive' : 'delta-negative';
            const totalDs = allDelta >= 0 ? '+' : '';
            rows.push(`
              <div class="es-dist-row es-dist-row-total">
                <div class="es-dist-rank"></div>
                <div class="es-dist-name" style="font-weight:700;color:var(--color-text-primary)">Total</div>
                <div class="es-dist-bar-wrap"></div>
                <div class="es-dist-pct" style="font-weight:700;color:var(--color-text-primary)">100%</div>
                <div class="es-dist-count" style="font-weight:700;color:var(--color-text-primary)">${allPending.toLocaleString()}</div>
                <div class="es-dist-delta ${totalDc}" style="font-weight:700">${totalDs}${allDelta.toLocaleString()}</div>
              </div>`);
            return rows.join('');
          })()}
        </div>
      </div>
    </div>

    <!-- ── Row 4: Concentration Analysis ── -->
    <div class="es-section">
      <div class="es-section-header">
        <h3 class="es-section-title">Concentration Analysis</h3>
      </div>
      <div class="es-conc-grid">
        <div class="dashboard-card es-conc-card">
          <div class="es-conc-label">Herfindahl–Hirschman Index (HHI)</div>
          <div class="es-conc-value">${summary.hhi.toLocaleString()}</div>
          <div class="es-conc-badge es-conc-${(summary.concentration || '').toLowerCase()}">${summary.concentration}</div>
          <p class="es-conc-desc">HHI measures case concentration across jurisdictions. Values above 2,500 indicate high concentration; below 1,500 reflects broader geographic distribution.</p>
        </div>
        <div class="dashboard-card es-conc-card">
          <div class="es-conc-label">Top 5 Jurisdictions Share</div>
          <div class="es-conc-value">${(summary.top5Share * 100).toFixed(1)}%</div>
          <div class="es-conc-sub">${(100 - summary.top5Share * 100).toFixed(1)}% distributed across remaining jurisdictions</div>
          <div class="es-top5-bar-wrap">
            <div class="es-top5-bar-fill" style="width:${(summary.top5Share * 100).toFixed(1)}%"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// KEY SUMMARIES — Trends Overview tab  (see #trend-key-summaries in HTML)
// ─────────────────────────────────────────────────────────────

/** Compute top judges by active MDL count.
 *  Scans all loaded months to build historical totals per judge.
 *  Active = that judge's MDL has Pending > 0 in endRows.
 *  Not Active = appeared historically but not active in endRows.
 *  Ordered by active count descending.
 */
async function computeTopJudges(endRows) {
  // Build active-MDL set from end month: judge → Set of MDL ids with Pending > 0
  const activeByJudge = {};
  const distByJudge   = {};
  for (const r of endRows) {
    const judge = r['Judge'] || 'Unknown';
    const mdl   = r['MDL']   || '';
    const dist  = r['District'] || '';
    if (!distByJudge[judge]) distByJudge[judge] = {};
    distByJudge[judge][dist] = (distByJudge[judge][dist] || 0) + 1;
    if ((r['Pending'] || 0) > 0) {
      if (!activeByJudge[judge]) activeByJudge[judge] = new Set();
      activeByJudge[judge].add(mdl);
    }
  }

  // Scan all cached months to find every MDL ever assigned to each judge
  const allMdlsByJudge = {};
  for (const month of months) {
    const rows = await loadDataForMonth(month);
    for (const r of rows) {
      const judge = r['Judge'] || 'Unknown';
      const mdl   = r['MDL']   || '';
      if (!allMdlsByJudge[judge]) allMdlsByJudge[judge] = new Set();
      allMdlsByJudge[judge].add(mdl);
    }
  }

  return Object.keys(allMdlsByJudge)
    .map(judge => {
      const total     = allMdlsByJudge[judge].size;
      const active    = (activeByJudge[judge] || new Set()).size;
      const notActive = total - active;
      const distCounts = distByJudge[judge] || {};
      const district  = Object.entries(distCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      return { judge, district, active, notActive, total };
    })
    .sort((a, b) => b.active - a.active);
}

/** Compute top 10 MDLs by Pending/Total ratio (Total >= 50, Pending > 0). */
function computeMostActiveMdls(endRows) {
  return endRows
    .filter(r => (r['Total'] || 0) >= 50 && (r['Pending'] || 0) > 0)
    .map(r => ({
      mdl:     r['MDL'] || '',
      title:   r['Title'] || '',
      pending: r['Pending'] || 0,
      total:   r['Total'] || 0,
      ratio:   (r['Pending'] || 0) / (r['Total'] || 1)
    }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 10);
}

/**
 * Compute MoM net pending change and top 5 district + MDL contributors.
 * Returns null if start and end rows are identical references.
 */
function computeMoMDrivers(startRows, endRows) {
  if (!startRows || !endRows) return null;

  // Build end maps
  const endDistMap = {};
  const endMdlMap  = {};
  for (const r of endRows) {
    const dist = r['District'] || '';
    const mdl  = r['MDL'] || '';
    endDistMap[dist] = (endDistMap[dist] || 0) + (r['Pending'] || 0);
    if (!endMdlMap[mdl]) endMdlMap[mdl] = { mdl, title: r['Title'] || '', end: 0, start: 0 };
    endMdlMap[mdl].end += (r['Pending'] || 0);
  }

  // Build start maps
  const startDistMap = {};
  for (const r of startRows) {
    const dist = r['District'] || '';
    const mdl  = r['MDL'] || '';
    startDistMap[dist] = (startDistMap[dist] || 0) + (r['Pending'] || 0);
    if (!endMdlMap[mdl]) endMdlMap[mdl] = { mdl, title: r['Title'] || '', end: 0, start: 0 };
    endMdlMap[mdl].start += (r['Pending'] || 0);
  }

  // Merge district deltas
  const allDists = new Set([...Object.keys(endDistMap), ...Object.keys(startDistMap)]);
  const distDeltas = [];
  for (const dist of allDists) {
    const delta = (endDistMap[dist] || 0) - (startDistMap[dist] || 0);
    distDeltas.push({ name: getFullDistrictName(dist) || dist, delta });
  }

  const netChange = distDeltas.reduce((s, d) => s + d.delta, 0);
  const distGross  = distDeltas.reduce((s, d) => s + Math.abs(d.delta), 0) || 1;

  const allMdlDeltas = Object.values(endMdlMap)
    .map(d => ({ ...d, delta: d.end - d.start }));
  const mdlGross = allMdlDeltas.reduce((s, d) => s + Math.abs(d.delta), 0) || 1;

  const topDistricts = distDeltas
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .map(d => ({ ...d, pct: d.delta / distGross * 100 }));

  const topMdls = allMdlDeltas
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .map(d => ({ ...d, pct: d.delta / mdlGross * 100 }));

  return { netChange, distGross, mdlGross, topDistricts, topMdls };
}

/** Format a signed number with + prefix. */
function fmtSigned(n) {
  return (n >= 0 ? '+' : '') + n.toLocaleString();
}

/** Render all three Key Summary modules into #trend-key-summaries. */
async function renderKeySummaries(endData, startData) {
  const activeLbl = document.getElementById('active-mdls-month-label');
  if (endMonth) {
    const [y, m] = endMonth.split('-');
    const mName  = new Date(+y, +m - 1, 1).toLocaleString('default', { month: 'long' });
    const lbl    = `${mName} ${y}`;
    if (activeLbl) activeLbl.textContent = lbl;
  }

  // ── Module 1: Top Judges ──
  const judgesTbody = document.getElementById('top-judges-tbody');
  if (judgesTbody) {
    judgesTbody.innerHTML = '<tr><td colspan="5" style="color:var(--color-text-secondary);text-align:center">Loading…</td></tr>';
    const allJudges = await computeTopJudges(endData);
    const monthLbl = document.getElementById('top-judges-month-label');
    if (monthLbl && endMonth) {
      const [y, m] = endMonth.split('-');
      monthLbl.textContent = new Date(+y, +m - 1, 1).toLocaleString('default', { month: 'long' }) + ' ' + y + ' (active status)';
    }
    const top10 = allJudges.slice(0, 10);
    const others = allJudges.slice(10);
    const othersActive    = others.reduce((s, j) => s + j.active, 0);
    const othersNotActive = others.reduce((s, j) => s + j.notActive, 0);
    const othersTotal     = others.reduce((s, j) => s + j.total, 0);
    const grandActive     = allJudges.reduce((s, j) => s + j.active, 0);
    const grandNotActive  = allJudges.reduce((s, j) => s + j.notActive, 0);
    const grandTotal      = allJudges.reduce((s, j) => s + j.total, 0);
    judgesTbody.innerHTML = top10.map(j => `<tr>
      <td class="ks-clamp">${j.judge}</td>
      <td style="white-space:nowrap">${getFullDistrictName(j.district) || j.district}</td>
      <td class="ks-num delta-positive">${j.active}</td>
      <td class="ks-num" style="color:var(--color-text-secondary)">${j.notActive}</td>
      <td class="ks-num">${j.total}</td>
    </tr>`).join('') +
    (others.length ? `<tr style="color:var(--color-text-secondary);font-style:italic">
      <td colspan="2">All Others (${others.length} judges)</td>
      <td class="ks-num delta-positive" style="font-style:normal">${othersActive}</td>
      <td class="ks-num" style="font-style:normal">${othersNotActive}</td>
      <td class="ks-num" style="font-style:normal">${othersTotal}</td>
    </tr>` : '') +
    `<tr style="border-top:2px solid var(--color-border);font-weight:600">
      <td colspan="2">Total</td>
      <td class="ks-num delta-positive">${grandActive}</td>
      <td class="ks-num" style="color:var(--color-text-secondary)">${grandNotActive}</td>
      <td class="ks-num">${grandTotal}</td>
    </tr>`;
  }

  // ── Module 2: Most Active MDLs ──
  const activeTbody = document.getElementById('active-mdls-tbody');
  if (activeTbody) {
    const active = computeMostActiveMdls(endData);
    activeTbody.innerHTML = active.map(r => `<tr>
      <td style="white-space:nowrap">${r.mdl}</td>
      <td class="ks-clamp">${r.title}</td>
      <td class="ks-num">${r.pending.toLocaleString()}</td>
      <td class="ks-num">${r.total.toLocaleString()}</td>
      <td class="ks-num">${(r.ratio * 100).toFixed(1)}%</td>
    </tr>`).join('');
  }

  // ── Module 3: MoM Drivers ──
  const driversContent  = document.getElementById('mom-drivers-content');
  const driversLabel    = document.getElementById('mom-drivers-label');
  const driversFootnoteDist = document.getElementById('mom-drivers-footnote-dist');
  const driversFootnoteMdl  = document.getElementById('mom-drivers-footnote-mdl');
  const distTbody       = document.getElementById('mom-district-drivers-tbody');
  const mdlTbody        = document.getElementById('mom-mdl-drivers-tbody');

  if (startMonth === endMonth) {
    if (driversContent)  driversContent.style.display = 'none';
    if (driversLabel)    driversLabel.textContent = 'Select two different months to see change drivers.';
    if (driversFootnote) driversFootnote.textContent = '';
    return;
  }
  if (driversContent) driversContent.style.display = '';

  const drivers = computeMoMDrivers(startData, endData);
  if (!drivers) return;

  if (driversLabel)         driversLabel.textContent = `Net pending change: ${fmtSigned(drivers.netChange)}`;
  const fnText = '% Share = each item\'s Δ as a share of total gross movement (all increases + all decreases). Positive = added cases, negative = removed. Net = sum after offsetting gains and losses.';
  if (driversFootnoteDist)  driversFootnoteDist.textContent = fnText;
  if (driversFootnoteMdl)   driversFootnoteMdl.textContent  = fnText;

  if (distTbody) {
    const top5d   = drivers.topDistricts.slice(0, 5);
    const restd   = drivers.topDistricts.slice(5);
    const odDelta = restd.reduce((s, d) => s + d.delta, 0);
    const odPct   = odDelta / drivers.distGross * 100;
    const odDc    = odDelta >= 0 ? 'delta-positive' : 'delta-negative';
    const gtDelta = drivers.netChange;
    const gtPct   = gtDelta / drivers.distGross * 100;
    const gtDc    = gtDelta >= 0 ? 'delta-positive' : 'delta-negative';
    distTbody.innerHTML =
      top5d.map(d => {
        const dc = d.delta >= 0 ? 'delta-positive' : 'delta-negative';
        return `<tr>
          <td class="ks-clamp">${d.name}</td>
          <td class="ks-num ${dc}">${fmtSigned(d.delta)}</td>
          <td class="ks-num ${dc}">${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(1)}%</td>
        </tr>`;
      }).join('') +
      (restd.length ? `<tr style="color:var(--color-text-secondary);font-style:italic">
        <td>All Others (${restd.length})</td>
        <td class="ks-num ${odDc}" style="font-style:normal">${fmtSigned(odDelta)}</td>
        <td class="ks-num ${odDc}" style="font-style:normal">${odPct >= 0 ? '+' : ''}${odPct.toFixed(1)}%</td>
      </tr>` : '') +
      `<tr style="border-top:2px solid var(--color-border);font-weight:600">
        <td>Net Change</td>
        <td class="ks-num ${gtDc}">${fmtSigned(gtDelta)}</td>
        <td class="ks-num ${gtDc}">${gtPct >= 0 ? '+' : ''}${gtPct.toFixed(1)}%</td>
      </tr>`;
  }

  if (mdlTbody) {
    const top5m   = drivers.topMdls.slice(0, 5);
    const restm   = drivers.topMdls.slice(5);
    const omDelta = restm.reduce((s, d) => s + d.delta, 0);
    const omPct   = omDelta / drivers.mdlGross * 100;
    const omDc    = omDelta >= 0 ? 'delta-positive' : 'delta-negative';
    const gmDelta = drivers.netChange;
    const gmPct   = gmDelta / drivers.mdlGross * 100;
    const gmDc    = gmDelta >= 0 ? 'delta-positive' : 'delta-negative';
    mdlTbody.innerHTML =
      top5m.map(d => {
        const dc = d.delta >= 0 ? 'delta-positive' : 'delta-negative';
        return `<tr>
          <td style="white-space:nowrap">${d.mdl}</td>
          <td class="ks-clamp">${d.title}</td>
          <td class="ks-num ${dc}">${fmtSigned(d.delta)}</td>
          <td class="ks-num ${dc}">${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(1)}%</td>
        </tr>`;
      }).join('') +
      (restm.length ? `<tr style="color:var(--color-text-secondary);font-style:italic">
        <td colspan="2">All Others (${restm.length})</td>
        <td class="ks-num ${omDc}" style="font-style:normal">${fmtSigned(omDelta)}</td>
        <td class="ks-num ${omDc}" style="font-style:normal">${omPct >= 0 ? '+' : ''}${omPct.toFixed(1)}%</td>
      </tr>` : '') +
      `<tr style="border-top:2px solid var(--color-border);font-weight:600">
        <td colspan="2">Net Change</td>
        <td class="ks-num ${gmDc}">${fmtSigned(gmDelta)}</td>
        <td class="ks-num ${gmDc}">${gmPct >= 0 ? '+' : ''}${gmPct.toFixed(1)}%</td>
      </tr>`;
  }
}

async function updateDashboard() {
  const startSelect = document.getElementById('start-month-select');
  const endSelect = document.getElementById('end-month-select');
  
  if (!startSelect || !endSelect || !startSelect.value || !endSelect.value) {
    console.warn('Cannot update dashboard: month selects not ready', {
      startSelect: !!startSelect,
      endSelect: !!endSelect,
      startValue: startSelect?.value,
      endValue: endSelect?.value
    });
    return;
  }
  
  startMonth = startSelect.value;
  endMonth = endSelect.value;

  // Update "Current Month" tab label to reflect the selected end month
  const tabBtn = document.getElementById('tab-current-month');
  if (tabBtn && endMonth) {
    const [year, mon] = endMonth.split('-');
    const monthName = new Date(+year, +mon - 1, 1).toLocaleString('default', { month: 'long' });
    tabBtn.textContent = `${monthName} ${year} Statistics`;
  }
  
  const startData = await loadDataForMonth(startMonth);
  const endData = await loadDataForMonth(endMonth);
  
  console.log('updateDashboard: Data loaded', { 
    startData: startData?.length, 
    endData: endData?.length 
  });
  
  const summary = computeSummary(endData, startData);
  currentEndData = endData;   // store for district detail click handlers
  currentStartData = startData; // store for Key Summaries MoM drivers
  
  // renderPanels removed — metrics now in Executive Summary tab
  
  const mdlListEl = document.getElementById('top-mdls-list');
  if (mdlListEl) {
    let topMDLs = Array.isArray(endData)
      ? endData.slice().map(d => ({
          MDL: d['MDL'] || d['MDL Name'] || d['Case Name'] || d['District'],
          Title: d['Title'] || d['Case Name'] || '',
          District: d['District'] || '',
          Count: d['Pending'] || 0
        }))
      : [];
    
    // Apply sorting if sort state exists
    const tableId = 'dashboard-mdl-table';
    const sortCol = sortState[tableId]?.column;
    const sortDir = sortState[tableId]?.direction || 'desc';
    
    if (sortCol && topMDLs.length > 0) {
      topMDLs = sortData(topMDLs, sortCol, sortDir);
    } else {
      // Default sort by Count descending
      topMDLs.sort((a, b) => b.Count - a.Count);
    }
    
    // Take top 10, keep rest for All Others
    const allMDLs = topMDLs; // full sorted list
    topMDLs = allMDLs.slice(0, 10);
    const otherMDLs = allMDLs.slice(10);
    const othersCount = otherMDLs.reduce((s, d) => s + d.Count, 0);
    const grandTotal  = allMDLs.reduce((s, d) => s + d.Count, 0);
    
    // Update sort headers
    updateSortHeaders(tableId);
    
    mdlListEl.innerHTML =
      topMDLs.map(d =>
        `<tr><td class="col-mdl">${d.MDL}</td><td class="col-title">${d.Title}</td><td class="col-district">${getFullDistrictName(d.District)}</td><td class="col-count num">${d.Count.toLocaleString()}</td></tr>`
      ).join('') +
      (otherMDLs.length ? `<tr style="color:var(--color-text-secondary);font-style:italic">
        <td class="col-mdl"></td>
        <td class="col-title">All Others (${otherMDLs.length})</td>
        <td class="col-district"></td>
        <td class="col-count num" style="font-style:normal">${othersCount.toLocaleString()}</td>
      </tr>` : '') +
      `<tr style="border-top:2px solid var(--color-border);font-weight:600">
        <td class="col-mdl"></td>
        <td class="col-title">Total</td>
        <td class="col-district"></td>
        <td class="col-count num">${grandTotal.toLocaleString()}</td>
      </tr>`;
  }
  
  renderMoversTable(summary, 'pending', metricState['district']);
  renderMoversTable(summary, 'total', metricState['district']);
  renderMDLMoversTable(summary, 'pending', metricState['mdl']);
  renderMDLMoversTable(summary, 'total', metricState['mdl']);
  renderNewMDLsTable(summary);
  renderTopDistrictsTable(summary);
  renderTrendChart();
  renderExecutiveSummary(summary, endData);
  await renderKeySummaries(endData, startData); // Key Summaries on Trends Overview tab
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load initial data
    await loadDistricts();
    const monthsLoaded = await loadMonths();
    injectDetailsModal();
    
    if (!monthsLoaded) {
      console.error('Failed to load months data');
      return;
    }
    
    // Setup tab navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const tabName = button.getAttribute('data-tab');
        
        // Remove active class from all buttons and contents
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Render trends chart when trends-overview tab is selected
        if (tabName === 'trends-overview') {
          await renderTrendsOverview(metricState['trends']);
        }
        if (tabName === 'forecasting') {
          await renderForecastingTab();
        }
        // Render source reports list on first visit
        if (tabName === 'source-reports') {
          await renderSourceReports();
        }
      });
    });
    
    // Setup subtab navigation
    const subtabButtons = document.querySelectorAll('.subtab-button');
    subtabButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const subtabName = button.getAttribute('data-subtab');
        
        // Remove active class from all subtab buttons and contents
        document.querySelectorAll('.subtab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.subtab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        document.getElementById(`${subtabName}-subtab`).classList.add('active');
      });
    });
  
  // Setup sortable table headers (use event delegation to catch dynamically added headers)
  document.body.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('sortable') && e.target.tagName === 'TH') {
      const tableId = e.target.closest('table').id;
      const column = e.target.getAttribute('data-column');
      if (tableId && column) {
        sortTable(tableId, column);
      }
    }
  });
  
  // Setup metric filter radio buttons
  document.body.addEventListener('change', async (e) => {
    if (e.target.type === 'radio') {
      // Check which metric filter changed
      if (e.target.name === 'district-metric') {
        metricState['district'] = e.target.value;
        await updateDashboard();
      } else if (e.target.name === 'mdl-metric') {
        metricState['mdl'] = e.target.value;
        await updateDashboard();
      } else if (e.target.name === 'trends-metric') {
        metricState['trends'] = e.target.value;
        await renderTrendsOverview(e.target.value);
      }
    }
  });
  
  // Event delegation for expand buttons
  document.body.addEventListener('click', async (e) => {
    if (e.target && (e.target.classList.contains('expand-btn') || e.target.parentElement?.classList.contains('expand-btn'))) {
      const btn = e.target.classList.contains('expand-btn') ? e.target : e.target.parentElement;
      await handleExpandClick(btn);
    }
    
    // Handle close district detail button - check element and parents
    const isCloseBtn = e.target.id === 'district-detail-close' || 
                       e.target.classList.contains('close-detail-btn') ||
                       e.target.parentElement?.id === 'district-detail-close' ||
                       e.target.parentElement?.classList.contains('close-detail-btn');
    
    if (isCloseBtn) {
      e.preventDefault();
      e.stopPropagation();
      const detailSection = document.getElementById('district-detail-section');
      if (detailSection) {
        detailSection.hidden = true;
      }
    }
  });
  
  // Hook called by header.js after the theme toggle is clicked
  window.onThemeToggle = async function () {
    setTimeout(async () => {
      await updateDashboard();
      const trendsTab = document.getElementById('trends-overview-tab');
      if (trendsTab && trendsTab.classList.contains('active')) {
        await renderTrendsOverview(metricState['trends']);
      }
    }, 50);
  };
  
  // Initial rendering
  await validateAndUpdate();
  
  } catch (err) {
    console.error('Error during page initialization:', err);
  }
});
