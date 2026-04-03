(function initializeAllInPodcastEpisode() {
  const shared = window.AllInPodcastShared || {};

  const elements = {
    backToSearch: document.getElementById('aps-back-to-search'),
    title: document.getElementById('aps-episode-title'),
    subtitle: document.getElementById('aps-episode-subtitle'),
    meta: document.getElementById('aps-episode-meta'),
    summary: document.getElementById('aps-episode-summary'),
    transcriptTitle: document.getElementById('aps-transcript-title'),
    transcriptSummary: document.getElementById('aps-transcript-summary'),
    transcriptEmpty: document.getElementById('aps-transcript-empty'),
    transcriptList: document.getElementById('aps-transcript-list'),
    playerFrame: document.getElementById('aps-player-frame'),
    audioPlayer: document.getElementById('aps-audio-player'),
    playerFallback: document.getElementById('aps-player-fallback'),
    playerCard: document.querySelector('.aps-player-card'),
    openFullEpisode: document.getElementById('aps-open-full-episode')
  };

  if (!elements.title) {
    return;
  }

  const state = {
    episode: null,
    selectedChunkId: '',
    activeAutoplay: false,
    query: '',
    hitChunkIds: []
  };

  function escapeForRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildHighlightHtml(text, query) {
    const terms = query.split(/\s+/).filter(Boolean);
    let highlighted = shared.escapeHtml(text);

    terms.forEach((term) => {
      const pattern = new RegExp(`(${escapeForRegExp(shared.escapeHtml(term))})`, 'ig');
      highlighted = highlighted.replace(pattern, '<mark>$1</mark>');
    });

    return highlighted;
  }

  function getChunkRangeLabel(chunk) {
    return `${chunk.startTimestamp}${chunk.endTimestamp ? `-${chunk.endTimestamp}` : ''}`;
  }

  function getChunkDisplayText(chunk) {
    return chunk.text || chunk.excerpt || '';
  }

  function getChunkHeadline(chunk) {
    return chunk.excerpt || getChunkDisplayText(chunk) || 'Transcript moment';
  }

  function renderEpisodeSummary() {
    if (!elements.summary || !state.episode) {
      return;
    }

    if (!state.episode.chunks.length) {
      elements.summary.innerHTML = '<p>No timestamped coverage is attached to this episode yet.</p>';
      return;
    }

    const coverageItems = state.episode.chunks.map((chunk) => `
      <li>
        <a class="aps-summary-link" href="#${shared.escapeHtml(chunk.id)}" data-action="play-summary-moment" data-chunk-id="${shared.escapeHtml(chunk.id)}">
          ${shared.escapeHtml(getChunkHeadline(chunk))}
          <span class="aps-summary-timestamp">(${shared.escapeHtml(getChunkRangeLabel(chunk))})</span>
        </a>
      </li>
    `).join('');

    elements.summary.innerHTML = `
      <ul class="aps-summary-list">
        ${coverageItems}
      </ul>
    `;
  }

  function findHitIndex(chunkId) {
    return state.hitChunkIds.indexOf(chunkId);
  }

  function getEpisodeId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || '';
  }

  function getFullEpisodeHref(episode) {
    return episode.fullEpisodeUrl || episode.officialPageUrl || '';
  }

  function getCoverageLabel(episode) {
    if (episode.transcriptSourceType === 'rss-description-outline') {
      return 'Episode outline attached';
    }

    return episode.transcriptSourceType ? 'Transcript coverage attached' : 'Transcript not attached';
  }

  function updateMomentUrl(chunk, autoplay) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('id', state.episode.episode.id);
    nextUrl.searchParams.set('t', String(chunk.startSeconds));

    if (autoplay && state.episode.episode.youtubeId) {
      nextUrl.searchParams.set('play', '1');
    } else {
      nextUrl.searchParams.delete('play');
    }

    if (state.query) {
      nextUrl.searchParams.set('q', state.query);
    }

    nextUrl.hash = chunk.id;
    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  function getInitialChunk() {
    const hashId = window.location.hash.replace(/^#/, '');
    if (hashId && state.episode.chunkMap[hashId]) {
      return state.episode.chunkMap[hashId];
    }

    const seconds = shared.getTimeFromUrl();
    if (seconds > 0) {
      const matchingChunk = shared.findChunkForTime(state.episode.chunks, seconds);
      if (matchingChunk) {
        return matchingChunk;
      }
    }

    if (state.hitChunkIds.length > 0) {
      return state.episode.chunkMap[state.hitChunkIds[0]];
    }

    return state.episode.chunks[0];
  }

  function updatePlayer(chunk, autoplay) {
    if (!state.episode.episode.youtubeId) {
      const audioUrl = state.episode.episode.audioUrl || '';
      if (audioUrl && elements.audioPlayer) {
        if (elements.audioPlayer.src !== audioUrl) {
          elements.audioPlayer.src = audioUrl;
        }
        elements.audioPlayer.hidden = false;
        elements.playerFallback.hidden = true;
        elements.playerFrame.hidden = true;
        elements.playerFrame.removeAttribute('src');

        const startSeconds = Math.max(Math.floor(chunk.startSeconds || 0), 0);
        if (!Number.isNaN(startSeconds)) {
          try {
            elements.audioPlayer.currentTime = startSeconds;
          } catch (error) {
            console.warn('all-in-podcast-episode.js: unable to set audio currentTime', error);
          }
        }

        if (autoplay) {
          elements.audioPlayer.play().catch((error) => {
            console.warn('all-in-podcast-episode.js: audio autoplay blocked', error);
          });
        }
        return;
      }

      elements.playerFrame.removeAttribute('src');
      elements.playerFrame.hidden = true;
      if (elements.audioPlayer) {
        elements.audioPlayer.hidden = true;
        elements.audioPlayer.removeAttribute('src');
      }
      elements.playerFallback.hidden = false;
      return;
    }

    const startParam = Math.max(Math.floor(chunk.startSeconds || 0), 0);
    const autoplayParam = autoplay ? 1 : 0;
    elements.playerFrame.src = `https://www.youtube.com/embed/${state.episode.episode.youtubeId}?start=${startParam}&autoplay=${autoplayParam}&rel=0`;
    elements.playerFrame.hidden = false;
    if (elements.audioPlayer) {
      elements.audioPlayer.hidden = true;
      elements.audioPlayer.removeAttribute('src');
    }
    elements.playerFallback.hidden = true;
  }

  function updateSelectedChunk(chunk, options = {}) {
    if (!chunk) {
      return;
    }

    const autoplay = Boolean(options.autoplay);
    state.selectedChunkId = chunk.id;
    state.activeAutoplay = autoplay && Boolean(state.episode.episode.youtubeId);

    elements.transcriptList.querySelectorAll('.aps-transcript-chunk').forEach((item) => {
      const isSelected = item.dataset.chunkId === chunk.id;
      item.classList.toggle('is-selected', isSelected);
      item.setAttribute('aria-current', isSelected ? 'true' : 'false');
    });

    updateMomentUrl(chunk, autoplay);
    updatePlayer(chunk, autoplay);

    if (options.revealPlayer && elements.playerCard) {
      elements.playerCard.scrollIntoView({
        block: 'start',
        behavior: options.instant ? 'auto' : 'smooth'
      });
    }

    const selectedElement = elements.transcriptList.querySelector(`[data-chunk-id="${chunk.id}"]`);
    if (selectedElement && options.scrollIntoView) {
      selectedElement.scrollIntoView({ block: 'center', behavior: options.instant ? 'auto' : 'smooth' });
    }

    if (selectedElement && options.focusChunk) {
      selectedElement.focus({ preventScroll: true });
    }
  }

  async function copyMomentLink(chunk, feedbackElement) {
    const link = `${window.location.origin}${shared.buildMomentUrl(state.episode.episode.id, chunk.startSeconds, chunk.id, {
      query: state.query
    })}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const helper = document.createElement('textarea');
        helper.value = link;
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
      }

      feedbackElement.textContent = 'Link copied.';
      window.setTimeout(() => {
        feedbackElement.textContent = '';
      }, 1800);
    } catch (error) {
      console.warn('all-in-podcast-episode.js: could not copy moment link', error);
      feedbackElement.textContent = 'Copy failed.';
    }
  }

  function renderTranscript() {
    const isOutlineCoverage = state.episode.episode.transcriptSourceType === 'rss-description-outline';
    if (elements.transcriptTitle) {
      elements.transcriptTitle.textContent = isOutlineCoverage ? 'Episode outline' : 'Full transcript';
    }

    if (!state.episode.chunks.length) {
      state.hitChunkIds = [];
      renderEpisodeSummary();
      elements.transcriptList.hidden = true;
      elements.transcriptList.innerHTML = '';
      elements.transcriptEmpty.hidden = false;
      elements.transcriptEmpty.classList.remove('is-loading');
      elements.transcriptEmpty.innerHTML = '<h3>Transcript not attached yet</h3><p>This episode is already in the archive, but it does not have a local transcript file attached yet. You can still use the metadata here and open the full episode when a source link is available.</p>';
      elements.transcriptSummary.textContent = 'No local transcript or outline chunks are attached to this episode yet.';
      return;
    }

    elements.transcriptEmpty.hidden = true;
    elements.transcriptList.hidden = false;
    elements.transcriptEmpty.classList.remove('is-loading');
    state.hitChunkIds = state.query
      ? state.episode.chunks
        .filter((chunk) => `${chunk.speaker || ''} ${chunk.text} ${chunk.excerpt}`.toLowerCase().includes(state.query.toLowerCase()))
        .map((chunk) => chunk.id)
      : [];
    const coverageLabel = isOutlineCoverage ? 'outline' : 'transcript';
    renderEpisodeSummary();
    elements.transcriptSummary.textContent = state.query
      ? `${state.episode.chunks.length} ${coverageLabel} passage${state.episode.chunks.length === 1 ? '' : 's'} available. ${state.hitChunkIds.length} matching ${isOutlineCoverage ? 'outline' : 'transcript'} hit${state.hitChunkIds.length === 1 ? '' : 's'} for "${state.query}".`
      : `${state.episode.chunks.length} ${coverageLabel} passage${state.episode.chunks.length === 1 ? '' : 's'} available. Select any timestamp to keep the active ${isOutlineCoverage ? 'outline section' : 'transcript moment'} in context.`;

    elements.transcriptList.innerHTML = state.episode.chunks.map((chunk) => `
      <article class="aps-transcript-chunk" data-chunk-id="${shared.escapeHtml(chunk.id)}" id="${shared.escapeHtml(chunk.id)}" tabindex="-1">
        <div class="aps-transcript-head">
          <div class="aps-result-copy">
            <button type="button" class="aps-timestamp-button" data-action="select-chunk" data-chunk-id="${shared.escapeHtml(chunk.id)}">
              <span class="aps-time-chip">${shared.escapeHtml(chunk.startTimestamp)}${chunk.endTimestamp ? `-${shared.escapeHtml(chunk.endTimestamp)}` : ''}</span>
            </button>
            ${chunk.speaker ? `<p class="aps-result-speaker">${shared.escapeHtml(chunk.speaker)}</p>` : ''}
          </div>
          ${state.episode.episode.youtubeId ? `
            <div class="aps-transcript-actions">
              <a class="btn ghost" href="https://www.youtube.com/watch?v=${shared.escapeHtml(state.episode.episode.youtubeId)}&t=${shared.escapeHtml(String(chunk.startSeconds))}s" target="_blank" rel="noopener noreferrer">YouTube</a>
            </div>
          ` : ''}
        </div>
        <h3 class="aps-transcript-title">${state.query ? buildHighlightHtml(chunk.excerpt, state.query) : shared.escapeHtml(chunk.excerpt)}</h3>
        <p class="aps-transcript-body">${state.query ? buildHighlightHtml(chunk.text, state.query) : shared.escapeHtml(chunk.text)}</p>
      </article>
    `).join('');
  }

  function renderEpisode() {
    const { episode } = state.episode;
    document.title = `${episode.title} | All-In Podcast Utility`;
    elements.title.textContent = episode.title;
    elements.subtitle.hidden = true;
    elements.meta.hidden = true;
    elements.meta.innerHTML = '';

    if (elements.backToSearch) {
      const backUrl = new URL(state.query ? '/all-in-podcast-search/all-in/search/' : '/all-in-podcast-search/all-in/', window.location.origin);
      if (state.query) {
        backUrl.searchParams.set('q', state.query);
        elements.backToSearch.textContent = 'Back to Search';
      } else {
        elements.backToSearch.textContent = 'Back to Episodes';
      }
      elements.backToSearch.href = `${backUrl.pathname}${backUrl.search}`;
    }

    const fullEpisodeHref = getFullEpisodeHref(episode);
    if (fullEpisodeHref && elements.openFullEpisode) {
      elements.openFullEpisode.hidden = false;
      elements.openFullEpisode.href = fullEpisodeHref;
      elements.openFullEpisode.textContent = episode.youtubeId ? 'Open Full Episode' : 'Open Official Episode';
    } else {
      elements.openFullEpisode.hidden = true;
      elements.openFullEpisode.href = '#';
    }

    renderTranscript();
    if (state.episode.chunks.length) {
      updateSelectedChunk(getInitialChunk(), {
        autoplay: shared.shouldAutoplayFromUrl(),
        scrollIntoView: Boolean(window.location.hash || shared.getTimeFromUrl()),
        instant: true,
        focusChunk: Boolean(window.location.hash || shared.getTimeFromUrl())
      });
    }
  }

  async function initialize() {
    const episodeId = getEpisodeId();
    state.query = shared.getSearchQueryFromUrl().trim();
    if (!episodeId) {
      elements.title.textContent = 'Episode not found';
      elements.subtitle.textContent = 'No episode id was provided in the URL.';
      return;
    }

    try {
      state.episode = await shared.loadEpisodeById(episodeId);
      elements.transcriptList?.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) {
          return;
        }

        const chunk = state.episode?.chunkMap?.[target.dataset.chunkId];
        if (!chunk) {
          return;
        }

        if (target.dataset.action === 'select-chunk') {
          updateSelectedChunk(chunk, { autoplay: true, scrollIntoView: false, revealPlayer: true });
        }
      });
      elements.summary?.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action="play-summary-moment"]');
        if (!target) {
          return;
        }

        event.preventDefault();
        const chunk = state.episode?.chunkMap?.[target.dataset.chunkId];
        if (chunk) {
          updateSelectedChunk(chunk, { autoplay: true, scrollIntoView: false, focusChunk: true, revealPlayer: true });
        }
      });
      renderEpisode();
      window.addEventListener('hashchange', () => {
        const hashId = window.location.hash.replace(/^#/, '');
        const chunk = state.episode.chunkMap[hashId];
        if (chunk) {
          updateSelectedChunk(chunk, { autoplay: false, scrollIntoView: true, focusChunk: true });
        }
      });
    } catch (error) {
      console.error('all-in-podcast-episode.js: failed to load episode data', error);
      elements.title.textContent = 'Episode unavailable';
      elements.subtitle.textContent = 'The requested local episode data file could not be loaded.';
      elements.transcriptEmpty.hidden = false;
      elements.transcriptEmpty.classList.remove('is-loading');
      elements.transcriptEmpty.innerHTML = '<h3>Episode data unavailable</h3><p>The transcript and playback data could not be loaded from the local JSON files.</p>';
    }
  }

  initialize();
})();
