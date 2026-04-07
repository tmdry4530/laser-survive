import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createDatabase } from './db.js';
import { loadEnv } from './env.js';
import { validateLeaderboardQuery, validatePlayerNameQuery, validateScorePayload } from './validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
loadEnv(projectRoot);
const defaultDbPath = process.env.LASER_DB_PATH
  ? path.resolve(projectRoot, process.env.LASER_DB_PATH)
  : path.join(projectRoot, 'server', 'data', 'laser-survival.db');

function hashIp(ip = '') {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function createRateLimiter({ max = 20, windowMs = 60_000 } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const bucket = buckets.get(ip) ?? [];
    const recent = bucket.filter((timestamp) => now - timestamp < windowMs);
    recent.push(now);
    buckets.set(ip, recent);

    if (recent.length > max) {
      res.status(429).json({ ok: false, error: 'Too many requests' });
      return;
    }

    next();
  };
}

function toLeaderboardItems(rows) {
  return rows.map((row, index) => ({
    rank: index + 1,
    playerName: row.player_name,
    survivalTime: row.survival_time,
    createdAt: row.created_at,
    mode: row.mode,
  }));
}

export function createApp({ db, staticRoot = projectRoot } = {}) {
  const app = express();
  const database = db ?? createDatabase(defaultDbPath);
  const rateLimiter = createRateLimiter();
  const publicRoot = path.join(staticRoot, 'public');
  const sourceRoot = path.join(staticRoot, 'src');

  app.use(express.json());

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/scores', rateLimiter, (req, res) => {
    const validated = validateScorePayload(req.body);
    if (!validated.ok) {
      res.status(validated.status).json({ ok: false, error: validated.error });
      return;
    }

    const createdAt = new Date().toISOString();
    const duplicateFloor = new Date(Date.now() - 15_000).toISOString();
    const ipHash = hashIp(req.ip || req.socket.remoteAddress);
    const payload = {
      ...validated.value,
      createdAt,
      ipHash,
    };

    if (database.hasRecentDuplicate(payload.playerName, payload.mode, payload.survivalTime, duplicateFloor)) {
      res.status(409).json({ ok: false, error: 'Duplicate score submission' });
      return;
    }

    const previousBest = database.getBest(payload.playerName, payload.mode) ?? 0;
    database.insertScore(payload);
    const rank = database.getRank(payload.mode, payload.survivalTime, createdAt);

    res.status(201).json({
      ok: true,
      rank,
      isPersonalBest: payload.survivalTime > previousBest,
    });
  });

  app.get('/api/leaderboard', (req, res) => {
    const validated = validateLeaderboardQuery(req.query);
    if (!validated.ok) {
      res.status(validated.status).json({ ok: false, error: validated.error });
      return;
    }

    const rows = database.getLeaderboard(validated.value.mode, validated.value.limit);
    res.json({
      ok: true,
      mode: validated.value.mode,
      items: toLeaderboardItems(rows),
    });
  });

  app.get('/api/player-best', (req, res) => {
    const validated = validatePlayerNameQuery(req.query);
    if (!validated.ok) {
      res.status(validated.status).json({ ok: false, error: validated.error });
      return;
    }

    res.json({
      ok: true,
      playerName: validated.value,
      best: database.getPlayerBest(validated.value),
    });
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

  app.locals.database = database;
  return app;
}

export function startServer({
  port = Number(process.env.PORT ?? 3001),
  dbPath = defaultDbPath,
} = {}) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const app = createApp({ db: createDatabase(dbPath) });
  return app.listen(port, () => {
    console.log(`Laser Survival server running on http://localhost:${port}`);
  });
}

if (process.argv[1] === __filename) {
  startServer();
}
