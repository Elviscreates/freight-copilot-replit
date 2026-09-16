const { execSync } = require('child_process');
const npmPath = '"C:\\Program Files\\nodejs\\npm\\npm.cmd"';
try {
  execSync(`${npmPath} install -g pnpm`, { stdio: 'inherit' });
  console.log('\npnpm installed successfully');
} catch (e) {
  console.error('Failed to install pnpm:', e.message);
  process.exit(1);
}