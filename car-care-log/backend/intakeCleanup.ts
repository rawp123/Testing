import fs from 'node:fs';
import path from 'node:path';

export const STALE_INTAKE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function cleanupStaleIntakeFiles(intakeDir: string, maxAgeMs = STALE_INTAKE_MAX_AGE_MS, now = Date.now()): number {
  if (!fs.existsSync(intakeDir)) return 0;
  let removed = 0;

  for (const entry of fs.readdirSync(intakeDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const filePath = path.join(intakeDir, entry.name);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs <= maxAgeMs) continue;
    fs.rmSync(filePath, { force: true });
    removed += 1;
  }

  return removed;
}
