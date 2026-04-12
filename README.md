# Laser Survival

> HTML5 Canvas 기반 아케이드 서바이벌 게임

| | |
|---|---|
| 레퍼런스 | [death.fun/laser](https://death.fun/laser) |
| 개발 기간 | 2026.04 |
| 참여 인원 | 1인 (개인 프로젝트) |
| 플랫폼 | 웹 브라우저 (데스크톱/모바일) |

## 소개

Laser Survival은 그리드 위에서 플레이어를 이동시키며 레이저를 피해 최대한 오래 살아남는 웹 아케이드 게임입니다.

프레임워크 없이 **HTML5 Canvas API**와 **Vanilla JavaScript**만으로 게임 루프, 입력 처리, 상태 전환, 렌더링을 직접 구현했습니다. 빌드 도구 없이 바로 실행/배포할 수 있는 단순한 구조를 유지합니다.

시간이 지날수록 레이저 패턴과 압박 강도가 높아지며, **Endless / Crazy** 두 모드가 서로 다른 템포와 난이도를 제공합니다.

## 기술 스택

| 구분 | 기술 |
|---|---|
| Core | Vanilla JavaScript, HTML5 Canvas API, CSS3 |
| Rendering | requestAnimationFrame 기반 게임 루프 |
| Local Storage | IndexedDB |
| Backend | Node.js, Express, Supabase |
| Deploy | Vercel + Supabase |

## 주요 기능

### 실시간 레이저 회피

- 방향키 또는 WASD로 한 칸씩 이동
- 레이저는 경고 → 발사 → 줄 제거 순서로 진행
- 제거된 행/열은 플레이 공간에서 사라져 이동 경로가 계속 좁아짐

### Endless / Crazy 모드

- **Endless** : 기본 생존 모드
- **Crazy** : 더 빠른 압박, 더 공격적인 난이도 상승, 별도 랭킹

### 후반 난이도 상승

- 시간이 지날수록 레이저 수와 발사 템포가 증가
- 추적형(pursuit), 스윕(sweep) 등 후반 패턴 등장
- 아이템과 라인 복구 타이밍이 생존 전략에 직접 영향

### 기록 저장 및 온라인 랭킹

- 최고 기록, 플레이 횟수, 최근 기록을 IndexedDB에 로컬 저장
- Supabase 연결 시 모드별 온라인 랭킹 제출/조회
- 조건 달성 시 모드별 보상 클레임 (Endless 180초 / Crazy 90초 이상)

## 게임 규칙

| 항목 | 설명 |
|---|---|
| 이동 | 방향키 / WASD |
| 목표 | 가능한 오래 생존 |
| 패배 조건 | 레이저 피격 또는 생존 불가 |
| 테스트 모드 | `?test=1` 쿼리로 시작 |

## 프로젝트 구조

```text
src/
  gameEngine.js      # 핵심 게임 루프 / 레이저 / 아이템 로직
  main.js            # 화면 전환 / UI 연결
  db.js              # 로컬 기록 저장 (IndexedDB)
  leaderboardApi.js  # 온라인 랭킹 API
  rewardApi.js       # 보상 API
  supabaseClient.js  # Supabase 요청 helper
  uiMessages.js      # 사용자 메시지 매핑

server/src/          # Express 서버 (config 주입)
api/                 # Vercel 서버리스 엔드포인트
tests/               # 유닛 테스트
```

## 실행

```bash
npm install
cp .env.example .env   # SUPABASE_URL, SUPABASE_ANON_KEY 설정
npm start              # http://localhost:3001
```

> 온라인 기능 없이 게임만 띄우려면 `python3 -m http.server 4173`으로도 가능합니다.

## 검증

```bash
npm run lint
npm test
```

## 개발 원칙

- 프레임워크 없이 HTML / CSS / JavaScript 중심으로 유지
- 기능 추가보다 게임 감각과 반응성 우선
- 기록 저장은 로컬 우선, 온라인 기능은 선택적 확장
- 작은 단위 테스트와 최소 diff 리팩토링 지향
