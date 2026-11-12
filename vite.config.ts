import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const DATA_PATH = '/data/trainingsdaten.json';

/**
 * Serves trainingsdaten.json from DATA_DIR during `vite dev` and `vite preview`,
 * the same URL Caddy serves in production. Defaults to the sample data.
 */
function trainingData(): Plugin {
  const file = resolve(process.env.DATA_DIR ?? 'sample-data', 'trainingsdaten.json');
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url?.split('?')[0] !== DATA_PATH) return next();
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
    name: 'training-data',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig({
  plugins: [svelte(), trainingData()],
  server: { port: 5173 },
  preview: { port: 4173 },
  test: { include: ['src/**/*.test.ts'] },
});
