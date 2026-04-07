import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/src/app.js';
import { createDatabase } from '../server/src/db.js';

async function startTestServer() {
  const db = createDatabase(':memory:');
  const app = createApp({ db });
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  return {
    db,
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}

test('score submission stores rankable endless/crazy results', async () => {
  const ctx = await startTestServer();

  try {
    const first = await fetch(`${ctx.baseUrl}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'CHAM', mode: 'endless', survivalTime: 88.4, isTestMode: false }),
    }).then((res) => res.json());

    const second = await fetch(`${ctx.baseUrl}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'CHAM', mode: 'crazy', survivalTime: 33.1, isTestMode: false }),
    }).then((res) => res.json());

    assert.equal(first.ok, true);
    assert.equal(first.rank, 1);
    assert.equal(second.ok, true);
    assert.equal(second.rank, 1);
  } finally {
    await ctx.close();
  }
});

test('backend rejects invalid and test-mode submissions', async () => {
  const ctx = await startTestServer();

  try {
    const invalidMode = await fetch(`${ctx.baseUrl}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'AAA', mode: 'weird', survivalTime: 10 }),
    });

    const testMode = await fetch(`${ctx.baseUrl}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'AAA', mode: 'endless', survivalTime: 10, isTestMode: true }),
    });

    assert.equal(invalidMode.status, 400);
    assert.equal(testMode.status, 403);
  } finally {
    await ctx.close();
  }
});

test('leaderboard is sorted by mode and player-best endpoint groups results', async () => {
  const ctx = await startTestServer();

  try {
    for (const payload of [
      { playerName: 'AAA', mode: 'endless', survivalTime: 70.5 },
      { playerName: 'BBB', mode: 'endless', survivalTime: 91.2 },
      { playerName: 'AAA', mode: 'crazy', survivalTime: 44.8 },
    ]) {
      await fetch(`${ctx.baseUrl}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, isTestMode: false }),
      });
    }

    const leaderboard = await fetch(`${ctx.baseUrl}/api/leaderboard?mode=endless&limit=20`).then((res) => res.json());
    const best = await fetch(`${ctx.baseUrl}/api/player-best?playerName=AAA`).then((res) => res.json());

    assert.equal(leaderboard.items[0].playerName, 'BBB');
    assert.equal(leaderboard.items[1].playerName, 'AAA');
    assert.equal(best.best.endless, 70.5);
    assert.equal(best.best.crazy, 44.8);
  } finally {
    await ctx.close();
  }
});

test('server does not expose repo internals or database files as static assets', async () => {
  const ctx = await startTestServer();

  try {
    const sourceLeak = await fetch(`${ctx.baseUrl}/server/src/app.js`);
    const dbLeak = await fetch(`${ctx.baseUrl}/server/data/laser-survival.db`);

    assert.equal(sourceLeak.status, 404);
    assert.equal(dbLeak.status, 404);
  } finally {
    await ctx.close();
  }
});
