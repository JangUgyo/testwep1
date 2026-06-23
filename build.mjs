// 빌드: ① vendor(npm 의존성)를 esbuild로 public/vendor.js 로 번들
//      ② 앱 소스(src/*)를 단일 HTML(public/index.html)로 합침
// 산출물(public/index.html, public/vendor.js)은 커밋되어 Vercel이 "빌드 없이" 서빙합니다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MARKER = '/*@@APP_JS@@*/';

// app.js를 기능별 모듈로 분리 — 빌드 시 이 순서대로 단순 연결(전역 스코프 유지 → onclick 등 그대로 동작).
// 런타임 동작은 단일 파일과 100% 동일하며, 연결 결과는 분리 전 원본과 바이트 단위로 일치합니다.
const SOURCES = [
  'app/01-core-auth.js',       // 부트스트랩·지연로딩·initApp·인증(로그인/회원가입/세션)
  'app/02-data-migration.js',  // 데이터 버전/마이그레이션·loadAllData·resyncAllData
  'app/03-inventory.js',       // 재고·창고·실사·원장·분류/직급 옵션·재고 대시보드
  'app/04-trade-excel.js',     // 발주·견적·거래처·엑셀 입출력·발주↔재고 연동
  'app/05-realtime-render.js', // 실시간 구독·역할 UI·필터·달력·공지·문서 허브
  'app/06-projects-ux.js',     // UX(ESC/알림)·프로젝트 진척·페이지네이션·동시편집 보호
  'app/07-meetings-attach.js', // 주간 회의 일지·첨부 미리보기
  'app/08-dashboard-admin.js', // 대시보드 위젯·권한·사용자·동적기능·모달/토스트·a11y
  'app/09-inventory-receiving.js', // 발주 연계·미착/입고 현황·부분입고·평균단가·회계 자동분류
];

mkdirSync(join(__dirname, 'public'), { recursive: true });

// ① vendor 번들
await esbuild({
  entryPoints: [join(__dirname, 'src', 'vendor.js')],
  bundle: true, minify: true, format: 'iife',
  legalComments: 'none', target: ['es2019'],
  outfile: join(__dirname, 'public', 'vendor.js'),
});
const vendorBytes = readFileSync(join(__dirname, 'public', 'vendor.js')).length;

// ② 앱 인라인 합치기
const shell = readFileSync(join(__dirname, 'src', 'index.html'), 'utf8');
const appJs = SOURCES.map(f => readFileSync(join(__dirname, 'src', f), 'utf8')).join('\n');
if (!shell.includes(MARKER)) { console.error('빌드 실패: src/index.html에 ' + MARKER + ' 마커가 없습니다.'); process.exit(1); }
const out = shell.replace(MARKER, () => appJs); // 함수 치환: app.js 내 $ 패턴 오인 방지
writeFileSync(join(__dirname, 'public', 'index.html'), out);

console.log('빌드 완료 → public/index.html (' + out.length.toLocaleString() + ' bytes), public/vendor.js (' + vendorBytes.toLocaleString() + ' bytes)');
