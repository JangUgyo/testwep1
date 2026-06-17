// 빌드: ① vendor(npm 의존성)를 esbuild로 public/vendor.js 로 번들
//      ② 앱 소스(src/*)를 단일 HTML(public/index.html)로 합침
// 산출물(public/index.html, public/vendor.js)은 커밋되어 Vercel이 "빌드 없이" 서빙합니다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MARKER = '/*@@APP_JS@@*/';

// 향후 app.js를 여러 모듈로 쪼개면 의존성 순서대로 추가(전역 스코프 유지 → 단순 연결).
const SOURCES = ['app.js'];

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
