import { loadStats, saveGameResult } from './db.js';
import { GameEngine } from './gameEngine.js';

const PLAYER_NAME_KEY = 'laser-player-name';
const DEFAULT_PLAYER_NAME = 'ANON';

const screenTitle = document.getElementById('screen-title');
const screenGame = document.getElementById('screen-game');
const screenGameOver = document.getElementById('screen-gameover');
const screenLeaderboard = document.getElementById('screen-leaderboard');
const rootElement = document.getElementById('root');
const hudOverlay = document.getElementById('hud-overlay');

const titleBestEndless = document.getElementById('title-best-endless');
const titleBestCrazy = document.getElementById('title-best-crazy');
const titleGames = document.getElementById('title-games');
const titleTestMode = document.getElementById('title-testmode');
const playerNameInput = document.getElementById('player-name');

const hudTimeVal = document.getElementById('hud-time-val');
const hudBestVal = document.getElementById('hud-best-val');
const gameModeLabel = document.getElementById('game-mode-label');
const gameRound = document.getElementById('game-round');
const gameLaser = document.getElementById('game-laser');
const gameItem = document.getElementById('game-item');

const goTime = document.getElementById('go-time');
const goNewBest = document.getElementById('go-newbest');
const goOnlineStatus = document.getElementById('go-online-status');
const gameCanvas = document.getElementById('game-canvas');

const startEndlessButton = document.getElementById('btn-start-endless');
const startCrazyButton = document.getElementById('btn-start-crazy');
const openLeaderboardButton = document.getElementById('btn-open-leaderboard');
const retryButton = document.getElementById('btn-retry');
const leaderboardBackButton = document.getElementById('btn-leaderboard-back');
const leaderboardEndlessTab = document.getElementById('leaderboard-tab-endless');
const leaderboardCrazyTab = document.getElementById('leaderboard-tab-crazy');
const leaderboardList = document.getElementById('leaderboard-list');
const leaderboardStatus = document.getElementById('leaderboard-status');
const leaderboardBest = document.getElementById('leaderboard-best');

let engine = null;
let currentScreen = 'TITLE';
let currentMode = 'endless';
let activeLeaderboardMode = 'endless';
let bestScoreEndless = 0;
let bestScoreCrazy = 0;
let testModeEnabled = new URLSearchParams(window.location.search).get('test') === '1';

function getApiCandidates() {
  const fromQuery = new URLSearchParams(window.location.search).get('apiBase');
  const fromStorage = window.localStorage.getItem('laser-api-base');
  const candidates = [];

  if (fromQuery) {
    candidates.push(fromQuery);
  }

  if (fromStorage && !candidates.includes(fromStorage)) {
    candidates.push(fromStorage);
  }

  if (window.location.port === '3001') {
    candidates.push('/api');
  } else {
    candidates.push(`${window.location.protocol}//${window.location.hostname}:3001/api`);
    candidates.push('/api');
  }

  return [...new Set(candidates)];
}

async function apiFetch(path, options = {}) {
  const candidates = getApiCandidates();
  let lastError = null;

  for (const base of candidates) {
    try {
      const response = await fetch(`${base}${path}`, options);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || `Request failed (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Leaderboard API unavailable');
}

function switchScreen(screen) {
  currentScreen = screen;
  screenTitle.style.display = screen === 'TITLE' ? 'flex' : 'none';
  screenGame.style.display = screen === 'GAME' ? 'flex' : 'none';
  screenGameOver.style.display = screen === 'GAMEOVER' ? 'flex' : 'none';
  screenLeaderboard.style.display = screen === 'LEADERBOARD' ? 'flex' : 'none';
  hudOverlay.style.display = screen === 'GAME' ? 'flex' : 'none';
}

function normalizePlayerName(value) {
  const trimmed = `${value ?? ''}`.trim().replace(/\s+/g, ' ');
  return (trimmed || DEFAULT_PLAYER_NAME).slice(0, 12);
}

function getPlayerName() {
  return normalizePlayerName(playerNameInput.value);
}

function savePlayerName() {
  const normalized = getPlayerName();
  playerNameInput.value = normalized;
  window.localStorage.setItem(PLAYER_NAME_KEY, normalized);
}

async function renderStats() {
  const stats = await loadStats();
  bestScoreEndless = stats.highscoreEndless;
  bestScoreCrazy = stats.highscoreCrazy;
  titleBestEndless.textContent = `${stats.highscoreEndless.toFixed(1)}s`;
  titleBestCrazy.textContent = `${stats.highscoreCrazy.toFixed(1)}s`;
  titleGames.textContent = `${stats.games}`;
}

function renderTestModeState() {
  titleTestMode.style.display = testModeEnabled ? 'block' : 'none';
  titleTestMode.textContent = testModeEnabled ? '[ TEST MODE: ON ]' : '';
}

function getHudItemText(itemStatus = '') {
  if (currentMode === 'crazy' && testModeEnabled && itemStatus) {
    return `CRAZY TEST · ${itemStatus}`;
  }

  if (currentMode === 'crazy' && testModeEnabled) {
    return 'CRAZY TEST · INVINCIBLE';
  }

  if (testModeEnabled && itemStatus) {
    return `TEST MODE · ${itemStatus}`;
  }

  if (testModeEnabled) {
    return 'TEST MODE · INVINCIBLE';
  }

  return itemStatus;
}

function getModeBannerText() {
  if (currentMode === 'crazy') {
    return testModeEnabled ? 'CRAZY MODE · TEST' : 'CRAZY MODE · NO MERCY';
  }

  return testModeEnabled ? 'ENDLESS MODE · TEST' : 'ENDLESS MODE';
}

function applyModeTheme() {
  rootElement.dataset.mode = currentMode;
  gameModeLabel.textContent = getModeBannerText();
}

async function submitOnlineScore(time) {
  goOnlineStatus.textContent = 'Submitting score...';

  try {
    const response = await apiFetch('/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: getPlayerName(),
        mode: currentMode,
        survivalTime: time,
        isTestMode: testModeEnabled,
        clientVersion: '1.0.0',
      }),
    });

    goOnlineStatus.textContent = `ONLINE RANK #${response.rank}${response.isPersonalBest ? ' · PB' : ''}`;
  } catch (error) {
    goOnlineStatus.textContent = error.message.toUpperCase();
  }
}

function renderLeaderboardItems(items) {
  if (items.length === 0) {
    leaderboardList.innerHTML = '<li class="leaderboard-empty">NO SCORES YET</li>';
    return;
  }

  leaderboardList.innerHTML = items.map((item) => {
    const date = new Date(item.createdAt).toLocaleDateString('ko-KR');
    return `
      <li class="leaderboard-row">
        <span class="leaderboard-rank">#${item.rank}</span>
        <span class="leaderboard-name">${item.playerName}</span>
        <span class="leaderboard-time">${item.survivalTime.toFixed(1)}s</span>
        <span class="leaderboard-date">${date}</span>
      </li>
    `;
  }).join('');
}

async function renderPlayerBest() {
  try {
    const response = await apiFetch(`/player-best?playerName=${encodeURIComponent(getPlayerName())}`);
    leaderboardBest.textContent = `YOUR BEST · ENDLESS ${response.best.endless.toFixed(1)}s / CRAZY ${response.best.crazy.toFixed(1)}s`;
  } catch {
    leaderboardBest.textContent = 'YOUR BEST · UNAVAILABLE';
  }
}

async function openLeaderboard(mode = activeLeaderboardMode) {
  activeLeaderboardMode = mode;
  switchScreen('LEADERBOARD');
  leaderboardEndlessTab.classList.toggle('active', mode === 'endless');
  leaderboardCrazyTab.classList.toggle('active', mode === 'crazy');
  leaderboardStatus.textContent = 'LOADING...';
  leaderboardList.innerHTML = '';
  await renderPlayerBest();

  try {
    const response = await apiFetch(`/leaderboard?mode=${mode}&limit=20`);
    leaderboardStatus.textContent = `${mode.toUpperCase()} TOP 20`;
    renderLeaderboardItems(response.items);
  } catch (error) {
    leaderboardStatus.textContent = error.message.toUpperCase();
    leaderboardList.innerHTML = '<li class="leaderboard-empty">FAILED TO LOAD</li>';
  }
}

function bindControls() {
  playerNameInput.value = normalizePlayerName(window.localStorage.getItem(PLAYER_NAME_KEY));
  playerNameInput.addEventListener('change', savePlayerName);
  playerNameInput.addEventListener('blur', savePlayerName);

  startEndlessButton.addEventListener('click', () => startGame('endless'));
  startCrazyButton.addEventListener('click', () => startGame('crazy'));
  openLeaderboardButton.addEventListener('click', () => openLeaderboard('endless'));
  retryButton.addEventListener('click', () => startGame(currentMode));
  leaderboardBackButton.addEventListener('click', () => switchScreen('TITLE'));
  leaderboardEndlessTab.addEventListener('click', () => openLeaderboard('endless'));
  leaderboardCrazyTab.addEventListener('click', () => openLeaderboard('crazy'));

  window.addEventListener('keydown', (event) => {
    if (currentScreen === 'GAME') {
      return;
    }

    if (event.code === 'Space' && currentScreen === 'TITLE') {
      event.preventDefault();
      startGame('endless');
    }

    if (event.code === 'KeyC' && currentScreen === 'TITLE') {
      event.preventDefault();
      startGame('crazy');
    }

    if (event.code === 'KeyL' && currentScreen === 'TITLE') {
      event.preventDefault();
      openLeaderboard('endless');
    }

    if (event.code === 'Escape' && currentScreen === 'LEADERBOARD') {
      event.preventDefault();
      switchScreen('TITLE');
    }

    if (event.code === 'KeyT') {
      event.preventDefault();
      testModeEnabled = !testModeEnabled;
      renderTestModeState();
    }

    if (event.code === 'KeyR' && currentScreen === 'GAMEOVER') {
      event.preventDefault();
      startGame(currentMode);
    }
  });
}

function startGame(mode = 'endless') {
  engine?.stop();
  engine = null;
  currentMode = mode;
  switchScreen('GAME');
  applyModeTheme();
  hudBestVal.textContent = (mode === 'crazy' ? bestScoreCrazy : bestScoreEndless).toFixed(1);
  gameItem.textContent = getHudItemText(mode === 'crazy' ? 'CRAZY MODE ONLINE' : 'ENDLESS ITEMS ONLINE');

  engine = new GameEngine({
    canvas: gameCanvas,
    mode,
    testMode: testModeEnabled,
    initialTimeAlive: testModeEnabled ? 90 : 0,
    onGameOver: async (time, won) => {
      const isNewBest = await saveGameResult(time, won, mode);
      await renderStats();

      goTime.textContent = time.toFixed(1);
      goNewBest.style.display = isNewBest ? 'block' : 'none';
      switchScreen('GAMEOVER');
      void submitOnlineScore(time);
    },
    onUpdateHUD: (time, round, laserIn, itemStatus = '', stageLabel = '') => {
      hudTimeVal.textContent = time.toFixed(1);
      gameRound.textContent = stageLabel ? `${stageLabel} · ROUND ${round}` : `ROUND ${round}`;
      gameLaser.textContent = `LASER IN ${laserIn.toFixed(1)}s`;
      gameLaser.classList.toggle('danger', laserIn < 1);
      gameItem.textContent = getHudItemText(itemStatus || (mode === 'crazy' ? 'CRAZY MODE ONLINE' : 'ENDLESS ITEMS ONLINE'));
    },
  });

  goOnlineStatus.textContent = '';
  rootElement.style.setProperty('--canvas-width', `${gameCanvas.width}px`);
  engine.start();
}

async function init() {
  bindControls();
  renderTestModeState();
  applyModeTheme();
  await renderStats();
}

window.addEventListener('load', init);
