const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectDir = path.resolve(__dirname, "..");
const packagePath = path.join(projectDir, "desktop", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const appPath = path.join(
  projectDir,
  "release",
  "mac",
  "mac-arm64",
  `${packageJson.productName}.app`,
);
const resourcesDir = path.join(appPath, "Contents", "Resources");
const plistPath = path.join(appPath, "Contents", "Info.plist");

function assertExists(label, targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} was not found at ${targetPath}`);
  }
}

function readPlistJson() {
  const output = execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", plistPath], {
    encoding: "utf8",
  });
  return JSON.parse(output);
}

assertExists("Packaged app", appPath);
assertExists("Packaged Info.plist", plistPath);
assertExists(
  "Packaged backend executable",
  path.join(resourcesDir, "backend", "message-archive-backend"),
);
assertExists("Packaged frontend index", path.join(resourcesDir, "frontend", "dist", "index.html"));

const frontendAssetsDir = path.join(resourcesDir, "frontend", "dist", "assets");
assertExists("Packaged frontend assets directory", frontendAssetsDir);
const frontendAssets = fs.readdirSync(frontendAssetsDir);
if (!frontendAssets.some((fileName) => fileName.endsWith(".js"))) {
  throw new Error("Packaged frontend assets do not include a JavaScript bundle.");
}
if (!frontendAssets.some((fileName) => fileName.endsWith(".css"))) {
  throw new Error("Packaged frontend assets do not include a CSS bundle.");
}

const plist = readPlistJson();
if (plist.NSAppTransportSecurity?.NSAllowsArbitraryLoads) {
  throw new Error("Packaged app allows arbitrary network loads. This should stay disabled.");
}
const exceptionDomains = plist.NSAppTransportSecurity?.NSExceptionDomains || {};
for (const domainName of ["127.0.0.1", "localhost"]) {
  if (!exceptionDomains[domainName]?.NSTemporaryExceptionAllowsInsecureHTTPLoads) {
    throw new Error(`Packaged app is missing the local HTTP exception for ${domainName}.`);
  }
}

const unusedPrivacyKeys = [
  "NSAudioCaptureUsageDescription",
  "NSBluetoothAlwaysUsageDescription",
  "NSBluetoothPeripheralUsageDescription",
  "NSCameraUsageDescription",
  "NSMicrophoneUsageDescription",
];
for (const key of unusedPrivacyKeys) {
  if (!plist[key] || !String(plist[key]).includes("does not use")) {
    throw new Error(`Packaged Info.plist is missing the defensive privacy description for ${key}.`);
  }
}

const codeSignResult = spawnSync("/usr/bin/codesign", ["--display", "--verbose=2", appPath], {
  encoding: "utf8",
});
if (codeSignResult.status !== 0) {
  throw new Error(`codesign metadata check failed: ${codeSignResult.stderr || codeSignResult.stdout}`);
}
const codeSignature = `${codeSignResult.stdout}\n${codeSignResult.stderr}`;
if (!/Identifier=com\.messagearchive\.utility/.test(codeSignature)) {
  throw new Error("Packaged app code signature does not report the expected app identifier.");
}

console.log("Packaged Message Archive Utility app passed local package checks.");
