import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const rawPort = process.env.PORT ?? '5173';
const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';
const apiOrigin = process.env.VITE_API_BASE_URL?.trim();

if (process.env.VITE_REQUIRE_API_BASE_URL === 'true') {
  if (!apiOrigin) {
    throw new Error('VITE_API_BASE_URL is required for a separately hosted storefront.');
  }
  try {
    const parsedApiOrigin = new URL(apiOrigin);
    if (
      !['http:', 'https:'].includes(parsedApiOrigin.protocol) ||
      parsedApiOrigin.username ||
      parsedApiOrigin.password ||
      parsedApiOrigin.pathname !== '/' ||
      parsedApiOrigin.search ||
      parsedApiOrigin.hash
    ) {
      throw new Error('invalid API origin');
    }
  } catch {
    throw new Error('VITE_API_BASE_URL must be an HTTP(S) origin without a path.');
  }
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss({ optimize: false })],
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
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
