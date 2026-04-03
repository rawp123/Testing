(function initializeAllInPodcastVisuals() {
  const shared = window.AllInPodcastShared || {};

  const elements = {
    keywordInput: document.getElementById('aps-visual-keyword'),
    applyButton: document.getElementById('aps-visual-apply'),
    clearButton: document.getElementById('aps-visual-clear'),
    bucketSelect: document.getElementById('aps-visual-bucket'),
    summary: document.getElementById('aps-visuals-summary'),
    status: document.getElementById('aps-visual-status'),
    empty: document.getElementById('aps-visual-empty'),
    content: document.getElementById('aps-visual-content'),
    stats: document.getElementById('aps-visual-stats'),
    trendChart: document.getElementById('aps-trend-chart'),
    breakdownChart: document.getElementById('aps-breakdown-chart'),
    breakdownTitle: document.getElementById('aps-breakdown-title'),
    resultsBody: document.getElementById('aps-visual-results-body'),
    focusCheckboxes: Array.from(document.querySelectorAll('.aps-visual-toggle-group input[type="checkbox"][value="title"], .aps-visual-toggle-group input[type="checkbox"][value="summary"], .aps-visual-toggle-group input[type="checkbox"][value="transcript"], .aps-visual-toggle-group input[type="checkbox"][value="guests"], .aps-visual-toggle-group input[type="checkbox"][value="topics"]')),
    seriesCheckboxes: Array.from(document.querySelectorAll('.aps-visual-toggle-group input[type="checkbox"][value="episodes"], .aps-visual-toggle-group input[type="checkbox"][value="mentions"]')),
    breakdownButtons: Array.from(document.querySelectorAll('[data-breakdown]'))
  };

  if (!elements.keywordInput || !elements.trendChart || !elements.breakdownChart) {
    return;
  }

  const state = {
    episodes: [],
    keyword: 'AI',
    bucket: 'month',
    breakdown: 'topics',
    scopes: ['title', 'summary', 'transcript'],
    series: ['episodes', 'mentions'],
    token: 0
  };

  function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function escapeForRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function countOccurrences(haystack, needle) {
    const normalizedHaystack = normalizeText(haystack).toLowerCase();
    const normalizedNeedle = normalizeText(needle).toLowerCase();

    if (!normalizedHaystack || !normalizedNeedle) {
      return 0;
    }

    const pattern = new RegExp(escapeForRegExp(normalizedNeedle), 'g');
    const matches = normalizedHaystack.match(pattern);
    return matches ? matches.length : 0;
  }

  function setLoadingState(isLoading, message) {
    elements.status.textContent = message;
    elements.content.classList.toggle('is-loading', Boolean(isLoading));
  }

  function syncStateFromControls() {
    state.keyword = normalizeText(elements.keywordInput.value);
    state.bucket = elements.bucketSelect.value || 'month';
    state.scopes = elements.focusCheckboxes.filter((input) => input.checked).map((input) => input.value);
    state.series = elements.seriesCheckboxes.filter((input) => input.checked).map((input) => input.value);
  }

  function syncControlsFromState() {
    elements.keywordInput.value = state.keyword;
    elements.bucketSelect.value = state.bucket;

    elements.focusCheckboxes.forEach((input) => {
      input.checked = state.scopes.includes(input.value);
    });

    elements.seriesCheckboxes.forEach((input) => {
      input.checked = state.series.includes(input.value);
    });

    elements.breakdownButtons.forEach((button) => {
      const isActive = button.dataset.breakdown === state.breakdown;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.keyword = normalizeText(params.get('q') || 'AI');
    state.bucket = params.get('bucket') || 'month';

    const scopes = (params.get('scopes') || 'title,summary,transcript')
      .split(',')
      .map((value) => normalizeText(value))
      .filter(Boolean);
    state.scopes = scopes.length ? scopes : ['title', 'summary', 'transcript'];

    const series = (params.get('series') || 'episodes,mentions')
      .split(',')
      .map((value) => normalizeText(value))
      .filter(Boolean);
    state.series = series.length ? series : ['episodes', 'mentions'];

    state.breakdown = params.get('breakdown') === 'guests' ? 'guests' : 'topics';
  }

  function syncUrl() {
    const nextUrl = new URL(window.location.href);

    if (state.keyword) {
      nextUrl.searchParams.set('q', state.keyword);
    } else {
      nextUrl.searchParams.delete('q');
    }

    nextUrl.searchParams.set('bucket', state.bucket);
    nextUrl.searchParams.set('scopes', state.scopes.join(','));
    nextUrl.searchParams.set('series', state.series.join(','));
    nextUrl.searchParams.set('breakdown', state.breakdown);
    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`);
  }

  function bucketKeyForDate(value) {
    const [year, month] = String(value || '').split('-').map(Number);
    if (!year || !month) {
      return 'unknown';
    }

    if (state.bucket === 'quarter') {
      return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
    }

    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function formatBucketLabel(key) {
    if (key === 'unknown') {
      return 'Unknown';
    }

    if (state.bucket === 'quarter') {
      const [year, quarter] = key.split('-');
      return `${quarter} ${year}`;
    }

    const [year, month] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  }

  function sortBucketKeys(keys) {
    return [...keys].sort((left, right) => {
      if (state.bucket === 'quarter') {
        const [leftYear, leftQuarter] = left.split('-Q').map(Number);
        const [rightYear, rightQuarter] = right.split('-Q').map(Number);
        return leftYear === rightYear ? leftQuarter - rightQuarter : leftYear - rightYear;
      }

      return left.localeCompare(right);
    });
  }

  async function mapInBatches(items, batchSize, worker) {
    const results = [];

    for (let index = 0; index < items.length; index += batchSize) {
      const batch = items.slice(index, index + batchSize);
      const batchResults = await Promise.all(batch.map(worker));
      results.push(...batchResults);
    }

    return results;
  }

  async function analyzeEpisode(episode) {
    let totalMatches = 0;

    if (state.scopes.includes('title')) {
      totalMatches += countOccurrences(episode.title, state.keyword);
    }

    if (state.scopes.includes('summary')) {
      totalMatches += countOccurrences(`${episode.summary || ''} ${episode.description || ''}`, state.keyword);
    }

    if (state.scopes.includes('guests')) {
      totalMatches += countOccurrences((episode.guests || []).join(' '), state.keyword);
    }

    if (state.scopes.includes('topics')) {
      totalMatches += countOccurrences((episode.topicTags || []).join(' '), state.keyword);
    }

    if (state.scopes.includes('transcript') && episode.transcriptAvailable) {
      const payload = await shared.loadEpisodeById(episode.id);
      totalMatches += payload.chunks.reduce((sum, chunk) => sum + countOccurrences(`${chunk.speaker || ''} ${chunk.text || chunk.excerpt || ''}`, state.keyword), 0);
    }

    return {
      episode,
      totalMatches
    };
  }

  function buildTrendSeries(matches) {
    const totalsByBucket = new Map();
    const matchingByBucket = new Map();

    state.episodes.forEach((episode) => {
      const key = bucketKeyForDate(episode.publishDate);
      totalsByBucket.set(key, (totalsByBucket.get(key) || 0) + 1);
    });

    matches.forEach(({ episode, totalMatches }) => {
      if (totalMatches <= 0) {
        return;
      }

      const key = bucketKeyForDate(episode.publishDate);
      const existing = matchingByBucket.get(key) || { mentions: 0, episodes: 0 };
      existing.mentions += totalMatches;
      existing.episodes += 1;
      matchingByBucket.set(key, existing);
    });

    const orderedKeys = sortBucketKeys(Array.from(new Set([...totalsByBucket.keys(), ...matchingByBucket.keys()])));

    return orderedKeys.map((key) => {
      const totalEpisodes = totalsByBucket.get(key) || 0;
      const matching = matchingByBucket.get(key) || { mentions: 0, episodes: 0 };
      return {
        key,
        label: formatBucketLabel(key),
        totalEpisodes,
        matchingEpisodes: matching.episodes,
        mentions: matching.mentions
      };
    });
  }

  function buildBreakdown(matches) {
    const counts = new Map();
    const isTopics = state.breakdown === 'topics';

    matches.forEach(({ episode, totalMatches }) => {
      if (totalMatches <= 0) {
        return;
      }

      const values = isTopics ? (episode.topicTags || []) : (episode.guests || []);
      values.forEach((value) => {
        const key = normalizeText(value);
        if (!key) {
          return;
        }
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));
  }

  function summarizeMatches(matches) {
    const positive = matches.filter((item) => item.totalMatches > 0);
    const mentionCount = positive.reduce((sum, item) => sum + item.totalMatches, 0);
    const activeBuckets = new Set(positive.map((item) => bucketKeyForDate(item.episode.publishDate))).size;

    return {
      positive,
      episodeCount: positive.length,
      mentionCount,
      activeBuckets
    };
  }

  function buildTrendChartSvg(rows) {
    if (!rows.length) {
      return '<div class="aps-chart-empty"><p>No timeline data is available yet.</p></div>';
    }

    const enabledSeries = state.series.length ? state.series : ['episodes'];
    const width = 900;
    const height = 290;
    const margin = { top: 20, right: 18, bottom: 42, left: 44 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maxValue = Math.max(1, ...rows.flatMap((row) => enabledSeries.map((series) => series === 'mentions' ? row.mentions : row.matchingEpisodes)));
    const tickCount = 4;

    const xForIndex = (index) => {
      if (rows.length === 1) {
        return margin.left + (plotWidth / 2);
      }
      return margin.left + ((plotWidth / (rows.length - 1)) * index);
    };

    const yForValue = (value) => margin.top + plotHeight - ((value / maxValue) * plotHeight);

    const gridLines = Array.from({ length: tickCount + 1 }, (_, index) => {
      const value = (maxValue / tickCount) * index;
      const y = yForValue(value);
      return `
        <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="aps-chart-grid-line"></line>
        <text x="${margin.left - 10}" y="${y + 4}" class="aps-chart-axis-label" text-anchor="end">${Math.round(value)}</text>
      `;
    }).join('');

    const labelStep = Math.max(1, Math.ceil(rows.length / 6));
    const xLabels = rows.map((row, index) => {
      if (index % labelStep !== 0 && index !== rows.length - 1) {
        return '';
      }
      return `<text x="${xForIndex(index)}" y="${height - 12}" class="aps-chart-axis-label" text-anchor="middle">${shared.escapeHtml(row.label)}</text>`;
    }).join('');

    const seriesConfig = [
      { key: 'episodes', label: 'Matching episodes', className: 'is-episodes' },
      { key: 'mentions', label: 'Total mentions', className: 'is-mentions' }
    ].filter((config) => enabledSeries.includes(config.key));

    const paths = seriesConfig.map((config) => {
      const points = rows.map((row, index) => {
        const value = config.key === 'mentions' ? row.mentions : row.matchingEpisodes;
        return `${xForIndex(index)},${yForValue(value)}`;
      }).join(' ');

      const circles = rows.map((row, index) => {
        const value = config.key === 'mentions' ? row.mentions : row.matchingEpisodes;
        return `<circle cx="${xForIndex(index)}" cy="${yForValue(value)}" r="3.5" class="aps-chart-dot ${config.className}"></circle>`;
      }).join('');

      return `
        <polyline points="${points}" class="aps-chart-line ${config.className}"></polyline>
        ${circles}
      `;
    }).join('');

    const legend = seriesConfig.map((config) => `
      <span class="aps-chart-legend-item">
        <span class="aps-chart-legend-swatch ${config.className}"></span>
        <span>${shared.escapeHtml(config.label)}</span>
      </span>
    `).join('');

    return `
      <div class="aps-chart-legend">${legend}</div>
      <svg viewBox="0 0 ${width} ${height}" class="aps-chart-svg" role="img" aria-label="Keyword trend chart over time">
        ${gridLines}
        ${paths}
        ${xLabels}
      </svg>
    `;
  }

  function buildBreakdownChartSvg(items) {
    if (!items.length) {
      return '<div class="aps-chart-empty"><p>No matching topics or guests were found for this keyword and focus combination.</p></div>';
    }

    const width = 800;
    const rowHeight = 34;
    const height = 26 + (items.length * rowHeight) + 10;
    const labelWidth = 220;
    const maxValue = Math.max(...items.map((item) => item.value), 1);

    const bars = items.map((item, index) => {
      const y = 18 + (index * rowHeight);
      const barWidth = ((width - labelWidth - 60) * item.value) / maxValue;
      const safeLabel = item.label.length > 24 ? `${item.label.slice(0, 24)}…` : item.label;
      return `
        <text x="0" y="${y + 16}" class="aps-chart-bar-label">${shared.escapeHtml(safeLabel)}</text>
        <rect x="${labelWidth}" y="${y}" width="${barWidth}" height="16" rx="8" class="aps-chart-bar"></rect>
        <text x="${labelWidth + barWidth + 10}" y="${y + 13}" class="aps-chart-bar-value">${item.value}</text>
      `;
    }).join('');

    return `
      <svg viewBox="0 0 ${width} ${height}" class="aps-chart-svg" role="img" aria-label="Breakdown chart">
        ${bars}
      </svg>
    `;
  }

  function renderStats(summary) {
    const statCards = [
      { label: 'Matching episodes', value: summary.episodeCount },
      { label: 'Total mentions', value: summary.mentionCount },
      { label: state.bucket === 'quarter' ? 'Active quarters' : 'Active months', value: summary.activeBuckets }
    ];

    elements.stats.innerHTML = statCards.map((card) => `
      <article class="aps-stat-card">
        <p class="aps-stat-label">${shared.escapeHtml(card.label)}</p>
        <p class="aps-stat-value">${shared.escapeHtml(String(card.value))}</p>
      </article>
    `).join('');
  }

  function renderResultsTable(matches) {
    const topMatches = [...matches]
      .filter((item) => item.totalMatches > 0)
      .sort((left, right) => right.totalMatches - left.totalMatches || right.episode.publishDate.localeCompare(left.episode.publishDate))
      .slice(0, 12);

    elements.resultsBody.innerHTML = topMatches.map(({ episode, totalMatches }) => `
      <tr>
        <td><a class="aps-episode-link" href="${shared.escapeHtml(shared.buildEpisodeUrl(episode.id, { query: state.keyword }))}">${shared.escapeHtml(episode.title)}</a></td>
        <td>${shared.escapeHtml(shared.formatDate(episode.publishDate))}</td>
        <td>${shared.escapeHtml(String(totalMatches))}</td>
        <td><a class="aps-inline-link" href="${shared.escapeHtml(shared.buildEpisodeUrl(episode.id, { query: state.keyword }))}">Open</a></td>
      </tr>
    `).join('');
  }

  function renderEmpty(title, copy) {
    elements.empty.hidden = false;
    elements.empty.innerHTML = `<h3>${shared.escapeHtml(title)}</h3><p>${shared.escapeHtml(copy)}</p>`;
    elements.content.hidden = true;
    elements.stats.innerHTML = '';
    elements.trendChart.innerHTML = '';
    elements.breakdownChart.innerHTML = '';
    elements.resultsBody.innerHTML = '';
  }

  function renderVisuals(matches) {
    const summary = summarizeMatches(matches);

    if (!summary.episodeCount) {
      renderEmpty(
        'No matching episodes found',
        'Try a broader keyword, switch to different focus fields, or include transcript coverage to widen the analysis.'
      );
      elements.summary.textContent = `No matching episodes found for "${state.keyword}".`;
      return;
    }

    elements.empty.hidden = true;
    elements.content.hidden = false;
    elements.summary.textContent = `"${state.keyword}" appears in ${summary.episodeCount} episode${summary.episodeCount === 1 ? '' : 's'} across ${summary.activeBuckets} ${state.bucket === 'quarter' ? 'quarter' : 'month'} bucket${summary.activeBuckets === 1 ? '' : 's'}.`;
    elements.breakdownTitle.textContent = state.breakdown === 'topics' ? 'Top topics in matching episodes' : 'Top guests in matching episodes';

    renderStats(summary);
    elements.trendChart.innerHTML = buildTrendChartSvg(buildTrendSeries(matches));
    elements.breakdownChart.innerHTML = buildBreakdownChartSvg(buildBreakdown(matches));
    renderResultsTable(matches);
  }

  async function performAnalysis() {
    syncStateFromControls();
    syncUrl();

    const currentToken = ++state.token;

    if (!state.keyword) {
      renderEmpty('Choose a keyword', 'Enter a keyword or phrase to generate the timeline and breakdown visuals.');
      elements.summary.textContent = 'Enter a keyword to begin.';
      elements.status.textContent = 'Waiting for a keyword.';
      return;
    }

    if (!state.scopes.length) {
      renderEmpty('Select a focus field', 'At least one focus field is required before the visuals can be generated.');
      elements.summary.textContent = 'Select at least one focus field.';
      elements.status.textContent = 'Waiting for a focus field.';
      return;
    }

    if (!state.series.length) {
      state.series = ['episodes'];
      syncControlsFromState();
    }

    setLoadingState(true, `Analyzing "${state.keyword}" across ${state.episodes.length} indexed episodes...`);

    const matches = await mapInBatches(state.episodes, 18, (episode) => analyzeEpisode(episode));
    if (currentToken !== state.token) {
      return;
    }

    setLoadingState(false, `Finished analyzing "${state.keyword}".`);
    renderVisuals(matches);
  }

  function bindEvents() {
    elements.applyButton.addEventListener('click', () => {
      void performAnalysis();
    });

    elements.clearButton.addEventListener('click', () => {
      state.keyword = 'AI';
      state.bucket = 'month';
      state.scopes = ['title', 'summary', 'transcript'];
      state.series = ['episodes', 'mentions'];
      state.breakdown = 'topics';
      syncControlsFromState();
      void performAnalysis();
    });

    elements.keywordInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void performAnalysis();
      }
    });

    elements.bucketSelect.addEventListener('change', () => {
      void performAnalysis();
    });

    [...elements.focusCheckboxes, ...elements.seriesCheckboxes].forEach((input) => {
      input.addEventListener('change', () => {
        void performAnalysis();
      });
    });

    elements.breakdownButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.breakdown = button.dataset.breakdown === 'guests' ? 'guests' : 'topics';
        syncControlsFromState();
        void performAnalysis();
      });
    });
  }

  async function initialize() {
    readStateFromUrl();
    syncControlsFromState();
    bindEvents();

    try {
      const catalog = await shared.loadEpisodesCatalog();
      state.episodes = Array.isArray(catalog.episodes) ? catalog.episodes : [];
      elements.summary.textContent = `${state.episodes.length} indexed episodes are available for visual analysis.`;
      await performAnalysis();
    } catch (error) {
      console.error('all-in-podcast-visuals.js: failed to initialize', error);
      renderEmpty('Visuals unavailable', 'The episode catalog could not be loaded from the local podcast data files.');
      elements.summary.textContent = 'Visual analysis is unavailable.';
      elements.status.textContent = 'The episode catalog could not be loaded.';
    }
  }

  initialize();
})();
