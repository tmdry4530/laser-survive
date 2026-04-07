const DB_NAME = 'LaserSurvivalDB';
const DB_VERSION = 3;
const STORE_NAME = 'records';
const DEFAULT_STATS = Object.freeze({
  highscore: 0,
  highscoreEndless: 0,
  highscoreCrazy: 0,
  games: 0,
  wins: 0,
  history: [],
});

function cloneDefaultStats() {
  return {
    highscore: DEFAULT_STATS.highscore,
    highscoreEndless: DEFAULT_STATS.highscoreEndless,
    highscoreCrazy: DEFAULT_STATS.highscoreCrazy,
    games: DEFAULT_STATS.games,
    wins: DEFAULT_STATS.wins,
    history: [],
  };
}

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

function readValue(store, id, defaultValue) {
  return new Promise((resolve) => {
    const request = store.get(id);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.value);
        return;
      }

      resolve(defaultValue);
    };

    request.onerror = () => resolve(defaultValue);
  });
}

function writeValue(store, id, value) {
  return new Promise((resolve, reject) => {
    const request = store.put({ id, value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to persist ${id}`));
  });
}

function waitForTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function readStatsFromStore(store) {
  const [highscore, highscoreEndless, highscoreCrazy, games, wins, history] = await Promise.all([
    readValue(store, 'highscore', 0),
    readValue(store, 'highscoreEndless', 0),
    readValue(store, 'highscoreCrazy', 0),
    readValue(store, 'games', 0),
    readValue(store, 'wins', 0),
    readValue(store, 'history', []),
  ]);

  return {
    highscore,
    highscoreEndless,
    highscoreCrazy,
    games,
    wins,
    history: Array.isArray(history) ? history : [],
  };
}

export async function loadStats() {
  let db;

  try {
    db = await initDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const stats = await readStatsFromStore(store);
    await waitForTransaction(transaction);
    return stats;
  } catch (error) {
    console.error(error);
    return cloneDefaultStats();
  } finally {
    db?.close();
  }
}

export async function saveGameResult(time, won, mode) {
  let db;

  try {
    db = await initDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const stats = await readStatsFromStore(store);

    const nextStats = {
      highscore: stats.highscore,
      highscoreEndless: stats.highscoreEndless,
      highscoreCrazy: stats.highscoreCrazy,
      games: stats.games + 1,
      wins: stats.wins + (won && mode === '60s' ? 1 : 0),
      history: [{ time, date: new Date().toISOString(), won, mode }, ...stats.history].slice(0, 10),
    };

    let isNewBest = false;

    if (mode === '60s' && time > nextStats.highscore) {
      nextStats.highscore = time;
      isNewBest = true;
    }

    if (mode === 'endless' && time > nextStats.highscoreEndless) {
      nextStats.highscoreEndless = time;
      isNewBest = true;
    }

    if (mode === 'crazy' && time > nextStats.highscoreCrazy) {
      nextStats.highscoreCrazy = time;
      isNewBest = true;
    }

    await Promise.all([
      writeValue(store, 'highscore', nextStats.highscore),
      writeValue(store, 'highscoreEndless', nextStats.highscoreEndless),
      writeValue(store, 'highscoreCrazy', nextStats.highscoreCrazy),
      writeValue(store, 'games', nextStats.games),
      writeValue(store, 'wins', nextStats.wins),
      writeValue(store, 'history', nextStats.history),
    ]);

    await waitForTransaction(transaction);
    return isNewBest;
  } catch (error) {
    console.error(error);
    return false;
  } finally {
    db?.close();
  }
}
