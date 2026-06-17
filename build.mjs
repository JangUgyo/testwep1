// 빌드: 모듈 소스(src/app.js + 향후 분할 파일)를 단일 HTML(dist/index.html)로 합칩니다.
// 산출물은 지금까지 Vercel에 올리던 단일 파일과 동일한 형태이므로 배포 방식이 바뀌지 않습니다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MARKER = '/*@@APP_JS@@*/';

// 향후 app.js를 여러 모듈로 쪼개면 이 배열에 순서대로 추가하세요(전역 스코프 유지를 위해 단순 연결).
const SOURCES = ['app.js'];

const shell = readFileSync(join(__dirname, 'src', 'index.html'), 'utf8');
const appJs = SOURCES.map(f => readFileSync(join(__dirname, 'src', f), 'utf8')).join('\n');

if (!shell.includes(MARKER)) { console.error('빌드 실패: src/index.html에 ' + MARKER + ' 마커가 없습니다.'); process.exit(1); }

// replace에 함수를 써서 app.js 안의 $ 패턴이 치환문자로 오인되지 않게 합니다.
const out = shell.replace(MARKER, () => appJs);

mkdirSync(join(__dirname, 'dist'), { recursive: true });
writeFileSync(join(__dirname, 'dist', 'index.html'), out);
console.log('빌드 완료 → dist/index.html (' + out.length.toLocaleString() + ' bytes)');
