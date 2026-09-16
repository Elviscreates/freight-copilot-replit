# Freight Copilot source bundle

This archive contains the Freight Copilot React/Vite dashboard source and its workspace configuration.

## Run locally

1. Install pnpm.
2. From the repository root, run `pnpm install`.
3. Start the dashboard with `pnpm --filter @workspace/freight-copilot run dev`.
4. For a production build, set `PORT` and run `pnpm --filter @workspace/freight-copilot run build`.

The main application is in `artifacts/freight-copilot/`.
Branding assets are in `artifacts/freight-copilot/public/branding/`.
