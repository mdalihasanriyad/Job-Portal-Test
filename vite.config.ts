import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Serves the same API handler used on Vercel directly from the Vite dev server,
 * so `npm run dev` is all you need locally (no `vercel dev`, no second process).
 */
function apiDevPlugin(): Plugin {
  return {
    name: 'govtjob-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        try {
          const mod = await server.ssrLoadModule('/api/_lib/router.ts');
          await (mod as { handleRequest: (r: unknown, s: unknown) => Promise<void> }).handleRequest(req, res);
        } catch (error) {
          if (error instanceof Error) server.ssrFixStacktrace(error);
          console.error('[api-dev]', error instanceof Error ? error.message : error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
          res.end(JSON.stringify({ error: 'server_error', message: 'সার্ভারে সমস্যা হয়েছে।' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make .env values available to the API handler in dev (server-side only; never sent to the browser).
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [react(), apiDevPlugin()],
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Stable vendor chunk = better long-term caching across deployments.
          manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] },
        },
      },
    },
  };
});
