// electron-builder の設定（npm run dist で使う）。
// macOS: 環境変数 CSC_LINK（Developer ID Application 証明書の .p12）があれば正式に署名し、
//        APPLE_ID・APPLE_APP_SPECIFIC_PASSWORD・APPLE_TEAM_ID もあれば Apple の公証（notarize）も行う。
//        どちらも無ければこれまでどおりアドホック署名（identity "-"）。
// Windows: 署名は GitHub Actions のワークフローで SSL.com eSigner を使って行う（.github/workflows/build.yml）。
// 手順は docs/signing.md を参照。
const macSign = !!process.env.CSC_LINK;
const macNotarize =
  macSign && !!(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID);

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'io.github.wvyyyvw.latexproblemeditor',
  productName: 'LaTeX Problem Editor',
  files: ['electron/**/*', 'dist/renderer/**/*', 'package.json'],
  directories: { output: 'release' },
  // 問題集ファイル（.mpb）。以前の .mathprob もこのアプリで開く
  fileAssociations: [{ ext: ['mpb', 'mathprob'], name: 'Math Problem Set', role: 'Editor' }],
  mac: {
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] },
    ],
    // 証明書があれば electron-builder が CSC_LINK の証明書を使う。無ければアドホック署名
    identity: macSign ? undefined : '-',
    // 公証には Hardened Runtime が必要（Electron 用の entitlements は electron-builder の既定を使う）
    hardenedRuntime: macSign,
    notarize: macNotarize,
    artifactName: '${productName}-${version}-mac-${arch}.${ext}',
    category: 'public.app-category.education',
  },
  win: { target: ['nsis'] },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
};
