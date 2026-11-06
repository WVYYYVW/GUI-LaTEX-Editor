// MathLive のフォントを Vite の public フォルダへコピーする（npm install 後に自動実行）
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'mathlive', 'fonts');
const dest = join(root, 'src', 'renderer', 'public', 'mathlive-fonts');

if (!existsSync(src)) {
  console.warn('[copy-assets] mathlive/fonts が見つかりません（未インストール？）');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('[copy-assets] MathLive fonts ->', dest);
