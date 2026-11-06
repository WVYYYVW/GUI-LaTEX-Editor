// 開発用: Vite の dev サーバーを起動し、Electron をそこに接続する
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const server = await createServer({ configFile: 'vite.config.mjs' });
await server.listen();
const url = server.resolvedUrls.local[0];
console.log('[dev] renderer:', url);

const env = { ...process.env, VITE_DEV_SERVER_URL: url };
delete env.ELECTRON_RUN_AS_NODE; // 親プロセスが Electron の場合に Node として起動されるのを防ぐ

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env });
child.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
