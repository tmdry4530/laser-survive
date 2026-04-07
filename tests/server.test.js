import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/src/app.js';

async function startTestServer() {
  const app = createApp();
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

test('config endpoint exposes public Supabase config only', async () => {
  process.env.SUPABASE_URL = 'https://demo.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  const ctx = await startTestServer();

  try {
    const text = await fetch(`${ctx.baseUrl}/api/config.js`).then((res) => res.text());
    assert.match(text, /window\.__LASER_CONFIG__/);
    assert.match(text, /demo\.supabase\.co/);
    assert.match(text, /anon-key/);
  } finally {
    await ctx.close();
  }
});

test('health endpoint reports whether supabase config is present', async () => {
  process.env.SUPABASE_URL = 'https://demo.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  const configured = await startTestServer();

  try {
    const payload = await fetch(`${configured.baseUrl}/api/health`).then((res) => res.json());
    assert.deepEqual(payload, { ok: true, supabaseConfigured: true });
  } finally {
    await configured.close();
  }

  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_ANON_KEY = '';
  const unconfigured = await startTestServer();
  try {
    const payload = await fetch(`${unconfigured.baseUrl}/api/health`).then((res) => res.json());
    assert.deepEqual(payload, { ok: true, supabaseConfigured: false });
  } finally {
    await unconfigured.close();
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
