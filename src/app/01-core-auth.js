        // ════════════════════════════════════════════════════════════════
        //  WorkSpace Pro — Supabase 연동 클라이언트
        //  (publishable 키는 브라우저에 공개되어도 안전 — 데이터는 RLS로 보호)
        // ════════════════════════════════════════════════════════════════
        const SUPABASE_URL = 'https://doxbobwlgwcuocrfdtez.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_jITajlme_6lZvA-wHzXLZg__w0-ktoT';
        const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // ── 무거운 라이브러리 지연 로딩(lazy-load) ───────────────────────
        const LIB_URLS = {
            chart: 'https://cdn.jsdelivr.net/npm/chart.js',
            mammoth: 'https://cdn.jsdelivr.net/npm/mammoth/mammoth.browser.min.js',
            xlsx: 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js',
            jszip: 'https://cdn.jsdelivr.net/npm/jszip/dist/jszip.min.js',
            docx: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.5/dist/docx-preview.min.js',
            pdfjs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
            pdfworker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
            exceljs: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
        };
        const _libCache = {};
        function loadScript(url) {
            if (_libCache[url]) return _libCache[url];
            _libCache[url] = new Promise((resolve, reject) => {
                try {
                    const s = document.createElement('script'); s.src = url; s.async = true;
                    s.onload = () => resolve(true);
                    s.onerror = () => reject(new Error('script load failed: ' + url));
                    document.head.appendChild(s);
                } catch (e) { reject(e); }
            });
            return _libCache[url];
        }
        async function ensureChart() { if (window.Chart) return; await loadScript(LIB_URLS.chart); }
        async function ensureXlsx() { if (window.XLSX) return; await loadScript(LIB_URLS.xlsx); }
        async function ensureExcelJS() { if (window.ExcelJS) return; await loadScript(LIB_URLS.exceljs); }
        async function ensureMammoth() { if (window.mammoth) return; await loadScript(LIB_URLS.mammoth); }
        async function ensureDocx() { if (window.docx && window.docx.renderAsync) return; if (!window.JSZip) await loadScript(LIB_URLS.jszip); await loadScript(LIB_URLS.docx); }
        async function ensurePdf() { if (window.pdfjsLib) return; await loadScript(LIB_URLS.pdfjs); try { if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = LIB_URLS.pdfworker; } catch (e) { } }

        // 전역 날짜 유틸리티
        function addDays(date, days) { const r = new Date(date); r.setDate(r.getDate() + days); return r; }
        function formatDate(date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        const STATE = {
            profile: { name: '', deptId: 'strategy', role: 'none' },
            currentUser: null,
            currentYear: 2026,
            currentMonth: 6,
            departments: [
                { id: 'ceo', name: '대표이사', color: 'border-slate-800 text-slate-900 bg-slate-100/70 hover:bg-slate-200/70', textTheme: 'text-slate-800 bg-slate-100 border-slate-400' },
                { id: 'south_cs', name: '남부CS', color: 'border-blue-500 text-blue-700 bg-blue-50/85 hover:bg-blue-100/85', textTheme: 'text-blue-700 bg-blue-50 border-blue-200' },
                { id: 'strategy', name: '미래전략기획실', color: 'border-purple-500 text-purple-700 bg-purple-50/85 hover:bg-purple-100/85', textTheme: 'text-purple-700 bg-purple-50 border-purple-200' },
                { id: 'hydrogen', name: '수소사업부', color: 'border-emerald-500 text-emerald-700 bg-emerald-50/85 hover:bg-emerald-100/85', textTheme: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                { id: 'rnd', name: 'R&D 센터', color: 'border-amber-500 text-amber-700 bg-amber-50/85 hover:bg-amber-100/85', textTheme: 'text-amber-700 bg-amber-50 border-amber-200' },
                { id: 'central_cs', name: '중부CS', color: 'border-cyan-500 text-cyan-700 bg-cyan-50/85 hover:bg-cyan-100/85', textTheme: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
                { id: 'sales', name: '영업팀', color: 'border-rose-500 text-rose-700 bg-rose-50/85 hover:bg-rose-100/85', textTheme: 'text-rose-700 bg-rose-50 border-rose-200' }
            ],
            visibility: { ceo: true, south_cs: true, strategy: true, hydrogen: true, rnd: true, central_cs: true, sales: true },
            dashboardNotice: { title: '공지', date: '', content: '' },
            events: [], projects: [], documents: [], weeklyMeetings: [], users: [], sites: [], tickets: [], assets: [], auditLogs: [], listPage: {},
            ganttScale: 'year', ganttAnchor: null,
            permissions: {},
            mailplug: {
                connected: false, provider: 'mailplug', domain: '', apiKey: '', oauthConnected: false,
                emails: [],
                mockDB: {
                    mailplug: [
                        { id: 1, sender: '김대표 (CEO)', subject: '6월 통합 경영 효율성 자문 일정 확정 통보', time: '10분 전', content: '대표이사 지시 사안으로 금주 금요일 전 부서 회의에 참석 바랍니다.' },
                        { id: 2, sender: '메일플러그 알림', subject: '[알림] 사내 결재대기 문서 연계 큐 정상 갱신', time: '1시간 전', content: 'WorkSpace Pro 결재 라인 연동 검증이 완료되었습니다.' }
                    ],
                    gmail: [
                        { id: 1, sender: 'Google Account', subject: '보안 로그인 알림: WorkSpace Pro 연동 완료', time: '방금 전', content: '포탈에서 사용자 계정의 Gmail 조작 권한 수여를 감지했습니다.' },
                        { id: 2, sender: '외부 파트너사', subject: '[공유] 글로벌 친환경 수소 기술 동향 보고서', time: '2시간 전', content: '구글 드라이브를 통해 보고 자료 파일을 인계합니다.' }
                    ],
                    outlook: [
                        { id: 1, sender: 'Microsoft Outlook', subject: 'Microsoft Graph 엔드포인트 연동 알림', time: '5분 전', content: '사내 인트라넷을 통한 사서함 동기화 세션이 생성되었습니다.' },
                        { id: 2, sender: '중부CS 기술연구팀', subject: '[일정] 설비 정기 무결성 검증 피드백 송부', time: '3시간 전', content: '차세대 수소 개질기 안정성 등급 보고서를 첨부합니다.' }
                    ],
                    custom_imap: [
                        { id: 1, sender: 'POSTMASTER', subject: '보안 IMAP/SMTP 자체 사서함 보안 접속 통과', time: '1분 전', content: 'SSL/TLS 암호화 레이어를 통하여 수발신이 원활히 동기화 중입니다.' },
                        { id: 2, sender: '보안 감사관', subject: '[경고] 허용되지 않은 이메일 대량 발송 필터링 결과', time: '4시간 전', content: '시스템 보안 로그 원장을 참고하시어 사후 조치를 수행해 주십시오.' }
                    ]
                }
            },
            customFeatures: [],
            currentCustomId: null,
            currentTab: 'dashboard',
            uploadedDocFile: null,
            uploadedFeatureHtml: null,
            currentProgressSubView: 'board',
            maintenance: {
                'dashboard': false, 'calendar': false, 'documents': false, 'documents-pending': false,
                'documents-archive': false, 'mail-integration': false, 'management-progress': false,
                'management-stats': false, 'management-logs': false, 'weekly-meeting': false, 'field-support': false, 'assets': false, 'inventory': false, 'trade': false
            },
            meetingUploadedImg: '', meetingUploadedFileName: '', meetingUploadedFile: null
        };

        window.addEventListener('DOMContentLoaded', () => { initApp(); });

        async function initApp() {
            lucide.createIcons();
            initTheme();
            updateOnlineStatus();
            window.addEventListener('online', () => { updateOnlineStatus(); showToast('연결 복구', '네트워크에 다시 연결되었습니다.'); });
            window.addEventListener('offline', () => { updateOnlineStatus(); });
            populateHeaderSelects();
            reloadTaxonomy();
            renderFilters();
            renderDeptOptions();
            renderCalendar();
            updateProfileUI();
            try {
                const { data: { session } } = await sb.auth.getSession();
                if (session && session.user) { await onAuthed(session.user); }
                else { showGateway(); }
            } catch (e) { console.error(e); showGateway(); }
            // 관리자 화면에 있을 때 신규 가입 신청을 주기적으로 자동 반영 (실시간 느낌)
            setInterval(adminPoll, 15000);
        }

        // ── 인증(로그인/회원가입/세션) ───────────────────────────────────
        function showGateway() { const g = document.getElementById('auth-gateway-overlay'); if (g) g.classList.remove('hidden'); }
        function hideGateway() { const g = document.getElementById('auth-gateway-overlay'); if (g) g.classList.add('hidden'); }

        async function fetchProfile(id) {
            const { data, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
            if (error) { console.error(error); return null; }
            return data;
        }

        async function onAuthed(user) {
            const prof = await fetchProfile(user.id);
            if (!prof) { showToast('계정 확인 불가', '프로필 정보를 찾을 수 없습니다. 관리자에게 문의하세요.'); await sb.auth.signOut(); showGateway(); return; }
            if (!prof.approved) { showToast('승인 대기', '시스템 관리자의 가입 승인 후 이용할 수 있습니다.'); await sb.auth.signOut(); showGateway(); return; }
            STATE.currentUser = { id: user.id, email: user.email || prof.email || '', name: prof.name, deptId: prof.dept_id, role: prof.role, position: prof.position, approved: true };
            STATE.profile = { name: prof.name, deptId: prof.dept_id, role: prof.role };
            hideGateway();
            refreshRoleScopedUI();
            updateProfileUI();
            await loadAllData();
            setupRealtime();
            switchTab('dashboard');
            showToast('접속 승인', `${prof.name} 님 환영합니다.`);
        }

        async function handleUserLogin(e) {
            e.preventDefault();
            const email = document.getElementById('login-id').value.trim();
            const pw = document.getElementById('login-password').value;
            if (!email || !pw) { showToast('입력 필요', '이메일과 비밀번호를 입력하세요.'); return; }
            const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
            if (error) { showToast('접속 거부', '이메일 또는 비밀번호가 올바르지 않습니다.'); return; }
            await onAuthed(data.user);
        }

        async function handleUserSignup(e) {
            e.preventDefault();
            const email = document.getElementById('signup-id').value.trim();
            const pw = document.getElementById('signup-password').value;
            const name = document.getElementById('signup-name').value.trim();
            const pos = document.getElementById('signup-position').value;
            const dept = document.getElementById('signup-dept').value;
            if (!email || !pw || !name) { showToast('입력 필요', '이메일/비밀번호/성명을 입력하세요.'); return; }
            if (pw.length < 6) { showToast('비밀번호 길이', '비밀번호는 6자 이상이어야 합니다.'); return; }
            const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { name, position: pos, dept_id: dept } } });
            if (error) { showToast('가입 실패', error.message); return; }

            let approved = false;
            if (data && data.user) {
                for (let i = 0; i < 4 && !approved; i++) {
                    const prof = await fetchProfile(data.user.id);
                    if (prof) { approved = prof.approved; break; }
                    await new Promise(r => setTimeout(r, 400));
                }
            }
            if (approved && data.session) {
                showToast('가입 완료', '최초 가입자 — 시스템 관리자 계정으로 접속합니다.');
                await onAuthed(data.user);
            } else {
                if (data && data.session) await sb.auth.signOut();
                showToast('신청 완료', '가입 신청이 접수되었습니다. 관리자 승인 후 로그인하세요.');
                document.getElementById('signup-id').value = '';
                document.getElementById('signup-password').value = '';
                document.getElementById('signup-name').value = '';
                switchAuthTab('login');
            }
        }

        async function handleUserLogout() {
            if (STATE._rt) { try { sb.removeChannel(STATE._rt); } catch (e) {} STATE._rt = null; }
            await sb.auth.signOut();
            STATE.currentUser = null;
            STATE.profile = { name: '', deptId: 'strategy', role: 'none' };
            showGateway();
            showToast('로그아웃', '보안 접속 세션이 종료되었습니다.');
        }
