import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCanvas } from '@napi-rs/canvas';

const assetsDir = path.resolve('assets');
const iconsetDir = path.join(assetsDir, 'app-icon.iconset');
const sourcePng = path.join(assetsDir, 'app-icon-1024.png');
const icnsPath = path.join(assetsDir, 'app-icon.icns');

const ICON_FILES = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
];

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawCar(context, scale) {
  const s = scale / 1024;
  context.save();
  context.translate(0, 10 * s);

  context.fillStyle = '#dff4e8';
  context.strokeStyle = 'rgba(12, 42, 40, 0.24)';
  context.lineWidth = 10 * s;
  context.beginPath();
  context.moveTo(255 * s, 593 * s);
  context.bezierCurveTo(280 * s, 518 * s, 345 * s, 474 * s, 428 * s, 462 * s);
  context.lineTo(602 * s, 462 * s);
  context.bezierCurveTo(681 * s, 468 * s, 746 * s, 514 * s, 779 * s, 588 * s);
  context.lineTo(805 * s, 646 * s);
  context.bezierCurveTo(814 * s, 667 * s, 797 * s, 690 * s, 772 * s, 690 * s);
  context.lineTo(250 * s, 690 * s);
  context.bezierCurveTo(226 * s, 690 * s, 211 * s, 668 * s, 220 * s, 646 * s);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = '#0e4b4c';
  context.beginPath();
  context.moveTo(396 * s, 505 * s);
  context.lineTo(456 * s, 408 * s);
  context.bezierCurveTo(466 * s, 392 * s, 486 * s, 382 * s, 508 * s, 382 * s);
  context.lineTo(594 * s, 382 * s);
  context.bezierCurveTo(619 * s, 382 * s, 643 * s, 396 * s, 657 * s, 419 * s);
  context.lineTo(708 * s, 505 * s);
  context.closePath();
  context.fill();

  context.strokeStyle = 'rgba(223, 244, 232, 0.45)';
  context.lineWidth = 8 * s;
  context.beginPath();
  context.moveTo(545 * s, 391 * s);
  context.lineTo(530 * s, 506 * s);
  context.stroke();

  for (const x of [329, 698]) {
    context.fillStyle = '#103332';
    context.beginPath();
    context.arc(x * s, 689 * s, 63 * s, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#eaf7ed';
    context.beginPath();
    context.arc(x * s, 689 * s, 27 * s, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  const s = size / 1024;

  context.clearRect(0, 0, size, size);

  roundedRect(context, 24 * s, 24 * s, 976 * s, 976 * s, 214 * s);
  const background = context.createLinearGradient(0, 0, size, size);
  background.addColorStop(0, '#14504c');
  background.addColorStop(0.48, '#1f735f');
  background.addColorStop(1, '#0d3035');
  context.fillStyle = background;
  context.fill();

  context.save();
  roundedRect(context, 24 * s, 24 * s, 976 * s, 976 * s, 214 * s);
  context.clip();

  const glow = context.createRadialGradient(262 * s, 195 * s, 18 * s, 262 * s, 195 * s, 720 * s);
  glow.addColorStop(0, 'rgba(255,255,255,0.33)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);

  context.fillStyle = 'rgba(255,255,255,0.13)';
  roundedRect(context, 662 * s, 126 * s, 188 * s, 640 * s, 48 * s);
  context.fill();
  context.fillStyle = 'rgba(12, 42, 40, 0.18)';
  roundedRect(context, 688 * s, 162 * s, 134 * s, 548 * s, 32 * s);
  context.fill();

  context.fillStyle = '#f5f1db';
  roundedRect(context, 309 * s, 170 * s, 356 * s, 468 * s, 42 * s);
  context.fill();
  context.fillStyle = '#cde7d3';
  roundedRect(context, 356 * s, 236 * s, 260 * s, 28 * s, 14 * s);
  context.fill();
  roundedRect(context, 356 * s, 306 * s, 208 * s, 24 * s, 12 * s);
  context.fill();
  roundedRect(context, 356 * s, 374 * s, 252 * s, 24 * s, 12 * s);
  context.fill();
  context.fillStyle = '#3c9b74';
  roundedRect(context, 356 * s, 446 * s, 132 * s, 30 * s, 15 * s);
  context.fill();

  context.shadowColor = 'rgba(0, 0, 0, 0.26)';
  context.shadowBlur = 34 * s;
  context.shadowOffsetY = 20 * s;
  drawCar(context, size);
  context.restore();

  context.lineWidth = 12 * s;
  context.strokeStyle = 'rgba(255,255,255,0.22)';
  roundedRect(context, 30 * s, 30 * s, 964 * s, 964 * s, 206 * s);
  context.stroke();

  return canvas;
}

fs.mkdirSync(iconsetDir, { recursive: true });

for (const [fileName, size] of ICON_FILES) {
  const canvas = drawIcon(size);
  fs.writeFileSync(path.join(iconsetDir, fileName), canvas.toBuffer('image/png'));
}

fs.writeFileSync(sourcePng, drawIcon(1024).toBuffer('image/png'));

if (process.platform === 'darwin') {
  execFileSync('/usr/bin/iconutil', ['-c', 'icns', '-o', icnsPath, iconsetDir]);
} else {
  console.warn('Skipping .icns generation because iconutil is only available on macOS.');
}

console.log(`Generated ${path.relative(process.cwd(), sourcePng)}`);
if (fs.existsSync(icnsPath)) {
  console.log(`Generated ${path.relative(process.cwd(), icnsPath)}`);
}
