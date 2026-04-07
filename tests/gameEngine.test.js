import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasContext } from './helpers.js';

function installBrowserMocks() {
  let now = 0;
  const listeners = new Map();

  global.performance = {
    now: () => now,
  };

  global.requestAnimationFrame = () => 1;
  global.cancelAnimationFrame = () => {};
  global.window = {
    innerWidth: 390,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };

  return {
    advance(time) {
      now = time;
    },
    listeners,
  };
}

test('GameEngine triggers victory at 60 seconds in 60s mode', async () => {
  const browser = installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);

  let result = null;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: '60s',
    onGameOver: (time, won) => {
      result = { time, won };
    },
    onUpdateHUD: () => {},
  });

  engine.running = true;
  engine.timeAlive = 60;
  browser.advance(1000);
  engine.update(0.016);

  assert.deepEqual(result, { time: 60, won: true });
  assert.equal(canvas.width, 520);
  assert.equal(canvas.height, 520);
  assert.equal(engine.running, false);
  assert.equal(browser.listeners.has('keydown'), false);
  assert.equal(browser.listeners.has('keyup'), false);
});

test('expand item restores multiple removed lines in endless mode', async () => {
  installBrowserMocks();
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => createCanvasContext(),
    };

    const engine = new GameEngine({
      canvas,
      mode: 'endless',
      onGameOver: () => {},
      onUpdateHUD: () => {},
    });

    engine.activeRows = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    engine.applyItem('EXPAND');

    assert.deepEqual(engine.activeRows, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  } finally {
    Math.random = originalRandom;
  }
});

test('endless mode starts on a larger board than 60s mode', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const endless = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  const timed = new GameEngine({
    canvas,
    mode: '60s',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  assert.equal(endless.gridSize, 14);
  assert.equal(timed.gridSize, 10);
  assert.equal(endless.activeRows.length, 14);
  assert.equal(endless.CANVAS_SIZE, 520);
});

test('crazy mode starts with an endless-sized board and late-stage difficulty', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const crazy = new GameEngine({
    canvas,
    mode: 'crazy',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  assert.equal(crazy.gridSize, 14);
  assert.equal(crazy.getDifficultyTime(), 180);
  assert.equal(crazy.getStageLabel(), 'STAGE 7');
});

test('slow item extends laser timer and enables cooldown effect', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.laserTimer = 0.4;
  engine.applyItem('SLOW');

  assert.equal(engine.slowEffectTimer, 8);
  assert.equal(engine.laserTimer, 1.6);

  engine.timeAlive = 4;
  engine.handleLasers(1);
  assert.ok(engine.laserTimer > 1);
});

test('spawnItem can favor grid expansion when restoration is available', async () => {
  installBrowserMocks();
  const originalRandom = Math.random;
  const sequence = [0, 0];
  Math.random = () => sequence.shift() ?? 0;

  try {
    const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => createCanvasContext(),
    };

    const engine = new GameEngine({
      canvas,
      mode: 'endless',
      onGameOver: () => {},
      onUpdateHUD: () => {},
    });

    engine.activeRows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    engine.spawnItem();

    assert.equal(engine.item.type, 'EXPAND');
  } finally {
    Math.random = originalRandom;
  }
});

test('late-game interval settings are softer than the original hard wall', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const endless = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });
  endless.timeAlive = 50;

  const timed = new GameEngine({
    canvas,
    mode: '60s',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });
  timed.timeAlive = 45;

  assert.equal(endless.getMinLaserInterval(), 0.82);
  assert.equal(endless.getLaserScalingFactor(), 0.965);
  assert.equal(timed.getMinLaserInterval(), 0.72);
  assert.equal(timed.getLaserScalingFactor(), 0.965);
});

test('recent movement filters out adjacent laser targets when alternatives exist', async () => {
  const browser = installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: '60s',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.player.x = 4;
  engine.player.lastMoveTime = 1000;
  browser.advance(1200);

  const filtered = engine.getMovementSafeTargets([
    { v: true, idx: 3 },
    { v: true, idx: 4 },
    { v: true, idx: 5 },
    { v: true, idx: 7 },
  ]);

  assert.deepEqual(filtered, [{ v: true, idx: 7 }]);
});

test('tracked targeting prefers the player current line', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.player.x = 6;
  engine.player.y = 4;

  const target = engine.chooseTrackedTarget([
    { v: true, idx: 2 },
    { v: false, idx: 1 },
    { v: true, idx: 6 },
    { v: false, idx: 4 },
  ], 0);

  assert.deepEqual(target, { v: true, idx: 6 });
});

test('spawn logic allows targeting the player current line', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.player.x = 6;
  engine.player.y = 4;

  assert.equal(engine.canSpawnLaser(true, 6), true);
  assert.equal(engine.canSpawnLaser(false, 4), true);
});

test('tracked targeting alternates preferred axis on ties across a wave', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.player.x = 5;
  engine.player.y = 5;
  const targets = [
    { v: true, idx: 5 },
    { v: false, idx: 5 },
  ];

  assert.deepEqual(engine.chooseTrackedTarget(targets, 0), { v: true, idx: 5 });
  assert.deepEqual(engine.chooseTrackedTarget(targets, 1), { v: false, idx: 5 });
});

test('predictive targeting leads the player when a 3+ laser wave is active', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.player.x = 5;
  engine.player.y = 5;
  engine.keys.add('ArrowRight');

  const target = engine.chooseTrackedTarget([
    { v: true, idx: 5 },
    { v: true, idx: 6 },
    { v: true, idx: 7 },
  ], 2, 4);

  assert.deepEqual(target, { v: true, idx: 7 });
});

test('endless mode stops shrinking once it reaches the grid floor', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.activeRows = engine.GRID_INDICES.slice(0, 8);
  engine.activeCols = engine.GRID_INDICES.slice(0, 10);

  assert.equal(engine.canDeleteTarget(false), false);
  assert.equal(engine.canDeleteTarget(true), true);
  assert.equal(engine.canSpawnLaser(false, 4), false);

  engine.activeCols = engine.GRID_INDICES.slice(0, 8);
  assert.equal(engine.canDeleteTarget(true), false);
});

test('narrow endless boards still allow deletion on axes above the floor', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.activeRows = engine.GRID_INDICES.slice(0, 9);
  engine.activeCols = engine.GRID_INDICES.slice(0, 8);

  assert.equal(engine.canDeleteTarget(false), true);
  assert.equal(engine.canDeleteTarget(true), false);
});

test('laser count scales up over time for both modes', async () => {
  installBrowserMocks();
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => createCanvasContext(),
    };

    const endless = new GameEngine({
      canvas,
      mode: 'endless',
      onGameOver: () => {},
      onUpdateHUD: () => {},
    });
    endless.timeAlive = 200;

    const timed = new GameEngine({
      canvas,
      mode: '60s',
      onGameOver: () => {},
      onUpdateHUD: () => {},
    });
    timed.timeAlive = 55;

    assert.equal(endless.getLaserCount(), 5);
    assert.equal(timed.getLaserCount(), 2);
  } finally {
    Math.random = originalRandom;
  }
});

test('laser count ramps up gradually over time', async () => {
  installBrowserMocks();
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => createCanvasContext(),
    };

    const endless = new GameEngine({
      canvas,
      mode: 'endless',
      onGameOver: () => {},
      onUpdateHUD: () => {},
    });

    endless.timeAlive = 10;
    assert.equal(endless.getLaserCount(), 1);

    endless.timeAlive = 70;
    assert.equal(endless.getLaserCount(), 3);

    endless.timeAlive = 220;
    assert.equal(endless.getLaserCount(), 5);
  } finally {
    Math.random = originalRandom;
  }
});

test('large grids from stage 3 force denser laser waves', async () => {
  installBrowserMocks();
  const originalRandom = Math.random;
  Math.random = () => 0.99;

  try {
    const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => createCanvasContext(),
    };

    const engine = new GameEngine({
      canvas,
      mode: 'endless',
      onGameOver: () => {},
      onUpdateHUD: () => {},
    });

    engine.timeAlive = 65;
    engine.activeRows = engine.GRID_INDICES.slice(0, 14);
    engine.activeCols = engine.GRID_INDICES.slice(0, 14);
    assert.equal(engine.getLaserCount(), 3);

    engine.timeAlive = 150;
    assert.equal(engine.getLaserCount(), 5);
  } finally {
    Math.random = originalRandom;
  }
});

test('stage 6 large endless grids can escalate to five lasers', async () => {
  installBrowserMocks();
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => createCanvasContext(),
    };

    const engine = new GameEngine({
      canvas,
      mode: 'endless',
      onGameOver: () => {},
      onUpdateHUD: () => {},
    });

    engine.timeAlive = 170;
    engine.activeRows = engine.GRID_INDICES.slice(0, 14);
    engine.activeCols = engine.GRID_INDICES.slice(0, 14);

    assert.equal(engine.getLaserCount(), 5);
  } finally {
    Math.random = originalRandom;
  }
});

test('multi-laser waves use queued stagger delays before warning', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.timeAlive = 120;

  const first = engine.getLaserQueueDelay(0, 3);
  const second = engine.getLaserQueueDelay(1, 3);
  const third = engine.getLaserQueueDelay(2, 3);

  assert.equal(first, 0);
  assert.ok(second > first);
  assert.ok(third > second);
});

test('stage 5 and beyond tightens sequential laser stagger in endless mode', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.timeAlive = 110; // stage 4
  const stage4Stagger = engine.getLaserStagger(3);

  engine.timeAlive = 150; // stage 6
  const stage6Stagger = engine.getLaserStagger(3);

  engine.timeAlive = 210; // stage 8
  const stage8Stagger = engine.getLaserStagger(3);

  assert.ok(stage6Stagger < stage4Stagger);
  assert.ok(stage8Stagger <= stage6Stagger);
});

test('queued lasers enter warning state sequentially before firing', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.lasers = [
    { isVertical: true, index: 1, state: 'WARNING', stateTimer: engine.LASER_WARNING_LEAD },
    { isVertical: false, index: 2, state: 'QUEUED', stateTimer: 0.2 },
  ];

  engine.handleLasers(0.1);
  assert.equal(engine.lasers[0].state, 'WARNING');
  assert.equal(engine.lasers[1].state, 'QUEUED');

  engine.handleLasers(0.11);
  assert.equal(engine.lasers[1].state, 'WARNING');
  assert.equal(engine.lasers[1].stateTimer, engine.LASER_WARNING_LEAD);
});

test('stage labels advance every 30 seconds', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.timeAlive = 0;
  assert.equal(engine.getStageLabel(), 'STAGE 1');

  engine.timeAlive = 30;
  assert.equal(engine.getStageLabel(), 'STAGE 2');

  engine.timeAlive = 150;
  assert.equal(engine.getStageLabel(), 'STAGE 6');

  engine.timeAlive = 180;
  assert.equal(engine.getStageLabel(), 'STAGE 7');
});

test('initial time can start endless test sessions at stage 4', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    initialTimeAlive: 90,
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  assert.equal(engine.timeAlive, 90);
  assert.equal(engine.getStageLabel(), 'STAGE 4');
  assert.ok(engine.itemSpawnTimer < 7);
});

test('items spawn more frequently and favor expand items at higher stages', async () => {
  installBrowserMocks();
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => createCanvasContext(),
    };

    const engine = new GameEngine({
      canvas,
      mode: 'endless',
      onGameOver: () => {},
      onUpdateHUD: () => {},
    });

    engine.timeAlive = 0;
    const earlyDelay = engine.getNextItemSpawnDelay();
    const earlyWeight = engine.getExpandItemWeight();

    engine.timeAlive = 160;
    const lateDelay = engine.getNextItemSpawnDelay();
    const lateWeight = engine.getExpandItemWeight();

    engine.activeRows = engine.GRID_INDICES.slice(0, 9);
    engine.activeCols = engine.GRID_INDICES.slice(0, 10);

    assert.ok(lateDelay < earlyDelay);
    assert.ok(lateWeight > earlyWeight);
    assert.equal(engine.getExpandItemWeight(), 0.96);
  } finally {
    Math.random = originalRandom;
  }
});

test('sweep lasers become available after 120 seconds and use a separate lane', async () => {
  installBrowserMocks();
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => createCanvasContext(),
    };

    const engine = new GameEngine({
      canvas,
      mode: 'endless',
      onGameOver: () => {},
      onUpdateHUD: () => {},
    });

    engine.timeAlive = 130;
    engine.sweepTimer = 0;
    engine.updateSweepLasers(0.1);

    assert.equal(engine.lasers.length, 1);
    assert.equal(engine.lasers[0].kind, 'SWEEP');
    assert.equal(engine.lasers[0].state, 'WARNING');
  } finally {
    Math.random = originalRandom;
  }
});

test('endless restores a line and reschedules quickly if no laser targets are available', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.timeAlive = 90;
  engine.activeRows = engine.GRID_INDICES.slice(0, 8);
  engine.activeCols = engine.GRID_INDICES.slice(0, 8);
  engine.laserTimer = 0;
  engine.lasers = [];
  engine.itemSpawnTimer = 9;

  engine.handleLasers(0.1);

  assert.ok(engine.activeRows.length === 9 || engine.activeCols.length === 9);
  assert.equal(engine.itemSpawnTimer, 1);
  assert.ok(engine.laserTimer <= 0.8);
});

test('sweep lasers hit but do not delete grid lines', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  let gameOverCalls = 0;
  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    testMode: true,
    onGameOver: () => {
      gameOverCalls += 1;
    },
    onUpdateHUD: () => {},
  });

  engine.activeCols = engine.GRID_INDICES.slice(0, 10);
  engine.player.x = 4;
  engine.lasers = [
    { kind: 'SWEEP', isVertical: true, index: 4, state: 'WARNING', stateTimer: 0 },
  ];

  engine.handleLasers(0.1);

  assert.equal(engine.activeCols.length, 10);
  assert.equal(gameOverCalls, 0);
});

test('sweep lasers stay active for one second and then disappear without remnant', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    testMode: true,
    onGameOver: () => {},
    onUpdateHUD: () => {},
  });

  engine.lasers = [
    { kind: 'SWEEP', isVertical: true, index: 4, state: 'WARNING', stateTimer: 0 },
  ];

  engine.handleLasers(0.1);
  assert.equal(engine.lasers[0].state, 'FIRING');
  assert.equal(engine.lasers[0].stateTimer, 1);

  engine.handleLasers(0.6);
  assert.equal(engine.lasers[0].state, 'FIRING');

  engine.handleLasers(0.5);
  assert.equal(engine.lasers.length, 0);
});

test('item relocates if its row or column gets deleted', async () => {
  installBrowserMocks();
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => createCanvasContext(),
    };

    const engine = new GameEngine({
      canvas,
      mode: 'endless',
      onGameOver: () => {},
      onUpdateHUD: () => {},
    });

    engine.player.x = 13;
    engine.player.y = 13;
    engine.item = { row: 2, col: 5, type: 'EXPAND', life: 5, pulse: 0 };
    engine.activeRows = engine.activeRows.filter((row) => row !== 2);

    engine.validateItemPlacement();

    assert.equal(engine.item.row, 0);
    assert.equal(engine.item.col, 0);
    assert.equal(engine.isItemOnActiveCell(), true);
  } finally {
    Math.random = originalRandom;
  }
});

test('item validation during update keeps items collectible after grid changes', async () => {
  installBrowserMocks();
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => createCanvasContext(),
    };

    const engine = new GameEngine({
      canvas,
      mode: 'endless',
      onGameOver: () => {},
      onUpdateHUD: () => {},
    });

    engine.player.x = 13;
    engine.player.y = 13;
    engine.item = { row: 1, col: 1, type: 'SLOW', life: 5, pulse: 0 };
    engine.activeCols = engine.activeCols.filter((col) => col !== 1);

    engine.updateItems(0.1);

    assert.equal(engine.item.col, 0);
    assert.equal(engine.isItemOnActiveCell(), true);
  } finally {
    Math.random = originalRandom;
  }
});

test('test mode prevents death and repositions the player after a hit', async () => {
  installBrowserMocks();
  const { GameEngine } = await import(`../src/gameEngine.js?test=${Date.now()}-${Math.random()}`);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createCanvasContext(),
  };

  let gameOverCalls = 0;
  const engine = new GameEngine({
    canvas,
    mode: 'endless',
    testMode: true,
    onGameOver: () => {
      gameOverCalls += 1;
    },
    onUpdateHUD: () => {},
  });

  engine.activeRows = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  engine.activeCols = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  engine.player.x = 4;
  engine.player.y = 4;
  engine.lasers = [
    { isVertical: true, index: 4, state: 'WARNING', stateTimer: 0 },
  ];

  engine.handleLasers(0.1);

  assert.equal(gameOverCalls, 0);
  assert.equal(engine.activeCols.includes(4), false);
  assert.notEqual(engine.player.x, 4);
  assert.equal(engine.running, false);
});
