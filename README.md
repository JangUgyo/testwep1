# WorkSpace Pro

사내 통합 포털. **소스는 모듈로 관리하고, 배포 산출물은 단일 HTML 파일**로 빌드합니다.
지금까지 Vercel에 올리던 "파일 하나" 방식을 그대로 유지하면서, 깃허브에서 유지보수·자동 테스트가 가능하도록 구성했습니다.

## 구조

```
.
├── src/
│   ├── index.html      # HTML 셸 (CDN 스크립트 + 마커 /*@@APP_JS@@*/)
│   └── app.js          # 앱 로직 (현재 단일 모듈 — 점진적으로 분할 예정)
├── tests/
│   └── e2e.cjs         # jsdom 기반 E2E 테스트 (Supabase 목 포함) — 547 케이스
├── build.mjs           # 빌드: src → dist/index.html 로 합침
├── dist/               # 빌드 산출물 (git 제외, Vercel가 생성)
│   └── index.html      # ← 실제 배포 파일 (단일 HTML)
├── vercel.json         # Vercel 빌드/출력 설정
└── .github/workflows/ci.yml  # push·PR 마다 빌드+테스트 자동 실행
```

## 개발 / 빌드 / 테스트

```bash
npm install      # 최초 1회 (테스트용 jsdom 설치)
npm run build    # src → dist/index.html 생성
npm test         # 빌드 후 547개 테스트 실행
```

`dist/index.html`은 합쳐진 단일 파일이며, 더블클릭하거나 어떤 정적 호스팅에 올려도 동작합니다.

## 배포 (Vercel)

두 가지 방법 모두 가능합니다.

1. **깃허브 연결(권장):** 이 저장소를 Vercel 프로젝트에 연결하면, push 시 Vercel이 `npm run build`를 돌려 `dist/`를 서빙합니다(`vercel.json` 참고). 별도 업로드가 필요 없습니다.
2. **수동 업로드(기존 방식 유지):** 로컬에서 `npm run build` 후 생성된 `dist/index.html`을 기존처럼 올립니다.

## 모듈 점진 분리 방법

`app.js`는 화면의 `onclick="함수명()"` 핸들러가 전역 함수를 직접 부르는 구조라, **파일을 나눠 순서대로 이어 붙이는** 방식으로 모듈화합니다(전역 스코프 유지 → 동작 변화 없음). ESM `import`로 바꾸려면 모든 핸들러를 다시 배선해야 하므로 권장하지 않습니다.

분리 절차:
1. `src/app.js`에서 한 영역(예: 재고, 발주, 캘린더, 인증, 공통 유틸)을 잘라 `src/inventory.js` 등으로 옮깁니다.
2. `build.mjs`의 `SOURCES` 배열에 **의존성 순서대로** 파일명을 추가합니다(공통 유틸을 앞에).
3. `npm test`로 547개 테스트가 그대로 통과하는지 확인합니다.

권장 1차 경계: `common/utils → state → auth → 각 도메인(projects, documents, tickets, assets, inventory, trade, calendar) → bootstrap`.

## CI

`.github/workflows/ci.yml`이 `main` push와 모든 PR에서 빌드 + 547개 테스트를 실행합니다.
테스트가 깨지면 머지를 막도록 GitHub 브랜치 보호 규칙에 이 체크를 추가하면 좋습니다.

## 환경

- Node.js 20+
- 런타임 라이브러리는 CDN 로드(Tailwind, Chart.js, Lucide, Supabase 등) — 빌드에 번들링 없음
- 백엔드: Supabase (publishable 키는 클라이언트 공개용)
