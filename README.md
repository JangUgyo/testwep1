# WorkSpace Pro

사내 통합 포털. **소스는 모듈로 관리(esbuild 번들)하고, 배포 산출물은 정적 파일**(`public/`)입니다.
**Vercel은 빌드를 돌리지 않고 커밋된 `public/`을 그대로 서빙**하므로, 빌드 환경 문제로 배포가 깨지지 않습니다.

기준 UI인 `workspace-pro (1).html`의 메뉴·색상·레이아웃을 제품 구조로 반영했고,
기존 Supabase 기능에 공지사항·투두리스트·업무일지·사내 메신저·회계 재고 화면을 통합했습니다.

## 구조

```
.
├── src/
│   ├── index.html       # HTML 셸 (vendor.js + Tailwind CDN + 마커 /*@@APP_JS@@*/)
│   ├── app/             # 기능별 전역 모듈(빌드 시 순서대로 결합)
│   └── vendor.js        # npm 의존성 진입점 (supabase, lucide) → esbuild 번들
├── public/              # ← 배포 산출물 (커밋함, Vercel이 그대로 서빙)
│   ├── index.html       #    앱 단일 HTML
│   └── vendor.js        #    esbuild 번들 (supabase + lucide)
├── tests/
│   └── e2e.cjs          # jsdom E2E 테스트 (Supabase 목 포함) — 640+ 케이스
├── build.mjs            # 빌드: src → public/index.html 로 합침
├── vercel.json          # Vercel: 빌드 없이 public/ 정적 서빙
└── .github/workflows/ci.yml  # push·PR 마다 빌드+최신성검사+테스트
```

## 핵심 워크플로

`src/`를 수정하면 → **빌드해서 `public/index.html`을 갱신하고 함께 커밋**합니다.

```bash
npm install      # 최초 1회 (테스트용 jsdom)
npm run build    # esbuild(vendor) + 앱 인라인 → public/ 재생성
npm test         # 빌드 후 547개 테스트
git add -A && git commit -m "..."   # src 와 public/index.html 같이 커밋
```

> CI가 "public/index.html이 최신인지"를 검사하므로, 빌드 후 커밋을 빠뜨리면 PR이 막힙니다.

## 배포 (Vercel) — 빌드 없음

`vercel.json`에 `buildCommand: ""`, `outputDirectory: "public"`로 지정되어 있어,
Vercel은 **아무 빌드도 하지 않고 커밋된 `public/index.html`을 그대로 서빙**합니다.
저장소를 Vercel 프로젝트에 연결하고 push만 하면 됩니다. (기존처럼 `public/index.html`을 수동 업로드해도 됩니다.)

## 화면 구조

- 워크스페이스: 대시보드, 공지사항, 캘린더, 프로젝트, 투두리스트, 업무일지, 사내 메신저
- 현장 운영: 현장 AS, 설비·점검, 일반 재고, 회계 재고, 발주·견적
- 문서·결재: 결재 대기함, 보고서 관리, 승인 완료 보관함
- 시스템 관리: 권한·조직 관리, 보안 감사 로그

## CI

`.github/workflows/ci.yml`이 `main` push·모든 PR에서 ① 빌드 ② `public/index.html` 최신성 검사 ③ 547개 테스트를 실행합니다.
GitHub 브랜치 보호 규칙에 이 체크를 추가하면 테스트 실패·산출물 누락 변경의 머지를 막을 수 있습니다.

## 환경

- Node.js 20+
- supabase·lucide: **npm + esbuild 번들**(`public/vendor.js`)
- Tailwind: CDN(Play) — 빌드 전환은 후속 단계
- Chart.js·xlsx·exceljs·mammoth·jszip·docx·pdf.js: 필요 시 CDN 지연 로드(`loadScript`)
- 의존성을 바꾸면 `npm run build` 후 `public/vendor.js`도 함께 커밋하세요
- 백엔드: Supabase (publishable 키는 클라이언트 공개용, RLS 필수)
- 부서 원장: `departments` 테이블에 기존 7개 부서 코드를 유지
