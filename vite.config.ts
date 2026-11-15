import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Serves the data files during `vite dev` and `vite preview`, at the URLs Caddy
 * uses in production: trainingsdaten.json from DATA_DIR and gewichtsdaten.json
 * from WEIGHT_DIR. Both default to the sample data.
 */
function dataFiles(): Plugin {
  const files: Record<string, string> = {
    '/data/trainingsdaten.json': resolve(process.env.DATA_DIR ?? 'sample-data', 'trainingsdaten.json'),
    '/data/gewichtsdaten.json': resolve(process.env.WEIGHT_DIR ?? 'sample-data', 'gewichtsdaten.json'),
  };
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const file = files[req.url?.split('?')[0] ?? ''];
    if (!file) return next();
    readFile(file)
      .then((body) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(body);
      })
      .catch(() => {
        res.statusCode = 404;
        res.end();
      });
  };
  return {
    name: 'data-files',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig({
  plugins: [svelte(), dataFiles()],
  server: { port: 5173 },
  preview: { port: 4173 },
  test: { include: ['src/**/*.test.ts', 'withings/**/*.test.ts'] },
});
