export class GameEngine {
  constructor(config) {
    this.CANVAS_SIZE = 520;
    this.CANVAS_CENTER = this.CANVAS_SIZE / 2;
    this.gridSize = config.mode === '60s' ? 10 : 14;
    this.GRID_GAP = this.gridSize > 10 ? 2 : 4;
    this.CELL_SIZE = this.gridSize > 10 ? 34 : 47;
    this.GRID_INDICES = Array.from({ length: this.gridSize }, (_, index) => index);
    this.ITEM_DESPAWN_TIME = 9;
    this.ITEM_SLOW_DURATION = 8;
    this.ITEM_SLOW_MULTIPLIER = 0.55;
    this.ITEM_EXPAND_WEIGHT = 0.72;
    this.MOVE_GRACE_WINDOW = 450;
    this.ENDLESS_GRID_FLOOR = 8;
    this.LASER_WARNING_LEAD = 0.45;
    this.SWEEP_START_TIME = 120;
    this.ctx = config.canvas.getContext('2d');
    this.reqId = 0;
    this.lastTime = 0;
    this.timeAlive = config.initialTimeAlive ?? 0;
    this.running = false;
    const centerIndex = Math.floor(this.gridSize / 2);
    this.player = { x: centerIndex, y: centerIndex, lastMoveTime: 0 };
    this.activeRows = [...this.GRID_INDICES];
    this.activeCols = [...this.GRID_INDICES];
    this.visualX = this.createAxisPositions();
    this.visualY = this.createAxisPositions();
    this.lasers = [];
    this.laserInterval = 2.8;
    this.laserTimer = 2.8;
    this.sweepTimer = Number.POSITIVE_INFINITY;
    this.round = 1;
    this.item = null;
    this.slowEffectTimer = 0;
    this.particles = [];
    this.screenShake = 0;
    this.keys = new Set();
    this.nextMove = null;
    this.testMode = Boolean(config.testMode);
    this.config = config;
    this.itemSpawnTimer = config.mode === '60s' ? Number.POSITIVE_INFINITY : this.getNextItemSpawnDelay();

    config.canvas.width = this.CANVAS_SIZE;
    config.canvas.height = this.CANVAS_SIZE;

    this.handleKeyDown = (event) => {
      this.keys.add(event.key);
    };

    this.handleKeyUp = (event) => {
      this.keys.delete(event.key);
    };

    this.loop = (time) => {
      if (!this.running) {
        return;
      }

      const dt = (time - this.lastTime) / 1000;
      this.lastTime = time;

      if (dt > 0.1) {
        this.reqId = requestAnimationFrame(this.loop);
        return;
      }

      this.update(dt);
      this.draw();

      if (this.running) {
        this.reqId = requestAnimationFrame(this.loop);
      }
    };

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.reqId = requestAnimationFrame(this.loop);
  }

  createAxisPositions() {
    const stride = this.CELL_SIZE + this.GRID_GAP;
    const totalSize = this.gridSize * this.CELL_SIZE + (this.gridSize - 1) * this.GRID_GAP;
    const start = (this.CANVAS_SIZE - totalSize) / 2;
    return Array.from({ length: this.gridSize }, (_, index) => start + index * stride);
  }

  isEndlessLikeMode() {
    return this.config.mode === 'endless' || this.config.mode === 'crazy';
  }

  getDifficultyTime() {
    if (this.config.mode === 'crazy') {
      return this.timeAlive + 180;
    }

    return this.timeAlive;
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.reqId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  spawnParticles(x, y, type) {
    const isMobile = window.innerWidth <= 768;
    const count =
      type === 'DEBRIS'
        ? isMobile
          ? 5
          : 10
        : type === 'EXPLOSION'
          ? 20
          : type === 'VICTORY'
            ? 30
            : 1;

    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = type === 'VICTORY' ? Math.random() * 2 + 1 : Math.random() * 3 + 1;
      this.particles.push({
        x,
        y,
        vx: type === 'VICTORY' ? (Math.random() - 0.5) * 5 : Math.cos(angle) * speed,
        vy: type === 'VICTORY' ? -speed * 2 : Math.sin(angle) * speed,
        life: type === 'VICTORY' ? 2 : type === 'EXPLOSION' ? 1 : 0.8,
        maxLife: type === 'VICTORY' ? 2 : type === 'EXPLOSION' ? 1 : 0.8,
        color:
          type === 'DEBRIS'
            ? '#1a1a2e'
            : type === 'EXPLOSION'
              ? '#00f0ff'
              : type === 'VICTORY'
                ? '#ffd700'
                : '#00f0ff',
        type,
      });
    }
  }

  update(dt) {
    if (this.config.mode === '60s' && this.timeAlive >= 60) {
      this.config.onGameOver(60, true);
      this.spawnParticles(this.CANVAS_CENTER, this.CANVAS_SIZE, 'VICTORY');
      this.stop();
      return;
    }

    this.timeAlive += dt;

    if (this.screenShake > 0) {
      this.screenShake -= dt * 10;
    }

    if (this.slowEffectTimer > 0) {
      this.slowEffectTimer = Math.max(0, this.slowEffectTimer - dt);
    }

    this.updateGridPositions(dt);
    this.handleMovement();
    this.updateItems(dt);
    this.updateSweepLasers(dt);
    this.handleLasers(dt);
    this.updateParticles(dt);
    this.config.onUpdateHUD(
      this.timeAlive,
      this.round,
      Math.max(0, this.laserTimer),
      this.getItemStatus(),
      this.getStageLabel(),
    );
  }

  updateGridPositions(dt) {
    const rowCount = this.activeRows.length;
    const colCount = this.activeCols.length;
    const stride = this.CELL_SIZE + this.GRID_GAP;
    const startX = this.CANVAS_CENTER - (colCount * stride - this.GRID_GAP) / 2;
    const startY = this.CANVAS_CENTER - (rowCount * stride - this.GRID_GAP) / 2;

    for (let index = 0; index < colCount; index += 1) {
      const originalColumn = this.activeCols[index];
      const target = startX + index * stride;
      this.visualX[originalColumn] += (target - this.visualX[originalColumn]) * 12 * dt;
    }

    for (let index = 0; index < rowCount; index += 1) {
      const originalRow = this.activeRows[index];
      const target = startY + index * stride;
      this.visualY[originalRow] += (target - this.visualY[originalRow]) * 12 * dt;
    }
  }

  handleMovement() {
    const now = performance.now();
    if (now - this.player.lastMoveTime < 150) {
      return;
    }

    let dx = 0;
    let dy = 0;

    if (this.nextMove) {
      dx = this.nextMove.dx;
      dy = this.nextMove.dy;
      this.nextMove = null;
    } else if (this.keys.has('ArrowUp') || this.keys.has('w')) {
      dy = -1;
    } else if (this.keys.has('ArrowDown') || this.keys.has('s')) {
      dy = 1;
    } else if (this.keys.has('ArrowLeft') || this.keys.has('a')) {
      dx = -1;
    } else if (this.keys.has('ArrowRight') || this.keys.has('d')) {
      dx = 1;
    }

    if (dx === 0 && dy === 0) {
      return;
    }

    let columnIndex = this.activeCols.indexOf(this.player.x);
    let rowIndex = this.activeRows.indexOf(this.player.y);
    columnIndex += dx;
    rowIndex += dy;

    if (
      columnIndex >= 0
      && columnIndex < this.activeCols.length
      && rowIndex >= 0
      && rowIndex < this.activeRows.length
    ) {
      const screenX = this.visualX[this.player.x] + this.CELL_SIZE / 2;
      const screenY = this.visualY[this.player.y] + this.CELL_SIZE / 2;
      this.spawnParticles(screenX, screenY, 'TRAIL');
      this.player.x = this.activeCols[columnIndex];
      this.player.y = this.activeRows[rowIndex];
      this.player.lastMoveTime = now;
      this.tryCollectItem();
    }
  }

  getMissingRows() {
    return this.GRID_INDICES.filter((row) => !this.activeRows.includes(row));
  }

  getMissingCols() {
    return this.GRID_INDICES.filter((col) => !this.activeCols.includes(col));
  }

  getNextItemSpawnDelay() {
    if (!this.isEndlessLikeMode()) {
      return 10 + Math.random() * 6;
    }

    const stage = this.getStageNumber();
    if (stage >= 7) {
      return 2.8 + Math.random() * 1.8;
    }

    if (stage === 6) {
      return 3.1 + Math.random() * 2;
    }

    if (stage === 5) {
      return 3.6 + Math.random() * 2.2;
    }

    if (stage === 4) {
      return 4.2 + Math.random() * 2.4;
    }

    if (stage === 3) {
      return 5 + Math.random() * 2.6;
    }

    if (stage === 2) {
      return 6 + Math.random() * 3;
    }

    return 7 + Math.random() * 4;
  }

  getExpandItemWeight() {
    if (!this.isEndlessLikeMode()) {
      return this.ITEM_EXPAND_WEIGHT;
    }

    const smallerAxis = Math.min(this.activeRows.length, this.activeCols.length);
    if (smallerAxis <= 9) {
      return 0.96;
    }

    const stage = this.getStageNumber();
    if (stage >= 7) return 0.92;
    if (stage === 6) return 0.9;
    if (stage === 5) return 0.88;
    if (stage === 4) return 0.85;
    if (stage === 3) return 0.82;
    if (stage === 2) return 0.78;
    return this.ITEM_EXPAND_WEIGHT;
  }

  scheduleNextItemSpawn() {
    this.itemSpawnTimer = this.getNextItemSpawnDelay();
  }

  getItemStatus() {
    if (!this.isEndlessLikeMode()) {
      return '';
    }

    if (this.slowEffectTimer > 0) {
      return `COOLING ${this.slowEffectTimer.toFixed(1)}s`;
    }

    if (this.item) {
      return this.item.type === 'EXPAND' ? 'ITEM: GRID+' : 'ITEM: COOLANT';
    }

    return 'ENDLESS ITEMS ONLINE';
  }

  updateItems(dt) {
    if (!this.isEndlessLikeMode()) {
      return;
    }

    if (this.item) {
      this.validateItemPlacement();
      if (!this.item) {
        return;
      }

      this.item.life -= dt;
      this.item.pulse += dt * 5;
      this.tryCollectItem();

      if (this.item && this.item.life <= 0) {
        this.item = null;
        this.scheduleNextItemSpawn();
      }

      return;
    }

    this.itemSpawnTimer -= dt;
    if (this.itemSpawnTimer <= 0) {
      this.spawnItem();
    }
  }

  getAvailableItemCells(excludePlayer = true) {
    const availableCells = [];
    for (const row of this.activeRows) {
      for (const col of this.activeCols) {
        if (excludePlayer && row === this.player.y && col === this.player.x) {
          continue;
        }
        availableCells.push({ row, col });
      }
    }

    return availableCells;
  }

  spawnItem() {
    const availableCells = this.getAvailableItemCells();

    if (availableCells.length === 0) {
      this.scheduleNextItemSpawn();
      return;
    }

    const cell = availableCells[Math.floor(Math.random() * availableCells.length)];
    const canExpand = this.getMissingRows().length > 0 || this.getMissingCols().length > 0;
    const type = canExpand && Math.random() < this.getExpandItemWeight() ? 'EXPAND' : 'SLOW';
    this.item = {
      ...cell,
      type,
      life: this.ITEM_DESPAWN_TIME,
      pulse: 0,
    };
  }

  isItemOnActiveCell() {
    if (!this.item) {
      return false;
    }

    return this.activeRows.includes(this.item.row) && this.activeCols.includes(this.item.col);
  }

  relocateItem() {
    if (!this.item) {
      return;
    }

    const availableCells = this.getAvailableItemCells();
    const fallbackCells = availableCells.length > 0 ? availableCells : this.getAvailableItemCells(false);

    if (fallbackCells.length === 0) {
      this.item = null;
      this.scheduleNextItemSpawn();
      return;
    }

    const targetCell = fallbackCells[Math.floor(Math.random() * fallbackCells.length)];
    this.item.row = targetCell.row;
    this.item.col = targetCell.col;
  }

  validateItemPlacement() {
    if (!this.item) {
      return;
    }

    if (this.isItemOnActiveCell()) {
      return;
    }

    this.relocateItem();
  }

  tryCollectItem() {
    if (!this.item) {
      return;
    }

    if (this.item.row !== this.player.y || this.item.col !== this.player.x) {
      return;
    }

    const centerX = this.visualX[this.player.x] + this.CELL_SIZE / 2;
    const centerY = this.visualY[this.player.y] + this.CELL_SIZE / 2;
    this.spawnParticles(centerX, centerY, 'VICTORY');
    this.applyItem(this.item.type);
    this.item = null;
    this.scheduleNextItemSpawn();
  }

  applyItem(type) {
    if (type === 'EXPAND') {
      const restoredCount = this.restoreMissingLines(this.isEndlessLikeMode() ? 3 : 2);
      if (restoredCount === 0) {
        this.activateSlowField();
      }
      return;
    }

    this.activateSlowField();
  }

  activateSlowField() {
    this.slowEffectTimer = Math.max(this.slowEffectTimer, this.ITEM_SLOW_DURATION);
    this.laserTimer = Math.max(this.laserTimer + 1.2, 1.6);
  }

  restoreMissingLines(count = 1) {
    let restored = 0;

    while (restored < count) {
      const missingRows = this.getMissingRows().map((row) => ({ axis: 'row', index: row }));
      const missingCols = this.getMissingCols().map((col) => ({ axis: 'col', index: col }));
      const options = [...missingRows, ...missingCols];

      if (options.length === 0) {
        break;
      }

      const choice = options[Math.floor(Math.random() * options.length)];
      if (choice.axis === 'row') {
        this.activeRows = [...this.activeRows, choice.index].sort((left, right) => left - right);
        for (const col of this.activeCols) {
          this.spawnParticles(this.visualX[col] + this.CELL_SIZE / 2, this.visualY[choice.index] + this.CELL_SIZE / 2, 'DEBRIS');
        }
      } else {
        this.activeCols = [...this.activeCols, choice.index].sort((left, right) => left - right);
        for (const row of this.activeRows) {
          this.spawnParticles(this.visualX[choice.index] + this.CELL_SIZE / 2, this.visualY[row] + this.CELL_SIZE / 2, 'DEBRIS');
        }
      }

      restored += 1;
      this.validateItemPlacement();
    }

    return restored;
  }

  getMinLaserInterval() {
    const difficultyTime = this.getDifficultyTime();
    if (this.config.mode === '60s') {
      return this.timeAlive > 40 ? 0.72 : 0.8;
    }

    if (difficultyTime > 210) {
      return 0.6;
    }

    if (difficultyTime > 160) {
      return 0.64;
    }

    if (difficultyTime > 110) {
      return 0.68;
    }

    if (difficultyTime > 70) {
      return 0.74;
    }

    if (difficultyTime > 35) {
      return 0.82;
    }

    return 0.94;
  }

  getLaserScalingFactor() {
    const difficultyTime = this.getDifficultyTime();
    if (this.config.mode === '60s') {
      return this.timeAlive > 40 ? 0.965 : 0.94;
    }

    if (difficultyTime > 180) {
      return 0.978;
    }

    if (difficultyTime > 120) {
      return 0.974;
    }

    if (difficultyTime > 70) {
      return 0.97;
    }

    if (difficultyTime > 25) {
      return 0.965;
    }

    return 0.96;
  }

  getLaserCount() {
    if (this.isEndlessLikeMode()) {
      const difficultyTime = this.getDifficultyTime();
      let count = 1;
      const secondLaserChance = Math.min(0.95, Math.max(0, (difficultyTime - 15) / 65));
      const thirdLaserChance = Math.min(0.75, Math.max(0, (difficultyTime - 95) / 110));
      const fourthLaserChance = Math.min(0.18, Math.max(0, (difficultyTime - 240) / 180));
      const fifthLaserChance = Math.min(0.24, Math.max(0, (difficultyTime - 150) / 130));

      if (Math.random() < secondLaserChance) {
        count += 1;
      }

      if (count === 2 && Math.random() < thirdLaserChance) {
        count += 1;
      }

      if (count === 3 && Math.random() < fourthLaserChance) {
        count += 1;
      }

      if (count === 4 && this.getStageNumber() >= 5 && Math.random() < fifthLaserChance) {
        count += 1;
      }

      const smallerAxis = Math.min(this.activeRows.length, this.activeCols.length);
      const stage = this.getStageNumber();
      if (stage >= 3 && smallerAxis >= 12) {
        count = Math.max(count, 3);
      }

      if (stage >= 5 && smallerAxis >= 13) {
        count = Math.max(count, 4);
      }

      if (stage >= 6 && smallerAxis >= 13) {
        count = Math.max(count, 5);
      }

      return count;
    }

    const extraLaserChance = Math.min(0.5, Math.max(0, (this.timeAlive - 20) / 55));
    return 1 + (Math.random() < extraLaserChance ? 1 : 0);
  }

  getLaserStagger(laserCount) {
    if (laserCount <= 1) {
      return 0;
    }

    const baseStagger = this.isEndlessLikeMode() ? 0.3 : 0.24;
    const minStagger = this.isEndlessLikeMode() ? 0.08 : 0.14;
    const difficultySpan = this.isEndlessLikeMode() ? 200 : 60;
    const difficultyFactor = Math.min(1, this.getDifficultyTime() / difficultySpan);
    let stagger = Math.max(minStagger, baseStagger - difficultyFactor * (this.isEndlessLikeMode() ? 0.18 : 0.1));

    if (this.isEndlessLikeMode()) {
      const stage = this.getStageNumber();
      if (stage >= 7) {
        stagger = Math.max(0.06, stagger - 0.05);
      } else if (stage >= 5) {
        stagger = Math.max(0.07, stagger - 0.03);
      }
    }

    return stagger;
  }

  getLaserQueueDelay(laserIndex, laserCount) {
    return laserIndex * this.getLaserStagger(laserCount);
  }

  getStageNumber() {
    return Math.floor(this.getDifficultyTime() / 30) + 1;
  }

  getStageLabel() {
    return `STAGE ${this.getStageNumber()}`;
  }

  hasActiveLaserKind(kind) {
    return this.lasers.some((laser) => laser.kind === kind);
  }

  getNextSweepDelay() {
    const difficultyTime = this.getDifficultyTime();
    if (difficultyTime > 210) {
      return 4.5 + Math.random() * 2.5;
    }

    if (difficultyTime > 150) {
      return 5.5 + Math.random() * 3;
    }

    return 7 + Math.random() * 4;
  }

  getMovementSafeTargets(targets) {
    const recentlyMoved = performance.now() - this.player.lastMoveTime < this.MOVE_GRACE_WINDOW;
    if (!recentlyMoved) {
      return targets;
    }

    const saferTargets = targets.filter((target) => {
      const playerIndex = target.v ? this.player.x : this.player.y;
      return Math.abs(target.idx - playerIndex) > 1;
    });

    return saferTargets.length > 0 ? saferTargets : targets;
  }

  getNearestActiveIndex(indices, target) {
    return [...indices].sort((left, right) => {
      const leftDistance = Math.abs(left - target);
      const rightDistance = Math.abs(right - target);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return left - right;
    })[0];
  }

  getDesiredMovementVector() {
    if (this.nextMove) {
      return this.nextMove;
    }

    if (this.keys.has('ArrowUp') || this.keys.has('w')) return { dx: 0, dy: -1 };
    if (this.keys.has('ArrowDown') || this.keys.has('s')) return { dx: 0, dy: 1 };
    if (this.keys.has('ArrowLeft') || this.keys.has('a')) return { dx: -1, dy: 0 };
    if (this.keys.has('ArrowRight') || this.keys.has('d')) return { dx: 1, dy: 0 };
    return { dx: 0, dy: 0 };
  }

  projectAlongAxis(activeAxis, currentValue, delta, lead) {
    const currentIndex = activeAxis.indexOf(currentValue);
    if (currentIndex === -1 || delta === 0) {
      return currentValue;
    }

    const targetIndex = Math.max(0, Math.min(activeAxis.length - 1, currentIndex + delta * lead));
    return activeAxis[targetIndex];
  }

  getPredictedPlayerPosition(laserIndex, laserCount) {
    const movement = this.getDesiredMovementVector();
    if (laserCount < 3 || (movement.dx === 0 && movement.dy === 0)) {
      return { x: this.player.x, y: this.player.y };
    }

    const lead = Math.min(3, Math.max(1, laserIndex));
    return {
      x: this.projectAlongAxis(this.activeCols, this.player.x, movement.dx, lead),
      y: this.projectAlongAxis(this.activeRows, this.player.y, movement.dy, lead),
    };
  }

  keepPlayerOnActiveGrid() {
    if (!this.activeCols.includes(this.player.x)) {
      this.player.x = this.getNearestActiveIndex(this.activeCols, this.player.x);
    }

    if (!this.activeRows.includes(this.player.y)) {
      this.player.y = this.getNearestActiveIndex(this.activeRows, this.player.y);
    }

    this.tryCollectItem();
  }

  getTargetDistance(target, predictedPlayer = this.player) {
    const playerIndex = target.v ? predictedPlayer.x : predictedPlayer.y;
    return Math.abs(target.idx - playerIndex);
  }

  chooseTrackedTarget(targets, laserIndex = 0, laserCount = 1) {
    if (targets.length === 0) {
      return null;
    }

    const preferVertical = laserIndex % 2 === 0;
    const predictedPlayer = this.getPredictedPlayerPosition(laserIndex, laserCount);

    return [...targets].sort((left, right) => {
      const distanceDiff = this.getTargetDistance(left, predictedPlayer) - this.getTargetDistance(right, predictedPlayer);
      if (distanceDiff !== 0) {
        return distanceDiff;
      }

      if (left.v !== right.v) {
        return left.v === preferVertical ? -1 : 1;
      }

      return left.idx - right.idx;
    })[0];
  }

  canDeleteTarget(isVertical) {
    const axisSize = isVertical ? this.activeCols.length : this.activeRows.length;
    if (axisSize <= 1) {
      return false;
    }

    if (this.isEndlessLikeMode() && axisSize <= this.ENDLESS_GRID_FLOOR) {
      return false;
    }

    return true;
  }

  canSpawnLaser(isVertical, index) {
    if (!this.canDeleteTarget(isVertical)) {
      return false;
    }

    if (isVertical) {
      if (!this.activeCols.includes(index)) {
        return false;
      }
    } else {
      if (!this.activeRows.includes(index)) {
        return false;
      }
    }

    for (const laser of this.lasers) {
      if (laser.isVertical === isVertical && laser.index === index) {
        return false;
      }
    }

    return true;
  }

  chooseSweepTarget() {
    const targets = [];

    for (const col of this.activeCols) {
      if (!this.lasers.some((laser) => laser.isVertical && laser.index === col)) {
        targets.push({ v: true, idx: col });
      }
    }

    for (const row of this.activeRows) {
      if (!this.lasers.some((laser) => !laser.isVertical && laser.index === row)) {
        targets.push({ v: false, idx: row });
      }
    }

    return this.chooseTrackedTarget(targets, 0, 1);
  }

  spawnSweepLaser() {
    const target = this.chooseSweepTarget();
    if (!target) {
      this.sweepTimer = this.getNextSweepDelay();
      return;
    }

    this.lasers.push({
      kind: 'SWEEP',
      isVertical: target.v,
      index: target.idx,
      state: 'WARNING',
      stateTimer: this.LASER_WARNING_LEAD,
    });
    this.sweepTimer = this.getNextSweepDelay();
  }

  updateSweepLasers(dt) {
    if (!this.isEndlessLikeMode() || this.getDifficultyTime() < this.SWEEP_START_TIME) {
      return;
    }

    if (!Number.isFinite(this.sweepTimer)) {
      this.sweepTimer = this.getNextSweepDelay();
    }

    if (this.hasActiveLaserKind('SWEEP')) {
      return;
    }

    this.sweepTimer -= dt;
    if (this.sweepTimer <= 0) {
      this.spawnSweepLaser();
    }
  }

  handleLasers(dt) {
    if (this.timeAlive > 3 && !this.hasActiveLaserKind('NORMAL')) {
      const timerDrain = this.slowEffectTimer > 0 ? dt * this.ITEM_SLOW_MULTIPLIER : dt;
      this.laserTimer -= timerDrain;

      if (this.laserTimer <= 0) {
        this.round += 1;
        const minInterval = this.getMinLaserInterval();
        const scalingFactor = this.getLaserScalingFactor();
        this.laserInterval = Math.max(minInterval, this.laserInterval * scalingFactor);
        this.laserTimer = this.laserInterval;

        const numLasers = this.getLaserCount();

        let spawnedLaserCount = 0;
        for (let index = 0; index < numLasers; index += 1) {
          const validTargets = [];

          for (const col of this.activeCols) {
            if (this.canSpawnLaser(true, col)) {
              validTargets.push({ v: true, idx: col });
            }
          }

          for (const row of this.activeRows) {
            if (this.canSpawnLaser(false, row)) {
              validTargets.push({ v: false, idx: row });
            }
          }

          const safeTargets = this.getMovementSafeTargets(validTargets);
          if (safeTargets.length > 0) {
            const target = this.chooseTrackedTarget(safeTargets, index, numLasers);
            const queueDelay = this.getLaserQueueDelay(index, numLasers);
            this.lasers.push({
              kind: 'NORMAL',
              isVertical: target.v,
              index: target.idx,
              state: queueDelay > 0 ? 'QUEUED' : 'WARNING',
              stateTimer: queueDelay > 0 ? queueDelay : this.LASER_WARNING_LEAD,
            });
            spawnedLaserCount += 1;
          }
        }

        if (spawnedLaserCount === 0 && this.isEndlessLikeMode()) {
          this.restoreMissingLines(1);
          this.itemSpawnTimer = Math.min(this.itemSpawnTimer, 1);
          this.laserTimer = Math.min(this.laserInterval, 0.8);
        }
      }
    }

    for (let index = this.lasers.length - 1; index >= 0; index -= 1) {
      const laser = this.lasers[index];
      laser.stateTimer -= dt;

      if (laser.state === 'QUEUED' && laser.stateTimer <= 0) {
        laser.state = 'WARNING';
        laser.stateTimer = this.LASER_WARNING_LEAD;
      } else if (laser.state === 'WARNING' && laser.stateTimer <= 0) {
        laser.state = 'FIRING';
        laser.stateTimer = laser.kind === 'SWEEP' ? 1 : 0.3;
        this.screenShake = laser.kind === 'SWEEP' ? 2.5 : 4;

        const hit = (laser.isVertical && this.player.x === laser.index)
          || (!laser.isVertical && this.player.y === laser.index);

        laser.fixedX = this.visualX[laser.index];
        laser.fixedY = this.visualY[laser.index];

        if (hit) {
          const playerX = this.visualX[this.player.x] + this.CELL_SIZE / 2;
          const playerY = this.visualY[this.player.y] + this.CELL_SIZE / 2;
          this.spawnParticles(playerX, playerY, 'EXPLOSION');
          if (!this.testMode) {
            this.config.onGameOver(this.timeAlive, false);
            this.stop();
            return;
          }
        }

        if (laser.kind !== 'SWEEP') {
          if (laser.isVertical) {
            this.activeCols = this.activeCols.filter((column) => column !== laser.index);
            for (const row of this.activeRows) {
              this.spawnParticles(laser.fixedX + this.CELL_SIZE / 2, this.visualY[row] + this.CELL_SIZE / 2, 'DEBRIS');
            }
          } else {
            this.activeRows = this.activeRows.filter((row) => row !== laser.index);
            for (const col of this.activeCols) {
              this.spawnParticles(this.visualX[col] + this.CELL_SIZE / 2, laser.fixedY + this.CELL_SIZE / 2, 'DEBRIS');
            }
          }
          this.validateItemPlacement();
          if (this.testMode && hit) {
            this.keepPlayerOnActiveGrid();
          }
        }
      } else if (laser.state === 'FIRING' && laser.stateTimer <= 0) {
        if (laser.kind === 'SWEEP') {
          this.lasers.splice(index, 1);
          continue;
        }

        laser.state = 'REMNANT';
        laser.stateTimer = 0.5;
      } else if (laser.state === 'REMNANT' && laser.stateTimer <= 0) {
        this.lasers.splice(index, 1);
      }
    }
  }

  updateParticles(dt) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dt;

      if (particle.life <= 0) {
        this.particles.splice(index, 1);
        continue;
      }

      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.type === 'DEBRIS') {
        particle.vy += 20 * dt;
      }
    }
  }

  draw() {
    this.ctx.fillStyle = '#0a0a0f';
    this.ctx.fillRect(0, 0, this.CANVAS_SIZE, this.CANVAS_SIZE);
    this.ctx.save();

    if (this.screenShake > 0) {
      const dx = (Math.random() - 0.5) * this.screenShake;
      const dy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(dx, dy);
    }

    for (const row of this.activeRows) {
      for (const col of this.activeCols) {
        const x = this.visualX[col];
        const y = this.visualY[row];
        const warningLaser = this.lasers.find(
          (laser) => laser.state === 'WARNING' && ((laser.isVertical && laser.index === col) || (!laser.isVertical && laser.index === row)),
        );

        if (warningLaser) {
          if (Math.floor(this.timeAlive * 15) % 2 === 0) {
            const warningColor = warningLaser.kind === 'SWEEP' ? '255, 215, 0' : '255, 34, 68';
            this.ctx.fillStyle = `rgba(${warningColor}, 0.5)`;
            this.ctx.shadowColor = `rgba(${warningColor}, 0.3)`;
            this.ctx.shadowBlur = 8;
          } else {
            this.ctx.fillStyle = '#1a1a2e';
            this.ctx.shadowBlur = 0;
          }
        } else {
          this.ctx.fillStyle = '#1a1a2e';
          this.ctx.shadowBlur = 0;
        }

        this.ctx.strokeStyle = '#2a2a4a';
        this.ctx.beginPath();
        this.ctx.rect(x, y, this.CELL_SIZE, this.CELL_SIZE);
        this.ctx.fill();
        this.ctx.stroke();
      }
    }

    this.ctx.shadowBlur = 0;

    if (this.item) {
      this.drawItem();
    }

    const playerX = this.visualX[this.player.x] + this.CELL_SIZE / 2;
    const playerY = this.visualY[this.player.y] + this.CELL_SIZE / 2;
    const playerRadius = Math.max(6, this.CELL_SIZE * 0.18);
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
    this.ctx.shadowBlur = 8 + Math.sin(this.timeAlive * 2) * 4;
    this.ctx.beginPath();
    this.ctx.arc(playerX, playerY, playerRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.globalCompositeOperation = 'lighter';
    for (const laser of this.lasers) {
      const renderX = laser.fixedX !== undefined ? laser.fixedX : this.visualX[laser.index];
      const renderY = laser.fixedY !== undefined ? laser.fixedY : this.visualY[laser.index];

      if (laser.state === 'FIRING') {
        const firingDuration = laser.kind === 'SWEEP' ? 1 : 0.3;
        this.drawLaserBeam(laser.isVertical, renderX, renderY, laser.stateTimer / firingDuration, laser.kind);
      } else if (laser.state === 'REMNANT') {
        this.drawLaserRemnant(laser.isVertical, renderX, renderY, laser.stateTimer / 0.5, laser.kind);
      }
    }
    this.ctx.globalCompositeOperation = 'source-over';

    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      this.ctx.fillStyle = particle.color;
      this.ctx.globalAlpha = alpha;

      if (particle.type === 'DEBRIS') {
        this.ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.type === 'VICTORY' ? 2 : 3, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.globalAlpha = 1;
    }

    this.ctx.restore();

    if (this.timeAlive > 30) {
      const intensity = Math.min(0.08, ((this.timeAlive - 30) / 30) * 0.08);
      this.ctx.fillStyle = `rgba(255, 34, 68, ${intensity})`;
      this.ctx.fillRect(0, 0, this.CANVAS_SIZE, this.CANVAS_SIZE);
    }
  }

  drawItem() {
    const x = this.visualX[this.item.col] + this.CELL_SIZE / 2;
    const y = this.visualY[this.item.row] + this.CELL_SIZE / 2;
    const pulseScale = 1 + Math.sin(this.item.pulse) * 0.12;

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(pulseScale, pulseScale);

    if (this.item.type === 'EXPAND') {
      this.ctx.fillStyle = '#aaff00';
      this.ctx.shadowColor = 'rgba(170, 255, 0, 0.6)';
      this.ctx.shadowBlur = 14;
      this.ctx.fillRect(-4, -10, 8, 20);
      this.ctx.fillRect(-10, -4, 20, 8);
    } else {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
      this.ctx.shadowBlur = 14;
      this.ctx.beginPath();
      this.ctx.moveTo(0, -10);
      this.ctx.lineTo(10, 0);
      this.ctx.lineTo(0, 10);
      this.ctx.lineTo(-10, 0);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.fillStyle = '#0a0a0f';
      this.ctx.fillRect(-2, -6, 4, 12);
    }

    this.ctx.restore();
  }

  drawLaserBeam(isVertical, renderX, renderY, strength, kind = 'NORMAL') {
    this.ctx.save();
    const beamPalette = kind === 'SWEEP'
      ? { shadow: 'rgba(255, 215, 0, 0.65)', mid: '#ffd700' }
      : { shadow: 'rgba(255, 34, 68, 0.6)', mid: '#ff4466' };
    this.ctx.shadowColor = beamPalette.shadow;
    this.ctx.shadowBlur = 20 * strength;
    const beamWidth = Math.max(6, Math.round(this.CELL_SIZE * 0.18));
    const gradient = this.ctx.createLinearGradient(
      0,
      0,
      isVertical ? 0 : this.CANVAS_SIZE,
      isVertical ? this.CANVAS_SIZE : 0,
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, beamPalette.mid);
    gradient.addColorStop(1, '#ffffff');
    this.ctx.fillStyle = gradient;
    this.ctx.globalAlpha = strength;

    if (isVertical) {
      this.ctx.fillRect(renderX + this.CELL_SIZE / 2 - beamWidth / 2, 0, beamWidth, this.CANVAS_SIZE);
    } else {
      this.ctx.fillRect(0, renderY + this.CELL_SIZE / 2 - beamWidth / 2, this.CANVAS_SIZE, beamWidth);
    }

    this.ctx.restore();
  }

  drawLaserRemnant(isVertical, renderX, renderY, strength, kind = 'NORMAL') {
    this.ctx.fillStyle = kind === 'SWEEP' ? '#ffd700' : '#ff2244';
    this.ctx.globalAlpha = strength * 0.5;
    const remnantWidth = Math.max(2, Math.round(this.CELL_SIZE * 0.07));

    if (isVertical) {
      this.ctx.fillRect(
        renderX + this.CELL_SIZE / 2 - remnantWidth / 2,
        0,
        remnantWidth,
        this.CANVAS_SIZE,
      );
    } else {
      this.ctx.fillRect(
        0,
        renderY + this.CELL_SIZE / 2 - remnantWidth / 2,
        this.CANVAS_SIZE,
        remnantWidth,
      );
    }

    this.ctx.globalAlpha = 1;
  }
}
