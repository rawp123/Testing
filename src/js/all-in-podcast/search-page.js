import * as shared from '../all-in-podcast-shared.js';
import {
  describeSearchCoverage,
  formatEpisodeDuration as formatDuration,
  getEpisodeGuests,
  getEpisodeTopics,
  getEpisodeYear,
  getFullEpisodeLink,
  hasTranscript
} from './catalog.js';
import {
  escapeForRegExp,
  highlightText,
  normalizeText
} from './utils.js';

export function initializeAllInPodcastSearch() {

  const elements = {
    yearFilter: document.getElementById('aps-year-filter'),
    guestFilter: document.getElementById('aps-guest-filter'),
    sortOrder: document.getElementById('aps-sort-order'),
    topicFilterButton: document.getElementById('aps-topic-filter-button'),
    topicFilterSummary: document.getElementById('aps-topic-filter-summary'),
    topicFilterMenu: document.getElementById('aps-topic-filter-menu'),
    topicFilterOptions: document.getElementById('aps-topic-filter-options'),
    episodesSummary: document.getElementById('aps-episodes-summary'),
    sortHeaders: Array.from(document.querySelectorAll('.aps-sort-header')),
    episodesTableBody: document.getElementById('aps-episodes-table-body'),
    episodesEmpty: document.getElementById('aps-episodes-empty'),
    searchInput: document.getElementById('aps-search-input'),
    clearButton: document.getElementById('aps-clear-search'),
    searchStatusBar: document.getElementById('aps-search-status-bar'),
    resultsSummary: document.getElementById('aps-results-summary'),
    resetResultsSort: document.getElementById('aps-reset-results-sort'),
    results: document.getElementById('aps-results'),
    emptyState: document.getElementById('aps-results-empty')
  };

  const hasEpisodesView = Boolean(elements.episodesTableBody);
  const hasSearchView = Boolean(elements.searchInput && elements.results);

  if (!hasEpisodesView && !hasSearchView) {
    return;
  }

  const state = {
    episodes: [],
    catalogSummary: null,
    pagefind: null,
    pagefindReady: false,
    pagefindFailed: false,
    searchToken: 0,
    query: '',
    selectedEpisodeId: '',
    selectedHitId: '',
    selectedTimestamp: 0,
    openInlineHitId: '',
    searchMatchMap: new Map(),
    searchResults: null,
    searchSort: 'relevance',
    activeFilters: {
      year: '',
      guest: '',
      topics: [],
      sort: 'publish-date-desc'
    }
  };

  function setStatus(message) {
    void message;
  }

  function setSearchLoadingState(isLoading) {
    if (!hasSearchView || !elements.searchStatusBar) {
      return;
    }

    elements.searchStatusBar.classList.toggle('is-active', Boolean(isLoading));
    elements.searchStatusBar.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
    elements.searchStatusBar.hidden = !isLoading;
  }

  function getSortedEpisodes(items) {
    const sortKey = state.activeFilters.sort || 'publish-date-desc';
    return [...items].sort((left, right) => {
      const leftDate = new Date(`${left.publishDate}T00:00:00`).getTime();
      const rightDate = new Date(`${right.publishDate}T00:00:00`).getTime();
      const leftEpisode = Number.isFinite(Number(left.episodeNumber)) ? Number(left.episodeNumber) : null;
      const rightEpisode = Number.isFinite(Number(right.episodeNumber)) ? Number(right.episodeNumber) : null;
      const leftDuration = Number.isFinite(Number(left.durationSeconds)) ? Number(left.durationSeconds) : null;
      const rightDuration = Number.isFinite(Number(right.durationSeconds)) ? Number(right.durationSeconds) : null;
      const leftTitle = normalizeText(left.title).toLowerCase();
      const rightTitle = normalizeText(right.title).toLowerCase();

      function compareNullableNumbers(a, b, direction) {
        if (a === null && b === null) {
          return 0;
        }

        if (a === null) {
          return 1;
        }

        if (b === null) {
          return -1;
        }

        return (a - b) * direction;
      }

      function compareStrings(a, b, direction) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) * direction;
      }

      let comparison = 0;

      switch (sortKey) {
        case 'publish-date-asc':
          comparison = leftDate - rightDate;
          break;
        case 'episode-asc':
          comparison = compareNullableNumbers(leftEpisode, rightEpisode, 1);
          break;
        case 'episode-desc':
          comparison = compareNullableNumbers(leftEpisode, rightEpisode, -1);
          break;
        case 'title-asc':
          comparison = compareStrings(leftTitle, rightTitle, 1);
          break;
        case 'title-desc':
          comparison = compareStrings(leftTitle, rightTitle, -1);
          break;
        case 'duration-asc':
          comparison = compareNullableNumbers(leftDuration, rightDuration, 1);
          break;
        case 'duration-desc':
          comparison = compareNullableNumbers(leftDuration, rightDuration, -1);
          break;
        case 'publish-date-desc':
        default:
          comparison = rightDate - leftDate;
          break;
      }

      if (comparison !== 0) {
        return comparison;
      }

      return rightDate - leftDate;
    });
  }

  function getSortDirection(sortKey) {
    return String(sortKey || '').endsWith('-asc') ? 'asc' : 'desc';
  }

  function getSortField(sortKey) {
    return String(sortKey || 'publish-date-desc').replace(/-(asc|desc)$/, '');
  }

  function updateSortHeaderState() {
    if (!elements.sortHeaders.length) {
      return;
    }

    const activeField = getSortField(state.activeFilters.sort);
    const activeDirection = getSortDirection(state.activeFilters.sort);

    elements.sortHeaders.forEach((button) => {
      const isActive = button.dataset.sortField === activeField;
      const indicator = button.querySelector('.aps-sort-indicator');
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');

      if (!indicator) {
        return;
      }

      if (!isActive) {
        indicator.textContent = '';
        return;
      }

      indicator.textContent = activeDirection === 'asc' ? '↑' : '↓';
    });
  }

  function applySort(sortValue) {
    state.activeFilters.sort = sortValue || 'publish-date-desc';
    renderEpisodesTable();
    syncUrl();
  }

  function applyEpisodeFilters(episodes) {
    return getSortedEpisodes(episodes.filter((episode) => {
      const matchesYear = !state.activeFilters.year || getEpisodeYear(episode) === state.activeFilters.year;
      const matchesGuest = !state.activeFilters.guest || getEpisodeGuests(episode).includes(state.activeFilters.guest);
      const matchesTopics = !state.activeFilters.topics.length || getEpisodeTopics(episode).some((topic) => state.activeFilters.topics.includes(topic));
      return matchesYear && matchesGuest && matchesTopics;
    }));
  }

  function getFilteredEpisodes() {
    return applyEpisodeFilters(state.episodes);
  }

  function getTranscriptCoverageSummary(episodes = getFilteredEpisodes()) {
    const transcriptEpisodes = episodes.filter(hasTranscript);
    const transcriptChunkCount = transcriptEpisodes.reduce((sum, episode) => sum + Number(episode.chunkCount || 0), 0);

    return {
      transcriptEpisodes,
      transcriptEpisodeCount: transcriptEpisodes.length,
      transcriptChunkCount
    };
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.query = (params.get('q') || '').trim();
    state.searchSort = params.get('searchSort') || 'relevance';
    state.activeFilters.year = params.get('year') || '';
    state.activeFilters.guest = params.get('guest') || '';
    state.activeFilters.topics = (params.get('topics') || '')
      .split(',')
      .map((topic) => normalizeText(topic))
      .filter(Boolean);
    state.activeFilters.sort = params.get('sort') || 'publish-date-desc';
    state.selectedEpisodeId = params.get('episode') || '';
    state.selectedHitId = params.get('hit') || '';
    state.selectedTimestamp = Number(params.get('t')) || 0;
  }

  function syncUrl() {
    const nextUrl = new URL(window.location.href);

    nextUrl.searchParams.set('sort', state.activeFilters.sort);

    if (state.query) {
      nextUrl.searchParams.set('q', state.query);
    } else {
      nextUrl.searchParams.delete('q');
    }

    if (state.searchSort && state.searchSort !== 'relevance') {
      nextUrl.searchParams.set('searchSort', state.searchSort);
    } else {
      nextUrl.searchParams.delete('searchSort');
    }

    if (state.activeFilters.year) {
      nextUrl.searchParams.set('year', state.activeFilters.year);
    } else {
      nextUrl.searchParams.delete('year');
    }

    if (state.activeFilters.guest) {
      nextUrl.searchParams.set('guest', state.activeFilters.guest);
    } else {
      nextUrl.searchParams.delete('guest');
    }

    if (state.activeFilters.topics.length) {
      nextUrl.searchParams.set('topics', state.activeFilters.topics.join(','));
    } else {
      nextUrl.searchParams.delete('topics');
    }

    if (state.query && state.selectedHitId && state.selectedEpisodeId && Number.isFinite(state.selectedTimestamp)) {
      nextUrl.searchParams.set('episode', state.selectedEpisodeId);
      nextUrl.searchParams.set('hit', state.selectedHitId);
      nextUrl.searchParams.set('t', String(Math.max(Math.floor(state.selectedTimestamp), 0)));
    } else {
      nextUrl.searchParams.delete('episode');
      nextUrl.searchParams.delete('hit');
      nextUrl.searchParams.delete('t');
    }

    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`);
  }

  function populateFilterOptions() {
    if (!elements.yearFilter || !elements.guestFilter) {
      return;
    }

    const years = [...new Set(state.episodes.map(getEpisodeYear).filter(Boolean))]
      .sort((left, right) => Number(right) - Number(left));
    const guests = [...new Set(state.episodes.flatMap((episode) => getEpisodeGuests(episode)).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
    const topics = [...new Set(state.episodes.flatMap((episode) => getEpisodeTopics(episode)).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));

    elements.yearFilter.innerHTML = [
      '<option value="">All years</option>',
      ...years.map((year) => `<option value="${shared.escapeHtml(year)}">${shared.escapeHtml(year)}</option>`)
    ].join('');
    elements.guestFilter.innerHTML = [
      '<option value="">All guests</option>',
      ...guests.map((guest) => `<option value="${shared.escapeHtml(guest)}">${shared.escapeHtml(guest)}</option>`)
    ].join('');

    elements.yearFilter.value = state.activeFilters.year;
    elements.guestFilter.value = state.activeFilters.guest;
    if (elements.sortOrder) {
      elements.sortOrder.value = state.activeFilters.sort;
    }
    renderTopicFilterOptions(topics);
    updateTopicFilterSummary();
    updateSortHeaderState();
  }

  function getTopicFilterSummary() {
    const selectedTopics = state.activeFilters.topics;
    if (!selectedTopics.length) {
      return 'All topics';
    }

    if (selectedTopics.length === 1) {
      return selectedTopics[0];
    }

    return `${selectedTopics.length} topics selected`;
  }

  function updateTopicFilterSummary() {
    if (!elements.topicFilterSummary || !elements.topicFilterButton) {
      return;
    }

    elements.topicFilterSummary.textContent = getTopicFilterSummary();
    elements.topicFilterButton.classList.toggle('has-selection', state.activeFilters.topics.length > 0);
  }

  function renderTopicFilterOptions(topics) {
    if (!elements.topicFilterOptions) {
      return;
    }

    elements.topicFilterOptions.innerHTML = topics.map((topic) => {
      const isChecked = state.activeFilters.topics.includes(topic);
      return `
        <label class="aps-filter-check-item">
          <input type="checkbox" class="aps-filter-checkbox" value="${shared.escapeHtml(topic)}" ${isChecked ? 'checked' : ''}>
          <span>${shared.escapeHtml(topic)}</span>
        </label>
      `;
    }).join('');
  }

  function syncTopicCheckboxInputsFromState() {
    if (!elements.topicFilterOptions) {
      return;
    }

    elements.topicFilterOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = state.activeFilters.topics.includes(normalizeText(input.value));
    });
  }

  function openTopicFilter() {
    if (!elements.topicFilterMenu || !elements.topicFilterButton) {
      return;
    }

    elements.topicFilterMenu.hidden = false;
    elements.topicFilterButton.setAttribute('aria-expanded', 'true');
  }

  function closeTopicFilter() {
    if (!elements.topicFilterMenu || !elements.topicFilterButton) {
      return;
    }

    elements.topicFilterMenu.hidden = true;
    elements.topicFilterButton.setAttribute('aria-expanded', 'false');
  }

  function syncTopicsFromCheckboxes() {
    if (!elements.topicFilterOptions) {
      return;
    }

    state.activeFilters.topics = Array.from(elements.topicFilterOptions.querySelectorAll('input[type="checkbox"]:checked'))
      .map((input) => normalizeText(input.value))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
    updateTopicFilterSummary();
  }

  function renderEpisodesLoading() {
    if (!hasEpisodesView || !elements.episodesSummary || !elements.episodesEmpty || !elements.episodesTableBody) {
      return;
    }

    elements.episodesSummary.textContent = 'Loading indexed episode data.';
    elements.episodesEmpty.hidden = true;
    elements.episodesTableBody.innerHTML = `
      <tr class="aps-table-loading-row"><td colspan="7"><div class="aps-loading-card"></div></td></tr>
      <tr class="aps-table-loading-row"><td colspan="7"><div class="aps-loading-card"></div></td></tr>
      <tr class="aps-table-loading-row"><td colspan="7"><div class="aps-loading-card"></div></td></tr>
    `;
  }

  function renderTopicList(topics) {
    if (!topics.length) {
      return '<span class="aps-table-muted">—</span>';
    }

    return `
      <div class="aps-inline-list">
        ${topics.map((topic) => `
          <button type="button" class="aps-meta-chip aps-topic-chip-button" data-topic-filter="${shared.escapeHtml(topic)}" aria-label="Filter episodes by topic ${shared.escapeHtml(topic)}">
            ${shared.escapeHtml(topic)}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderGuestList(guests) {
    if (!guests.length) {
      return '<span class="aps-table-muted">—</span>';
    }

    return `<span>${shared.escapeHtml(guests.join(', '))}</span>`;
  }

  function renderEpisodesTable() {
    if (!hasEpisodesView || !elements.episodesSummary || !elements.episodesEmpty || !elements.episodesTableBody) {
      return;
    }

    const filteredEpisodes = getFilteredEpisodes();
    const transcriptBackedCount = filteredEpisodes.filter(hasTranscript).length;

    elements.episodesSummary.textContent = `${filteredEpisodes.length} indexed episode${filteredEpisodes.length === 1 ? '' : 's'} shown, with ${transcriptBackedCount} transcript-backed episode${transcriptBackedCount === 1 ? '' : 's'} ready for search.`;
    updateSortHeaderState();
    elements.episodesEmpty.hidden = filteredEpisodes.length > 0;

    if (!filteredEpisodes.length) {
      elements.episodesTableBody.innerHTML = '';
      return;
    }

    elements.episodesTableBody.innerHTML = filteredEpisodes.map((episode) => {
      const transcriptLabel = describeSearchCoverage(episode);
      const fullEpisodeLink = getFullEpisodeLink(episode);
      const fullEpisodeCell = fullEpisodeLink
        ? `<a class="aps-inline-link" href="${shared.escapeHtml(fullEpisodeLink.href)}" target="_blank" rel="noopener noreferrer">${shared.escapeHtml(fullEpisodeLink.label)}</a>`
        : '<span class="aps-table-muted">Unavailable</span>';

      return `
        <tr class="aps-episode-row" data-episode-url="${shared.escapeHtml(shared.buildEpisodeUrl(episode.id))}" tabindex="0">
          <td>
            <a class="aps-episode-link" href="${shared.escapeHtml(shared.buildEpisodeUrl(episode.id))}">${shared.escapeHtml(episode.title)}</a>
          </td>
          <td>${shared.escapeHtml(shared.formatDate(episode.publishDate))}</td>
          <td>${shared.escapeHtml(formatDuration(episode))}</td>
          <td>${renderGuestList(getEpisodeGuests(episode))}</td>
          <td>${renderTopicList(getEpisodeTopics(episode))}</td>
          <td><span class="aps-availability ${hasTranscript(episode) ? 'is-available' : 'is-unavailable'}">${shared.escapeHtml(transcriptLabel)}</span></td>
          <td>${fullEpisodeCell}</td>
        </tr>
      `;
    }).join('');
  }

  function showSearchEmptyState(title, copy, isLoading) {
    if (!hasSearchView || !elements.results || !elements.emptyState) {
      return;
    }

    elements.results.innerHTML = '';
    elements.results.hidden = true;
    elements.emptyState.hidden = false;
    elements.emptyState.classList.toggle('is-loading', Boolean(isLoading));
    elements.emptyState.innerHTML = `<h3>${shared.escapeHtml(title)}</h3><p>${shared.escapeHtml(copy)}</p>`;
  }

  function buildSearchSnippet(chunk, query) {
    const sourceText = normalizeText(chunk.text || chunk.excerpt);
    const lowered = sourceText.toLowerCase();
    const loweredQuery = query.toLowerCase();
    const termList = loweredQuery.split(/\s+/).filter(Boolean);
    let startIndex = lowered.indexOf(loweredQuery);

    if (startIndex === -1) {
      startIndex = termList.reduce((bestIndex, term) => {
        const index = lowered.indexOf(term);
        if (index === -1) {
          return bestIndex;
        }

        return bestIndex === -1 ? index : Math.min(bestIndex, index);
      }, -1);
    }

    if (startIndex === -1 || sourceText.length <= 220) {
      return sourceText;
    }

    const windowStart = Math.max(startIndex - 72, 0);
    const windowEnd = Math.min(startIndex + 148, sourceText.length);
    const prefix = windowStart > 0 ? '... ' : '';
    const suffix = windowEnd < sourceText.length ? ' ...' : '';

    return `${prefix}${sourceText.slice(windowStart, windowEnd).trim()}${suffix}`;
  }

  function chunkMatchesQuery(chunk, query) {
    const normalizedQuery = normalizeText(query).toLowerCase();
    if (!normalizedQuery) {
      return false;
    }

    const haystack = normalizeText(`${chunk.speaker || ''} ${chunk.text || ''} ${chunk.excerpt || ''}`).toLowerCase();
    if (haystack.includes(normalizedQuery)) {
      return true;
    }

    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    return terms.length > 1 && terms.every((term) => haystack.includes(term));
  }

  async function ensurePagefind() {
    if (state.pagefindReady || state.pagefindFailed) {
      return state.pagefind;
    }

    try {
      state.pagefind = await import('/all-in-podcast-search/pagefind/pagefind.js');
      await state.pagefind.options({
        basePath: '/all-in-podcast-search/pagefind/'
      });
      await state.pagefind.init();
      state.pagefindReady = true;
      setStatus('Pagefind search is ready.');
      return state.pagefind;
    } catch (error) {
      state.pagefindFailed = true;
      console.warn('all-in-podcast-search.js: Pagefind bundle unavailable, falling back to local transcript scan', error);
      setStatus('Using local transcript search while the Pagefind bundle is unavailable.');
      return null;
    }
  }

  async function getCandidateEpisodeIds(query, visibleEpisodes) {
    const visibleIds = new Set(visibleEpisodes.map((episode) => episode.id));
    const pagefind = await ensurePagefind();
    if (!pagefind) {
      return {
        ids: visibleIds,
        usedPagefind: false
      };
    }

    const search = await pagefind.search(query);
    const ids = new Set();

    for (const result of search.results) {
      const data = await result.data();
      const episodeId = data?.meta?.episode_id;
      if (episodeId && visibleIds.has(episodeId)) {
        ids.add(episodeId);
      }
    }

    return {
      ids: ids.size ? ids : visibleIds,
      usedPagefind: true
    };
  }

  function buildMatchRecord(episode, chunk) {
    const canPlaySegment = Boolean(episode.youtubeId || episode.audioUrl);
    const detailUrl = shared.buildMomentUrl(episode.id, chunk.startSeconds, chunk.id, {
      autoplay: false,
      query: state.query
    });
    const playUrl = shared.buildMomentUrl(episode.id, chunk.startSeconds, chunk.id, {
      autoplay: canPlaySegment,
      query: state.query
    });

    return {
      episodeId: episode.id,
      episodeTitle: episode.title,
      publishDate: episode.publishDate,
      guests: getEpisodeGuests(episode),
      speaker: chunk.speaker || '',
      topicTags: getEpisodeTopics(episode),
      chunkId: chunk.id,
      startSeconds: chunk.startSeconds,
      timestampLabel: chunk.startTimestamp,
      snippetText: buildSearchSnippet(chunk, state.query),
      detailUrl,
      playUrl,
      episodeUrl: shared.buildEpisodeUrl(episode.id, {
        query: state.query
      }),
      youtubeUrl: episode.youtubeId
        ? `https://www.youtube.com/watch?v=${episode.youtubeId}&t=${Math.max(Math.floor(chunk.startSeconds || 0), 0)}s`
        : '',
      youtubeId: episode.youtubeId || '',
      audioUrl: episode.audioUrl || '',
      fullEpisodeUrl: getFullEpisodeLink(episode)?.href || '',
      fullEpisodeLabel: getFullEpisodeLink(episode)?.label || '',
      hasVideo: Boolean(episode.youtubeId),
      canPlaySegment
    };
  }

  async function searchTranscriptMatches(query) {
    const visibleEpisodes = getFilteredEpisodes().filter(hasTranscript);
    const candidateInfo = await getCandidateEpisodeIds(query, visibleEpisodes);
    const orderedEpisodes = [...visibleEpisodes].sort((left, right) => {
      const leftPriority = candidateInfo.ids.has(left.id) ? 0 : 1;
      const rightPriority = candidateInfo.ids.has(right.id) ? 0 : 1;
      return leftPriority - rightPriority;
    });
    const groups = [];

    for (const episode of orderedEpisodes) {
      const episodePayload = await shared.loadEpisodeById(episode.id);
      const matches = episodePayload.chunks
        .filter((chunk) => chunkMatchesQuery(chunk, query))
        .map((chunk) => buildMatchRecord(episodePayload.episode, chunk))
        .sort((left, right) => left.startSeconds - right.startSeconds);

      if (!matches.length) {
        continue;
      }

      groups.push({
        episode: episodePayload.episode,
        matches
      });
    }

    return {
      groups,
      totalMatches: groups.reduce((sum, group) => sum + group.matches.length, 0),
      usedPagefind: candidateInfo.usedPagefind
    };
  }

  function updateSelectedMatchState() {
    elements.results.querySelectorAll('.aps-search-result-row').forEach((matchElement) => {
      const isSelected = matchElement.dataset.hitId === state.selectedHitId;
      matchElement.classList.toggle('is-selected', isSelected);
      matchElement.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
  }

  function getMatchSpeakerLabel(match) {
    if (match.speaker) {
      return match.speaker;
    }

    if (Array.isArray(match.guests) && match.guests.length) {
      return match.guests.join(', ');
    }

    return '—';
  }

  function getSearchSortField(sortValue) {
    return String(sortValue || 'relevance').replace(/-(asc|desc)$/, '');
  }

  function getSearchSortDirection(sortValue) {
    return String(sortValue || '').endsWith('-asc') ? 'asc' : 'desc';
  }

  function getDefaultSearchSortDirection(field) {
    return field === 'date' || field === 'timestamp' ? 'desc' : 'asc';
  }

  function getNextSearchSort(field) {
    const currentField = getSearchSortField(state.searchSort);
    const currentDirection = getSearchSortDirection(state.searchSort);

    if (currentField !== field || state.searchSort === 'relevance') {
      return `${field}-${getDefaultSearchSortDirection(field)}`;
    }

    return `${field}-${currentDirection === 'asc' ? 'desc' : 'asc'}`;
  }

  function sortSearchMatches(matches) {
    if (state.searchSort === 'relevance') {
      return matches;
    }

    const sortField = getSearchSortField(state.searchSort);
    const sortDirection = getSearchSortDirection(state.searchSort) === 'asc' ? 1 : -1;

    return [...matches].sort((left, right) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          comparison = (new Date(`${left.publishDate}T00:00:00`).getTime() - new Date(`${right.publishDate}T00:00:00`).getTime()) * sortDirection;
          break;
        case 'title':
          comparison = normalizeText(left.episodeTitle).localeCompare(normalizeText(right.episodeTitle), undefined, { numeric: true, sensitivity: 'base' }) * sortDirection;
          break;
        case 'speaker':
          comparison = normalizeText(getMatchSpeakerLabel(left)).localeCompare(normalizeText(getMatchSpeakerLabel(right)), undefined, { numeric: true, sensitivity: 'base' }) * sortDirection;
          break;
        case 'timestamp':
          comparison = ((Number(left.startSeconds) || 0) - (Number(right.startSeconds) || 0)) * sortDirection;
          break;
        default:
          comparison = 0;
      }

      if (comparison !== 0) {
        return comparison;
      }

      return (Number(left.searchRank) || 0) - (Number(right.searchRank) || 0);
    });
  }

  function renderSearchSortHeader(field, label) {
    const isActive = getSearchSortField(state.searchSort) === field && state.searchSort !== 'relevance';
    const indicator = isActive ? (getSearchSortDirection(state.searchSort) === 'asc' ? '↑' : '↓') : '';

    return `
      <button class="aps-sort-header ${isActive ? 'is-active' : ''}" type="button" data-search-sort-field="${shared.escapeHtml(field)}" aria-pressed="${isActive ? 'true' : 'false'}">
        <span>${shared.escapeHtml(label)}</span>
        <span class="aps-sort-indicator" aria-hidden="true">${indicator}</span>
      </button>
    `;
  }

  function updateResultsSortResetVisibility() {
    if (!elements.resetResultsSort) {
      return;
    }

    elements.resetResultsSort.hidden = state.searchSort === 'relevance';
  }

  function renderInlineSearchPlayer(match) {
    if (!match?.canPlaySegment) {
      return '';
    }

    if (match.youtubeId) {
      const startSeconds = Math.max(Math.floor(Number(match.startSeconds) || 0), 0);
      return `
        <div class="aps-search-inline-player">
          <iframe
            class="aps-search-inline-frame"
            title="Play ${shared.escapeHtml(match.episodeTitle)} from ${shared.escapeHtml(match.timestampLabel)}"
            src="https://www.youtube.com/embed/${shared.escapeHtml(match.youtubeId)}?start=${startSeconds}&autoplay=1&rel=0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      `;
    }

    if (match.audioUrl) {
      return `
        <div class="aps-search-inline-player">
          <audio
            class="aps-search-inline-audio"
            controls
            autoplay
            preload="metadata"
            src="${shared.escapeHtml(match.audioUrl)}"
            data-inline-audio-player="true"
            data-start-seconds="${shared.escapeHtml(String(Math.max(Math.floor(Number(match.startSeconds) || 0), 0)))}"
          ></audio>
        </div>
      `;
    }

    return '';
  }

  function hydrateInlineSearchPlayers() {
    if (!hasSearchView || !elements.results) {
      return;
    }

    elements.results.querySelectorAll('[data-inline-audio-player="true"]').forEach((audio) => {
      const startSeconds = Math.max(Math.floor(Number(audio.dataset.startSeconds) || 0), 0);
      const seekAndPlay = () => {
        try {
          audio.currentTime = startSeconds;
        } catch (error) {
          console.warn('all-in-podcast-search.js: unable to set inline audio currentTime', error);
        }

        if (audio.autoplay) {
          audio.play().catch((error) => {
            console.warn('all-in-podcast-search.js: inline audio autoplay blocked', error);
          });
        }
      };

      if (audio.readyState >= 1) {
        seekAndPlay();
      } else {
        audio.addEventListener('loadedmetadata', seekAndPlay, { once: true });
      }
    });
  }

  function rerenderCurrentSearchResults() {
    if (!hasSearchView) {
      return;
    }

    if (state.searchResults) {
      renderSearchResults({
        matches: state.searchResults.matches,
        totalMatches: state.searchResults.totalMatches,
        episodeCount: state.searchResults.episodeCount,
        usedPagefind: state.searchResults.usedPagefind
      });
      return;
    }

    renderSearchResults({ groups: [], totalMatches: 0, usedPagefind: false });
  }

  function renderSearchResults(result) {
    if (!hasSearchView || !elements.resultsSummary || !elements.results || !elements.emptyState) {
      return;
    }

    const baseMatches = Array.isArray(result.matches)
      ? result.matches
      : (result.groups || []).flatMap((group) => group.matches);
    const episodeCount = Number.isFinite(Number(result.episodeCount))
      ? Number(result.episodeCount)
      : (result.groups || []).length;

    if (!state.query) {
      state.searchResults = null;
      state.searchMatchMap = new Map();
      state.selectedEpisodeId = '';
      state.selectedHitId = '';
      state.selectedTimestamp = 0;
      state.openInlineHitId = '';
      elements.results.innerHTML = '';
      syncUrl();
      updateResultsSortResetVisibility();
      const coverage = getTranscriptCoverageSummary();
      elements.resultsSummary.textContent = coverage.transcriptEpisodeCount
        ? `Search is ready across ${coverage.transcriptEpisodeCount} transcript-backed episode${coverage.transcriptEpisodeCount === 1 ? '' : 's'} and ${coverage.transcriptChunkCount} transcript chunk${coverage.transcriptChunkCount === 1 ? '' : 's'}.`
        : 'No transcript-backed episodes match the current filters yet.';
      showSearchEmptyState(
        'Search the transcript archive',
        coverage.transcriptEpisodeCount
          ? 'Type a topic, phrase, company, or name to see transcript matches in a sortable archive table. Speaker labels appear only when the transcript includes them.'
          : 'The current filters only show episodes without transcripts. Clear or widen the filters to search indexed transcript moments.',
        false
      );
      return;
    }

    if (!baseMatches.length) {
      state.searchResults = {
        matches: [],
        totalMatches: 0,
        episodeCount: 0,
        usedPagefind: result.usedPagefind
      };
      state.searchMatchMap = new Map();
      state.selectedEpisodeId = '';
      state.selectedHitId = '';
      state.selectedTimestamp = 0;
      state.openInlineHitId = '';
      elements.results.innerHTML = '';
      syncUrl();
      updateResultsSortResetVisibility();
      elements.resultsSummary.textContent = 'Found 0 matches across 0 episodes.';
      showSearchEmptyState('No transcript matches', 'Try a broader term, a shorter phrase, or a different spelling. Results come from indexed transcript files, not guessed metadata.', false);
      return;
    }

    const allMatches = baseMatches.map((match, index) => ({
      ...match,
      searchRank: Number.isFinite(Number(match.searchRank)) ? Number(match.searchRank) : index
    }));
    const sortedMatches = sortSearchMatches(allMatches);

    state.searchResults = {
      matches: allMatches,
      totalMatches: result.totalMatches,
      episodeCount,
      usedPagefind: result.usedPagefind
    };
    state.searchMatchMap = new Map(sortedMatches.map((match) => [match.chunkId, match]));
    const selectedMatch = sortedMatches.find((match) => match.chunkId === state.selectedHitId) || sortedMatches[0];
    state.selectedEpisodeId = selectedMatch.episodeId;
    state.selectedHitId = selectedMatch.chunkId;
    if (state.openInlineHitId && !sortedMatches.some((match) => match.chunkId === state.openInlineHitId)) {
      state.openInlineHitId = '';
    }
    state.selectedTimestamp = selectedMatch.startSeconds;
    syncUrl();
    updateResultsSortResetVisibility();

    elements.results.hidden = false;
    elements.emptyState.hidden = true;
    elements.emptyState.classList.remove('is-loading');
    elements.resultsSummary.textContent = `Found ${result.totalMatches} match${result.totalMatches === 1 ? '' : 'es'} across ${episodeCount} episode${episodeCount === 1 ? '' : 's'}.${result.usedPagefind ? ' Pagefind is available for indexed transcript search.' : ' Showing local transcript scan results.'}`;
    elements.results.innerHTML = `
      <div class="aps-results-table-shell">
        <div class="aps-results-table-scroll">
          <table class="aps-results-table">
            <thead>
              <tr>
                <th scope="col">${renderSearchSortHeader('title', 'Episode Title')}</th>
                <th scope="col" class="aps-results-col-date">${renderSearchSortHeader('date', 'Date')}</th>
                <th scope="col" class="aps-results-col-speaker">${renderSearchSortHeader('speaker', 'Guest / Speaker')}</th>
                <th scope="col" class="aps-results-col-timestamp">${renderSearchSortHeader('timestamp', 'Timestamp')}</th>
                <th scope="col" class="aps-results-col-snippet">Transcript Snippet</th>
                <th scope="col" class="aps-results-col-actions">Episode Link / Actions</th>
              </tr>
            </thead>
            <tbody>
              ${sortedMatches.map((match) => `
                <tr class="aps-search-result-row ${match.chunkId === state.selectedHitId ? 'is-selected' : ''}" data-hit-id="${shared.escapeHtml(match.chunkId)}" data-episode-id="${shared.escapeHtml(match.episodeId)}" data-row-url="${shared.escapeHtml(match.detailUrl)}" tabindex="0" role="link" aria-label="Open ${shared.escapeHtml(match.episodeTitle)} at ${shared.escapeHtml(match.timestampLabel)}">
                  <td data-label="Episode Title">
                    <a class="aps-episode-link" href="${shared.escapeHtml(match.detailUrl)}">${shared.escapeHtml(match.episodeTitle)}</a>
                  </td>
                  <td data-label="Date" class="aps-results-cell-date">${shared.escapeHtml(shared.formatDate(match.publishDate))}</td>
                  <td data-label="Guest / Speaker" class="aps-results-cell-speaker">${shared.escapeHtml(getMatchSpeakerLabel(match))}</td>
                  <td data-label="Timestamp" class="aps-results-cell-timestamp">
                    ${match.canPlaySegment
                      ? `<button type="button" class="aps-results-timestamp-button" data-action="toggle-inline-player" data-hit-id="${shared.escapeHtml(match.chunkId)}" aria-pressed="${match.chunkId === state.openInlineHitId ? 'true' : 'false'}"><span class="aps-time-chip">${shared.escapeHtml(match.timestampLabel)}</span></button>`
                      : `<span class="aps-time-chip">${shared.escapeHtml(match.timestampLabel)}</span>`}
                  </td>
                  <td data-label="Transcript Snippet">
                      <p class="aps-result-snippet">${highlightText(match.snippetText, state.query, shared.escapeHtml)}</p>
                    ${match.chunkId === state.openInlineHitId ? renderInlineSearchPlayer(match) : ''}
                  </td>
                  <td data-label="Episode Link / Actions">
                    <div class="aps-results-actions-cell">
                      <a class="aps-inline-link aps-search-result-primary" href="${shared.escapeHtml(match.detailUrl)}">Open Episode</a>
                      ${match.fullEpisodeUrl ? `<a class="aps-inline-link aps-search-result-secondary" href="${shared.escapeHtml(match.fullEpisodeUrl)}" target="_blank" rel="noopener noreferrer">${shared.escapeHtml(match.fullEpisodeLabel || 'Official page')}</a>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    updateSelectedMatchState();
    hydrateInlineSearchPlayers();
}

  async function performSearch(query) {
    state.query = normalizeText(query);
    const searchToken = ++state.searchToken;

    if (!state.query) {
      setSearchLoadingState(false);
      renderSearchResults({ groups: [], totalMatches: 0, usedPagefind: false });
      setStatus('Ready to search transcript-backed episode data.');
      return;
    }

    setSearchLoadingState(true);
    showSearchEmptyState('Searching transcript chunks', `Looking for matches for "${state.query}".`, true);
    elements.resultsSummary.textContent = `Searching for "${state.query}".`;
    setStatus(`Searching for "${state.query}".`);

    try {
      const result = await searchTranscriptMatches(state.query);
      if (searchToken !== state.searchToken) {
        return;
      }

      setSearchLoadingState(false);
      renderSearchResults(result);
      setStatus(`Finished searching for "${state.query}".`);
    } catch (error) {
      console.error('all-in-podcast-search.js: search failed', error);
      if (searchToken !== state.searchToken) {
        return;
      }

      setSearchLoadingState(false);
      elements.resultsSummary.textContent = 'Search failed.';
      showSearchEmptyState('Search unavailable', 'The local transcript search could not finish. Check the generated episode JSON files and Pagefind build output.', false);
      setStatus('Search failed.');
    }
  }

  function rerenderForFilters() {
    if (hasEpisodesView) {
      renderEpisodesTable();
    }
    syncUrl();
    if (hasSearchView && state.query) {
      void performSearch(state.query);
      return;
    }

    if (hasSearchView) {
      renderSearchResults({ groups: [], totalMatches: 0, usedPagefind: false });
    }
  }

  function handleResultsClick(event) {
    const toggleButton = event.target.closest('[data-action="toggle-inline-player"]');
    if (toggleButton) {
      const match = state.searchMatchMap.get(toggleButton.dataset.hitId);
      if (!match) {
        return;
      }

      state.selectedEpisodeId = match.episodeId;
      state.selectedHitId = match.chunkId;
      state.selectedTimestamp = match.startSeconds;
      state.openInlineHitId = state.openInlineHitId === match.chunkId ? '' : match.chunkId;
      syncUrl();
      rerenderCurrentSearchResults();
      return;
    }

    if (event.target.closest('a, button, summary')) {
      return;
    }

    const matchElement = event.target.closest('.aps-search-result-row');
    if (!matchElement) {
      return;
    }

    const rowUrl = matchElement.dataset.rowUrl;
    if (rowUrl) {
      window.location.href = rowUrl;
    }
  }

  function handleResultsKeydown(event) {
    if (event.target.closest('a, button, input, select, textarea')) {
      return;
    }

    const matchElement = event.target.closest('.aps-search-result-row');
    if (!matchElement || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    const match = state.searchMatchMap.get(matchElement.dataset.hitId);
    if (match?.detailUrl) {
      window.location.href = match.detailUrl;
    }
  }

  function handleEpisodeTableClick(event) {
    if (event.target.closest('a')) {
      return;
    }

    const topicChip = event.target.closest('[data-topic-filter]');
    if (topicChip) {
      state.activeFilters.topics = [normalizeText(topicChip.dataset.topicFilter)].filter(Boolean);
      syncTopicCheckboxInputsFromState();
      updateTopicFilterSummary();
      rerenderForFilters();
      return;
    }

    const row = event.target.closest('.aps-episode-row');
    if (!row) {
      return;
    }

    window.location.href = row.dataset.episodeUrl;
  }

  function handleEpisodeTableKeydown(event) {
    const row = event.target.closest('.aps-episode-row');
    if (!row || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    window.location.href = row.dataset.episodeUrl;
  }

  function bindEvents() {
    let searchTimeout = null;

    if (hasSearchView) {
      if (elements.resetResultsSort) {
        elements.resetResultsSort.addEventListener('click', () => {
          state.searchSort = 'relevance';
          syncUrl();
          if (state.searchResults) {
            renderSearchResults({
              matches: state.searchResults.matches,
              totalMatches: state.searchResults.totalMatches,
              episodeCount: state.searchResults.episodeCount,
              usedPagefind: state.searchResults.usedPagefind
            });
          } else {
            renderSearchResults({ groups: [], totalMatches: 0, usedPagefind: false });
          }
        });
      }

      elements.searchInput.addEventListener('input', () => {
        state.query = elements.searchInput.value.trim();
        syncUrl();
        window.clearTimeout(searchTimeout);
        searchTimeout = window.setTimeout(() => {
          void performSearch(state.query);
        }, 140);
      });

      elements.clearButton.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.query = '';
        state.selectedEpisodeId = '';
        state.selectedHitId = '';
        state.selectedTimestamp = 0;
        state.openInlineHitId = '';
        setSearchLoadingState(false);
        syncUrl();
        rerenderCurrentSearchResults();
        elements.searchInput.focus();
      });
    }

    if (hasEpisodesView) {
      [elements.yearFilter, elements.guestFilter].forEach((control) => {
        control.addEventListener('change', () => {
          state.activeFilters.year = elements.yearFilter.value;
          state.activeFilters.guest = elements.guestFilter.value;
          rerenderForFilters();
        });
      });

      if (elements.topicFilterButton) {
        elements.topicFilterButton.addEventListener('click', () => {
          const isOpen = !elements.topicFilterMenu.hidden;
          if (isOpen) {
            closeTopicFilter();
          } else {
            openTopicFilter();
          }
        });
      }

      if (elements.topicFilterOptions) {
        elements.topicFilterOptions.addEventListener('change', (event) => {
          if (!event.target.matches('input[type="checkbox"]')) {
            return;
          }

          syncTopicsFromCheckboxes();
          rerenderForFilters();
        });
      }

      if (elements.topicFilterMenu) {
        elements.topicFilterMenu.addEventListener('click', (event) => {
          const actionButton = event.target.closest('[data-topic-action]');
          if (!actionButton) {
            return;
          }

          const checkboxes = Array.from(elements.topicFilterOptions?.querySelectorAll('input[type="checkbox"]') || []);
          const shouldCheck = actionButton.dataset.topicAction === 'select-all';
          checkboxes.forEach((checkbox) => {
            checkbox.checked = shouldCheck;
          });
          syncTopicsFromCheckboxes();
          rerenderForFilters();
        });
      }

      if (elements.sortOrder) {
        elements.sortOrder.addEventListener('change', () => {
          applySort(elements.sortOrder.value);
        });
      }

      elements.sortHeaders.forEach((button) => {
        button.addEventListener('click', () => {
          const field = button.dataset.sortField;
          const currentField = getSortField(state.activeFilters.sort);
          const currentDirection = getSortDirection(state.activeFilters.sort);
          const nextDirection = currentField === field && currentDirection === 'asc' ? 'desc' : 'asc';
          const nextSort = `${field}-${nextDirection}`;
          if (elements.sortOrder) {
            elements.sortOrder.value = nextSort;
          }
          applySort(nextSort);
        });
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeTopicFilter();
      }

      if (!hasSearchView) {
        return;
      }

      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const tagName = event.target?.tagName;
      const isEditable = event.target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
      if (isEditable) {
        return;
      }

      event.preventDefault();
      elements.searchInput.focus();
      elements.searchInput.select();
    });

    if (hasSearchView) {
      elements.results.addEventListener('click', (event) => {
        const sortButton = event.target.closest('[data-search-sort-field]');
        if (!sortButton) {
          return;
        }

        state.searchSort = getNextSearchSort(sortButton.dataset.searchSortField);
        syncUrl();

        if (state.searchResults) {
          renderSearchResults({
            matches: state.searchResults.matches,
            totalMatches: state.searchResults.totalMatches,
            episodeCount: state.searchResults.episodeCount,
            usedPagefind: state.searchResults.usedPagefind
          });
        }
      });
      elements.results.addEventListener('click', handleResultsClick);
      elements.results.addEventListener('keydown', handleResultsKeydown);
    }

    if (hasEpisodesView) {
      elements.episodesTableBody.addEventListener('click', handleEpisodeTableClick);
      elements.episodesTableBody.addEventListener('keydown', handleEpisodeTableKeydown);
    }

    document.addEventListener('click', (event) => {
      const dropdownRoot = event.target.closest('[data-filter-dropdown="topics"]');
      if (dropdownRoot) {
        return;
      }

      closeTopicFilter();
    });
  }

  async function initialize() {
    renderEpisodesLoading();
    readStateFromUrl();

    try {
      state.catalogSummary = await shared.loadEpisodesCatalog();
      state.episodes = Array.isArray(state.catalogSummary?.episodes) ? state.catalogSummary.episodes : [];
      if (hasEpisodesView) {
        populateFilterOptions();
        renderEpisodesTable();
      }
      syncUrl();
      if (hasSearchView) {
        elements.searchInput.value = state.query;
        setSearchLoadingState(false);
        renderSearchResults({ groups: [], totalMatches: 0, usedPagefind: false });
      }
      bindEvents();
      if (hasSearchView) {
        void ensurePagefind();
      }
      const transcriptEpisodeCount = Number(state.catalogSummary?.transcriptEpisodeCount || 0);
      const transcriptChunkCount = Number(state.catalogSummary?.transcriptChunkCount || 0);
      setStatus(`Loaded ${state.episodes.length} indexed episodes. Search-ready transcripts cover ${transcriptEpisodeCount} episode${transcriptEpisodeCount === 1 ? '' : 's'} and ${transcriptChunkCount} chunk${transcriptChunkCount === 1 ? '' : 's'}.`);

      if (hasSearchView && state.query) {
        await performSearch(state.query);
      }
    } catch (error) {
      console.error('all-in-podcast-search.js: failed to initialize', error);
      setSearchLoadingState(false);
      renderEpisodesTable();
      elements.resultsSummary.textContent = 'Archive unavailable.';
      showSearchEmptyState('Archive unavailable', 'The episode index could not be loaded from the local data folder.', false);
      setStatus('Episode metadata could not be loaded.');
    }
  }

  initialize();
}
