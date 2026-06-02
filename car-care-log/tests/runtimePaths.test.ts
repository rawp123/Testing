import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { preferUnpackedPath, unpackedVariantForPackagedPath } from '../backend/runtimePaths';

let tempRoot = '';

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'car-care-log-runtime-path-test-'));
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('packaged runtime path helpers', () => {
  it('prefers app.asar.unpacked when a packaged file asset exists there', () => {
    const packedPath = path.join(tempRoot, 'Car Care Log.app', 'Contents', 'Resources', 'app.asar', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const unpackedPath = packedPath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
    fs.mkdirSync(path.dirname(unpackedPath), { recursive: true });
    fs.writeFileSync(unpackedPath, 'local wasm placeholder');

    expect(preferUnpackedPath(packedPath)).toBe(unpackedPath);
  });

  it('builds unpacked variants for Windows-style packaged paths', () => {
    const packedPath = String.raw`C:\Users\test\AppData\Local\Programs\Car Care Log\resources\app.asar\node_modules\sql.js\dist\sql-wasm.wasm`;
    const unpackedPath = String.raw`C:\Users\test\AppData\Local\Programs\Car Care Log\resources\app.asar.unpacked\node_modules\sql.js\dist\sql-wasm.wasm`;

    expect(unpackedVariantForPackagedPath(packedPath)).toBe(unpackedPath);
    expect(preferUnpackedPath(packedPath, (filePath) => filePath === unpackedPath)).toBe(unpackedPath);
  });

  it('builds unpacked variants for POSIX-style packaged paths', () => {
    const packedPath = '/opt/Car Care Log/resources/app.asar/node_modules/pdfjs-dist/package.json';
    const unpackedPath = '/opt/Car Care Log/resources/app.asar.unpacked/node_modules/pdfjs-dist/package.json';

    expect(unpackedVariantForPackagedPath(packedPath)).toBe(unpackedPath);
    expect(preferUnpackedPath(packedPath, (filePath) => filePath === unpackedPath)).toBe(unpackedPath);
  });

  it('keeps normal development paths unchanged', () => {
    const devPath = path.join(tempRoot, 'node_modules', 'pdfjs-dist', 'standard_fonts');

    expect(preferUnpackedPath(devPath)).toBe(devPath);
  });
});
