const fs = require("node:fs");
const path = require("node:path");

const plistPath = path.resolve(
  __dirname,
  "../../release/mac/mac-arm64/Home Basis Tracker.app/Contents/Info.plist",
);

if (!fs.existsSync(plistPath)) {
  console.error("Packaged Home Basis Tracker app was not found. Run npm run pack:mac first.");
  process.exit(1);
}

const plist = fs.readFileSync(plistPath, "utf8");
if (/<key>NSAllowsArbitraryLoads<\/key>\s*<true\/>/.test(plist)) {
  console.error("Packaged app allows arbitrary network loads. This should stay disabled for the local-first beta.");
  process.exit(1);
}

const requiredResources = [
  "frontend/index.html",
  "frontend/app.js",
  "frontend/styles.css",
  "backend/domain/model.js",
  "backend/storage/document-storage.js",
  "backend/storage/records-storage.js",
  "node_modules/tesseract.js/dist/tesseract.esm.min.js",
  "node_modules/tesseract.js/dist/worker.min.js",
  "node_modules/tesseract.js-core/tesseract-core.wasm.js",
  "node_modules/tesseract.js-core/tesseract-core-simd.wasm.js",
  "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
  "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  "node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz",
  "node_modules/pdfjs-dist/build/pdf.mjs",
  "node_modules/pdfjs-dist/build/pdf.worker.mjs",
  "node_modules/pdfjs-dist/cmaps/H.bcmap",
  "node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf",
  "node_modules/pdfjs-dist/wasm/openjpeg.wasm",
  "node_modules/pdfjs-dist/image_decoders/pdf.image_decoders.mjs",
];
const resourcesDir = path.resolve(
  __dirname,
  "../../release/mac/mac-arm64/Home Basis Tracker.app/Contents/Resources/home-ledger",
);
const missingResources = requiredResources.filter((fileName) => !fs.existsSync(path.join(resourcesDir, fileName)));

if (missingResources.length) {
  console.error(`Packaged app is missing Home Basis Tracker resources: ${missingResources.join(", ")}`);
  process.exit(1);
}

console.log("Packaged Home Basis Tracker app passed local-first package checks.");
