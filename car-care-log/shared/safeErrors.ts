const QUOTED_POSIX_PATH_PATTERN = /(["'`])\/(?:Applications|Library|System|Users|Volumes|bin|etc|opt|private|sbin|tmp|usr|var)[^"'`]*\1/g;
const POSIX_PATH_PATTERN = /\/(?:Applications|Library|System|Users|Volumes|bin|etc|opt|private|sbin|tmp|usr|var)(?:\/[^\s"'`:;,)\]]+)+/g;
const WINDOWS_PATH_PATTERN = /[A-Za-z]:\\[^\s"'`:;,)\]]+/g;
const FILE_URL_PATTERN = /file:\/\/\/[^\s"'`:;,)\]]+/g;

function cleanErrorPrefix(message: string): string {
  return message
    .replace(/^Error:\s*/i, '')
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();
}

export function stripLocalPaths(message: string): string {
  return message
    .replace(QUOTED_POSIX_PATH_PATTERN, '$1[local file]$1')
    .replace(FILE_URL_PATTERN, '[local file]')
    .replace(POSIX_PATH_PATTERN, '[local file]')
    .replace(WINDOWS_PATH_PATTERN, '[local file]');
}

export function userSafeErrorMessage(
  error: unknown,
  fallback = 'The action could not be completed. Try again or choose another local file or folder.'
): string {
  const raw = typeof error === 'string' ? error : error instanceof Error ? error.message : String(error ?? '');
  const withoutPrefix = cleanErrorPrefix(raw);
  if (!withoutPrefix) return fallback;

  const withoutPaths = stripLocalPaths(withoutPrefix);
  if (withoutPaths !== withoutPrefix && /\b(?:ENOENT|EACCES|EPERM|ENOTDIR|EISDIR|open|copy|read|write|stat)\b/i.test(withoutPrefix)) {
    return 'A local file or folder could not be read. Choose it again and try once more.';
  }

  const normalized = cleanErrorPrefix(withoutPaths).replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}
