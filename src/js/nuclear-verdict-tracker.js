(function initializeNuclearVerdictTracker() {
  const DATA_URL = document.body.dataset.verdictDataUrl || '/data/nuclear-verdicts-latest.json';
  const trackerUtils = window.NuclearVerdictTrackerUtils || {};
  const normalizeVerdicts = typeof trackerUtils.normalizeVerdicts === 'function'
    ? trackerUtils.normalizeVerdicts
    : (items) => Array.isArray(items) ? items : [];
  const normalizeSearchText = typeof trackerUtils.normalizeSearchText === 'function'
    ? trackerUtils.normalizeSearchText
    : (value) => String(value ?? '').toLowerCase().trim();
  const sortFilterValues = typeof trackerUtils.sortFilterValues === 'function'
    ? trackerUtils.sortFilterValues
    : (values) => [...values].sort((left, right) => String(left).localeCompare(String(right)));
  const FILTER_KEYS = ['year', 'state', 'jurisdiction', 'caseType', 'industry', 'verdictBucket', 'punitive', 'search'];
  const DEFAULT_ROW_LIMIT = 10;

  const state = {
    verdicts: [],
    filteredVerdicts: [],
    charts: {},
    rowLimit: DEFAULT_ROW_LIMIT,
    sort: {
      key: 'year',
      direction: 'desc'
    },
    filters: {
      year: '',
      state: '',
      jurisdiction: '',
      caseType: '',
      industry: '',
      verdictBucket: '',
      punitive: '',
      search: ''
    }
  };

  const elements = {
    year: document.getElementById('filter-year'),
    state: document.getElementById('filter-state'),
    jurisdiction: document.getElementById('filter-jurisdiction'),
    caseType: document.getElementById('filter-case-type'),
    industry: document.getElementById('filter-industry'),
    verdictBucket: document.getElementById('filter-verdict-bucket'),
    punitive: document.getElementById('filter-punitive'),
    search: document.getElementById('filter-search'),
    clearFilters: document.getElementById('clear-filters'),
    status: document.getElementById('nvt-status'),
    metricTotal: document.getElementById('metric-total'),
    metricAverage: document.getElementById('metric-average'),
    metricMedian: document.getElementById('metric-median'),
    metricLargest: document.getElementById('metric-largest'),
    metricPunitiveCount: document.getElementById('metric-punitive-count'),
    tableBody: document.getElementById('nvt-table-body'),
    emptyState: document.getElementById('nvt-empty-state'),
    tableCount: document.getElementById('nvt-table-count'),
    tableSortLabel: document.getElementById('nvt-table-sort-label'),
    loadMore: document.getElementById('nvt-load-more'),
    sortButtons: Array.from(document.querySelectorAll('.nvt-sort-button')),
    yearSummaryChart: document.getElementById('year-summary-chart'),
    yearSummaryEmpty: document.getElementById('year-summary-empty'),
    stateSummaryChart: document.getElementById('state-summary-chart'),
    stateSummaryEmpty: document.getElementById('state-summary-empty'),
    caseTypeSummaryChart: document.getElementById('case-type-summary-chart'),
    caseTypeSummaryEmpty: document.getElementById('case-type-summary-empty'),
    punitiveSummaryChart: document.getElementById('punitive-summary-chart'),
    punitiveSummaryEmpty: document.getElementById('punitive-summary-empty')
  };

  if (!elements.tableBody) {
    return;
  }

  function formatMoney(value) {
    const numericValue = Number(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(numericValue);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('en-US').format(Number(value) || 0);
  }

  function formatMoneyCell(value) {
    if (value === null || value === undefined || value === '') {
      return '<span class="nvt-missing">&mdash;</span>';
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return '<span class="nvt-missing">&mdash;</span>';
    }

    return formatMoney(numericValue);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getUniqueValues(items, key) {
    return sortFilterValues(new Set(items.map((item) => item[key]).filter(Boolean)), key);
  }

  function populateSelect(selectElement, values, placeholder, selectedValue) {
    if (!selectElement) {
      return;
    }

    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      selectElement.appendChild(option);
    });

    selectElement.value = values.includes(selectedValue) ? selectedValue : '';
    selectElement.disabled = values.length === 0;
  }

  function readFiltersFromDom() {
    state.filters.year = elements.year.value;
    state.filters.state = elements.state.value;
    state.filters.jurisdiction = elements.jurisdiction.value;
    state.filters.caseType = elements.caseType.value;
    state.filters.industry = elements.industry.value;
    state.filters.verdictBucket = elements.verdictBucket.value;
    state.filters.punitive = elements.punitive.value;
    state.filters.search = elements.search.value;
  }

  function writeFiltersToDom() {
    elements.year.value = state.filters.year;
    elements.state.value = state.filters.state;
    elements.jurisdiction.value = state.filters.jurisdiction;
    elements.caseType.value = state.filters.caseType;
    elements.industry.value = state.filters.industry;
    elements.verdictBucket.value = state.filters.verdictBucket;
    elements.punitive.value = state.filters.punitive;
    elements.search.value = state.filters.search;
  }

  function matchesFilters(verdict, filters, ignoredKey) {
    const normalizedSearch = normalizeSearchText(filters.search);

    if (ignoredKey !== 'year' && filters.year && String(verdict.year) !== filters.year) return false;
    if (ignoredKey !== 'state' && filters.state && verdict.state !== filters.state) return false;
    if (ignoredKey !== 'jurisdiction' && filters.jurisdiction && verdict.jurisdiction !== filters.jurisdiction) return false;
    if (ignoredKey !== 'caseType' && filters.caseType && verdict.caseType !== filters.caseType) return false;
    if (ignoredKey !== 'industry' && filters.industry && verdict.industry !== filters.industry) return false;
    if (ignoredKey !== 'verdictBucket' && filters.verdictBucket && verdict.verdictBucket !== filters.verdictBucket) return false;
    if (ignoredKey !== 'punitive' && filters.punitive === 'yes' && !verdict.hasPunitive) return false;
    if (ignoredKey !== 'punitive' && filters.punitive === 'no' && verdict.hasPunitive) return false;
    if (ignoredKey !== 'search' && normalizedSearch && !verdict.searchText.includes(normalizedSearch)) return false;

    return true;
  }

  function updateFilterOptions() {
    const filterConfig = [
      { key: 'year', element: elements.year, placeholder: 'All years', dataKey: 'year' },
      { key: 'state', element: elements.state, placeholder: 'All states', dataKey: 'state' },
      { key: 'jurisdiction', element: elements.jurisdiction, placeholder: 'All jurisdictions', dataKey: 'jurisdiction' },
      { key: 'caseType', element: elements.caseType, placeholder: 'All case types', dataKey: 'caseType' },
      { key: 'industry', element: elements.industry, placeholder: 'All industries', dataKey: 'industry' },
      { key: 'verdictBucket', element: elements.verdictBucket, placeholder: 'All buckets', dataKey: 'verdictBucket' }
    ];

    filterConfig.forEach(({ key, element, placeholder, dataKey }) => {
      const matchingVerdicts = state.verdicts.filter((verdict) => matchesFilters(verdict, state.filters, key));
      const values = getUniqueValues(matchingVerdicts, dataKey);
      const currentValue = state.filters[key];

      populateSelect(element, values, placeholder, currentValue);
      state.filters[key] = values.includes(currentValue) ? currentValue : '';
    });
  }

  function getMedian(values) {
    if (!values.length) {
      return 0;
    }

    const sorted = values.slice().sort((a, b) => a - b);
    const middleIndex = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
    }

    return sorted[middleIndex];
  }

  function getCounts(items, key) {
    const counts = new Map();

    items.forEach((item) => {
      const countKey = item[key] || 'Unknown';
      counts.set(countKey, (counts.get(countKey) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  function getSums(items, groupKey, valueKey) {
    const sums = new Map();

    items.forEach((item) => {
      const key = item[groupKey] || 'Unknown';
      const amount = Number(item[valueKey]) || 0;
      sums.set(key, (sums.get(key) || 0) + amount);
    });

    return [...sums.entries()]
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }

  function formatCompactMoney(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(Number(value) || 0);
  }

  function getChartColors() {
    const styles = getComputedStyle(document.documentElement);

    return {
      accent: styles.getPropertyValue('--accent').trim() || '#6ee7b7',
      accent2: styles.getPropertyValue('--accent-2').trim() || '#60a5fa',
      textSoft: styles.getPropertyValue('--text-soft').trim() || '#c4cedb',
      muted: styles.getPropertyValue('--muted').trim() || '#9aa4b2',
      grid: document.documentElement.classList.contains('light-theme')
        ? 'rgba(15,23,42,0.08)'
        : 'rgba(255,255,255,0.08)',
      doughnutNeutral: document.documentElement.classList.contains('light-theme')
        ? 'rgba(148,163,184,0.4)'
        : 'rgba(148,163,184,0.28)'
    };
  }

  function getDisplayValue(value) {
    if (value === null || value === undefined || value === '') {
      return '<span class="nvt-missing">&mdash;</span>';
    }

    return escapeHtml(value);
  }

  function sortVerdicts(verdicts) {
    const { key, direction } = state.sort;
    const multiplier = direction === 'asc' ? 1 : -1;

    return verdicts.slice().sort((left, right) => {
      const leftValue = left[key];
      const rightValue = right[key];

      if (typeof leftValue === 'number' || typeof rightValue === 'number') {
        return ((Number(leftValue) || 0) - (Number(rightValue) || 0)) * multiplier;
      }

      return String(leftValue || '').localeCompare(String(rightValue || ''), undefined, { sensitivity: 'base' }) * multiplier;
    });
  }

  function updateSortUi() {
    const sortLabels = {
      year: 'year',
      state: 'state',
      jurisdiction: 'jurisdiction',
      caseType: 'case type',
      industry: 'industry',
      totalVerdict: 'total verdict',
      compensatoryDamages: 'compensatory damages',
      punitiveDamages: 'punitive damages'
    };

    elements.sortButtons.forEach((button) => {
      const isActive = button.dataset.sortKey === state.sort.key;
      button.classList.toggle('is-active', isActive);
      button.dataset.sortDirection = isActive ? state.sort.direction : '';
      button.setAttribute('aria-sort', isActive ? (state.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    });

    if (elements.tableSortLabel) {
      const label = sortLabels[state.sort.key] || state.sort.key;
      elements.tableSortLabel.textContent = `Sorted by ${label}, ${state.sort.direction === 'asc' ? 'lowest first' : 'highest first'}.`;

      if (state.sort.key === 'state' || state.sort.key === 'jurisdiction' || state.sort.key === 'caseType' || state.sort.key === 'industry') {
        elements.tableSortLabel.textContent = `Sorted by ${label}, ${state.sort.direction === 'asc' ? 'A to Z' : 'Z to A'}.`;
      }

      if (state.sort.key === 'year') {
        elements.tableSortLabel.textContent = `Sorted by year, ${state.sort.direction === 'asc' ? 'oldest first' : 'newest first'}.`;
      }
    }
  }

  function toggleChartEmptyState(canvas, emptyElement, isEmpty, message) {
    if (!canvas || !emptyElement) {
      return;
    }

    canvas.hidden = isEmpty;
    emptyElement.hidden = !isEmpty;
    emptyElement.textContent = message;
  }

  function destroyChart(chartKey) {
    if (state.charts[chartKey]) {
      state.charts[chartKey].destroy();
      delete state.charts[chartKey];
    }
  }

  function renderChart({ chartKey, canvas, emptyElement, type, data, options, emptyMessage }) {
    if (!canvas) {
      return;
    }

    const hasData = Array.isArray(data?.datasets) && data.datasets.some((dataset) => Array.isArray(dataset.data) && dataset.data.some((value) => Number(value) > 0));

    if (!hasData) {
      destroyChart(chartKey);
      toggleChartEmptyState(canvas, emptyElement, true, emptyMessage);
      return;
    }

    toggleChartEmptyState(canvas, emptyElement, false, emptyMessage);
    destroyChart(chartKey);
    state.charts[chartKey] = new Chart(canvas, { type, data, options });
  }

  function renderVisualSummaries(verdicts) {
    if (typeof Chart !== 'function') {
      [
        [elements.yearSummaryChart, elements.yearSummaryEmpty, 'Charts are unavailable right now.'],
        [elements.caseTypeSummaryChart, elements.caseTypeSummaryEmpty, 'Charts are unavailable right now.'],
        [elements.stateSummaryChart, elements.stateSummaryEmpty, 'Charts are unavailable right now.'],
        [elements.punitiveSummaryChart, elements.punitiveSummaryEmpty, 'Charts are unavailable right now.']
      ].forEach(([canvas, emptyElement, message]) => {
        toggleChartEmptyState(canvas, emptyElement, true, message);
      });

      return;
    }

    const colors = getChartColors();
    const commonOptions = {
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          labels: {
            color: colors.textSoft,
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          callbacks: {}
        }
      },
      scales: {
        x: {
          ticks: { color: colors.muted },
          grid: { color: colors.grid }
        },
        y: {
          ticks: { color: colors.muted },
          grid: { color: colors.grid }
        }
      }
    };

    const countsByYear = getCounts(verdicts, 'year').sort((left, right) => Number(left.label) - Number(right.label));
    renderChart({
      chartKey: 'year',
      canvas: elements.yearSummaryChart,
      emptyElement: elements.yearSummaryEmpty,
      type: 'bar',
      data: {
        labels: countsByYear.map((item) => item.label),
        datasets: [{
          label: 'Verdict count',
          data: countsByYear.map((item) => item.count),
          backgroundColor: colors.accent2,
          borderRadius: 8,
          maxBarThickness: 42
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return `${formatNumber(context.raw)} verdicts`;
              }
            }
          }
        }
      },
      emptyMessage: 'No year summary available for the current filters.'
    });

    const caseTypeCounts = getCounts(verdicts, 'caseType').slice(0, 6);
    renderChart({
      chartKey: 'caseType',
      canvas: elements.caseTypeSummaryChart,
      emptyElement: elements.caseTypeSummaryEmpty,
      type: 'bar',
      data: {
        labels: caseTypeCounts.map((item) => item.label),
        datasets: [{
          label: 'Verdict count',
          data: caseTypeCounts.map((item) => item.count),
          backgroundColor: colors.accent,
          borderRadius: 8,
          maxBarThickness: 26
        }]
      },
      options: {
        ...commonOptions,
        indexAxis: 'y',
        plugins: {
          ...commonOptions.plugins,
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return `${formatNumber(context.raw)} verdicts`;
              }
            }
          }
        }
      },
      emptyMessage: 'No case type summary available for the current filters.'
    });

    const stateTotals = getSums(verdicts, 'state', 'totalVerdict').slice(0, 6);
    renderChart({
      chartKey: 'stateTotals',
      canvas: elements.stateSummaryChart,
      emptyElement: elements.stateSummaryEmpty,
      type: 'bar',
      data: {
        labels: stateTotals.map((item) => item.label),
        datasets: [{
          label: 'Total verdict dollars',
          data: stateTotals.map((item) => item.total),
          backgroundColor: colors.accent2,
          borderRadius: 8,
          maxBarThickness: 26
        }]
      },
      options: {
        ...commonOptions,
        indexAxis: 'y',
        plugins: {
          ...commonOptions.plugins,
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return formatMoney(context.raw);
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: colors.muted,
              callback(value) {
                return formatCompactMoney(value);
              }
            },
            grid: { color: colors.grid }
          },
          y: {
            ticks: { color: colors.muted },
            grid: { display: false }
          }
        }
      },
      emptyMessage: 'No state summary available for the current filters.'
    });

    const punitiveCounts = [
      verdicts.filter((verdict) => verdict.hasPunitive).length,
      verdicts.filter((verdict) => !verdict.hasPunitive).length
    ];
    renderChart({
      chartKey: 'punitive',
      canvas: elements.punitiveSummaryChart,
      emptyElement: elements.punitiveSummaryEmpty,
      type: 'doughnut',
      data: {
        labels: ['Punitive', 'Non-punitive'],
        datasets: [{
          data: punitiveCounts,
          backgroundColor: [colors.accent2, colors.doughnutNeutral],
          borderWidth: 0,
          hoverOffset: 2
        }]
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.textSoft,
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.label}: ${formatNumber(context.raw)}`;
              }
            }
          }
        }
      },
      emptyMessage: 'No punitive summary available for the current filters.'
    });
  }

  function renderMetrics(verdicts) {
    const totals = verdicts.map((verdict) => Number(verdict.totalVerdict) || 0);
    const punitiveCount = verdicts.filter((verdict) => verdict.hasPunitive).length;
    const average = totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : 0;
    const median = getMedian(totals);
    const largest = totals.length ? Math.max(...totals) : 0;

    elements.metricTotal.textContent = formatNumber(verdicts.length);
    elements.metricAverage.textContent = formatMoney(average);
    elements.metricMedian.textContent = formatMoney(median);
    elements.metricLargest.textContent = formatMoney(largest);
    elements.metricPunitiveCount.textContent = formatNumber(punitiveCount);
  }

  function renderTable(verdicts) {
    if (!verdicts.length) {
      elements.tableBody.innerHTML = '';
      elements.emptyState.hidden = false;
      elements.loadMore.hidden = true;
      if (elements.tableCount) {
        elements.tableCount.textContent = 'Showing 0 rows.';
      }
      return;
    }

    elements.emptyState.hidden = true;
    const visibleVerdicts = verdicts.slice(0, state.rowLimit);
    elements.loadMore.hidden = visibleVerdicts.length >= verdicts.length;
    elements.loadMore.textContent = `Show more rows (${formatNumber(verdicts.length - visibleVerdicts.length)} remaining)`;

    if (elements.tableCount) {
      elements.tableCount.textContent = `Showing ${formatNumber(visibleVerdicts.length)} of ${formatNumber(verdicts.length)} rows.`;
    }

    elements.tableBody.innerHTML = visibleVerdicts.map((verdict) => {
      const sourceMarkup = verdict.sourceUrl
        ? `<a class="nvt-source" href="${escapeHtml(verdict.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(verdict.sourceLabel)}</a>`
        : verdict.sourceLabel
          ? `<span class="nvt-source-text">${escapeHtml(verdict.sourceLabel)}</span>`
          : '<span class="nvt-missing">&mdash;</span>';

      return `
      <tr>
        <td>${getDisplayValue(verdict.year)}</td>
        <td>${getDisplayValue(verdict.state)}</td>
        <td>${getDisplayValue(verdict.jurisdiction)}</td>
        <td class="nvt-case">
          <span class="nvt-case-title">${getDisplayValue(verdict.caseName)}</span>
          <span class="nvt-case-sub">${getDisplayValue(verdict.captionType)}</span>
        </td>
        <td><span class="nvt-pill">${getDisplayValue(verdict.caseType)}</span></td>
        <td>${getDisplayValue(verdict.industry)}</td>
        <td class="nvt-money">${formatMoneyCell(verdict.totalVerdict)}</td>
        <td class="nvt-money">${formatMoneyCell(verdict.compensatoryDamages)}</td>
        <td class="nvt-money">${formatMoneyCell(verdict.punitiveDamages)}</td>
        <td>${sourceMarkup}</td>
        <td>${getDisplayValue(verdict.notes)}</td>
      </tr>
    `;
    }).join('');
  }

  function updateStatus(verdicts) {
    const punitiveCount = verdicts.filter((verdict) => verdict.hasPunitive).length;
    elements.status.textContent = `${formatNumber(verdicts.length)} verdicts shown. ${formatNumber(punitiveCount)} include punitive damages.`;
  }

  function applyFilters() {
    readFiltersFromDom();
    updateFilterOptions();
    writeFiltersToDom();

    const matchedVerdicts = state.verdicts.filter((verdict) => matchesFilters(verdict, state.filters));
    state.filteredVerdicts = sortVerdicts(matchedVerdicts);
    state.rowLimit = Math.max(DEFAULT_ROW_LIMIT, Math.min(state.rowLimit, state.filteredVerdicts.length || DEFAULT_ROW_LIMIT));
    updateSortUi();

    renderMetrics(state.filteredVerdicts);
    renderTable(state.filteredVerdicts);
    updateStatus(state.filteredVerdicts);
    renderVisualSummaries(state.filteredVerdicts);
  }

  function bindEvents() {
    [
      elements.year,
      elements.state,
      elements.jurisdiction,
      elements.caseType,
      elements.industry,
      elements.verdictBucket,
      elements.punitive
    ].forEach((element) => {
      element.addEventListener('change', applyFilters);
    });

    elements.search.addEventListener('input', applyFilters);
    elements.clearFilters.addEventListener('click', () => {
      FILTER_KEYS.forEach((key) => {
        state.filters[key] = '';
      });

      writeFiltersToDom();
      state.rowLimit = DEFAULT_ROW_LIMIT;
      applyFilters();
    });

    elements.loadMore.addEventListener('click', () => {
      state.rowLimit += DEFAULT_ROW_LIMIT;
      renderTable(state.filteredVerdicts);
    });

    elements.sortButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextKey = button.dataset.sortKey;
        if (!nextKey) {
          return;
        }

        if (state.sort.key === nextKey) {
          state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          state.sort.key = nextKey;
          state.sort.direction = nextKey === 'state' || nextKey === 'jurisdiction' || nextKey === 'caseType' || nextKey === 'industry' ? 'asc' : 'desc';
        }

        state.rowLimit = DEFAULT_ROW_LIMIT;
        applyFilters();
      });
    });
  }

  async function loadVerdicts() {
    elements.status.textContent = 'Loading verdict data.';

    try {
      const response = await fetch(`${DATA_URL}?ts=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error(`Verdict data request failed with ${response.status}`);
      }

      const payload = await response.json();
      const verdicts = Array.isArray(payload) ? payload : payload.records;
      state.verdicts = normalizeVerdicts(verdicts);
      applyFilters();
    } catch (error) {
      console.error('nuclear-verdict-tracker.js: failed to load verdict data', error);
      elements.status.textContent = 'Verdict data could not be loaded.';
      elements.emptyState.hidden = false;
      elements.emptyState.innerHTML = '<h3>Dashboard unavailable</h3><p>The local verdict dataset could not be loaded.</p>';
    }
  }

  bindEvents();
  loadVerdicts();

  window.onThemeToggle = applyFilters;
})();
