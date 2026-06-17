// Vendor 번들 (esbuild) — CDN 대신 npm 의존성을 묶어 제공합니다.
// 테스트 환경(jsdom)에서는 외부 스크립트가 로드되지 않고 목이 주입되므로,
// 이미 전역이 있으면 덮어쓰지 않습니다(테스트 목 우선).
import { createClient } from '@supabase/supabase-js';
import { createIcons, icons } from 'lucide';

if (!window.supabase) window.supabase = { createClient };
if (!window.lucide) window.lucide = { createIcons: () => createIcons({ icons }) };
