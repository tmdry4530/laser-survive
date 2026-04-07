import test from 'node:test';
import assert from 'node:assert/strict';

function installBrowserGlobals(config = { supabaseUrl: 'https://demo.supabase.co', supabaseAnonKey: 'anon-key' }) {
  global.window = { __LASER_CONFIG__: config };
}

test('submitScore calls Supabase rpc and normalizes rank response', async () => {
  installBrowserGlobals();
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return [{ rank: 3, is_personal_best: true }];
      },
    };
  };

  const { submitScore } = await import(`../src/leaderboardApi.js?test=${Date.now()}-${Math.random()}`);
  const result = await submitScore({
    playerName: 'AAA',
    mode: 'crazy',
    survivalTime: 44.2,
    isTestMode: false,
    clientVersion: '1.0.0',
  });

  assert.equal(calls[0].url, 'https://demo.supabase.co/rest/v1/rpc/submit_score');
  assert.equal(result.rank, 3);
  assert.equal(result.isPersonalBest, true);
});

test('fetchLeaderboard maps supabase rows into leaderboard items', async () => {
  installBrowserGlobals();
  global.fetch = async () => ({
    ok: true,
    async json() {
      return [
        { player_name: 'BBB', mode: 'endless', survival_time: 99.1, created_at: '2026-04-07T00:00:00Z' },
      ];
    },
  });

  const { fetchLeaderboard } = await import(`../src/leaderboardApi.js?test=${Date.now()}-${Math.random()}`);
  const items = await fetchLeaderboard('endless', 20);

  assert.deepEqual(items, [
    {
      rank: 1,
      playerName: 'BBB',
      mode: 'endless',
      survivalTime: 99.1,
      createdAt: '2026-04-07T00:00:00Z',
    },
  ]);
});

test('fetchPlayerBest returns grouped best values from rpc', async () => {
  installBrowserGlobals();
  global.fetch = async () => ({
    ok: true,
    async json() {
      return [{ endless: 120.4, crazy: 66.6 }];
    },
  });

  const { fetchPlayerBest } = await import(`../src/leaderboardApi.js?test=${Date.now()}-${Math.random()}`);
  const best = await fetchPlayerBest('AAA');

  assert.deepEqual(best, { endless: 120.4, crazy: 66.6 });
});

test('leaderboard API throws a helpful error when config is missing', async () => {
  installBrowserGlobals({ supabaseUrl: '', supabaseAnonKey: '' });
  const { fetchLeaderboard } = await import(`../src/leaderboardApi.js?test=${Date.now()}-${Math.random()}`);

  await assert.rejects(() => fetchLeaderboard('endless', 20), /Leaderboard not configured/);
});
