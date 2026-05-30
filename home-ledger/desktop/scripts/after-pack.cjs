const fs = require("node:fs/promises");
const path = require("node:path");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const plistPath = path.join(context.appOutDir, "Home Basis Tracker.app", "Contents", "Info.plist");
  let plist = await fs.readFile(plistPath, "utf8");
  plist = plist.replace(
    /(<key>NSAllowsArbitraryLoads<\/key>\s*)<true\/>/,
    "$1<false/>",
  );
  await fs.writeFile(plistPath, plist, "utf8");
};
