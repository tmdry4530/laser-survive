import test from 'node:test';
import assert from 'node:assert/strict';
import { createIndexedDbMock } from './helpers.js';

async function setupDbModule() {
  global.indexedDB = createIndexedDbMock();
  return import(`../src/db.js?test=${Date.now()}-${Math.random()}`);
}

test('loadStats returns default values for a fresh database', async () => {
  const { loadStats } = await setupDbModule();
  const stats = await loadStats();

  assert.deepEqual(stats, {
    highscore: 0,
    highscoreEndless: 0,
    highscoreCrazy: 0,
    games: 0,
    wins: 0,
    history: [],
  });
});

test('saveGameResult updates 60s stats and trims history', async () => {
  const { loadStats, saveGameResult } = await setupDbModule();

  let best = false;
  for (let index = 0; index < 12; index += 1) {
    best = await saveGameResult(index + 1, index % 2 === 0, '60s');
  }

  const stats = await loadStats();

  assert.equal(best, true);
  assert.equal(stats.highscore, 12);
  assert.equal(stats.highscoreEndless, 0);
  assert.equal(stats.games, 12);
  assert.equal(stats.wins, 6);
  assert.equal(stats.history.length, 10);
  assert.equal(stats.history[0].time, 12);
  assert.equal(stats.history.at(-1).time, 3);
});

test('saveGameResult tracks endless best without incrementing wins', async () => {
  const { loadStats, saveGameResult } = await setupDbModule();

  await saveGameResult(17.4, true, 'endless');
  await saveGameResult(14.2, false, 'endless');
  const stats = await loadStats();

  assert.equal(stats.highscore, 0);
  assert.equal(stats.highscoreEndless, 17.4);
  assert.equal(stats.highscoreCrazy, 0);
  assert.equal(stats.games, 2);
  assert.equal(stats.wins, 0);
});

test('saveGameResult tracks crazy best separately', async () => {
  const { loadStats, saveGameResult } = await setupDbModule();

  await saveGameResult(41.2, false, 'crazy');
  await saveGameResult(38.7, false, 'endless');
  const stats = await loadStats();

  assert.equal(stats.highscoreCrazy, 41.2);
  assert.equal(stats.highscoreEndless, 38.7);
  assert.equal(stats.games, 2);
});
