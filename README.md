# Laser Survive

> HTML5 Canvas 기반 아케이드 서바이벌 게임

레이저를 피해 14×14 그리드 위에서 최대한 오래 살아남는 웹 아케이드 게임입니다. 프레임워크 없이 HTML5 Canvas API와 Vanilla JavaScript만으로 게임 루프, 입력 처리, 상태 전환, 파티클 렌더링을 직접 구현했습니다.



## 배포 주소

- **Vercel**: https://laser-survive.vercel.app/

## 기획 의도

뭐 만들지 모르겟어서 예전에 플레이했던 게임을 리메이크 해보기로 했다. 

- **Reference**: https://death.fun/laser

## 핵심 기능

### 게임플레이
- 14×14 그리드 위에서 레이저를 피해 생존 (방향키 / WASD 이동)
- 레이저가 발사되면 해당 행/열이 제거되어 플레이 공간 축소
- 시간이 지날수록 레이저 수, 발사 속도, 패턴 복잡도 동적 상승

### 레이저 패턴
- **Normal** — 랜덤 행/열에 경고 후 발사
- **Pursuit** — 플레이어를 추적 → 위치 고정 → 발사
- **Sweep** — 인접 줄을 연속으로 쓸어내는 광역 패턴

### 아이템
- **EXPAND (GRID+)** — 제거된 줄 복구 (라운드에 따라 3–7줄)
- **COOLANT** — 레이저 발사 속도 일시 감속 (8초)

### 모드
- **Endless** — 스테이지가 올라갈수록 점진적 압박
- **Crazy** — 시작부터 Stage 7 난이도, 75–90초 구간에 최종 페이즈 돌입

### 기록
- 최고 기록, 플레이 횟수, 최근 기록 IndexedDB 로컬 저장
- 모드별 온라인 랭킹 제출/조회 (Supabase)
- 조건 달성 시 모드별 보상 클레임 (Endless 120초 / Crazy 90초 이상)

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Rendering | Canvas API, requestAnimationFrame |
| Local Storage | IndexedDB |
| Backend | Node.js, Express |
| Database | Supabase |
| Deploy | Vercel |

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                     브라우저                          │
├─────────────────────────────────────────────────────┤
│  index.html   게임 UI, 화면 전환, 이벤트 바인딩 (main.js)│
├─────────────────────────────────────────────────────┤
│                  게임 엔진 (gameEngine.js)             │
│                                                      │
│  GameLoop         requestAnimationFrame + delta time │
│  LaserSystem      Normal / Pursuit / Sweep 패턴 생성 │
│  GridSystem       행/열 제거 + lerp 복구 애니메이션  │
│  ItemSystem       EXPAND / COOLANT 출현/획득         │
│  ParticleSystem   TRAIL / DEBRIS / EXPLOSION / VICTORY│
│  DifficultySystem 스테이지 + 스케일링 팩터 계산       │
│                                                      │
├──────────────────────┬──────────────────────────────┤
│  db.js               │  leaderboardApi.js            │
│  IndexedDB 로컬 기록  │  rewardApi.js                │
│  저장                 │  Supabase 온라인 랭킹/보상    │
├──────────────────────┴──────────────────────────────┤
│  Express 서버 (server/)   Vercel 서버리스 (api/)      │
│  환경변수 주입, config 엔드포인트 제공                 │
└─────────────────────────────────────────────────────┘
```

**게임 루프 흐름**
1. `requestAnimationFrame` 콜백 → `dt` 계산 (탭 전환 시 스킵)
2. `update(dt)` — 레이저 상태 전이, 충돌 감지, 그리드/아이템/파티클 갱신
3. `draw()` — Canvas 전체 재렌더링 (배경 → 그리드 → 레이저 → 플레이어 → 파티클)
4. 다음 프레임 예약 또는 게임오버 처리

## 핵심 구현 포인트

### 1. requestAnimationFrame 기반 게임 루프

`requestAnimationFrame`으로 프레임 단위 업데이트/렌더링을 수행한다. `dt(delta time)`을 기준으로 모든 타이머와 물리 연산을 처리해 프레임률에 독립적인 게임 속도를 보장한다. 탭 전환 등 긴 공백(100ms 초과)은 dt를 스킵하여 화면 복귀 시 갑작스러운 상태 점프를 방지한다.

```javascript
this.loop = (time) => {
  if (!this.running) return;

  const dt = (time - this.lastTime) / 1000;
  this.lastTime = time;

  if (dt > 0.1) {
    // 탭 전환 등 긴 공백은 스킵
    this.reqId = requestAnimationFrame(this.loop);
    return;
  }

  this.update(dt);
  this.draw();

  if (this.running) {
    this.reqId = requestAnimationFrame(this.loop);
  }
};
```

### 2. 동적 난이도 시스템

30초 단위로 스테이지가 올라가며 레이저 수, 발사 간격, 패턴이 실시간으로 조정된다. Crazy 모드는 `getDifficultyTime()`이 실제 시간 + 180초로 계산되어 시작부터 Stage 7 난이도를 제공한다. 레이저 수는 확률 기반으로 점진적으로 증가하며, 스테이지가 높아질수록 최소 보장 레이저 수도 상승한다.

```javascript
getDifficultyTime() {
  if (this.config.mode === 'crazy') return this.timeAlive + 180;  // 시작부터 Stage 7
  return this.timeAlive;
}

getLaserScalingFactor() {
  const difficultyTime = this.getDifficultyTime();
  if (difficultyTime > 180) return 0.978;
  if (difficultyTime > 120) return 0.974;
  if (difficultyTime > 70)  return 0.97;
  return 0.96;
}
```

| 난이도 구간 | 레이저 수 | 최소 발사 간격 | 특수 패턴 |
|------------|---------|--------------|---------|
| Stage 1–2 | 1–2개 | 0.94s | — |
| Stage 3–4 | 3–4개 | 0.74s | Pursuit 등장 |
| Stage 5–6 | 4–6개 | 0.68s | Sweep 등장 |
| Stage 7+ | 5–7개 | 0.60s | 복합 패턴 |

### 3. 레이저 패턴 — Normal / Pursuit / Sweep

세 종류의 레이저가 시간대에 따라 혼합 출현한다. Pursuit 레이저는 QUEUED → TRACK → WARNING → FIRE 4단계를 거치며, 이동 직후 즉사를 막기 위해 최근 이동한 플레이어 주변 타겟을 자동으로 회피한다.

```javascript
getInitialLaserState(kind, queueDelay) {
  if (kind === 'PURSUIT') return 'QUEUED';  // QUEUED → TRACK → WARNING → FIRE
  return queueDelay > 0 ? 'QUEUED' : 'WARNING';
}

// 이동 직후 즉사 방지: 최근 이동한 플레이어 주변 타겟을 회피
getMovementSafeTargets(targets) {
  const recentlyMoved = performance.now() - this.player.lastMoveTime < this.MOVE_GRACE_WINDOW;
  if (!recentlyMoved) return targets;

  const saferTargets = targets.filter((target) => {
    const playerIndex = target.v ? this.player.x : this.player.y;
    return Math.abs(target.idx - playerIndex) > 1;
  });
  return saferTargets.length > 0 ? saferTargets : targets;
}
```

### 4. 그리드 축소와 lerp 복구 애니메이션

레이저가 발사되면 해당 행/열이 제거되어 플레이 공간이 줄어든다. 제거된 줄은 시간 경과 또는 아이템 획득으로 복구되며, 그리드가 축소될수록 복구 속도가 빨라진다. 위치 변경은 lerp 보간으로 처리하여 그리드 수축/확장이 부드럽게 애니메이션된다.

```javascript
getAutoRestoreDelay() {
  const smallerAxis = Math.min(this.activeRows.length, this.activeCols.length);
  if (smallerAxis <= 5) return 1.1;   // 위험 구간: 빠른 복구
  if (smallerAxis <= 7) return 1.45;
  return Math.max(2.4, 7 - this.round * 0.05);
}

updateGridPositions(dt) {
  for (let i = 0; i < colCount; i++) {
    const target = startX + i * stride;
    this.visualX[col] += (target - this.visualX[col]) * 12 * dt;  // lerp
  }
}
```

### 5. 아이템 출현 가중치

두 종류의 아이템이 그리드 위에 출현하며, 그리드가 축소된 상태일수록 EXPAND 아이템의 출현 확률이 올라간다. 극한 상황에서도 자연스럽게 복구 기회가 생기도록 설계했다.

```javascript
getExpandItemWeight() {
  const smallerAxis = Math.min(this.activeRows.length, this.activeCols.length);
  const waveBoost = Math.min(0.04, this.round * 0.002);
  if (smallerAxis <= 9) return Math.min(0.99, 0.96 + waveBoost);  // 거의 확정
  if (stage >= 7)       return Math.min(0.97, 0.92 + waveBoost);
  return Math.min(0.8, 0.72 + waveBoost);                         // 기본
}
```

### 6. Canvas 파티클 시스템

Canvas 위에 직접 그리는 경량 파티클 시스템으로 시각적 피드백을 제공한다. 파티클은 타입별로 발생 시점과 색상이 다르며, 매 프레임 위치와 opacity를 갱신하여 렌더링한다.

| 타입 | 발생 시점 | 색상 |
|------|---------|------|
| TRAIL | 플레이어 이동 | cyan |
| DEBRIS | 줄 제거/복구 | dark |
| EXPLOSION | 레이저 피격 | cyan |
| VICTORY | 아이템 획득 | gold |
