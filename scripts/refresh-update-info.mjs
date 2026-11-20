// 署名などでインストーラーを書き換えた後に、自動更新の情報（latest.yml / latest-mac.yml）の
// ハッシュと大きさを付け直す。書き換えたファイルの差分更新用の .blockmap は合わなくなるので消す
// （自動更新は差分ではなく全体のダウンロードになる）。
// 使い方: node scripts/refresh-update-info.mjs [release フォルダ]
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import yaml from 'js-yaml';

const dir = process.argv[2] || 'release';
const sha512 = (f) => createHash('sha512').update(readFileSync(f)).digest('base64');
let changed = 0;
for (const name of readdirSync(dir).filter((n) => /^latest(-[a-z]+)?\.yml$/.test(n))) {
  const ymlPath = path.join(dir, name);
  const info = yaml.load(readFileSync(ymlPath, 'utf8'));
  for (const f of info.files || []) {
    const file = path.join(dir, f.url);
    if (!existsSync(file)) continue;
    const hash = sha512(file);
    if (hash === f.sha512) continue;
    f.sha512 = hash;
    f.size = statSync(file).size;
    delete f.blockMapSize;
    if (existsSync(`${file}.blockmap`)) rmSync(`${file}.blockmap`);
    if (info.path === f.url) info.sha512 = hash;
    changed++;
    console.log(`${name}: ${f.url} のハッシュを付け直しました`);
  }
  writeFileSync(ymlPath, yaml.dump(info, { lineWidth: -1 }));
}
console.log(changed ? `${changed} 件を付け直しました` : '変更はありません');
