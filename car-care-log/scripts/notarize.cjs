const path = require('node:path');
const { notarize } = require('@electron/notarize');

function notarizationOptions(appPath) {
  const keychainProfile = process.env.APPLE_NOTARIZE_KEYCHAIN_PROFILE || process.env.APPLE_KEYCHAIN_PROFILE;
  const keychain = process.env.APPLE_NOTARIZE_KEYCHAIN || process.env.APPLE_KEYCHAIN;

  if (keychainProfile) {
    return {
      appPath,
      tool: 'notarytool',
      keychainProfile,
      keychain: keychain || undefined
    };
  }

  if (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) {
    return {
      appPath,
      tool: 'notarytool',
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER
    };
  }

  if (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) {
    return {
      appPath,
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    };
  }

  return null;
}

module.exports = async function notarizeAfterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const options = notarizationOptions(appPath);

  if (!options) {
    if (process.env.APPLE_NOTARIZE === '1') {
      throw new Error(
        'APPLE_NOTARIZE=1 was set, but no complete notarization credential set was found. See README packaging notes.'
      );
    }
    console.log('Skipping notarization: no Apple notarization credentials were provided.');
    return;
  }

  console.log(`Submitting ${appPath} for Apple notarization.`);
  await notarize(options);
};
