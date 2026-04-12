import test from 'node:test';
import assert from 'node:assert/strict';

function installBrowserGlobals(config = { supabaseUrl: 'https://demo.supabase.co', supabaseAnonKey: 'anon-key' }) {
  const storage = new Map();
  global.window = {
    __LASER_CONFIG__: config,
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
    crypto: {
      randomUUID() {
        return 'device-uuid';
      },
    },
  };
}

test('reward eligibility thresholds differ by mode', async () => {
  installBrowserGlobals();
  const { getRewardThreshold, isRewardEligible } = await import(`../src/rewardApi.js?test=${Date.now()}-${Math.random()}`);

  assert.equal(getRewardThreshold('endless'), 120);
  assert.equal(getRewardThreshold('crazy'), 90);
  assert.equal(isRewardEligible('endless', 119.9), false);
  assert.equal(isRewardEligible('crazy', 90), true);
});

test('claimReward posts to claim-reward edge function with a stable device id', async () => {
  installBrowserGlobals();
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return { status: 'claimed', reward_name: 'Reward' };
      },
    };
  };

  const { claimReward } = await import(`../src/rewardApi.js?test=${Date.now()}-${Math.random()}`);
  const result = await claimReward({ mode: 'crazy', playerName: 'AAA', survivalTime: 99 });

  assert.equal(calls[0].url, 'https://demo.supabase.co/functions/v1/claim-reward');
  assert.match(calls[0].options.body, /device-uuid/);
  assert.equal(result.status, 'claimed');
});

test('fetchRewardAsset uses the reward-asset edge function', async () => {
  installBrowserGlobals();
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { name: 'Reward', description: 'Desc', signedUrl: 'https://signed.example/reward.png' };
    },
  });

  const { fetchRewardAsset } = await import(`../src/rewardApi.js?test=${Date.now()}-${Math.random()}`);
  const payload = await fetchRewardAsset({ mode: 'endless' });

  assert.equal(payload.name, 'Reward');
  assert.match(payload.signedUrl, /signed\.example/);
});
