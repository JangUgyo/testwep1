/*
 * 반응형 CI 테스트 (Playwright + 컴파일된 Tailwind)
 * ─────────────────────────────────────────────────────────────
 * 그동안 매번 일회용 스크립트로 확인하던 항목을 영구 자동화한다.
 *   1) 해상도별 가로 오버플로우 0px (Mobile~4K)
 *   2) 표 → 모바일 카드화 전환 (모바일=카드 / 데스크톱=표)
 *   3) 우측 드로어 좌측 "<" 확장 탭이 잘리지 않고 보이며 클릭 가능
 *
 * 실행: node tests/responsive.cjs   (또는 npm run test:responsive)
 * 종료코드: 통과 0 / 실패 1 / 의존성 미설치 시 0(건너뜀, CI에서는 설치되어 실제 실행)
 *
 * 의존성: playwright(+chromium), tailwindcss — 모두 devDependencies.
 *  - 로컬에 없으면 명확한 안내와 함께 건너뛴다(소프트 스킵).
 *  - CI 워크플로에서는 둘 다 설치되므로 항상 실제 검증이 돈다.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const PUB = path.join(REPO, 'public');
const INDEX = path.join(PUB, 'index.html');

// ── Playwright 로드 (로컬 devDep → 전역 설치 경로 순서로 시도) ──
function chromiumCandidates() {
  const mods = [];
  const tryReq = (p) => { try { const c = require(p).chromium; if (c) mods.push(c); } catch (e) {} };
  // 로컬 devDep(주로 CI) → 알려진 전역 설치 경로 순으로 후보 수집
  tryReq('playwright');
  tryReq(path.join(os.homedir(), '.npm-global/lib/node_modules/playwright'));
  tryReq('/home/claude/.npm-global/lib/node_modules/playwright');
  tryReq('/usr/local/lib/node_modules/playwright');
  return mods;
}
async function launchAny() {
  for (const chromium of chromiumCandidates()) {
    try { return await chromium.launch(); } catch (e) {}
  }
  return null;
}

// ── 현재 빌드 산출물 기준으로 Tailwind CSS를 컴파일 (런타임 CDN 대신 주입용) ──
function buildTailwind() {
  const cacheDir = path.join(REPO, 'tests', '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const inputCss = path.join(cacheDir, 'tw-input.css');
  const cfg = path.join(cacheDir, 'tw.config.cjs');
  const outCss = path.join(cacheDir, 'tw-built.css');
  fs.writeFileSync(inputCss, '@tailwind base;@tailwind components;@tailwind utilities;');
  fs.writeFileSync(cfg, `module.exports={content:['${INDEX.replace(/\\/g, '/')}'],darkMode:'class',theme:{extend:{}}};`);
  execSync(`npx tailwindcss -c "${cfg}" -i "${inputCss}" -o "${outCss}" --minify`, { cwd: REPO, stdio: 'ignore' });
  return fs.readFileSync(outCss, 'utf8');
}

// ── public/ 정적 서버 (외부 요청은 라우트에서 차단) ──
function startServer() {
  const server = http.createServer((q, r) => {
    let p = q.url.split('?')[0];
    if (p === '/') p = '/index.html';
    const f = path.join(PUB, p);
    if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/html' });
    r.end(fs.readFileSync(f));
  });
  return new Promise((res) => server.listen(0, () => res(server)));
}

const VIEWPORTS = [
  { name: 'iPhoneSE', w: 320, h: 568, mobile: true },
  { name: 'GalaxyS', w: 360, h: 800, mobile: true },
  { name: 'Mobile', w: 375, h: 812, mobile: true },
  { name: 'Pixel', w: 412, h: 915, mobile: true },
  { name: 'Tablet', w: 768, h: 1024 },
  { name: 'Laptop', w: 1024, h: 768 },
  { name: 'FHD', w: 1920, h: 1080 },
  { name: 'QHD', w: 2560, h: 1440 },
  { name: '4K', w: 3840, h: 2160 },
];

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond) { if (cond) { pass++; console.log('PASS :', name); } else { fail++; fails.push(name); console.log('FAIL :', name); } }

(async () => {
  const browser = await launchAny();
  if (!browser) {
    console.log('[responsive] 실행 가능한 Playwright/Chromium 없음 — 로컬 건너뜀 (CI에서는 설치되어 실행됩니다).');
    process.exit(0);
  }
  let TW;
  try { TW = buildTailwind(); }
  catch (e) {
    console.log('[responsive] tailwindcss 컴파일 불가 — 건너뜀:', String(e).split('\n')[0]);
    await browser.close();
    process.exit(0);
  }

  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  async function newPage(w, h) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const pg = await ctx.newPage();
    // 외부(CDN/Supabase) 요청 차단 — 로컬 자원만 허용
    await pg.route('**/*', (rt) => rt.request().url().startsWith(base) ? rt.continue() : rt.abort());
    try { await pg.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 20000 }); } catch (e) {}
    await pg.addStyleTag({ content: TW });
    await pg.evaluate(() => { const o = document.getElementById('auth-gateway-overlay'); if (o) o.remove(); });
    await pg.waitForTimeout(150);
    return { ctx, pg };
  }

  // (1) 해상도별 오버플로우 + (2) 카드화 전환
  for (const v of VIEWPORTS) {
    const { ctx, pg } = await newPage(v.w, v.h);
    // 최악 케이스(로그인 관리자: 긴 인증 배지 + 점검 버튼)에서도 오버플로우/제목 가림이 없어야 함
    await pg.evaluate(() => {
      const rb = document.getElementById('header-user-role-badge'); if (rb) rb.textContent = '시스템 마스터 관리자';
      const amc = document.getElementById('admin-maintenance-control'); if (amc) amc.classList.remove('hidden');
    });
    await pg.waitForTimeout(120);
    const m = await pg.evaluate(() => {
      const de = document.documentElement;
      const wrapDisp = (bodyId) => {
        const el = document.getElementById(bodyId); if (!el) return 'n/a';
        const wrap = el.closest('div.hidden'); return wrap ? getComputedStyle(wrap).display : 'n/a';
      };
      const disp = (id) => { const el = document.getElementById(id); return el ? getComputedStyle(el).display : 'n/a'; };
      const t = document.getElementById('view-title'); const tw = t ? t.getBoundingClientRect().width : 0;
      return {
        ov: de.scrollWidth - de.clientWidth, titleW: Math.round(tw),
        ticketTable: wrapDisp('ticket-list-body'), ticketCard: disp('ticket-card-list'),
        assetTable: wrapDisp('asset-list-body'), assetCard: disp('asset-card-list'),
      };
    });
    ok(`[${v.name} ${v.w}] 가로 오버플로우 없음(관리자 헤더 포함)`, m.ov <= 1);
    ok(`[${v.name} ${v.w}] 페이지 제목 표시(잘림 방지)`, m.titleW >= 40);
    if (v.mobile) {
      ok(`[${v.name}] 티켓 표 숨김·카드 표시`, m.ticketTable === 'none' && m.ticketCard === 'grid');
      ok(`[${v.name}] 설비 표 숨김·카드 표시`, m.assetTable === 'none' && m.assetCard === 'grid');
    } else {
      ok(`[${v.name}] 티켓 표 표시·카드 숨김`, m.ticketTable !== 'none' && m.ticketCard === 'none');
      ok(`[${v.name}] 설비 표 표시·카드 숨김`, m.assetTable !== 'none' && m.assetCard === 'none');
    }
    await ctx.close();
  }

  // (3) 우측 드로어 좌측 "<" 확장 탭 — 데스크톱에서 보이고 클릭 가능
  {
    const { ctx, pg } = await newPage(1440, 900);
    await pg.evaluate(() => window.openModal('ticket-detail-modal'));
    await pg.waitForTimeout(550);
    const d = await pg.evaluate(() => {
      const m = document.getElementById('ticket-detail-modal');
      const panel = m.querySelector(':scope > div');
      const tab = panel ? panel.querySelector('.drawer-expand-tab') : null;
      if (!tab) return { exists: false };
      const tr = tab.getBoundingClientRect();
      const onScreen = tr.left >= 0 && tr.right <= window.innerWidth && tr.top >= 0 && tr.bottom <= window.innerHeight && tr.width > 0;
      const hit = document.elementFromPoint(Math.round(tr.left + tr.width / 2), Math.round(tr.top + tr.height / 2));
      const clickable = !!(hit && (hit.classList.contains('drawer-expand-tab') || hit.closest('.drawer-expand-tab')));
      const centered = Math.abs((tr.top + tr.height / 2) - window.innerHeight / 2) < 30;
      return { exists: true, onScreen, clickable, centered };
    });
    ok('[Drawer] 확장 탭 존재', d.exists);
    ok('[Drawer] 탭이 화면 안에 보임(잘리지 않음)', d.exists && d.onScreen);
    ok('[Drawer] 탭 클릭 가능', d.exists && d.clickable);
    ok('[Drawer] 탭이 세로 중앙 정렬', d.exists && d.centered);
    // 클릭 시 전체폭 확장 확인
    if (d.exists) {
      await pg.evaluate(() => document.querySelector('#ticket-detail-modal .drawer-expand-tab').click());
      await pg.waitForTimeout(450);
      const full = await pg.evaluate(() => {
        const panel = document.querySelector('#ticket-detail-modal > div');
        return panel.classList.contains('drawer-full') && Math.round(panel.getBoundingClientRect().width) >= window.innerWidth - 2;
      });
      ok('[Drawer] 탭 클릭 시 전체폭 확장', full);
    }
    await ctx.close();
  }

  await browser.close();
  server.close();
  try { fs.rmSync(path.join(REPO, 'tests', '.cache'), { recursive: true, force: true }); } catch (e) {}

  console.log(`\n반응형 결과 — Total ${pass + fail}, Passed ${pass}, Failed ${fail}`);
  if (fail) { console.log('실패:', fails.join(' | ')); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error('[responsive] 실행 오류:', e); process.exit(1); });
