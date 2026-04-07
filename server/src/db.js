import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const VALID_MODES = new Set(['endless', 'crazy']);

export function createDatabase(dbPath = ':memory:') {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      mode TEXT NOT NULL,
      survival_time REAL NOT NULL,
      created_at TEXT NOT NULL,
      client_version TEXT,
      is_test_mode INTEGER NOT NULL DEFAULT 0,
      ip_hash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_scores_mode_rank
      ON scores (mode, survival_time DESC, created_at ASC);

    CREATE INDEX IF NOT EXISTS idx_scores_player_best
      ON scores (player_name, mode, survival_time DESC);
  `);

  const insertStmt = db.prepare(`
    INSERT INTO scores (player_name, mode, survival_time, created_at, client_version, is_test_mode, ip_hash)
    VALUES (@playerName, @mode, @survivalTime, @createdAt, @clientVersion, @isTestMode, @ipHash)
  `);

  const bestStmt = db.prepare(`
    SELECT MAX(survival_time) AS best
    FROM scores
    WHERE player_name = ? AND mode = ?
  `);

  const rankStmt = db.prepare(`
    SELECT COUNT(*) + 1 AS rank
    FROM scores
    WHERE mode = ?
      AND (
        survival_time > ?
        OR (survival_time = ? AND created_at < ?)
      )
  `);

  const leaderboardStmt = db.prepare(`
    SELECT player_name, mode, survival_time, created_at
    FROM scores
    WHERE mode = ?
    ORDER BY survival_time DESC, created_at ASC
    LIMIT ?
  `);

  const playerBestStmt = db.prepare(`
    SELECT
      MAX(CASE WHEN mode = 'endless' THEN survival_time END) AS endless,
      MAX(CASE WHEN mode = 'crazy' THEN survival_time END) AS crazy
    FROM scores
    WHERE player_name = ?
  `);

  const duplicateStmt = db.prepare(`
    SELECT id
    FROM scores
    WHERE player_name = ?
      AND mode = ?
      AND survival_time = ?
      AND created_at >= ?
    LIMIT 1
  `);

  return {
    raw: db,
    insertScore(payload) {
      insertStmt.run(payload);
    },
    getBest(playerName, mode) {
      if (!VALID_MODES.has(mode)) return null;
      return bestStmt.get(playerName, mode)?.best ?? null;
    },
    getRank(mode, survivalTime, createdAt) {
      return rankStmt.get(mode, survivalTime, survivalTime, createdAt)?.rank ?? 1;
    },
    getLeaderboard(mode, limit) {
      return leaderboardStmt.all(mode, limit);
    },
    getPlayerBest(playerName) {
      const row = playerBestStmt.get(playerName) ?? {};
      return {
        endless: row.endless ?? 0,
        crazy: row.crazy ?? 0,
      };
    },
    hasRecentDuplicate(playerName, mode, survivalTime, createdAtFloor) {
      return Boolean(duplicateStmt.get(playerName, mode, survivalTime, createdAtFloor));
    },
    close() {
      db.close();
    },
  };
}
