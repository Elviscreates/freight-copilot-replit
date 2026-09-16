const { execSync } = require('child_process');
try {
  // Try corepack first
  execSync('corepack enable', { stdio: 'pipe' });
  execSync('corepack prepare pnpm@latest --activate', { stdio: 'pipe' });
  console.log('corepack pnpm activated');
} catch (e) {
  console.log('corepack failed, trying npm approach...');
}
try {
  // Try direct pnpm install
  const { execSync } = require('child_process');
  execSync('npm install -g pnpm', { stdio: 'inherit' });
  console.log('\npnpm installed via npm');
} catch (e2) {
  console.error('Failed:', e2.message);
  process.exit(1);
}