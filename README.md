# Laser Survival

HTML5 Canvas와 vanilla JavaScript로 만든 아케이드 서바이벌 게임.  
Supabase 기반 온라인 랭킹과 Endless / Crazy 모드 리더보드를 포함한다.

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
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

정적 프론트만 따로 띄우고 싶다면:

```bash
python3 -m http.server 4173
```

이 경우 프론트는 `app-config.js`를 제공받지 못하므로 온라인 랭킹은 비활성화된다.  
온라인 기능까지 쓰려면 `npm start`로 실행하는 것을 권장한다.

## Vercel 배포

이 프로젝트는 Vercel 배포를 위해 아래 파일을 포함한다:

- `vercel.json`
- `api/config.js`
- `api/health.js`

Vercel 환경변수에 다음 값을 넣으면 된다:

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

배포 후:
- `/api/config.js` 가 public Supabase config를 주입
- `/api/health` 가 환경설정 상태를 반환

## 온라인 기능

- 타이틀 화면에서 플레이어 이름 입력
- Endless / Crazy 모드 분리
- 게임오버 시 온라인 점수 제출
- 모드별 Top 20 리더보드
- 플레이어별 Endless / Crazy 최고기록 조회
- 테스트 모드 점수는 서버에서 랭킹 제외

## Supabase 설정

Supabase SQL Editor에서 아래 파일 내용을 실행:

```text
supabase/schema.sql
```

이 스키마는 다음을 만든다:
- `scores` 테이블
- 공개 읽기 / 검증된 삽입 RLS 정책
- `submit_score(...)` RPC
- `player_best(...)` RPC

## 로컬 서버 API

로컬 Express 서버는 점수 저장을 직접 하지 않고, 정적 파일과 공개 설정만 제공한다.

- `GET /api/health`
- `GET /app-config.js`

## 개발 원칙

- 프레임워크 없이 HTML, CSS, JavaScript만 사용
- 게임 렌더링은 Canvas API 사용
- 기록 저장은 IndexedDB 사용
- 온라인 랭킹은 Supabase 사용
- 품질 검증은 ESLint + Node 테스트 사용

## 검증 명령

```bash
npm run lint
npm test
```
