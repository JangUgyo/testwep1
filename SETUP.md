# WorkSpace Pro — 새 GitHub · 새 Supabase 셋업 가이드

이 저장소를 **새 GitHub 저장소**와 **새 Supabase 프로젝트**에 올려 처음부터 테스트하는 절차입니다.

---

## 1. 데이터베이스 (Supabase) — 순서 중요

새 Supabase 프로젝트를 만든 뒤, **SQL Editor**에서 아래 순서로 실행하세요.

1. **`db/00-workspace-pro-db-full.sql`** 먼저 실행 — 전체 스키마(21개 테이블 + `apply_stock_move` 등).
   - 파일 안내대로 **"(8) 실시간 등록" 섹션만 빼고** 통째로 실행하세요.
   - 그다음 (8)의 `alter publication ... add table ...` 줄을 **한 줄씩** 실행하고, `already member` 메시지는 무시합니다.
2. **`db/phase1-inventory-receiving.sql`** 다음 실행 — 재고 고도화(발주 연계 · 미착/입고 · 평균단가 · 회계재고).
   - `po_receipts` 테이블, `inventory_items` 확장 컬럼(`avg_price`, `acct_flag` 등), RPC `record_po_receipt` · `set_inventory_acct`, 그리고 `po_receipts` 실시간 등록까지 포함(멱등).

> 이 두 파일은 모두 **"있으면 두고 없으면 생성"** 방식이라, 운영 중 다시 실행해도 데이터가 지워지지 않습니다.

실행 후 **Authentication → Providers**에서 이메일 로그인을 켜고, **Project Settings → API**의 `URL`과 `anon key`를 메모해 둡니다.

---

## 2. 앱 설정 (Supabase 연결 키)

`src/app/01-core-auth.js` 상단(또는 기존에 키를 넣던 위치)의 `SUPABASE_URL` / `SUPABASE_ANON_KEY` 를
새 프로젝트 값으로 교체한 뒤 빌드합니다. (기존 운영 중이던 키 교체 위치와 동일합니다.)

---

## 3. 빌드 (커밋 전 필수)

```bash
npm install esbuild@0.21.5 jsdom@29.1.1 --no-save
node build.mjs          # src/app/*.js + src/index.html → public/index.html, public/vendor.js
```

테스트(선택, 권장):

```bash
node tests/e2e.cjs                         # 단위/통합 (jsdom)
npm install tailwindcss@3.4.17 --no-save
node tests/responsive.cjs                  # 반응형 (Playwright, 9개 해상도)
```

---

## 4. GitHub 에 올릴 파일

새 저장소에 **저장소 전체**를 그대로 커밋하면 됩니다. 특히 다음이 반드시 포함돼야 합니다.

- `src/index.html`, `src/app/*.js` — 소스
- **`public/index.html`, `public/vendor.js`** — Vercel이 배포하는 결과물(빌드 후 최신본 커밋)
- `build.mjs`, `tests/`, `.github/workflows/ci.yml`
- `db/00-workspace-pro-db-full.sql`, `db/phase1-inventory-receiving.sql`
- `SETUP.md`

```bash
git init
git add .
git commit -m "WorkSpace Pro — 초기 셋업"
git branch -M main
git remote add origin https://github.com/<당신계정>/<새저장소>.git
git push -u origin main
```

---

## 5. Vercel 배포

- New Project → 방금 만든 GitHub 저장소 import.
- Framework Preset: **Other** (정적). Output: `public/` (저장소 루트에 `public/index.html`이 배포 대상).
- 배포 후, 포털에 **가장 먼저 가입하는 계정이 자동으로 시스템 관리자**가 됩니다. 동료 공유 전 먼저 가입하세요.

---

## 이번 버전에 새로 들어간 것

- **새 디자인 정체성(코발트)** + 사이드바 **아이콘 레일**(데스크톱, 접기/펼치기 · 헤더 토글 버튼 · 호버 툴팁, 환경설정은 브라우저에 저장).
- **⌘K / Ctrl+K 명령 팔레트** — 어디서든 화면 이동 · 빠른 작업(발주 작성 · 품목 등록 · 입고 처리 · 보고서 등록 등).
- **처리 대기(Action Inbox)** — 대시보드 상단에 재고경보 · 미착입고 · 결재대기 · 가입승인 · 오늘일정을 한 큐로 모음.
- 재고 **평균단가 · 회계재고**(목록/카드/상세 + 수동 회계지정), 문서 · 프로젝트 **모바일 카드화**.
