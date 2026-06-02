/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.carcarelog.app',
  productName: 'Car Care Log',
  artifactName: 'Car-Care-Log-${version}-${arch}.${ext}',
  directories: {
    output: 'release'
  },
  files: ['out/**/*', 'package.json'],
  asar: true,
  asarUnpack: [
    'node_modules/@napi-rs/canvas*/**/*',
    'node_modules/@tesseract.js-data/eng/**/*',
    'node_modules/pdfjs-dist/standard_fonts/**/*',
    'node_modules/sql.js/dist/sql-wasm.wasm'
  ],
  afterPack: 'scripts/after-pack.cjs',
  afterSign: 'scripts/notarize.cjs',
  npmRebuild: false,
  mac: {
    target: ['dir', 'dmg', 'zip'],
    icon: 'assets/app-icon.icns',
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.inherit.plist',
    gatekeeperAssess: false
  },
  dmg: {
    artifactName: 'Car-Care-Log-${version}-${arch}.${ext}'
  }
};
