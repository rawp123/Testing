export function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function escapeForRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightText(text, query, escapeHtml) {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  let highlighted = escapeHtml(text);

  terms.forEach((term) => {
    const pattern = new RegExp(`(${escapeForRegExp(escapeHtml(term))})`, 'ig');
    highlighted = highlighted.replace(pattern, '<mark>$1</mark>');
  });

  return highlighted;
}

export function countOccurrences(haystack, needle) {
  const normalizedHaystack = normalizeText(haystack).toLowerCase();
  const normalizedNeedle = normalizeText(needle).toLowerCase();

  if (!normalizedHaystack || !normalizedNeedle) {
    return 0;
  }

  const pattern = new RegExp(escapeForRegExp(normalizedNeedle), 'g');
  const matches = normalizedHaystack.match(pattern);
  return matches ? matches.length : 0;
}
