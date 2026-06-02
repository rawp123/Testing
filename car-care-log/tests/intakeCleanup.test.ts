import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupStaleIntakeFiles } from '../backend/intakeCleanup';

let tempRoot = '';

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'car-care-log-intake-cleanup-test-'));
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('document intake cleanup', () => {
  it('removes stale app-managed intake files without touching current files', () => {
    const intakeDir = path.join(tempRoot, 'intake');
    fs.mkdirSync(intakeDir, { recursive: true });
    const staleFile = path.join(intakeDir, 'stale.pdf');
    const currentFile = path.join(intakeDir, 'current.pdf');
    fs.writeFileSync(staleFile, 'old');
    fs.writeFileSync(currentFile, 'new');
    const now = Date.now();
    fs.utimesSync(staleFile, new Date(now - 10_000), new Date(now - 10_000));
    fs.utimesSync(currentFile, new Date(now), new Date(now));

    const removed = cleanupStaleIntakeFiles(intakeDir, 5_000, now);

    expect(removed).toBe(1);
    expect(fs.existsSync(staleFile)).toBe(false);
    expect(fs.existsSync(currentFile)).toBe(true);
  });
});
