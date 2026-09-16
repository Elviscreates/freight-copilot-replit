const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const projectDir = path.join(__dirname, 'artifacts/freight-copilot');
process.chdir(projectDir);

// Find vite binary
const binDir = path.join(projectDir, 'node_modules/.bin');
const vitePath = path.join(binDir, 'vite');

if (!fs.existsSync(vitePath)) {
  console.error('vite binary not found at', vitePath);
  process.exit(1);
}

// On Windows, spawn needs the .cmd extension or use shell
const isWindows = os.platform() === 'win32';
const viteCmd = isWindows ? 'cmd' : 'sh';
const viteArgs = isWindows 
  ? ['/c', vitePath, '--config', 'vite.config.ts', '--host', '0.0.0.0'] 
  : ['-c', `${vitePath} --config vite.config.ts --host 0.0.0.0`];

const vite = spawn(viteCmd, viteArgs, { stdio: 'inherit' });
vite.on('error', (err) => {
  console.error('vite error:', err);
  process.exit(1);
});