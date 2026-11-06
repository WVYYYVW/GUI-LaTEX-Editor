// ビルド済みの画面で Electron を起動する
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.VITE_DEV_SERVER_URL;

const child = spawn(electronPath, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('close', (code) => process.exit(code ?? 0));
