import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const isDev = process.env.NODE_ENV !== 'production';
const rawPort = process.env.PORT ?? (isDev ? '5173' : '3000');

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig(async () => {
  const plugins = [react(), tailwindcss()];

  if (isDev) {
    try {
      const { runtimeErrorOverlay } = await import('@replit/vite-plugin-runtime-error-modal');
      plugins.push(runtimeErrorOverlay());
    } catch {
      plugins.push({
        name: 'replit-error-overlay-stub',
        transform() {},
      });
    }

    if (process.env.REPL_ID !== undefined) {
      try {
        const { cartographer } = await import('@replit/vite-plugin-cartographer');
        const { devBanner } = await import('@replit/vite-plugin-dev-banner');
        plugins.push(
          cartographer({
            root: path.resolve(import.meta.dirname, '..'),
          }),
          devBanner(),
        );
      } catch {
        // Replit plugins not available, skip
      }
    }
  }

  return {
    base: basePath,
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(
          import.meta.dirname,
          '..',
          '..',
          'attached_assets',
        ),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      fs: {
        strict: true,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
        },
        '/webhook': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});