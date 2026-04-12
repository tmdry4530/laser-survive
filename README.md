# Laser Survival

> HTML5 Canvas 기반 아케이드 서바이벌 게임

**Live Demo** → [laser-survive.vercel.app](https://laser-survive.vercel.app/)

| 항목      | 내용                   |
| --------- | ---------------------- |
| 개발 기간 | 2026.04                |
| 참여 인원 | 1인 (개인 프로젝트)    |
| 플랫폼    | 웹 브라우저 (데스크톱) |

---

## 소개

Laser Survival은 14x14 그리드 위에서 레이저를 피해 최대한 오래 살아남는 웹 아케이드 게임입니다.

프레임워크 없이 **HTML5 Canvas API**와 **Vanilla JavaScript**만으로 게임 루프, 입력 처리, 상태 전환, 파티클 렌더링을 직접 구현했습니다.
빌드 도구 없이 브라우저에서 바로 실행/배포할 수 있는 구조를 유지합니다.

시간이 지날수록 레이저 수, 발사 템포, 패턴 복잡도가 동적으로 상승하며, **Endless / Crazy** 두 모드가 서로 다른 난이도 곡선을 제공합니다.

> **프레임워크 없이 Vanilla JS를 선택한 이유** — 게임 루프, 키보드 입력, Canvas 렌더링, DOM 상태 관리를 직접 다루는 것이 이 프로젝트의 핵심이기 때문입니다. 빌드 단계 없이도 정적 배포가 가능한 단순한 구조를 유지하는 데에도 유리했습니다.

---

## 기술 스택

| 구분          | 기술                              |
| ------------- | --------------------------------- |
| Frontend      | Vanilla JavaScript, HTML5, CSS3   |
| Rendering     | Canvas API, requestAnimationFrame |
| Local Storage | IndexedDB                         |
| Backend       | Node.js, Express, Supabase        |
| Deploy        | Vercel + Supabase                 |

---

## 주요 기능

### 1. requestAnimationFrame 기반 게임 루프

`requestAnimationFrame`으로 프레임 단위 업데이트/렌더링을 수행합니다.
dt(delta time)를 기준으로 모든 타이머와 물리 연산을 처리해 프레임률에 독립적인 게임 속도를 보장합니다.

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

  this.update(dt); // 상태 갱신
  this.draw(); // Canvas 렌더링

  if (this.running) {
    this.reqId = requestAnimationFrame(this.loop);
  }
};
```

### 2. 동적 난이도 시스템

30초 단위로 스테이지가 올라가며, 경과 시간에 따라 레이저 수, 발사 간격, 패턴이 실시간으로 조정됩니다.

```javascript
getStageNumber() {
  return Math.floor(this.getDifficultyTime() / 30) + 1;
}

// 레이저 수: 확률 기반으로 점진적 증가
getLaserCount() {
  const difficultyTime = this.getDifficultyTime();
  let count = 1;
  const secondLaserChance = Math.min(0.95, Math.max(0, (difficultyTime - 15) / 65));
  const thirdLaserChance  = Math.min(0.75, Math.max(0, (difficultyTime - 95) / 110));
  // ... stage가 올라갈수록 최소 보장 레이저 수도 상승
  if (stage >= 5 && smallerAxis >= 13) count = Math.max(count, 4);
  if (stage >= 8 && smallerAxis >= 13) count = Math.max(count, 6);
  return count;
}

// 발사 간격: 시간이 흐를수록 점점 짧아짐
getLaserScalingFactor() {
  const difficultyTime = this.getDifficultyTime();
  if (difficultyTime > 180) return 0.978;
  if (difficultyTime > 120) return 0.974;
  if (difficultyTime > 70)  return 0.97;
  return 0.96;
}
```

| 난이도 구간 | 레이저 수 | 최소 발사 간격 | 특수 패턴    |
| ----------- | --------- | -------------- | ------------ |
| Stage 1-2   | 1-2개     | 0.94s          | -            |
| Stage 3-4   | 3-4개     | 0.74s          | Pursuit 등장 |
| Stage 5-6   | 4-6개     | 0.68s          | Sweep 등장   |
| Stage 7+    | 5-7개     | 0.60s          | 복합 패턴    |

### 3. 레이저 패턴 — Normal / Pursuit / Sweep

세 종류의 레이저가 시간대에 따라 혼합 출현합니다.

- **Normal** — 랜덤 행/열에 경고 후 발사, 해당 줄 제거
- **Pursuit** — 플레이어를 추적(TRACK)한 뒤 위치를 고정(LOCK)하고 발사
- **Sweep** — 연속된 인접 줄을 순차적으로 쓸어내는 광역 패턴

```javascript
// Pursuit: 추적 → 경고 → 발사 3단계
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

### 4. 그리드 축소와 복구

레이저가 발사되면 해당 행/열이 제거되어 플레이 공간이 줄어듭니다.
제거된 줄은 시간 경과 또는 아이템 획득으로 복구되며, 그리드가 축소될수록 복구 속도가 빨라집니다.

```javascript
getAutoRestoreDelay() {
  const smallerAxis = Math.min(this.activeRows.length, this.activeCols.length);
  if (smallerAxis <= 5) return 1.1;   // 위험 구간: 빠른 복구
  if (smallerAxis <= 7) return 1.45;
  return Math.max(2.4, 7 - this.round * 0.05);
}
```

그리드 위치 변경은 lerp 보간으로 부드럽게 애니메이션됩니다.

```javascript
updateGridPositions(dt) {
  for (let i = 0; i < colCount; i++) {
    const target = startX + i * stride;
    this.visualX[col] += (target - this.visualX[col]) * 12 * dt;  // lerp
  }
}
```

### 5. 아이템 시스템 — EXPAND / COOLANT

두 종류의 아이템이 그리드 위에 출현합니다.

| 아이템         | 효과                                 |
| -------------- | ------------------------------------ |
| EXPAND (GRID+) | 제거된 줄 복구 (라운드에 따라 3-7줄) |
| COOLANT        | 레이저 발사 속도 일시 감속 (8초)     |

그리드가 축소된 상태일수록 EXPAND 아이템의 출현 확률이 올라갑니다.

```javascript
getExpandItemWeight() {
  const smallerAxis = Math.min(this.activeRows.length, this.activeCols.length);
  const waveBoost = Math.min(0.04, this.round * 0.002);
  if (smallerAxis <= 9) return Math.min(0.99, 0.96 + waveBoost);  // 거의 확정
  if (stage >= 7)       return Math.min(0.97, 0.92 + waveBoost);
  return Math.min(0.8, 0.72 + waveBoost);                         // 기본
}
```

### 6. 파티클 이펙트

Canvas 위에 직접 그리는 경량 파티클 시스템으로 시각적 피드백을 제공합니다.

| 타입      | 발생 시점     | 색상 |
| --------- | ------------- | ---- |
| TRAIL     | 플레이어 이동 | cyan |
| DEBRIS    | 줄 제거/복구  | dark |
| EXPLOSION | 레이저 피격   | cyan |
| VICTORY   | 아이템 획득   | gold |

### 7. Endless / Crazy 모드 분리

- **Endless** — 기본 생존 모드. 스테이지가 올라갈수록 점진적으로 압박이 강해짐
- **Crazy** — `getDifficultyTime()`이 실제 시간 + 180초로 계산되어 시작부터 후반 난이도. 75-90초 구간에 전용 최종 페이즈 돌입

```javascript
getDifficultyTime() {
  if (this.config.mode === 'crazy') return this.timeAlive + 180;  // 시작부터 Stage 7
  return this.timeAlive;
}

isCrazyFinalPhase() {
  return this.config.mode === 'crazy' && this.timeAlive >= 75 && this.timeAlive <= 90;
}
```

### 8. 로컬 기록 및 온라인 랭킹

- 최고 기록, 플레이 횟수, 최근 기록을 **IndexedDB**에 로컬 저장
- Supabase 연결 시 모드별 온라인 랭킹 제출/조회
- 조건 달성 시 모드별 보상 클레임 (Endless 120초 / Crazy 90초 이상)

---

## 게임 규칙

| 항목        | 설명                       |
| ----------- | -------------------------- |
| 이동        | 방향키 / WASD              |
| 목표        | 가능한 오래 생존           |
| 패배 조건   | 레이저 피격 또는 생존 불가 |
| 테스트 모드 | `?test=1` 쿼리로 시작      |

---

## 프로젝트 구조

```text
src/
  gameEngine.js      # 핵심 게임 루프 / 레이저 / 아이템 / 파티클 로직
  main.js            # 화면 전환 / UI 연결 / 이벤트 바인딩
  db.js              # 로컬 기록 저장 (IndexedDB)
  leaderboardApi.js  # 온라인 랭킹 API
  rewardApi.js       # 보상 API
  supabaseClient.js  # Supabase 요청 helper
  uiMessages.js      # 사용자 메시지 매핑

server/src/          # Express 서버 (config 주입)
api/                 # Vercel 서버리스 엔드포인트
tests/               # 유닛 테스트
```

---

## 세팅 및 실행

```bash
npm install
cp .env.example .env   # SUPABASE_URL, SUPABASE_ANON_KEY 설정
npm start              # http://localhost:3001
```

> 온라인 기능 없이 게임만 띄우려면 `python3 -m http.server 4173`으로도 가능합니다.

---

## 검증

```bash
npm run lint
npm test
```

---

## 개발 원칙

- 프레임워크 없이 HTML / CSS / JavaScript 중심으로 유지
- 기능 추가보다 게임 감각과 반응성 우선
- 기록 저장은 로컬 우선, 온라인 기능은 선택적 확장
- 작은 단위 테스트와 최소 diff 리팩토링 지향
