# Laser Survival

HTML5 Canvas와 vanilla JavaScript로 만든 아케이드 서바이벌 게임.  
온라인 랭킹 백엔드(Express + SQLite)와 Endless / Crazy 모드 리더보드를 포함한다.

## 실행 방법

권장 방법은 API와 정적 파일을 함께 제공하는 서버를 실행하는 것이다.

```bash
cp .env.example .env
npm start
```

그 다음 브라우저에서 `http://localhost:3001`로 접속하면 된다.

## 환경변수 (.env)

서버는 프로젝트 루트의 `.env` / `.env.local`을 자동으로 읽는다.

예시:

```env
PORT=3001
LASER_DB_PATH=server/data/laser-survival.db
```

정적 프론트만 따로 띄우고 싶다면:

```bash
python3 -m http.server 4173
```

이 경우 프론트는 기본적으로 `http://localhost:3001/api` 백엔드를 찾는다.

## 온라인 기능

- 타이틀 화면에서 플레이어 이름 입력
- Endless / Crazy 모드 분리
- 게임오버 시 온라인 점수 제출
- 모드별 Top 20 리더보드
- 플레이어별 Endless / Crazy 최고기록 조회
- 테스트 모드 점수는 서버에서 랭킹 제외

## 서버 API

- `GET /api/health`
- `POST /api/scores`
- `GET /api/leaderboard?mode=endless&limit=20`
- `GET /api/player-best?playerName=ANON`

## 개발 원칙

- 프레임워크 없이 HTML, CSS, JavaScript만 사용
- 게임 렌더링은 Canvas API 사용
- 기록 저장은 IndexedDB 사용
- 서버는 Express + SQLite 사용
- 품질 검증은 ESLint + Node 테스트 사용

## 검증 명령

```bash
npm run lint
npm test
```
