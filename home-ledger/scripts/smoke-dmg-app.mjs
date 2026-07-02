import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const skipMissing = process.argv.includes("--skip-missing");
const quitExisting = process.argv.includes("--quit-existing");
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const smokeScript = path.join(projectRoot, "scripts", "smoke-packaged-app.mjs");
const dmgPath = path.resolve(argValue("--dmg") || "release/mac/Home Ledger-0.1.0-arm64.dmg");

if (process.platform !== "darwin") {
  if (skipMissing) {
    console.warn("Skipping DMG smoke test: hdiutil is only available on macOS.");
    process.exit(0);
  }
  throw new Error("DMG smoke test requires macOS.");
}

if (!fs.existsSync(dmgPath)) {
  const message = `DMG was not found at ${dmgPath}. Run npm run pack:mac:dmg:signed first.`;
  if (skipMissing) {
    console.warn(`Skipping DMG smoke test: ${message}`);
    process.exit(0);
  }
  throw new Error(message);
}

const mountDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "home-ledger-dmg-smoke-")));

function detach() {
  const isMounted = () => {
    const mounts = spawnSync("mount", { encoding: "utf8" });
    return mounts.status === 0 && mounts.stdout.includes(` on ${mountDir} `);
  };

  if (isMounted()) {
    const detached = spawnSync("hdiutil", ["detach", mountDir, "-quiet"], { stdio: "ignore" });
    if (detached.status !== 0) {
      spawnSync("hdiutil", ["detach", mountDir, "-force", "-quiet"], { stdio: "ignore" });
    }
  }
  if (!isMounted()) {
    fs.rmSync(mountDir, { recursive: true, force: true });
  }
}

try {
  const attach = spawnSync("hdiutil", ["attach", dmgPath, "-mountpoint", mountDir, "-nobrowse", "-readonly", "-quiet"], {
    encoding: "utf8",
  });
  if (attach.status !== 0) {
    throw new Error(`Could not mount DMG.\nstdout:\n${attach.stdout}\nstderr:\n${attach.stderr}`);
  }

  const appPath = path.join(mountDir, "Home Ledger.app");
  const smokeArgs = [smokeScript, "--app", appPath];
  if (quitExisting) smokeArgs.push("--quit-existing");
  const smoke = spawnSync(process.execPath, smokeArgs, {
    encoding: "utf8",
  });
  if (smoke.status !== 0) {
    throw new Error(`Mounted DMG smoke failed.\nstdout:\n${smoke.stdout}\nstderr:\n${smoke.stderr}`);
  }

  process.stdout.write(smoke.stdout);
  process.stderr.write(smoke.stderr);
  console.log(`Home Ledger mounted DMG smoke passed: ${dmgPath}`);
} finally {
  detach();
}
