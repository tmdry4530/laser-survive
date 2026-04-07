import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { loadEnv } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
loadEnv(projectRoot);

function getPublicConfig() {
  return {
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  };
}

export function createApp({ staticRoot = projectRoot } = {}) {
  const app = express();
  const publicRoot = path.join(staticRoot, 'public');
  const sourceRoot = path.join(staticRoot, 'src');

  app.get('/api/health', (_req, res) => {
    const config = getPublicConfig();
    res.json({ ok: true, supabaseConfigured: Boolean(config.supabaseUrl && config.supabaseAnonKey) });
  });

  app.get('/app-config.js', (_req, res) => {
    const config = getPublicConfig();
    res.type('application/javascript').send(
      `window.__LASER_CONFIG__ = ${JSON.stringify(config)};`,
    );
  });

  app.use('/public', express.static(publicRoot));
  app.use('/src', express.static(sourceRoot));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(staticRoot, 'index.html'));
  });

  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }

    res.status(404).send('Not found');
  });

  return app;
}

export function startServer({ port = Number(process.env.PORT ?? 3001) } = {}) {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`Laser Survival server running on http://localhost:${port}`);
  });
}

if (process.argv[1] === __filename) {
  startServer();
}
