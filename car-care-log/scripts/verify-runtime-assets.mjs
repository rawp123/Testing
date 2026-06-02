import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createCanvas } from '@napi-rs/canvas';

const require = createRequire(import.meta.url);

function assertExists(label, targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} was not found at ${targetPath}`);
  }
  return targetPath;
}

function findFile(root, predicate) {
  if (!fs.existsSync(root)) return '';
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(fullPath, predicate);
      if (found) return found;
    } else if (predicate(fullPath)) {
      return fullPath;
    }
  }
  return '';
}

function verifyDevelopmentAssets() {
  const englishData = require('@tesseract.js-data/eng');
  const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const canvasRoot = path.dirname(require.resolve('@napi-rs/canvas/package.json'));

  assertExists('Tesseract English data', path.join(englishData.langPath, 'eng.traineddata.gz'));
  assertExists('PDF.js standard fonts', path.join(pdfjsRoot, 'standard_fonts', 'LiberationSans-Regular.ttf'));
  assertExists('SQL.js wasm', require.resolve('sql.js/dist/sql-wasm.wasm'));
  assertExists('Canvas package', canvasRoot);
  assertExists('App icon PNG', path.resolve('assets/app-icon-1024.png'));
  assertExists('App icon ICNS', path.resolve('assets/app-icon.icns'));

  const canvas = createCanvas(10, 10);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 10, 10);
  if (canvas.toBuffer('image/png').length < 50) {
    throw new Error('Canvas PNG encoding did not produce a valid buffer.');
  }

  if (process.platform === 'darwin') {
    assertExists('macOS sips fallback', '/usr/bin/sips');
    assertExists('macOS Quick Look fallback', '/usr/bin/qlmanage');
  }
}

function verifyPackagedApp(appPath) {
  const resourcesDir = path.join(appPath, 'Contents', 'Resources');
  const plistPath = path.join(appPath, 'Contents', 'Info.plist');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const unpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
  const unpackedNodeModules = path.join(unpackedDir, 'node_modules');

  assertExists('Packaged app', appPath);
  assertExists('Packaged app.asar', asarPath);
  assertExists('Packaged app.asar.unpacked', unpackedDir);
  assertExists(
    'Packaged Tesseract English data',
    path.join(unpackedNodeModules, '@tesseract.js-data', 'eng', '4.0.0', 'eng.traineddata.gz')
  );
  assertExists(
    'Packaged PDF.js standard fonts',
    path.join(unpackedNodeModules, 'pdfjs-dist', 'standard_fonts', 'LiberationSans-Regular.ttf')
  );
  assertExists('Packaged SQL.js wasm', path.join(unpackedNodeModules, 'sql.js', 'dist', 'sql-wasm.wasm'));

  const nativeCanvasBinding = findFile(path.join(unpackedNodeModules, '@napi-rs'), (filePath) => filePath.endsWith('.node'));
  if (!nativeCanvasBinding) {
    throw new Error('Packaged @napi-rs/canvas native binding was not found under app.asar.unpacked.');
  }

  const asar = require('@electron/asar');
  const asarEntries = new Set(asar.listPackage(asarPath).map((entry) => entry.replace(/^\/+/, '')));
  const requiredAsarEntries = [
    'node_modules/tesseract.js/src/worker-script/node/index.js',
    'node_modules/tesseract.js-core/tesseract-core.wasm'
  ];
  for (const entry of requiredAsarEntries) {
    if (!asarEntries.has(entry)) {
      throw new Error(`Packaged OCR runtime entry was not found in app.asar: ${entry}`);
    }
  }

  const plist = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', plistPath], { encoding: 'utf8' }));
  const unusedKeys = [
    'NSAppTransportSecurity',
    'NSAudioCaptureUsageDescription',
    'NSBluetoothAlwaysUsageDescription',
    'NSBluetoothPeripheralUsageDescription',
    'NSCameraUsageDescription',
    'NSMicrophoneUsageDescription'
  ];
  for (const key of unusedKeys) {
    if (key in plist) {
      throw new Error(`Packaged Info.plist still contains unused privacy key ${key}.`);
    }
  }
  if (!plist.CFBundleIconFile || !plist.CFBundleIconFile.endsWith('.icns')) {
    throw new Error(`Packaged app icon was not configured correctly. Found ${plist.CFBundleIconFile}.`);
  }
  assertExists('Packaged app icon', path.join(resourcesDir, plist.CFBundleIconFile));
}

const appArgIndex = process.argv.indexOf('--app');
const appPath = appArgIndex >= 0 ? process.argv[appArgIndex + 1] : '';

verifyDevelopmentAssets();
if (appPath) {
  verifyPackagedApp(path.resolve(appPath));
}

console.log(appPath ? 'Runtime assets verified for development and packaged app.' : 'Runtime assets verified for development.');
