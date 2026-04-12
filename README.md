# Laser Survival

> HTML5 Canvas 기반 아케이드 서바이벌 게임 + Supabase 온라인 랭킹/보상 시스템

로컬 실행 → `http://localhost:3001`  
레퍼런스 → [death.fun/laser](https://death.fun/laser)

* * *

## 소개

Laser Survival은 그리드 위에서 플레이어를 이동시키며 레이저를 피해서 최대한 오래 살아남는 웹 아케이드 게임입니다.

단순히 시간을 버티는 것에서 끝나지 않고, 시간이 지날수록 레이저 패턴과 압박 강도가 높아지며 **Endless / Crazy** 두 모드가 서로 다른 템포와 난이도를 제공합니다.  
기록은 로컬 IndexedDB에 저장되고, Supabase를 연결하면 모드별 온라인 랭킹 제출·조회와 보상 클레임까지 확장됩니다.

개발 기간 2026.04  
참여 인원 1인 (개인 프로젝트)  
플랫폼 웹 브라우저 (데스크톱/모바일)

* * *

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Rendering | Canvas API, requestAnimationFrame |
| Local Storage | IndexedDB |
| Backend | Node.js, Express |
| Online Backend | Supabase Database, RPC, Storage, Edge Functions |
| Testing | Node Test Runner, ESLint |
| Deploy | Vercel + Supabase |

> 프레임워크 없이 구성한 이유 — 게임 루프, 입력 처리, 상태 전환, DOM 업데이트, Canvas 렌더링을 직접 다루는 구조가 이 프로젝트 핵심이기 때문입니다. 빌드 단계 없이도 바로 실행/배포 가능한 단순한 구조를 유지하는 데에도 유리했습니다.

* * *

## ⚙️ 세팅 및 실행

### 1) 의존성 설치

```bash
npm install
```

### 2) 환경 변수 준비

```bash
cp .env.example .env
```

`.env`

```env
PORT=3001
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 3) 서버 실행

```bash
npm start
```

브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:3001
```

### 4) 정적 파일만 따로 띄우는 경우

```bash
python3 -m http.server 4173
```

이 경우 `/api/config.js`를 제공하지 못하므로 온라인 랭킹/보상 기능은 동작하지 않습니다.  
온라인 기능까지 확인하려면 `npm start` 방식으로 실행하는 것을 권장합니다.

* * *

## ☁️ 배포 구성

### 프론트 + 경량 서버

이 프로젝트는 정적 파일과 공개 런타임 설정을 함께 제공하는 구조입니다.

- `server/src/app.js` : Express 서버
- `api/config.js` : Vercel 서버리스 설정 주입 엔드포인트
- `api/health.js` : Vercel 서버리스 헬스 체크 엔드포인트
- `src/` : 브라우저 클라이언트 코드

### 런타임 엔드포인트

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/health` | Supabase 공개 설정 존재 여부 반환 |
| `GET /api/config.js` | 브라우저용 public Supabase config 주입 |
| `GET /` | 게임 화면 반환 |
| `GET /src/*`, `GET /public/*` | 정적 에셋 제공 |

### Vercel 배포 시 필요한 환경 변수

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

배포 후 클라이언트는 `/api/config.js`를 통해 public config를 받고, 랭킹/보상 관련 요청은 Supabase로 직접 연결됩니다.

* * *

## 🗄️ Supabase 설정

Supabase SQL Editor에서 아래 파일을 실행합니다.

```text
supabase/schema.sql
```

이 스키마는 다음을 포함합니다.

- `scores` 테이블
- 점수 저장용 정책/RPC
- 플레이어 최고기록 조회 RPC
- `rewards`, `reward_claims` 테이블
- 보상 클레임 관련 함수

### 추가 준비 항목

1. **Storage bucket**
   - 이름: `reward-assets`
   - 타입: private

2. **보상 이미지 업로드**
   - Endless: `endless/reward-01.png` ~ `endless/reward-12.png`
   - Crazy: `crazy/reward.png`

3. **Edge Functions 배포**
   - `supabase/functions/claim-reward`
   - `supabase/functions/reward-asset`

4. **Edge Function 환경 변수**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

* * *

## ✨ 주요 기능

### 1. 실시간 생존형 레이저 회피

- 플레이어는 방향키 또는 WASD로 한 칸씩 이동
- 레이저는 경고 → 발사 → 줄 제거 순서로 진행
- 제거된 행/열은 플레이 공간에서 사라져 이동 경로가 계속 좁아짐

### 2. Endless / Crazy 모드 분리

- **Endless** : 기본 생존 모드
- **Crazy** : 더 빠른 압박, 더 공격적인 난이도 상승, 별도 랭킹

### 3. 후반 난이도 상승

- 시간이 지날수록 레이저 수와 발사 템포가 증가
- 추적형(pursuit), 스윕(sweep) 등 후반 패턴 등장
- 아이템과 라인 복구 타이밍이 생존 전략에 직접 영향

### 4. 로컬 기록 저장

- 최고 기록, 플레이 횟수, 최근 기록을 IndexedDB에 저장
- 새로고침 후에도 타이틀 화면에서 기록 유지

### 5. 온라인 랭킹

- 플레이어 이름 입력 후 점수 제출
- Endless / Crazy 모드별 Top 랭킹 조회
- 플레이어 개인 최고기록 별도 조회
- 테스트 모드 기록은 랭킹에서 제외

### 6. 보상 클레임 시스템

- 조건 달성 시 모드별 보상 클레임 가능
- Endless: 180초 이상
- Crazy: 90초 이상
- 기기 기준으로 보상 중복 클레임을 제한

* * *

## 🎮 게임 규칙 요약

| 항목 | 설명 |
|------|------|
| 플레이어 이동 | 방향키 / WASD |
| 목표 | 가능한 오래 생존 |
| 패배 조건 | 레이저 피격 또는 더 이상 생존 불가 |
| 로컬 저장 | IndexedDB |
| 온라인 기능 | Supabase 연결 시 활성화 |
| 테스트 모드 | `?test=1` 쿼리로 시작 가능 |

* * *

## 📁 프로젝트 구조

```text
src/
  db.js              # 로컬 기록 저장
  gameEngine.js      # 핵심 게임 루프/레이저/아이템 로직
  leaderboardApi.js  # 온라인 랭킹 API
  rewardApi.js       # 보상 API
  supabaseClient.js  # 브라우저용 Supabase 요청 공통 helper
  main.js            # 화면 전환 / UI 연결
  uiMessages.js      # 사용자 메시지 매핑

server/src/
  app.js             # Express 앱
  env.js             # .env 로딩
  publicConfig.js    # public runtime config helper

api/
  config.js          # Vercel public config endpoint
  health.js          # Vercel health endpoint

tests/
  *.test.js          # db / engine / api / server 테스트
```

* * *

## ✅ 검증

```bash
npm run lint
npm test
```

현재 저장소에는 로컬 저장, 서버 API, 랭킹/보상 클라이언트, 게임 엔진 테스트가 포함되어 있습니다.

> 참고: 현재 기준 전체 테스트에는 `tests/gameEngine.test.js` 일부 기대값 불일치 케이스가 남아 있을 수 있습니다. 반면 서버/API/DB/랭킹/보상 범위 테스트는 리팩토링 후에도 유지되도록 회귀 검증했습니다.

* * *

## 개발 원칙

- 프레임워크 없이 HTML / CSS / JavaScript 중심으로 유지
- 기능 추가보다 게임 감각과 반응성 우선
- 기록 저장은 로컬 우선, 온라인 기능은 선택적 확장
- 작은 단위 테스트와 최소 diff 리팩토링 지향
