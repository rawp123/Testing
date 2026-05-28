const { execFileSync } = require("node:child_process");
const path = require("node:path");

module.exports = async function patchMacInfoPlist(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const productFilename = context.packager.appInfo.productFilename;
  const infoPlistPath = path.join(context.appOutDir, `${productFilename}.app`, "Contents", "Info.plist");

  execFileSync("plutil", [
    "-replace",
    "NSAppTransportSecurity.NSAllowsArbitraryLoads",
    "-bool",
    "NO",
    infoPlistPath,
  ]);
};
