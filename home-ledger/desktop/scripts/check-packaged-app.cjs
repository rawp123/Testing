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
  "index.html",
  "app.js",
  "model.js",
  "document-storage.js",
  "storage-adapter.js",
  "styles.css",
];
const resourcesDir = path.resolve(
  __dirname,
  "../../release/mac/mac-arm64/Home Basis Tracker.app/Contents/Resources/home-ledger",
);
const missingResources = requiredResources.filter((fileName) => !fs.existsSync(path.join(resourcesDir, fileName)));

if (missingResources.length) {
  console.error(`Packaged app is missing Home Ledger resources: ${missingResources.join(", ")}`);
  process.exit(1);
}

console.log("Packaged Home Basis Tracker app passed local-first package checks.");
