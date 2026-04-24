export function getEpisodeYear(episode) {
  return String(episode.publishDate || '').slice(0, 4);
}

export function getEpisodeGuests(episode) {
  return Array.isArray(episode.guests) ? episode.guests.filter(Boolean) : [];
}

export function getEpisodeTopics(episode) {
  return Array.isArray(episode.topicTags) ? episode.topicTags.filter(Boolean) : [];
}

export function hasTranscript(episode) {
  if (typeof episode.transcriptAvailable === 'boolean') {
    return episode.transcriptAvailable;
  }

  return Number(episode.chunkCount) > 0;
}

export function describeSearchCoverage(episode) {
  if (!episode.transcriptAvailable) {
    return 'None';
  }

  if (episode.transcriptSourceType === 'rss-description-outline') {
    return 'Outline';
  }

  return 'Transcript';
}

export function formatEpisodeDuration(episode) {
  return episode.durationLabel || '—';
}

export function getFullEpisodeLink(episode) {
  const href = episode.fullEpisodeUrl || episode.officialPageUrl || '';
  if (!href) {
    return null;
  }

  return {
    href,
    label: episode.youtubeId ? 'YouTube' : 'Official page'
  };
}
