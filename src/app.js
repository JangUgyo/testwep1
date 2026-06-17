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
            try { if (localStorage.getItem('wsp_sidebar_collapsed') === '1') document.body.classList.add('sidebar-collapsed'); } catch (e) {}
            updateSidebarHandle();
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

        // ── 데이터 로딩 (Supabase → STATE 캐시) ──────────────────────────
        // ════════════ 데이터 버전 / 마이그레이션 ════════════
        // ════════════ 데이터 버전 / 마이그레이션 (★ 모든 데이터 업그레이드는 여기 한 곳에서) ★ ════════════
        // 사용법: 스키마(필드)를 추가하면 (1) ENTITY_DEFAULTS 에 기본값을 1줄 추가하고,
        //         (2) DB 백필이 필요하면 MIGRATIONS 에 단계를 1개 추가한 뒤 APP_DATA_VERSION 을 올린다.
        //         → 옛 데이터는 자동으로 신버전과 호환·보정된다.
        const APP_DATA_VERSION = 3;
        function appDataVersion() { return APP_DATA_VERSION; }
        // 레코드 정규화 일원화: 신버전 필드가 없는 옛 레코드도 한 곳에서 기본값을 채워 호환 보장
        const ENTITY_DEFAULTS = {
            ticket: { id: null, customer: '', site: '', equipment: '', issue: '', urgency: 'normal', assignee: '', status: 'received', result: '', deptId: '', author: '', photos: [], createdAt: '', assigneeId: '' },
            asset: { id: null, name: '', model: '', customer: '', site: '', pmCycle: 0, lastPm: '', notes: '', assignee: '', position: '', deptId: '', assigneeId: '' },
            completionReport: { id: null, ticketId: null, assetId: null, workDate: '', worker: '', workType: '', content: '', parts: '', result: '', deptId: '', author: '', createdAt: '' }
        };
        function normalizeRecord(entity, obj) {
            const def = ENTITY_DEFAULTS[entity]; if (!def) return obj || {};
            const out = Object.assign({}, def, obj || {});
            for (const k in def) { if (Array.isArray(def[k]) && !Array.isArray(out[k])) out[k] = []; }
            return out;
        }
        function normalizeList(entity, arr) { return (arr || []).map(o => normalizeRecord(entity, o)); }
        const MIGRATIONS = [
            { version: 1, name: '기본 입·출고 유형 보정', run: async () => {
                if (STATE.invOptionsMissing) return;
                const adds = [];
                if (!((STATE.invOptions.move_in || []).length)) adds.push({ kind: 'move_in', value: '구매입고' });
                if (!((STATE.invOptions.move_out || []).length)) adds.push({ kind: 'move_out', value: '폐기' });
                if (adds.length) { await sb.from('inventory_options').insert(adds); await reloadInventoryOptions(); }
            } },
            { version: 2, name: '기존 품목 분류·단위·품목명 옵션 등록', run: async () => {
                if (STATE.invOptionsMissing) return;
                await ensureImportOptions((STATE.inventory || []).map(i => ({ category: i.category, unit: i.unit, name: i.name })));
            } },
            { version: 3, name: '직급(taxonomy) 기본값 보정', run: async () => {
                if (STATE.taxonomyMissing) return;
                if (!(((STATE.taxonomy || {}).position) || []).length) {
                    try { await sb.from('taxonomy_options').insert(['대표이사', '부서장', '팀장', '사원'].map((v, i) => ({ category: 'position', value: v, sort_order: i }))); await reloadTaxonomy(); } catch (e) {}
                }
            } }
        ];
        async function persistDataVersion() { try { await sb.from('app_settings').upsert({ key: 'data_version', value: APP_DATA_VERSION, updated_at: new Date().toISOString() }); } catch (e) { } }
        function updateDataVersionBadge() {
            const el = document.getElementById('data-version-badge'); if (!el) return;
            const cur = Number(STATE.dataVersion || 0);
            el.textContent = cur >= APP_DATA_VERSION ? `최신 v${APP_DATA_VERSION}` : `현재 v${cur} → 최신 v${APP_DATA_VERSION}`;
            el.className = `px-2 py-0.5 rounded-md text-[11px] font-bold border ${cur >= APP_DATA_VERSION ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`;
        }
        async function runMigrations() {
            if (!STATE.profile || STATE.profile.role !== 'admin') return;
            const cur = Number(STATE.dataVersion || 0);
            if (cur >= APP_DATA_VERSION) return;
            const pending = MIGRATIONS.filter(m => m.version > cur).sort((a, b) => a.version - b.version);
            for (const m of pending) { try { await m.run(); } catch (e) { console.warn('migration failed:', m.name, e); return; } }
            STATE.dataVersion = APP_DATA_VERSION;
            await persistDataVersion();
            updateDataVersionBadge();
        }
        async function repairData() {
            if (!STATE.profile || STATE.profile.role !== 'admin') { showToast('권한 없음', '데이터 보정은 관리자만 가능합니다.'); return; }
            for (const m of MIGRATIONS) { try { await m.run(); } catch (e) { } }
            STATE.dataVersion = APP_DATA_VERSION;
            await persistDataVersion();
            updateDataVersionBadge();
            showToast('점검 완료', `데이터 구조를 최신(v${APP_DATA_VERSION})으로 보정했습니다.`);
        }
        async function loadAllData() {
            await Promise.all([reloadEvents(), reloadProjects(), reloadDocuments(), reloadMeetings(), reloadSettings(), reloadProfiles(), reloadSites(), reloadTickets(), reloadAssets(), reloadInventory(), reloadStockMoves(), reloadInventoryOptions(), reloadTrade(), reloadPartners(), reloadWarehouses(), reloadInventoryStock(), reloadTaxonomy(), reloadCompletionReports()]);
            await runMigrations();
            updateDataVersionBadge();
            renderCalendar(); renderDocuments(); renderDashboardNotice(); renderDashboardWidgets(); enhanceA11y(document);
        }
        async function reloadEvents() {
            const { data } = await sb.from('events').select('*').order('start_date', { ascending: true });
            STATE.events = (data || []).map(r => ({ id: r.id, deptId: r.dept_id, title: r.title, startDate: r.start_date, endDate: r.end_date, site: r.site || '' }));
            STATE.events.forEach(e => { if (STATE.visibility[e.deptId] === undefined) STATE.visibility[e.deptId] = true; });
        }
        async function reloadSites() {
            const { data } = await sb.from('sites').select('*').order('name', { ascending: true });
            STATE.sites = (data || []).map(r => ({ id: r.id, name: r.name }));
        }
        async function reloadProjects() {
            const { data } = await sb.from('projects').select('*').order('id', { ascending: false });
            STATE.projects = (data || []).map(r => ({ id: r.id, title: r.title, deptId: r.dept_id, progress: r.progress, status: r.status, startDate: r.start_date, endDate: r.end_date, desc: r.descr, filePath: r.file_path, fileName: r.file_name, fileMime: r.file_mime, items: Array.isArray(r.items) ? r.items : [] }));
        }
        async function reloadDocuments() {
            const { data } = await sb.from('documents').select('*').order('id', { ascending: false }).limit(1000);
            STATE.documents = (data || []).map(r => ({ id: r.id, title: r.title, deptId: r.dept_id, author: r.author, date: r.doc_date, fileType: r.file_type, fileSize: r.file_size, storagePath: r.storage_path, fileMime: r.file_mime, status: r.status || 'approved', rejectReason: r.reject_reason || '', approver: r.approver || '', approvedAt: r.approved_at || '', approvers: Array.isArray(r.approvers) ? r.approvers : [], viewers: Array.isArray(r.viewers) ? r.viewers : [] }));
        }
        async function reloadTickets() {
            try {
                const { data, error } = await sb.from('tickets').select('*').order('id', { ascending: false }).limit(1000);
                if (error) { STATE.ticketsTableMissing = true; STATE.tickets = []; return; }
                STATE.ticketsTableMissing = false;
                STATE.tickets = normalizeList('ticket', (data || []).map(r => ({ id: r.id, customer: r.customer, site: r.site, equipment: r.equipment, issue: r.issue, urgency: r.urgency || 'normal', assignee: r.assignee, status: r.status || 'received', result: r.result, deptId: r.dept_id, author: r.author, photos: Array.isArray(r.photos) ? r.photos : [], createdAt: r.created_at, assigneeId: r.assignee_id || '' })));
            } catch (e) { STATE.ticketsTableMissing = true; STATE.tickets = []; }
        }
        async function reloadMeetings() {
            const { data } = await sb.from('weekly_meetings').select('*').order('id', { ascending: false });
            STATE.weeklyMeetings = (data || []).map(r => ({ id: r.id, deptId: r.dept_id, week: r.week, author: r.author, date: r.meet_date, content: r.content, image: r.image, fileName: r.file_name, filePath: r.file_path, fileMime: r.file_mime, title: r.title, decisions: r.decisions, actionItems: r.action_items, nextPlan: r.next_plan, days: Array.isArray(r.days) ? r.days : [] }));
        }
        async function reloadSettings() {
            const { data } = await sb.from('app_settings').select('*');
            STATE.company = STATE.company || Object.assign({}, DEFAULT_COMPANY);
            (data || []).forEach(row => {
                if (row.key === 'dashboard_notice') STATE.dashboardNotice = row.value;
                else if (row.key === 'permissions') STATE.permissions = row.value;
                else if (row.key === 'custom_features') STATE.customFeatures = Array.isArray(row.value) ? row.value : [];
                else if (row.key === 'maintenance' && row.value && typeof row.value === 'object') STATE.maintenance = Object.assign(STATE.maintenance, row.value);
                else if (row.key === 'company_profile' && row.value && typeof row.value === 'object') STATE.company = Object.assign({}, DEFAULT_COMPANY, row.value);
                else if (row.key === 'data_version') STATE.dataVersion = Number(row.value) || 0;
            });
            renderCustomFeaturesMenu();
        }
        async function reloadProfiles() {
            const { data } = await sb.from('profiles').select('*').order('created_at', { ascending: true });
            STATE.users = (data || []).map(r => ({ id: r.id, email: r.email || '', name: r.name, deptId: r.dept_id, role: r.role, position: r.position, approved: r.approved }));
        }

        async function adminPoll() {
            if (STATE.profile.role === 'admin' && STATE.currentTab === 'management-stats' && STATE.currentUser) {
                await reloadProfiles(); renderPendingUsers(); renderActiveUsers();
            }
        }

        // ── 실시간 동기화 (Supabase Realtime) ────────────────────────────
        // ════════════ 재고 관리 ════════════
        function fmtNum(n) { n = Number(n || 0); return (Math.round(n * 100) / 100).toLocaleString('ko-KR'); }
        function canManageInventory(it) { return STATE.profile.role === 'admin' || (it && it.deptId === STATE.profile.deptId); }
        function isLowStock(it) { return Number(it.safeStock) > 0 && Number(it.stock) <= Number(it.safeStock); }
        // ════════════ 창고 관리 + 창고별 재고 ════════════
        async function reloadWarehouses() {
            const { data, error } = await sb.from('warehouses').select('*').order('id', { ascending: true }).limit(500);
            if (error) { STATE.warehousesMissing = true; STATE.warehouses = []; return; }
            STATE.warehousesMissing = false;
            STATE.warehouses = (data || []).map(r => ({ id: r.id, name: r.name, code: r.code || '', location: r.location || '', notes: r.notes || '' }));
        }
        async function reloadInventoryStock() {
            const { data, error } = await fetchAllPaged(() => sb.from('inventory_stock').select('*').order('item_id', { ascending: true }));
            if (error) { STATE.invStock = {}; return; }
            const map = {};
            (data || []).forEach(r => { (map[r.item_id] = map[r.item_id] || {})[r.warehouse_id] = Number(r.qty) || 0; });
            STATE.invStock = map;
        }
        function itemWhQty(itemId, whId) { return ((STATE.invStock || {})[itemId] || {})[whId] || 0; }
        function defaultWarehouseId() { return (STATE.warehouses && STATE.warehouses[0]) ? STATE.warehouses[0].id : null; }
        function warehouseName(id) { const w = (STATE.warehouses || []).find(x => String(x.id) === String(id)); return w ? w.name : ('창고#' + id); }
        function fillWarehouseSelect(id, cur) {
            const el = document.getElementById(id); if (!el) return;
            el.innerHTML = (STATE.warehouses || []).map(w => `<option value="${w.id}">${esc(w.name)}${w.code ? ' (' + esc(w.code) + ')' : ''}</option>`).join('');
            if (cur != null) el.value = String(cur);
        }
        function populateInventoryWarehouseFilter() {
            const el = document.getElementById('inventory-filter-wh'); if (!el) return;
            const keep = el.value || 'all';
            el.innerHTML = `<option value="all">전체 창고</option>` + (STATE.warehouses || []).map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('');
            el.value = [...el.options].some(o => o.value === keep) ? keep : 'all';
        }
        function openWarehouseManager() {
            if (STATE.warehousesMissing) { showToast('준비 필요', '창고 테이블(warehouses) 생성 SQL을 먼저 실행하세요.'); return; }
            resetWarehouseForm(); renderWarehouseList(); openModal('warehouse-modal');
        }
        function renderWarehouseList() {
            const wrap = document.getElementById('warehouse-list'); if (!wrap) return;
            const list = STATE.warehouses || [];
            if (!list.length) { wrap.innerHTML = `<div class="wsp-empty">등록된 창고가 없습니다.</div>`; return; }
            wrap.innerHTML = list.map(w => {
                const kinds = Object.keys(STATE.invStock || {}).filter(iid => ((STATE.invStock[iid] || {})[w.id] || 0) > 0).length;
                return `<div class="flex items-start justify-between gap-2 px-3 py-2 border border-slate-200 rounded-xl">
                    <div class="min-w-0"><div class="font-bold text-slate-800 text-sm">${esc(w.name)} ${w.code ? `<span class="text-[11px] text-amber-600 font-mono">${esc(w.code)}</span>` : ''}</div><div class="text-[12px] text-slate-400 truncate">${esc(w.location) || '위치 미지정'} · 재고품목 ${kinds}종</div></div>
                    <div class="flex gap-1.5 flex-shrink-0 text-[12px]"><button onclick="editWarehouse(${w.id})" class="text-indigo-500 hover:text-indigo-700 font-bold">편집</button><button onclick="deleteWarehouse(${w.id})" class="text-rose-400 hover:text-rose-600 font-bold">삭제</button></div>
                </div>`;
            }).join('');
        }
        function resetWarehouseForm() {
            ['warehouse-id', 'warehouse-name', 'warehouse-code', 'warehouse-location', 'warehouse-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            const t = document.getElementById('warehouse-form-title'); if (t) t.innerText = '새 창고 등록';
        }
        function editWarehouse(id) {
            const w = (STATE.warehouses || []).find(x => x.id === id); if (!w) return;
            document.getElementById('warehouse-id').value = w.id;
            document.getElementById('warehouse-name').value = w.name;
            document.getElementById('warehouse-code').value = w.code;
            document.getElementById('warehouse-location').value = w.location;
            document.getElementById('warehouse-notes').value = w.notes;
            document.getElementById('warehouse-form-title').innerText = '창고 편집';
        }
        async function handleSaveWarehouse(e) {
            e.preventDefault();
            const id = document.getElementById('warehouse-id').value;
            const row = { name: document.getElementById('warehouse-name').value.trim(), code: document.getElementById('warehouse-code').value.trim(), location: document.getElementById('warehouse-location').value.trim(), notes: document.getElementById('warehouse-notes').value.trim() };
            if (!row.name) { showToast('입력 필요', '창고명을 입력하세요.'); return; }
            let error;
            if (id) { ({ error } = await sb.from('warehouses').update(row).eq('id', parseInt(id))); }
            else { ({ error } = await sb.from('warehouses').insert(row)); }
            if (error) { showToast('저장 실패', error.message); return; }
            await reloadWarehouses(); renderWarehouseList(); resetWarehouseForm(); populateInventoryWarehouseFilter();
            showToast('저장 완료', id ? '창고가 수정되었습니다.' : '창고가 등록되었습니다.');
        }
        async function deleteWarehouse(id) {
            const w = (STATE.warehouses || []).find(x => x.id === id); if (!w) return;
            const hasStock = Object.keys(STATE.invStock || {}).some(iid => ((STATE.invStock[iid] || {})[id] || 0) > 0);
            if (hasStock) { showToast('삭제 불가', '재고가 남아 있는 창고는 삭제할 수 없습니다. 먼저 이동·출고 후 삭제하세요.'); return; }
            if (!confirm(`창고 [${w.name}] 을(를) 삭제하시겠습니까?`)) return;
            const { error } = await sb.from('warehouses').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadWarehouses(); renderWarehouseList(); populateInventoryWarehouseFilter();
            showToast('삭제', '창고가 삭제되었습니다.');
        }
        function updateStockMoveWhInfo() {
            const itemId = parseInt(document.getElementById('stock-move-item-id').value);
            const it = STATE.inventory.find(x => x.id === itemId); if (!it) return;
            const whId = parseInt(document.getElementById('stock-move-warehouse').value);
            const whQty = itemWhQty(itemId, whId);
            document.getElementById('stock-move-item-info').innerHTML = `<b>${esc(it.name)}</b> <span class="text-slate-400">${esc(it.sku)}</span><br><span class="text-slate-500">${esc(warehouseName(whId))} 현재고 <b class="text-slate-700">${fmtNum(whQty)}</b> ${esc(it.unit)}</span> <span class="text-slate-300">· 전체 ${fmtNum(it.stock)}</span>`;
        }

        // ════════════ 재고 입출 현황 보고서 (월별/년별) ════════════
        function onReportTypeChange() {
            const t = document.getElementById('report-type').value;
            const mw = document.getElementById('report-month-wrap');
            if (mw) mw.style.display = t === 'monthly' ? '' : 'none';
        }
        function openInventoryReport() {
            const now = new Date();
            document.getElementById('report-year').value = now.getFullYear();
            const msel = document.getElementById('report-month');
            if (msel) { msel.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join(''); msel.value = String(now.getMonth() + 1); }
            const wsel = document.getElementById('report-warehouse');
            if (wsel) wsel.innerHTML = `<option value="all">전체 창고</option>` + (STATE.warehouses || []).map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('');
            document.getElementById('report-type').value = 'monthly';
            onReportTypeChange();
            document.getElementById('report-body').innerHTML = '<div class="text-slate-400">상단에서 기간을 선택하고 "생성"을 누르세요.</div>';
            STATE.reportDraft = null;
            openModal('report-modal');
        }
        function reportRange(type, y, m) {
            if (type === 'monthly') {
                const start = `${y}-${String(m).padStart(2, '0')}-01`;
                const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
                return { start, end: `${ny}-${String(nm).padStart(2, '0')}-01` };
            }
            return { start: `${y}-01-01`, end: `${y + 1}-01-01` };
        }
        async function fetchReportMoves(start, end) {
            const { data, error } = await fetchAllPaged(() => sb.from('stock_moves').select('*').gte('created_at', start).lt('created_at', end).order('created_at', { ascending: true }));
            if (error) return [];
            return (data || []).map(r => ({ itemId: r.item_id, kind: r.kind, qty: Number(r.qty) || 0, subtype: r.subtype || '', warehouseId: r.warehouse_id || null, createdAt: r.created_at || '' }));
        }
        function reportItemMeta(iid) { const it = (STATE.inventory || []).find(x => String(x.id) === String(iid)); return it ? { name: it.name, category: it.category, unit: it.unit, stock: it.stock } : { name: '#' + iid, category: '', unit: '', stock: 0 }; }
        function computeMonthlyReport(moves) {
            const byItem = {};
            moves.forEach(mv => { const b = byItem[mv.itemId] = byItem[mv.itemId] || { inQty: 0, outQty: 0 }; if (mv.kind === 'in') b.inQty += mv.qty; else if (mv.kind === 'out') b.outQty += mv.qty; });
            const rows = Object.keys(byItem).map(iid => { const meta = reportItemMeta(iid); const b = byItem[iid]; return { name: meta.name, category: meta.category, unit: meta.unit, inQty: b.inQty, outQty: b.outQty, net: b.inQty - b.outQty, curStock: meta.stock }; }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
            const totals = rows.reduce((t, r) => ({ inQty: t.inQty + r.inQty, outQty: t.outQty + r.outQty, net: t.net + r.net }), { inQty: 0, outQty: 0, net: 0 });
            const subtypeOut = {}; moves.filter(mv => mv.kind === 'out').forEach(mv => { const k = mv.subtype || '(미지정)'; subtypeOut[k] = (subtypeOut[k] || 0) + mv.qty; });
            const subtypeIn = {}; moves.filter(mv => mv.kind === 'in').forEach(mv => { const k = mv.subtype || '(미지정)'; subtypeIn[k] = (subtypeIn[k] || 0) + mv.qty; });
            return { rows, totals, subtypeOut, subtypeIn };
        }
        function computeYearlyReport(moves) {
            const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, inQty: 0, outQty: 0, net: 0 }));
            moves.forEach(mv => { const mo = parseInt((mv.createdAt || '').slice(5, 7)); if (mo >= 1 && mo <= 12) { if (mv.kind === 'in') months[mo - 1].inQty += mv.qty; else if (mv.kind === 'out') months[mo - 1].outQty += mv.qty; } });
            months.forEach(x => x.net = x.inQty - x.outQty);
            const byItem = {}; moves.forEach(mv => { const b = byItem[mv.itemId] = byItem[mv.itemId] || { inQty: 0, outQty: 0 }; if (mv.kind === 'in') b.inQty += mv.qty; else if (mv.kind === 'out') b.outQty += mv.qty; });
            const itemRows = Object.keys(byItem).map(iid => { const meta = reportItemMeta(iid); const b = byItem[iid]; return { name: meta.name, unit: meta.unit, inQty: b.inQty, outQty: b.outQty, net: b.inQty - b.outQty, curStock: meta.stock }; }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
            const totals = months.reduce((t, x) => ({ inQty: t.inQty + x.inQty, outQty: t.outQty + x.outQty, net: t.net + x.net }), { inQty: 0, outQty: 0, net: 0 });
            return { months, itemRows, totals };
        }
        async function generateReport() {
            const type = document.getElementById('report-type').value;
            const y = parseInt(document.getElementById('report-year').value) || new Date().getFullYear();
            const m = parseInt(document.getElementById('report-month').value) || 1;
            const whId = document.getElementById('report-warehouse').value || 'all';
            const { start, end } = reportRange(type, y, m);
            let moves = await fetchReportMoves(start, end);
            if (whId !== 'all') moves = moves.filter(mv => String(mv.warehouseId) === String(whId));
            const whLabel = whId === 'all' ? '전체 창고' : warehouseName(parseInt(whId));
            const periodLabel = type === 'monthly' ? `${y}년 ${m}월` : `${y}년`;
            if (type === 'monthly') {
                STATE.reportDraft = Object.assign({ type, y, m, whId, whLabel, periodLabel, title: `월별 재고 입출 현황 (${periodLabel})` }, computeMonthlyReport(moves));
            } else {
                STATE.reportDraft = Object.assign({ type, y, m, whId, whLabel, periodLabel, title: `년별 재고 입출 현황 (${periodLabel})` }, computeYearlyReport(moves));
            }
            renderReportPreview();
        }
        function renderReportPreview() {
            const d = STATE.reportDraft, body = document.getElementById('report-body'); if (!body) return;
            if (!d) { body.innerHTML = '<div class="text-slate-400">생성된 보고서가 없습니다.</div>'; return; }
            const head = `<div class="flex items-center justify-between gap-2 mb-3"><div><div class="text-base font-extrabold text-slate-800">${esc(d.title)}</div><div class="text-[12px] text-slate-400">${esc(d.whLabel)} · 생성 ${new Date().toLocaleString('ko-KR')}</div></div></div>`;
            if (d.type === 'monthly') {
                const rows = d.rows.length ? d.rows.map(r => `<tr class="border-t border-slate-100"><td class="py-2 pr-3">${esc(r.name)}</td><td class="py-2 pr-3 text-slate-500">${esc(r.category) || '-'}</td><td class="py-2 pr-3 text-right text-emerald-600 font-semibold">${fmtNum(r.inQty)}</td><td class="py-2 pr-3 text-right text-rose-600 font-semibold">${fmtNum(r.outQty)}</td><td class="py-2 pr-3 text-right font-bold ${r.net < 0 ? 'text-rose-600' : 'text-slate-700'}">${r.net > 0 ? '+' : ''}${fmtNum(r.net)}</td><td class="py-2 text-right text-slate-500">${fmtNum(r.curStock)} ${esc(r.unit)}</td></tr>`).join('') : `<tr><td colspan="6" class="py-6 text-center text-slate-300">해당 기간 입출 내역이 없습니다.</td></tr>`;
                const subOut = Object.keys(d.subtypeOut).map(k => `<span class="wsp-chip bg-rose-50 text-rose-600 border-rose-100">${esc(k)} ${fmtNum(d.subtypeOut[k])}</span>`).join('') || '<span class="text-slate-300 text-[12px]">없음</span>';
                body.innerHTML = head + `<div class="overflow-x-auto"><table class="w-full text-[13px]"><thead><tr class="text-slate-400 text-left bg-slate-50"><th class="py-2 pr-3 pl-1 font-semibold">품목</th><th class="py-2 pr-3 font-semibold">분류</th><th class="py-2 pr-3 font-semibold text-right">입고</th><th class="py-2 pr-3 font-semibold text-right">출고</th><th class="py-2 pr-3 font-semibold text-right">순변동</th><th class="py-2 font-semibold text-right">현재고</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="border-t-2 border-slate-200 font-bold"><td class="py-2 pr-3" colspan="2">합계</td><td class="py-2 pr-3 text-right text-emerald-700">${fmtNum(d.totals.inQty)}</td><td class="py-2 pr-3 text-right text-rose-700">${fmtNum(d.totals.outQty)}</td><td class="py-2 pr-3 text-right">${d.totals.net > 0 ? '+' : ''}${fmtNum(d.totals.net)}</td><td></td></tr></tfoot></table></div><div class="mt-4"><div class="text-[12px] font-bold text-slate-500 mb-1.5">출고 유형별 합계</div><div class="flex flex-wrap gap-1.5">${subOut}</div></div>`;
            } else {
                const mrows = d.months.map(x => `<tr class="border-t border-slate-100"><td class="py-2 pr-3">${x.month}월</td><td class="py-2 pr-3 text-right text-emerald-600 font-semibold">${fmtNum(x.inQty)}</td><td class="py-2 pr-3 text-right text-rose-600 font-semibold">${fmtNum(x.outQty)}</td><td class="py-2 text-right font-bold ${x.net < 0 ? 'text-rose-600' : 'text-slate-700'}">${x.net > 0 ? '+' : ''}${fmtNum(x.net)}</td></tr>`).join('');
                const irows = d.itemRows.length ? d.itemRows.map(r => `<tr class="border-t border-slate-100"><td class="py-2 pr-3">${esc(r.name)}</td><td class="py-2 pr-3 text-right text-emerald-600 font-semibold">${fmtNum(r.inQty)}</td><td class="py-2 pr-3 text-right text-rose-600 font-semibold">${fmtNum(r.outQty)}</td><td class="py-2 text-right font-bold ${r.net < 0 ? 'text-rose-600' : 'text-slate-700'}">${r.net > 0 ? '+' : ''}${fmtNum(r.net)}</td></tr>`).join('') : `<tr><td colspan="4" class="py-6 text-center text-slate-300">내역이 없습니다.</td></tr>`;
                body.innerHTML = head + `<div class="grid md:grid-cols-2 gap-5"><div><div class="text-[12px] font-bold text-slate-500 mb-1.5">월별 추이</div><div class="overflow-x-auto"><table class="w-full text-[13px]"><thead><tr class="text-slate-400 text-left bg-slate-50"><th class="py-2 pr-3 pl-1 font-semibold">월</th><th class="py-2 pr-3 font-semibold text-right">입고</th><th class="py-2 pr-3 font-semibold text-right">출고</th><th class="py-2 font-semibold text-right">순변동</th></tr></thead><tbody>${mrows}</tbody><tfoot><tr class="border-t-2 border-slate-200 font-bold"><td class="py-2 pr-3">합계</td><td class="py-2 pr-3 text-right text-emerald-700">${fmtNum(d.totals.inQty)}</td><td class="py-2 pr-3 text-right text-rose-700">${fmtNum(d.totals.outQty)}</td><td class="py-2 text-right">${d.totals.net > 0 ? '+' : ''}${fmtNum(d.totals.net)}</td></tr></tfoot></table></div></div><div><div class="text-[12px] font-bold text-slate-500 mb-1.5">품목별 연간 합계</div><div class="overflow-x-auto"><table class="w-full text-[13px]"><thead><tr class="text-slate-400 text-left bg-slate-50"><th class="py-2 pr-3 pl-1 font-semibold">품목</th><th class="py-2 pr-3 font-semibold text-right">입고</th><th class="py-2 pr-3 font-semibold text-right">출고</th><th class="py-2 font-semibold text-right">순변동</th></tr></thead><tbody>${irows}</tbody></table></div></div></div>`;
            }
            if (window.lucide) lucide.createIcons();
        }
        function reportDocHTML(d) {
            const co = company();
            const logo = co.logo ? `<img src="${co.logo}" style="height:46px;object-fit:contain" />` : `<div style="font-size:20px;font-weight:800;color:#0f172a">${esc(co.name || 'WorkSpace Pro')}</div>`;
            const th = (t, al) => `<th style="padding:7px 9px;background:#f1f5f9;text-align:${al || 'left'};font-size:12px;border-bottom:2px solid #cbd5e1">${t}</th>`;
            const td = (t, al, b) => `<td style="padding:6px 9px;text-align:${al || 'left'};font-size:12px;border-bottom:1px solid #e2e8f0;${b ? 'font-weight:700' : ''}">${t}</td>`;
            let bodyHtml = '';
            if (d.type === 'monthly') {
                const rows = d.rows.length ? d.rows.map(r => `<tr>${td(esc(r.name))}${td(esc(r.category) || '-')}${td(fmtNum(r.inQty), 'right')}${td(fmtNum(r.outQty), 'right')}${td((r.net > 0 ? '+' : '') + fmtNum(r.net), 'right', true)}${td(fmtNum(r.curStock) + ' ' + esc(r.unit), 'right')}</tr>`).join('') : `<tr><td colspan="6" style="padding:18px;text-align:center;color:#94a3b8;font-size:12px">내역이 없습니다.</td></tr>`;
                bodyHtml = `<table style="width:100%;border-collapse:collapse"><thead><tr>${th('품목')}${th('분류')}${th('입고', 'right')}${th('출고', 'right')}${th('순변동', 'right')}${th('현재고', 'right')}</tr></thead><tbody>${rows}</tbody><tfoot><tr>${td('합계', 'left', true)}${td('')}${td(fmtNum(d.totals.inQty), 'right', true)}${td(fmtNum(d.totals.outQty), 'right', true)}${td((d.totals.net > 0 ? '+' : '') + fmtNum(d.totals.net), 'right', true)}${td('')}</tr></tfoot></table>`;
                const sub = Object.keys(d.subtypeOut).map(k => `${esc(k)}: ${fmtNum(d.subtypeOut[k])}`).join(' / ');
                if (sub) bodyHtml += `<div style="margin-top:10px;font-size:12px;color:#475569"><b>출고 유형별:</b> ${sub}</div>`;
            } else {
                const mrows = d.months.map(x => `<tr>${td(x.month + '월')}${td(fmtNum(x.inQty), 'right')}${td(fmtNum(x.outQty), 'right')}${td((x.net > 0 ? '+' : '') + fmtNum(x.net), 'right', true)}</tr>`).join('');
                const irows = d.itemRows.length ? d.itemRows.map(r => `<tr>${td(esc(r.name))}${td(fmtNum(r.inQty), 'right')}${td(fmtNum(r.outQty), 'right')}${td((r.net > 0 ? '+' : '') + fmtNum(r.net), 'right', true)}</tr>`).join('') : `<tr><td colspan="4" style="padding:18px;text-align:center;color:#94a3b8;font-size:12px">내역이 없습니다.</td></tr>`;
                bodyHtml = `<div style="display:flex;gap:18px;flex-wrap:wrap"><div style="flex:1;min-width:240px"><div style="font-size:12px;font-weight:700;margin-bottom:5px">월별 추이</div><table style="width:100%;border-collapse:collapse"><thead><tr>${th('월')}${th('입고', 'right')}${th('출고', 'right')}${th('순변동', 'right')}</tr></thead><tbody>${mrows}</tbody><tfoot><tr>${td('합계', 'left', true)}${td(fmtNum(d.totals.inQty), 'right', true)}${td(fmtNum(d.totals.outQty), 'right', true)}${td((d.totals.net > 0 ? '+' : '') + fmtNum(d.totals.net), 'right', true)}</tr></tfoot></table></div><div style="flex:1;min-width:240px"><div style="font-size:12px;font-weight:700;margin-bottom:5px">품목별 연간 합계</div><table style="width:100%;border-collapse:collapse"><thead><tr>${th('품목')}${th('입고', 'right')}${th('출고', 'right')}${th('순변동', 'right')}</tr></thead><tbody>${irows}</tbody></table></div></div>`;
            }
            return `<div style="font-family:'Malgun Gothic',sans-serif;color:#0f172a;max-width:900px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f172a;padding-bottom:10px;margin-bottom:14px">
            <div><div style="font-size:20px;font-weight:800">${esc(d.title)}</div><div style="font-size:12px;color:#64748b;margin-top:3px">${esc(d.whLabel)} · 생성일 ${new Date().toLocaleDateString('ko-KR')}</div></div>
            <div style="text-align:right">${logo}</div>
        </div>
        ${bodyHtml}
        <div style="margin-top:16px;font-size:11px;color:#94a3b8;text-align:right">${esc(co.name || '')} · WorkSpace Pro</div>
    </div>`;
        }
        function printReport() {
            const d = STATE.reportDraft; if (!d) { showToast('보고서 없음', '먼저 "생성"을 눌러 보고서를 만드세요.'); return; }
            const html = reportDocHTML(d);
            let f = document.getElementById('wsp-print-frame'); if (f) f.remove();
            f = document.createElement('iframe'); f.id = 'wsp-print-frame';
            f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
            document.body.appendChild(f);
            const fd = f.contentWindow.document;
            fd.open();
            fd.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>@page{size:A4;margin:13mm}html,body{margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${html}</body></html>`);
            fd.close();
            const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { } };
            const img = fd.images && fd.images[0];
            if (img && !img.complete) { img.onload = () => setTimeout(go, 60); img.onerror = () => setTimeout(go, 60); setTimeout(go, 1500); }
            else setTimeout(go, 180);
        }
        async function exportReportXlsx() {
            const d = STATE.reportDraft; if (!d) { showToast('보고서 없음', '먼저 "생성"을 눌러 보고서를 만드세요.'); return; }
            let sheets;
            if (d.type === 'monthly') {
                sheets = [
                    { name: '월별현황', title: `월별 재고 입출 현황 (${d.periodLabel})`, headers: ['품목', '분류', '입고', '출고', '순변동', '현재고'], aligns: ['left', 'left', 'right', 'right', 'right', 'right'], numFmts: [, , '#,##0', '#,##0', '#,##0', '#,##0'], widths: [24, 12, 10, 10, 10, 10], rows: d.rows.map(r => [r.name, r.category, r.inQty, r.outQty, r.net, r.curStock]), totalRow: ['합계', '', d.totals.inQty, d.totals.outQty, d.totals.net, ''] },
                    { name: '출고유형', title: `출고 유형별 합계 (${d.periodLabel})`, headers: ['출고유형', '수량'], aligns: ['left', 'right'], numFmts: [, '#,##0'], widths: [20, 12], rows: Object.keys(d.subtypeOut).map(k => [k, d.subtypeOut[k]]) }
                ];
            } else {
                sheets = [
                    { name: '월별추이', title: `년별 재고 입출 현황 (${d.periodLabel})`, headers: ['월', '입고', '출고', '순변동'], aligns: ['left', 'right', 'right', 'right'], numFmts: [, '#,##0', '#,##0', '#,##0'], widths: [10, 12, 12, 12], rows: d.months.map(x => [x.month + '월', x.inQty, x.outQty, x.net]), totalRow: ['합계', d.totals.inQty, d.totals.outQty, d.totals.net] },
                    { name: '품목별', title: `품목별 연간 합계 (${d.periodLabel})`, headers: ['품목', '입고', '출고', '순변동'], aligns: ['left', 'right', 'right', 'right'], numFmts: [, '#,##0', '#,##0', '#,##0'], widths: [24, 12, 12, 12], rows: d.itemRows.map(r => [r.name, r.inQty, r.outQty, r.net]) }
                ];
            }
            const okv = await exportStyledWorkbook({ filename: `재고입출현황_${d.periodLabel.replace(/[^0-9가-힣]/g, '')}_${d.whLabel}.xlsx`, sheets });
            if (okv) showToast('내보내기 완료', '보고서를 엑셀로 저장했습니다.');
        }

        // ════════════ 재고 대시보드 (창고별·공급처별·분류별) + 재고 현황 보고서 ════════════
        function computeInventoryDashboard() {
            const items = STATE.inventory || [];
            const totalItems = items.length;
            const totalQty = items.reduce((s, i) => s + Number(i.stock), 0);
            const lowCnt = items.filter(isLowStock).length;
            const byWh = (STATE.warehouses || []).map(w => {
                let qty = 0, kinds = 0;
                items.forEach(i => { const q = itemWhQty(i.id, w.id); if (q > 0) { qty += q; kinds++; } });
                return { name: w.name, qty, kinds };
            }).sort((a, b) => b.qty - a.qty);
            const group = (keyFn, dflt) => {
                const map = {};
                items.forEach(i => { const k = (keyFn(i) || dflt); const b = map[k] = map[k] || { qty: 0, kinds: 0 }; b.qty += Number(i.stock); b.kinds++; });
                return Object.keys(map).map(k => ({ name: k, qty: map[k].qty, kinds: map[k].kinds })).sort((a, b) => b.qty - a.qty);
            };
            const bySupplier = group(i => i.supplier, '(미지정)');
            const byCategory = group(i => i.category, '(미분류)');
            const lowItems = items.filter(isLowStock).map(i => ({ id: i.id, name: i.name, sku: i.sku, stock: i.stock, safe: i.safeStock, unit: i.unit })).sort((a, b) => (a.stock - a.safe) - (b.stock - b.safe));
            return { totalItems, totalQty, lowCnt, byWh, bySupplier, byCategory, lowItems };
        }
        function openInventoryDashboard() { switchTab('inventory'); setInventoryView('dashboard'); }
        function dashGroupTable(title, icon, rows, unitLabel) {
            const max = rows.reduce((m, r) => Math.max(m, r.qty), 0) || 1;
            const body = rows.length ? rows.map(r => {
                const pct = Math.max(2, Math.round(r.qty / max * 100));
                return `<tr class="border-t border-slate-100">
                    <td class="py-2 pr-3"><div class="font-semibold text-slate-700 truncate max-w-[200px]">${esc(r.name)}</div><div class="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-indigo-400 rounded-full" style="width:${pct}%"></div></div></td>
                    <td class="py-2 pr-3 text-right text-slate-500">${fmtNum(r.kinds)}</td>
                    <td class="py-2 text-right text-slate-800 font-bold">${fmtNum(r.qty)}</td>
                </tr>`;
            }).join('') : `<tr><td colspan="3" class="py-6 text-center text-slate-300">데이터가 없습니다.</td></tr>`;
            return `<div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                <div class="text-[13px] font-bold text-slate-600 mb-2 flex items-center gap-1.5"><i data-lucide="${icon}" class="w-4 h-4 text-indigo-600"></i> ${title}</div>
                <div class="overflow-x-auto"><table class="w-full text-[13px]"><thead><tr class="text-slate-400 text-left"><th class="py-1 pr-3 font-semibold">${unitLabel}</th><th class="py-1 pr-3 font-semibold text-right">품목수</th><th class="py-1 font-semibold text-right">총수량</th></tr></thead><tbody>${body}</tbody></table></div>
            </div>`;
        }
        function renderInventoryDashboard() {
            const d = computeInventoryDashboard();
            STATE.dashboardDraft = d;
            const body = document.getElementById('inventory-dashboard-body'); if (!body) return;
            const es = STATE.inventoryTableMissing ? inventoryErrorStateHTML() : inventoryEmptyStateHTML();
            if (es) { body.innerHTML = es; if (window.lucide) lucide.createIcons(); return; }
            const card = (label, val, sub, tone) => `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4"><div class="text-[12px] font-bold text-slate-400">${label}</div><div class="text-2xl font-extrabold ${tone} mt-1">${val}</div><div class="text-[11px] text-slate-400 mt-0.5">${sub}</div></div>`;
            const kpi = `<div class="grid grid-cols-3 gap-3">
                ${card('총 품목', fmtNum(d.totalItems), '등록된 품목 수', 'text-slate-800')}
                ${card('재고 총수량', fmtNum(d.totalQty), '전체 수량 합계', 'text-slate-800')}
                ${card('재고 부족', fmtNum(d.lowCnt), '안전재고 이하', d.lowCnt ? 'text-rose-600' : 'text-slate-800')}
            </div>`;
            const low = d.lowItems.length ? `<div class="bg-white border border-rose-200/70 rounded-2xl p-5 shadow-sm">
                <div class="text-[13px] font-bold text-rose-600 mb-2 flex items-center gap-1.5"><i data-lucide="alert-triangle" class="w-4 h-4"></i> 재고 부족 품목 (${d.lowItems.length})</div>
                <div class="overflow-x-auto"><table class="w-full text-[13px]"><tbody>${d.lowItems.slice(0, 40).map(i => `<tr class="border-t border-rose-50"><td class="py-2 pr-2"><span class="font-semibold text-slate-700">${esc(i.name)}</span> <span class="text-[11px] text-slate-400 font-mono">${esc(i.sku || '')}</span></td><td class="py-2 pr-2 text-right whitespace-nowrap"><span class="text-rose-600 font-bold">${fmtNum(i.stock)}</span> <span class="text-[11px] text-slate-400">/ ${fmtNum(i.safe)} ${esc(i.unit)}</span></td><td class="py-2 text-right"><button onclick="createPoFromItem(${i.id})" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[12px] font-bold">발주</button></td></tr>`).join('')}</tbody></table></div>
            </div>` : '';
            body.innerHTML = kpi
                + dashGroupTable('창고별 재고', 'warehouse', d.byWh, '창고')
                + `<div class="grid md:grid-cols-2 gap-5">${dashGroupTable('공급처별 재고', 'truck', d.bySupplier, '공급처')}${dashGroupTable('분류별 재고', 'tags', d.byCategory, '분류')}</div>`
                + low;
            if (window.lucide) lucide.createIcons();
        }
        function dashboardReportHTML(d) {
            const co = company();
            const logo = co.logo ? `<img src="${co.logo}" style="height:46px;object-fit:contain" />` : `<div style="font-size:20px;font-weight:800;color:#0f172a">${esc(co.name || 'WorkSpace Pro')}</div>`;
            const th = (t, al) => `<th style="padding:7px 9px;background:#f1f5f9;text-align:${al || 'left'};font-size:12px;border-bottom:2px solid #cbd5e1">${t}</th>`;
            const td = (t, al, b) => `<td style="padding:6px 9px;text-align:${al || 'left'};font-size:12px;border-bottom:1px solid #e2e8f0;${b ? 'font-weight:700' : ''}">${t}</td>`;
            const tbl = (title, rows, unit) => `<div style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;margin-bottom:5px">${title}</div><table style="width:100%;border-collapse:collapse"><thead><tr>${th(unit)}${th('품목수', 'right')}${th('총수량', 'right')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${td(esc(r.name))}${td(fmtNum(r.kinds), 'right')}${td(fmtNum(r.qty), 'right', true)}</tr>`).join('') : `<tr><td colspan="3" style="padding:14px;text-align:center;color:#94a3b8;font-size:12px">데이터 없음</td></tr>`}</tbody></table></div>`;
            return `<div style="font-family:'Malgun Gothic',sans-serif;color:#0f172a;max-width:900px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f172a;padding-bottom:10px;margin-bottom:14px">
            <div><div style="font-size:20px;font-weight:800">재고 현황 보고서</div><div style="font-size:12px;color:#64748b;margin-top:3px">생성일 ${new Date().toLocaleDateString('ko-KR')}</div></div>
            <div style="text-align:right">${logo}</div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
            <div style="flex:1;min-width:120px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px"><div style="font-size:11px;color:#94a3b8">총 품목</div><div style="font-size:18px;font-weight:800">${fmtNum(d.totalItems)}</div></div>
            <div style="flex:1;min-width:120px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px"><div style="font-size:11px;color:#94a3b8">재고 총수량</div><div style="font-size:18px;font-weight:800">${fmtNum(d.totalQty)}</div></div>
            <div style="flex:1;min-width:120px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px"><div style="font-size:11px;color:#94a3b8">재고 부족</div><div style="font-size:18px;font-weight:800;color:#e11d48">${fmtNum(d.lowCnt)}</div></div>
        </div>
        ${tbl('창고별 재고', d.byWh, '창고')}
        ${tbl('공급처별 재고', d.bySupplier, '공급처')}
        ${tbl('분류별 재고', d.byCategory, '분류')}
        <div style="margin-top:16px;font-size:11px;color:#94a3b8;text-align:right">${esc(co.name || '')} · WorkSpace Pro</div>
    </div>`;
        }
        function printInventoryStatus() {
            const d = STATE.dashboardDraft || computeInventoryDashboard();
            const html = dashboardReportHTML(d);
            let f = document.getElementById('wsp-print-frame'); if (f) f.remove();
            f = document.createElement('iframe'); f.id = 'wsp-print-frame';
            f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
            document.body.appendChild(f);
            const fd = f.contentWindow.document;
            fd.open();
            fd.write(`<!doctype html><html><head><meta charset="utf-8"><title>재고 현황 보고서</title><style>@page{size:A4;margin:13mm}html,body{margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${html}</body></html>`);
            fd.close();
            const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { } };
            const img = fd.images && fd.images[0];
            if (img && !img.complete) { img.onload = () => setTimeout(go, 60); img.onerror = () => setTimeout(go, 60); setTimeout(go, 1500); }
            else setTimeout(go, 180);
        }
        function buildInventoryStatusSheets(d) {
            const whs = STATE.warehouses || [];
            const items = (STATE.inventory || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
            const headers = ['품목코드', '품목명', '분류', '단위', '현재고', '안전재고', '단가', '거래처'].concat(whs.map(w => w.name));
            const aligns = ['left', 'left', 'left', 'center', 'right', 'right', 'right', 'left'].concat(whs.map(() => 'right'));
            const numFmts = [, , , , '#,##0', '#,##0', '#,##0'].concat(whs.map(() => '#,##0'));
            const rows = items.map(i => [i.sku || '', i.name || '', i.category || '', i.unit || '', Number(i.stock) || 0, Number(i.safeStock) || 0, Number(i.unitPrice) || 0, i.supplier || ''].concat(whs.map(w => itemWhQty(i.id, w.id))));
            const totQty = items.reduce((s, i) => s + (Number(i.stock) || 0), 0);
            const totalRow = ['합계', '', '', '', totQty, '', '', ''].concat(whs.map(w => items.reduce((s, i) => s + itemWhQty(i.id, w.id), 0)));
            const grp = (rowsG, unit) => ({ headers: [unit, '품목수', '총수량'], aligns: ['left', 'right', 'right'], numFmts: [, '#,##0', '#,##0'], widths: [22, 10, 14], rows: rowsG.map(r => [r.name, r.kinds, r.qty]), totalRow: ['합계', rowsG.reduce((s, r) => s + r.kinds, 0), rowsG.reduce((s, r) => s + r.qty, 0)] });
            return [
                { name: '재고현황', title: '재고 현황 보고서', headers, aligns, numFmts, widths: [14, 22, 12, 8, 10, 10, 12, 16].concat(whs.map(() => 12)), rows, totalRow },
                Object.assign({ name: '창고별', title: '창고별 재고' }, grp(d.byWh, '창고')),
                Object.assign({ name: '공급처별', title: '공급처별 재고' }, grp(d.bySupplier, '공급처')),
                Object.assign({ name: '분류별', title: '분류별 재고' }, grp(d.byCategory, '분류'))
            ];
        }
        async function exportInventoryStatusXlsx() {
            const d = STATE.dashboardDraft || computeInventoryDashboard();
            if (!(STATE.inventory || []).length) { showToast('내보낼 데이터 없음', '품목이 없습니다.'); return; }
            const okv = await exportStyledWorkbook({ filename: `재고현황_${xlsxToday()}.xlsx`, sheets: buildInventoryStatusSheets(d) });
            if (okv) showToast('내보내기 완료', '재고 현황을 엑셀로 저장했습니다.');
        }
        // ── 재고 부족 → 발주서 생성 연계 ──
        function createPoFromItem(itemId) {
            const it = STATE.inventory.find(x => x.id === itemId); if (!it) return;
            if (STATE.tradeTableMissing) { showToast('준비 필요', '발주/견적 테이블(trade_documents) 갱신 SQL을 먼저 실행하세요.'); return; }
            openTradeForm(null, 'po');
            const cl = document.getElementById('trade-client'); if (cl) { cl.value = it.supplier || ''; onTradeClientChange(); }
            const sv = document.getElementById('trade-service'); if (sv) sv.value = '재고 보충 발주';
            const reorder = Math.max(1, (Number(it.safeStock) || 0) * 2 - (Number(it.stock) || 0));
            STATE.tradeDraft.items = [{ description: it.name + (it.sku ? ` (${it.sku})` : ''), notes: '', unit: it.unit || '', qty: reorder, unitPrice: Number(it.unitPrice) || 0, sub: false }];
            renderTradeLines(); if (typeof refreshTradeTotals === 'function') refreshTradeTotals();
            showToast('발주서 초안', `${it.name} 부족분(${fmtNum(reorder)}${it.unit})으로 발주서를 준비했습니다.`);
        }
        // ── 데이터 백업 / 초기화 ──
        function openDataManager() {
            if (!STATE.profile || STATE.profile.role !== 'admin') { showToast('권한 없음', '데이터 백업·초기화는 관리자만 사용할 수 있습니다.'); return; }
            const el = document.getElementById('data-reset-confirm'); if (el) el.value = '';
            const r = document.querySelector('input[name="data-reset-scope"][value="zero"]'); if (r) r.checked = true;
            openModal('data-modal');
        }
        function collectBackup() {
            return {
                version: 'wsp-backup-1', exportedAt: new Date().toISOString(),
                warehouses: STATE.warehouses || [],
                inventory: (STATE.inventory || []).map(i => ({ id: i.id, sku: i.sku, name: i.name, category: i.category, unit: i.unit, stock: i.stock, safeStock: i.safeStock, unitPrice: i.unitPrice, supplier: i.supplier, location: i.location, deptId: i.deptId, notes: i.notes })),
                inventoryStock: STATE.invStock || {}, stockMoves: STATE.stockMoves || [], partners: STATE.partners || [], options: STATE.invOptions || {}, trade: STATE.trade || []
            };
        }
        function exportBackupJson() {
            downloadBlob(new Blob([JSON.stringify(collectBackup(), null, 2)], { type: 'application/json' }), `재고백업_${xlsxToday()}.json`);
            showToast('백업 완료', 'JSON 백업 파일을 저장했습니다.');
        }
        // ── 백업 복원(JSON) : 누락 항목 추가 + 재고 수량을 백업 시점으로 맞춤(기존 항목 유지) ──
        function triggerRestore() {
            if (!STATE.profile || STATE.profile.role !== 'admin') { showToast('권한 없음', '복원은 관리자만 가능합니다.'); return; }
            const inp = document.getElementById('backup-restore-input'); if (inp) { inp.value = ''; inp.click(); }
        }
        async function handleRestoreFile(e) {
            const file = e.target.files && e.target.files[0]; if (!file) return;
            let data; try { data = JSON.parse(await file.text()); } catch (err) { showToast('읽기 실패', 'JSON 백업 파일을 확인하세요.'); return; }
            if (!data || data.version !== 'wsp-backup-1') { showToast('형식 오류', '이 시스템의 백업 파일(JSON)이 아닙니다.'); return; }
            if (!confirm(`백업에서 품목 ${(data.inventory || []).length}건을 복원합니다. 기존 데이터는 유지되고, 없는 항목만 추가되며 재고 수량을 백업 시점으로 맞춥니다. 진행할까요?`)) return;
            await restoreBackup(data);
            closeModal('data-modal');
        }
        async function restoreBackup(data) {
            if (!data || data.version !== 'wsp-backup-1') { showToast('형식 오류', '올바른 백업 파일이 아닙니다.'); return; }
            let wc = 0, ic = 0, pc = 0;
            for (const w of (data.warehouses || [])) {
                const ex = (STATE.warehouses || []).find(x => String(x.name).trim() === String(w.name).trim());
                if (!ex) { await sb.from('warehouses').insert({ name: w.name, code: w.code || '', location: w.location || '', notes: w.notes || '' }); wc++; }
            }
            await reloadWarehouses();
            const whNameToId = {}; (STATE.warehouses || []).forEach(x => { whNameToId[String(x.name).trim()] = x.id; });
            const oldWhIdToName = {}; (data.warehouses || []).forEach(w => { oldWhIdToName[w.id] = String(w.name).trim(); });
            await ensureImportOptions((data.inventory || []).map(i => ({ category: i.category, unit: i.unit, name: i.name })));
            const optAdds = [];
            ['category', 'unit', 'name', 'move_in', 'move_out'].forEach(k => { (((data.options || {})[k]) || []).forEach(o => { const v = (o.value || '').trim(); if (v && !((STATE.invOptions[k] || []).some(x => String(x.value).trim().toLowerCase() === v.toLowerCase()))) optAdds.push({ kind: k, value: v }); }); });
            if (optAdds.length) { await sb.from('inventory_options').insert(optAdds); await reloadInventoryOptions(); }
            for (const p of (data.partners || [])) {
                const ex = (STATE.partners || []).find(x => String(x.name).trim().toLowerCase() === String(p.name).trim().toLowerCase());
                if (!ex) { await sb.from('partners').insert({ name: p.name, kind: p.kind || 'both', contact: p.contact || '', tel: p.tel || '', fax: p.fax || '', email: p.email || '', biz_no: p.bizNo || p.biz_no || '', address: p.address || '', notes: p.notes || '' }); pc++; }
            }
            await reloadPartners();
            const oldItemIdToKey = {};
            for (const it of (data.inventory || [])) {
                const sku = (it.sku || '').trim().toLowerCase(), nm = (it.name || '').trim().toLowerCase();
                let ex = sku ? (STATE.inventory || []).find(x => String(x.sku || '').trim().toLowerCase() === sku) : null;
                if (!ex) ex = (STATE.inventory || []).find(x => String(x.name || '').trim().toLowerCase() === nm);
                if (!ex) { await sb.from('inventory_items').insert({ name: it.name, sku: it.sku || '', category: it.category || '', unit: it.unit || 'EA', stock: 0, safe_stock: Number(it.safeStock) || 0, unit_price: Number(it.unitPrice) || 0, supplier: it.supplier || '', location: it.location || '', dept_id: it.deptId || (STATE.profile ? STATE.profile.deptId : ''), notes: it.notes || '' }); ic++; }
                oldItemIdToKey[it.id] = { sku: it.sku, name: it.name };
            }
            await reloadInventory(); await reloadInventoryStock();
            const findCur = (key) => (STATE.inventory || []).find(x => (key.sku && String(x.sku || '').trim().toLowerCase() === String(key.sku).trim().toLowerCase()) || String(x.name || '').trim().toLowerCase() === String(key.name || '').trim().toLowerCase());
            const invStock = data.inventoryStock || {};
            for (const oldItemId of Object.keys(invStock)) {
                const key = oldItemIdToKey[oldItemId]; if (!key) continue;
                const cur = findCur(key); if (!cur) continue;
                const perWh = invStock[oldItemId] || {};
                for (const oldWhId of Object.keys(perWh)) {
                    const whName = oldWhIdToName[oldWhId]; const curWhId = whName ? whNameToId[whName] : defaultWarehouseId();
                    if (!curWhId) continue;
                    const diff = (Number(perWh[oldWhId]) || 0) - itemWhQty(cur.id, curWhId);
                    if (diff !== 0) await sb.rpc('apply_stock_move', { p_item_id: cur.id, p_kind: diff > 0 ? 'in' : 'out', p_qty: Math.abs(diff), p_reason: '백업 복원', p_warehouse_id: curWhId, p_subtype: '' });
                }
            }
            await reloadInventory(); await reloadInventoryStock(); await reloadStockMoves();
            if (STATE.currentTab === 'inventory') setInventoryView(STATE.inventoryView || 'dashboard');
            renderDashboardWidgets();
            showToast('복원 완료', `창고 ${wc} · 품목 ${ic} · 거래처 ${pc}건 추가, 재고 수량 반영 완료`);
        }
        async function exportBackupXlsx() {
            const items = STATE.inventory || [], whs = STATE.warehouses || [];
            const sheets = [
                { name: '품목', title: '재고 품목 백업', headers: ['품목코드', '품목명', '분류', '단위', '현재고', '안전재고', '단가', '거래처', '위치', '담당부서', '비고'], aligns: ['left', 'left', 'left', 'center', 'right', 'right', 'right', 'left', 'left', 'left', 'left'], numFmts: [, , , , '#,##0', '#,##0', '#,##0'], widths: [14, 22, 12, 8, 10, 10, 12, 16, 12, 14, 20], rows: items.map(i => [i.sku, i.name, i.category, i.unit, Number(i.stock) || 0, Number(i.safeStock) || 0, Number(i.unitPrice) || 0, i.supplier, i.location, deptName(i.deptId), i.notes]) },
                { name: '창고별재고', title: '창고별 재고 백업', headers: ['품목코드', '품목명'].concat(whs.map(w => w.name)), aligns: ['left', 'left'].concat(whs.map(() => 'right')), numFmts: [,].concat(whs.map(() => '#,##0')), widths: [14, 22].concat(whs.map(() => 12)), rows: items.map(i => [i.sku, i.name].concat(whs.map(w => itemWhQty(i.id, w.id)))) },
                { name: '입출고이력', title: '입출고 이력 백업', headers: ['일시', '품목', '구분', '유형', '수량', '창고', '잔량', '사유', '담당'], aligns: ['left', 'left', 'center', 'left', 'right', 'left', 'right', 'left', 'left'], numFmts: [, , , , '#,##0', , '#,##0'], widths: [18, 20, 8, 12, 10, 14, 10, 20, 12], rows: (STATE.stockMoves || []).map(m => { const it = (STATE.inventory || []).find(x => x.id === m.itemId); return [(m.createdAt || '').replace('T', ' ').slice(0, 16), it ? it.name : ('#' + m.itemId), m.kind === 'in' ? '입고' : '출고', m.subtype || '', Number(m.qty) || 0, m.warehouseId ? warehouseName(m.warehouseId) : '', m.balanceAfter, m.reason || '', m.actor || '']; }) },
                { name: '거래처', title: '거래처 백업', headers: ['거래처명', '구분', '담당자', 'TEL', 'FAX', 'E-MAIL', '사업자번호', '주소', '비고'], aligns: ['left', 'center', 'left', 'left', 'left', 'left', 'left', 'left', 'left'], widths: [18, 10, 12, 14, 14, 20, 16, 24, 20], rows: (STATE.partners || []).map(p => [p.name, PARTNER_KIND_LABEL[p.kind] || '공통', p.contact, p.tel, p.fax, p.email, p.bizNo, p.address, p.notes]) }
            ];
            const okv = await exportStyledWorkbook({ filename: `재고백업_${xlsxToday()}.xlsx`, sheets });
            if (okv) showToast('백업 완료', '엑셀 백업 파일을 저장했습니다.');
        }
        async function handleDataReset() {
            if (!STATE.profile || STATE.profile.role !== 'admin') { showToast('권한 없음', '관리자만 초기화할 수 있습니다.'); return; }
            const scope = (document.querySelector('input[name="data-reset-scope"]:checked') || {}).value || 'zero';
            if ((document.getElementById('data-reset-confirm').value || '').trim() !== '초기화') { showToast('확인 필요', '확인란에 "초기화"를 정확히 입력하세요.'); return; }
            if (!confirm(scope === 'delete' ? '모든 품목을 삭제합니다. 되돌릴 수 없습니다. 진행할까요?' : '모든 재고 수량을 0으로 초기화합니다. 진행할까요?')) return;
            let cnt = 0;
            if (scope === 'delete') {
                for (const it of (STATE.inventory || []).slice()) { const { error } = await sb.from('inventory_items').delete().eq('id', it.id); if (!error) cnt++; }
            } else {
                for (const it of (STATE.inventory || []).slice()) {
                    for (const w of (STATE.warehouses || [])) { const q = itemWhQty(it.id, w.id); if (q > 0) { await sb.rpc('apply_stock_move', { p_item_id: it.id, p_kind: 'out', p_qty: q, p_reason: '재고 초기화', p_warehouse_id: w.id, p_subtype: '' }); cnt++; } }
                }
            }
            await reloadInventory(); await reloadInventoryStock(); await reloadStockMoves();
            if (STATE.currentTab === 'inventory') setInventoryView(STATE.inventoryView || 'dashboard');
            renderDashboardWidgets(); closeModal('data-modal');
            showToast('초기화 완료', scope === 'delete' ? `${cnt}개 품목을 삭제했습니다.` : '재고 수량을 0으로 초기화했습니다.');
        }

        // ════════════ 재고 실사(일괄 카운트·조정) ════════════
        function openStocktake() {
            if (STATE.inventoryTableMissing) { showToast('준비 필요', '재고 테이블 생성 SQL을 먼저 실행하세요.'); return; }
            if (!(STATE.warehouses || []).length) { showToast('창고 없음', '먼저 창고를 1개 이상 등록하세요.'); return; }
            STATE.stocktakeCounts = {};
            const wsel = document.getElementById('stocktake-wh');
            if (wsel) wsel.innerHTML = (STATE.warehouses || []).map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('');
            const qel = document.getElementById('stocktake-q'); if (qel) qel.value = '';
            openModal('stocktake-modal');
            renderStocktakeTable();
        }
        function onStocktakeWhChange() { STATE.stocktakeCounts = {}; renderStocktakeTable(); }
        function computeStocktakeDiffs(items, whId, countedMap) {
            const out = [];
            (items || []).forEach(it => {
                const raw = countedMap ? countedMap[it.id] : undefined;
                if (raw === undefined || raw === null || String(raw).trim() === '') return;
                const counted = Number(raw); if (isNaN(counted) || counted < 0) return;
                const system = itemWhQty(it.id, whId);
                if (counted === system) return;
                out.push({ itemId: it.id, name: it.name, system, counted, diff: counted - system });
            });
            return out;
        }
        function renderStocktakeTable() {
            const body = document.getElementById('stocktake-body'); if (!body) return;
            const whId = Number((document.getElementById('stocktake-wh') || {}).value) || defaultWarehouseId();
            const q = ((document.getElementById('stocktake-q') || {}).value || '').trim().toLowerCase();
            let items = (STATE.inventory || []);
            if (q) items = items.filter(i => (String(i.name || '') + ' ' + String(i.sku || '')).toLowerCase().indexOf(q) >= 0);
            if (!items.length) { body.innerHTML = '<div class="text-slate-300 py-10 text-center">표시할 품목이 없습니다.</div>'; updateStocktakeSummary(); return; }
            const rows = items.map(it => {
                const sys = itemWhQty(it.id, whId);
                const cur = STATE.stocktakeCounts[it.id];
                const has = cur !== undefined && String(cur).trim() !== '';
                const d = has ? (Number(cur) - sys) : null;
                const diffTxt = d === null ? '—' : (d > 0 ? '+' : '') + fmtNum(d);
                const diffCls = d === null ? 'text-slate-300' : (d === 0 ? 'text-slate-400' : (d > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'));
                return `<tr class="border-t border-slate-100">
                    <td class="py-2 pr-2"><div class="font-semibold text-slate-700">${esc(it.name)}</div><div class="text-[11px] text-slate-400 font-mono">${esc(it.sku || '')}</div></td>
                    <td class="py-2 pr-2 text-right text-slate-600">${fmtNum(sys)} <span class="text-[11px] text-slate-400">${esc(it.unit || '')}</span></td>
                    <td class="py-2 pr-2 text-right"><input type="number" min="0" inputmode="numeric" id="st-in-${it.id}" value="${has ? esc(String(cur)) : ''}" oninput="updateStocktakeDiff(${it.id})" placeholder="실사" class="w-24 px-2 py-1.5 border rounded-lg text-sm text-right outline-none focus:border-indigo-300"></td>
                    <td class="py-2 text-right whitespace-nowrap"><span id="st-diff-${it.id}" class="${diffCls}">${diffTxt}</span></td>
                </tr>`;
            }).join('');
            body.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-[13px]"><thead><tr class="text-slate-400 text-left bg-slate-50"><th class="py-2 pr-2 pl-1 font-semibold">품목 / 코드</th><th class="py-2 pr-2 font-semibold text-right">시스템 재고</th><th class="py-2 pr-2 font-semibold text-right">실사 수량</th><th class="py-2 font-semibold text-right">차이</th></tr></thead><tbody>${rows}</tbody></table></div>`;
            updateStocktakeSummary();
        }
        function updateStocktakeDiff(itemId) {
            const whId = Number((document.getElementById('stocktake-wh') || {}).value) || defaultWarehouseId();
            const inp = document.getElementById('st-in-' + itemId); if (!inp) return;
            const raw = inp.value;
            if (String(raw).trim() === '') delete STATE.stocktakeCounts[itemId]; else STATE.stocktakeCounts[itemId] = raw;
            const cell = document.getElementById('st-diff-' + itemId);
            if (cell) {
                const sys = itemWhQty(itemId, whId);
                if (String(raw).trim() === '') { cell.textContent = '—'; cell.className = 'text-slate-300'; }
                else { const d = Number(raw) - sys; cell.textContent = (d > 0 ? '+' : '') + fmtNum(d); cell.className = d === 0 ? 'text-slate-400' : (d > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'); }
            }
            updateStocktakeSummary();
        }
        function updateStocktakeSummary() {
            const whId = Number((document.getElementById('stocktake-wh') || {}).value) || defaultWarehouseId();
            const n = computeStocktakeDiffs(STATE.inventory || [], whId, STATE.stocktakeCounts || {}).length;
            const el = document.getElementById('stocktake-count'); if (el) el.textContent = fmtNum(n);
        }
        async function handleStocktake() {
            const whId = Number((document.getElementById('stocktake-wh') || {}).value) || defaultWarehouseId();
            const diffs = computeStocktakeDiffs(STATE.inventory || [], whId, STATE.stocktakeCounts || {});
            if (!diffs.length) { showToast('변경 없음', '실사 수량을 입력한 품목이 없거나 시스템 재고와 동일합니다.'); return; }
            if (!confirm(`${warehouseName(whId)} 기준 ${diffs.length}건의 재고를 실사 수량으로 조정합니다. 진행할까요?`)) return;
            let okc = 0, fail = 0;
            for (const dd of diffs) {
                const { error } = await sb.rpc('apply_stock_move', { p_item_id: dd.itemId, p_kind: dd.diff > 0 ? 'in' : 'out', p_qty: Math.abs(dd.diff), p_reason: '재고 실사', p_warehouse_id: whId, p_subtype: '' });
                if (error) fail++; else okc++;
            }
            await reloadInventory(); await reloadInventoryStock(); await reloadStockMoves();
            STATE.stocktakeCounts = {};
            if (STATE.currentTab === 'inventory') setInventoryView(STATE.inventoryView || 'dashboard');
            renderDashboardWidgets(); closeModal('stocktake-modal');
            showToast('실사 완료', `${okc}건 조정 완료${fail ? ` · ${fail}건 실패(권한 등)` : ''}.`);
        }

        // ════════════ 입출고 이력(원장) ════════════
        function ledgerNextDay(s) { try { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); } catch (e) { return s; } }
        async function ledgerFetch(start, end) {
            const { data, error } = await fetchAllPaged(() => sb.from('stock_moves').select('*').gte('created_at', start).lt('created_at', end).order('created_at', { ascending: false }));
            STATE.ledgerError = !!error;
            if (error) return [];
            return (data || []).map(r => { const it = (STATE.inventory || []).find(x => x.id === r.item_id); return { itemId: r.item_id, itemName: it ? it.name : ('#' + r.item_id), sku: it ? it.sku : '', kind: r.kind, subtype: r.subtype || '', qty: Number(r.qty) || 0, warehouseId: r.warehouse_id || null, warehouseName: r.warehouse_id ? warehouseName(r.warehouse_id) : '', balanceAfter: r.balance_after, reason: r.reason || '', actor: r.actor || '', createdAt: r.created_at || '' }; });
        }
        function filterLedgerRows(rows, f) {
            return (rows || []).filter(r => {
                if (f.itemId && String(r.itemId) !== String(f.itemId)) return false;
                if (f.whId && f.whId !== 'all' && String(r.warehouseId) !== String(f.whId)) return false;
                if (f.kind && f.kind !== 'all' && r.kind !== f.kind) return false;
                if (f.q) { const q = f.q.toLowerCase(); if ((String(r.itemName || '') + ' ' + String(r.subtype || '') + ' ' + String(r.reason || '')).toLowerCase().indexOf(q) < 0) return false; }
                return true;
            });
        }
        function openLedger(itemId) {
            if (STATE.inventoryTableMissing) { showToast('준비 필요', '재고 테이블 생성 SQL을 먼저 실행하세요.'); return; }
            STATE.ledgerItemId = itemId || null;
            const now = new Date(), y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
            const s = document.getElementById('ledger-start'), e = document.getElementById('ledger-end');
            if (itemId) { const back = new Date(); back.setMonth(back.getMonth() - 12); if (s) s.value = back.toISOString().slice(0, 10); if (e) e.value = now.toISOString().slice(0, 10); }
            else { if (s && !s.value) s.value = `${y}-${m}-01`; if (e && !e.value) e.value = now.toISOString().slice(0, 10); }
            const wsel = document.getElementById('ledger-wh');
            if (wsel) wsel.innerHTML = `<option value="all">전체 창고</option>` + (STATE.warehouses || []).map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('');
            openModal('ledger-modal');
            loadLedger();
        }
        async function loadLedger() {
            const start = document.getElementById('ledger-start').value, end = document.getElementById('ledger-end').value;
            if (!start || !end) { showToast('기간 확인', '시작일과 종료일을 선택하세요.'); return; }
            document.getElementById('ledger-body').innerHTML = '<div class="text-slate-400 py-6 text-center">불러오는 중…</div>';
            STATE.ledgerAll = await ledgerFetch(start, ledgerNextDay(end));
            renderLedger();
        }
        function renderLedger() {
            const body = document.getElementById('ledger-body'); if (!body) return;
            if (STATE.ledgerError) { body.innerHTML = `<div class="text-center py-10"><div class="text-[13px] font-bold text-slate-600 mb-1">이력을 불러오지 못했습니다</div><div class="text-[12px] text-slate-400 mb-3">네트워크 상태를 확인하고 다시 시도하세요.</div><button onclick="loadLedger()" class="px-4 py-2 rounded-xl text-sm font-bold bg-slate-900 hover:bg-indigo-600 text-white inline-flex items-center gap-1.5"><i data-lucide="refresh-cw" class="w-4 h-4"></i> 다시 시도</button></div>`; if (window.lucide) lucide.createIcons(); return; }
            const whId = (document.getElementById('ledger-wh') || {}).value || 'all';
            const kind = (document.getElementById('ledger-kind') || {}).value || 'all';
            const q = ((document.getElementById('ledger-q') || {}).value || '').trim();
            const rows = filterLedgerRows(STATE.ledgerAll || [], { whId, kind, q, itemId: STATE.ledgerItemId });
            STATE.ledgerDraft = rows;
            const scopeItem = STATE.ledgerItemId ? (STATE.inventory || []).find(x => x.id === STATE.ledgerItemId) : null;
            const banner = scopeItem ? `<div class="mb-2 flex items-center gap-2 text-[13px] bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-1.5"><i data-lucide="filter" class="w-3.5 h-3.5"></i> <b>${esc(scopeItem.name)}</b> 품목만 표시 <button onclick="clearLedgerItem()" class="ml-auto text-amber-700 underline font-bold">전체 품목 보기</button></div>` : '';
            if (!rows.length) { body.innerHTML = banner + '<div class="text-slate-300 py-10 text-center">해당 조건의 입출고 내역이 없습니다.</div>'; if (window.lucide) lucide.createIcons(); return; }
            const shown = rows.slice(0, 500);
            const trs = shown.map(r => `<tr class="border-t border-slate-100">
                <td class="py-2 pr-2 whitespace-nowrap text-slate-500">${(r.createdAt || '').replace('T', ' ').slice(0, 16)}</td>
                <td class="py-2 pr-2"><div class="font-semibold text-slate-700">${esc(r.itemName)}</div><div class="text-[11px] text-slate-400 font-mono">${esc(r.sku)}</div></td>
                <td class="py-2 pr-2">${r.kind === 'in' ? chip('입고', 'success') : chip('출고', 'danger')}${r.subtype ? ` <span class="text-[11px] text-slate-400">${esc(r.subtype)}</span>` : ''}</td>
                <td class="py-2 pr-2 text-right font-bold ${r.kind === 'out' ? 'text-rose-600' : 'text-emerald-600'}">${r.kind === 'out' ? '-' : '+'}${fmtNum(r.qty)}</td>
                <td class="py-2 pr-2 text-slate-500">${esc(r.warehouseName)}</td>
                <td class="py-2 pr-2 text-right text-slate-500">${r.balanceAfter != null ? fmtNum(r.balanceAfter) : '-'}</td>
                <td class="py-2 text-slate-500 truncate max-w-[220px]">${esc(r.actor)}${r.reason ? ' · ' + esc(r.reason) : ''}</td>
            </tr>`).join('');
            body.innerHTML = banner + `<div class="text-[13px] text-slate-500 mb-2 px-1"><b class="text-slate-700">${fmtNum(rows.length)}건</b>${rows.length > 500 ? ' 중 최근 500건 표시' : ''}</div>
                <div class="overflow-x-auto"><table class="w-full text-[13px]"><thead><tr class="text-slate-400 text-left bg-slate-50"><th class="py-2 pr-2 pl-1 font-semibold">일시</th><th class="py-2 pr-2 font-semibold">품목</th><th class="py-2 pr-2 font-semibold">구분</th><th class="py-2 pr-2 font-semibold text-right">수량</th><th class="py-2 pr-2 font-semibold">창고</th><th class="py-2 pr-2 font-semibold text-right">잔량</th><th class="py-2 font-semibold">처리/사유</th></tr></thead><tbody>${trs}</tbody></table></div>`;
            if (window.lucide) lucide.createIcons();
        }
        function clearLedgerItem() { STATE.ledgerItemId = null; renderLedger(); }
        async function exportLedgerXlsx() {
            const rows = STATE.ledgerDraft || [];
            if (!rows.length) { showToast('내보낼 데이터 없음', '먼저 "조회"로 이력을 불러오세요.'); return; }
            const sheets = [{ name: '입출고이력', title: '입출고 이력', headers: ['일시', '품목코드', '품목', '구분', '유형', '수량', '창고', '잔량', '사유', '담당'], aligns: ['left', 'left', 'left', 'center', 'left', 'right', 'left', 'right', 'left', 'left'], numFmts: [, , , , , '#,##0', , '#,##0'], widths: [17, 12, 20, 8, 12, 10, 14, 10, 22, 12], rows: rows.map(r => [(r.createdAt || '').replace('T', ' ').slice(0, 16), r.sku, r.itemName, r.kind === 'in' ? '입고' : '출고', r.subtype, r.qty, r.warehouseName, r.balanceAfter, r.reason, r.actor]) }];
            const okv = await exportStyledWorkbook({ filename: `입출고이력_${xlsxToday()}.xlsx`, sheets });
            if (okv) showToast('내보내기 완료', `${rows.length}건을 엑셀로 저장했습니다.`);
        }

        // 대량 데이터 분할 조회: range로 1000건씩 끝까지 누적 (한도 없음)
        async function fetchAllPaged(buildQuery, pageSize) {
            const PAGE = pageSize || 1000; let from = 0, all = [];
            for (let i = 0; i < 500; i++) {
                const { data, error } = await buildQuery().range(from, from + PAGE - 1);
                if (error) return { data: all, error };
                const batch = data || [];
                all = all.concat(batch);
                if (batch.length < PAGE) break;
                from += PAGE;
            }
            return { data: all, error: null };
        }
        async function reloadInventory() {
            const { data, error } = await fetchAllPaged(() => sb.from('inventory_items').select('*').order('name', { ascending: true }));
            if (error) { STATE.inventoryTableMissing = true; STATE.inventory = []; return; }
            STATE.inventoryTableMissing = false;
            STATE.inventory = (data || []).map(r => ({ id: r.id, sku: r.sku || '', name: r.name, category: r.category || '', unit: r.unit || 'EA', stock: Number(r.stock) || 0, safeStock: Number(r.safe_stock) || 0, unitPrice: Number(r.unit_price) || 0, supplier: r.supplier || '', location: r.location || '', deptId: r.dept_id || '', notes: r.notes || '' }));
        }
        async function reloadStockMoves() {
            const { data, error } = await fetchAllPaged(() => sb.from('stock_moves').select('*').order('created_at', { ascending: false }));
            if (error) { STATE.stockMoves = []; return; }
            STATE.stockMoves = (data || []).map(r => ({ id: r.id, itemId: r.item_id, kind: r.kind, qty: Number(r.qty) || 0, reason: r.reason || '', actor: r.actor || '', actorId: r.actor_id || '', deptId: r.dept_id || '', warehouseId: r.warehouse_id || null, subtype: r.subtype || '', balanceAfter: r.balance_after, createdAt: r.created_at }));
        }
        async function reloadInventoryOptions() {
            STATE.invOptions = STATE.invOptions || { category: [], unit: [], name: [], move_in: [], move_out: [] };
            const { data, error } = await sb.from('inventory_options').select('*').order('value', { ascending: true });
            if (error) { STATE.invOptionsMissing = true; return; }
            STATE.invOptionsMissing = false;
            const o = { category: [], unit: [], name: [], move_in: [], move_out: [] };
            (data || []).forEach(r => { if (o[r.kind]) o[r.kind].push({ id: r.id, value: r.value, code: r.code || '' }); });
            STATE.invOptions = o;
        }
        // SKU 자동 생성: 분류 코드 + 4자리 일련번호 (예: PT-0001)
        function nextSkuForCode(code) {
            code = (code || 'GEN').toString().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GEN';
            let max = 0;
            (STATE.inventory || []).forEach(i => { const s = (i.sku || '').toUpperCase(); const dash = s.lastIndexOf('-'); if (dash > 0 && s.slice(0, dash) === code) { const n = parseInt(s.slice(dash + 1)); if (!isNaN(n)) max = Math.max(max, n); } });
            return code + '-' + String(max + 1).padStart(4, '0');
        }
        function regenInventorySku() {
            if (document.getElementById('inventory-id').value) return; // 편집 시 기존 코드 유지
            const catVal = (document.getElementById('inventory-category') || {}).value || '';
            const opt = (STATE.invOptions.category || []).find(c => c.value === catVal);
            const code = opt && opt.code ? opt.code : (catVal ? 'GEN' : '');
            const skuEl = document.getElementById('inventory-sku');
            skuEl.value = code ? nextSkuForCode(code) : '';
        }
        function populateInventoryOptionSelects(curName, curCat, curUnit) {
            const opts = STATE.invOptions || { category: [], unit: [], name: [] };
            const fill = (id, arr, cur, placeholder) => {
                const el = document.getElementById(id); if (!el) return;
                const list = arr.map(o => `<option value="${esc(o.value)}">${esc(o.value)}</option>`).join('');
                el.innerHTML = `<option value="">${placeholder}</option>` + list;
                // 기존 값이 목록에 없으면(과거 자유입력 데이터) 임시 옵션으로 추가해 보존
                if (cur && !arr.some(o => o.value === cur)) el.innerHTML += `<option value="${esc(cur)}">${esc(cur)} (기존)</option>`;
                el.value = cur || '';
            };
            fill('inventory-name', opts.name || [], curName, '품목명 선택');
            fill('inventory-category', opts.category || [], curCat, '분류 선택');
            fill('inventory-unit', opts.unit || [], curUnit, '단위 선택');
        }
        function openInventoryOptions() {
            if (STATE.invOptionsMissing) { showToast('준비 필요', '옵션 테이블(inventory_options) 생성 SQL을 먼저 실행하세요.'); return; }
            renderInventoryOptions();
            openModal('inventory-options-modal');
        }
        function renderInventoryOptions() {
            const opts = STATE.invOptions || { category: [], unit: [], name: [] };
            const row = (o, kind) => `<div class="flex items-center justify-between gap-2 px-2.5 py-1.5 border border-slate-200 rounded-lg text-[13px]">
                <div class="min-w-0 truncate"><span class="font-semibold text-slate-700">${esc(o.value)}</span>${kind === 'category' && o.code ? ` <span class="text-[11px] text-amber-600 font-mono">${esc(o.code)}</span>` : ''}</div>
                <div class="flex gap-1.5 flex-shrink-0">
                    <button onclick="editInventoryOption(${o.id},'${kind}')" class="text-indigo-500 hover:text-indigo-700 font-bold">편집</button>
                    <button onclick="deleteInventoryOption(${o.id})" class="text-rose-400 hover:text-rose-600 font-bold">삭제</button>
                </div></div>`;
            const setList = (id, arr, kind) => { const el = document.getElementById(id); if (el) el.innerHTML = arr.length ? arr.map(o => row(o, kind)).join('') : `<div class="text-[12px] text-slate-300 py-2 text-center">등록된 항목 없음</div>`; };
            setList('invopt-category-list', opts.category || [], 'category');
            setList('invopt-unit-list', opts.unit || [], 'unit');
            setList('invopt-name-list', opts.name || [], 'name');
            setList('invopt-move_in-list', opts.move_in || [], 'move_in');
            setList('invopt-move_out-list', opts.move_out || [], 'move_out');
            if (window.lucide) lucide.createIcons();
        }
        async function addInventoryOption(kind) {
            const value = (document.getElementById('invopt-' + kind + '-value').value || '').trim();
            if (!value) { showToast('입력 필요', '값을 입력하세요.'); return; }
            const row = { kind, value };
            if (kind === 'category') { const code = (document.getElementById('invopt-category-code').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); row.code = code || null; }
            const { error } = await sb.from('inventory_options').insert(row);
            if (error) { showToast('추가 실패', error.message); return; }
            document.getElementById('invopt-' + kind + '-value').value = '';
            if (kind === 'category') document.getElementById('invopt-category-code').value = '';
            await reloadInventoryOptions(); renderInventoryOptions(); syncInventoryFormOptions();
        }
        async function editInventoryOption(id, kind) {
            const cur = (STATE.invOptions[kind] || []).find(o => o.id === id); if (!cur) return;
            const nv = prompt('이름 수정', cur.value); if (nv === null) return;
            const patch = { value: nv.trim() || cur.value };
            if (kind === 'category') { const nc = prompt('분류 코드(SKU 접두어, 영문/숫자)', cur.code || ''); if (nc !== null) patch.code = (nc.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || null); }
            const { error } = await sb.from('inventory_options').update(patch).eq('id', id);
            if (error) { showToast('수정 실패', error.message); return; }
            await reloadInventoryOptions(); renderInventoryOptions(); syncInventoryFormOptions();
        }
        async function deleteInventoryOption(id) {
            if (!confirm('이 옵션을 삭제하시겠습니까? (이미 등록된 품목 데이터는 그대로 유지됩니다.)')) return;
            const { error } = await sb.from('inventory_options').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadInventoryOptions(); renderInventoryOptions(); syncInventoryFormOptions();
        }

        // ===== 분류/직급 옵션 (편집 가능한 드롭다운, 추가·편집·삭제) =====
        const TAX_DEFAULTS = { position: ['대표이사', '부서장', '팀장', '사원'] };
        function positionList() { return (STATE.taxonomy && STATE.taxonomy.position && STATE.taxonomy.position.length) ? STATE.taxonomy.position : TAX_DEFAULTS.position.map((v, i) => ({ id: 'def-' + i, value: v })); }
        async function reloadTaxonomy() {
            STATE.taxonomy = STATE.taxonomy || { position: [] };
            try {
                const { data, error } = await sb.from('taxonomy_options').select('*').order('sort_order', { ascending: true }).order('value', { ascending: true });
                if (error) throw error;
                STATE.taxonomyMissing = false;
                const o = { position: [] };
                (data || []).forEach(r => { (o[r.category] = o[r.category] || []).push({ id: r.id, value: r.value }); });
                // 테이블은 있으나 직급이 비어 있으면 기본값을 시드(기존 동작 보존)
                if ((o.position || []).length === 0) {
                    try {
                        await sb.from('taxonomy_options').insert(TAX_DEFAULTS.position.map((v, i) => ({ category: 'position', value: v, sort_order: i })));
                        const r2 = await sb.from('taxonomy_options').select('*').eq('category', 'position').order('sort_order', { ascending: true });
                        o.position = (r2.data || []).map(r => ({ id: r.id, value: r.value }));
                    } catch (e) { /* 쓰기 권한 없으면 무시(폴백 사용) */ }
                }
                STATE.taxonomy = o;
            } catch (e) {
                STATE.taxonomyMissing = true;
                STATE.taxonomy = { position: TAX_DEFAULTS.position.map((v, i) => ({ id: 'def-' + i, value: v })) };
            }
            populatePositionSelects();
        }
        function populatePositionSelects() {
            const list = positionList();
            ['signup-position', 'profile-position'].forEach(id => {
                const el = document.getElementById(id); if (!el) return;
                const cur = el.value;
                el.innerHTML = list.map(o => `<option value="${esc(o.value)}">${esc(o.value)}</option>`).join('');
                if (cur && !list.some(o => o.value === cur)) el.innerHTML += `<option value="${esc(cur)}">${esc(cur)} (기존)</option>`;
                if (cur) el.value = cur;
            });
        }
        function openTaxonomyManager() {
            if (!STATE.profile || STATE.profile.role !== 'admin') { showToast('권한 없음', '관리자만 옵션을 관리할 수 있습니다.'); return; }
            if (STATE.taxonomyMissing) { showToast('준비 필요', '옵션 테이블(taxonomy_options) 생성 SQL을 먼저 실행하세요.'); return; }
            renderTaxonomyOptions(); openModal('taxonomy-modal');
        }
        function renderTaxonomyOptions() {
            const arr = positionList();
            const idArg = (id) => typeof id === 'number' ? id : `'${id}'`;
            const row = (o) => `<div class="flex items-center justify-between gap-2 px-2.5 py-2 border border-slate-200 rounded-lg text-[13px]">
                <span class="font-semibold text-slate-700 min-w-0 truncate">${esc(o.value)}</span>
                <div class="flex gap-2 flex-shrink-0">
                    <button onclick="editTaxonomyOption('position',${idArg(o.id)})" class="text-indigo-500 hover:text-indigo-700 font-bold">편집</button>
                    <button onclick="deleteTaxonomyOption('position',${idArg(o.id)})" class="text-rose-400 hover:text-rose-600 font-bold">삭제</button>
                </div></div>`;
            const el = document.getElementById('tax-position-list');
            if (el) el.innerHTML = arr.length ? arr.map(row).join('') : `<div class="text-[12px] text-slate-400 py-2 text-center">등록된 항목 없음</div>`;
            if (window.lucide) lucide.createIcons();
        }
        async function addTaxonomyOption(category) {
            const inp = document.getElementById('tax-' + category + '-value');
            const value = (inp.value || '').trim();
            if (!value) { showToast('입력 필요', '값을 입력하세요.'); return; }
            if (positionList().some(o => o.value === value)) { showToast('중복', '이미 등록된 항목입니다.'); return; }
            const { error } = await sb.from('taxonomy_options').insert({ category, value, sort_order: positionList().length });
            if (error) { showToast('추가 실패', error.message); return; }
            inp.value = '';
            await reloadTaxonomy(); renderTaxonomyOptions();
        }
        async function editTaxonomyOption(category, id) {
            const cur = positionList().find(o => o.id === id); if (!cur) return;
            const nv = prompt('직급명 수정', cur.value); if (nv === null) return;
            const v = nv.trim(); if (!v) return;
            const { error } = await sb.from('taxonomy_options').update({ value: v }).eq('id', id);
            if (error) { showToast('수정 실패', error.message); return; }
            await reloadTaxonomy(); renderTaxonomyOptions();
        }
        async function deleteTaxonomyOption(category, id) {
            if (!confirm('이 항목을 삭제하시겠습니까? (이미 저장된 프로필 데이터는 그대로 유지됩니다.)')) return;
            const { error } = await sb.from('taxonomy_options').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadTaxonomy(); renderTaxonomyOptions();
        }

        // 옵션 변경 시, 품목 폼이 열려 있으면 선택지 즉시 갱신(현재 선택값 보존)
        function syncInventoryFormOptions() {
            if (!document.getElementById('stock-move-modal').classList.contains('hidden')) populateStockMoveSubtype(document.getElementById('stock-move-kind').value);
            const formOpen = !document.getElementById('inventory-form-modal').classList.contains('hidden');
            if (!formOpen) return;
            const n = document.getElementById('inventory-name').value, c = document.getElementById('inventory-category').value, u = document.getElementById('inventory-unit').value;
            populateInventoryOptionSelects(n, c, u);
        }
        function populateStockMoveSubtype(kind) {
            const el = document.getElementById('stock-move-subtype'); if (!el) return;
            const arr = ((STATE.invOptions || {})[kind === 'in' ? 'move_in' : 'move_out']) || [];
            const cur = el.value;
            el.innerHTML = `<option value="">유형 선택 (선택 사항)</option>` + arr.map(o => `<option value="${esc(o.value)}">${esc(o.value)}</option>`).join('');
            if (cur && [...el.options].some(o => o.value === cur)) el.value = cur;
        }
        function inventoryApplyFilter() { resetPage('inventory'); renderInventory(); }
        function setInventoryView(view) {
            STATE.inventoryView = view;
            const dv = document.getElementById('inventory-dashboard-view'), lv = document.getElementById('inventory-list-view');
            const td = document.getElementById('inv-tab-dashboard'), tl = document.getElementById('inv-tab-list');
            const on = 'px-4 py-1.5 rounded-lg text-sm font-bold bg-white shadow text-slate-800', off = 'px-4 py-1.5 rounded-lg text-sm font-bold text-slate-500';
            if (view === 'list') { if (dv) dv.classList.add('hidden'); if (lv) lv.classList.remove('hidden'); if (td) td.className = off; if (tl) tl.className = on; renderInventory(); }
            else { if (lv) lv.classList.add('hidden'); if (dv) dv.classList.remove('hidden'); if (tl) tl.className = off; if (td) td.className = on; renderInventoryDashboard(); }
            if (window.lucide) lucide.createIcons();
        }
        function inventoryEmptyStateHTML() {
            const noWh = !(STATE.warehouses || []).length;
            const noItem = !(STATE.inventory || []).length;
            const wrap = (icon, title, desc, btns) => `<div class="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
                <div class="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><i data-lucide="${icon}" class="w-7 h-7 text-slate-400"></i></div>
                <div class="text-base font-bold text-slate-700">${title}</div>
                <div class="text-[13px] text-slate-400 mt-1 mb-4 max-w-sm mx-auto">${desc}</div>
                <div class="flex gap-2 justify-center flex-wrap">${btns}</div></div>`;
            const btn = (label, onclick, primary, icon) => `<button onclick="${onclick}" class="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 ${primary ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}"><i data-lucide="${icon}" class="w-4 h-4"></i> ${label}</button>`;
            if (noWh) return wrap('warehouse', '창고가 아직 없습니다', '재고를 관리하려면 먼저 보관 장소(창고)를 1개 이상 등록하세요.', btn('창고 등록', 'openWarehouseManager()', true, 'plus-circle'));
            if (noItem) return wrap('package-open', '등록된 품목이 없습니다', '첫 품목을 직접 등록하거나, 엑셀 파일로 한 번에 가져올 수 있습니다.', btn('품목 등록', 'openInventoryForm()', true, 'plus-circle') + btn('엑셀 가져오기', "triggerImport('inventory')", false, 'upload'));
            return '';
        }
        function inventoryErrorStateHTML() {
            return `<div class="bg-white border border-dashed border-rose-300 rounded-2xl p-10 text-center">
                <div class="w-14 h-14 mx-auto rounded-2xl bg-rose-50 flex items-center justify-center mb-3"><i data-lucide="cloud-off" class="w-7 h-7 text-rose-400"></i></div>
                <div class="text-base font-bold text-slate-700">재고 데이터를 불러오지 못했습니다</div>
                <div class="text-[13px] text-slate-400 mt-1 mb-4 max-w-sm mx-auto">네트워크 상태를 확인해 주세요. 재고 테이블이 아직 준비되지 않았다면 안내된 준비 SQL을 먼저 실행해야 합니다.</div>
                <button onclick="retryInventoryLoad()" class="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-900 hover:bg-indigo-600 text-white inline-flex items-center gap-1.5"><i data-lucide="refresh-cw" class="w-4 h-4"></i> 다시 시도</button>
            </div>`;
        }
        async function retryInventoryLoad() {
            const dash = document.getElementById('inventory-dashboard-body'); if (dash) dash.innerHTML = '<div class="text-slate-400 py-10 text-center">불러오는 중…</div>';
            await reloadWarehouses(); await reloadInventory(); await reloadInventoryStock(); await reloadStockMoves(); await reloadInventoryOptions();
            if (STATE.currentTab === 'inventory') setInventoryView(STATE.inventoryView || 'dashboard'); else renderInventory();
            renderDashboardWidgets();
            if (STATE.inventoryTableMissing) showToast('불러오기 실패', '재고 데이터를 가져오지 못했습니다. 잠시 후 다시 시도하세요.');
            else showToast('새로고침 완료', '최신 재고 데이터를 불러왔습니다.');
        }
        function renderInventory() {
            const list0 = STATE.inventory || [];
            // 분류 필터 옵션 채우기
            const catSel = document.getElementById('inventory-filter-cat');
            if (catSel) { const cats = [...new Set(list0.map(i => i.category).filter(Boolean))].sort(); const keep = catSel.value || 'all'; catSel.innerHTML = `<option value="all">전체 분류</option>` + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join(''); catSel.value = [...catSel.options].some(o => o.value === keep) ? keep : 'all'; }
            const fc = (document.getElementById('inventory-filter-cat') || {}).value || 'all';
            populateInventoryWarehouseFilter();
            const fd = (document.getElementById('inventory-filter-dept') || {}).value || 'all';
            const fw = (document.getElementById('inventory-filter-wh') || {}).value || 'all';
            const dispQty = (i) => fw === 'all' ? Number(i.stock) : itemWhQty(i.id, fw);
            const flow = (document.getElementById('inventory-filter-low') || {}).checked;
            const q = ((document.getElementById('inventory-search') || {}).value || '').trim().toLowerCase();
            const list = list0.filter(i =>
                (fc === 'all' || i.category === fc) &&
                (fd === 'all' || i.deptId === fd) &&
                (!flow || isLowStock(i)) &&
                (!q || (i.name + ' ' + i.sku + ' ' + i.supplier).toLowerCase().indexOf(q) >= 0)
            );
            // 통계
            const stats = document.getElementById('inventory-stats');
            if (stats) {
                const lowCnt = list0.filter(isLowStock).length;
                const totalQty = list0.reduce((s, i) => s + dispQty(i), 0);
                const card = (label, val, sub, tone) => `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4"><div class="text-[12px] font-bold text-slate-400">${label}</div><div class="text-2xl font-extrabold ${tone} mt-1">${val}</div><div class="text-[11px] text-slate-400 mt-0.5">${sub}</div></div>`;
                stats.innerHTML = card('총 품목', fmtNum(list0.length), '등록된 품목 수', 'text-slate-800') + card('재고 부족', fmtNum(lowCnt), '안전재고 이하', lowCnt ? 'text-rose-600' : 'text-slate-800') + card(fw === 'all' ? '재고 총수량' : warehouseName(fw) + ' 수량', fmtNum(totalQty), fw === 'all' ? '전체 수량 합계' : '선택 창고 합계', 'text-slate-800');
            }
            // 표(데스크탑)
            const body = document.getElementById('inventory-list-body');
            const cards = document.getElementById('inventory-card-list');
            if (list.length === 0) {
                const es = STATE.inventoryTableMissing ? inventoryErrorStateHTML() : inventoryEmptyStateHTML();
                if (es) {
                    if (body) body.innerHTML = `<tr><td colspan="7" class="p-3">${es}</td></tr>`;
                    if (cards) cards.innerHTML = `<div class="sm:col-span-2">${es}</div>`;
                } else {
                    if (body) body.innerHTML = `<tr><td colspan="7" class="wsp-empty">조건에 맞는 품목이 없습니다.</td></tr>`;
                    if (cards) cards.innerHTML = `<div class="wsp-empty sm:col-span-2">조건에 맞는 품목이 없습니다.</div>`;
                }
                if (window.lucide) lucide.createIcons();
                const dv0 = document.getElementById('inventory-dashboard-view');
                if (STATE.inventoryView === 'dashboard' && dv0 && !dv0.classList.contains('hidden')) renderInventoryDashboard();
                return;
            }
            const shown = list.slice(0, pageCount('inventory'));
            const actionsFor = (i) => {
                const manage = canManageInventory(i);
                return manage
                    ? `<button onclick="event.stopPropagation();openStockMove(${i.id},'in')" class="text-emerald-600 hover:text-emerald-800 font-bold mr-2">입고</button><button onclick="event.stopPropagation();openStockMove(${i.id},'out')" class="text-rose-500 hover:text-rose-700 font-bold mr-2">출고</button><button onclick="event.stopPropagation();openInventoryForm(${i.id})" class="text-indigo-500 hover:text-indigo-700 font-bold mr-2">편집</button><button onclick="event.stopPropagation();deleteInventoryItem(${i.id})" class="text-rose-400 hover:text-rose-600 font-bold">삭제</button>`
                    : `<span class="text-slate-300">열람</span>`;
            };
            if (body) body.innerHTML = shown.map(i => {
                const dept = STATE.departments.find(d => d.id === i.deptId);
                const low = isLowStock(i);
                return `<tr class="hover:bg-amber-50/30 align-top cursor-pointer ${low ? 'bg-rose-50/30' : ''}" onclick="openInventoryDetail(${i.id})">
                    <td class="px-4 py-3"><div class="font-bold text-slate-800">${esc(i.name)}</div><div class="text-[12px] text-slate-400 font-mono">${esc(i.sku) || '-'}</div></td>
                    <td class="px-4 py-3 text-slate-600">${esc(i.category) || '-'}</td>
                    <td class="px-4 py-3 text-right"><span class="font-bold ${low ? 'text-rose-600' : 'text-slate-800'}">${fmtNum(dispQty(i))}</span> <span class="text-[12px] text-slate-400">${esc(i.unit)}</span>${fw !== 'all' ? ` <span class="text-[11px] text-slate-300">/${fmtNum(i.stock)}</span>` : ''}${low ? ' ' + chip('부족', 'danger') : ''}</td>
                    <td class="px-4 py-3 text-right text-slate-500">${fmtNum(i.safeStock)}</td>
                    <td class="px-4 py-3 text-right text-slate-600">₩${fmtNum(i.unitPrice)}</td>
                    <td class="px-4 py-3"><div class="text-slate-700">${esc(i.supplier) || '-'}</div><div class="text-[12px] text-slate-400">${dept ? esc(dept.name) : '-'}</div></td>
                    <td class="px-4 py-3 text-right whitespace-nowrap text-[13px]">${actionsFor(i)}</td>
                </tr>`;
            }).join('') + moreRowHTML(list.length, 'inventory', 7);
            // 카드(모바일)
            if (cards) cards.innerHTML = shown.map(i => {
                const dept = STATE.departments.find(d => d.id === i.deptId);
                const low = isLowStock(i);
                return `<div class="bg-white rounded-2xl border ${low ? 'border-rose-200' : 'border-slate-200'} shadow-sm p-4 space-y-2" onclick="openInventoryDetail(${i.id})">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0"><div class="font-bold text-slate-800 truncate">${esc(i.name)}</div><div class="text-[12px] text-slate-400 font-mono">${esc(i.sku) || '-'} ${i.category ? '· ' + esc(i.category) : ''}</div></div>
                        ${low ? chip('부족', 'danger') : chip('정상', 'success')}
                    </div>
                    <div class="flex items-end justify-between">
                        <div><span class="text-2xl font-extrabold ${low ? 'text-rose-600' : 'text-slate-800'}">${fmtNum(dispQty(i))}</span> <span class="text-[12px] text-slate-400">${esc(i.unit)}${fw !== 'all' ? ' /' + fmtNum(i.stock) : ''} (안전 ${fmtNum(i.safeStock)})</span></div>
                        <div class="text-[12px] text-slate-400 text-right">${esc(i.supplier) || ''}<br>${dept ? esc(dept.name) : ''}</div>
                    </div>
                    <div class="flex gap-2 pt-1 text-[13px]" onclick="event.stopPropagation()">${actionsFor(i)}</div>
                </div>`;
            }).join('') + (list.length > pageCount('inventory') ? `<div class="sm:col-span-2">${moreDivHTML(list.length, 'inventory')}</div>` : '');
            if (window.lucide) lucide.createIcons();
            const dv = document.getElementById('inventory-dashboard-view');
            if (STATE.inventoryView === 'dashboard' && dv && !dv.classList.contains('hidden')) renderInventoryDashboard();
        }
        function openInventoryForm(id) {
            if (STATE.inventoryTableMissing) { showToast('준비 필요', '재고 테이블 생성 SQL을 먼저 실행하세요.'); return; }
            const it = id ? STATE.inventory.find(x => x.id === id) : null;
            if (it && !canManageInventory(it)) { showToast('권한 없음', '본인 부서의 품목만 편집할 수 있습니다.'); return; }
            document.getElementById('inventory-id').value = id || '';
            populateInventoryOptionSelects(it ? it.name : '', it ? it.category : '', it ? it.unit : '');
            document.getElementById('inventory-sku').value = it ? it.sku : '';
            document.getElementById('inventory-stock').value = '';
            document.getElementById('inventory-safe').value = it ? it.safeStock : '';
            document.getElementById('inventory-price').value = it ? it.unitPrice : '';
            document.getElementById('inventory-supplier').value = it ? it.supplier : '';
            document.getElementById('inventory-location').value = it ? it.location : '';
            const dsel = document.getElementById('inventory-dept'); if (dsel) dsel.value = it ? (it.deptId || STATE.profile.deptId) : (STATE.profile.deptId || '');
            document.getElementById('inventory-notes').value = it ? it.notes : '';
            document.getElementById('inventory-form-title').innerText = id ? '품목 편집' : '품목 등록';
            const whWrap = document.getElementById('inventory-warehouse-wrap'), stockEl = document.getElementById('inventory-stock'), stockLabel = document.getElementById('inventory-stock-label'), whInfo = document.getElementById('inventory-form-wh-info');
            fillWarehouseSelect('inventory-warehouse', defaultWarehouseId());
            stockEl.readOnly = false; stockEl.classList.remove('bg-slate-50', 'text-slate-400'); stockEl.value = '';
            if (whWrap) whWrap.style.display = '';
            if (id && it) {
                if (stockLabel) stockLabel.innerHTML = '추가 입고 수량 <span class="text-[11px] text-slate-400 font-normal">(선택 · 입력 시 아래 창고로 입고)</span>';
                stockEl.placeholder = '추가 입고할 수량';
                if (whInfo) { const chips = (STATE.warehouses || []).map(w => { const q = itemWhQty(it.id, w.id); return `<span class="wsp-chip ${q > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}">${esc(w.name)} <b>${fmtNum(q)}</b></span>`; }).join(''); whInfo.innerHTML = `<div class="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1"><i data-lucide="warehouse" class="w-3 h-3"></i> 현재 창고별 재고 (총 ${fmtNum(it.stock)} ${esc(it.unit)})</div><div class="flex flex-wrap gap-1.5">${chips || '<span class="text-[12px] text-slate-300">없음</span>'}</div>`; whInfo.style.display = ''; }
            } else {
                if (stockLabel) stockLabel.innerHTML = '기초재고 <span class="text-[11px] text-slate-400 font-normal">(신규 등록 시 입고)</span>';
                stockEl.placeholder = '0';
                if (whInfo) whInfo.style.display = 'none';
            }
            openModal('inventory-form-modal'); if (window.lucide) lucide.createIcons();
        }
        async function handleSaveInventoryItem(e) {
            e.preventDefault();
            const id = document.getElementById('inventory-id').value;
            if (!id && !document.getElementById('inventory-sku').value) regenInventorySku();
            let sku = document.getElementById('inventory-sku').value.trim();
            if (!id && !sku) sku = nextSkuForCode('GEN');
            const openingQty = parseFloat(document.getElementById('inventory-stock').value) || 0;
            const whId = parseInt(document.getElementById('inventory-warehouse').value) || defaultWarehouseId();
            const row = { name: document.getElementById('inventory-name').value.trim(), sku: sku, category: document.getElementById('inventory-category').value.trim(), unit: document.getElementById('inventory-unit').value.trim() || 'EA', safe_stock: parseFloat(document.getElementById('inventory-safe').value) || 0, unit_price: parseFloat(document.getElementById('inventory-price').value) || 0, supplier: document.getElementById('inventory-supplier').value.trim(), location: document.getElementById('inventory-location').value.trim(), dept_id: document.getElementById('inventory-dept').value, notes: document.getElementById('inventory-notes').value.trim() };
            if (!row.name) { showToast('입력 필요', '품목명을 선택하세요. (없으면 "옵션 관리"에서 추가)'); return; }
            let error;
            if (id) { ({ error } = await sb.from('inventory_items').update(row).eq('id', parseInt(id))); }   // 재고(stock)는 입출고로만 변경
            else { ({ error } = await sb.from('inventory_items').insert(Object.assign({ stock: 0 }, row))); }
            if (error) { showToast('저장 실패', error.message); return; }
            // 신규=기초재고 / 편집=추가 입고: 입력 시 선택 창고로 원자적 입고(업그레이드된 창고 기능을 편집에서도 사용)
            let _targetId = id ? parseInt(id) : null;
            if (!id && openingQty > 0) { await reloadInventory(); const created = (STATE.inventory || []).find(x => x.sku === sku); _targetId = created ? created.id : null; }
            if (openingQty > 0 && _targetId && whId) { await sb.rpc('apply_stock_move', { p_item_id: _targetId, p_kind: 'in', p_qty: openingQty, p_reason: id ? '추가 입고' : '기초재고', p_warehouse_id: whId }); }
            await reloadInventory(); await reloadInventoryStock(); await reloadStockMoves(); renderInventory(); renderDashboardWidgets(); closeModal('inventory-form-modal');
            if (id && !document.getElementById('inventory-detail-modal').classList.contains('hidden')) openInventoryDetail(parseInt(id));
            showToast('저장 완료', id ? '품목 정보가 수정되었습니다.' : '품목이 등록되었습니다.');
        }
        // ── 창고 간 재고 이동(이고) ──
        function openTransferModal(itemId) {
            const it = STATE.inventory.find(x => x.id === itemId); if (!it) return;
            if (!canManageInventory(it)) { showToast('권한 없음', '본인 부서의 품목만 처리할 수 있습니다.'); return; }
            if ((STATE.warehouses || []).length < 2) { showToast('창고 부족', '창고가 2개 이상일 때 이동할 수 있습니다. "창고"에서 추가하세요.'); return; }
            document.getElementById('transfer-item-id').value = itemId;
            fillWarehouseSelect('transfer-from', (STATE.warehouses[0] || {}).id);
            fillWarehouseSelect('transfer-to', (STATE.warehouses[1] || {}).id);
            document.getElementById('transfer-qty').value = '';
            document.getElementById('transfer-reason').value = '';
            updateTransferInfo();
            openModal('transfer-modal');
        }
        function updateTransferInfo() {
            const itemId = parseInt(document.getElementById('transfer-item-id').value);
            const it = STATE.inventory.find(x => x.id === itemId); if (!it) return;
            const from = parseInt(document.getElementById('transfer-from').value);
            document.getElementById('transfer-item-info').innerHTML = `<b>${esc(it.name)}</b> <span class="text-slate-400">${esc(it.sku)}</span><br><span class="text-slate-500">${esc(warehouseName(from))} 보유 <b class="text-slate-700">${fmtNum(itemWhQty(itemId, from))}</b> ${esc(it.unit)}</span>`;
        }
        async function handleTransfer(e) {
            e.preventDefault();
            const itemId = parseInt(document.getElementById('transfer-item-id').value);
            const from = parseInt(document.getElementById('transfer-from').value);
            const to = parseInt(document.getElementById('transfer-to').value);
            const qty = parseFloat(document.getElementById('transfer-qty').value);
            const reason = document.getElementById('transfer-reason').value.trim();
            if (from === to) { showToast('창고 확인', '출발 창고와 도착 창고가 같습니다.'); return; }
            if (!(qty > 0)) { showToast('수량 확인', '0보다 큰 수량을 입력하세요.'); return; }
            const { error } = await sb.rpc('transfer_stock', { p_item_id: itemId, p_from_wh: from, p_to_wh: to, p_qty: qty, p_reason: reason || '창고 이동' });
            if (error) {
                const m = (error.message || '').toLowerCase();
                if (m.indexOf('insufficient') >= 0) showToast('재고 부족', '출발 창고의 재고가 부족합니다.');
                else if (m.indexOf('same warehouse') >= 0) showToast('창고 확인', '서로 다른 창고를 선택하세요.');
                else if (m.indexOf('forbidden') >= 0) showToast('권한 없음', '본인 부서의 품목만 이동할 수 있습니다.');
                else if (m.indexOf('does not exist') >= 0 || m.indexOf('transfer_stock') >= 0 || m.indexOf('function') >= 0) showToast('준비 필요', '재고 이동 함수(transfer_stock) 생성 SQL을 먼저 실행하세요.');
                else showToast('이동 실패', error.message);
                return;
            }
            await reloadInventory(); await reloadStockMoves(); await reloadInventoryStock(); renderInventory(); renderDashboardWidgets(); closeModal('transfer-modal');
            if (!document.getElementById('inventory-detail-modal').classList.contains('hidden')) openInventoryDetail(itemId);
            showToast('이동 완료', `${esc(warehouseName(from))} → ${esc(warehouseName(to))} ${fmtNum(qty)} ${esc(it_unit(itemId))} 이동했습니다.`);
        }
        function it_unit(itemId) { const it = STATE.inventory.find(x => x.id === itemId); return it ? it.unit : ''; }
        function openStockMove(itemId, kind) {
            const it = STATE.inventory.find(x => x.id === itemId); if (!it) return;
            if (!canManageInventory(it)) { showToast('권한 없음', '본인 부서의 품목만 처리할 수 있습니다.'); return; }
            document.getElementById('stock-move-item-id').value = itemId;
            document.getElementById('stock-move-kind').value = kind;
            document.getElementById('stock-move-qty').value = '';
            document.getElementById('stock-move-reason').value = '';
            document.getElementById('stock-move-title').innerText = kind === 'in' ? '입고 처리' : '출고 처리';
            fillWarehouseSelect('stock-move-warehouse', defaultWarehouseId());
            populateStockMoveSubtype(kind);
            updateStockMoveWhInfo();
            const btn = document.getElementById('stock-move-submit');
            btn.className = `flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-bold ${kind === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`;
            btn.innerText = kind === 'in' ? '입고 처리' : '출고 처리';
            openModal('stock-move-modal');
        }
        async function handleStockMove(e) {
            e.preventDefault();
            const itemId = parseInt(document.getElementById('stock-move-item-id').value);
            const kind = document.getElementById('stock-move-kind').value;
            const it = STATE.inventory.find(x => x.id === itemId); if (!it) return;
            const qty = parseFloat(document.getElementById('stock-move-qty').value);
            if (!(qty > 0)) { showToast('수량 확인', '0보다 큰 수량을 입력하세요.'); return; }
            const reason = document.getElementById('stock-move-reason').value.trim();
            const whId = parseInt(document.getElementById('stock-move-warehouse').value) || defaultWarehouseId();
            const subtype = (document.getElementById('stock-move-subtype') || {}).value || null;
            // 서버 함수로 원자적 처리(행 잠금): 동시 입·출고에도 수치가 어긋나지 않음
            const { data, error } = await sb.rpc('apply_stock_move', { p_item_id: itemId, p_kind: kind, p_qty: qty, p_reason: reason, p_warehouse_id: whId, p_subtype: subtype });
            if (error) {
                const m = (error.message || '').toLowerCase();
                if (m.indexOf('insufficient') >= 0) showToast('재고 부족', `출고 수량이 현재고보다 많습니다.`);
                else if (m.indexOf('forbidden') >= 0) showToast('권한 없음', '본인 부서의 품목만 처리할 수 있습니다.');
                else if (m.indexOf('does not exist') >= 0 || m.indexOf('apply_stock_move') >= 0 || m.indexOf('function') >= 0) showToast('준비 필요', '재고 처리 함수(apply_stock_move) 생성 SQL을 먼저 실행하세요.');
                else showToast('처리 실패', error.message);
                return;
            }
            const next = data && data.stock != null ? Number(data.stock) : null;
            logAudit(kind === 'in' ? 'stock_in' : 'stock_out', it.name, `${fmtNum(qty)}${it.unit}${next != null ? ' → 잔량 ' + fmtNum(next) : ''}`);
            await reloadInventory(); await reloadStockMoves(); await reloadInventoryStock(); renderInventory(); renderDashboardWidgets(); closeModal('stock-move-modal');
            if (!document.getElementById('inventory-detail-modal').classList.contains('hidden')) openInventoryDetail(itemId);
            showToast(kind === 'in' ? '입고 완료' : '출고 완료', `${esc(it.name)}${next != null ? ' 잔량 ' + fmtNum(next) + ' ' + esc(it.unit) : ''}`);
        }
        function openInventoryDetail(id) {
            const it = STATE.inventory.find(x => x.id === id); if (!it) return;
            STATE._openDetail = { type: 'inventory', id };
            const dept = STATE.departments.find(d => d.id === it.deptId);
            const low = isLowStock(it);
            const manage = canManageInventory(it);
            const field = (label, val) => `<div><div class="text-[12px] font-bold text-slate-400 mb-0.5">${label}</div><div class="text-sm text-slate-700 font-semibold">${val}</div></div>`;
            const moves = (STATE.stockMoves || []).filter(m => m.itemId === id).slice(0, 12);
            const moveRows = moves.length ? moves.map(m => `<tr class="border-t border-slate-100"><td class="py-2 pr-2">${(m.createdAt || '').slice(0, 10)}</td><td class="py-2 pr-2">${m.kind === 'in' ? chip('입고', 'success') : (m.kind === 'out' ? chip('출고', 'danger') : chip('조정', 'neutral'))}${m.subtype ? ` <span class="text-[11px] text-slate-400">${esc(m.subtype)}</span>` : ''}</td><td class="py-2 pr-2 text-right font-bold ${m.kind === 'out' ? 'text-rose-600' : 'text-emerald-600'}">${m.kind === 'out' ? '-' : '+'}${fmtNum(m.qty)}</td><td class="py-2 pr-2 text-right text-slate-500">${m.balanceAfter != null ? fmtNum(m.balanceAfter) : '-'}</td><td class="py-2 text-slate-500 truncate">${m.warehouseId ? esc(warehouseName(m.warehouseId)) + ' · ' : ''}${esc(m.actor) || ''} ${m.reason ? '· ' + esc(m.reason) : ''}</td></tr>`).join('') : `<tr><td colspan="5" class="py-6 text-center text-slate-300 text-[13px]">입출고 이력이 없습니다.</td></tr>`;
            const ctrl = manage ? `<div class="flex gap-2 flex-wrap"><button onclick="openStockMove(${it.id},'in')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">입고</button><button onclick="openStockMove(${it.id},'out')" class="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg">출고</button>${(STATE.warehouses || []).length >= 2 ? `<button onclick="openTransferModal(${it.id})" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg">창고 이동</button>` : ''}<button onclick="createPoFromItem(${it.id})" class="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg">발주서</button><button onclick="openInventoryForm(${it.id})" class="px-3 py-2 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg">편집</button><button onclick="deleteInventoryItem(${it.id})" class="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg">삭제</button></div>` : '<span class="text-[12px] text-slate-400">본인 부서 품목만 관리할 수 있습니다.</span>';
            document.getElementById('inventory-detail-body').innerHTML = `
                <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                    <div class="flex items-start justify-between gap-3 flex-wrap">
                        <div class="space-y-2">
                            <div class="flex items-center gap-2 flex-wrap">${low ? chip('재고 부족', 'danger') : chip('정상', 'success')}<span class="wsp-chip ${dept ? dept.textTheme : 'bg-slate-100 text-slate-600 border-slate-200'}">${dept ? esc(dept.name) : '부서 미지정'}</span></div>
                            <h3 class="text-xl font-extrabold text-slate-800">${esc(it.name)}</h3>
                            <div class="text-[13px] text-slate-400 font-mono">${esc(it.sku) || '코드 미등록'} ${it.category ? '· ' + esc(it.category) : ''}</div>
                        </div>
                        ${ctrl}
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        ${field('현재고', `<span class="${low ? 'text-rose-600' : ''}">${fmtNum(it.stock)} ${esc(it.unit)}</span>`)}
                        ${field('안전재고', fmtNum(it.safeStock) + ' ' + esc(it.unit))}
                        ${field('단가', '₩' + fmtNum(it.unitPrice))}
                        ${field('재고 금액', '₩' + fmtNum(it.stock * it.unitPrice))}
                        ${field('거래처', esc(it.supplier) || '-')}
                        ${field('보관 위치', esc(it.location) || '-')}
                    </div>
                    ${(STATE.warehouses || []).length ? `<div class="border-t border-slate-100 pt-3"><div class="text-[12px] font-bold text-slate-400 mb-1.5 flex items-center gap-1"><i data-lucide="warehouse" class="w-3.5 h-3.5"></i> 창고별 재고</div><div class="flex flex-wrap gap-2">${(STATE.warehouses || []).map(w => { const q = itemWhQty(it.id, w.id); return `<span class="wsp-chip ${q > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}">${esc(w.name)} <b>${fmtNum(q)}</b> ${esc(it.unit)}</span>`; }).join('')}</div></div>` : ''}
                    ${it.notes ? `<div class="border-t border-slate-100 pt-3"><div class="text-[12px] font-bold text-slate-400 mb-0.5">비고</div><div class="text-sm text-slate-700 whitespace-pre-line">${esc(it.notes)}</div></div>` : ''}
                </div>
                <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                    <div class="flex items-center justify-between gap-2 mb-2"><div class="text-[13px] font-bold text-slate-600 flex items-center gap-1.5"><i data-lucide="history" class="w-4 h-4 text-amber-600"></i> 최근 입출고 이력</div><button onclick="closeModal('inventory-detail-modal'); openLedger(${it.id})" class="px-2.5 py-1 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-[12px] font-bold flex items-center gap-1"><i data-lucide="list" class="w-3.5 h-3.5"></i> 전체 이력</button></div>
                    <div class="overflow-x-auto"><table class="w-full text-[13px]"><thead><tr class="text-slate-400 text-left"><th class="py-1 pr-2 font-semibold">일자</th><th class="py-1 pr-2 font-semibold">구분</th><th class="py-1 pr-2 font-semibold text-right">수량</th><th class="py-1 pr-2 font-semibold text-right">잔량</th><th class="py-1 font-semibold">처리/사유</th></tr></thead><tbody>${moveRows}</tbody></table></div>
                </div>`;
            openModal('inventory-detail-modal'); if (window.lucide) lucide.createIcons();
        }
        async function deleteInventoryItem(id) {
            const it = STATE.inventory.find(x => x.id === id); if (!it) return;
            if (!canManageInventory(it)) { showToast('권한 없음', '본인 부서의 품목만 삭제할 수 있습니다.'); return; }
            if (!confirm(`품목 [${it.name}] 을(를) 삭제하시겠습니까?`)) return;
            const { error } = await sb.from('inventory_items').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            logAudit('inventory_delete', it.name, '');
            await reloadInventory(); renderInventory(); renderDashboardWidgets(); closeModal('inventory-detail-modal');
            showToast('삭제', '품목이 삭제되었습니다.');
        }

        // ════════════ 발주 · 견적 ════════════
        const TRADE_KIND = { po: ['발주서', 'warn'], quote: ['견적서', 'info'] };
        const TRADE_STATUS = { draft: ['작성', 'neutral'], issued: ['발행', 'info'], done: ['완료', 'success'] };
        function canManageTrade(t) { return STATE.profile.role === 'admin' || (t && t.deptId === STATE.profile.deptId); }
        const DEFAULT_COMPANY = { name: 'SLENO CO., LTD.', website: 'www.sleno.co.kr', address: '1306~7, M-Cluster, 17, Deog-an-ro 104beon-gil, Gwangmyeong-si, Gyeonggi-do, 14353 Republic of Korea', tel: '+82-2-6335-0416', fax: '+82-2-6335-0422', email: 'felix.park@sleno.co.kr', logo: 'data:image/png;base64,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' };
        function company() { return STATE.company || DEFAULT_COMPANY; }
        // ════════════ 거래처 마스터 ════════════
        const PARTNER_KIND = { both: ['공통', 'neutral'], client: ['고객사', 'info'], supplier: ['공급처', 'warn'] };
        async function reloadPartners() {
            const { data, error } = await fetchAllPaged(() => sb.from('partners').select('*').order('name', { ascending: true }));
            if (error) { STATE.partnersMissing = true; STATE.partners = []; return; }
            STATE.partnersMissing = false;
            STATE.partners = (data || []).map(r => ({ id: r.id, name: r.name, kind: r.kind || 'both', contact: r.contact || '', tel: r.tel || '', fax: r.fax || '', email: r.email || '', address: r.address || '', bizNo: r.biz_no || '', notes: r.notes || '' }));
            populateTradePartnerDatalist();
        }
        function populateTradePartnerDatalist() {
            const dl = document.getElementById('trade-partner-list'); if (!dl) return;
            dl.innerHTML = (STATE.partners || []).map(p => `<option value="${esc(p.name)}">${p.contact ? esc(p.contact) : ''}</option>`).join('');
        }
        function findPartnerByName(name) {
            const n = String(name || '').trim().toLowerCase(); if (!n) return null;
            return (STATE.partners || []).find(x => String(x.name).trim().toLowerCase() === n) || null;
        }
        function partnerPersonText(p) {
            if (!p) return '';
            const tel = p.tel || p.mobile || '';
            return [p.contact, tel].filter(Boolean).join(tel && p.contact ? ' / ' : '');
        }
        function onTradeClientChange() {
            const nameEl = document.getElementById('trade-client'); if (!nameEl) return;
            const p = findPartnerByName(nameEl.value);
            if (!p) return;
            const built = partnerPersonText(p);
            const personEl = document.getElementById('trade-person');
            if (built && personEl) {
                const cur = (personEl.value || '').trim();
                if (cur === '' || cur === STATE.tradeAutoPerson) { personEl.value = built; STATE.tradeAutoPerson = built; }
            }
            showToast('거래처 자동 입력', `${p.name}의 담당자·연락처를 불러왔습니다.`);
        }
        function openPartnerManager() {
            if (STATE.partnersMissing) { showToast('준비 필요', '거래처 테이블(partners) 생성 SQL을 먼저 실행하세요.'); return; }
            resetPartnerForm(); renderPartnerList(); openModal('partner-modal');
        }
        function renderPartnerList() {
            const wrap = document.getElementById('partner-list'); if (!wrap) return;
            const q = ((document.getElementById('partner-search') || {}).value || '').trim().toLowerCase();
            const list = (STATE.partners || []).filter(p => !q || (p.name + ' ' + p.contact + ' ' + p.tel).toLowerCase().indexOf(q) >= 0);
            if (!list.length) { wrap.innerHTML = `<div class="wsp-empty">등록된 거래처가 없습니다.</div>`; return; }
            wrap.innerHTML = list.map(p => {
                const k = PARTNER_KIND[p.kind] || PARTNER_KIND.both;
                return `<div class="flex items-start justify-between gap-2 px-3 py-2 border border-slate-200 rounded-xl">
                    <div class="min-w-0">
                        <div class="font-bold text-slate-800 text-sm flex items-center gap-1.5">${esc(p.name)} ${chip(k[0], k[1])}</div>
                        <div class="text-[12px] text-slate-400 truncate">${esc(p.contact)}${p.tel ? ' · ' + esc(p.tel) : ''}${p.email ? ' · ' + esc(p.email) : ''}</div>
                    </div>
                    <div class="flex gap-1.5 flex-shrink-0 text-[12px]">
                        <button onclick="editPartner(${p.id})" class="text-indigo-500 hover:text-indigo-700 font-bold">편집</button>
                        <button onclick="deletePartner(${p.id})" class="text-rose-400 hover:text-rose-600 font-bold">삭제</button>
                    </div>
                </div>`;
            }).join('');
            if (window.lucide) lucide.createIcons();
        }
        function resetPartnerForm() {
            ['partner-id', 'partner-name', 'partner-contact', 'partner-tel', 'partner-fax', 'partner-email', 'partner-bizno', 'partner-address', 'partner-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            const ks = document.getElementById('partner-kind'); if (ks) ks.value = 'both';
            const t = document.getElementById('partner-form-title'); if (t) t.innerText = '새 거래처 등록';
        }
        function editPartner(id) {
            const p = (STATE.partners || []).find(x => x.id === id); if (!p) return;
            document.getElementById('partner-id').value = p.id;
            document.getElementById('partner-name').value = p.name;
            document.getElementById('partner-kind').value = p.kind;
            document.getElementById('partner-contact').value = p.contact;
            document.getElementById('partner-tel').value = p.tel;
            document.getElementById('partner-fax').value = p.fax;
            document.getElementById('partner-email').value = p.email;
            document.getElementById('partner-bizno').value = p.bizNo;
            document.getElementById('partner-address').value = p.address;
            document.getElementById('partner-notes').value = p.notes;
            document.getElementById('partner-form-title').innerText = '거래처 편집';
        }
        async function handleSavePartner(e) {
            e.preventDefault();
            const id = document.getElementById('partner-id').value;
            const row = { name: document.getElementById('partner-name').value.trim(), kind: document.getElementById('partner-kind').value, contact: document.getElementById('partner-contact').value.trim(), tel: document.getElementById('partner-tel').value.trim(), fax: document.getElementById('partner-fax').value.trim(), email: document.getElementById('partner-email').value.trim(), biz_no: document.getElementById('partner-bizno').value.trim(), address: document.getElementById('partner-address').value.trim(), notes: document.getElementById('partner-notes').value.trim() };
            if (!row.name) { showToast('입력 필요', '거래처명을 입력하세요.'); return; }
            let error;
            if (id) { ({ error } = await sb.from('partners').update(row).eq('id', parseInt(id))); }
            else { ({ error } = await sb.from('partners').insert(row)); }
            if (error) { showToast('저장 실패', error.message); return; }
            await reloadPartners(); renderPartnerList(); resetPartnerForm();
            showToast('저장 완료', id ? '거래처가 수정되었습니다.' : '거래처가 등록되었습니다.');
        }
        async function deletePartner(id) {
            const p = (STATE.partners || []).find(x => x.id === id); if (!p) return;
            if (!confirm(`거래처 [${p.name}] 을(를) 삭제하시겠습니까?`)) return;
            const { error } = await sb.from('partners').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadPartners(); renderPartnerList();
            showToast('삭제', '거래처가 삭제되었습니다.');
        }

        // ════════════ 엑셀 내보내기 / 가져오기 ════════════
        const TRADE_KIND_LABEL = { po: '발주서', quote: '견적서' };
        const PARTNER_KIND_LABEL = { both: '공통', client: '고객사', supplier: '공급처' };
        const PARTNER_KIND_FROM = { '공통': 'both', '고객사': 'client', '공급처': 'supplier', '고객': 'client', '공급': 'supplier', 'client': 'client', 'supplier': 'supplier', 'both': 'both' };
        function deptName(id) { const d = (STATE.departments || []).find(x => x.id === id); return d ? d.name : (id || ''); }
        function deptIdByName(name) { if (!name) return ''; const n = String(name).trim(); const d = (STATE.departments || []).find(x => x.name === n || x.id === n); return d ? d.id : ''; }
        function xlsxToday() { return new Date().toISOString().slice(0, 10); }
        function pickHeaderObjects(aoa, type) {
            if (!aoa || !aoa.length) return [];
            const tokens = type === 'inventory'
                ? ['품목명', '품목', 'name', '품목코드', 'sku', '분류', '카테고리', 'category', '현재고', '재고', 'stock', '단가', '안전재고', '단위']
                : type === 'assets'
                ? ['자산명', '설비명', 'name', '모델', 'model', '고객사', 'customer', '설치장소', '현장', 'site', 'pm주기', '점검주기', '최근점검일', '담당자', 'assignee', '담당부서']
                : ['거래처명', '거래처', '업체명', 'name', '구분', '유형', '담당자', 'contact', 'tel', '전화'];
            const norm = c => String(c == null ? '' : c).trim();
            let hdrIdx = -1, best = 0;
            for (let i = 0; i < Math.min(aoa.length, 20); i++) {
                const cells = (aoa[i] || []).map(norm);
                const score = cells.filter(c => c && (tokens.includes(c) || tokens.includes(c.toLowerCase()))).length;
                if (score > best) { best = score; hdrIdx = i; }
            }
            if (hdrIdx < 0) hdrIdx = 0;
            const headers = (aoa[hdrIdx] || []).map(norm);
            const objs = [];
            for (let i = hdrIdx + 1; i < aoa.length; i++) {
                const row = aoa[i] || [];
                const first = String(row[0] == null ? '' : row[0]).trim();
                if (['합계', '총계', '소계', '합 계'].includes(first)) continue;
                const obj = {}; let any = false;
                headers.forEach((h, ci) => { if (h) { const v = row[ci] != null ? row[ci] : ''; obj[h] = v; if (String(v).trim() !== '') any = true; } });
                if (any) objs.push(obj);
            }
            return objs;
        }
        function sheetToObjects(ws, type) { const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }); return pickHeaderObjects(aoa, type); }
        function xlsxPick(obj, keys) { for (const k of keys) { if (obj[k] !== undefined && String(obj[k]).trim() !== '') return String(obj[k]).trim(); } return ''; }
        function importDateVal(r, keys) {
            for (const k of keys) {
                if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
                    const v = r[k];
                    if (v instanceof Date && !isNaN(v)) return formatDate(v);
                    const sv = String(v).trim();
                    const m = sv.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
                    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
                    if (/^\d+(\.\d+)?$/.test(sv)) { const d = new Date(Math.round((Number(sv) - 25569) * 86400 * 1000)); if (!isNaN(d)) return formatDate(d); }
                    return sv;
                }
            }
            return '';
        }

        function buildExportAoa(type) {
            if (type === 'inventory') {
                const headers = ['품목코드', '품목명', '분류', '단위', '현재고', '안전재고', '단가', '거래처', '위치', '담당부서', '비고'];
                const rows = (STATE.inventory || []).map(i => [i.sku || '', i.name || '', i.category || '', i.unit || '', i.stock || 0, i.safeStock || 0, i.unitPrice || 0, i.supplier || '', i.location || '', deptName(i.deptId), i.notes || '']);
                return { headers, rows, sheet: '재고', filename: `재고목록_${xlsxToday()}.xlsx` };
            }
            if (type === 'partners') {
                const headers = ['거래처명', '구분', '담당자', 'TEL', 'FAX', 'E-MAIL', '사업자번호', '주소', '비고'];
                const rows = (STATE.partners || []).map(p => [p.name || '', PARTNER_KIND_LABEL[p.kind] || '공통', p.contact || '', p.tel || '', p.fax || '', p.email || '', p.bizNo || '', p.address || '', p.notes || '']);
                return { headers, rows, sheet: '거래처', filename: `거래처목록_${xlsxToday()}.xlsx` };
            }
            if (type === 'trade') {
                const headers = ['문서번호', '종류', 'CLIENT', '건명(SERVICE)', '작성일', '상태', '합계금액'];
                const rows = (STATE.trade || []).map(t => [t.docNo || '', TRADE_KIND_LABEL[t.kind] || '', t.client || '', t.service || '', t.docDate || '', (TRADE_STATUS[t.status] || ['', ''])[0], Number(t.total) || 0]);
                return { headers, rows, sheet: '발주견적', filename: `발주견적목록_${xlsxToday()}.xlsx` };
            }
            if (type === 'assets') {
                const headers = ['자산명', '모델', '고객사', '설치장소', 'PM주기(일)', '최근점검일', '담당자', '직책/위치', '담당부서', '비고'];
                const rows = (STATE.assets || []).map(a => [a.name || '', a.model || '', a.customer || '', a.site || '', a.pmCycle || 0, a.lastPm || '', a.assignee || '', a.position || '', deptName(a.deptId), a.notes || '']);
                return { headers, rows, sheet: '설비자산', filename: `설비자산목록_${xlsxToday()}.xlsx` };
            }
            return { headers: [], rows: [], sheet: 'sheet', filename: 'export.xlsx' };
        }
        // ── 스타일 엑셀(ExcelJS): 회사 로고 + 깔끔한 자재관리 서식 ──
        function _xb() { const s = { style: 'thin', color: { argb: 'FFCBD5E1' } }; return { top: s, left: s, bottom: s, right: s }; }
        function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { try { URL.revokeObjectURL(url); a.remove(); } catch (e) { } }, 1500); }
        function dataUrlToBlob(durl) {
            const parts = String(durl).split(','); const meta = parts[0] || ''; const b64 = parts[1] || '';
            const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/png';
            const bin = atob(b64); const len = bin.length; const arr = new Uint8Array(len);
            for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], { type: mime });
        }
        async function uploadLogoToStorage(durl) {
            try {
                const blob = dataUrlToBlob(durl);
                const path = `logo_${Date.now()}.png`;
                const { error } = await sb.storage.from('branding').upload(path, blob, { contentType: 'image/png', upsert: true });
                if (error) return null;
                const { data } = sb.storage.from('branding').getPublicUrl(path);
                return (data && data.publicUrl) ? data.publicUrl : null;
            } catch (e) { return null; }
        }
        async function getLogoForExcel() {
            const co = company(); if (!co.logo) return null;
            let durl = co.logo;
            if (!/^data:/.test(co.logo)) {
                try { const resp = await fetch(co.logo); const blob = await resp.blob(); durl = await new Promise((rs, rj) => { const fr = new FileReader(); fr.onload = () => rs(fr.result); fr.onerror = rj; fr.readAsDataURL(blob); }); } catch (e) { durl = co.logo; }
            }
            return await new Promise(res => { try { const img = new Image(); img.onload = () => res({ data: durl, w: img.naturalWidth || 297, h: img.naturalHeight || 220 }); img.onerror = () => res({ data: durl, w: 297, h: 220 }); img.src = durl; } catch (e) { res({ data: durl, w: 297, h: 220 }); } });
        }
        function exportMeta(type, rows) {
            if (type === 'inventory') {
                const sumStock = rows.reduce((s, r) => s + (Number(r[4]) || 0), 0);
                return { title: '재고 자재 관리 대장', widths: [14, 22, 12, 8, 10, 10, 12, 18, 12, 14, 22], aligns: ['left', 'left', 'left', 'center', 'right', 'right', 'right', 'left', 'left', 'left', 'left'], numFmts: [, , , , '#,##0', '#,##0', '#,##0'], totalRow: ['합계', '', '', '', sumStock, '', '', '', '', '', ''] };
            }
            if (type === 'partners') {
                return { title: '거래처 관리 대장', widths: [18, 10, 12, 14, 14, 20, 16, 24, 20], aligns: ['left', 'center', 'left', 'left', 'left', 'left', 'left', 'left', 'left'], numFmts: [] };
            }
            if (type === 'trade') {
                const sumTotal = rows.reduce((s, r) => s + (Number(r[6]) || 0), 0);
                return { title: '발주·견적 관리 대장', widths: [16, 8, 18, 24, 12, 10, 14], aligns: ['left', 'center', 'left', 'left', 'center', 'center', 'right'], numFmts: [, , , , , , '#,##0'], totalRow: ['합계', '', '', '', '', '', sumTotal] };
            }
            if (type === 'assets') {
                return { title: '설비 자산 관리 대장', widths: [20, 16, 16, 16, 10, 12, 12, 12, 14, 22], aligns: ['left', 'left', 'left', 'left', 'right', 'center', 'left', 'left', 'left', 'left'], numFmts: [, , , , '#,##0'] };
            }
            return { title: '', widths: [], aligns: [], numFmts: [] };
        }
        async function exportStyledWorkbook({ filename, sheets }) {
            try { await ensureExcelJS(); } catch (e) { }
            if (typeof ExcelJS === 'undefined') { showToast('엑셀 모듈 로드 실패', '네트워크 연결을 확인해 주세요.'); return false; }
            const co = company();
            const logo = await getLogoForExcel();
            const wb = new ExcelJS.Workbook(); wb.creator = co.name || 'WorkSpace Pro';
            sheets.forEach(sp => {
                const cols = sp.headers.length;
                const ws = wb.addWorksheet(sp.name || 'Sheet', { views: [{ state: 'frozen', ySplit: 4 }] });
                sp.headers.forEach((_, i) => { ws.getColumn(i + 1).width = (sp.widths && sp.widths[i]) || 16; });
                ws.mergeCells(1, 1, 1, Math.max(1, cols - 2));
                const tc = ws.getCell(1, 1); tc.value = sp.title || ''; tc.font = { bold: true, size: 15, color: { argb: 'FF0F172A' } }; tc.alignment = { vertical: 'middle' };
                ws.getRow(1).height = 24;
                ws.mergeCells(2, 1, 2, Math.max(1, cols - 2));
                const sc = ws.getCell(2, 1); sc.value = `${co.name || ''}    생성일 ${new Date().toLocaleDateString('ko-KR')}`; sc.font = { size: 10, color: { argb: 'FF64748B' } };
                ws.getRow(3).height = 4;
                if (logo) { try { const id = wb.addImage({ base64: logo.data, extension: 'png' }); const h = 46, w = Math.round(h * (logo.w / logo.h)); ws.addImage(id, { tl: { col: Math.max(0, cols - 1.4), row: 0.1 }, ext: { width: w, height: h }, editAs: 'oneCell' }); } catch (e) { } }
                const hr = ws.getRow(4);
                sp.headers.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2A44' } }; c.alignment = { horizontal: (sp.aligns && sp.aligns[i]) || 'left', vertical: 'middle' }; c.border = _xb(); });
                hr.height = 19;
                sp.rows.forEach((r, ri) => { const row = ws.getRow(5 + ri); r.forEach((v, ci) => { const c = row.getCell(ci + 1); c.value = v == null ? '' : v; c.alignment = { horizontal: (sp.aligns && sp.aligns[ci]) || 'left', vertical: 'middle' }; c.border = _xb(); if (sp.numFmts && sp.numFmts[ci]) c.numFmt = sp.numFmts[ci]; if (ri % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; }); });
                if (sp.totalRow) { const row = ws.getRow(5 + sp.rows.length); sp.totalRow.forEach((v, ci) => { const c = row.getCell(ci + 1); c.value = v == null ? '' : v; c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; c.alignment = { horizontal: (sp.aligns && sp.aligns[ci]) || 'left' }; c.border = _xb(); if (sp.numFmts && sp.numFmts[ci]) c.numFmt = sp.numFmts[ci]; }); }
            });
            const buf = await wb.xlsx.writeBuffer();
            downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
            return true;
        }
        async function exportXlsx(type) {
            const { headers, rows, sheet, filename } = buildExportAoa(type);
            if (!rows.length) { showToast('내보낼 데이터 없음', '목록이 비어 있습니다.'); return; }
            const meta = exportMeta(type, rows);
            const okv = await exportStyledWorkbook({ filename, sheets: [{ name: sheet, title: meta.title, headers, rows, aligns: meta.aligns, numFmts: meta.numFmts, widths: meta.widths, totalRow: meta.totalRow }] });
            if (okv) showToast('내보내기 완료', `${rows.length}건을 엑셀로 저장했습니다.`);
        }
        async function downloadTemplate(type) {
            try { await ensureXlsx(); } catch (e) { }
            if (typeof XLSX === 'undefined') { showToast('엑셀 모듈 로드 실패', '네트워크 연결을 확인해 주세요.'); return; }
            let headers, example, name;
            if (type === 'inventory') { headers = ['품목코드', '품목명', '분류', '단위', '현재고', '안전재고', '단가', '거래처', '위치', '담당부서', '비고']; example = ['(비우면 자동생성)', '볼트 M8', '부품', 'EA', 10, 5, 100, '대한볼트', 'A-1', '미래전략기획실', '예시 행 — 지우고 입력']; name = '재고_가져오기_양식.xlsx'; }
            else if (type === 'assets') { headers = ['자산명', '모델', '고객사', '설치장소', 'PM주기(일)', '최근점검일', '담당자', '직책/위치', '담당부서', '비고']; example = ['1호 컴프레서', 'AC-200', '대한기계', '평택 1공장', 180, '2026-01-15', '김기사', '대리', '미래전략기획실', '예시 행 — 지우고 입력']; name = '설비_가져오기_양식.xlsx'; }
            else { headers = ['거래처명', '구분', '담당자', 'TEL', 'FAX', 'E-MAIL', '사업자번호', '주소', '비고']; example = ['제이엔케이글로벌', '고객사', '김부장', '02-111-2222', '02-111-2223', 'jnk@corp.com', '123-45-67890', '서울시 ...', '예시 행 — 지우고 입력']; name = '거래처_가져오기_양식.xlsx'; }
            const ws = XLSX.utils.aoa_to_sheet([headers, example]);
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '양식');
            XLSX.writeFile(wb, name);
        }
        function triggerImport(type) {
            STATE.importType = type;
            const inp = document.getElementById('xlsx-import-input'); if (inp) { inp.value = ''; inp.click(); }
        }
        async function handleXlsxImportFile(e) {
            const file = e.target.files && e.target.files[0]; if (!file) return;
            try { await ensureXlsx(); } catch (err) { }
            if (typeof XLSX === 'undefined') { showToast('엑셀 모듈 로드 실패', '네트워크 연결을 확인해 주세요.'); return; }
            try {
                const buf = await file.arrayBuffer();
                const wb = XLSX.read(buf, { type: 'array', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const raw = sheetToObjects(ws, STATE.importType);
                STATE.importDraft = { type: STATE.importType, rows: normalizeImportRows(STATE.importType, raw) };
                renderImportPreview();
                openModal('xlsx-import-modal');
            } catch (err) { showToast('파일 읽기 실패', err.message || '엑셀 형식을 확인해 주세요.'); }
        }
        function normalizeImportRows(type, raw) {
            const out = [];
            (raw || []).forEach(r => {
                if (type === 'inventory') {
                    const name = xlsxPick(r, ['품목명', '품목', 'name']); if (!name) return;
                    out.push({
                        sku: xlsxPick(r, ['품목코드', 'SKU', 'sku']), name, category: xlsxPick(r, ['분류', '카테고리', 'category']), unit: xlsxPick(r, ['단위', 'unit']) || '',
                        stock: Number(xlsxPick(r, ['현재고', '재고', 'stock']) || 0) || 0, safe_stock: Number(xlsxPick(r, ['안전재고', 'safe_stock']) || 0) || 0,
                        unit_price: Number(xlsxPick(r, ['단가', '가격', 'unit_price']) || 0) || 0, supplier: xlsxPick(r, ['거래처', '공급처', 'supplier']),
                        location: xlsxPick(r, ['위치', '보관위치', 'location']), dept_id: deptIdByName(xlsxPick(r, ['담당부서', '부서', 'dept'])) || (STATE.profile ? STATE.profile.deptId : ''), notes: xlsxPick(r, ['비고', '메모', 'notes'])
                    });
                } else if (type === 'assets') {
                    const name = xlsxPick(r, ['자산명', '설비명', 'name']); if (!name) return;
                    out.push({
                        name, model: xlsxPick(r, ['모델', 'model', '규격']), customer: xlsxPick(r, ['고객사', 'customer', '거래처']), site: xlsxPick(r, ['설치장소', '현장', '위치', 'site']),
                        pm_cycle: Number(xlsxPick(r, ['PM주기(일)', 'PM주기', '점검주기', 'pm_cycle']) || 0) || 0, last_pm: importDateVal(r, ['최근점검일', '최근 점검일', '마지막점검', 'last_pm']),
                        assignee: xlsxPick(r, ['담당자', 'assignee']), position: xlsxPick(r, ['직책/위치', '직책', 'position']),
                        dept_id: deptIdByName(xlsxPick(r, ['담당부서', '부서', 'dept'])) || (STATE.profile ? STATE.profile.deptId : ''), notes: xlsxPick(r, ['비고', '메모', 'notes'])
                    });
                } else if (type === 'partners') {
                    const name = xlsxPick(r, ['거래처명', '거래처', '업체명', 'name']); if (!name) return;
                    out.push({
                        name, kind: PARTNER_KIND_FROM[xlsxPick(r, ['구분', '유형', 'kind'])] || 'both', contact: xlsxPick(r, ['담당자', 'contact']), tel: xlsxPick(r, ['TEL', '전화', 'tel']),
                        fax: xlsxPick(r, ['FAX', '팩스', 'fax']), email: xlsxPick(r, ['E-MAIL', 'EMAIL', '이메일', 'email']), biz_no: xlsxPick(r, ['사업자번호', '사업자', 'biz_no']),
                        address: xlsxPick(r, ['주소', 'address']), notes: xlsxPick(r, ['비고', '메모', 'notes'])
                    });
                }
            });
            if (type === 'inventory') { resolveInventoryMatches(out); assignImportSkus(out); }
            else if (type === 'partners') resolvePartnerMatches(out);
            else if (type === 'assets') resolveAssetMatches(out);
            return out;
        }
        function resolveInventoryMatches(rows) {
            (rows || []).forEach(r => {
                let ex = null;
                const sku = (r.sku || '').trim().toLowerCase();
                if (sku) ex = (STATE.inventory || []).find(i => String(i.sku || '').trim().toLowerCase() === sku);
                if (!ex) { const nm = (r.name || '').trim().toLowerCase(); ex = (STATE.inventory || []).find(i => String(i.name || '').trim().toLowerCase() === nm); }
                if (ex) { r._match = ex.id; r.sku = ex.sku; } else r._match = null;
            });
        }
        function resolvePartnerMatches(rows) {
            (rows || []).forEach(r => { const nm = (r.name || '').trim().toLowerCase(); const ex = (STATE.partners || []).find(p => String(p.name || '').trim().toLowerCase() === nm); r._match = ex ? ex.id : null; });
        }
        function resolveAssetMatches(rows) {
            (rows || []).forEach(r => {
                const nm = (r.name || '').trim().toLowerCase(), md = (r.model || '').trim().toLowerCase();
                const ex = (STATE.assets || []).find(a => String(a.name || '').trim().toLowerCase() === nm && (!md || String(a.model || '').trim().toLowerCase() === md)) || (STATE.assets || []).find(a => String(a.name || '').trim().toLowerCase() === nm);
                r._match = ex ? ex.id : null;
            });
        }
        function assignImportSkus(rows) {
            const counters = {};
            rows.forEach(r => {
                if (r.sku) return;
                const opt = ((STATE.invOptions && STATE.invOptions.category) || []).find(c => c.value === r.category);
                const code = (opt && opt.code) ? String(opt.code).toUpperCase() : 'GEN';
                if (counters[code] === undefined) {
                    let max = 0; (STATE.inventory || []).forEach(i => { const s = String(i.sku || '').toUpperCase(); const d = s.lastIndexOf('-'); if (d > 0 && s.slice(0, d) === code) { const n = parseInt(s.slice(d + 1)); if (!isNaN(n)) max = Math.max(max, n); } });
                    counters[code] = max;
                }
                counters[code]++; r.sku = code + '-' + String(counters[code]).padStart(4, '0');
            });
        }
        function renderImportPreview() {
            const d = STATE.importDraft, body = document.getElementById('xlsx-import-body'); if (!body || !d) return;
            const typeLabel = d.type === 'inventory' ? '재고 품목' : d.type === 'assets' ? '설비 자산' : '거래처';
            const titleEl = document.getElementById('xlsx-import-title'); if (titleEl) titleEl.innerText = typeLabel + ' 엑셀 가져오기';
            const btn = document.getElementById('xlsx-import-confirm');
            if (!d.rows.length) {
                body.innerHTML = `<div class="text-center text-slate-400 text-sm py-8">가져올 유효한 행이 없습니다.<br>양식의 머리글(첫 줄)이 맞는지 확인해 주세요.</div><div class="text-center"><button onclick="downloadTemplate('${d.type}')" class="text-emerald-600 text-xs font-bold underline">${typeLabel} 양식 내려받기</button></div>`;
                if (btn) { btn.disabled = true; btn.classList.add('opacity-40', 'pointer-events-none'); }
                return;
            }
            if (btn) { btn.disabled = false; btn.classList.remove('opacity-40', 'pointer-events-none'); }
            const cols = d.type === 'inventory' ? ['상태', '품목코드', '품목명', '분류', '단위', '현재고', '단가', '담당부서'] : d.type === 'assets' ? ['상태', '자산명', '모델', '고객사', '설치장소', 'PM주기', '담당부서'] : ['상태', '거래처명', '구분', '담당자', 'TEL', 'E-MAIL'];
            const rowCells = r => d.type === 'inventory' ? [(r._match ? '갱신' : '신규'), r.sku, r.name, r.category, r.unit, r.stock, r.unit_price, deptName(r.dept_id)] : d.type === 'assets' ? [(r._match ? '갱신' : '신규'), r.name, r.model, r.customer, r.site, r.pm_cycle, deptName(r.dept_id)] : [(r._match ? '갱신' : '신규'), r.name, PARTNER_KIND_LABEL[r.kind] || '', r.contact, r.tel, r.email];
            const _newN = d.rows.filter(r => !r._match).length, _updN = d.rows.filter(r => r._match).length;
            const preview = d.rows.slice(0, 6);
            body.innerHTML = `<div class="text-sm text-slate-600 mb-3"><b class="text-emerald-700">${d.rows.length}건</b> (신규 ${_newN} · 갱신 ${_updN})을 가져옵니다. <span class="text-[12px] text-slate-400">기존 품목과 중복되면 추가되지 않고 갱신됩니다.</span> 미리보기(최대 6행):</div>
                <div class="overflow-x-auto border rounded-xl"><table class="w-full text-[12px]"><thead class="bg-slate-50 text-slate-500"><tr>${cols.map(c => `<th class="px-2 py-1.5 text-left whitespace-nowrap">${c}</th>`).join('')}</tr></thead>
                <tbody>${preview.map(r => `<tr class="border-t">${rowCells(r).map(c => `<td class="px-2 py-1.5 whitespace-nowrap">${esc(String(c == null ? '' : c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
                <div class="mt-3 flex items-center justify-between gap-2"><span class="text-[12px] text-slate-400">${d.type === 'inventory' ? '품목코드를 비우면 분류 코드로 자동 생성됩니다.' : d.type === 'assets' ? 'PM주기는 일 단위 숫자, 최근점검일은 날짜로 입력하세요.' : '구분: 고객사 / 공급처 / 공통'}</span><button onclick="downloadTemplate('${d.type}')" class="text-emerald-600 text-xs font-bold underline whitespace-nowrap">양식 내려받기</button></div>`;
        }
        async function ensureImportOptions(rows) {
            const opts = STATE.invOptions || {};
            const have = (kind, val) => (opts[kind] || []).some(o => String(o.value).trim().toLowerCase() === String(val).trim().toLowerCase());
            const toAdd = [], seen = { category: {}, unit: {}, name: {} };
            (rows || []).forEach(r => {
                [['category', r.category], ['unit', r.unit], ['name', r.name]].forEach(([k, v]) => {
                    v = (v || '').trim(); if (!v) return; const key = v.toLowerCase();
                    if (!have(k, v) && !seen[k][key]) { seen[k][key] = 1; toAdd.push({ kind: k, value: v }); }
                });
            });
            if (toAdd.length) { const { error } = await sb.from('inventory_options').insert(toAdd); if (!error) await reloadInventoryOptions(); }
            return toAdd.length;
        }
        async function confirmImport() {
            const d = STATE.importDraft; if (!d || !d.rows.length) { closeModal('xlsx-import-modal'); return; }
            let inserted = 0, updated = 0, fail = 0;
            if (d.type === 'inventory') {
                await ensureImportOptions(d.rows); // 새 분류·단위·품목명을 기준정보(옵션)에 자동 등록
                for (const row of d.rows) {
                    if (row._match) {
                        const m = {};
                        if (row.category) m.category = row.category;
                        if (row.unit) m.unit = row.unit;
                        if (row.supplier) m.supplier = row.supplier;
                        if (row.location) m.location = row.location;
                        if (row.notes) m.notes = row.notes;
                        if (Number(row.safe_stock) > 0) m.safe_stock = Number(row.safe_stock);
                        if (Number(row.unit_price) > 0) m.unit_price = Number(row.unit_price);
                        if (Object.keys(m).length) { const { error } = await sb.from('inventory_items').update(m).eq('id', row._match); if (error) { fail++; continue; } }
                        updated++;
                    } else {
                        const payload = { name: row.name, sku: row.sku, category: row.category, unit: row.unit || 'EA', safe_stock: Number(row.safe_stock) || 0, unit_price: Number(row.unit_price) || 0, supplier: row.supplier, location: row.location, dept_id: row.dept_id, notes: row.notes, stock: 0 };
                        const { error } = await sb.from('inventory_items').insert(payload); if (error) { fail++; continue; } inserted++;
                    }
                }
                await reloadInventory(); await reloadInventoryStock();
                // 수량 반영: 가져온 현재고에 맞춰 기본창고 수량을 "갱신"(합산이 아니라 목표값으로 조정)
                for (const row of d.rows) {
                    const it = (STATE.inventory || []).find(x => row._match ? x.id === row._match : String(x.sku) === String(row.sku));
                    const wh = defaultWarehouseId(); if (!it || !wh) continue;
                    const diff = (Number(row.stock) || 0) - itemWhQty(it.id, wh);
                    if (diff !== 0) await sb.rpc('apply_stock_move', { p_item_id: it.id, p_kind: diff > 0 ? 'in' : 'out', p_qty: Math.abs(diff), p_reason: row._match ? '엑셀 가져오기(갱신)' : '엑셀 가져오기', p_warehouse_id: wh });
                }
                await reloadInventory(); await reloadInventoryStock(); renderInventory();
            } else if (d.type === 'assets') {
                for (const row of d.rows) {
                    if (row._match) {
                        const m = {}; ['name', 'model', 'customer', 'site', 'assignee', 'position', 'notes'].forEach(k => { if (row[k]) m[k] = row[k]; });
                        if (Number(row.pm_cycle) > 0) m.pm_cycle = Number(row.pm_cycle);
                        if (row.last_pm) m.last_pm = row.last_pm;
                        if (row.dept_id) m.dept_id = row.dept_id;
                        if (Object.keys(m).length) { const { error } = await sb.from('assets').update(m).eq('id', row._match); if (error) { fail++; continue; } }
                        updated++;
                    } else {
                        const payload = { name: row.name, model: row.model, customer: row.customer, site: row.site, pm_cycle: Number(row.pm_cycle) || 0, last_pm: row.last_pm || null, assignee: row.assignee, position: row.position, dept_id: row.dept_id, notes: row.notes };
                        const { error } = await sb.from('assets').insert(payload); if (error) { fail++; continue; } inserted++;
                    }
                }
                await reloadAssets(); if (STATE.currentTab === 'assets') renderAssets();
            } else {
                for (const row of d.rows) {
                    if (row._match) {
                        const m = {}; ['name', 'contact', 'tel', 'fax', 'email', 'biz_no', 'address', 'notes'].forEach(k => { if (row[k]) m[k] = row[k]; });
                        if (Object.keys(m).length) { const { error } = await sb.from('partners').update(m).eq('id', row._match); if (error) { fail++; continue; } }
                        updated++;
                    } else {
                        const payload = Object.assign({}, row); delete payload._match;
                        const { error } = await sb.from('partners').insert(payload); if (error) { fail++; continue; } inserted++;
                    }
                }
                await reloadPartners(); if (!document.getElementById('partner-modal').classList.contains('hidden')) renderPartnerList();
            }
            renderDashboardWidgets();
            closeModal('xlsx-import-modal');
            showToast('가져오기 완료', `신규 ${inserted}건 · 갱신 ${updated}건${fail ? ` · 실패 ${fail}건` : ''}`);
        }

        async function reloadTrade() {
            const { data, error } = await fetchAllPaged(() => sb.from('trade_documents').select('*').order('created_at', { ascending: false }));
            if (error) { STATE.tradeTableMissing = true; STATE.trade = []; return; }
            STATE.tradeTableMissing = false;
            STATE.trade = (data || []).map(r => ({
                id: r.id, kind: r.kind, docNo: r.doc_no || '',
                client: r.client || r.partner || '', service: r.service || '', pjtTitle: r.pjt_title || '', inqNo: r.inq_no || '', itemNo: r.item_no || '',
                personInCharge: r.person_in_charge || r.partner_contact || '', payment: r.payment || '', delivery: r.delivery || '', terms: r.terms || '', validity: r.validity || '', dueDate: r.due_date || '',
                issuerTel: r.issuer_tel || '', issuerFax: r.issuer_fax || '', issuerEmail: r.issuer_email || '',
                receivedAt: r.received_at || null,
                docDate: r.doc_date || '', status: r.status || 'draft',
                items: (Array.isArray(r.items) ? r.items : []).map(x => ({ description: x.description || x.name || '', notes: x.notes || '', unit: x.unit || '', qty: Number(x.qty) || 0, unitPrice: Number(x.unitPrice) || 0, sub: !!x.sub })),
                remarks: Array.isArray(r.remarks) ? r.remarks : [],
                vat: !!r.vat, subtotal: Number(r.subtotal) || 0, tax: Number(r.tax) || 0, total: Number(r.total) || 0,
                author: r.author || '', authorId: r.author_id || '', deptId: r.dept_id || '', createdAt: r.created_at
            }));
        }
        function tradeApplyFilter() { resetPage('trade'); renderTrade(); }
        function tradeKindChip(k) { const v = TRADE_KIND[k] || TRADE_KIND.po; return chip(v[0], v[1]); }
        function tradeStatusChip(s) { const v = TRADE_STATUS[s] || TRADE_STATUS.draft; return chip(v[0], v[1]); }
        function renderTrade() {
            const list0 = STATE.trade || [];
            const fk = (document.getElementById('trade-filter-kind') || {}).value || 'all';
            const fs = (document.getElementById('trade-filter-status') || {}).value || 'all';
            const fd = (document.getElementById('trade-filter-dept') || {}).value || 'all';
            const q = ((document.getElementById('trade-search') || {}).value || '').trim().toLowerCase();
            const list = list0.filter(t =>
                (fk === 'all' || t.kind === fk) && (fs === 'all' || t.status === fs) && (fd === 'all' || t.deptId === fd) &&
                (!q || (t.docNo + ' ' + t.client + ' ' + t.service + ' ' + (t.items || []).map(i => i.description).join(' ')).toLowerCase().indexOf(q) >= 0));
            const stats = document.getElementById('trade-stats');
            if (stats) {
                const poCnt = list0.filter(t => t.kind === 'po').length;
                const qtCnt = list0.filter(t => t.kind === 'quote').length;
                const draftCnt = list0.filter(t => t.status === 'draft').length;
                const sumTotal = list0.reduce((s, t) => s + Number(t.total), 0);
                const card = (label, val, sub, tone) => `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4"><div class="text-[12px] font-bold text-slate-400">${label}</div><div class="text-2xl font-extrabold ${tone} mt-1">${val}</div><div class="text-[11px] text-slate-400 mt-0.5">${sub}</div></div>`;
                stats.innerHTML = card('발주서', fmtNum(poCnt), '건', 'text-amber-600') + card('견적서', fmtNum(qtCnt), '건', 'text-sky-600') + card('작성 중', fmtNum(draftCnt), '미발행 문서', 'text-slate-800') + card('총 금액', '₩' + fmtNum(sumTotal), '전체 합계', 'text-teal-600');
            }
            const body = document.getElementById('trade-list-body');
            const cards = document.getElementById('trade-card-list');
            if (list.length === 0) {
                if (body) body.innerHTML = `<tr><td colspan="6" class="wsp-empty">문서가 없습니다.</td></tr>`;
                if (cards) cards.innerHTML = `<div class="wsp-empty sm:col-span-2">문서가 없습니다.</div>`;
                return;
            }
            const shown = list.slice(0, pageCount('trade'));
            const actionsFor = (t) => canManageTrade(t)
                ? `<button onclick="event.stopPropagation();openTradeForm(${t.id})" class="text-indigo-500 hover:text-indigo-700 font-bold mr-2">편집</button><button onclick="event.stopPropagation();deleteTrade(${t.id})" class="text-rose-400 hover:text-rose-600 font-bold">삭제</button>`
                : `<span class="text-slate-300">열람</span>`;
            if (body) body.innerHTML = shown.map(t => {
                const dept = STATE.departments.find(d => d.id === t.deptId);
                return `<tr class="hover:bg-teal-50/30 align-top cursor-pointer" onclick="openTradeDetail(${t.id})">
                    <td class="px-4 py-3">${tradeKindChip(t.kind)}<div class="text-[12px] text-slate-500 font-mono mt-1">${esc(t.docNo)}</div></td>
                    <td class="px-4 py-3"><div class="font-bold text-slate-800">${esc(t.client) || '-'}</div><div class="text-[12px] text-slate-400 truncate max-w-[220px]">${esc(t.service) || ''}</div></td>
                    <td class="px-4 py-3 text-slate-500 font-mono text-[13px]">${t.docDate || '-'}</td>
                    <td class="px-4 py-3 text-right font-bold text-slate-800">₩${fmtNum(t.total)}</td>
                    <td class="px-4 py-3">${tradeStatusChip(t.status)}<div class="text-[12px] text-slate-400 mt-0.5">${dept ? esc(dept.name) : '-'}</div></td>
                    <td class="px-4 py-3 text-right whitespace-nowrap text-[13px]">${actionsFor(t)}</td>
                </tr>`;
            }).join('') + moreRowHTML(list.length, 'trade', 6);
            if (cards) cards.innerHTML = shown.map(t => {
                const dept = STATE.departments.find(d => d.id === t.deptId);
                return `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2" onclick="openTradeDetail(${t.id})">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">${tradeKindChip(t.kind)}<div class="text-[12px] text-slate-500 font-mono mt-1">${esc(t.docNo)}</div></div>
                        ${tradeStatusChip(t.status)}
                    </div>
                    <div class="font-bold text-slate-800 truncate">${esc(t.client) || '-'}</div>
                    <div class="text-[12px] text-slate-400 truncate">${esc(t.service) || ''}</div>
                    <div class="flex items-end justify-between">
                        <div class="text-[12px] text-slate-400">${t.docDate || ''} · ${dept ? esc(dept.name) : ''}</div>
                        <div class="text-lg font-extrabold text-slate-800">₩${fmtNum(t.total)}</div>
                    </div>
                    <div class="flex gap-2 pt-1 text-[13px]" onclick="event.stopPropagation()">${actionsFor(t)}</div>
                </div>`;
            }).join('') + (list.length > pageCount('trade') ? `<div class="sm:col-span-2">${moreDivHTML(list.length, 'trade')}</div>` : '');
            if (window.lucide) lucide.createIcons();
        }
        function nextTradeNo(kind) {
            const pre = kind === 'po' ? 'PO' : 'QT';
            const d = new Date(); const ym = '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
            const prefix = pre + '-' + ym + '-';
            let max = 0;
            (STATE.trade || []).forEach(t => { if ((t.docNo || '').indexOf(prefix) === 0) { const n = parseInt(t.docNo.slice(prefix.length)); if (!isNaN(n)) max = Math.max(max, n); } });
            return prefix + String(max + 1).padStart(4, '0');
        }
        function openTradeForm(id, kind) {
            if (STATE.tradeTableMissing) { showToast('준비 필요', '발주/견적 테이블(trade_documents) 갱신 SQL을 먼저 실행하세요.'); return; }
            const t = id ? STATE.trade.find(x => x.id === id) : null;
            if (t && !canManageTrade(t)) { showToast('권한 없음', '본인 부서의 문서만 편집할 수 있습니다.'); return; }
            kind = t ? t.kind : (kind || 'po');
            const isPo = kind === 'po';
            document.getElementById('trade-id').value = id || '';
            STATE.tradeAutoPerson = null;
            document.getElementById('trade-kind').value = kind;
            document.getElementById('trade-form-title').innerText = (id ? '' : '신규 ') + (isPo ? '발주서(PURCHASE ORDER)' : '견적서(QUOTATION)') + (id ? ' 편집' : ' 작성');
            document.getElementById('trade-docno-label').innerText = isPo ? '문서번호 (P.O. NO.)' : '문서번호 (QUO. NO.)';
            const V = (idv, val) => { const el = document.getElementById(idv); if (el) el.value = val; };
            V('trade-client', t ? t.client : '');
            V('trade-service', t ? t.service : '');
            V('trade-pjt', t ? t.pjtTitle : '');
            const _autoNo = t ? '' : nextTradeNo(kind); V('trade-docno', t ? t.docNo : _autoNo); STATE.tradeAutoDocNo = t ? null : _autoNo;
            V('trade-inq', t ? t.inqNo : '');
            V('trade-item', t ? t.itemNo : '');
            V('trade-date', t ? t.docDate : formatDate(new Date()));
            V('trade-person', t ? t.personInCharge : '');
            V('trade-payment', t ? t.payment : (isPo ? '100% AFTER DELIVERY' : ''));
            V('trade-delivery', t ? t.delivery : (isPo ? '2 weeks after PO' : ''));
            V('trade-terms', t ? t.terms : '');
            V('trade-validity', t ? t.validity : '');
            V('trade-due', t ? (t.dueDate || '') : '');
            V('trade-issuer-tel', t ? t.issuerTel : '');
            V('trade-issuer-fax', t ? t.issuerFax : '');
            V('trade-issuer-email', t ? t.issuerEmail : '');
            const dsel = document.getElementById('trade-dept'); if (dsel) dsel.value = t ? (t.deptId || STATE.profile.deptId) : (STATE.profile.deptId || '');
            document.getElementById('trade-vat').checked = t ? t.vat : false;
            STATE.tradeDraft = {
                items: t && t.items.length ? t.items.map(x => ({ description: x.description || '', notes: x.notes || '', unit: x.unit || '', qty: Number(x.qty) || 0, unitPrice: Number(x.unitPrice) || 0, sub: !!x.sub })) : [{ description: '', notes: '', unit: '', qty: 1, unitPrice: 0, sub: false }],
                remarks: t && t.remarks.length ? t.remarks.slice() : []
            };
            renderTradeLines(); renderTradeRemarks(); populateTradePartnerDatalist();
            openModal('trade-form-modal');
        }
        function addTradeLine(sub) { STATE.tradeDraft.items.push({ description: '', notes: '', unit: '', qty: 1, unitPrice: 0, sub: !!sub }); renderTradeLines(); }
        function removeTradeLine(idx) { STATE.tradeDraft.items.splice(idx, 1); if (!STATE.tradeDraft.items.length) STATE.tradeDraft.items.push({ description: '', notes: '', unit: '', qty: 1, unitPrice: 0, sub: false }); renderTradeLines(); }
        function updateTradeLine(idx, field, val) { const it = STATE.tradeDraft.items[idx]; if (!it) return; it[field] = (field === 'qty' || field === 'unitPrice') ? (parseFloat(val) || 0) : val; refreshTradeTotals(); }
        function toggleTradeLineSub(idx, checked) { const it = STATE.tradeDraft.items[idx]; if (!it) return; it.sub = !!checked; renderTradeLines(); }
        function renderTradeLines() {
            const wrap = document.getElementById('trade-lines'); if (!wrap) return;
            const invList = (STATE.inventory || []).map(i => `<option value="${esc(i.name)}">`).join('');
            const unitList = ((STATE.invOptions && STATE.invOptions.unit) || []).map(u => `<option value="${esc(u.value)}">`).join('');
            wrap.innerHTML = STATE.tradeDraft.items.map((it, i) => {
                const amount = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
                return `<div class="flex gap-1.5 items-center px-2 py-1.5 ${it.sub ? 'bg-slate-50/70' : ''}">
                    <span class="w-9 text-center"><input type="checkbox" ${it.sub ? 'checked' : ''} onchange="toggleTradeLineSub(${i}, this.checked)" title="세부항목" class="accent-slate-500"></span>
                    <input value="${esc(it.description)}" list="trade-inv-list" oninput="updateTradeLine(${i},'description',this.value)" placeholder="${it.sub ? '└ 세부 내역' : '항목 설명'}" class="flex-1 min-w-0 px-2 py-1.5 border rounded-lg text-[13px] outline-none ${it.sub ? 'ml-3 text-slate-600' : 'font-semibold'}">
                    <input value="${esc(it.notes)}" oninput="updateTradeLine(${i},'notes',this.value)" placeholder="비고" class="w-24 px-2 py-1.5 border rounded-lg text-[13px] outline-none">
                    <input value="${esc(it.unit)}" list="trade-unit-list" oninput="updateTradeLine(${i},'unit',this.value)" placeholder="EA" class="w-16 px-1.5 py-1.5 border rounded-lg text-[13px] text-center outline-none">
                    <input type="number" step="any" value="${it.qty}" oninput="updateTradeLine(${i},'qty',this.value)" class="w-14 px-1.5 py-1.5 border rounded-lg text-[13px] text-right outline-none">
                    <input type="number" step="any" value="${it.unitPrice}" oninput="updateTradeLine(${i},'unitPrice',this.value)" class="w-28 px-1.5 py-1.5 border rounded-lg text-[13px] text-right outline-none">
                    <div id="trade-amt-${i}" class="w-28 text-right text-[12px] font-mono ${it.sub ? 'text-slate-400' : 'text-slate-700'}">${fmtNum(amount)}</div>
                    <button type="button" onclick="removeTradeLine(${i})" class="w-7 text-slate-300 hover:text-rose-500 flex justify-center"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>`;
            }).join('') + `<datalist id="trade-inv-list">${invList}</datalist><datalist id="trade-unit-list">${unitList}</datalist>`;
            refreshTradeTotals();
            if (window.lucide) lucide.createIcons();
        }
        function renderTradeRemarks() {
            const wrap = document.getElementById('trade-remarks'); if (!wrap) return;
            const rm = STATE.tradeDraft.remarks || [];
            wrap.innerHTML = rm.length ? rm.map((r, i) => `<div class="flex gap-1.5 items-center">
                <span class="text-slate-300">•</span>
                <input value="${esc(r)}" oninput="updateTradeRemark(${i}, this.value)" placeholder="비고 내용" class="flex-1 min-w-0 px-2.5 py-1.5 border rounded-lg text-[13px] outline-none">
                <button type="button" onclick="removeTradeRemark(${i})" class="text-slate-300 hover:text-rose-500"><i data-lucide="x" class="w-4 h-4"></i></button></div>`).join('')
                : `<div class="text-[12px] text-slate-300">비고 없음 — "비고 추가"로 입력하세요.</div>`;
            if (window.lucide) lucide.createIcons();
        }
        function addTradeRemark() { STATE.tradeDraft.remarks = STATE.tradeDraft.remarks || []; STATE.tradeDraft.remarks.push(''); renderTradeRemarks(); }
        function updateTradeRemark(i, v) { STATE.tradeDraft.remarks[i] = v; }
        function removeTradeRemark(i) { STATE.tradeDraft.remarks.splice(i, 1); renderTradeRemarks(); }
        function computeTradeTotals() {
            const subtotal = STATE.tradeDraft.items.reduce((s, it) => s + (it.sub ? 0 : (Number(it.qty) || 0) * (Number(it.unitPrice) || 0)), 0);
            const vat = document.getElementById('trade-vat').checked;
            const tax = vat ? Math.round(subtotal * 0.1) : 0;
            return { subtotal, tax, total: subtotal + tax, vat };
        }
        function refreshTradeTotals() {
            STATE.tradeDraft.items.forEach((it, i) => { const el = document.getElementById('trade-amt-' + i); if (el) el.innerText = fmtNum((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)); });
            const t = computeTradeTotals();
            const box = document.getElementById('trade-totals');
            if (box) box.innerHTML = `<div class="text-slate-500">공급가액 <b class="text-slate-700">₩${fmtNum(t.subtotal)}</b></div>${t.vat ? `<div class="text-slate-500">부가세(10%) <b class="text-slate-700">₩${fmtNum(t.tax)}</b></div>` : ''}<div class="text-base font-extrabold text-teal-700 mt-0.5">TOTAL ₩${fmtNum(t.total)}</div>`;
        }
        async function handleSaveTrade(e) {
            e.preventDefault();
            const id = document.getElementById('trade-id').value;
            const kind = document.getElementById('trade-kind').value;
            const items = STATE.tradeDraft.items.filter(it => (it.description || '').trim()).map(it => ({ description: it.description.trim(), notes: it.notes || '', unit: it.unit || '', qty: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0, sub: !!it.sub, amount: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) }));
            if (!items.length) { showToast('항목 필요', '명세(DESCRIPTION) 1건 이상을 입력하세요.'); return; }
            const remarks = (STATE.tradeDraft.remarks || []).map(r => (r || '').trim()).filter(Boolean);
            const t = computeTradeTotals();
            const client = document.getElementById('trade-client').value.trim();
            let docNo = document.getElementById('trade-docno').value.trim();
            if (!id && (docNo === '' || docNo === STATE.tradeAutoDocNo)) {
                try { const { data, error } = await sb.rpc('next_trade_no', { p_kind: kind }); if (!error && data) docNo = data; } catch (e) { }
            }
            if (!docNo) docNo = nextTradeNo(kind);
            const row = {
                kind, doc_no: docNo, client, partner: client, service: document.getElementById('trade-service').value.trim(),
                pjt_title: document.getElementById('trade-pjt').value.trim(), inq_no: document.getElementById('trade-inq').value.trim(), item_no: document.getElementById('trade-item').value.trim(),
                person_in_charge: document.getElementById('trade-person').value.trim(), partner_contact: document.getElementById('trade-person').value.trim(),
                payment: document.getElementById('trade-payment').value.trim(), delivery: document.getElementById('trade-delivery').value.trim(), terms: document.getElementById('trade-terms').value.trim(), validity: document.getElementById('trade-validity').value.trim(), due_date: document.getElementById('trade-due').value || null,
                issuer_tel: document.getElementById('trade-issuer-tel').value.trim(), issuer_fax: document.getElementById('trade-issuer-fax').value.trim(), issuer_email: document.getElementById('trade-issuer-email').value.trim(),
                doc_date: document.getElementById('trade-date').value || null,
                status: (id && STATE.trade.find(x => x.id === parseInt(id))) ? STATE.trade.find(x => x.id === parseInt(id)).status : 'draft',
                items, remarks, vat: t.vat, subtotal: t.subtotal, tax: t.tax, total: t.total,
                author: STATE.profile.name, author_id: STATE.currentUser ? STATE.currentUser.id : null, dept_id: document.getElementById('trade-dept').value
            };
            let error;
            if (id) { ({ error } = await sb.from('trade_documents').update(row).eq('id', parseInt(id))); }
            else { ({ error } = await sb.from('trade_documents').insert(row)); }
            if (error) { showToast('저장 실패', error.message); return; }
            logAudit(id ? 'trade_update' : 'trade_create', row.doc_no, `${TRADE_KIND[kind][0]} · ${row.client} · ₩${fmtNum(row.total)}`);
            await reloadTrade(); renderTrade(); renderDashboardWidgets(); closeModal('trade-form-modal');
            if (id && !document.getElementById('trade-detail-modal').classList.contains('hidden')) openTradeDetail(parseInt(id));
            showToast('저장 완료', `${TRADE_KIND[kind][0]} ${row.doc_no} 저장됨`);
        }
        // 업로드된 SLENO 양식 기반 문서(표지 + 상세) HTML — 로고/연락처/디자인 개선
        function tradeDocHTML(t) {
            const co = company();
            const isPo = t.kind === 'po';
            const title = isPo ? 'PURCHASE ORDER' : 'QUOTATION';
            const noLabel = isPo ? 'P.O. NO.' : 'QUO. NO.';
            const maroon = '#8a2f3b', navy = '#1f2a44', ink = '#1e293b', mute = '#94a3b8', line = '#e6e8ec';
            const tel = t.issuerTel || co.tel, fax = t.issuerFax || co.fax, email = t.issuerEmail || co.email;
            const logoTag = co.logo
                ? `<img src="${co.logo}" alt="" style="height:48px;width:auto;display:block">`
                : `<div style="font-size:15px;font-weight:800;color:#2563eb;letter-spacing:.5px">${esc(co.name)}</div>`;
            const head = (label) => `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid ${line};padding-bottom:12px;margin-bottom:0">
                <div style="font-size:10.5px;letter-spacing:4px;color:${mute};font-weight:700">${label}</div>${logoTag}</div>`;
            const foot = `<div style="text-align:center;color:${mute};font-size:11px;font-weight:700;letter-spacing:2px;margin-top:30px;border-top:1px solid ${line};padding-top:12px">${esc(co.name)}</div>`;
            const titleBlock = (big) => `<div style="text-align:center;margin:${big ? '40px 0 34px' : '22px 0 22px'}"><div style="font-size:${big ? 32 : 27}px;font-weight:800;color:${maroon};letter-spacing:5px">${title}</div><div style="width:64px;height:3px;background:${maroon};border-radius:2px;margin:12px auto 0"></div></div>`;

            // ── 표지 ──
            const coverRow = (label, val, accent) => `<tr>
                <td style="width:34%;text-align:right;color:${mute};font-size:10.5px;letter-spacing:1.5px;font-weight:700;padding:13px 16px;border-bottom:1px solid ${line};vertical-align:middle">${label}</td>
                <td style="font-weight:700;color:${accent ? maroon : ink};font-size:14px;padding:13px 16px;border-bottom:1px solid ${line}">${val || ''}</td></tr>`;
            const cover = `<div style="font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:${ink};padding:6px 2px;page-break-after:always">
                ${head(title + ' DOCUMENT')}
                ${titleBlock(true)}
                <table style="width:100%;border-collapse:collapse;max-width:640px;margin:0 auto;border-top:2px solid ${ink}">
                    ${coverRow('CLIENT', esc(t.client), true)}
                    ${coverRow('PJT TITLE', esc(t.pjtTitle))}
                    ${coverRow('INQ. NO.', esc(t.inqNo))}
                    ${coverRow('ITEM NO.', esc(t.itemNo))}
                    ${coverRow('SERVICE', esc(t.service))}
                    ${coverRow(noLabel, esc(t.docNo), true)}
                    ${coverRow('DATE', esc(t.docDate))}
                    ${coverRow('PERSON IN CHARGE', esc(t.personInCharge))}
                </table>
                ${foot}
            </div>`;

            // ── 상세 ──
            const infoRow = (label, val) => `<tr><td style="color:${mute};font-size:10.5px;letter-spacing:1.5px;font-weight:700;padding:7px 0;width:96px;vertical-align:top">${label}</td><td style="font-weight:700;color:${ink};font-size:13px;padding:7px 0">${val || '<span style="color:#cbd5e1">-</span>'}</td></tr>`;
            let no = 0;
            const itemRows = (t.items || []).map(it => {
                const amount = it.amount != null ? it.amount : (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
                if (it.sub) {
                    return `<tr style="background:#faf7f8">
                        <td style="padding:7px 8px;border:1px solid ${line}"></td>
                        <td style="padding:7px 8px 7px 28px;border:1px solid ${line};color:#64748b;font-size:12.5px">- ${esc(it.description)}</td>
                        <td style="padding:7px 8px;border:1px solid ${line};font-size:11px;color:#94a3b8">${esc(it.notes)}</td>
                        <td style="padding:7px 8px;border:1px solid ${line};text-align:center;color:#94a3b8">${esc(it.unit)}</td>
                        <td style="padding:7px 8px;border:1px solid ${line};text-align:center;color:#94a3b8">${it.qty ? fmtNum(it.qty) : ''}</td>
                        <td style="padding:7px 8px;border:1px solid ${line};text-align:right;color:#94a3b8">${it.unitPrice ? '₩ ' + fmtNum(it.unitPrice) : ''}</td>
                        <td style="padding:7px 8px;border:1px solid ${line};text-align:right;color:#94a3b8">₩ ${fmtNum(amount)}</td></tr>`;
                }
                no++;
                return `<tr>
                    <td style="padding:8px;border:1px solid ${line};text-align:center;color:#64748b;font-weight:700">${no}</td>
                    <td style="padding:8px;border:1px solid ${line};font-weight:700;color:${ink}">${esc(it.description)}</td>
                    <td style="padding:8px;border:1px solid ${line};font-size:11px;color:#64748b">${esc(it.notes)}</td>
                    <td style="padding:8px;border:1px solid ${line};text-align:center">${esc(it.unit)}</td>
                    <td style="padding:8px;border:1px solid ${line};text-align:center">${it.qty ? fmtNum(it.qty) : ''}</td>
                    <td style="padding:8px;border:1px solid ${line};text-align:right">${it.unitPrice ? '₩ ' + fmtNum(it.unitPrice) : ''}</td>
                    <td style="padding:8px;border:1px solid ${line};text-align:right;font-weight:700">₩ ${fmtNum(amount)}</td></tr>`;
            }).join('');
            const remarkList = (t.remarks || []).filter(Boolean).map(r => `<li style="margin:4px 0">${esc(r)}</li>`).join('');
            const detail = `<div style="font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:${ink};padding:6px 2px">
                ${head(title + ' · DETAIL')}
                ${titleBlock(false)}
                <table style="width:100%;font-size:13px;margin-bottom:18px"><tr>
                    <td style="vertical-align:top;width:50%"><table style="width:100%">
                        ${infoRow('TO', '<span style="font-size:15px;font-weight:800">' + esc(t.client) + '</span>')}
                        ${infoRow('DATE', esc(t.docDate))}
                        ${infoRow('PAYMENT', esc(t.payment))}
                        ${infoRow('DELIVERY', esc(t.delivery))}
                        ${infoRow('TERMS', esc(t.terms))}
                        ${infoRow('VALIDITY', esc(t.validity))}
                    </table></td>
                    <td style="vertical-align:top;font-size:12px;line-height:1.75;color:#475569;padding-left:8px">
                        <div style="font-weight:800;color:${ink};font-size:14px;margin-bottom:4px">${esc(co.name)}</div>
                        <div style="color:#2563eb">${esc(co.website)}</div>
                        <div>${esc(co.address)}</div>
                        <div style="margin-top:4px">TEL. ${esc(tel)}${fax ? ' / FAX. ' + esc(fax) : ''}</div>
                        <div>E-MAIL : ${esc(email)}</div>
                    </td></tr></table>
                <div style="display:flex;justify-content:space-between;align-items:center;background:${navy};color:#fff;padding:13px 18px;border-radius:7px"><span style="letter-spacing:4px;font-size:12.5px;font-weight:700">TOTAL AMOUNT</span><span style="font-size:21px;font-weight:800">₩ ${fmtNum(t.total)}</span></div>
                <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">
                    <thead><tr style="background:#f1f5f9;color:#475569;font-size:11.5px;letter-spacing:.5px">
                        <th style="padding:9px 8px;border:1px solid ${line};width:38px">NO</th>
                        <th style="padding:9px 8px;border:1px solid ${line};text-align:left">DESCRIPTION</th>
                        <th style="padding:9px 8px;border:1px solid ${line};width:86px">NOTES</th>
                        <th style="padding:9px 8px;border:1px solid ${line};width:52px">UNIT</th>
                        <th style="padding:9px 8px;border:1px solid ${line};width:52px">Q'TY</th>
                        <th style="padding:9px 8px;border:1px solid ${line};width:112px;text-align:right">UNIT PRICE</th>
                        <th style="padding:9px 8px;border:1px solid ${line};width:124px;text-align:right">AMOUNT</th>
                    </tr></thead>
                    <tbody>${itemRows}</tbody>
                    <tfoot>
                        <tr style="background:#fdf2f4"><td colspan="6" style="padding:11px 14px;border:1px solid ${line};text-align:right;font-weight:800;letter-spacing:3px;color:${maroon}">TOTAL</td><td style="padding:11px 8px;border:1px solid ${line};text-align:right;font-weight:800;color:${maroon}">₩ ${fmtNum(t.total)}</td></tr>
                        ${t.vat ? `<tr><td colspan="7" style="padding:6px 12px;border:1px solid ${line};text-align:right;color:#64748b;font-size:11.5px">(공급가액 ₩${fmtNum(t.subtotal)} + 부가세 ₩${fmtNum(t.tax)})</td></tr>` : ''}
                    </tfoot>
                </table>
                ${remarkList ? `<div style="margin-top:18px"><div style="font-size:10.5px;letter-spacing:3px;color:${maroon};font-weight:700;border-bottom:1.5px solid ${line};padding-bottom:5px;margin-bottom:7px">REMARKS</div><ul style="margin:0;padding-left:18px;font-size:12px;color:#475569;line-height:1.6">${remarkList}</ul></div>` : ''}
                ${foot}
            </div>`;
            return { cover, detail };
        }
        function openTradeDetail(id) {
            const t = STATE.trade.find(x => x.id === id); if (!t) return;
            STATE._openDetail = { type: 'trade', id };
            const manage = canManageTrade(t);
            document.getElementById('trade-detail-heading').innerText = `${TRADE_KIND[t.kind][0]} ${t.docNo}`;
            const statusBtns = manage ? `<div class="flex gap-1.5 flex-wrap">${Object.keys(TRADE_STATUS).map(s => `<button onclick="setTradeStatus(${t.id},'${s}')" class="px-2.5 py-1 rounded-lg text-[12px] font-bold border ${t.status === s ? CHIP_TONES[TRADE_STATUS[s][1]] : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}">${TRADE_STATUS[s][0]}</button>`).join('')}</div>` : tradeStatusChip(t.status);
            const stockBadge = t.receivedAt ? `<span class="wsp-chip bg-emerald-50 text-emerald-700 border-emerald-200">재고 ${t.kind === 'po' ? '입고' : '출고'} 완료 · ${(t.receivedAt || '').slice(0, 10)}</span>` : '';
            const stockBtn = (manage && !t.receivedAt && !STATE.tradeTableMissing) ? `<button onclick="openTradeStockModal(${t.id})" class="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"><i data-lucide="package-plus" class="w-3.5 h-3.5"></i> 재고 ${t.kind === 'po' ? '입고' : '출고'} 처리</button>` : '';
            const ctrl = `<div class="flex flex-wrap items-center gap-2 mb-4">
                ${statusBtns}${stockBadge}
                <div class="flex gap-2 ml-auto">
                    ${stockBtn}
                    <button onclick="printTradeDoc(${t.id})" class="px-3 py-2 bg-slate-900 hover:bg-teal-600 text-white text-xs font-bold rounded-lg flex items-center gap-1"><i data-lucide="printer" class="w-3.5 h-3.5"></i> PDF 출력 / 인쇄</button>
                    ${manage ? `<button onclick="openTradeForm(${t.id})" class="px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-lg">편집</button><button onclick="deleteTrade(${t.id})" class="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg">삭제</button>` : ''}
                </div></div>`;
            const doc2 = tradeDocHTML(t);
            document.getElementById('trade-detail-body').innerHTML = ctrl + `<div class="wsp-doc-paper border border-slate-200 rounded-xl p-5 overflow-x-auto shadow-sm"><div style="min-width:640px">${doc2.cover}<div style="height:1px;background:#e2e8f0;margin:24px 0"></div>${doc2.detail}</div></div>`;
            openModal('trade-detail-modal'); if (window.lucide) lucide.createIcons();
        }
        async function setTradeStatus(id, status) {
            const t = STATE.trade.find(x => x.id === id); if (!t) return;
            if (!canManageTrade(t)) { showToast('권한 없음', '본인 부서의 문서만 변경할 수 있습니다.'); return; }
            const { error } = await sb.from('trade_documents').update({ status }).eq('id', id);
            if (error) { showToast('변경 실패', error.message); return; }
            await reloadTrade(); renderTrade(); if (!document.getElementById('trade-detail-modal').classList.contains('hidden')) openTradeDetail(id);
            showToast('상태 변경', `${TRADE_STATUS[status][0]} 상태로 변경되었습니다.`);
            // 완료 처리 시 아직 재고 반영 전이면 입고/출고 처리 창을 자동으로 안내
            const t2 = STATE.trade.find(x => x.id === id);
            if (status === 'done' && t2 && !t2.receivedAt && !STATE.tradeTableMissing && canManageTrade(t2)) openTradeStockModal(id);
        }
        async function deleteTrade(id) {
            const t = STATE.trade.find(x => x.id === id); if (!t) return;
            if (!canManageTrade(t)) { showToast('권한 없음', '본인 부서의 문서만 삭제할 수 있습니다.'); return; }
            if (!confirm(`${TRADE_KIND[t.kind][0]} ${t.docNo} 을(를) 삭제하시겠습니까?`)) return;
            const { error } = await sb.from('trade_documents').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            logAudit('trade_delete', t.docNo, TRADE_KIND[t.kind][0]);
            await reloadTrade(); renderTrade(); renderDashboardWidgets(); closeModal('trade-detail-modal');
            showToast('삭제', '문서가 삭제되었습니다.');
        }
        // ── 발주↔재고 자동 연동 ──
        function tradeStockKindOf(t) { return t.kind === 'po' ? 'in' : 'out'; }
        function openTradeStockModal(id) {
            const t = STATE.trade.find(x => x.id === id); if (!t) return;
            if (!canManageTrade(t)) { showToast('권한 없음', '본인 부서의 문서만 처리할 수 있습니다.'); return; }
            if (t.receivedAt) { showToast('이미 반영됨', '이미 재고에 반영된 문서입니다.'); return; }
            if (STATE.tradeTableMissing) return;
            const kind = tradeStockKindOf(t);
            const rows = (t.items || []).filter(it => !it.sub).map(it => {
                const match = (STATE.inventory || []).find(inv => inv.name && it.description && inv.name.trim() === it.description.trim());
                return { description: it.description, qty: Number(it.qty) || 0, itemId: match ? match.id : '' };
            });
            STATE.tradeStockDraft = { tradeId: id, kind, rows };
            document.getElementById('trade-stock-title').innerText = (kind === 'in' ? '재고 입고 처리' : '재고 출고 처리') + ' · ' + t.docNo;
            fillWarehouseSelect('trade-stock-warehouse', defaultWarehouseId());
            renderTradeStockRows();
            openModal('trade-stock-modal');
        }
        function renderTradeStockRows() {
            const wrap = document.getElementById('trade-stock-body'); if (!wrap) return;
            const d = STATE.tradeStockDraft; if (!d) return;
            const invOpts = (STATE.inventory || []).map(i => `<option value="${i.id}">${esc(i.name)}${i.sku ? ' (' + esc(i.sku) + ')' : ''}</option>`).join('');
            wrap.innerHTML = d.rows.length ? d.rows.map((r, i) => `
                <div class="flex flex-col sm:flex-row sm:items-center gap-2 border border-slate-100 rounded-xl p-3">
                    <div class="flex-1 min-w-0"><div class="font-semibold text-slate-700 text-sm truncate">${esc(r.description) || '(이름 없음)'}</div><div class="text-[12px] text-slate-400">문서 수량 ${fmtNum(r.qty)}</div></div>
                    <select onchange="updateTradeStockRow(${i},'itemId',this.value)" class="px-2.5 py-2 border rounded-lg text-[13px] bg-white outline-none sm:w-56"><option value="">재고 반영 안 함</option>${invOpts}</select>
                    <input type="number" step="any" min="0" value="${r.qty}" oninput="updateTradeStockRow(${i},'qty',this.value)" class="w-full sm:w-24 px-2 py-2 border rounded-lg text-[13px] text-right outline-none" title="반영 수량">
                </div>`).join('') : '<div class="wsp-empty">반영할 품목이 없습니다.</div>';
            d.rows.forEach((r, i) => { if (r.itemId) { const s = wrap.children[i] && wrap.children[i].querySelector('select'); if (s) s.value = String(r.itemId); } });
            const note = document.getElementById('trade-stock-note');
            if (note) note.innerText = d.kind === 'in' ? '발주 품목을 선택한 재고 품목에 입고합니다. 반영하지 않을 줄은 "재고 반영 안 함"으로 두세요.' : '견적 품목을 선택한 재고 품목에서 출고합니다. (현재고보다 많으면 막힙니다)';
            if (window.lucide) lucide.createIcons();
        }
        function updateTradeStockRow(i, field, val) { const r = STATE.tradeStockDraft.rows[i]; if (!r) return; r[field] = field === 'qty' ? (parseFloat(val) || 0) : val; }
        async function handleApplyTradeStock() {
            const d = STATE.tradeStockDraft; if (!d) return;
            const t = STATE.trade.find(x => x.id === d.tradeId); if (!t) return;
            const targets = d.rows.filter(r => r.itemId && Number(r.qty) > 0);
            if (!targets.length) { showToast('선택 필요', '재고에 반영할 품목을 1건 이상 선택하세요.'); return; }
            let okc = 0; const fail = [];
            for (const r of targets) {
                const whId = parseInt((document.getElementById('trade-stock-warehouse') || {}).value) || defaultWarehouseId();
                const { error } = await sb.rpc('apply_stock_move', { p_item_id: parseInt(r.itemId), p_kind: d.kind, p_qty: Number(r.qty), p_reason: `${t.docNo} ${d.kind === 'in' ? '발주 입고' : '견적 출고'}`, p_warehouse_id: whId });
                if (error) { const inv = (STATE.inventory || []).find(x => String(x.id) === String(r.itemId)); const m = (error.message || '').toLowerCase(); fail.push((inv ? inv.name : r.itemId) + ': ' + (m.indexOf('insufficient') >= 0 ? '재고 부족' : m.indexOf('forbidden') >= 0 ? '권한 없음' : m.indexOf('function') >= 0 || m.indexOf('does not exist') >= 0 ? '함수 미설치' : '실패')); }
                else okc++;
            }
            if (okc > 0) { await sb.from('trade_documents').update({ received_at: new Date().toISOString() }).eq('id', t.id); }
            await reloadInventory(); await reloadStockMoves(); await reloadInventoryStock(); await reloadTrade();
            renderInventory(); renderTrade(); renderDashboardWidgets();
            closeModal('trade-stock-modal');
            if (!document.getElementById('trade-detail-modal').classList.contains('hidden')) openTradeDetail(t.id);
            if (fail.length) showToast(`일부 실패 (성공 ${okc}건)`, fail.slice(0, 3).join(' / '));
            else showToast('재고 반영 완료', `${okc}건이 ${d.kind === 'in' ? '입고' : '출고'} 처리되었습니다.`);
        }
        // 새 창 없이 인쇄/PDF — 숨겨진 iframe 사용 (로고 로드 후 인쇄)
        function printTradeDoc(id) {
            const t = STATE.trade.find(x => x.id === id); if (!t) return;
            const doc2 = tradeDocHTML(t);
            let f = document.getElementById('wsp-print-frame'); if (f) f.remove();
            f = document.createElement('iframe'); f.id = 'wsp-print-frame';
            f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
            document.body.appendChild(f);
            const fd = f.contentWindow.document;
            fd.open();
            fd.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.docNo || title(t))}</title><style>@page{size:A4;margin:13mm}html,body{margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${doc2.cover}${doc2.detail}</body></html>`);
            fd.close();
            const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { } };
            const img = fd.images && fd.images[0];
            if (img && !img.complete) { img.onload = () => setTimeout(go, 60); img.onerror = () => setTimeout(go, 60); setTimeout(go, 1500); }
            else setTimeout(go, 180);
        }
        function title(t) { return (t && t.kind === 'po') ? 'PURCHASE_ORDER' : 'QUOTATION'; }
        function openCompanyProfile() {
            if (STATE.profile.role !== 'admin') { showToast('권한 없음', '회사 정보는 관리자만 수정할 수 있습니다.'); return; }
            const co = company();
            document.getElementById('company-name').value = co.name || '';
            document.getElementById('company-website').value = co.website || '';
            document.getElementById('company-address').value = co.address || '';
            document.getElementById('company-tel').value = co.tel || '';
            document.getElementById('company-fax').value = co.fax || '';
            document.getElementById('company-email').value = co.email || '';
            STATE.companyLogoDraft = co.logo || ''; STATE.companyLogoChanged = false;
            const pv = document.getElementById('company-logo-preview'), em = document.getElementById('company-logo-empty');
            if (co.logo) { pv.src = co.logo; pv.style.display = 'block'; em.style.display = 'none'; }
            else { pv.src = ''; pv.style.display = 'none'; em.style.display = 'block'; }
            openModal('company-profile-modal');
        }
        function handleCompanyLogoSelect(e) {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = () => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const H = 220, W = Math.max(1, Math.round(img.width * H / img.height));
                        const c = document.createElement('canvas'); c.width = W; c.height = H;
                        c.getContext('2d').drawImage(img, 0, 0, W, H);
                        const durl = c.toDataURL('image/png');
                        STATE.companyLogoDraft = durl; STATE.companyLogoChanged = true;
                        const pv = document.getElementById('company-logo-preview'); pv.src = durl; pv.style.display = 'block';
                        document.getElementById('company-logo-empty').style.display = 'none';
                    } catch (err) { showToast('로고 처리 실패', '다른 이미지를 시도해 주세요.'); }
                };
                img.src = r.result;
            };
            r.readAsDataURL(f);
        }
        function clearCompanyLogo() {
            STATE.companyLogoDraft = ''; STATE.companyLogoChanged = true;
            const pv = document.getElementById('company-logo-preview'), em = document.getElementById('company-logo-empty');
            pv.src = ''; pv.style.display = 'none'; em.style.display = 'block';
        }
        async function handleSaveCompany(e) {
            e.preventDefault();
            const co = {
                name: document.getElementById('company-name').value.trim(), website: document.getElementById('company-website').value.trim(),
                address: document.getElementById('company-address').value.trim(), tel: document.getElementById('company-tel').value.trim(),
                fax: document.getElementById('company-fax').value.trim(), email: document.getElementById('company-email').value.trim(),
                logo: (STATE.companyLogoDraft !== undefined ? STATE.companyLogoDraft : (company().logo || ''))
            };
            if (STATE.companyLogoChanged && co.logo && /^data:/.test(co.logo)) {
                const url = await uploadLogoToStorage(co.logo);
                if (url) co.logo = url; // 실패 시 base64 그대로 사용(스토리지 미설정 안전 폴백)
            }
            STATE.companyLogoChanged = false;
            const { error } = await sb.from('app_settings').upsert({ key: 'company_profile', value: co });
            if (error) { showToast('저장 실패', error.message); return; }
            STATE.company = Object.assign({}, DEFAULT_COMPANY, co);
            closeModal('company-profile-modal'); showToast('저장 완료', '발행 회사 정보가 모든 문서에 적용됩니다.');
        }

        // 열려 있는 상세 모달을 다른 사용자의 변경에 맞춰 실시간 갱신
        function refreshOpenDetail(type) {
            const od = STATE._openDetail; if (!od || od.type !== type) return;
            const modalId = { project: 'project-detail-modal', meeting: 'meeting-detail-modal', ticket: 'ticket-detail-modal', asset: 'asset-detail-modal', inventory: 'inventory-detail-modal', trade: 'trade-detail-modal' }[type];
            const modal = document.getElementById(modalId); if (!modal || modal.classList.contains('hidden')) return;
            const lists = { project: STATE.projects, meeting: STATE.weeklyMeetings, ticket: STATE.tickets || [], asset: STATE.assets || [], inventory: STATE.inventory || [], trade: STATE.trade || [] };
            const exists = (lists[type] || []).some(r => r.id === od.id);
            if (!exists) { closeModal(modalId, true); STATE._openDetail = null; showToast('항목 삭제됨', '보고 있던 항목이 다른 사용자에 의해 삭제되었습니다.'); return; }
            const fn = { project: openProjectDetail, meeting: openMeetingDetail, ticket: openTicketDetail, asset: openAssetDetail, inventory: openInventoryDetail, trade: openTradeDetail }[type];
            try { fn(od.id); } catch (e) { }
        }
        function setupRealtime() {
            if (STATE._rt) return;
            STATE._rt = sb.channel('portal-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, async () => { await reloadEvents(); renderFilters(); renderCalendar(); renderDashboardWidgets(); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, async () => { await reloadSites(); const sel = document.getElementById('event-site'); renderSiteOptions(sel ? sel.value : ''); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, async () => { await reloadProjects(); renderDashboardWidgets(); if (STATE.currentTab === 'management-progress') renderProjects(); refreshOpenDetail('project'); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, async () => { await reloadDocuments(); renderDashboardWidgets(); refreshDocViews(); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, async () => { await reloadTickets(); renderDashboardWidgets(); if (STATE.currentTab === 'field-support') renderTickets(); refreshOpenDetail('ticket'); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, async () => { await reloadAssets(); renderDashboardWidgets(); if (STATE.currentTab === 'assets') renderAssets(); refreshOpenDetail('asset'); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_meetings' }, async () => { await reloadMeetings(); renderDashboardWidgets(); if (STATE.currentTab === 'weekly-meeting') renderWeeklyMeetings(); refreshOpenDetail('meeting'); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, async () => { await reloadInventory(); renderDashboardWidgets(); if (STATE.currentTab === 'inventory') renderInventory(); refreshOpenDetail('inventory'); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_moves' }, async () => { await reloadStockMoves(); if (STATE.currentTab === 'inventory') refreshOpenDetail('inventory'); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_options' }, async () => { await reloadInventoryOptions(); if (!document.getElementById('inventory-options-modal').classList.contains('hidden')) renderInventoryOptions(); syncInventoryFormOptions(); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'taxonomy_options' }, async () => { await reloadTaxonomy(); if (!document.getElementById('taxonomy-modal').classList.contains('hidden')) renderTaxonomyOptions(); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'completion_reports' }, async () => { await reloadCompletionReports(); if (STATE._openDetail && STATE._openDetail.type === 'ticket' && !document.getElementById('ticket-detail-modal').classList.contains('hidden')) refreshTicketReportList(STATE._openDetail.id); })
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, async () => { if (STATE.currentTab === 'management-logs') { await reloadAuditLogs(); renderAuditLogs(); } })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_documents' }, async () => { await reloadTrade(); renderDashboardWidgets(); if (STATE.currentTab === 'trade') renderTrade(); refreshOpenDetail('trade'); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'partners' }, async () => { await reloadPartners(); if (!document.getElementById('partner-modal').classList.contains('hidden')) renderPartnerList(); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouses' }, async () => { await reloadWarehouses(); if (!document.getElementById('warehouse-modal').classList.contains('hidden')) renderWarehouseList(); populateInventoryWarehouseFilter(); if (STATE.currentTab === 'inventory') renderInventory(); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_stock' }, async () => { await reloadInventoryStock(); if (STATE.currentTab === 'inventory') renderInventory(); if (STATE._openDetail && STATE._openDetail.type === 'inventory' && !document.getElementById('inventory-detail-modal').classList.contains('hidden')) openInventoryDetail(STATE._openDetail.id); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, async () => { await reloadSettings(); renderDashboardNotice(); renderDashboardWidgets(); renderCustomFeaturesMenu(); if (STATE.currentTab === 'management-stats') renderPermissionMatrix(); if (STATE.currentUser) switchTab(STATE.currentTab); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => { await reloadProfiles(); renderDashboardWidgets(); if (STATE.currentTab === 'management-stats') { renderPendingUsers(); renderActiveUsers(); } await maybeRecheckSelf(); })
                .subscribe();
        }

        // 관리자가 내 계정의 권한/부서/직급을 바꾸면 새로고침 없이 즉시 반영
        async function maybeRecheckSelf() {
            if (!STATE.currentUser) return;
            const me = STATE.users.find(u => u.id === STATE.currentUser.id);
            if (!me) { showToast('세션 종료', '관리자에 의해 계정 접근 권한이 해제되었습니다.'); await handleUserLogout(); return; }
            const changed = (me.role !== STATE.currentUser.role) || (me.deptId !== STATE.currentUser.deptId) || (me.position !== STATE.currentUser.position);
            if (changed) {
                STATE.currentUser.role = me.role; STATE.currentUser.deptId = me.deptId; STATE.currentUser.position = me.position;
                STATE.profile.role = me.role; STATE.profile.deptId = me.deptId;
                refreshRoleScopedUI(); updateProfileUI(); switchTab(STATE.currentTab);
                showToast('권한 변경', '관리자에 의해 계정 정보가 실시간으로 갱신되었습니다.');
            }
        }

        function humanSize(bytes) {
            if (bytes === null || bytes === undefined || isNaN(bytes)) return '';
            const u = ['B', 'KB', 'MB', 'GB']; let i = 0, n = bytes;
            while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
            return n.toFixed(n < 10 && i > 0 ? 1 : 0) + ' ' + u[i];
        }

        // Supabase 저장소 key는 ASCII만 허용 → 한글/공백 등은 안전 문자로 변환 (원본 파일명은 DB에 별도 보관)
        function safeStorageKey(name, prefix) {
            name = name || 'file';
            const dot = name.lastIndexOf('.');
            const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
            let base = (dot >= 0 ? name.slice(0, dot) : name).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
            if (!base) base = 'file';
            const rand = Math.random().toString(36).slice(2, 8);
            return `${prefix || ''}${Date.now()}_${base}_${rand}${ext ? '.' + ext : ''}`;
        }

        function applyDeptLock(selectId) {
            const sel = document.getElementById(selectId); if (!sel) return;
            if (STATE.profile.role === 'admin') { sel.disabled = false; }
            else { sel.value = STATE.profile.deptId; sel.disabled = true; }
        }

        // ── 역할 기반 UI 노출 ────────────────────────────────────────────
        function refreshRoleScopedUI() {
            const isAdmin = STATE.profile.role === 'admin';
            const adminGroup = document.getElementById('sidebar-admin-group');
            if (adminGroup) { adminGroup.style.opacity = isAdmin ? '1' : '0.4'; adminGroup.style.pointerEvents = isAdmin ? 'auto' : 'none'; }
            const maintCtrl = document.getElementById('admin-maintenance-control');
            if (maintCtrl) maintCtrl.classList.toggle('hidden', !isAdmin);
            const featBtn = document.getElementById('add-feature-btn');
            if (featBtn) featBtn.classList.toggle('hidden', !isAdmin);
            // 로그인한 사용자 기준으로 작성 폼 부서 옵션을 다시 채움(본인 부서 로드 보장)
            renderDeptOptions();
        }

        async function toggleActiveTabMaintenance() {
            if (STATE.profile.role !== 'admin') { showToast('보안 오류', '점검 제어 권한은 관리자 전용입니다.'); return; }
            const t = STATE.currentTab;
            STATE.maintenance[t] = !STATE.maintenance[t];
            const { error } = await sb.from('app_settings').upsert({ key: 'maintenance', value: STATE.maintenance, updated_at: new Date().toISOString() });
            if (error) { STATE.maintenance[t] = !STATE.maintenance[t]; showToast('저장 실패', error.message); return; }
            showToast('공정 통제', `[${t}] 점검 상태가 변경되었습니다. (전 사용자 실시간 적용)`);
            switchTab(t);
        }

        function updateProfileUI() {
            const avatar = document.getElementById('user-avatar');
            const dName = document.getElementById('user-display-name');
            const dDept = document.getElementById('user-display-dept');
            const u = STATE.currentUser;
            if (avatar) {
                avatar.innerText = u ? u.name.substring(0, 2).toUpperCase() : '?';
                avatar.className = u ? "w-7 h-7 rounded-full bg-slate-950 flex items-center justify-center text-white text-[12px] font-bold shadow-sm"
                                     : "w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-bold shadow-inner";
            }
            if (dName) dName.innerText = u ? `${u.name} (${u.position})` : '사용자 미설정';
            if (dDept) {
                const dept = u ? STATE.departments.find(d => d.id === u.deptId) : null;
                dDept.innerText = dept ? dept.name : (u ? '인프라 총무부' : '로그인 필요');
            }
            const headerRoleBadge = document.getElementById('header-user-role-badge');
            if (headerRoleBadge) {
                const roleLabels = { 'admin': '시스템 마스터 관리자', 'ceo': '대표이사 (CEO)', 'head': '본부 부서장', 'leader': '실무 팀장', 'employee': '일반 실무진' };
                headerRoleBadge.innerText = u ? (roleLabels[u.role] || '미인가 상태') : '로그인 필요';
            }
        }

        async function handleSaveProfile(e) {
            e.preventDefault();
            if (!STATE.currentUser) return;
            const name = document.getElementById('profile-name').value.trim();
            const isAdmin = STATE.profile.role === 'admin';
            const deptId = isAdmin ? document.getElementById('profile-dept').value : STATE.currentUser.deptId;
            const patch = isAdmin ? { name, dept_id: deptId } : { name };
            const { error } = await sb.from('profiles').update(patch).eq('id', STATE.currentUser.id);
            if (error) { showToast('저장 실패', error.message); return; }
            STATE.currentUser.name = name; STATE.currentUser.deptId = deptId;
            STATE.profile.name = name; STATE.profile.deptId = deptId;
            updateProfileUI(); closeModal('profile-setting-modal'); showToast('정보 갱신', '사원 정보가 저장되었습니다.');
        }

        // ── 필터 / 부서 옵션 / 헤더 셀렉트 ────────────────────────────────
        function renderFilters() {
            const container = document.getElementById('dept-filter-container'); if (!container) return; container.innerHTML = '';
            STATE.departments.forEach(dept => {
                const div = document.createElement('div'); div.className = "flex items-center justify-between py-0.5";
                div.innerHTML = `<label class="flex items-center gap-2 cursor-pointer w-full text-xs font-medium text-slate-600"><input type="checkbox" ${STATE.visibility[dept.id] ? 'checked' : ''} onchange="toggleVisibility('${dept.id}')" class="rounded border-slate-300 text-slate-900 focus:ring-slate-500"> <span>${dept.name}</span></label>`;
                container.appendChild(div);
            });
        }
        function renderDeptOptions() {
            const isAdmin = STATE.profile && STATE.profile.role === 'admin';
            const loggedIn = !!(STATE.currentUser && STATE.currentUser.id);
            const myDept = STATE.profile && STATE.profile.deptId;
            const optionsHTML = STATE.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
            const noCeoHTML = STATE.departments.filter(d => d.id !== 'ceo').map(d => `<option value="${d.id}">${d.name}</option>`).join('');
            const ownDept = STATE.departments.find(d => d.id === myDept);
            const ownHTML = ownDept ? `<option value="${ownDept.id}">${ownDept.name}</option>` : '';
            // 본인 부서로 제한하는 건 "로그인한 비관리자 + 본인 부서를 실제로 찾았을 때"만.
            // (로그인 전이거나 부서를 못 찾으면 전체 목록으로 둬서 작성이 막히지 않게 함)
            const restrict = loggedIn && !isAdmin && !!ownHTML;
            const inputAll = restrict ? ownHTML : optionsHTML;
            const inputNoCeo = restrict ? ownHTML : noCeoHTML;
            // profile-dept(소속부서)·signup-dept는 전체 목록 유지(권한은 별도 제어)
            ['event-dept'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = inputAll; });
            ['profile-dept', 'signup-dept'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = optionsHTML; });
            ['project-dept', 'meeting-dept', 'doc-dept', 'edit-doc-dept'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = inputNoCeo; });
            const tDept = document.getElementById('ticket-dept'); if (tDept) tDept.innerHTML = inputAll;
            const aDept = document.getElementById('asset-dept'); if (aDept) aDept.innerHTML = inputAll;
            const invDept = document.getElementById('inventory-dept'); if (invDept) invDept.innerHTML = inputAll;
            const trDept = document.getElementById('trade-dept'); if (trDept) trDept.innerHTML = inputAll;
            // 필터 셀렉트: 항상 전체 부서(조회/필터는 전 부서 허용)
            const docFilter = document.getElementById('doc-filter-dept'); if (docFilter) docFilter.innerHTML = `<option value="all">전체 부서</option>` + noCeoHTML;
            const archFilter = document.getElementById('archive-filter-dept'); if (archFilter) { const keep = archFilter.value || 'all'; archFilter.innerHTML = `<option value="all">전체 부서</option>` + noCeoHTML; archFilter.value = [...archFilter.options].some(o => o.value === keep) ? keep : 'all'; }
            const meetFilter = document.getElementById('meeting-filter-dept'); if (meetFilter) meetFilter.innerHTML = `<option value="all">전체 부서 보기</option>` + noCeoHTML;
            const projFilter = document.getElementById('project-filter-dept'); if (projFilter) { const keep = projFilter.value || 'all'; projFilter.innerHTML = `<option value="all">전체 부서</option>` + noCeoHTML; projFilter.value = [...projFilter.options].some(o => o.value === keep) ? keep : 'all'; }
            const tFilter = document.getElementById('ticket-filter-dept'); if (tFilter) { const keep = tFilter.value || 'all'; tFilter.innerHTML = `<option value="all">전체 부서</option>` + optionsHTML; tFilter.value = [...tFilter.options].some(o => o.value === keep) ? keep : 'all'; }
            const invFilter = document.getElementById('inventory-filter-dept'); if (invFilter) { const keep = invFilter.value || 'all'; invFilter.innerHTML = `<option value="all">전체 부서</option>` + noCeoHTML; invFilter.value = [...invFilter.options].some(o => o.value === keep) ? keep : 'all'; }
            const trFilter = document.getElementById('trade-filter-dept'); if (trFilter) { const keep = trFilter.value || 'all'; trFilter.innerHTML = `<option value="all">전체 부서</option>` + noCeoHTML; trFilter.value = [...trFilter.options].some(o => o.value === keep) ? keep : 'all'; }
        }
        function toggleVisibility(id) { STATE.visibility[id] = !STATE.visibility[id]; renderCalendar(); renderDashboardWidgets(); }
        // ── 담당자 선택기(직원 선택 + 직접 입력 병행) ───────────────────
        // 가입된 직원을 고르면 UUID가 함께 저장되어 이름이 바뀌어도 알림이 유지됨.
        // '+ 직접 입력'을 고르면 계정 없는 사람(외주 등)을 자유 텍스트로 기입.
        function fillPersonSelect(selectId, customId, curId, curName) {
            const sel = document.getElementById(selectId); const cust = document.getElementById(customId);
            if (!sel) return;
            const approvedUsers = STATE.users.filter(u => u.approved);
            const opts = approvedUsers.map(u => { const dn = (STATE.departments.find(d => d.id === u.deptId) || {}).name || ''; return `<option value="${u.id}">${esc(u.name)}${dn ? ' (' + esc(dn) + ')' : ''}</option>`; }).join('');
            sel.innerHTML = `<option value="">(미지정)</option>` + opts + `<option value="__custom__">+ 직접 입력</option>`;
            const matched = curId && approvedUsers.some(u => u.id === curId);
            if (matched) { sel.value = curId; if (cust) { cust.classList.add('hidden'); cust.value = ''; } }
            else if (curName) { sel.value = '__custom__'; if (cust) { cust.classList.remove('hidden'); cust.value = curName; } }
            else { sel.value = ''; if (cust) { cust.classList.add('hidden'); cust.value = ''; } }
        }
        function onPersonSelectChange(selectId, customId) {
            const sel = document.getElementById(selectId); const cust = document.getElementById(customId);
            if (!sel || !cust) return;
            if (sel.value === '__custom__') { cust.classList.remove('hidden'); cust.focus(); }
            else { cust.classList.add('hidden'); cust.value = ''; }
        }
        function readPerson(selectId, customId) {
            const sel = document.getElementById(selectId); const cust = document.getElementById(customId);
            if (!sel) return { id: '', name: '' };
            if (sel.value === '__custom__') return { id: '', name: cust ? cust.value.trim() : '' };
            if (!sel.value) return { id: '', name: '' };
            const u = STATE.users.find(x => x.id === sel.value);
            return { id: sel.value, name: u ? u.name : '' };
        }
        // 알림/담당 매칭: UUID 우선, 없으면(직접 입력·과거 데이터) 이름으로 매칭
        function isMine(id, name) {
            const myId = STATE.currentUser && STATE.currentUser.id;
            const myName = (STATE.profile.name || '').trim();
            if (id) return id === myId;
            return !!name && name.trim() === myName;
        }
        function populateHeaderSelects() {
            const ys = document.getElementById('cal-year-select'), ms = document.getElementById('cal-month-select');
            if (!ys || !ms) return; ys.innerHTML = ''; ms.innerHTML = '';
            for (let y = 2020; y <= 2035; y++) ys.innerHTML += `<option value="${y}">${y}년</option>`;
            for (let m = 1; m <= 12; m++) ms.innerHTML += `<option value="${m}">${m}월</option>`;
            updateHeaderSelectsUI();
        }
        function updateHeaderSelectsUI() {
            const ys = document.getElementById('cal-year-select'), ms = document.getElementById('cal-month-select');
            if (ys && ms) { ys.value = STATE.currentYear; ms.value = STATE.currentMonth; }
        }
        function handleHeaderNav() {
            const ys = document.getElementById('cal-year-select'), ms = document.getElementById('cal-month-select');
            if (ys && ms) { STATE.currentYear = parseInt(ys.value); STATE.currentMonth = parseInt(ms.value); renderCalendar(); }
        }
        function navigateMonth(offset) { const d = new Date(STATE.currentYear, STATE.currentMonth - 1 + offset, 1); STATE.currentYear = d.getFullYear(); STATE.currentMonth = d.getMonth() + 1; updateHeaderSelectsUI(); renderCalendar(); }
        function navigateToday() { const d = new Date(); STATE.currentYear = d.getFullYear(); STATE.currentMonth = d.getMonth() + 1; updateHeaderSelectsUI(); renderCalendar(); }

        function isToday(y, m, d) { const t = new Date(); return t.getFullYear() === y && (t.getMonth() + 1) === m && t.getDate() === d; }

        // ── 달력 ─────────────────────────────────────────────────────────
        function derivedCalendarItems() {
            const out = [];
            (STATE.trade || []).forEach(t => {
                if (t.status === 'done') return;
                if (t.kind === 'po' && t.dueDate) out.push({ _ref: { type: 'trade', id: t.id }, deptId: t.deptId || '', startDate: t.dueDate, endDate: t.dueDate, title: `🚚 납기 · ${t.docNo || '발주'} ${t.client || ''}`.trim(), color: 'bg-amber-50 border-amber-400 text-amber-700' });
                if (t.kind === 'quote' && t.validity) out.push({ _ref: { type: 'trade', id: t.id }, deptId: t.deptId || '', startDate: t.validity, endDate: t.validity, title: `⏳ 유효 · ${t.docNo || '견적'} ${t.client || ''}`.trim(), color: 'bg-violet-50 border-violet-400 text-violet-700' });
            });
            (STATE.assets || []).forEach(a => {
                const info = assetPmInfo(a);
                if (info.state === 'none' || !info.next) return;
                out.push({ _ref: { type: 'asset', id: a.id }, deptId: a.deptId || '', startDate: info.next, endDate: info.next, title: `🔧 점검 · ${a.name || ''}`.trim(), color: 'bg-emerald-50 border-emerald-400 text-emerald-700' });
            });
            return out;
        }
        function toggleCalOps() {
            STATE.calShowOps = STATE.calShowOps === false ? true : false;
            const b = document.getElementById('cal-ops-toggle'); if (b) b.classList.toggle('opacity-40', STATE.calShowOps === false);
            renderCalendar();
        }
        function renderCalendar() {
            const grid = document.getElementById('calendar-grid'); if (!grid) return; grid.innerHTML = '';
            const y = STATE.currentYear, m = STATE.currentMonth;
            const firstOfMonth = new Date(y, m - 1, 1);
            const firstIdx = firstOfMonth.getDay();
            const gridStartDate = new Date(y, m - 1, 1 - firstIdx);
            const opsAll = (STATE.calShowOps !== false) ? derivedCalendarItems().filter(d => STATE.visibility[d.deptId] !== false) : [];
            for (let w = 0; w < 6; w++) {
                const weekStartDate = addDays(gridStartDate, w * 7);
                const dayDates = []; for (let i = 0; i < 7; i++) dayDates.push(formatDate(addDays(weekStartDate, i)));
                const weekEvents = STATE.events.filter(e => STATE.visibility[e.deptId] && e.startDate <= dayDates[6] && e.endDate >= dayDates[0]).concat(opsAll.filter(d => d.startDate <= dayDates[6] && d.endDate >= dayDates[0]));
                weekEvents.sort((a, b) => { if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate); return (new Date(b.endDate) - new Date(b.startDate)) - (new Date(a.endDate) - new Date(a.startDate)); });
                const tracks = []; const placements = [];
                weekEvents.forEach(evt => {
                    let s = dayDates.indexOf(evt.startDate); if (s === -1) s = 0;
                    let e = dayDates.indexOf(evt.endDate); if (e === -1) e = 6;
                    let t = 0;
                    while (true) {
                        if (!tracks[t]) tracks[t] = Array(7).fill(null);
                        let overlap = false; for (let c = s; c <= e; c++) { if (tracks[t][c] !== null) { overlap = true; break; } }
                        if (!overlap) { for (let c = s; c <= e; c++) tracks[t][c] = evt; break; } t++;
                    }
                    placements.push({ evt, s, e, t });
                });
                const weekDiv = document.createElement('div');
                weekDiv.className = "relative flex-1 bg-white grid grid-cols-7 min-h-[120px] divide-x divide-slate-100/40";
                weekDiv.style.gridAutoRows = "26px";
                for (let c = 0; c < 7; c++) {
                    const bg = document.createElement('div'); bg.className = `bg-white border-r border-slate-100/60 h-full ${c === 6 ? 'border-r-0' : ''}`;
                    bg.style.gridColumn = `${c + 1}`; bg.style.gridRow = "1 / 30"; weekDiv.appendChild(bg);
                }
                dayDates.forEach((dStr, cIdx) => {
                    const dObj = new Date(dStr); const dayNum = dObj.getDate(); const isCurr = dObj.getMonth() + 1 === m;
                    const isTodayCell = isToday(dObj.getFullYear(), dObj.getMonth() + 1, dayNum);
                    const todayClass = isTodayCell ? 'bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-bold' : '';
                    const textClass = isCurr ? 'text-slate-700' : 'text-slate-200';
                    const hDiv = document.createElement('div'); hDiv.className = `flex justify-between items-center px-2 py-1 select-none z-10 ${textClass}`;
                    hDiv.style.gridColumn = `${cIdx + 1}`; hDiv.style.gridRow = "1";
                    hDiv.innerHTML = `<span class="${todayClass} text-[12px] font-semibold">${dayNum}</span><button onclick="quickAddEvent('${dStr}')" class="text-[11px] text-slate-300 hover:text-slate-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">등록</button>`;
                    weekDiv.appendChild(hDiv);
                });
                placements.forEach(({ evt, s, e, t }) => {
                    if (evt._ref) {
                        const dEl = document.createElement('div');
                        dEl.className = `dept-tag ${evt.color} cursor-pointer text-left text-[13px] px-2 py-0.5 rounded border-l-[3px] truncate block z-20 font-medium`;
                        dEl.style.gridColumn = `${s + 1} / ${e + 2}`; dEl.style.gridRow = `${t + 2}`; dEl.style.margin = "2px 4px";
                        dEl.innerHTML = esc(evt.title); dEl.title = evt.title;
                        dEl.onclick = (el) => { el.stopPropagation(); if (evt._ref.type === 'trade') openTradeDetail(evt._ref.id); else openAssetDetail(evt._ref.id); };
                        weekDiv.appendChild(dEl); return;
                    }
                    const dept = STATE.departments.find(d => d.id === evt.deptId);
                    const evEl = document.createElement('div');
                    const isCompleted = evt.endDate < formatDate(new Date());
                    const compClass = isCompleted ? 'line-through opacity-40' : '';
                    evEl.className = `dept-tag ${dept ? dept.color : 'bg-slate-100 border-slate-300'} cursor-pointer text-left text-[13px] px-2 py-0.5 rounded border-l-[3px] truncate block z-20 font-medium ${compClass}`;
                    evEl.style.gridColumn = `${s + 1} / ${e + 2}`; evEl.style.gridRow = `${t + 2}`; evEl.style.margin = "2px 4px";
                    evEl.innerHTML = `<span>${isCompleted ? '✓ ' : ''}[${dept ? dept.name : '공통'}]</span>${evt.site ? ` [${evt.site}]` : ''} ${evt.title}`;
                    evEl.onclick = (el) => { el.stopPropagation(); editEvent(evt.id); };
                    evEl.onmouseenter = (ev) => showEventTooltip(ev, evt);
                    evEl.onmousemove = (ev) => moveEventTooltip(ev);
                    evEl.onmouseleave = hideEventTooltip;
                    weekDiv.appendChild(evEl);
                });
                grid.appendChild(weekDiv);
            }
        }

        // ── 캘린더 일정 호버 툴팁 ────────────────────────────────────────
        function getCalTooltip() { let t = document.getElementById('cal-tooltip'); if (!t) { t = document.createElement('div'); t.id = 'cal-tooltip'; document.body.appendChild(t); } return t; }
        function showEventTooltip(ev, evt) {
            const dept = STATE.departments.find(d => d.id === evt.deptId);
            const completed = evt.endDate < formatDate(new Date());
            const t = getCalTooltip();
            t.innerHTML = `<div style="font-weight:700;margin-bottom:4px">${evt.title}</div>`
                + `<div>· 사업부: ${dept ? dept.name : '공통'}</div>`
                + (evt.site ? `<div>· 현장명: ${evt.site}</div>` : '')
                + `<div>· 기간: ${evt.startDate} ~ ${evt.endDate}</div>`
                + `<div>· 상태: ${completed ? '완료' : '진행/예정'}</div>`;
            t.style.opacity = '1';
            moveEventTooltip(ev);
        }
        function moveEventTooltip(ev) {
            const t = document.getElementById('cal-tooltip'); if (!t) return;
            let x = ev.clientX + 14, y = ev.clientY + 14;
            const w = t.offsetWidth || 240, h = t.offsetHeight || 80;
            if (x + w > window.innerWidth - 10) x = ev.clientX - w - 14;
            if (y + h > window.innerHeight - 10) y = ev.clientY - h - 14;
            t.style.left = x + 'px'; t.style.top = y + 'px';
        }
        function hideEventTooltip() { const t = document.getElementById('cal-tooltip'); if (t) t.style.opacity = '0'; }
        function showGanttTooltip(ev, projId) {
            const proj = STATE.projects.find(p => p.id === projId); if (!proj) return;
            const dept = STATE.departments.find(d => d.id === proj.deptId);
            const DAY = 86400000;
            let days = '-';
            if (proj.startDate && proj.endDate) { const [ys, ms, ds] = proj.startDate.split('-').map(Number); const [ye, me, de] = proj.endDate.split('-').map(Number); days = Math.round((new Date(ye, me - 1, de) - new Date(ys, ms - 1, ds)) / DAY) + 1; }
            const statusKo = { paused: '대기', ongoing: '진행', completed: '완료' }[proj.status] || proj.status;
            const t = getCalTooltip();
            t.innerHTML = `<div style="font-weight:700;margin-bottom:4px">${esc(proj.title)}</div>`
                + `<div>· 사업부: ${dept ? dept.name : '전사'}</div>`
                + `<div>· 기간: ${proj.startDate || '-'} ~ ${proj.endDate || '-'} (${days}일)</div>`
                + `<div>· 진행도: ${proj.progress}% · 상태: ${statusKo}</div>`;
            t.style.opacity = '1'; moveEventTooltip(ev);
        }

        // ── 현장명(사이트) 옵션 ──────────────────────────────────────────
        function renderSiteOptions(selected) {
            const sel = document.getElementById('event-site'); if (!sel) return;
            const opts = ['<option value="">(현장명 미지정)</option>'].concat((STATE.sites || []).map(s => `<option value="${s.name}">${s.name}</option>`));
            sel.innerHTML = opts.join('');
            sel.value = selected || '';
        }
        async function addSite() {
            const inp = document.getElementById('event-site-new'); if (!inp) return;
            const name = inp.value.trim();
            if (!name) { showToast('입력 필요', '추가할 현장명을 입력하세요.'); return; }
            if ((STATE.sites || []).some(s => s.name === name)) { renderSiteOptions(name); inp.value = ''; showToast('이미 존재', '이미 등록된 현장명입니다.'); return; }
            const { error } = await sb.from('sites').insert({ name });
            if (error) {
                if ((error.code === '23505') || /duplicate|unique/i.test(error.message || '')) { await reloadSites(); renderSiteOptions(name); inp.value = ''; showToast('이미 존재', '이미 등록된 현장명입니다.'); return; }
                showToast('추가 실패', error.message); return;
            }
            await reloadSites(); renderSiteOptions(name); inp.value = '';
            showToast('현장명 추가', `[${name}] 현장이 목록에 저장되었습니다.`);
        }
        function quickAddEvent(dateStr) {
            const d = dateStr || formatDate(new Date());
            const idEl = document.getElementById('event-id'); if (idEl) idEl.value = '';
            const titleEl = document.getElementById('event-title'); if (titleEl) titleEl.value = '';
            const deptEl = document.getElementById('event-dept'); if (deptEl) deptEl.selectedIndex = 0;
            const startEl = document.getElementById('event-start'); if (startEl) startEl.value = d;
            const endEl = document.getElementById('event-end'); if (endEl) endEl.value = d;
            const t = document.getElementById('event-modal-title'); if (t) t.innerText = '새 일정 등록';
            const del = document.getElementById('event-delete-btn'); if (del) del.classList.add('hidden');
            renderSiteOptions('');
            const sn = document.getElementById('event-site-new'); if (sn) sn.value = '';
            applyDeptLock('event-dept');
            openModal('add-event-modal');
        }
        function editEvent(id) {
            const evt = STATE.events.find(e => e.id === id); if (!evt) return;
            if (STATE.profile.role !== 'admin' && evt.deptId !== STATE.profile.deptId) {
                showToast('수정 권한 없음', '본인 소속 부서의 일정만 수정할 수 있습니다.'); return;
            }
            document.getElementById('event-id').value = evt.id;
            document.getElementById('event-title').value = evt.title;
            document.getElementById('event-dept').value = evt.deptId;
            document.getElementById('event-start').value = evt.startDate;
            document.getElementById('event-end').value = evt.endDate;
            renderSiteOptions(evt.site || '');
            const sn = document.getElementById('event-site-new'); if (sn) sn.value = '';
            const t = document.getElementById('event-modal-title'); if (t) t.innerText = '일정 수정';
            const del = document.getElementById('event-delete-btn'); if (del) del.classList.remove('hidden');
            applyDeptLock('event-dept');
            openModal('add-event-modal');
        }
        async function handleSaveEvent(e) {
            e.preventDefault();
            const id = document.getElementById('event-id').value;
            const title = document.getElementById('event-title').value.trim();
            const deptId = document.getElementById('event-dept').value;
            const startDate = document.getElementById('event-start').value;
            const endDate = document.getElementById('event-end').value;
            const site = (document.getElementById('event-site') ? document.getElementById('event-site').value : '') || null;
            if (!title || !startDate || !endDate) { showToast('입력 오류', '제목과 기간을 모두 입력하십시오.'); return; }
            if (endDate < startDate) { showToast('기간 오류', '종료일은 시작일 이후여야 합니다.'); return; }
            if (STATE.profile.role !== 'admin' && deptId !== STATE.profile.deptId) { showToast('작성 권한 없음', '본인 소속 부서의 일정만 작성할 수 있습니다.'); return; }
            let error;
            if (id) { ({ error } = await sb.from('events').update({ title, dept_id: deptId, start_date: startDate, end_date: endDate, site }).eq('id', parseInt(id))); }
            else { ({ error } = await sb.from('events').insert({ title, dept_id: deptId, start_date: startDate, end_date: endDate, site })); }
            if (error) { showToast('저장 실패', error.message); return; }
            STATE.visibility[deptId] = true;
            await reloadEvents(); renderFilters(); renderCalendar(); renderDashboardWidgets(); closeModal('add-event-modal');
            showToast(id ? '일정 수정' : '일정 등록', id ? '일정 정보가 갱신되었습니다.' : '새 일정이 캘린더에 반영되었습니다.');
        }
        async function deleteEventFromModal() {
            const id = parseInt(document.getElementById('event-id').value); if (!id) return;
            const { error } = await sb.from('events').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadEvents(); renderCalendar(); renderDashboardWidgets(); closeModal('add-event-modal'); showToast('일정 삭제', '선택한 일정이 제거되었습니다.');
        }

        // ── 공지 ─────────────────────────────────────────────────────────
        function renderDashboardNotice() {
            const container = document.getElementById('dashboard-notice-card'); if (!container) return;
            const canEdit = STATE.profile.role === 'admin';
            const n = STATE.dashboardNotice || { title: '', date: '', content: '' };
            container.innerHTML = `<div class="flex items-center justify-between"><h3 class="font-bold text-sm text-slate-800 flex items-center gap-2"><i data-lucide="info" class="w-4 h-4 text-blue-500"></i> ${n.title || ''}</h3><div class="flex items-center gap-3"><span class="text-[12px] bg-slate-100 px-2 py-0.5 rounded-md font-mono">${n.date || ''}</span>${canEdit ? `<button onclick="openEditNoticeModal()" class="text-[12px] text-blue-600 font-bold hover:underline">수정</button>` : ''}</div></div><p class="text-xs text-slate-500 leading-relaxed">${n.content || ''}</p>`;
            lucide.createIcons();
        }
        function openEditNoticeModal() {
            const n = STATE.dashboardNotice || {};
            document.getElementById('notice-title').value = n.title || '';
            document.getElementById('notice-date').value = n.date || '';
            document.getElementById('notice-content').value = n.content || '';
            openModal('edit-notice-modal');
        }
        async function handleSaveNotice(e) {
            e.preventDefault();
            const v = { title: document.getElementById('notice-title').value.trim(), date: document.getElementById('notice-date').value.trim(), content: document.getElementById('notice-content').value.trim() };
            const { error } = await sb.from('app_settings').upsert({ key: 'dashboard_notice', value: v, updated_at: new Date().toISOString() });
            if (error) { showToast('저장 실패', '공지는 관리자만 수정할 수 있습니다.'); return; }
            STATE.dashboardNotice = v; renderDashboardNotice(); closeModal('edit-notice-modal'); showToast('공지 갱신', '대시보드 공지가 업데이트되었습니다.');
        }

        // ── 문서 허브 ────────────────────────────────────────────────────
        // ── 상태 색상 통일(디자인 토큰) ─────────────────────────────────
        const CHIP_TONES = {
            neutral: 'bg-slate-100 text-slate-600 border-slate-200',
            info: 'bg-blue-50 text-blue-700 border-blue-200',
            warn: 'bg-amber-50 text-amber-700 border-amber-200',
            success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            danger: 'bg-rose-50 text-rose-700 border-rose-200',
            critical: 'bg-rose-600 text-white border-rose-600'
        };
        function chip(label, tone) { return `<span class="wsp-chip ${CHIP_TONES[tone] || CHIP_TONES.neutral}">${label}</span>`; }
        const DOC_STATUS = { draft: ['임시저장', 'neutral'], pending: ['결재대기', 'warn'], approved: ['승인완료', 'success'], rejected: ['반려', 'danger'] };
        function docStatusBadge(status) { const s = DOC_STATUS[status] || DOC_STATUS.approved; return chip(s[0], s[1]); }
        function canApproveDoc(doc) {
            const line = doc.approvers || [];
            if (line.length > 0) {
                const cur = currentApproverOf(doc);
                if (cur && STATE.currentUser && cur.id === STATE.currentUser.id) return true;
                return STATE.profile.role === 'admin';
            }
            if (STATE.profile.role === 'admin') return true;
            return doc.deptId === STATE.profile.deptId && ['head', 'leader', 'ceo'].includes(STATE.profile.role);
        }
        function canManageDoc(doc) { return STATE.profile.role === 'admin' || (doc && doc.deptId === STATE.profile.deptId); }
        function isDocAuthor(doc) { return (doc.author || '').trim() === (STATE.profile.name || '').trim(); }
        function renderDocuments(items = STATE.documents) {
            const tbody = document.getElementById('document-list-body'); if (!tbody) return; tbody.innerHTML = '';
            if (items.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 text-xs">보관고에 등록된 사내 보고서가 없습니다.</td></tr>`; return; }
            const shown = items.slice(0, pageCount('documents'));
            shown.forEach(doc => {
                const dept = STATE.departments.find(d => d.id === doc.deptId);
                const hasFile = !!doc.storagePath;
                const sizeTxt = doc.fileSize ? ` · ${doc.fileSize}` : '';
                const fileBadge = hasFile ? `<i data-lucide="paperclip" class="w-3 h-3 inline-block text-blue-500"></i> ` : '';
                const tr = document.createElement('tr'); tr.className = "hover:bg-blue-50/40 transition-all text-xs cursor-pointer";
                tr.onclick = () => viewDocument(doc.id);
                let actions = `<button onclick="viewDocument(${doc.id})" class="text-blue-600 hover:text-blue-800 font-bold mr-3">열람</button>`;
                if ((doc.status === 'draft' || doc.status === 'rejected') && (isDocAuthor(doc) || STATE.profile.role === 'admin')) actions += `<button onclick="submitDocForApproval(${doc.id})" class="text-amber-600 hover:text-amber-800 font-bold mr-3">결재요청</button>`;
                if (doc.status === 'pending' && canApproveDoc(doc)) actions += `<button onclick="approveDoc(${doc.id})" class="text-emerald-600 hover:text-emerald-800 font-bold mr-3">승인</button><button onclick="rejectDoc(${doc.id})" class="text-rose-500 hover:text-rose-700 font-bold mr-3">반려</button>`;
                if (canManageDoc(doc)) actions += `<button onclick="openEditDocument(${doc.id})" class="text-slate-500 hover:text-slate-800 font-bold mr-3">수정</button><button onclick="deleteDocument(${doc.id})" class="text-rose-500 hover:text-rose-700 font-bold">삭제</button>`;
                const rejectNote = doc.status === 'rejected' && doc.rejectReason ? `<div class="text-[11px] text-rose-500 mt-0.5">반려 사유: ${esc(doc.rejectReason)}</div>` : '';
                tr.innerHTML = `<td class="p-3 font-semibold text-slate-800">${fileBadge}${esc(doc.title)}<span class="text-[12px] text-slate-400 font-normal">${sizeTxt}</span>${rejectNote}</td><td class="p-3">${docStatusBadge(doc.status)}</td><td class="p-3"><span class="px-2 py-0.5 border rounded text-[12px] font-bold ${dept ? dept.textTheme : 'bg-slate-100'}">${dept ? dept.name : '공통'}</span></td><td class="p-3 font-medium text-slate-500">${esc(doc.author) || '-'}</td><td class="p-3 text-slate-400 font-mono">${doc.date || ''}</td><td class="p-3 text-right whitespace-nowrap" onclick="event.stopPropagation()">${actions}</td>`;
                tbody.appendChild(tr);
            });
            tbody.insertAdjacentHTML('beforeend', moreRowHTML(items.length, 'documents', 6));
            if (window.lucide) lucide.createIcons();
        }
        async function submitDocForApproval(id) {
            const doc = STATE.documents.find(d => d.id === id); if (!doc) return;
            if (!(isDocAuthor(doc) || STATE.profile.role === 'admin')) { showToast('권한 없음', '작성자 또는 관리자만 결재 요청할 수 있습니다.'); return; }
            const line = (doc.approvers || []).map(a => Object.assign({}, a, { status: 'pending', at: null }));
            const { error } = await sb.from('documents').update({ status: 'pending', reject_reason: null, approvers: line }).eq('id', id);
            if (error) { showToast('요청 실패', error.message); return; }
            logAudit('doc_submit', doc.title, '');
            await reloadDocuments(); refreshDocViews(); renderDashboardWidgets(); showToast('결재 요청', '문서가 결재대기 상태로 상신되었습니다.');
        }
        async function approveDoc(id) {
            const doc = STATE.documents.find(d => d.id === id); if (!doc) return;
            if (!canApproveDoc(doc)) { showToast('권한 없음', '결재 권한이 없습니다. (현재 차례 결재자만 승인 가능)'); return; }
            const line = (doc.approvers || []).map(a => Object.assign({}, a));
            let patch;
            if (line.length > 0) {
                const cur = line.find(a => a.status === 'pending');
                if (cur) { cur.status = 'approved'; cur.at = new Date().toISOString(); cur.by = STATE.profile.name; }
                const remaining = line.some(a => a.status === 'pending');
                patch = remaining ? { approvers: line } : { approvers: line, status: 'approved', approver: STATE.profile.name, approved_at: new Date().toISOString(), reject_reason: null };
                var msg = remaining ? `${(line.filter(a=>a.status==='approved').length)}차 승인 완료. 다음 결재자 차례입니다.` : '최종 승인되어 보관소로 이동했습니다.';
            } else {
                patch = { status: 'approved', approver: STATE.profile.name, approved_at: new Date().toISOString(), reject_reason: null };
                var msg = `[${doc.title}] 문서를 승인했습니다.`;
            }
            const { error } = await sb.from('documents').update(patch).eq('id', id);
            if (error) { showToast('승인 실패', error.message); return; }
            logAudit('doc_approve', doc.title, msg);
            await reloadDocuments(); refreshDocViews(); renderDashboardWidgets(); showToast('승인', msg);
        }
        async function rejectDoc(id) {
            const doc = STATE.documents.find(d => d.id === id); if (!doc) return;
            if (!canApproveDoc(doc)) { showToast('권한 없음', '결재 권한이 없습니다.'); return; }
            const reason = prompt('반려 사유를 입력하세요.', ''); if (reason === null) return;
            const line = (doc.approvers || []).map(a => Object.assign({}, a));
            const cur = line.find(a => a.status === 'pending'); if (cur) { cur.status = 'rejected'; cur.at = new Date().toISOString(); cur.by = STATE.profile.name; }
            const { error } = await sb.from('documents').update({ status: 'rejected', approver: STATE.profile.name, reject_reason: reason.trim(), approvers: line }).eq('id', id);
            if (error) { showToast('반려 실패', error.message); return; }
            logAudit('doc_reject', doc.title, reason.trim());
            await reloadDocuments(); refreshDocViews(); renderDashboardWidgets(); showToast('반려 처리', `[${doc.title}] 문서를 반려했습니다.`);
        }
        function refreshDocViews() {
            if (STATE.currentTab === 'documents') filterDocs(); else renderDocuments();
            renderPendingDocs(); renderArchiveDocs();
        }
        function renderPendingDocs() {
            const box = document.getElementById('pending-docs-body'); if (!box) return;
            const list = STATE.documents.filter(d => d.status === 'pending' && canApproveDoc(d));
            if (list.length === 0) { box.innerHTML = `<div class="wsp-empty">현재 내가 결재할 문서가 없습니다.</div>`; return; }
            box.innerHTML = list.slice(0, pageCount('pendingDocs')).map(doc => {
                const dept = STATE.departments.find(d => d.id === doc.deptId);
                const canApp = canApproveDoc(doc);
                const act = canApp ? `<button onclick="approveDoc(${doc.id})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">승인</button><button onclick="rejectDoc(${doc.id})" class="px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg">반려</button>` : `<span class="text-[12px] text-slate-400">결재 권한 없음</span>`;
                return `<div class="flex items-center justify-between gap-3 p-4 border-b border-slate-100 hover:bg-slate-50">
                    <div class="min-w-0 cursor-pointer" onclick="viewDocument(${doc.id})"><div class="font-bold text-slate-800 truncate flex items-center gap-2">${doc.storagePath ? '<i data-lucide=\'paperclip\' class=\'w-3.5 h-3.5 text-blue-500\'></i>' : ''}${esc(doc.title)}</div><div class="text-[12px] text-slate-400 mt-0.5"><span class="px-1.5 py-0.5 border rounded ${dept ? dept.textTheme : 'bg-slate-100'} font-bold">${dept ? dept.name : '공통'}</span> ${esc(doc.author) || '-'} · ${doc.date || ''}${(doc.approvers||[]).length ? ` · 결재선: ${approverLineLabel(doc)} <strong class='text-amber-600'>(현재 ${(currentApproverOf(doc)||{}).name || '-'} 차례)</strong>` : ''}</div></div>
                    <div class="flex gap-2 flex-shrink-0">${act}</div>
                </div>`;
            }).join('') + moreDivHTML(list.length, 'pendingDocs');
            if (window.lucide) lucide.createIcons();
        }
        function docTypeCategory(doc) {
            const ext = (doc.fileType || (doc.title && doc.title.indexOf('.') >= 0 ? doc.title.split('.').pop() : '') || '').toLowerCase();
            if (ext === 'pdf') return 'pdf';
            if (['doc', 'docx'].includes(ext)) return 'word';
            if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
            if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
            return 'etc';
        }
        function archiveApplyFilter() { resetPage('archiveDocs'); renderArchiveDocs(); }
        function renderArchiveDocs() {
            const box = document.getElementById('archive-docs-body'); if (!box) return;
            const fd = (document.getElementById('archive-filter-dept') || {}).value || 'all';
            const ft = (document.getElementById('archive-filter-type') || {}).value || 'all';
            const list = STATE.documents.filter(d => d.status === 'approved' && (fd === 'all' || d.deptId === fd) && (ft === 'all' || docTypeCategory(d) === ft));
            if (list.length === 0) { box.innerHTML = `<div class="wsp-empty">조건에 맞는 승인 완료 문서가 없습니다.</div>`; return; }
            box.innerHTML = list.slice(0, pageCount('archiveDocs')).map(doc => {
                const dept = STATE.departments.find(d => d.id === doc.deptId);
                return `<div class="flex items-center justify-between gap-3 p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onclick="viewDocument(${doc.id})">
                    <div class="min-w-0"><div class="font-bold text-slate-800 truncate flex items-center gap-2">${doc.storagePath ? '<i data-lucide=\'paperclip\' class=\'w-3.5 h-3.5 text-blue-500\'></i>' : ''}${esc(doc.title)}</div><div class="text-[12px] text-slate-400 mt-0.5"><span class="px-1.5 py-0.5 border rounded ${dept ? dept.textTheme : 'bg-slate-100'} font-bold">${dept ? dept.name : '공통'}</span> ${esc(doc.author) || '-'} · 승인 ${doc.approver ? '(' + esc(doc.approver) + ')' : ''}</div></div>
                    <span class="flex-shrink-0">${chip('승인완료','success')}</span>
                </div>`;
            }).join('');
            if (window.lucide) lucide.createIcons();
        }
        function handleDocFileSelection(e) {
            const f = e.target.files[0]; if (!f) return; STATE.uploadedDocFile = f;
            const st = document.getElementById('doc-file-status'); if (st) { st.innerText = `선택됨 : ${f.name} (${humanSize(f.size)})`; st.classList.add('text-indigo-600'); }
            const titleEl = document.getElementById('doc-title'); if (titleEl && !titleEl.value.trim()) titleEl.value = f.name;
        }
        async function handleNewDocument(e) {
            e.preventDefault();
            const typed = document.getElementById('doc-title').value.trim();
            const dept = document.getElementById('doc-dept').value;
            const author = document.getElementById('doc-author').value.trim() || STATE.profile.name;
            const f = STATE.uploadedDocFile;
            let storage_path = null, file_mime = null, file_size = '', file_type = 'memo', title = typed;
            if (f) {
                storage_path = safeStorageKey(f.name, '');
                const { error: upErr } = await sb.storage.from('documents').upload(storage_path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
                if (upErr) { showToast('업로드 실패', upErr.message); return; }
                file_mime = f.type || ''; file_size = humanSize(f.size); file_type = (f.name.split('.').pop() || 'file').toLowerCase();
                if (!title) title = f.name;
            }
            if (!title) { showToast('입력 필요', '보고서 제목을 입력하거나 파일을 첨부하세요.'); return; }
            let status = (document.getElementById('doc-status-mode') || {}).value || 'pending';
            const canSelfApprove = STATE.profile.role === 'admin' || ['head', 'leader', 'ceo'].includes(STATE.profile.role);
            if (status === 'approved' && !canSelfApprove) status = 'pending';
            const insertRow = { title, dept_id: dept, author, doc_date: formatDate(new Date()), file_type, file_size, storage_path, file_mime, status, approvers: (STATE.docApprovers || []), viewers: (STATE.docViewers || []) };
            if ((STATE.docApprovers || []).length > 0 && status === 'approved') { insertRow.status = 'pending'; status = 'pending'; }
            if (status === 'approved') { insertRow.approver = STATE.profile.name; insertRow.approved_at = new Date().toISOString(); }
            const { error } = await sb.from('documents').insert(insertRow);
            if (error) { showToast('등록 실패', error.message); return; }
            STATE.uploadedDocFile = null; STATE.docApprovers = []; STATE.docViewers = []; renderDocPeopleChips();
            if (status === 'pending') logAudit('doc_submit', title, '신규 등록 상신');
            await reloadDocuments(); refreshDocViews(); renderDashboardWidgets();
            closeModal('add-doc-modal'); showToast('문서 등록', status === 'pending' ? '결재 요청(결재대기)으로 등록되었습니다.' : (f ? '파일이 안전하게 업로드되었습니다.' : '보고서 기록이 등록되었습니다.'));
            document.getElementById('doc-title').value = '';
            const st = document.getElementById('doc-file-status'); if (st) { st.innerText = '클릭하여 보고서 업로드'; st.classList.remove('text-indigo-600'); }
        }
        function previewLoading(msg) { return `<div class="text-slate-400 text-xs p-10 flex items-center gap-2"><span class="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></span>${msg}</div>`; }
        function previewError(mime, ext) { return `<div class="text-center text-slate-500 text-xs p-10"><div class="text-4xl mb-3">📄</div>이 형식(${mime || ext || '알 수 없음'})은 브라우저에서 바로 미리보기가 어렵습니다.<br>상단의 <span class="font-bold text-blue-600">다운로드</span> 버튼으로 파일을 받아 확인하세요.</div>`; }
        function officeViewer(url) { return `<iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}" class="w-full h-full" frameborder="0"></iframe>`; }
        function showSheet(i) {
            document.querySelectorAll('[id^="sheet-pane-"]').forEach(p => p.classList.add('hidden'));
            document.querySelectorAll('[id^="sheet-tab-"]').forEach(t => { t.className = 'px-3 py-1.5 text-[13px] font-bold rounded-t-lg text-slate-400 hover:text-slate-600'; });
            const pane = document.getElementById('sheet-pane-' + i); if (pane) pane.classList.remove('hidden');
            const tab = document.getElementById('sheet-tab-' + i); if (tab) tab.className = 'px-3 py-1.5 text-[13px] font-bold rounded-t-lg bg-white text-slate-800 border border-b-0';
        }
        // 이미지 라이트박스(창 크기에 맞춰 확대/축소, 클릭 줌)
        function openImageLightbox(title, url) {
            const lb = document.getElementById('image-lightbox'); if (!lb) return;
            const t = document.getElementById('image-lightbox-title'); if (t) t.innerText = title || '';
            const dl = document.getElementById('image-lightbox-download'); if (dl) { dl.href = url; dl.setAttribute('download', title || 'image'); }
            const img = document.getElementById('image-lightbox-img');
            if (img) { img.src = url; img.style.maxWidth = '94vw'; img.style.maxHeight = '88vh'; img.classList.remove('cursor-zoom-out'); img.classList.add('cursor-zoom-in'); img.dataset.zoomed = ''; }
            lb.classList.remove('hidden'); lb.classList.add('flex');
            if (window.lucide) lucide.createIcons();
        }
        function toggleLightboxZoom(e) {
            if (e) e.stopPropagation();
            const img = document.getElementById('image-lightbox-img'); if (!img) return;
            const wrap = document.getElementById('image-lightbox-wrap');
            if (img.dataset.zoomed) {
                img.dataset.zoomed = ''; img.style.maxWidth = '94vw'; img.style.maxHeight = '88vh';
                img.classList.remove('cursor-zoom-out'); img.classList.add('cursor-zoom-in');
                if (wrap) { wrap.classList.add('items-center', 'justify-center'); }
            } else {
                img.dataset.zoomed = '1'; img.style.maxWidth = 'none'; img.style.maxHeight = 'none';
                img.classList.remove('cursor-zoom-in'); img.classList.add('cursor-zoom-out');
                if (wrap) { wrap.classList.remove('items-center', 'justify-center'); }
            }
        }
        function closeImageLightbox(e) {
            if (e && e.target && e.target.id === 'image-lightbox-img') return; // 사진 클릭은 줌(닫지 않음)
            const lb = document.getElementById('image-lightbox'); if (lb) { lb.classList.add('hidden'); lb.classList.remove('flex'); }
            const img = document.getElementById('image-lightbox-img'); if (img) { img.src = ''; img.dataset.zoomed = ''; }
        }
        // ── UX: ESC 닫기 / 연결 상태 표시 / 알림 개별 삭제 ───────────────
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' && e.keyCode !== 27) return;
            const lb = document.getElementById('image-lightbox');
            if (lb && !lb.classList.contains('hidden')) { closeImageLightbox(); return; }
            const overlays = [...document.querySelectorAll('div.fixed.inset-0')].filter(el => el.id && el.id.endsWith('modal') && !el.classList.contains('hidden'));
            if (overlays.length) {
                overlays.sort((a, b) => (parseInt(getComputedStyle(a).zIndex) || 0) - (parseInt(getComputedStyle(b).zIndex) || 0));
                closeModal(overlays[overlays.length - 1].id); return;
            }
            const sb = document.getElementById('app-sidebar'); if (sb && sb.classList.contains('open')) closeSidebar();
        });
        function updateOnlineStatus() {
            const b = document.getElementById('offline-banner'); if (!b) return;
            b.classList.toggle('hidden', navigator.onLine);
        }
        function dismissedNotifKey() { return 'wsp_dismissed_notif_' + (STATE.currentUser ? STATE.currentUser.id : 'anon'); }
        function getDismissedNotif() { try { const r = localStorage.getItem(dismissedNotifKey()); return new Set(r ? JSON.parse(r) : []); } catch (e) { return new Set(); } }
        function dismissNotif(id) {
            try { const s = getDismissedNotif(); s.add(id); localStorage.setItem(dismissedNotifKey(), JSON.stringify([...s])); } catch (e) { }
            renderNotificationCenter();
        }
        function isImageFile(mime, ext) {
            mime = (mime || '').toLowerCase(); ext = (ext || '').toLowerCase();
            return mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
        }
        async function openFilePreview(title, url, mime, ext) {
            mime = (mime || '').toLowerCase(); ext = (ext || '').toLowerCase();
            // 이미지는 전용 라이트박스(창 크기에 맞춰 확대/축소)로
            if (isImageFile(mime, ext)) { openImageLightbox(title, url); return; }
            const body = document.getElementById('doc-preview-body');
            const dl = document.getElementById('doc-preview-download');
            document.getElementById('doc-preview-title').innerText = title;
            dl.href = url; dl.classList.remove('hidden'); dl.setAttribute('download', title);
            openModal('doc-preview-modal');
            const has = (t) => mime.indexOf(t) >= 0;
            if (mime === 'application/pdf' || ext === 'pdf') { body.innerHTML = `<iframe src="${url}" class="w-full h-full" frameborder="0"></iframe>`; return; }
            // Word(docx) → docx-preview(고품질) → mammoth → Office 뷰어 순으로 시도
            if (has('wordprocessingml') || ext === 'docx') {
                body.innerHTML = previewLoading('Word 문서를 원본 형태로 렌더링하는 중입니다...');
                try { await ensureDocx(); } catch (e) { }
                let buf;
                try { buf = await (await fetch(url)).arrayBuffer(); }
                catch (e) { body.innerHTML = officeViewer(url); return; }
                if (window.docx && typeof window.docx.renderAsync === 'function') {
                    try {
                        body.innerHTML = `<div id="docx-render-host" class="w-full h-full overflow-auto bg-slate-200 p-4"></div>`;
                        const host = document.getElementById('docx-render-host');
                        await window.docx.renderAsync(buf, host, null, { className: 'docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true, renderHeaders: true, renderFooters: true });
                        return;
                    } catch (e) { /* fall through */ }
                }
                try { await ensureMammoth(); } catch (e) { }
                if (typeof mammoth !== 'undefined') {
                    try {
                        const res = await mammoth.convertToHtml({ arrayBuffer: buf }, { convertImage: mammoth.images.imgElement(function (image) { return image.read('base64').then(function (b64) { return { src: 'data:' + image.contentType + ';base64,' + b64 }; }); }) });
                        body.innerHTML = `<div class="w-full h-full overflow-auto bg-slate-100 p-6"><div class="mx-auto bg-white shadow rounded-lg p-10 max-w-3xl docx-preview text-sm leading-relaxed text-slate-800">${res.value || '<p class=\'text-slate-400\'>표시할 텍스트 내용이 없습니다.</p>'}</div></div>`;
                        return;
                    } catch (e) { /* fall through */ }
                }
                body.innerHTML = officeViewer(url);
                return;
            }
            // Excel/CSV → SheetJS
            if (has('spreadsheetml') || has('ms-excel') || ['xlsx', 'xls', 'csv'].includes(ext)) {
                try { await ensureXlsx(); } catch (e) { }
                if (typeof XLSX === 'undefined') { body.innerHTML = officeViewer(url); return; }
                body.innerHTML = previewLoading('스프레드시트를 불러오는 중입니다...');
                try {
                    const buf = await (await fetch(url)).arrayBuffer();
                    const wb = XLSX.read(buf, { type: 'array' });
                    const names = wb.SheetNames;
                    const tabs = names.map((n, i) => `<button onclick="showSheet(${i})" id="sheet-tab-${i}" class="px-3 py-1.5 text-[13px] font-bold rounded-t-lg ${i === 0 ? 'bg-white text-slate-800 border border-b-0' : 'text-slate-400 hover:text-slate-600'}">${n}</button>`).join('');
                    const panes = names.map((n, i) => `<div id="sheet-pane-${i}" class="${i === 0 ? '' : 'hidden'} bg-white border rounded-lg p-2 sheet-html w-max min-w-full">${XLSX.utils.sheet_to_html(wb.Sheets[n])}</div>`).join('');
                    body.innerHTML = `<div class="w-full h-full flex flex-col bg-slate-100"><div class="flex gap-1 flex-wrap px-4 pt-3 shrink-0">${tabs}</div><div class="flex-1 overflow-auto px-4 pb-4">${panes}</div></div>`;
                } catch (e) { body.innerHTML = officeViewer(url); }
                return;
            }
            // PowerPoint / 레거시 doc → Office Online 뷰어
            if (['pptx', 'ppt', 'doc'].includes(ext) || has('presentationml') || has('msword')) { body.innerHTML = officeViewer(url); return; }
            // 그 외
            body.innerHTML = previewError(mime, ext);
        }
        async function viewDocument(id) {
            const doc = STATE.documents.find(d => d.id === id); if (!doc) return;
            const body = document.getElementById('doc-preview-body');
            const dl = document.getElementById('doc-preview-download');
            document.getElementById('doc-preview-title').innerText = doc.title;
            if (!doc.storagePath) {
                body.innerHTML = `<div class="text-center text-slate-400 text-xs p-10"><div class="text-4xl mb-3">📝</div>첨부 파일이 없는 기록입니다.<br>작성자: ${doc.author || '-'} · ${doc.date || ''}</div>`;
                dl.classList.add('hidden'); dl.removeAttribute('href'); openModal('doc-preview-modal'); return;
            }
            body.innerHTML = `<div class="text-slate-400 text-xs p-10">파일을 불러오는 중입니다...</div>`;
            openModal('doc-preview-modal');
            const { data, error } = await sb.storage.from('documents').createSignedUrl(doc.storagePath, 3600);
            if (error || !data) { body.innerHTML = `<div class="text-rose-500 text-xs p-10">파일을 불러오지 못했습니다.${error ? ' (' + error.message + ')' : ''}</div>`; dl.classList.add('hidden'); return; }
            const ext = (doc.fileType && doc.fileType !== 'memo') ? doc.fileType : (doc.title.indexOf('.') >= 0 ? doc.title.split('.').pop() : '');
            openFilePreview(doc.title, data.signedUrl, doc.fileMime || '', ext);
        }
        function openEditDocument(id) {
            const doc = STATE.documents.find(d => d.id === id); if (!doc) return;
            if (!canManageDoc(doc)) { showToast('권한 없음', '본인 부서의 보고서만 수정할 수 있습니다.'); return; }
            document.getElementById('edit-doc-id').value = doc.id;
            document.getElementById('edit-doc-title').value = doc.title;
            const ds = document.getElementById('edit-doc-dept'); if (ds) ds.value = doc.deptId;
            document.getElementById('edit-doc-author').value = doc.author || '';
            STATE.editDocFile = null;
            const st = document.getElementById('edit-doc-file-status'); if (st) { st.innerText = doc.storagePath ? '현재 파일 유지 (교체하려면 클릭)' : '파일 첨부 (선택)'; st.classList.remove('text-indigo-600'); }
            openModal('edit-doc-modal');
        }
        function handleEditDocFileSelection(e) {
            const f = e.target.files[0]; if (!f) return; STATE.editDocFile = f;
            const st = document.getElementById('edit-doc-file-status'); if (st) { st.innerText = `교체 파일: ${f.name} (${humanSize(f.size)})`; st.classList.add('text-indigo-600'); }
        }
        async function handleSaveDocumentEdit(e) {
            e.preventDefault();
            const id = parseInt(document.getElementById('edit-doc-id').value);
            const doc = STATE.documents.find(d => d.id === id); if (!doc) return;
            const patch = { title: document.getElementById('edit-doc-title').value.trim(), dept_id: document.getElementById('edit-doc-dept').value, author: document.getElementById('edit-doc-author').value.trim() };
            if (!patch.title) { showToast('입력 필요', '보고서 제목을 입력하세요.'); return; }
            if (STATE.editDocFile) {
                const f = STATE.editDocFile;
                const newPath = safeStorageKey(f.name, '');
                const { error: upErr } = await sb.storage.from('documents').upload(newPath, f, { contentType: f.type || 'application/octet-stream', upsert: false });
                if (upErr) { showToast('교체 실패', upErr.message); return; }
                if (doc.storagePath) { try { await sb.storage.from('documents').remove([doc.storagePath]); } catch (er) {} }
                patch.storage_path = newPath; patch.file_mime = f.type || ''; patch.file_type = (f.name.split('.').pop() || 'file').toLowerCase(); patch.file_size = humanSize(f.size);
            }
            const { error } = await sb.from('documents').update(patch).eq('id', id);
            if (error) { showToast('수정 실패', error.message); return; }
            STATE.editDocFile = null;
            await reloadDocuments(); if (STATE.currentTab === 'documents') filterDocs(); else renderDocuments();
            closeModal('edit-doc-modal'); showToast('문서 수정', '보고서 정보가 수정되었습니다.');
        }
        async function deleteDocument(id) {
            const doc = STATE.documents.find(d => d.id === id);
            if (doc && !canManageDoc(doc)) { showToast('권한 없음', '본인 부서의 보고서만 삭제할 수 있습니다.'); return; }
            if (doc && doc.storagePath) { try { await sb.storage.from('documents').remove([doc.storagePath]); } catch (e) {} }
            const { error } = await sb.from('documents').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadDocuments(); if (STATE.currentTab === 'documents') filterDocs(); else renderDocuments(); logAudit('doc_delete', doc ? doc.title : ('#' + id), '');
            showToast('기안 폐기', '해당 서류가 소거되었습니다.');
        }
        function filterDocs() {
            const q = (document.getElementById('doc-search') ? document.getElementById('doc-search').value : '').toLowerCase().trim();
            const dept = document.getElementById('doc-filter-dept') ? document.getElementById('doc-filter-dept').value : 'all';
            const filtered = STATE.documents.filter(doc => {
                const matchDept = (dept === 'all') || (doc.deptId === dept);
                const matchText = !q || doc.title.toLowerCase().includes(q) || (doc.author || '').toLowerCase().includes(q);
                return matchDept && matchText;
            });
            resetPage('documents');
            STATE._docFiltered = filtered;
            renderDocuments(filtered);
        }

        // ── 프로젝트 진척 ────────────────────────────────────────────────
        function switchProgressSubView(viewId) {
            STATE.currentProgressSubView = viewId;
            document.querySelectorAll('.progress-sub-tab').forEach(btn => btn.className = "progress-sub-tab text-xs font-semibold text-slate-400 pb-0.5");
            const active = document.getElementById(`prog-subtab-${viewId}`); if (active) active.className = "progress-sub-tab text-xs font-bold text-indigo-600 border-b-2 border-indigo-600 pb-0.5";
            document.getElementById('project-subview-board').classList.add('hidden');
            document.getElementById('project-subview-list').classList.add('hidden');
            document.getElementById('project-subview-gantt').classList.add('hidden');
            document.getElementById(`project-subview-${viewId}`).classList.remove('hidden');
            renderProjects();
        }
        function onKanbanDragStart(e, projId) {
            STATE._dragProj = projId;
            try { e.dataTransfer.setData('text/plain', String(projId)); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
        }
        function onKanbanDragOver(e) { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (err) {} e.currentTarget.classList.add('bg-indigo-50'); }
        function onKanbanDragLeave(e) { e.currentTarget.classList.remove('bg-indigo-50'); }
        async function onKanbanDrop(e, status) {
            e.preventDefault(); e.currentTarget.classList.remove('bg-indigo-50');
            let id = STATE._dragProj; try { if (!id) id = parseInt(e.dataTransfer.getData('text/plain')); } catch (err) {}
            id = parseInt(id); STATE._dragProj = null;
            const proj = STATE.projects.find(p => p.id === id); if (!proj) return;
            if (proj.status === status) return;
            if (!canManageProject(proj)) { showToast('권한 없음', '본인 소속 부서의 프로젝트만 이동할 수 있습니다.'); return; }
            const statusKo = { paused: '대기 및 검토', ongoing: '진행 중', completed: '완료됨' }[status];
            const { error } = await sb.from('projects').update({ status }).eq('id', id);
            if (error) { showToast('이동 실패', error.message); return; }
            proj.status = status;
            await reloadProjects(); renderProjects(); renderDashboardWidgets();
            showToast('상태 변경', `[${proj.title}] → ${statusKo} 단계로 이동했습니다.`);
        }
        function projectsForView() {
            const fd = document.getElementById('project-filter-dept') ? document.getElementById('project-filter-dept').value : 'all';
            return STATE.projects
                .filter(p => fd === 'all' || p.deptId === fd)
                .slice()
                .sort((a, b) => {
                    const sa = a.startDate || '9999-99-99', sb = b.startDate || '9999-99-99';
                    if (sa !== sb) return sa < sb ? -1 : 1;
                    const ea = a.endDate || '9999-99-99', eb = b.endDate || '9999-99-99';
                    return ea < eb ? -1 : (ea > eb ? 1 : 0);
                });
        }
        function renderProjects() {
            const v = STATE.currentProgressSubView;
            const deptBar = { ceo: 'border-slate-400', south_cs: 'border-blue-400', strategy: 'border-purple-400', hydrogen: 'border-emerald-400', rnd: 'border-amber-400', central_cs: 'border-cyan-400', sales: 'border-rose-400' };
            const statusFill = { paused: 'bg-slate-400', ongoing: 'bg-blue-500', completed: 'bg-emerald-500' };
            const statusText = { paused: 'text-slate-500', ongoing: 'text-blue-600', completed: 'text-emerald-600' };
            const projList = projectsForView();
            if (v === 'board') {
                const p = document.getElementById('board-paused-list'), o = document.getElementById('board-ongoing-list'), c = document.getElementById('board-completed-list');
                if (!p || !o || !c) return; p.innerHTML = ''; o.innerHTML = ''; c.innerHTML = '';
                let pc = 0, oc = 0, cc = 0;
                projList.forEach(proj => {
                    const dept = STATE.departments.find(d => d.id === proj.deptId);
                    const bar = statusFill[proj.status] || 'bg-slate-400';
                    const txt = statusText[proj.status] || 'text-slate-500';
                    const lb = deptBar[proj.deptId] || 'border-slate-300';
                    const manage = canManageProject(proj);
                    const div = document.createElement('div');
                    div.className = `bg-white p-4 rounded-xl border border-slate-200/80 border-l-4 ${lb} shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all space-y-3 cursor-pointer`;
                    if (manage) { div.setAttribute('draggable', 'true'); div.dataset.projId = proj.id; div.addEventListener('dragstart', (e) => onKanbanDragStart(e, proj.id)); }
                    const ctrlRow = manage ? `
                        <div class="flex items-center justify-end gap-2.5 pt-2.5 border-t border-slate-100">
                            <button onclick="event.stopPropagation(); openEditProject(${proj.id})" class="text-[12px] text-slate-500 hover:text-indigo-600 font-bold">편집</button>
                            <button onclick="event.stopPropagation(); deleteProject(${proj.id})" class="text-[12px] text-rose-400 hover:text-rose-600 font-bold">삭제</button>
                        </div>`
                        : `<div class="pt-2.5 border-t border-slate-100 text-[11px] text-slate-300 text-center">타 부서 과제 · 열람 전용</div>`;
                    div.innerHTML = `
                        <h4 class="font-bold text-[13px] text-slate-800 leading-snug">${proj.title}</h4>
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="px-2 py-0.5 border rounded-md text-[11px] font-bold ${dept ? dept.textTheme : 'bg-slate-100'}">${dept ? dept.name : '전사'}</span>
                            <span class="text-[11px] text-slate-400 font-mono">${proj.startDate || '-'} ~ ${proj.endDate || '-'}</span>
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1"><span class="text-[12px] text-slate-400 font-medium">진행도</span><span class="text-[12px] font-bold ${txt}">${proj.progress}%</span></div>
                            <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${bar} rounded-full transition-all duration-500" style="width:${proj.progress}%"></div></div>
                        </div>
                        ${ctrlRow}`;
                    div.addEventListener('click', () => openProjectDetail(proj.id));
                    if (proj.status === 'paused') { p.appendChild(div); pc++; }
                    else if (proj.status === 'ongoing') { o.appendChild(div); oc++; }
                    else if (proj.status === 'completed') { c.appendChild(div); cc++; }
                });
                if (pc === 0) p.innerHTML = `<div class="text-center text-[12px] text-slate-300 py-8">항목 없음</div>`;
                if (oc === 0) o.innerHTML = `<div class="text-center text-[12px] text-slate-300 py-8">항목 없음</div>`;
                if (cc === 0) c.innerHTML = `<div class="text-center text-[12px] text-slate-300 py-8">항목 없음</div>`;
                document.getElementById('board-count-paused').innerText = pc;
                document.getElementById('board-count-ongoing').innerText = oc;
                document.getElementById('board-count-completed').innerText = cc;
                if (window.lucide) lucide.createIcons();
            } else if (v === 'list') {
                const tbody = document.getElementById('project-list-table-body'); if (!tbody) return; tbody.innerHTML = '';
                projList.forEach(proj => {
                    const dept = STATE.departments.find(d => d.id === proj.deptId);
                    const bar = statusFill[proj.status] || 'bg-slate-400';
                    const manage = canManageProject(proj);
                    const delCell = manage ? `<button onclick="event.stopPropagation(); deleteProject(${proj.id})" class="text-rose-400 hover:text-rose-600 font-bold">삭제</button>` : `<span class="text-slate-300 text-[12px]">열람 전용</span>`;
                    const pctCell = `<span class="text-slate-500 font-mono font-bold">${proj.progress}%</span>`;
                    const tr = document.createElement('tr'); tr.className = "hover:bg-slate-50 transition-colors text-xs cursor-pointer";
                    tr.innerHTML = `<td class="p-3 font-bold text-slate-700">${esc(proj.title)}</td><td class="p-3 font-semibold">${dept ? dept.name : '전사'}</td><td class="p-3 text-slate-400 font-mono">${proj.startDate || '-'} ~ ${proj.endDate || '-'}</td><td class="p-3"><div class="flex items-center gap-2"><div class="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${bar} rounded-full" style="width:${proj.progress}%"></div></div>${pctCell}</div></td><td class="p-3 text-right">${delCell}</td>`;
                    tr.addEventListener('click', () => openProjectDetail(proj.id));
                    tbody.appendChild(tr);
                });
            } else if (v === 'gantt') {
                renderGantt(statusFill);
            }
        }
        // 실제 달력 기준 간트 (1개월 / 1년 스케일 + 오늘 표시선)
        function setGanttScale(scale) { STATE.ganttScale = scale; STATE.ganttAnchor = new Date(); renderProjects(); }
        function prevGantt() {
            const a = STATE.ganttAnchor ? new Date(STATE.ganttAnchor) : new Date();
            if (STATE.ganttScale === 'year') a.setFullYear(a.getFullYear() - 1); else a.setMonth(a.getMonth() - 1);
            STATE.ganttAnchor = a; renderProjects();
        }
        function nextGantt() {
            const a = STATE.ganttAnchor ? new Date(STATE.ganttAnchor) : new Date();
            if (STATE.ganttScale === 'year') a.setFullYear(a.getFullYear() + 1); else a.setMonth(a.getMonth() + 1);
            STATE.ganttAnchor = a; renderProjects();
        }
        function todayGantt() { STATE.ganttAnchor = new Date(); renderProjects(); }
        function renderGantt(statusFill) {
            const header = document.getElementById('gantt-header-days');
            const container = document.getElementById('gantt-rows-container');
            if (!container) return; container.innerHTML = '';
            const scale = STATE.ganttScale || 'year';
            const anchor = STATE.ganttAnchor ? new Date(STATE.ganttAnchor) : new Date();
            document.getElementById('gantt-scale-month').className = `px-3 py-1 text-[13px] font-bold rounded-md transition-all ${scale === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`;
            document.getElementById('gantt-scale-year').className = `px-3 py-1 text-[13px] font-bold rounded-md transition-all ${scale === 'year' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`;
            const DAY = 86400000;
            const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
            let winStart, winEnd, segments = [], rangeLabel = '';
            if (scale === 'month') {
                winStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
                winEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
                rangeLabel = `${winStart.getFullYear()}년 ${winStart.getMonth() + 1}월`;
                const totalDays = Math.round((winEnd - winStart) / DAY) + 1;
                for (let d = 1; d <= totalDays; d++) { if (d === 1 || d % 5 === 0 || d === totalDays) segments.push({ label: `${d}`, leftPct: ((d - 1) / totalDays) * 100, width: (1 / totalDays) * 100 }); }
            } else {
                winStart = new Date(anchor.getFullYear(), 0, 1);
                winEnd = new Date(anchor.getFullYear(), 11, 31);
                rangeLabel = `${winStart.getFullYear()}년`;
                const totalDays = Math.round((winEnd - winStart) / DAY) + 1;
                for (let m = 0; m < 12; m++) { const mStart = new Date(winStart.getFullYear(), m, 1); segments.push({ label: `${m + 1}월`, leftPct: (Math.round((mStart - winStart) / DAY) / totalDays) * 100 }); }
            }
            const lbl = document.getElementById('gantt-range-label'); if (lbl) lbl.innerText = rangeLabel;
            const span = (winEnd - winStart) + DAY;
            const pct = (date) => ((date - winStart) / span) * 100;
            if (header) {
                header.className = 'col-span-9 relative h-4 text-[11px] font-bold text-slate-500 select-none';
                header.innerHTML = segments.map(s => `<span class="absolute -translate-x-1/2" style="left:${s.leftPct + (scale === 'year' ? (100 / 24) : 0)}%">${s.label}</span>`).join('');
            }
            const gridLines = segments.map(s => `<div class="absolute inset-y-0 border-l border-slate-100" style="left:${s.leftPct}%"></div>`).join('');
            const dated = projectsForView().filter(p => p.startDate && p.endDate);
            const inWindow = dated.filter(p => !(parse(p.endDate) < winStart || parse(p.startDate) > winEnd));
            if (inWindow.length === 0) { container.innerHTML = `<div class="text-center text-slate-300 text-xs py-10">이 기간에 표시할 프로젝트가 없습니다. (스케일/이동 버튼으로 조정)</div>`; }
            inWindow.forEach(proj => {
                const dept = STATE.departments.find(d => d.id === proj.deptId);
                const barBg = statusFill[proj.status] || 'bg-slate-400';
                const s = parse(proj.startDate), e = parse(proj.endDate);
                let left = Math.max(pct(s), 0), right = Math.min(pct(new Date(e.getTime() + DAY)), 100);
                const width = Math.max(right - left, 1.2);
                const durDays = Math.round((e - s) / DAY) + 1;
                const row = document.createElement('div'); row.className = "grid grid-cols-12 items-center gap-2 border-b border-slate-50 py-2 last:border-0";
                row.innerHTML = `<div class="col-span-3"><div class="font-bold text-slate-700 text-[13px] truncate" title="${esc(proj.title)}">${esc(proj.title)}</div><div class="text-[11px] text-slate-400">${dept ? dept.name : '전사'} · ${proj.startDate}~${proj.endDate}</div></div><div class="col-span-9 relative h-7 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">${gridLines}<div onclick="openProjectDetail(${proj.id})" onmouseenter="showGanttTooltip(event, ${proj.id})" onmousemove="moveEventTooltip(event)" onmouseleave="hideEventTooltip()" class="absolute inset-y-0 my-auto h-6 ${barBg} hover:brightness-110 rounded-md flex items-center cursor-pointer transition-all shadow-sm overflow-hidden" style="left:${left}%; width:${width}%;"><div class="absolute inset-y-0 left-0 bg-white/30" style="width:${proj.progress}%"></div><span class="relative px-2 text-[11px] font-bold text-white truncate">${proj.progress}% · ${durDays}일</span></div></div>`;
                container.appendChild(row);
            });
            // 오늘 표시선
            const today = new Date(); const tPct = pct(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
            if (tPct >= 0 && tPct <= 100) {
                const line = document.createElement('div'); line.className = 'gantt-today-line';
                line.style.left = `calc(25% + ${tPct} * 0.75%)`;
                container.appendChild(line);
            }
            if (window.lucide) lucide.createIcons();
        }
        function renderGantt_OLD(statusFill) {
            const header = document.getElementById('gantt-header-days');
            const container = document.getElementById('gantt-rows-container');
            if (!container) return; container.innerHTML = '';
            const dated = STATE.projects.filter(p => p.startDate && p.endDate);
            if (dated.length === 0) { if (header) header.innerHTML = ''; container.innerHTML = `<div class="text-center text-slate-300 text-xs py-10">표시할 일정 정보가 있는 프로젝트가 없습니다.</div>`; return; }
            const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
            const DAY = 86400000;
            let minD = parse(dated[0].startDate), maxD = parse(dated[0].endDate);
            dated.forEach(p => { const s = parse(p.startDate), e = parse(p.endDate); if (s < minD) minD = s; if (e > maxD) maxD = e; });
            // 시작 달 1일 ~ 종료 달 말일로 확장
            const rangeStart = new Date(minD.getFullYear(), minD.getMonth(), 1);
            const rangeEnd = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0);
            const totalDays = Math.round((rangeEnd - rangeStart) / DAY) + 1;
            const pct = (date) => (Math.round((date - rangeStart) / DAY) / totalDays) * 100;
            // 월 구간 헤더
            const months = [];
            let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
            while (cur <= rangeEnd) {
                const mStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
                const mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
                const segStart = mStart < rangeStart ? rangeStart : mStart;
                const segEnd = mEnd > rangeEnd ? rangeEnd : mEnd;
                const days = Math.round((segEnd - segStart) / DAY) + 1;
                months.push({ label: `${cur.getFullYear()}.${String(cur.getMonth() + 1).padStart(2, '0')}`, width: (days / totalDays) * 100, leftPct: pct(mStart) });
                cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
            }
            if (header) {
                header.style.display = 'flex'; header.style.gridTemplateColumns = '';
                header.className = 'col-span-9 flex text-[11px] font-bold text-slate-500 select-none';
                header.innerHTML = months.map((mo, i) => `<div class="text-center border-l ${i === 0 ? 'border-transparent' : 'border-slate-200'} py-0.5" style="width:${mo.width}%">${mo.label}</div>`).join('');
            }
            const monthLines = months.map(mo => mo.leftPct).filter(x => x > 0.5);
            dated.forEach(proj => {
                const dept = STATE.departments.find(d => d.id === proj.deptId);
                const barBg = statusFill[proj.status] || 'bg-slate-400';
                const s = parse(proj.startDate), e = parse(proj.endDate);
                const left = pct(s), right = pct(new Date(e.getTime() + DAY));
                const width = Math.max(right - left, 1.5);
                const durDays = Math.round((e - s) / DAY) + 1;
                const lines = monthLines.map(x => `<div class="absolute inset-y-0 border-l border-slate-100" style="left:${x}%"></div>`).join('');
                const row = document.createElement('div'); row.className = "grid grid-cols-12 items-center gap-2 border-b border-slate-50 py-2 last:border-0";
                row.innerHTML = `<div class="col-span-3"><div class="font-bold text-slate-700 text-[13px] truncate" title="${proj.title}">${proj.title}</div><div class="text-[11px] text-slate-400">${dept ? dept.name : '전사'} · ${proj.startDate}~${proj.endDate}</div></div><div class="col-span-9 relative h-7 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">${lines}<div onclick="openProjectDetail(${proj.id})" title="${proj.startDate} ~ ${proj.endDate} (${proj.progress}%)" class="absolute inset-y-0 my-auto h-6 ${barBg} hover:brightness-110 rounded-md flex items-center cursor-pointer transition-all shadow-sm overflow-hidden" style="left:${left}%; width:${width}%;"><div class="absolute inset-y-0 left-0 bg-white/30" style="width:${proj.progress}%"></div><span class="relative px-2 text-[11px] font-bold text-white truncate">${proj.progress}% · ${durDays}일</span></div></div>`;
                container.appendChild(row);
            });
        }
        function canManageProject(proj) { return STATE.profile.role === 'admin' || (proj && proj.deptId === STATE.profile.deptId); }
        function handleProjectFileSelection(e) {
            const f = e.target.files[0]; if (!f) return; STATE.projectUploadedFile = f;
            const st = document.getElementById('project-file-status'); if (st) { st.innerText = `첨부: ${f.name} (${humanSize(f.size)})`; st.classList.add('text-indigo-600'); }
        }
        function openAddProject() {
            document.getElementById('project-id').value = '';
            document.getElementById('project-title').value = '';
            const ds = document.getElementById('project-dept'); if (ds) ds.selectedIndex = 0;
            document.getElementById('project-status').value = 'paused';
            document.getElementById('project-start').value = '';
            document.getElementById('project-end').value = '';
            document.getElementById('project-desc').value = '';
            STATE.projectUploadedFile = null; STATE.projectKeepFile = null;
            const st = document.getElementById('project-file-status'); if (st) { st.innerText = '클릭하여 파일 첨부'; st.classList.remove('text-indigo-600'); }
            const t = document.getElementById('project-modal-title'); if (t) t.innerText = '신규 프로젝트 등록';
            applyDeptLock('project-dept');
            openModal('add-project-modal');
        }
        function openEditProject(id) {
            const proj = STATE.projects.find(p => p.id === id); if (!proj) return;
            if (!canManageProject(proj)) { showToast('수정 권한 없음', '본인 소속 부서의 프로젝트만 수정할 수 있습니다.'); return; }
            closeModal('project-detail-modal');
            document.getElementById('project-id').value = proj.id;
            document.getElementById('project-title').value = proj.title;
            document.getElementById('project-dept').value = proj.deptId;
            document.getElementById('project-status').value = proj.status;
            document.getElementById('project-start').value = proj.startDate || '';
            document.getElementById('project-end').value = proj.endDate || '';
            document.getElementById('project-desc').value = proj.desc || '';
            STATE.projectUploadedFile = null; STATE.projectKeepFile = { path: proj.filePath, name: proj.fileName, mime: proj.fileMime };
            const st = document.getElementById('project-file-status'); if (st) { st.innerText = proj.filePath ? `현재 파일 유지: ${proj.fileName} (교체하려면 클릭)` : '클릭하여 파일 첨부'; st.classList.remove('text-indigo-600'); }
            const t = document.getElementById('project-modal-title'); if (t) t.innerText = '프로젝트 수정';
            applyDeptLock('project-dept');
            openModal('add-project-modal');
        }
        async function handleNewProject(e) {
            e.preventDefault();
            const id = document.getElementById('project-id').value;
            const title = document.getElementById('project-title').value.trim();
            const dept = document.getElementById('project-dept').value;
            const status = document.getElementById('project-status').value;
            const s = document.getElementById('project-start').value || null;
            const end = document.getElementById('project-end').value || null;
            const desc = document.getElementById('project-desc').value;
            if (STATE.profile.role !== 'admin' && dept !== STATE.profile.deptId) { showToast('작성 권한 없음', '본인 소속 부서의 프로젝트만 등록할 수 있습니다.'); return; }
            const payload = { title, dept_id: dept, status, start_date: s, end_date: end, descr: desc };
            if (!id) payload.progress = 0; // 진행도는 상세 항목 완료율로 자동 계산됩니다
            if (STATE.projectUploadedFile) {
                const f = STATE.projectUploadedFile;
                const path = safeStorageKey(f.name, 'projects/');
                const { error: upErr } = await sb.storage.from('documents').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
                if (upErr) { showToast('첨부 실패', upErr.message); return; }
                if (id && STATE.projectKeepFile && STATE.projectKeepFile.path) { try { await sb.storage.from('documents').remove([STATE.projectKeepFile.path]); } catch (er) {} }
                payload.file_path = path; payload.file_name = f.name; payload.file_mime = f.type || '';
            }
            let error;
            if (id) { ({ error } = await sb.from('projects').update(payload).eq('id', parseInt(id))); }
            else { ({ error } = await sb.from('projects').insert(payload)); }
            if (error) { showToast('저장 실패', error.message); return; }
            STATE.projectUploadedFile = null; STATE.projectKeepFile = null;
            await reloadProjects(); renderProjects(); closeModal('add-project-modal'); showToast(id ? '프로젝트 수정' : '기획 수립', id ? '프로젝트가 수정되었습니다.' : '새 프로젝트가 배포되었습니다.');
        }
        function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
        // ── 목록 페이지네이션 ────────────────────────────────────────────
        const PAGE_SIZE = 25;
        function pageCount(key) { return (STATE.listPage && STATE.listPage[key]) || PAGE_SIZE; }
        function resetPage(key) { STATE.listPage = STATE.listPage || {}; STATE.listPage[key] = PAGE_SIZE; }
        function moreRowHTML(total, key, colspan) {
            const cur = pageCount(key); if (total <= cur) return '';
            return `<tr><td colspan="${colspan}" class="p-3 text-center bg-slate-50/60"><button onclick="showMore('${key}')" class="wsp-more-btn">더 보기 (${total - cur}건 더) ↓</button></td></tr>`;
        }
        function moreDivHTML(total, key) {
            const cur = pageCount(key); if (total <= cur) return '';
            return `<div class="p-3 text-center border-t border-slate-100"><button onclick="showMore('${key}')" class="wsp-more-btn">더 보기 (${total - cur}건 더) ↓</button></div>`;
        }
        function showMore(key) {
            STATE.listPage = STATE.listPage || {}; STATE.listPage[key] = pageCount(key) + PAGE_SIZE;
            if (key === 'documents') renderDocuments(STATE._docFiltered || STATE.documents);
            else if (key === 'tickets') renderTickets();
            else if (key === 'audit') renderAuditLogs();
            else if (key === 'assets') renderAssets();
            else if (key === 'pendingDocs') renderPendingDocs();
            else if (key === 'archiveDocs') renderArchiveDocs();
        }
        function openProjectDetail(id, highlightItemId) {
            const proj = STATE.projects.find(p => p.id === id); if (!proj) return;
            STATE._openDetail = { type: 'project', id };
            const dept = STATE.departments.find(d => d.id === proj.deptId);
            const statusKo = { paused: '대기', ongoing: '진행', completed: '완료' }[proj.status] || proj.status;
            const statusColor = { paused: 'bg-slate-100 text-slate-600', ongoing: 'bg-blue-50 text-blue-600', completed: 'bg-emerald-50 text-emerald-600' }[proj.status] || 'bg-slate-100';
            const barFill = { paused: 'bg-slate-400', ongoing: 'bg-blue-500', completed: 'bg-emerald-500' }[proj.status] || 'bg-slate-400';
            const manage = canManageProject(proj);
            const fileBlock = proj.filePath
                ? `<div class="max-w-[200px]">${attachSlot('project', proj.id)}</div>`
                : `<span class="text-[13px] text-slate-400">첨부 파일 없음</span>`;
            const items = proj.items || [];
            const rows = items.length === 0
                ? `<tr><td colspan="7" class="py-8 text-center text-slate-300 text-xs">등록된 상세 항목이 없습니다. ${manage ? '우측 상단 "+ 항목 추가"로 작성하세요.' : ''}</td></tr>`
                : items.map(it => {
                    const hl = (highlightItemId && it.id === highlightItemId) ? ' bg-amber-50' : '';
                    const ctrl = manage ? `<div class="flex items-center gap-2 justify-end"><button onclick="openProjectItemForm(${proj.id}, '${it.id}')" class="text-indigo-500 hover:text-indigo-700 font-bold">편집</button><button onclick="deleteProjectItem(${proj.id}, '${it.id}')" class="text-rose-400 hover:text-rose-600 font-bold">삭제</button></div>` : '<span class="text-slate-300">-</span>';
                    const chk = `<input type="checkbox" ${it.done ? 'checked' : ''} ${manage ? '' : 'disabled'} onchange="toggleProjectItemDone(${proj.id}, '${it.id}', this.checked)" class="w-4 h-4 accent-emerald-500 cursor-pointer">`;
                    return `<tr id="pitem-row-${esc(it.id)}" class="border-t border-slate-100 align-top${hl}${it.done ? ' opacity-60' : ''}">
                        <td class="p-3 text-center">${chk}</td>
                        <td class="p-3 font-bold text-slate-700 ${it.done ? 'line-through' : ''}">${esc(it.info)}</td>
                        <td class="p-3 text-slate-600 whitespace-nowrap">${esc(it.manager) || '-'}</td>
                        <td class="p-3 text-slate-500 font-mono whitespace-nowrap">${esc(it.start) || '-'}</td>
                        <td class="p-3 text-slate-500 font-mono whitespace-nowrap">${esc(it.end) || '-'}</td>
                        <td class="p-3 text-slate-600 whitespace-pre-line min-w-[220px]">${esc(it.detail) || '-'}</td>
                        <td class="p-3 text-right whitespace-nowrap text-[13px]">${ctrl}</td>
                    </tr>`;
                }).join('');
            const addBtn = manage ? `<button onclick="openProjectItemForm(${proj.id})" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold rounded-lg flex items-center gap-1"><i data-lucide="plus" class="w-3.5 h-3.5"></i> 항목 추가</button>` : '';
            const ctrl = manage
                ? `<div class="flex gap-2"><button onclick="openEditProject(${proj.id})" class="px-4 py-2 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"><i data-lucide="pencil" class="w-3.5 h-3.5"></i> 프로젝트 편집</button><button onclick="deleteProject(${proj.id}); closeModal('project-detail-modal')" class="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg">삭제</button></div>`
                : `<span class="text-[12px] text-slate-300">타 부서 과제 · 열람 전용</span>`;
            document.getElementById('project-detail-body').innerHTML = `
                <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                    <div class="flex items-start justify-between gap-3 flex-wrap">
                        <div class="space-y-2">
                            <h3 class="text-xl font-extrabold text-slate-800 leading-snug">${esc(proj.title)}</h3>
                            <div class="flex items-center gap-2 flex-wrap text-[13px]">
                                <span class="px-2.5 py-1 rounded-full text-[12px] font-bold ${statusColor}">${statusKo}</span>
                                <span class="px-2 py-0.5 border rounded-md text-[12px] font-bold ${dept ? dept.textTheme : 'bg-slate-100'}">${dept ? dept.name : '전사'}</span>
                                <span class="text-slate-400 font-mono">${proj.startDate || '-'} ~ ${proj.endDate || '-'}</span>
                            </div>
                        </div>
                        ${ctrl}
                    </div>
                    <div class="space-y-3">
                        <div><div class="flex justify-between items-center mb-1"><span class="text-[12px] text-slate-400 font-medium">진행도${items.length ? ` <span class='text-slate-300'>(완료 ${items.filter(i => i.done).length}/${items.length} 항목 자동 반영)</span>` : ''}</span><span class="text-[13px] font-bold text-slate-700">${proj.progress}%</span></div><div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${barFill} rounded-full" style="width:${proj.progress}%"></div></div></div>
                        <div><div class="text-[12px] text-slate-400 font-medium mb-1.5">첨부 파일</div><div class="flex items-center gap-2 flex-wrap">${fileBlock}</div></div>
                    </div>
                    <div class="space-y-1"><p class="text-[12px] font-bold text-slate-500">프로젝트 개요</p><p class="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 rounded-lg p-3 border border-slate-100">${proj.desc ? esc(proj.desc) : '<span class=\'text-slate-300\'>등록된 개요가 없습니다.</span>'}</p></div>
                </div>
                <div class="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                    <div class="flex items-center justify-between px-5 py-3 border-b bg-slate-50/70">
                        <h4 class="font-bold text-sm text-slate-700 flex items-center gap-2"><i data-lucide="table-2" class="w-4 h-4 text-indigo-500"></i> 프로젝트 상세 항목</h4>
                        ${addBtn}
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-xs">
                            <thead><tr class="bg-slate-200/70 text-slate-700 text-[12px]"><th class="p-3 text-center font-bold w-10">완료</th><th class="p-3 text-left font-bold">프로젝트 정보</th><th class="p-3 text-left font-bold">담당자</th><th class="p-3 text-left font-bold">시작일자</th><th class="p-3 text-left font-bold">종료일자</th><th class="p-3 text-left font-bold">상세 내용</th><th class="p-3 text-right font-bold">관리</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>`;
            openModal('project-detail-modal'); if (window.lucide) lucide.createIcons();
            hydrateAttachmentPreviews(document.getElementById('project-detail-body'));
            if (highlightItemId) { const r = document.getElementById('pitem-row-' + highlightItemId); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
        // ── 동시 편집 보호: 저장 직전 DB 최신본을 다시 읽어 '내 항목만' 병합 ──
        async function freshProjectItems(projectId) {
            try { const { data, error } = await sb.from('projects').select('items').eq('id', projectId).single(); if (!error && data && Array.isArray(data.items)) return data.items.slice(); } catch (e) { }
            const p = STATE.projects.find(x => x.id === projectId); return p ? (p.items || []).slice() : [];
        }
        async function freshMeetingDays(meetingId) {
            try { const { data, error } = await sb.from('weekly_meetings').select('days').eq('id', meetingId).single(); if (!error && data && Array.isArray(data.days)) return data.days.slice(); } catch (e) { }
            const m = STATE.weeklyMeetings.find(x => x.id === meetingId); return m ? (m.days || []).slice() : [];
        }
        function upsertById(arr, entry) { const i = arr.findIndex(x => x.id === entry.id); if (i >= 0) arr[i] = entry; else arr.push(entry); return arr; }
        async function persistProjectItems(projectId, items) {
            const { error } = await sb.from('projects').update({ items }).eq('id', projectId);
            if (error) { showToast('저장 실패', error.message); return false; }
            const p = STATE.projects.find(x => x.id === projectId); if (p) p.items = items;
            return true;
        }
        async function toggleProjectItemDone(projectId, itemId, checked) {
            const proj = STATE.projects.find(p => p.id === projectId); if (!proj) return;
            if (!canManageProject(proj)) { showToast('권한 없음', '본인 소속 부서의 프로젝트만 변경할 수 있습니다.'); openProjectDetail(projectId); return; }
            // 최신본을 다시 읽어 해당 항목만 토글 → 다른 사람의 동시 편집 보존
            const items = (await freshProjectItems(projectId)).map(it => it.id === itemId ? Object.assign({}, it, { done: !!checked }) : it);
            const total = items.length;
            const done = items.filter(it => it.done).length;
            const progress = total ? Math.round((done / total) * 100) : proj.progress;
            const status = total ? (progress === 100 ? 'completed' : (progress === 0 ? 'paused' : 'ongoing')) : proj.status;
            const { error } = await sb.from('projects').update({ items, progress, status }).eq('id', projectId);
            if (error) { showToast('저장 실패', error.message); return; }
            const p = STATE.projects.find(x => x.id === projectId); if (p) { p.items = items; p.progress = progress; p.status = status; }
            await reloadProjects(); renderProjects(); openProjectDetail(projectId);
            showToast('진행도 갱신', `체크 기준 진행도 ${progress}% 로 반영되었습니다.`);
        }
        function openProjectItemForm(projectId, itemId) {
            const proj = STATE.projects.find(p => p.id === projectId); if (!proj) return;
            if (!canManageProject(proj)) { showToast('권한 없음', '본인 소속 부서의 프로젝트만 편집할 수 있습니다.'); return; }
            document.getElementById('pitem-project-id').value = projectId;
            document.getElementById('pitem-id').value = itemId || '';
            const it = itemId ? (proj.items || []).find(x => x.id === itemId) : null;
            document.getElementById('pitem-info').value = it ? it.info : '';
            fillPersonSelect('pitem-manager-select', 'pitem-manager-custom', it ? it.managerId : '', it ? it.manager : '');
            document.getElementById('pitem-start').value = it ? (it.start || '') : '';
            document.getElementById('pitem-end').value = it ? (it.end || '') : '';
            document.getElementById('pitem-detail').value = it ? (it.detail || '') : '';
            document.getElementById('project-item-modal-title').innerText = itemId ? '상세 항목 편집' : '상세 항목 추가';
            openModal('project-item-modal');
        }
        async function handleSaveProjectItem(e) {
            e.preventDefault();
            const projectId = parseInt(document.getElementById('pitem-project-id').value);
            const itemId = document.getElementById('pitem-id').value;
            const proj = STATE.projects.find(p => p.id === projectId); if (!proj) return;
            const _pm = readPerson('pitem-manager-select', 'pitem-manager-custom');
            const entry = { id: itemId || ('pi_' + Date.now()), info: document.getElementById('pitem-info').value.trim(), manager: _pm.name, managerId: _pm.id, start: document.getElementById('pitem-start').value, end: document.getElementById('pitem-end').value, detail: document.getElementById('pitem-detail').value.trim() };
            // 최신본을 다시 읽어 이 항목만 반영(동시 편집 보존). 기존 항목이면 done 값 유지
            const items = await freshProjectItems(projectId);
            const prev = items.find(x => x.id === entry.id); if (prev && prev.done !== undefined) entry.done = prev.done;
            upsertById(items, entry);
            if (!(await persistProjectItems(projectId, items))) return;
            await reloadProjects(); renderProjects(); renderDashboardWidgets(); closeModal('project-item-modal'); openProjectDetail(projectId, entry.id); showToast('저장 완료', '프로젝트 상세 항목이 저장되었습니다.');
        }
        async function deleteProjectItem(projectId, itemId) {
            const proj = STATE.projects.find(p => p.id === projectId); if (!proj) return;
            if (!canManageProject(proj)) { showToast('권한 없음', '본인 소속 부서의 프로젝트만 편집할 수 있습니다.'); return; }
            if (!confirm('이 상세 항목을 삭제하시겠습니까?')) return;
            const items = (await freshProjectItems(projectId)).filter(x => x.id !== itemId);
            if (!(await persistProjectItems(projectId, items))) return;
            await reloadProjects(); renderProjects(); openProjectDetail(projectId); showToast('삭제', '상세 항목이 삭제되었습니다.');
        }
        async function viewProjectFile(id) {
            const proj = STATE.projects.find(p => p.id === id); if (!proj || !proj.filePath) return;
            const { data, error } = await sb.storage.from('documents').createSignedUrl(proj.filePath, 3600);
            if (error || !data) { showToast('열람 실패', '파일을 불러오지 못했습니다.'); return; }
            const ext = (proj.fileName && proj.fileName.indexOf('.') >= 0) ? proj.fileName.split('.').pop() : '';
            openFilePreview(proj.fileName || '첨부파일', data.signedUrl, proj.fileMime || '', ext);
        }
        async function downloadProjectFile(id) {
            const proj = STATE.projects.find(p => p.id === id); if (!proj || !proj.filePath) return;
            const { data, error } = await sb.storage.from('documents').createSignedUrl(proj.filePath, 3600, { download: proj.fileName || true });
            if (error || !data) { showToast('다운로드 실패', '파일을 불러오지 못했습니다.'); return; }
            const a = document.createElement('a'); a.href = data.signedUrl; a.download = proj.fileName || 'file'; document.body.appendChild(a); a.click(); a.remove();
        }
        async function handleNewProject_legacy() {}
        async function deleteProject(id) {
            const proj = STATE.projects.find(p => p.id === id);
            if (proj && !canManageProject(proj)) { showToast('권한 없음', '본인 소속 부서의 프로젝트만 삭제할 수 있습니다.'); return; }
            const { error } = await sb.from('projects').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadProjects(); renderProjects(); logAudit('project_delete', proj ? proj.title : ('#' + id), '');
            showToast('기획 철회', '해당 과제가 소거되었습니다.');
        }
        async function moveProjectStatus(id, dir) {
            const proj = STATE.projects.find(p => p.id === id); if (!proj) return;
            if (!canManageProject(proj)) { showToast('권한 없음', '본인 소속 부서의 프로젝트만 변경할 수 있습니다.'); return; }
            const order = ['paused', 'ongoing', 'completed'];
            let idx = order.indexOf(proj.status); if (idx === -1) idx = 0;
            idx = dir === 'next' ? Math.min(idx + 1, 2) : Math.max(idx - 1, 0);
            const status = order[idx]; let progress = proj.progress;
            if (status === 'completed') progress = 100; else if (status === 'paused') progress = 0; else if (progress === 0 || progress === 100) progress = 50;
            const { error } = await sb.from('projects').update({ status, progress }).eq('id', id);
            if (error) { showToast('이동 실패', error.message); return; }
            await reloadProjects(); renderProjects();
        }

        // ── 주간 회의 일지 ───────────────────────────────────────────────
        function meetingYMW(m) {
            const year = parseInt((m.date || '').slice(0, 4)) || null;
            let month = null, week = null;
            const wm = (m.week || '').match(/(\d+)\s*월\s*(\d+)\s*주/);
            if (wm) { month = parseInt(wm[1]); week = parseInt(wm[2]); }
            else { const mm = (m.date || '').match(/^\d{4}-(\d{2})/); if (mm) month = parseInt(mm[1]); }
            return { year, month, week };
        }
        function populateMeetingFilters() {
            const yearSel = document.getElementById('meeting-filter-year');
            const monthSel = document.getElementById('meeting-filter-month');
            const weekSel = document.getElementById('meeting-filter-week');
            if (!yearSel || !monthSel || !weekSel) return;
            const years = new Set(); years.add(new Date().getFullYear());
            STATE.weeklyMeetings.forEach(m => { const y = (m.date || '').slice(0, 4); if (/^\d{4}$/.test(y)) years.add(parseInt(y)); });
            const yearArr = [...years].sort((a, b) => b - a);
            const keepY = yearSel.value || 'all';
            yearSel.innerHTML = `<option value="all">전체 연도</option>` + yearArr.map(y => `<option value="${y}">${y}년</option>`).join('');
            yearSel.value = [...yearSel.options].some(o => o.value === keepY) ? keepY : 'all';
            if (!monthSel.dataset.filled) { monthSel.innerHTML = `<option value="all">전체 월</option>` + Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join(''); monthSel.dataset.filled = '1'; }
            if (!weekSel.dataset.filled) { weekSel.innerHTML = `<option value="all">전체 주차</option>` + [1, 2, 3, 4, 5].map(w => `<option value="${w}">${w}주차</option>`).join(''); weekSel.dataset.filled = '1'; }
        }
        const _meetSection = (icon, color, label, val) => val && val.trim() ? `
            <div class="space-y-1">
                <div class="flex items-center gap-1.5 text-[12px] font-bold ${color}"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i> ${label}</div>
                <p class="text-xs text-slate-600 leading-relaxed whitespace-pre-line pl-5">${val}</p>
            </div>` : '';
        function renderWeeklyMeetings() {
            populateMeetingFilters();
            const container = document.getElementById('weekly-meetings-container'); if (!container) return; container.innerHTML = '';
            const fy = document.getElementById('meeting-filter-year').value;
            const fmo = document.getElementById('meeting-filter-month').value;
            const fw = document.getElementById('meeting-filter-week').value;
            const fd = document.getElementById('meeting-filter-dept').value;
            const filtered = STATE.weeklyMeetings.filter(m => {
                if (fd !== 'all' && m.deptId !== fd) return false;
                const y = meetingYMW(m);
                if (fy !== 'all' && String(y.year) !== fy) return false;
                if (fmo !== 'all' && String(y.month) !== fmo) return false;
                if (fw !== 'all' && String(y.week) !== fw) return false;
                return true;
            });
            if (filtered.length === 0) { container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 text-xs font-medium"><i data-lucide="clipboard-list" class="w-8 h-8 mx-auto mb-3 opacity-30"></i><p>선택한 조건에 해당하는 주간 업무 보고가 없습니다.</p></div>`; if (window.lucide) lucide.createIcons(); return; }
            const accent = { ceo: 'bg-slate-700', south_cs: 'bg-blue-500', strategy: 'bg-purple-500', hydrogen: 'bg-emerald-500', rnd: 'bg-amber-500', central_cs: 'bg-cyan-500', sales: 'bg-rose-500' };
            filtered.forEach(meet => {
                const dept = STATE.departments.find(d => d.id === meet.deptId);
                const stripe = accent[meet.deptId] || 'bg-slate-400';
                const canManage = STATE.profile.role === 'admin' || meet.deptId === STATE.profile.deptId;
                const card = document.createElement('div');
                card.className = "bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden";
                const headline = (meet.title && meet.title.trim()) ? meet.title : `${meet.week} 주간 업무 보고`;
                const attachInfo = (meet.image ? '🖼 사진 ' : '') + (meet.filePath ? '📎 첨부' : '');
                const ctrlBtns = canManage
                    ? `<button onclick="event.stopPropagation(); openEditMeeting(${meet.id})" class="text-[12px] text-indigo-500 hover:text-indigo-700 font-bold flex items-center gap-1"><i data-lucide="pencil" class="w-3 h-3"></i> 편집</button><button onclick="event.stopPropagation(); deleteWeeklyMeeting(${meet.id})" class="text-[12px] text-slate-400 hover:text-rose-600 font-bold flex items-center gap-1"><i data-lucide="trash-2" class="w-3 h-3"></i> 철회</button>`
                    : `<span class="text-[12px] text-slate-300">열람 전용</span>`;
                card.innerHTML = `
                    <div class="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/60 cursor-pointer" onclick="openMeetingDetail(${meet.id})">
                        <span class="w-2 h-8 ${stripe} rounded-full"></span>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 border rounded-md text-[12px] font-bold ${dept ? dept.textTheme : 'bg-slate-100'}">${dept ? dept.name : '전사'}</span>
                                <span class="text-[12px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">${meet.week}</span>
                            </div>
                        </div>
                        <span class="text-[12px] text-slate-400 font-mono">${meet.date || ''}</span>
                    </div>
                    <div class="p-5 space-y-3.5">
                        <div class="cursor-pointer" onclick="openMeetingDetail(${meet.id})">
                            <h4 class="font-extrabold text-[15px] text-slate-800 leading-snug hover:text-indigo-600 transition-colors">${headline}</h4>
                            <p class="text-[12px] text-slate-400 mt-1 flex items-center gap-2"><span class="flex items-center gap-1"><i data-lucide="user" class="w-3 h-3"></i> ${meet.author || '-'}</span>${attachInfo ? `<span class="text-slate-400">${attachInfo}</span>` : ''}</p>
                        </div>
                        ${_meetSection('list', 'text-slate-500', '주요 논의 내용', meet.content)}
                        ${_meetSection('check-circle-2', 'text-emerald-600', '주요 결정 / 합의 사항', meet.decisions)}
                        <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-50">
                            <button onclick="openMeetingDetail(${meet.id})" class="text-[12px] text-slate-500 hover:text-indigo-600 font-bold flex items-center gap-1"><i data-lucide="maximize-2" class="w-3 h-3"></i> 상세 보기</button>
                            <div class="flex items-center gap-3">${ctrlBtns}</div>
                        </div>
                    </div>`;
                container.appendChild(card);
            });
            if (window.lucide) lucide.createIcons();
        }
        function meetingDayTableHTML(meet, wd, entries, canManage) {
            const rows = entries.map((en, i) => {
                const proj = en.projectId ? STATE.projects.find(p => p.id === en.projectId) : null;
                const link = proj ? `<button onclick="gotoLinkedProject(${en.projectId}, '${en.projectItemId || ''}')" class="inline-flex items-center gap-1 text-[13px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1.5 hover:bg-indigo-100"><i data-lucide="link" class="w-3.5 h-3.5"></i> ${esc(proj.title)}${en.projectItemLabel ? ' › ' + esc(en.projectItemLabel) : ''}</button>` : '<span class="text-slate-300">—</span>';
                const att = en.filePath ? `<div class="w-28">${attachSlot('mday', meet.id, en.id, 'sm')}</div>` : '<span class="text-slate-300">—</span>';
                const ctrl = canManage ? `<div class="flex gap-2.5 justify-end whitespace-nowrap"><button onclick="openMeetingDayForm(${meet.id}, ${wd}, '${en.id}')" class="text-indigo-500 hover:text-indigo-700 font-bold">편집</button><button onclick="deleteMeetingDay(${meet.id}, '${en.id}')" class="text-rose-400 hover:text-rose-600 font-bold">삭제</button></div>` : '<span class="text-slate-300">—</span>';
                const zebra = i % 2 ? 'bg-slate-50/40' : 'bg-white';
                return `<tr class="${zebra} hover:bg-indigo-50/30 transition-colors align-top">
                    <td class="px-3 py-2.5 font-bold text-slate-800 whitespace-pre-line min-w-[100px]">${esc(en.taskName) || '<span class=\'text-slate-300 font-normal\'>—</span>'}</td>
                    <td class="px-3 py-2.5 text-slate-700 whitespace-nowrap font-medium">${esc(en.manager) || '—'}</td>
                    <td class="px-3 py-2.5 text-slate-600 whitespace-pre-line min-w-[190px] leading-snug">${esc(en.content) || '—'}</td>
                    <td class="px-3 py-2.5 min-w-[120px]">${link}</td>
                    <td class="px-3 py-2.5 min-w-[110px]">${att}</td>
                    <td class="px-3 py-2.5 text-right text-[13px]">${ctrl}</td>
                </tr>`;
            }).join('');
            return `<div class="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table class="w-full text-[14px] border-collapse">
                    <thead><tr class="bg-indigo-600 text-white"><th class="px-3 py-2.5 text-left font-bold tracking-tight">업무명</th><th class="px-3 py-2.5 text-left font-bold tracking-tight">담당자</th><th class="px-3 py-2.5 text-left font-bold tracking-tight">상세 내용</th><th class="px-3 py-2.5 text-left font-bold tracking-tight">프로젝트</th><th class="px-3 py-2.5 text-left font-bold tracking-tight">첨부</th><th class="px-3 py-2.5 text-right font-bold tracking-tight">관리</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
        }
        function openDayExpand(meetingId, wd) {
            const meet = STATE.weeklyMeetings.find(m => m.id === meetingId); if (!meet) return;
            const canManage = STATE.profile.role === 'admin' || meet.deptId === STATE.profile.deptId;
            const entries = (meet.days || []).filter(d => d.weekday === wd);
            document.getElementById('day-expand-title').innerHTML = `<i data-lucide="calendar-days" class="w-4 h-4 text-indigo-600"></i> ${WEEKDAY_KO[wd]} 일별 업무 <span class="text-[12px] text-slate-400 font-bold">${entries.length}건</span>`;
            const addBtn = canManage ? `<button onclick="closeModal('day-expand-modal'); openMeetingDayForm(${meet.id}, ${wd})" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold rounded-lg flex items-center gap-1"><i data-lucide="plus" class="w-3.5 h-3.5"></i> 추가</button>` : '';
            const cards = entries.length ? meetingDayTableHTML(meet, wd, entries, canManage) : `<p class="text-xs text-slate-300 text-center py-8">이 요일에 등록된 업무가 없습니다.</p>`;
            document.getElementById('day-expand-body').innerHTML = `<div class="flex justify-end">${addBtn}</div>${cards}`;
            openModal('day-expand-modal'); if (window.lucide) lucide.createIcons();
            hydrateAttachmentPreviews(document.getElementById('day-expand-body'));
        }
        const WEEKDAY_KO = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
        function openMeetingDetail(id) {
            const meet = STATE.weeklyMeetings.find(m => m.id === id); if (!meet) return;
            STATE._openDetail = { type: 'meeting', id };
            const dept = STATE.departments.find(d => d.id === meet.deptId);
            const canManage = STATE.profile.role === 'admin' || meet.deptId === STATE.profile.deptId;
            const headline = (meet.title && meet.title.trim()) ? meet.title : `${meet.week} 주간 업무 보고`;
            const stripe = { ceo: 'bg-slate-700', south_cs: 'bg-blue-500', strategy: 'bg-purple-500', hydrogen: 'bg-emerald-500', rnd: 'bg-amber-500', central_cs: 'bg-cyan-500', sales: 'bg-rose-500' }[meet.deptId] || 'bg-indigo-500';
            const img = meet.image ? `<img src="${meet.image}" onclick="viewMeetingImage(${meet.id})" class="w-full h-44 rounded-lg border object-cover cursor-pointer hover:opacity-90" title="크게 보기">` : '';
            const fileThumb = meet.filePath ? attachSlot('meeting', meet.id) : '';
            const days = meet.days || [];
            const usedDays = [...new Set(days.map(d => d.weekday))].sort((a, b) => a - b);
            const dayBlocks = usedDays.length === 0
                ? `<p class="text-xs text-slate-300 text-center py-8">아직 등록된 일별 업무가 없습니다.${canManage ? ' 위의 “＋ 일별 업무 추가” 버튼으로 작성하세요.' : ''}</p>`
                : usedDays.map(wd => {
                    const entries = days.filter(d => d.weekday === wd);
                    const isWeekend = wd >= 5;
                    return `<div class="space-y-2">
                        <div class="flex items-center gap-2 cursor-pointer group" onclick="openDayExpand(${meet.id}, ${wd})" title="클릭하여 확대"><span class="px-3 py-1 rounded-lg text-xs font-bold ${isWeekend ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-600'}">${WEEKDAY_KO[wd]}</span><span class="text-[12px] text-slate-300 font-bold">${entries.length}건</span><i data-lucide="maximize-2" class="w-3 h-3 text-slate-300 group-hover:text-indigo-500"></i></div>
                        ${meetingDayTableHTML(meet, wd, entries, canManage)}
                    </div>`;
                }).join('');
            const sec = (icon, color, label, val) => val && val.trim() ? `<div class="space-y-1"><div class="flex items-center gap-1.5 text-[12px] font-bold ${color}"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i> ${label}</div><p class="text-xs text-slate-600 leading-relaxed whitespace-pre-line pl-5">${esc(val)}</p></div>` : '';
            const ctrl = canManage
                ? `<div class="flex gap-2 flex-shrink-0"><button onclick="openEditMeeting(${meet.id})" class="px-4 py-2 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"><i data-lucide="pencil" class="w-3.5 h-3.5"></i> 보고 편집</button><button onclick="deleteWeeklyMeeting(${meet.id}); closeModal('meeting-detail-modal')" class="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg">철회</button></div>`
                : `<span class="text-[12px] text-slate-300 flex-shrink-0">타 부서 보고 · 열람 전용</span>`;
            const addDayBtn = canManage ? `<button onclick="openMeetingDayForm(${meet.id})" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold rounded-lg flex items-center gap-1"><i data-lucide="plus" class="w-3.5 h-3.5"></i> 일별 업무 추가</button>` : '';
            const attachWrap = (img || fileThumb) ? `<div class="space-y-2 pt-2"><p class="text-[12px] font-bold text-slate-500 flex items-center gap-1"><i data-lucide="paperclip" class="w-3 h-3"></i> 첨부 자료</p><div class="grid grid-cols-2 md:grid-cols-3 gap-3">${img ? `<div>${img}</div>` : ''}${fileThumb}</div></div>` : '';
            document.getElementById('meeting-detail-body').innerHTML = `
                <div class="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                    <div class="flex">
                        <div class="w-2 flex-shrink-0 ${stripe}"></div>
                        <div class="flex-1 px-5 py-4 bg-gradient-to-r from-slate-50 to-white meeting-detail-banner">
                            <div class="flex items-start justify-between gap-3 flex-wrap">
                                <div class="space-y-2 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="px-2.5 py-1 rounded-md text-[12px] font-bold border ${dept ? dept.textTheme : 'bg-slate-100'}">${dept ? dept.name : '전사'}</span>
                                        <span class="px-2.5 py-1 rounded-full text-[12px] font-bold bg-indigo-600 text-white">${meet.week}</span>
                                        <span class="text-[12px] text-slate-400 font-mono flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i> ${meet.date || '-'}</span>
                                    </div>
                                    <h2 class="text-2xl font-extrabold text-slate-800 leading-tight">${esc(headline)}</h2>
                                    <p class="text-[13px] text-slate-500 flex items-center gap-1.5"><i data-lucide="user-circle" class="w-3.5 h-3.5"></i> 보고자 <strong class="text-slate-700">${esc(meet.author) || '-'}</strong></p>
                                </div>
                                ${ctrl}
                            </div>
                        </div>
                    </div>
                    <div class="p-4 space-y-3 border-t border-slate-100">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                            ${sec('list', 'text-slate-500', '주요 논의 내용', meet.content)}
                            ${sec('check-circle-2', 'text-emerald-600', '주요 결정 / 합의 사항', meet.decisions)}
                            ${sec('folder-git', 'text-indigo-600', '프로젝트', meet.actionItems)}
                            ${sec('calendar-clock', 'text-amber-600', '차주 계획', meet.nextPlan)}
                        </div>
                        ${attachWrap}
                    </div>
                </div>
                <div class="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <h4 class="font-bold text-sm text-slate-700 flex items-center gap-2"><i data-lucide="calendar-range" class="w-4 h-4 text-indigo-500"></i> 주간 일별 업무</h4>
                        ${addDayBtn}
                    </div>
                    <div id="mday-scroll" class="space-y-5 max-h-[55vh] overflow-y-auto pr-1 select-none" style="cursor:grab">${dayBlocks}</div>
                </div>`;
            openModal('meeting-detail-modal'); if (window.lucide) lucide.createIcons();
            attachDragScroll(document.getElementById('mday-scroll'));
            hydrateAttachmentPreviews(document.getElementById('meeting-detail-body'));
        }
        function attachDragScroll(el) {
            if (!el || el._dragBound) return; el._dragBound = true;
            let down = false, sy = 0, st = 0;
            el.addEventListener('mousedown', (e) => { if (e.target.closest('button,a,input,textarea,select,img')) return; down = true; sy = e.pageY; st = el.scrollTop; el.style.cursor = 'grabbing'; });
            window.addEventListener('mouseup', () => { down = false; if (el) el.style.cursor = 'grab'; });
            el.addEventListener('mousemove', (e) => { if (!down) return; e.preventDefault(); el.scrollTop = st - (e.pageY - sy); });
        }
        async function persistMeetingDays(meetingId, days) {
            const { error } = await sb.from('weekly_meetings').update({ days }).eq('id', meetingId);
            if (error) { showToast('저장 실패', error.message); return false; }
            const m = STATE.weeklyMeetings.find(x => x.id === meetingId); if (m) m.days = days;
            return true;
        }
        function populateMdayProjectSelect(selectedProjectId) {
            const sel = document.getElementById('mday-project'); if (!sel) return;
            sel.innerHTML = `<option value="">(연결 안 함)</option>` + STATE.projects.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('');
            sel.value = selectedProjectId ? String(selectedProjectId) : '';
            onMdayProjectChange(selectedProjectId);
        }
        function onMdayProjectChange(preselectItemId) {
            const pid = parseInt(document.getElementById('mday-project').value);
            const itemSel = document.getElementById('mday-item'); if (!itemSel) return;
            const proj = STATE.projects.find(p => p.id === pid);
            const opts = ['<option value="">(항목 연결 안 함)</option>'];
            if (proj) (proj.items || []).forEach(it => opts.push(`<option value="${it.id}">${esc(it.info)}</option>`));
            itemSel.innerHTML = opts.join('');
            if (preselectItemId) itemSel.value = preselectItemId;
        }
        function openMeetingDayForm(meetingId, weekday, entryId) {
            const meet = STATE.weeklyMeetings.find(m => m.id === meetingId); if (!meet) return;
            if (!(STATE.profile.role === 'admin' || meet.deptId === STATE.profile.deptId)) { showToast('권한 없음', '본인 소속 부서의 보고만 편집할 수 있습니다.'); return; }
            document.getElementById('mday-meeting-id').value = meetingId;
            document.getElementById('mday-entry-id').value = entryId || '';
            const en = entryId ? (meet.days || []).find(d => d.id === entryId) : null;
            document.getElementById('mday-weekday').value = String(en ? en.weekday : (weekday || 0));
            document.getElementById('mday-content').value = en ? en.content : '';
            document.getElementById('mday-taskname').value = en ? (en.taskName || '') : '';
            fillPersonSelect('mday-manager-select', 'mday-manager-custom', en ? en.managerId : '', en ? en.manager : '');
            populateMdayProjectSelect(en ? en.projectId : '');
            onMdayProjectChange(en ? en.projectItemId : '');
            STATE.mdayFile = null;
            STATE.mdayKeepFile = en ? { path: en.filePath, name: en.fileName, mime: en.fileMime } : null;
            const fst = document.getElementById('mday-file-status'); if (fst) { fst.innerText = (en && en.filePath) ? `현재 파일 유지: ${en.fileName} (교체하려면 클릭)` : '클릭하여 파일 첨부'; fst.classList.remove('text-indigo-600'); }
            document.getElementById('mday-modal-title').innerText = entryId ? '일별 내용 편집' : `일별 내용 작성 (${WEEKDAY_KO[weekday || 0]})`;
            openModal('meeting-day-modal');
        }
        function handleMdayFileSelection(e) {
            const f = e.target.files[0]; if (!f) return; STATE.mdayFile = f;
            const st = document.getElementById('mday-file-status'); if (st) { st.innerText = `첨부: ${f.name} (${humanSize(f.size)})`; st.classList.add('text-indigo-600'); }
        }
        async function handleSaveMeetingDay(e) {
            e.preventDefault();
            const meetingId = parseInt(document.getElementById('mday-meeting-id').value);
            const entryId = document.getElementById('mday-entry-id').value;
            const meet = STATE.weeklyMeetings.find(m => m.id === meetingId); if (!meet) return;
            const pid = parseInt(document.getElementById('mday-project').value) || null;
            const itemSel = document.getElementById('mday-item'); const itemId = itemSel.value || null;
            const itemLabel = itemId ? (itemSel.options[itemSel.selectedIndex] ? itemSel.options[itemSel.selectedIndex].text : '') : '';
            const keep = STATE.mdayKeepFile || {};
            let filePath = entryId ? (keep.path || null) : null;
            let fileName = entryId ? (keep.name || null) : null;
            let fileMime = entryId ? (keep.mime || null) : null;
            if (STATE.mdayFile) {
                const f = STATE.mdayFile;
                const newPath = safeStorageKey(f.name, 'meetings/');
                const { error: upErr } = await sb.storage.from('documents').upload(newPath, f, { contentType: f.type || 'application/octet-stream', upsert: false });
                if (upErr) { showToast('첨부 실패', upErr.message); return; }
                if (entryId && keep.path) { try { await sb.storage.from('documents').remove([keep.path]); } catch (er) {} }
                filePath = newPath; fileName = f.name; fileMime = f.type || '';
            }
            const _mm = readPerson('mday-manager-select', 'mday-manager-custom');
            const entry = { id: entryId || ('md_' + Date.now()), weekday: parseInt(document.getElementById('mday-weekday').value), taskName: document.getElementById('mday-taskname').value.trim(), manager: _mm.name, managerId: _mm.id, content: document.getElementById('mday-content').value.trim(), projectId: pid, projectItemId: itemId, projectItemLabel: itemLabel, filePath, fileName, fileMime };
            // 최신본을 다시 읽어 이 항목만 반영(동시 편집 보존)
            const days = await freshMeetingDays(meetingId);
            upsertById(days, entry);
            if (!(await persistMeetingDays(meetingId, days))) return;
            STATE.mdayFile = null; STATE.mdayKeepFile = null;
            await reloadMeetings(); closeModal('meeting-day-modal'); openMeetingDetail(meetingId); showToast('저장 완료', '일별 업무 내용이 저장되었습니다.');
        }
        async function viewMdayFile(meetingId, entryId) {
            const meet = STATE.weeklyMeetings.find(m => m.id === meetingId); if (!meet) return;
            const en = (meet.days || []).find(d => d.id === entryId); if (!en || !en.filePath) return;
            const { data, error } = await sb.storage.from('documents').createSignedUrl(en.filePath, 3600);
            if (error || !data) { showToast('열람 실패', '파일을 불러오지 못했습니다.'); return; }
            const ext = (en.fileName && en.fileName.indexOf('.') >= 0) ? en.fileName.split('.').pop() : '';
            openFilePreview(en.fileName || '첨부파일', data.signedUrl, en.fileMime || '', ext);
        }
        async function downloadMdayFile(meetingId, entryId) {
            const meet = STATE.weeklyMeetings.find(m => m.id === meetingId); if (!meet) return;
            const en = (meet.days || []).find(d => d.id === entryId); if (!en || !en.filePath) return;
            const { data, error } = await sb.storage.from('documents').createSignedUrl(en.filePath, 3600, { download: en.fileName || true });
            if (error || !data) { showToast('다운로드 실패', '파일을 불러오지 못했습니다.'); return; }
            const a = document.createElement('a'); a.href = data.signedUrl; a.download = en.fileName || 'file'; document.body.appendChild(a); a.click(); a.remove();
        }
        async function deleteMeetingDay(meetingId, entryId) {
            const meet = STATE.weeklyMeetings.find(m => m.id === meetingId); if (!meet) return;
            if (!(STATE.profile.role === 'admin' || meet.deptId === STATE.profile.deptId)) { showToast('권한 없음', '본인 소속 부서의 보고만 편집할 수 있습니다.'); return; }
            if (!confirm('이 일별 내용을 삭제하시겠습니까?')) return;
            const target = (meet.days || []).find(d => d.id === entryId);
            if (target && target.filePath) { try { await sb.storage.from('documents').remove([target.filePath]); } catch (er) {} }
            const days = (await freshMeetingDays(meetingId)).filter(d => d.id !== entryId);
            if (!(await persistMeetingDays(meetingId, days))) return;
            await reloadMeetings(); openMeetingDetail(meetingId); showToast('삭제', '일별 내용이 삭제되었습니다.');
        }
        // ── 첨부파일 썸네일 미리보기 엔진 ────────────────────────────────
        function attachSlot(kind, id, eid, size) { return `<div class="attach-preview-slot" data-kind="${kind}" data-id="${id}" data-eid="${eid || ''}" data-size="${size || ''}"></div>`; }
        function resolveAttachInfo(kind, id, eid) {
            if (kind === 'meeting') { const m = STATE.weeklyMeetings.find(x => x.id == id); if (!m || !m.filePath) return null; return { path: m.filePath, name: m.fileName, mime: m.fileMime, view: `viewMeetingFile(${id})` }; }
            if (kind === 'mday') { const m = STATE.weeklyMeetings.find(x => x.id == id); if (!m) return null; const en = (m.days || []).find(d => d.id === eid); if (!en || !en.filePath) return null; return { path: en.filePath, name: en.fileName, mime: en.fileMime, view: `viewMdayFile(${id},'${eid}')` }; }
            if (kind === 'project') { const p = STATE.projects.find(x => x.id == id); if (!p || !p.filePath) return null; return { path: p.filePath, name: p.fileName, mime: p.fileMime, view: `viewProjectFile(${id})` }; }
            return null;
        }
        function fileIconHTML(ext) {
            const map = { pdf: 'file-text', docx: 'file-text', doc: 'file-text', xlsx: 'sheet', xls: 'sheet', csv: 'sheet', pptx: 'monitor-play', ppt: 'monitor-play', zip: 'file-archive' };
            const ic = map[ext] || 'file';
            return `<div class="flex flex-col items-center gap-1 text-slate-400"><i data-lucide="${ic}" class="w-8 h-8"></i><span class="text-[12px] font-bold uppercase">${ext || '파일'}</span></div>`;
        }
        async function downloadStoragePath(path, name) {
            if (!path) return;
            const { data, error } = await sb.storage.from('documents').createSignedUrl(path, 3600, { download: name || true });
            if (error || !data) { showToast('다운로드 실패', '파일을 불러오지 못했습니다.'); return; }
            const a = document.createElement('a'); a.href = data.signedUrl; a.download = name || 'file'; document.body.appendChild(a); a.click(); a.remove();
        }
        function hydrateAttachmentPreviews(root) {
            (root || document).querySelectorAll('.attach-preview-slot:not([data-hydrated])').forEach(slot => {
                slot.dataset.hydrated = '1';
                const info = resolveAttachInfo(slot.dataset.kind, slot.dataset.id, slot.dataset.eid);
                if (!info) { slot.innerHTML = ''; return; }
                renderAttachmentCard(slot, info);
            });
        }
        async function renderAttachmentCard(slot, info) {
            const ext = (info.name && info.name.indexOf('.') >= 0) ? info.name.split('.').pop().toLowerCase() : '';
            const mime = (info.mime || '').toLowerCase();
            const escName = esc(info.name || '첨부파일');
            const safePath = (info.path || '').replace(/'/g, "\\'");
            const sm = slot.dataset.size === 'sm';
            const hCls = sm ? 'h-20' : 'h-44';
            slot.innerHTML = `<div class="relative group">
                <div class="thumb-body relative w-full ${hCls} bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer" onclick="${info.view}">
                    <span class="inline-block w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></span>
                </div>
                <div class="absolute bottom-0 inset-x-0 bg-slate-900/75 text-white ${sm ? 'text-[10px] px-1 py-0.5' : 'text-[12px] px-2 py-1.5'} font-bold truncate flex items-center gap-1 pointer-events-none rounded-b-lg"><i data-lucide="paperclip" class="${sm ? 'w-2.5 h-2.5' : 'w-3 h-3'}"></i> ${escName}</div>
                <button onclick="downloadStoragePath('${safePath}','${escName.replace(/'/g, "\\'")}')" class="absolute top-1 right-1 ${sm ? 'p-1' : 'p-1.5'} bg-white/90 hover:bg-white border border-slate-200 rounded-lg text-slate-600 shadow" title="다운로드"><i data-lucide="download" class="${sm ? 'w-3 h-3' : 'w-3.5 h-3.5'}"></i></button>
            </div>`;
            const thumb = slot.querySelector('.thumb-body');
            try {
                const { data, error } = await sb.storage.from('documents').createSignedUrl(info.path, 3600);
                if (error || !data) throw new Error('url');
                const url = data.signedUrl;
                if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
                    thumb.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
                } else if (mime === 'application/pdf' || ext === 'pdf') { await renderPdfThumb(thumb, url); }
                else if (mime.indexOf('word') >= 0 || ext === 'docx') { await renderDocxThumb(thumb, url); }
                else if (mime.indexOf('sheet') >= 0 || mime.indexOf('excel') >= 0 || ['xlsx', 'xls', 'csv'].includes(ext)) { await renderXlsxThumb(thumb, url); }
                else { thumb.innerHTML = fileIconHTML(ext); }
            } catch (e) { thumb.innerHTML = fileIconHTML(ext); }
            if (window.lucide) lucide.createIcons();
        }
        async function renderPdfThumb(thumb, url) {
            try { await ensurePdf(); } catch (e) { }
            if (typeof pdfjsLib === 'undefined') { thumb.innerHTML = fileIconHTML('pdf'); return; }
            const pdf = await pdfjsLib.getDocument({ url }).promise;
            const page = await pdf.getPage(1);
            const tw = thumb.clientWidth || 240;
            const v1 = page.getViewport({ scale: 1 });
            const scale = Math.max(tw / v1.width, 0.2);
            const vp = page.getViewport({ scale });
            const canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height;
            canvas.style.width = '100%'; canvas.style.height = 'auto'; canvas.style.display = 'block';
            thumb.innerHTML = ''; thumb.style.alignItems = 'flex-start'; thumb.style.background = '#fff'; thumb.appendChild(canvas);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        }
        async function renderDocxThumb(thumb, url) {
            try { await ensureDocx(); } catch (e) { }
            if (typeof docx === 'undefined' || !docx.renderAsync) { thumb.innerHTML = fileIconHTML('docx'); return; }
            const buf = await (await fetch(url)).arrayBuffer();
            const inner = document.createElement('div'); inner.style.transformOrigin = 'top left'; inner.style.background = '#fff';
            thumb.innerHTML = ''; thumb.style.alignItems = 'flex-start'; thumb.style.background = '#fff'; thumb.appendChild(inner);
            await docx.renderAsync(buf, inner, null, { className: 'docx', inWrapper: true });
            await new Promise(r => setTimeout(r, 30));
            const rendered = inner.querySelector('.docx') || inner.firstElementChild || inner;
            const rw = (rendered.getBoundingClientRect().width) || 794;
            const tw = thumb.clientWidth || 240;
            inner.style.transform = `scale(${Math.max(tw / rw, 0.1)})`;
        }
        async function renderXlsxThumb(thumb, url) {
            try { await ensureXlsx(); } catch (e) { }
            if (typeof XLSX === 'undefined') { thumb.innerHTML = fileIconHTML('xlsx'); return; }
            const buf = await (await fetch(url)).arrayBuffer();
            const wb = XLSX.read(buf, { type: 'array' });
            const html = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]);
            const inner = document.createElement('div'); inner.className = 'sheet-html'; inner.style.transformOrigin = 'top left'; inner.style.background = '#fff'; inner.innerHTML = html;
            thumb.innerHTML = ''; thumb.style.alignItems = 'flex-start'; thumb.style.background = '#fff'; thumb.appendChild(inner);
            await new Promise(r => setTimeout(r, 20));
            const rw = inner.scrollWidth || inner.getBoundingClientRect().width || 400;
            const tw = thumb.clientWidth || 240;
            if (rw > tw) inner.style.transform = `scale(${tw / rw})`;
        }
        function gotoLinkedProject(projectId, itemId) {
            // 탭 전환 없이 현재 화면(주간보고 등) 위에 프로젝트 상세를 띄움. 닫으면 아래 화면이 그대로 보임.
            openProjectDetail(projectId, itemId || undefined);
        }
        function populateMeetingWeekOptions() {
            const sel = document.getElementById('meeting-week'); if (!sel) return;
            const mo = new Date().getMonth() + 1;
            const keep = sel.value;
            sel.innerHTML = [1, 2, 3, 4, 5].map(w => `<option value="${mo}월 ${w}주차">${mo}월 ${w}주차</option>`).join('');
            if (keep && [...sel.options].some(o => o.value === keep)) sel.value = keep;
        }
        function resetMeetingForm() {
            ['meeting-title', 'meeting-content', 'meeting-decisions', 'meeting-actions', 'meeting-next'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            document.getElementById('meeting-id').value = '';
            STATE.meetingUploadedImg = ''; STATE.meetingUploadedFileName = ''; STATE.meetingUploadedFile = null; STATE.meetingKeepFile = null;
            const i = document.getElementById('meeting-img-status'); if (i) i.innerText = '사진 첨부';
            const f = document.getElementById('meeting-file-status'); if (f) f.innerText = '문서 첨부';
        }
        function openAddMeeting() {
            resetMeetingForm();
            populateMeetingWeekOptions();
            const t = document.getElementById('meeting-modal-title'); if (t) t.innerText = '주간 업무 보고 작성';
            applyDeptLock('meeting-dept');
            openModal('add-meeting-modal');
        }
        function openEditMeeting(id) {
            const meet = STATE.weeklyMeetings.find(m => m.id === id); if (!meet) return;
            if (!(STATE.profile.role === 'admin' || meet.deptId === STATE.profile.deptId)) { showToast('수정 권한 없음', '본인 소속 부서의 보고만 수정할 수 있습니다.'); return; }
            closeModal('meeting-detail-modal');
            resetMeetingForm();
            populateMeetingWeekOptions();
            const wsel = document.getElementById('meeting-week');
            if (![...wsel.options].some(o => o.value === meet.week)) { const o = document.createElement('option'); o.value = meet.week; o.text = meet.week; wsel.appendChild(o); }
            wsel.value = meet.week;
            document.getElementById('meeting-id').value = meet.id;
            document.getElementById('meeting-dept').value = meet.deptId;
            document.getElementById('meeting-title').value = meet.title || '';
            document.getElementById('meeting-content').value = meet.content || '';
            document.getElementById('meeting-decisions').value = meet.decisions || '';
            document.getElementById('meeting-actions').value = meet.actionItems || '';
            document.getElementById('meeting-next').value = meet.nextPlan || '';
            STATE.meetingKeepFile = { path: meet.filePath, name: meet.fileName, mime: meet.fileMime, image: meet.image };
            STATE.meetingUploadedImg = meet.image || '';
            STATE.meetingUploadedFileName = meet.fileName || '';
            const i = document.getElementById('meeting-img-status'); if (i) i.innerText = meet.image ? '사진 유지 (교체하려면 클릭)' : '사진 첨부';
            const f = document.getElementById('meeting-file-status'); if (f) f.innerText = meet.fileName ? `파일 유지: ${meet.fileName}` : '문서 첨부';
            const t = document.getElementById('meeting-modal-title'); if (t) t.innerText = '주간 보고 수정';
            applyDeptLock('meeting-dept');
            openModal('add-meeting-modal');
        }
        async function viewMeetingFile(id) {
            const meet = STATE.weeklyMeetings.find(m => m.id === id); if (!meet || !meet.filePath) return;
            const body = document.getElementById('doc-preview-body'); const dl = document.getElementById('doc-preview-download');
            document.getElementById('doc-preview-title').innerText = meet.fileName || '첨부파일';
            body.innerHTML = `<div class="text-slate-400 text-xs p-10">파일을 불러오는 중입니다...</div>`;
            openModal('doc-preview-modal');
            const { data, error } = await sb.storage.from('documents').createSignedUrl(meet.filePath, 3600);
            if (error || !data) { body.innerHTML = `<div class="text-rose-500 text-xs p-10">파일을 불러오지 못했습니다.</div>`; dl.classList.add('hidden'); return; }
            const ext = (meet.fileName && meet.fileName.indexOf('.') >= 0) ? meet.fileName.split('.').pop() : '';
            openFilePreview(meet.fileName || '첨부파일', data.signedUrl, meet.fileMime || '', ext);
        }
        function viewMeetingImage(id) {
            const meet = STATE.weeklyMeetings.find(m => m.id === id); if (!meet || !meet.image) return;
            openFilePreview(`${meet.week} 회의 사진`, meet.image, 'image/png');
        }
        function handleMeetingImgSelection(e) {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader(); r.onload = (evt) => { STATE.meetingUploadedImg = evt.target.result; document.getElementById('meeting-img-status').innerText = `사진 완료: ${f.name}`; }; r.readAsDataURL(f);
        }
        function handleMeetingFileSelection(e) {
            const f = e.target.files[0]; if (!f) return;
            STATE.meetingUploadedFile = f; STATE.meetingUploadedFileName = f.name;
            document.getElementById('meeting-file-status').innerText = `첨부 완료: ${f.name}`;
        }
        async function handleNewMeeting(e) {
            e.preventDefault();
            const id = document.getElementById('meeting-id').value;
            const week = document.getElementById('meeting-week').value;
            const dept = document.getElementById('meeting-dept').value;
            const title = document.getElementById('meeting-title').value.trim();
            const content = document.getElementById('meeting-content').value.trim();
            const decisions = document.getElementById('meeting-decisions').value.trim();
            const actions = document.getElementById('meeting-actions').value.trim();
            const next = document.getElementById('meeting-next').value.trim();
            if (!content) { showToast('입력 필요', '주요 논의 내용을 입력하세요.'); return; }
            if (STATE.profile.role !== 'admin' && dept !== STATE.profile.deptId) { showToast('작성 권한 없음', '본인 소속 부서의 회의록만 작성할 수 있습니다.'); return; }
            const keep = STATE.meetingKeepFile || {};
            let file_path = id ? (keep.path || null) : null;
            let file_mime = id ? (keep.mime || null) : null;
            let file_name = id ? (keep.name || '') : '';
            if (STATE.meetingUploadedFile) {
                const f = STATE.meetingUploadedFile;
                const newPath = safeStorageKey(f.name, 'meetings/');
                const { error: upErr } = await sb.storage.from('documents').upload(newPath, f, { contentType: f.type || 'application/octet-stream', upsert: false });
                if (upErr) { showToast('첨부 업로드 실패', upErr.message); return; }
                if (id && keep.path) { try { await sb.storage.from('documents').remove([keep.path]); } catch (er) {} }
                file_path = newPath; file_mime = f.type || ''; file_name = f.name;
            }
            const payload = { dept_id: dept, week, title: title || null, content, decisions: decisions || null, action_items: actions || null, next_plan: next || null, image: STATE.meetingUploadedImg || '', file_name: file_name || '', file_path, file_mime };
            let error;
            if (id) { ({ error } = await sb.from('weekly_meetings').update(payload).eq('id', parseInt(id))); }
            else { payload.author = STATE.profile.name; payload.meet_date = formatDate(new Date()); ({ error } = await sb.from('weekly_meetings').insert(payload)); }
            if (error) { showToast('저장 실패', error.message); return; }
            STATE.meetingUploadedImg = ''; STATE.meetingUploadedFileName = ''; STATE.meetingUploadedFile = null; STATE.meetingKeepFile = null;
            await reloadMeetings(); renderWeeklyMeetings(); closeModal('add-meeting-modal'); showToast(id ? '보고 수정' : '보고 배포', id ? '주간 업무 보고가 수정되었습니다.' : '주간 업무 보고가 등록되었습니다.');
            resetMeetingForm();
        }
        async function deleteWeeklyMeeting(id) {
            const meet = STATE.weeklyMeetings.find(m => m.id === id);
            if (meet && meet.filePath) { try { await sb.storage.from('documents').remove([meet.filePath]); } catch (e) {} }
            const { error } = await sb.from('weekly_meetings').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadMeetings(); renderWeeklyMeetings(); logAudit('meeting_delete', '#'+id, '');
            showToast('기록 소거', '주간 회의록이 말소되었습니다.');
        }

        // ── 대시보드 위젯 ────────────────────────────────────────────────
        function renderDashboardWidgets() {
            const isAdmin = STATE.profile.role === 'admin';
            const myDept = STATE.profile.deptId;
            const scope = (arr) => isAdmin ? arr : arr.filter(x => x.deptId === myDept);
            // 통합 알림 센터
            renderNotificationCenter();
            renderDashboardCharts();
            // 상단 통계 카드 (소속 부서 기준, 관리자는 전사)
            const stats = document.getElementById('dashboard-stats');
            if (stats) {
                const today = new Date(); const fy = today.getFullYear(), fmo = today.getMonth();
                const firstStr = formatDate(new Date(fy, fmo, 1)), lastStr = formatDate(new Date(fy, fmo + 1, 0));
                const monthEvents = scope(STATE.events).filter(e => e.endDate >= firstStr && e.startDate <= lastStr).length;
                const ongoing = scope(STATE.projects).filter(p => p.status === 'ongoing').length;
                const completed = scope(STATE.projects).filter(p => p.status === 'completed').length;
                const docCount = scope(STATE.documents).length;
                const cards = [
                    { label: isAdmin ? '이번 달 일정' : '우리 부서 이번 달 일정', value: monthEvents, icon: 'calendar-days', bg: 'bg-indigo-50', fg: 'text-indigo-600', onclick: "switchTab('calendar')" },
                    { label: '진행 중 프로젝트', value: ongoing, icon: 'loader', bg: 'bg-blue-50', fg: 'text-blue-600', onclick: "switchTab('management-progress')" },
                    { label: '완료 프로젝트', value: completed, icon: 'check-circle-2', bg: 'bg-emerald-50', fg: 'text-emerald-600', onclick: "switchTab('management-progress')" },
                    { label: '등록 보고서', value: docCount, icon: 'files', bg: 'bg-slate-100', fg: 'text-slate-600', onclick: "switchTab('documents')" }
                ];
                if (isAdmin) {
                    const pending = STATE.users.filter(u => !u.approved).length;
                    cards.push({ label: '가입 승인 대기', value: pending, icon: 'user-plus', bg: pending > 0 ? 'bg-rose-50' : 'bg-slate-100', fg: pending > 0 ? 'text-rose-600' : 'text-slate-500', onclick: "switchTab('management-stats')" });
                }
                stats.innerHTML = cards.map(c => `<div ${c.onclick ? `onclick="${c.onclick}" class="cursor-pointer"` : 'class=""'}><div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all h-full"><div class="w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0"><i data-lucide="${c.icon}" class="w-5 h-5 ${c.fg}"></i></div><div><div class="text-2xl font-extrabold text-slate-800 leading-none">${c.value}</div><div class="text-[13px] text-slate-400 font-medium mt-1">${c.label}</div></div></div></div>`).join('');
            }
            // 편지함 위젯
            const widget = document.getElementById('dashboard-mail-widget');
            if (widget) {
                widget.innerHTML = '';
                if (!STATE.mailplug.connected) {
                    widget.innerHTML = `<div class="text-center py-10 text-slate-400 text-xs"><p>사서함 인프라 미연동</p><button onclick="switchTab('mail-integration')" class="mt-3 px-3 py-1 bg-slate-900 hover:bg-indigo-600 text-white rounded-md font-bold text-[12px]">연동 허용</button></div>`;
                } else {
                    STATE.mailplug.emails.slice(0, 4).forEach(m => {
                        widget.innerHTML += `<div class="py-2.5 border-b last:border-0 text-xs cursor-pointer" onclick="switchTab('mail-integration')"><div class="flex justify-between text-[12px] text-slate-400"><span class="font-bold text-slate-600">${m.sender}</span><span>${m.time}</span></div><h5 class="font-bold text-slate-700 truncate mt-0.5">${m.subject}</h5></div>`;
                    });
                }
            }
            // 다가오는 일정 (소속 부서 기준)
            const snap = document.getElementById('dashboard-schedule-snapshot');
            if (snap) {
                snap.innerHTML = '';
                const todayStr = formatDate(new Date());
                const upcoming = scope(STATE.events).filter(e => (isAdmin ? STATE.visibility[e.deptId] : true) && e.endDate >= todayStr).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
                if (upcoming.length === 0) snap.innerHTML = `<div class="text-center py-4 text-xs text-slate-300">예정된 ${isAdmin ? '부서' : '우리 부서'} 일정이 없습니다.</div>`;
                else upcoming.forEach(e => {
                    const dept = STATE.departments.find(d => d.id === e.deptId);
                    snap.innerHTML += `<div class="py-2.5 text-xs flex justify-between items-center gap-2"><span class="flex items-center gap-2 min-w-0"><span class="px-1.5 py-0.5 border rounded text-[11px] font-bold ${dept ? dept.textTheme : 'bg-slate-100'} flex-shrink-0">${dept ? dept.name : '공통'}</span>${e.site ? `<span class="text-[11px] text-slate-400 flex-shrink-0">[${e.site}]</span>` : ''}<strong class="truncate text-slate-700">${e.title}</strong></span><span class="font-mono text-[12px] text-slate-400 flex-shrink-0">${e.startDate} ~ ${e.endDate}</span></div>`;
                });
            }
            // 프로젝트 진행 현황 (소속 부서 기준)
            const psum = document.getElementById('dashboard-project-summary');
            if (psum) {
                psum.innerHTML = '';
                const fill = { paused: 'bg-slate-400', ongoing: 'bg-blue-500', completed: 'bg-emerald-500' };
                const scoped = scope(STATE.projects);
                const active = scoped.filter(p => p.status !== 'completed').slice(0, 5);
                const list = active.length ? active : scoped.slice(0, 5);
                if (list.length === 0) psum.innerHTML = `<div class="text-center py-4 text-xs text-slate-300">등록된 프로젝트가 없습니다.</div>`;
                else list.forEach(proj => {
                    const dept = STATE.departments.find(d => d.id === proj.deptId);
                    psum.innerHTML += `<div class="space-y-1"><div class="flex justify-between items-center text-xs"><span class="font-semibold text-slate-700 truncate pr-2">${proj.title}</span><span class="font-mono font-bold text-slate-500 flex-shrink-0">${proj.progress}%</span></div><div class="flex items-center gap-2"><span class="text-[11px] text-slate-400 w-20 flex-shrink-0 truncate">${dept ? dept.name : '전사'}</span><div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${fill[proj.status] || 'bg-slate-400'} rounded-full" style="width:${proj.progress}%"></div></div></div></div>`;
                });
            }
            // 최근 등록 보고서 (소속 부서 기준)
            const rdocs = document.getElementById('dashboard-recent-docs');
            if (rdocs) {
                rdocs.innerHTML = '';
                const recent = scope(STATE.documents).slice(0, 5);
                if (recent.length === 0) rdocs.innerHTML = `<div class="text-center py-4 text-xs text-slate-300">등록된 보고서가 없습니다.</div>`;
                else recent.forEach(doc => {
                    const dept = STATE.departments.find(d => d.id === doc.deptId);
                    const clip = doc.storagePath ? `<i data-lucide="paperclip" class="w-3 h-3 inline text-blue-500"></i> ` : '';
                    rdocs.innerHTML += `<div onclick="viewDocument(${doc.id})" class="py-2 px-2 -mx-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs flex justify-between items-center gap-2"><span class="truncate flex items-center gap-1 min-w-0">${clip}<span class="truncate text-slate-700 font-medium">${doc.title}</span></span><span class="text-[11px] text-slate-400 flex-shrink-0">${dept ? dept.name : '공통'}</span></div>`;
                });
            }
            if (window.lucide) lucide.createIcons();
        }

        // ── 권한 매트릭스 ────────────────────────────────────────────────
        function renderPermissionMatrix() {
            const tbody = document.getElementById('permission-matrix-body'); if (!tbody) return; tbody.innerHTML = '';
            STATE.departments.forEach(dept => {
                const tr = document.createElement('tr'); tr.className = "text-center text-xs hover:bg-slate-50/50";
                const cState = (tab) => STATE.permissions[dept.id] && STATE.permissions[dept.id][tab] ? 'checked' : '';
                tr.innerHTML = `<td class="p-3 font-bold text-slate-800 text-left">${dept.name}</td>
                    <td><input type="checkbox" ${cState('dashboard')} onchange="togglePermission('${dept.id}','dashboard')"></td>
                    <td><input type="checkbox" ${cState('calendar')} onchange="togglePermission('${dept.id}','calendar')"></td>
                    <td><input type="checkbox" ${cState('management-progress')} onchange="togglePermission('${dept.id}','management-progress')"></td>
                    <td><input type="checkbox" ${cState('documents')} onchange="togglePermission('${dept.id}','documents')"></td>
                    <td><input type="checkbox" ${cState('mail-integration')} onchange="togglePermission('${dept.id}','mail-integration')"></td>`;
                tbody.appendChild(tr);
            });
        }
        async function togglePermission(deptId, tab) {
            if (!STATE.permissions[deptId]) STATE.permissions[deptId] = {};
            STATE.permissions[deptId][tab] = !STATE.permissions[deptId][tab];
            const { error } = await sb.from('app_settings').upsert({ key: 'permissions', value: STATE.permissions, updated_at: new Date().toISOString() });
            if (error) { STATE.permissions[deptId][tab] = !STATE.permissions[deptId][tab]; renderPermissionMatrix(); showToast('권한 저장 실패', '관리자만 권한을 변경할 수 있습니다.'); return; }
            const dept = STATE.departments.find(d => d.id === deptId);
            showToast('권한 갱신', `[${dept ? dept.name : deptId}] ${STATE.permissions[deptId][tab] ? '허용' : '차단'} 처리`);
        }

        // ── 가입 승인 / 사원 명부 / 자격 관리 ─────────────────────────────
        function renderPendingUsers() {
            const tbody = document.getElementById('pending-users-list-body'); if (!tbody) return; tbody.innerHTML = '';
            const pending = STATE.users.filter(u => !u.approved);
            if (pending.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400 font-semibold">가입 승인 요청 대기 내역이 없습니다.</td></tr>`; return; }
            pending.forEach(user => {
                const dept = STATE.departments.find(d => d.id === user.deptId);
                const tr = document.createElement('tr'); tr.className = "text-xs hover:bg-slate-50/50";
                tr.innerHTML = `<td class="p-3 font-bold">${user.email || '(이메일 미표기)'}<div class="text-[12px] text-slate-400 font-normal">${user.name}</div></td><td class="p-3">${user.position}</td><td class="p-3 font-semibold">${dept ? dept.name : '미지정'}</td><td class="p-3"><select id="assign-role-${user.id}" class="px-2 py-1 border rounded bg-white text-xs outline-none"><option value="ceo">대표이사 (CEO)</option><option value="head">부서장 (Head)</option><option value="leader">팀장 (Leader)</option><option value="employee" selected>사원 (Employee)</option><option value="admin">시스템 관리자 (Admin)</option></select></td><td class="p-3 text-right space-x-1"><button onclick="approveUser('${user.id}')" class="px-2 py-1 bg-blue-600 text-white rounded text-[12px] font-bold">승인</button><button onclick="rejectUser('${user.id}')" class="px-2 py-1 border border-slate-200 text-slate-400 rounded text-[12px]">반려</button></td>`;
                tbody.appendChild(tr);
            });
        }
        async function approveUser(id) {
            const sel = document.getElementById(`assign-role-${id}`); const r = sel ? sel.value : 'employee';
            const { error } = await sb.from('profiles').update({ approved: true, role: r }).eq('id', id);
            if (error) { showToast('승인 실패', error.message); return; }
            await reloadProfiles(); renderPendingUsers(); renderActiveUsers(); logAudit('user_approve', id, '가입 승인');
            showToast('신원 확인', '임직원 가입이 승인되었습니다.');
        }
        async function rejectUser(id) {
            const { error } = await sb.from('profiles').delete().eq('id', id);
            if (error) { showToast('반려 실패', error.message); return; }
            await reloadProfiles(); renderPendingUsers(); logAudit('user_reject', id, '가입 반려'); showToast('기각', '가입 신청을 반려했습니다.');
        }
        const ROLE_OPTIONS = [['ceo', '대표이사'], ['head', '부서장'], ['leader', '팀장'], ['employee', '사원'], ['admin', '관리자']];
        function renderActiveUsers() {
            const tbody = document.getElementById('active-users-list-body'); if (!tbody) return; tbody.innerHTML = '';
            const approvedUsers = STATE.users.filter(u => u.approved);
            if (approvedUsers.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-slate-400 font-semibold">활동 중인 임직원이 없습니다.</td></tr>`; return; }
            approvedUsers.forEach(user => {
                const isSelf = STATE.currentUser && STATE.currentUser.id === user.id;
                const tr = document.createElement('tr'); tr.className = "text-xs hover:bg-slate-50/50 transition-colors align-middle";
                const deptOpts = STATE.departments.map(d => `<option value="${d.id}" ${d.id === user.deptId ? 'selected' : ''}>${d.name}</option>`).join('');
                const roleOpts = ROLE_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === user.role ? 'selected' : ''}>${l}</option>`).join('');
                const termBtn = isSelf ? `<span class="text-[11px] text-emerald-600 font-bold px-2 py-1 bg-emerald-50 rounded-md border border-emerald-200">본인</span>`
                    : `<button onclick="terminateUser('${user.id}')" class="px-2 py-1 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white rounded text-[12px] font-bold transition-all">해지</button>`;
                tr.innerHTML = `
                    <td class="p-3 font-bold text-slate-700">${user.email || '(미표기)'}</td>
                    <td class="p-3"><input id="edit-name-${user.id}" value="${esc(user.name) || ''}" class="w-24 px-2 py-1 border rounded-md text-[13px] font-semibold outline-none focus:border-indigo-400"></td>
                    <td class="p-3"><select id="edit-dept-${user.id}" class="px-2 py-1 border rounded-md bg-white text-[13px] outline-none focus:border-indigo-400">${deptOpts}</select></td>
                    <td class="p-3"><select id="edit-role-${user.id}" class="px-2 py-1 border rounded-md bg-white text-[13px] outline-none focus:border-indigo-400">${roleOpts}</select></td>
                    <td class="p-3"><input id="edit-pos-${user.id}" value="${esc(user.position) || ''}" class="w-20 px-2 py-1 border rounded-md text-[13px] outline-none focus:border-indigo-400"></td>
                    <td class="p-3 text-right whitespace-nowrap"><button onclick="saveUserEdits('${user.id}')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[12px] font-bold mr-1.5 shadow-sm">저장</button>${termBtn}</td>`;
                tbody.appendChild(tr);
            });
        }
        async function saveUserEdits(id) {
            const deptEl = document.getElementById(`edit-dept-${id}`), roleEl = document.getElementById(`edit-role-${id}`), posEl = document.getElementById(`edit-pos-${id}`), nameEl = document.getElementById(`edit-name-${id}`);
            if (!deptEl || !roleEl || !posEl) return;
            const dept = deptEl.value, role = roleEl.value, pos = posEl.value.trim() || '사원';
            const name = nameEl ? nameEl.value.trim() : '';
            if (nameEl && !name) { showToast('입력 필요', '임직원 명을 입력하세요.'); return; }
            const isSelf = STATE.currentUser && STATE.currentUser.id === id;
            if (isSelf && role !== 'admin') { if (!confirm('본인 계정의 관리자 권한을 해제하면 관리 기능을 즉시 잃게 됩니다. 계속할까요?')) { renderActiveUsers(); return; } }
            const patch = { dept_id: dept, role, position: pos };
            if (name) patch.name = name;
            const { error } = await sb.from('profiles').update(patch).eq('id', id);
            if (error) { showToast('저장 실패', error.message); return; }
            await reloadProfiles(); renderActiveUsers(); renderPendingUsers(); renderDashboardWidgets();
            if (isSelf) {
                STATE.currentUser.role = role; STATE.currentUser.deptId = dept; STATE.currentUser.position = pos; if (name) STATE.currentUser.name = name;
                STATE.profile.role = role; STATE.profile.deptId = dept; if (name) STATE.profile.name = name;
                refreshRoleScopedUI(); updateProfileUI(); if (role !== 'admin') switchTab('dashboard');
            }
            logAudit('user_edit', (STATE.users.find(u=>u.id===id)||{}).name || id, `부서 ${dept} · 등급 ${role} · 직급 ${pos}`);
            showToast('정보 갱신', '임직원 정보가 수정되었습니다. (모든 접속자에게 실시간 반영)');
        }
        async function terminateUser(id) {
            const user = STATE.users.find(u => u.id === id); const name = user ? user.name : '해당 사원';
            if (!confirm(`[보안 통제] 임직원 [${name}]의 포탈 접속 자격을 회수하고 명부에서 제명하시겠습니까?`)) return;
            const { error } = await sb.from('profiles').delete().eq('id', id);
            if (error) { showToast('해지 실패', error.message); return; }
            logAudit('user_terminate', name, '');
            await reloadProfiles(); renderActiveUsers(); renderPendingUsers(); showToast('자격 해지', `[${name}] 계정의 접속 권한이 회수되었습니다.`);
        }
        async function handleUpdateAdminPassword(e) {
            e.preventDefault();
            const oldPw = document.getElementById('admin-old-pw').value;
            const newPw = document.getElementById('admin-new-pw').value;
            const confirmPw = document.getElementById('admin-new-pw-confirm').value;
            if (newPw !== confirmPw) { showToast('일치성 위배', '새 비밀번호가 서로 일치하지 않습니다.'); return; }
            if (newPw.length < 6) { showToast('강도 부족', '비밀번호는 6자 이상이어야 합니다.'); return; }
            if (!STATE.currentUser) { showToast('오류', '로그인이 필요합니다.'); return; }
            const { error: signErr } = await sb.auth.signInWithPassword({ email: STATE.currentUser.email, password: oldPw });
            if (signErr) { showToast('비밀번호 불일치', '현재 비밀번호가 올바르지 않습니다.'); return; }
            const { error } = await sb.auth.updateUser({ password: newPw });
            if (error) { showToast('변경 실패', error.message); return; }
            showToast('변경 성료', '보안 비밀번호가 성공적으로 갱신되었습니다.');
            document.getElementById('admin-old-pw').value = ''; document.getElementById('admin-new-pw').value = ''; document.getElementById('admin-new-pw-confirm').value = '';
        }

        // ── 인증 탭 전환 ─────────────────────────────────────────────────
        function switchAuthTab(type) {
            const loginBtn = document.getElementById('auth-tab-login');
            const signupBtn = document.getElementById('auth-tab-signup');
            const loginForm = document.getElementById('auth-login-form');
            const signupForm = document.getElementById('auth-signup-form');
            if (type === 'login') {
                if (loginBtn) loginBtn.className = "flex-1 pb-1.5 text-center text-xs font-bold text-slate-800 border-b-2 border-slate-950 transition-all";
                if (signupBtn) signupBtn.className = "flex-1 pb-1.5 text-center text-xs font-semibold text-slate-400 border-b-2 border-transparent transition-all";
                if (loginForm) loginForm.classList.remove('hidden');
                if (signupForm) signupForm.classList.add('hidden');
            } else {
                if (signupBtn) signupBtn.className = "flex-1 pb-1.5 text-center text-xs font-bold text-slate-800 border-b-2 border-slate-950 transition-all";
                if (loginBtn) loginBtn.className = "flex-1 pb-1.5 text-center text-xs font-semibold text-slate-400 border-b-2 border-transparent transition-all";
                if (signupForm) signupForm.classList.remove('hidden');
                if (loginForm) loginForm.classList.add('hidden');
            }
        }

        // ── 동적 기능 임베딩 (DB 영구 저장 · 관리자 전용 · 그룹 배치) ──────
        const FEATURE_ICONS = ['rocket', 'wrench', 'bar-chart-3', 'line-chart', 'pie-chart', 'calculator', 'bot', 'database', 'globe', 'calendar-clock', 'clipboard-list', 'cpu', 'kanban', 'notebook-pen', 'megaphone', 'shield', 'wallet', 'package', 'map', 'sparkles', 'gauge', 'table', 'book-open', 'briefcase'];
        const NATIVE_GROUPS = [
            { title: '기본 플랫폼 서비스', container: 'navgroup-platform' },
            { title: '문서 / 보고서 분류', container: 'navgroup-docs' },
            { title: '그룹웨어 인프라', container: 'navgroup-groupware' },
            { title: '시스템 관리자', container: 'navgroup-admin' }
        ];
        function renderFeatureIconGrid() {
            const grid = document.getElementById('feature-icon-grid'); if (!grid) return;
            const cur = document.getElementById('feature-icon').value;
            grid.innerHTML = FEATURE_ICONS.map(ic => `<button type="button" onclick="selectFeatureIcon('${ic}')" data-icon="${ic}" class="feature-icon-opt h-9 rounded-lg border flex items-center justify-center transition-all ${ic === cur ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}"><i data-lucide="${ic}" class="w-4 h-4"></i></button>`).join('');
            if (window.lucide) lucide.createIcons();
        }
        function selectFeatureIcon(ic) { document.getElementById('feature-icon').value = ic; renderFeatureIconGrid(); }
        function renderFeatureGroupSelect() {
            const sel = document.getElementById('feature-group'); if (!sel) return;
            const titles = NATIVE_GROUPS.map(g => g.title);
            (STATE.customFeatures || []).forEach(f => { if (f.group && !titles.includes(f.group)) titles.push(f.group); });
            sel.innerHTML = titles.map(t => `<option value="${t}">${t}</option>`).join('') + `<option value="__new__">＋ 새 대분류 직접 생성</option>`;
            toggleFeatureGroupNew();
        }
        function toggleFeatureGroupNew() {
            const sel = document.getElementById('feature-group'), inp = document.getElementById('feature-group-new');
            if (!sel || !inp) return; inp.classList.toggle('hidden', sel.value !== '__new__');
        }
        function handleFeatureFileSelection(e) {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader(); r.onload = (evt) => { STATE.uploadedFeatureHtml = evt.target.result; document.getElementById('feature-file-status').innerText = `로드 완료: ${f.name}`; }; r.readAsText(f);
        }
        async function handleInstallFeature(e) {
            e.preventDefault();
            if (STATE.profile.role !== 'admin') { showToast('권한 없음', '시스템 기능 추가는 관리자 전용입니다.'); return; }
            const name = document.getElementById('feature-name').value.trim();
            const icon = document.getElementById('feature-icon').value || 'rocket';
            const sel = document.getElementById('feature-group');
            let group = sel ? sel.value : '기본 플랫폼 서비스';
            if (group === '__new__') { group = document.getElementById('feature-group-new').value.trim(); if (!group) { showToast('입력 필요', '새 대분류 이름을 입력하세요.'); return; } }
            const pasted = document.getElementById('feature-code').value.trim();
            const html = STATE.uploadedFeatureHtml || pasted;
            if (!name) { showToast('입력 필요', '기능(탭) 명칭을 입력하세요.'); return; }
            if (!html) { showToast('입력 필요', 'HTML 파일을 업로드하거나 코드를 붙여넣으세요.'); return; }
            let next, savedId;
            if (STATE.editingFeatureId) {
                savedId = STATE.editingFeatureId;
                next = STATE.customFeatures.map(f => f.id === savedId ? { ...f, name, icon, group, html } : f);
            } else {
                const feat = { id: 'custom_' + Date.now(), name, icon, group, html };
                savedId = feat.id;
                next = [...STATE.customFeatures, feat];
            }
            const { error } = await sb.from('app_settings').upsert({ key: 'custom_features', value: next, updated_at: new Date().toISOString() });
            if (error) { showToast('배포 실패', error.message); return; }
            const wasEditing = !!STATE.editingFeatureId;
            STATE.customFeatures = next;
            renderCustomFeaturesMenu(); closeModal('add-feature-modal');
            logAudit(wasEditing ? 'feature_edit' : 'feature_deploy', name, group); showToast(wasEditing ? '수정 완료' : '배포 완료', `[${group} › ${name}] 기능이 ${wasEditing ? '수정' : '생성'}되어 전 임직원에게 적용되었습니다.`);
            document.getElementById('feature-name').value = ''; document.getElementById('feature-code').value = '';
            const gnew = document.getElementById('feature-group-new'); if (gnew) gnew.value = '';
            STATE.uploadedFeatureHtml = null; const fst = document.getElementById('feature-file-status'); if (fst) fst.innerText = '클릭하여 .html 파일 업로드';
            STATE.editingFeatureId = null;
            launchCustomFeature(savedId);
        }
        function openAddFeatureFresh() {
            STATE.editingFeatureId = null;
            const title = document.getElementById('feature-modal-title'); if (title) title.innerText = '시스템 기능(탭) 추가 · 관리자 전용';
            const submit = document.getElementById('feature-submit-btn'); if (submit) submit.innerText = '탭 생성 및 기능 배포';
            document.getElementById('feature-name').value = ''; document.getElementById('feature-code').value = '';
            document.getElementById('feature-icon').value = 'rocket';
            STATE.uploadedFeatureHtml = null;
            const fst = document.getElementById('feature-file-status'); if (fst) fst.innerText = '클릭하여 .html 파일 업로드';
            openModal('add-feature-modal');
        }
        function openEditFeature() {
            if (STATE.profile.role !== 'admin') { showToast('권한 없음', '관리자 전용 기능입니다.'); return; }
            const id = STATE.currentCustomId; const feat = STATE.customFeatures.find(f => f.id === id); if (!feat) return;
            STATE.editingFeatureId = id;
            openModal('add-feature-modal');
            const title = document.getElementById('feature-modal-title'); if (title) title.innerText = `기능 편집 · ${feat.name}`;
            const submit = document.getElementById('feature-submit-btn'); if (submit) submit.innerText = '수정 내용 저장 및 배포';
            document.getElementById('feature-name').value = feat.name || '';
            document.getElementById('feature-icon').value = feat.icon || 'rocket'; renderFeatureIconGrid();
            const sel = document.getElementById('feature-group');
            if (sel) { const has = [...sel.options].some(o => o.value === feat.group); sel.value = has ? feat.group : feat.group; toggleFeatureGroupNew(); }
            document.getElementById('feature-code').value = feat.html || '';
            STATE.uploadedFeatureHtml = null;
            const fst = document.getElementById('feature-file-status'); if (fst) fst.innerText = '현재 코드를 수정하거나, 새 .html 파일로 교체 업로드';
        }
        function makeFeatureButton(feat) {
            const btn = document.createElement('button'); btn.id = `nav-${feat.id}`; btn.className = "sidebar-item custom-feat-btn"; btn.onclick = () => launchCustomFeature(feat.id);
            btn.innerHTML = `<i data-lucide="${feat.icon || 'rocket'}" class="w-4 h-4 text-blue-500"></i><span class="font-medium text-slate-700">${feat.name}</span>`;
            return btn;
        }
        function renderCustomFeaturesMenu() {
            document.querySelectorAll('.custom-feat-btn').forEach(b => b.remove());
            const host = document.getElementById('custom-features-group');
            const hostInner = document.getElementById('custom-menu-container');
            if (host) host.classList.add('hidden');
            if (hostInner) hostInner.innerHTML = '';
            if (!STATE.customFeatures || STATE.customFeatures.length === 0) return;
            const nativeByTitle = {}; NATIVE_GROUPS.forEach(g => nativeByTitle[g.title] = g.container);
            const groups = {};
            STATE.customFeatures.forEach(f => { const g = f.group || '확장 기능 모듈'; (groups[g] = groups[g] || []).push(f); });
            let hasHostGroups = false;
            Object.keys(groups).forEach(title => {
                if (nativeByTitle[title]) {
                    const cont = document.getElementById(nativeByTitle[title]); if (!cont) return;
                    groups[title].forEach(f => cont.appendChild(makeFeatureButton(f)));
                } else {
                    hasHostGroups = true;
                    const block = document.createElement('div');
                    block.innerHTML = `<p class="sidebar-group-title flex items-center gap-1"><i data-lucide="blocks" class="w-3 h-3 text-slate-400"></i><span>${title}</span></p>`;
                    const list = document.createElement('div'); list.className = 'space-y-1';
                    groups[title].forEach(f => list.appendChild(makeFeatureButton(f)));
                    block.appendChild(list); if (hostInner) hostInner.appendChild(block);
                }
            });
            if (host) host.classList.toggle('hidden', !hasHostGroups);
            if (window.lucide) lucide.createIcons();
        }
        function launchCustomFeature(id) {
            const feat = STATE.customFeatures.find(f => f.id === id);
            if (!feat) { showToast('알림', '해당 기능을 찾을 수 없습니다.'); switchTab('dashboard'); return; }
            STATE.currentTab = id; STATE.currentCustomId = id;
            const isAdmin = STATE.profile.role === 'admin';
            document.getElementById('main-content-sections').classList.remove('hidden');
            document.getElementById('maintenance-overlay').classList.add('hidden');
            document.getElementById('access-denied-overlay').classList.add('hidden');
            document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
            syncSidebarActiveState(id);
            const badge = document.getElementById('tab-maintenance-badge'); if (badge) badge.classList.toggle('hidden', !STATE.maintenance[id]);
            const mb = document.getElementById('maintenance-btn-text'); if (mb) mb.innerText = STATE.maintenance[id] ? '점검 해제하기' : '현재 메뉴 점검 설정';
            // 비관리자 점검 차단 (기존 탭과 동일)
            if (!isAdmin && STATE.maintenance[id]) {
                document.getElementById('main-content-sections').classList.add('hidden');
                document.getElementById('maintenance-overlay').classList.remove('hidden');
                if (window.lucide) lucide.createIcons();
                return;
            }
            const customView = document.getElementById('view-custom-feature'); if (customView) customView.classList.remove('hidden');
            document.getElementById('view-title').innerText = feat.name;
            document.getElementById('view-description').innerText = `관리자가 탑재한 확장 기능 · ${feat.group || '확장 기능'}`;
            const head = document.getElementById('custom-feature-headline'); if (head) head.innerText = feat.name;
            const iframe = document.getElementById('custom-feature-iframe');
            if (iframe) {
                try {
                    if (STATE._featBlob) { URL.revokeObjectURL(STATE._featBlob); STATE._featBlob = null; }
                    if (window.URL && URL.createObjectURL && typeof Blob !== 'undefined') {
                        const blob = new Blob([feat.html], { type: 'text/html' });
                        const u = URL.createObjectURL(blob); STATE._featBlob = u;
                        iframe.removeAttribute('srcdoc'); iframe.src = u;
                    } else { iframe.removeAttribute('src'); iframe.srcdoc = feat.html; }
                } catch (err) { try { iframe.removeAttribute('src'); iframe.srcdoc = feat.html; } catch (e2) {} }
            }
            const delBtn = document.getElementById('custom-feature-delete-btn'); if (delBtn) delBtn.classList.toggle('hidden', !isAdmin);
            const editBtn = document.getElementById('custom-feature-edit-btn'); if (editBtn) editBtn.classList.toggle('hidden', !isAdmin);
            if (window.lucide) lucide.createIcons();
        }
        async function removeCustomFeature() {
            if (STATE.profile.role !== 'admin') return;
            const id = STATE.currentCustomId; const feat = STATE.customFeatures.find(f => f.id === id); if (!feat) return;
            if (!confirm(`확장 기능 [${feat.name}] 탭을 제거하시겠습니까? 전 임직원 화면에서 사라집니다.`)) return;
            const next = STATE.customFeatures.filter(f => f.id !== id);
            const { error } = await sb.from('app_settings').upsert({ key: 'custom_features', value: next, updated_at: new Date().toISOString() });
            if (error) { showToast('제거 실패', error.message); return; }
            STATE.customFeatures = next; renderCustomFeaturesMenu(); switchTab('dashboard'); logAudit('feature_remove', (feat&&feat.name)||'', '');
            showToast('기능 제거', `[${feat.name}] 탭이 제거되었습니다.`);
        }

        // ── 현장 지원 / AS 티켓 관리 ─────────────────────────────────────
        const TICKET_STATUS = { received: ['접수', 'neutral'], in_progress: ['진행중', 'info'], hold: ['보류', 'warn'], done: ['완료', 'success'] };
        const TICKET_URGENCY = { low: ['낮음', 'neutral'], normal: ['보통', 'info'], high: ['높음', 'warn'], critical: ['긴급', 'critical'] };
        function ticketStatusBadge(s) { const v = TICKET_STATUS[s] || TICKET_STATUS.received; return chip(v[0], v[1]); }
        function ticketUrgencyBadge(u) { const v = TICKET_URGENCY[u] || TICKET_URGENCY.normal; return chip(v[0], v[1]); }
        function canManageTicket(t) { return STATE.profile.role === 'admin' || t.deptId === STATE.profile.deptId || (t.author || '').trim() === (STATE.profile.name || '').trim(); }
        function renderTickets() {
            const body = document.getElementById('ticket-list-body'); if (!body) return;
            const cardBox = document.getElementById('ticket-card-list');
            const statsBox = document.getElementById('ticket-stats');
            if (STATE.ticketsTableMissing) {
                body.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 text-sm">AS 티켓 테이블이 아직 생성되지 않았습니다. 안내된 SQL을 실행한 뒤 새로고침하세요.</td></tr>`;
                if (statsBox) statsBox.innerHTML = ''; return;
            }
            const all = STATE.tickets || [];
            if (statsBox) {
                const cnt = (s) => all.filter(t => t.status === s).length;
                const cards = [['received', '접수', 'text-slate-600'], ['in_progress', '진행중', 'text-blue-600'], ['hold', '보류', 'text-amber-600'], ['done', '완료', 'text-emerald-600']];
                statsBox.innerHTML = cards.map(([k, l, c]) => `<div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><div class="text-2xl font-extrabold ${c}">${cnt(k)}</div><div class="text-[13px] text-slate-400 font-medium mt-0.5">${l}</div></div>`).join('');
            }
            const q = (document.getElementById('ticket-search') || {}).value || '';
            const fs = (document.getElementById('ticket-filter-status') || {}).value || 'all';
            const fu = (document.getElementById('ticket-filter-urgency') || {}).value || 'all';
            const fd = (document.getElementById('ticket-filter-dept') || {}).value || 'all';
            const ql = q.trim().toLowerCase();
            const list = all.filter(t => {
                if (fs !== 'all' && t.status !== fs) return false;
                if (fu !== 'all' && t.urgency !== fu) return false;
                if (fd !== 'all' && t.deptId !== fd) return false;
                if (ql) { const hay = `${t.customer || ''} ${t.site || ''} ${t.equipment || ''} ${t.issue || ''} ${t.assignee || ''}`.toLowerCase(); if (hay.indexOf(ql) < 0) return false; }
                return true;
            });
            if (list.length === 0) { body.innerHTML = emptyCell(7, 'wrench', '표시할 AS 티켓이 없습니다', '새 AS를 접수하거나 상단 필터 조건을 바꿔보세요.'); if (cardBox) cardBox.innerHTML = `<div class="sm:col-span-2">${emptyState('wrench', '표시할 AS 티켓이 없습니다', '새 AS를 접수하거나 상단 필터 조건을 바꿔보세요.', true)}</div>`; if (window.lucide) lucide.createIcons(); return; }
            body.innerHTML = list.slice(0, pageCount('tickets')).map(t => {
                const dept = STATE.departments.find(d => d.id === t.deptId);
                const photoBadge = (t.photos && t.photos.length) ? `<span class="ml-1 text-[12px] text-slate-400"><i data-lucide="image" class="w-3 h-3 inline"></i> ${t.photos.length}</span>` : '';
                const date = (t.createdAt || '').slice(0, 10);
                return `<tr class="hover:bg-rose-50/30 transition-colors cursor-pointer align-top" onclick="openTicketDetail(${t.id})">
                    <td class="px-4 py-3">${ticketUrgencyBadge(t.urgency)}</td>
                    <td class="px-4 py-3"><div class="font-bold text-slate-800">${esc(t.customer) || '-'}</div><div class="text-[12px] text-slate-400">${esc(t.site) || ''}</div></td>
                    <td class="px-4 py-3"><div class="font-semibold text-slate-700">${esc(t.equipment) || '-'}</div><div class="text-[12px] text-slate-500 truncate max-w-[260px]">${esc(t.issue) || ''}${photoBadge}</div></td>
                    <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${esc(t.assignee) || '-'}<div class="text-[12px] text-slate-400">${dept ? dept.name : ''}</div></td>
                    <td class="px-4 py-3">${ticketStatusBadge(t.status)}</td>
                    <td class="px-4 py-3 text-slate-400 font-mono text-[13px] whitespace-nowrap">${date}</td>
                    <td class="px-4 py-3 text-right whitespace-nowrap text-[13px]" onclick="event.stopPropagation()">${canManageTicket(t) ? `<button onclick="openTicketForm(${t.id})" class="text-indigo-500 hover:text-indigo-700 font-bold mr-2">편집</button><button onclick="deleteTicket(${t.id})" class="text-rose-400 hover:text-rose-600 font-bold">삭제</button>` : '<span class="text-slate-300">열람</span>'}</td>
                </tr>`;
            }).join('');
            body.insertAdjacentHTML('beforeend', moreRowHTML(list.length, 'tickets', 7));
            if (cardBox) {
                cardBox.innerHTML = list.slice(0, pageCount('tickets')).map(t => {
                    const dept = STATE.departments.find(d => d.id === t.deptId);
                    const photoBadge = (t.photos && t.photos.length) ? ` <span class="text-[12px] text-slate-400"><i data-lucide="image" class="w-3 h-3 inline"></i> ${t.photos.length}</span>` : '';
                    const date = (t.createdAt || '').slice(0, 10);
                    return `<div onclick="openTicketDetail(${t.id})" class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 cursor-pointer active:bg-rose-50/40">
                        <div class="flex items-center justify-between gap-2 mb-2">${ticketUrgencyBadge(t.urgency)}${ticketStatusBadge(t.status)}</div>
                        <div class="font-bold text-slate-800 break-keep">${esc(t.customer) || '-'}</div>
                        <div class="text-[12px] text-slate-500 mb-2">${esc(t.site) || ''}</div>
                        <div class="font-semibold text-slate-700 text-[13px] break-keep">${esc(t.equipment) || '-'}</div>
                        <div class="text-[12px] text-slate-500 break-keep mt-0.5">${esc(t.issue) || ''}${photoBadge}</div>
                        <div class="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100">
                            <div class="text-[12px] text-slate-500 break-keep">${esc(t.assignee) || '-'}${dept ? ' · ' + dept.name : ''}</div>
                            <div class="text-[12px] text-slate-400 font-mono flex-shrink-0">${date}</div>
                        </div>
                        ${canManageTicket(t) ? `<div class="flex gap-2 mt-2.5" onclick="event.stopPropagation()">
                            <button onclick="openTicketForm(${t.id})" class="flex-1 py-2 rounded-lg border border-slate-200 text-indigo-600 font-bold text-[13px]">편집</button>
                            <button onclick="deleteTicket(${t.id})" class="flex-1 py-2 rounded-lg border border-slate-200 text-rose-500 font-bold text-[13px]">삭제</button>
                        </div>` : ''}
                    </div>`;
                }).join('');
                const moreT = moreDivHTML(list.length, 'tickets');
                if (moreT) cardBox.insertAdjacentHTML('beforeend', `<div class="sm:col-span-2">${moreT}</div>`);
            }
            if (window.lucide) lucide.createIcons();
        }
        function ticketsApplyFilter() { resetPage('tickets'); renderTickets(); }
        function handleTicketPhotoSelection(e) {
            STATE.ticketForm = STATE.ticketForm || { keep: [], add: [] };
            [...e.target.files].forEach(f => STATE.ticketForm.add.push(f));
            renderTicketPhotoChips();
            e.target.value = '';
        }
        function removeTicketKeepPhoto(i) { STATE.ticketForm.keep.splice(i, 1); renderTicketPhotoChips(); }
        function removeTicketAddPhoto(i) { STATE.ticketForm.add.splice(i, 1); renderTicketPhotoChips(); }
        function renderTicketPhotoChips() {
            const box = document.getElementById('ticket-photo-chips'); if (!box) return;
            const f = STATE.ticketForm || { keep: [], add: [] };
            const chips = [];
            f.keep.forEach((p, i) => chips.push(`<span class="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[12px]"><i data-lucide="paperclip" class="w-3 h-3"></i>${esc(p.name) || '파일'}<button type="button" onclick="removeTicketKeepPhoto(${i})" class="text-rose-400 hover:text-rose-600 font-bold ml-0.5">×</button></span>`));
            f.add.forEach((file, i) => chips.push(`<span class="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-[12px] text-indigo-700"><i data-lucide="plus" class="w-3 h-3"></i>${esc(file.name)}<button type="button" onclick="removeTicketAddPhoto(${i})" class="text-rose-400 hover:text-rose-600 font-bold ml-0.5">×</button></span>`));
            box.innerHTML = chips.join('') || '<span class="text-[12px] text-slate-300">첨부된 사진/파일 없음</span>';
            const st = document.getElementById('ticket-photo-status'); if (st) st.innerText = `클릭하여 사진/파일 추가 (${f.keep.length + f.add.length}개 첨부됨)`;
            if (window.lucide) lucide.createIcons();
        }
        function openTicketForm(id) {
            if (STATE.ticketsTableMissing) { showToast('준비 필요', 'AS 티켓 테이블 생성 SQL을 먼저 실행하세요.'); return; }
            const t = id ? STATE.tickets.find(x => x.id === id) : null;
            if (t && !canManageTicket(t)) { showToast('권한 없음', '본인 부서 또는 등록자만 편집할 수 있습니다.'); return; }
            document.getElementById('ticket-id').value = id || '';
            document.getElementById('ticket-customer').value = t ? (t.customer || '') : '';
            document.getElementById('ticket-site').value = t ? (t.site || '') : '';
            document.getElementById('ticket-equipment').value = t ? (t.equipment || '') : '';
            fillPersonSelect('ticket-assignee-select', 'ticket-assignee-custom', t ? t.assigneeId : (STATE.currentUser ? STATE.currentUser.id : ''), t ? t.assignee : (STATE.profile.name || ''));
            document.getElementById('ticket-urgency').value = t ? (t.urgency || 'normal') : 'normal';
            document.getElementById('ticket-status').value = t ? (t.status || 'received') : 'received';
            document.getElementById('ticket-issue').value = t ? (t.issue || '') : '';
            document.getElementById('ticket-result').value = t ? (t.result || '') : '';
            const dsel = document.getElementById('ticket-dept'); if (dsel) dsel.value = t ? (t.deptId || STATE.profile.deptId) : (STATE.profile.deptId || 'south_cs');
            document.getElementById('ticket-form-title').innerText = id ? 'AS 티켓 편집' : 'AS 티켓 등록';
            STATE.ticketForm = { keep: t ? (t.photos || []).slice() : [], add: [] };
            renderTicketPhotoChips();
            openModal('ticket-form-modal');
        }
        async function handleSaveTicket(e) {
            e.preventDefault();
            const id = document.getElementById('ticket-id').value;
            const f = STATE.ticketForm || { keep: [], add: [] };
            const photos = f.keep.slice();
            for (const file of f.add) {
                const path = safeStorageKey(file.name, 'tickets/');
                const { error: upErr } = await sb.storage.from('documents').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
                if (upErr) { showToast('사진 업로드 실패', upErr.message); return; }
                photos.push({ path, name: file.name, mime: file.type || '' });
            }
            const _ta = readPerson('ticket-assignee-select', 'ticket-assignee-custom');
            const row = {
                customer: document.getElementById('ticket-customer').value.trim(),
                site: document.getElementById('ticket-site').value.trim(),
                equipment: document.getElementById('ticket-equipment').value.trim(),
                assignee: _ta.name, assignee_id: _ta.id,
                urgency: document.getElementById('ticket-urgency').value,
                status: document.getElementById('ticket-status').value,
                issue: document.getElementById('ticket-issue').value.trim(),
                result: document.getElementById('ticket-result').value.trim(),
                dept_id: document.getElementById('ticket-dept').value,
                photos, updated_at: new Date().toISOString()
            };
            let error;
            if (id) { ({ error } = await sb.from('tickets').update(row).eq('id', parseInt(id))); }
            else { row.author = STATE.profile.name; ({ error } = await sb.from('tickets').insert(row)); }
            if (error) { showToast('저장 실패', error.message); return; }
            STATE.ticketForm = { keep: [], add: [] };
            await reloadTickets(); renderTickets(); renderDashboardWidgets(); closeModal('ticket-form-modal');
            if (id && !document.getElementById('ticket-detail-modal').classList.contains('hidden')) openTicketDetail(parseInt(id));
            showToast('저장 완료', id ? 'AS 티켓이 수정되었습니다.' : 'AS 티켓이 접수되었습니다.');
        }
        async function openTicketDetail(id) {
            const t = STATE.tickets.find(x => x.id === id); if (!t) return;
            STATE._openDetail = { type: 'ticket', id };
            const dept = STATE.departments.find(d => d.id === t.deptId);
            const manage = canManageTicket(t);
            const field = (label, val, pre) => `<div><div class="text-[12px] font-bold text-slate-400 mb-0.5">${label}</div><div class="text-sm text-slate-700 ${pre ? 'whitespace-pre-line leading-relaxed' : 'font-semibold'}">${esc(val) || '-'}</div></div>`;
            const statusBtns = manage ? `<div class="flex gap-1.5 flex-wrap">${Object.keys(TICKET_STATUS).map(s => `<button onclick="setTicketStatus(${t.id},'${s}')" class="px-2.5 py-1 rounded-lg text-[12px] font-bold border ${t.status === s ? CHIP_TONES[TICKET_STATUS[s][1]] : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}">${TICKET_STATUS[s][0]}</button>`).join('')}</div>` : ticketStatusBadge(t.status);
            const ctrl = manage ? `<div class="flex gap-2"><button onclick="openTicketForm(${t.id})" class="px-3 py-2 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"><i data-lucide="pencil" class="w-3.5 h-3.5"></i> 편집</button><button onclick="deleteTicket(${t.id}); closeModal('ticket-detail-modal')" class="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg">삭제</button></div>` : '';
            document.getElementById('ticket-detail-body').innerHTML = `
                <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                    <div class="flex items-start justify-between gap-3 flex-wrap">
                        <div class="space-y-2">
                            <div class="flex items-center gap-2 flex-wrap">${ticketUrgencyBadge(t.urgency)}<span class="px-2 py-0.5 border rounded-md text-[12px] font-bold ${dept ? dept.textTheme : 'bg-slate-100'}">${dept ? dept.name : '전사'}</span><span class="text-[12px] text-slate-400 font-mono">${(t.createdAt || '').slice(0, 10)}</span></div>
                            <h3 class="text-xl font-extrabold text-slate-800">${esc(t.customer) || '(고객사 미지정)'} ${t.site ? '· ' + esc(t.site) : ''}</h3>
                        </div>
                        ${ctrl}
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        ${field('장비명', t.equipment)}
                        ${field('담당자', t.assignee)}
                        <div><div class="text-[12px] font-bold text-slate-400 mb-1">처리 상태</div>${statusBtns}</div>
                        ${field('접수자', t.author)}
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${field('장애 내용', t.issue, true)}
                        ${field('처리 결과', t.result, true)}
                    </div>
                </div>
                <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
                    <h4 class="font-bold text-sm text-slate-700 flex items-center gap-2"><i data-lucide="image" class="w-4 h-4 text-rose-500"></i> 현장 사진 / 첨부 (${(t.photos || []).length})</h4>
                    <div id="ticket-photo-gallery" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>
                </div>
                <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <h4 class="font-bold text-sm text-slate-700 flex items-center gap-2"><i data-lucide="clipboard-check" class="w-4 h-4 text-emerald-600"></i> 작업 · 정비 완료 보고서 (<span id="ticket-report-count">${reportsForTicket(t.id).length}</span>)</h4>
                        ${manage ? `<button onclick="openReportForm(null, ${t.id})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5"><i data-lucide="plus" class="w-3.5 h-3.5"></i> 보고서 작성</button>` : ''}
                    </div>
                    <div id="ticket-report-list">${renderReportListHTML(t.id, manage)}</div>
                </div>`;
            openModal('ticket-detail-modal'); if (window.lucide) lucide.createIcons();
            renderTicketPhotoGallery(t);
        }
        async function renderTicketPhotoGallery(t) {
            const box = document.getElementById('ticket-photo-gallery'); if (!box) return;
            const photos = t.photos || [];
            if (photos.length === 0) { box.innerHTML = '<span class="text-[13px] text-slate-300">첨부된 사진이 없습니다.</span>'; return; }
            box.innerHTML = photos.map((p, i) => `<div id="tphoto-${t.id}-${i}" class="relative h-32 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer"><span class="inline-block w-5 h-5 border-2 border-slate-300 border-t-rose-500 rounded-full animate-spin"></span></div>`).join('');
            for (let i = 0; i < photos.length; i++) {
                const p = photos[i]; const cell = document.getElementById(`tphoto-${t.id}-${i}`); if (!cell) continue;
                try {
                    const { data, error } = await sb.storage.from('documents').createSignedUrl(p.path, 3600);
                    if (error || !data) throw new Error('url');
                    const url = data.signedUrl; const ext = (p.name && p.name.indexOf('.') >= 0) ? p.name.split('.').pop().toLowerCase() : '';
                    const isImg = (p.mime || '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext);
                    cell.onclick = () => openFilePreview(p.name || '첨부', url, p.mime || '', ext);
                    cell.innerHTML = isImg ? `<img src="${url}" class="w-full h-full object-cover">` : fileIconHTML(ext);
                } catch (e) { cell.innerHTML = fileIconHTML(''); }
            }
            if (window.lucide) lucide.createIcons();
        }
        async function setTicketStatus(id, status) {
            const t = STATE.tickets.find(x => x.id === id); if (!t || !canManageTicket(t)) { showToast('권한 없음', '상태를 변경할 수 없습니다.'); return; }
            const { error } = await sb.from('tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
            if (error) { showToast('변경 실패', error.message); return; }
            t.status = status; await reloadTickets(); renderTickets(); openTicketDetail(id); showToast('상태 변경', `처리 상태를 [${TICKET_STATUS[status][0]}](으)로 변경했습니다.`);
        }
        async function deleteTicket(id) {
            const t = STATE.tickets.find(x => x.id === id); if (!t || !canManageTicket(t)) { showToast('권한 없음', '삭제할 수 없습니다.'); return; }
            if (!confirm('이 AS 티켓을 삭제하시겠습니까?')) return;
            if (t.photos && t.photos.length) { try { await sb.storage.from('documents').remove(t.photos.map(p => p.path)); } catch (er) {} }
            const { error } = await sb.from('tickets').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            logAudit('ticket_delete', `${t.customer||''} ${t.equipment||''}`.trim(), t.issue||'');
            await reloadTickets(); renderTickets(); renderDashboardWidgets(); showToast('삭제', 'AS 티켓이 삭제되었습니다.');
        }

        // ═══ 작업 · 정비 완료 보고서 (편집·삭제 기본 포함, 실시간 반영) ═══
        const REPORT_TYPES = ['정기점검', '긴급수리', '설치', '교체', '시운전', '기타'];
        const REPORT_RESULTS = ['정상 완료', '추가 조치 필요', '재방문 예정'];
        async function reloadCompletionReports() {
            try {
                const { data, error } = await sb.from('completion_reports').select('*').order('id', { ascending: false }).limit(2000);
                if (error) { STATE.reportsTableMissing = true; STATE.completionReports = []; return; }
                STATE.reportsTableMissing = false;
                STATE.completionReports = normalizeList('completionReport', (data || []).map(r => ({ id: r.id, ticketId: r.ticket_id, assetId: r.asset_id, workDate: r.work_date || '', worker: r.worker || '', workType: r.work_type || '', content: r.content || '', parts: r.parts || '', result: r.result || '', deptId: r.dept_id || '', author: r.author || '', createdAt: r.created_at })));
            } catch (e) { STATE.reportsTableMissing = true; STATE.completionReports = []; }
        }
        function reportsForTicket(ticketId) { return (STATE.completionReports || []).filter(r => r.ticketId === ticketId); }
        function reportResultTone(result) {
            if (result === '정상 완료') return 'bg-blue-50 text-blue-700 border border-blue-200';
            if (result === '추가 조치 필요') return 'bg-amber-50 text-amber-700 border border-amber-200';
            if (result === '재방문 예정') return 'bg-rose-50 text-rose-700 border border-rose-200';
            return 'bg-slate-100 text-slate-600 border border-slate-200';
        }
        function renderReportListHTML(ticketId, manage) {
            if (STATE.reportsTableMissing) return `<div class="text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">완료 보고서 테이블(completion_reports) 생성 SQL을 먼저 실행하세요.</div>`;
            const list = reportsForTicket(ticketId);
            if (!list.length) return `<div class="text-[13px] text-slate-400 py-2">작성된 완료 보고서가 없습니다.</div>`;
            const assetName = (id) => { const a = (STATE.assets || []).find(x => x.id === id); return a ? a.name : ''; };
            return list.map(r => `<div class="border border-slate-200 rounded-xl p-3.5 mb-2.5 last:mb-0">
                <div class="flex items-start justify-between gap-2 flex-wrap">
                    <div class="space-y-1.5 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">${esc(r.workType) || '작업'}</span>
                            <span class="px-2 py-0.5 rounded-md text-[11px] font-bold ${reportResultTone(r.result)}">${esc(r.result) || '-'}</span>
                            <span class="text-[12px] text-slate-500 font-mono">${esc(r.workDate) || '-'}</span>
                        </div>
                        <div class="text-sm font-semibold text-slate-800">작업자: ${esc(r.worker) || '-'}${r.assetId && assetName(r.assetId) ? ` · 설비: ${esc(assetName(r.assetId))}` : ''}</div>
                        <div class="text-[13px] text-slate-700 whitespace-pre-line leading-relaxed">${esc(r.content) || ''}</div>
                        ${r.parts ? `<div class="text-[12px] text-slate-600 whitespace-pre-line"><span class="font-bold text-slate-700">부품·조치:</span> ${esc(r.parts)}</div>` : ''}
                    </div>
                    ${manage ? `<div class="flex gap-2 flex-shrink-0">
                        <button onclick="openReportForm(${r.id}, ${ticketId})" class="text-indigo-500 hover:text-indigo-700 font-bold text-[12px]">편집</button>
                        <button onclick="deleteReport(${r.id})" class="text-rose-400 hover:text-rose-600 font-bold text-[12px]">삭제</button>
                    </div>` : ''}
                </div>
            </div>`).join('');
        }
        function refreshTicketReportList(ticketId) {
            const box = document.getElementById('ticket-report-list');
            const cnt = document.getElementById('ticket-report-count');
            if (cnt) cnt.textContent = reportsForTicket(ticketId).length;
            if (!box) return;
            const t = STATE.tickets.find(x => x.id === ticketId);
            box.innerHTML = renderReportListHTML(ticketId, t ? canManageTicket(t) : false);
            if (window.lucide) lucide.createIcons();
        }
        function fillReportSelect(id, values, cur, placeholder) {
            const el = document.getElementById(id); if (!el) return;
            const opts = values.map(v => `<option value="${esc(String(v.value !== undefined ? v.value : v))}">${esc(String(v.label !== undefined ? v.label : v))}</option>`).join('');
            el.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') + opts;
            const flat = values.map(v => String(v.value !== undefined ? v.value : v));
            if (cur && !flat.includes(String(cur))) el.innerHTML += `<option value="${esc(String(cur))}">${esc(String(cur))} (기존)</option>`;
            el.value = cur != null ? String(cur) : '';
        }
        function openReportForm(id, ticketId) {
            const t = STATE.tickets.find(x => x.id === ticketId);
            if (t && !canManageTicket(t)) { showToast('권한 없음', '보고서를 작성/편집할 권한이 없습니다.'); return; }
            if (STATE.reportsTableMissing) { showToast('준비 필요', '완료 보고서 테이블(completion_reports) 생성 SQL을 먼저 실행하세요.'); return; }
            const r = id ? (STATE.completionReports || []).find(x => x.id === id) : null;
            document.getElementById('report-form-id').value = id || '';
            document.getElementById('report-form-ticket').value = ticketId || '';
            document.getElementById('report-title-text').textContent = id ? '완료 보고서 편집' : '완료 보고서 작성';
            document.getElementById('report-work-date').value = r ? r.workDate : new Date().toISOString().slice(0, 10);
            const workers = Array.from(new Set((STATE.users || []).filter(u => u.approved).map(u => u.name).filter(Boolean))).map(n => ({ value: n, label: n }));
            fillReportSelect('report-worker', workers, r ? r.worker : (t ? t.assignee : ''), '작업자 선택');
            const assets = (STATE.assets || []).map(a => ({ value: a.id, label: a.name + (a.model ? ' (' + a.model + ')' : '') }));
            fillReportSelect('report-asset', assets, r ? r.assetId : '', '연결 설비 없음');
            fillReportSelect('crep-type', REPORT_TYPES, r ? r.workType : REPORT_TYPES[0], '');
            fillReportSelect('report-result', REPORT_RESULTS, r ? r.result : REPORT_RESULTS[0], '');
            document.getElementById('report-content').value = r ? r.content : '';
            document.getElementById('report-parts').value = r ? r.parts : '';
            openModal('report-form-modal');
            if (window.lucide) lucide.createIcons();
        }
        async function saveReport(e) {
            if (e && e.preventDefault) e.preventDefault();
            const id = document.getElementById('report-form-id').value;
            const ticketId = parseInt(document.getElementById('report-form-ticket').value) || null;
            const t = STATE.tickets.find(x => x.id === ticketId);
            if (t && !canManageTicket(t)) { showToast('권한 없음', '저장 권한이 없습니다.'); return; }
            const workDate = document.getElementById('report-work-date').value;
            const worker = document.getElementById('report-worker').value;
            const content = (document.getElementById('report-content').value || '').trim();
            if (!workDate) { showToast('입력 필요', '작업일자를 선택하세요.'); return; }
            if (!worker) { showToast('입력 필요', '작업자를 선택하세요.'); return; }
            if (!content) { showToast('입력 필요', '작업 내용을 입력하세요.'); return; }
            const assetRaw = document.getElementById('report-asset').value;
            const payload = {
                ticket_id: ticketId, asset_id: assetRaw ? parseInt(assetRaw) : null,
                work_date: workDate, worker, work_type: document.getElementById('crep-type').value,
                result: document.getElementById('report-result').value, content,
                parts: (document.getElementById('report-parts').value || '').trim() || null,
                dept_id: t ? t.deptId : ((STATE.profile && STATE.profile.deptId) || null),
                updated_at: new Date().toISOString()
            };
            let error;
            if (id) { const idNum = isNaN(+id) ? id : +id; ({ error } = await sb.from('completion_reports').update(payload).eq('id', idNum)); }
            else { payload.author = (STATE.currentUser && STATE.currentUser.name) || ''; ({ error } = await sb.from('completion_reports').insert(payload)); }
            if (error) { showToast('저장 실패', error.message); return; }
            await reloadCompletionReports();
            closeModal('report-form-modal');
            if (ticketId) refreshTicketReportList(ticketId);
            showToast('저장 완료', id ? '완료 보고서가 수정되었습니다.' : '완료 보고서가 등록되었습니다.');
        }
        async function deleteReport(id) {
            const r = (STATE.completionReports || []).find(x => x.id === id);
            const t = r ? STATE.tickets.find(x => x.id === r.ticketId) : null;
            if (t && !canManageTicket(t)) { showToast('권한 없음', '삭제 권한이 없습니다.'); return; }
            if (!confirm('이 완료 보고서를 삭제하시겠습니까?')) return;
            const { error } = await sb.from('completion_reports').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadCompletionReports();
            if (r && r.ticketId) refreshTicketReportList(r.ticketId);
            showToast('삭제됨', '완료 보고서가 삭제되었습니다.');
        }

        // ── 결재선 / 열람자 ──────────────────────────────────────────────
        function populateDocPeoplePickers() {
            const people = STATE.users.filter(u => u.approved && u.id !== (STATE.currentUser && STATE.currentUser.id));
            const opts = `<option value="">(선택)</option>` + people.map(u => `<option value="${u.id}">${esc(u.name)} (${(STATE.departments.find(d => d.id === u.deptId) || {}).name || '-'} · ${esc(u.position) || ''})</option>`).join('');
            const a = document.getElementById('doc-approver-select'); if (a) a.innerHTML = opts;
            const v = document.getElementById('doc-viewer-select'); if (v) v.innerHTML = opts;
        }
        function addDocApprover() {
            const sel = document.getElementById('doc-approver-select'); const id = sel.value; if (!id) return;
            STATE.docApprovers = STATE.docApprovers || [];
            if (STATE.docApprovers.some(x => x.id === id)) { showToast('중복', '이미 결재선에 포함된 사람입니다.'); return; }
            const u = STATE.users.find(x => x.id === id); if (!u) return;
            STATE.docApprovers.push({ id: u.id, name: u.name, status: 'pending', at: null });
            renderDocPeopleChips();
        }
        function addDocViewer() {
            const sel = document.getElementById('doc-viewer-select'); const id = sel.value; if (!id) return;
            STATE.docViewers = STATE.docViewers || [];
            if (STATE.docViewers.some(x => x.id === id)) { showToast('중복', '이미 열람자에 포함된 사람입니다.'); return; }
            const u = STATE.users.find(x => x.id === id); if (!u) return;
            STATE.docViewers.push({ id: u.id, name: u.name });
            renderDocPeopleChips();
        }
        function removeDocApprover(i) { STATE.docApprovers.splice(i, 1); renderDocPeopleChips(); }
        function removeDocViewer(i) { STATE.docViewers.splice(i, 1); renderDocPeopleChips(); }
        function renderDocPeopleChips() {
            const aBox = document.getElementById('doc-approver-chips');
            if (aBox) aBox.innerHTML = (STATE.docApprovers || []).map((p, i) => `<span class="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[12px] font-bold text-amber-700">${i + 1}차 ${esc(p.name)}<button type="button" onclick="removeDocApprover(${i})" class="text-rose-400 hover:text-rose-600 ml-0.5">×</button></span>`).join('') || '<span class="text-[12px] text-slate-300">미지정 시 부서장/관리자가 결재</span>';
            const vBox = document.getElementById('doc-viewer-chips');
            if (vBox) vBox.innerHTML = (STATE.docViewers || []).map((p, i) => `<span class="inline-flex items-center gap-1 px-2 py-1 bg-sky-50 border border-sky-200 rounded-lg text-[12px] font-bold text-sky-700">${esc(p.name)}<button type="button" onclick="removeDocViewer(${i})" class="text-rose-400 hover:text-rose-600 ml-0.5">×</button></span>`).join('') || '<span class="text-[12px] text-slate-300">지정된 열람자 없음</span>';
        }
        function currentApproverOf(doc) {
            const line = doc.approvers || [];
            return line.find(a => a.status === 'pending') || null;
        }
        function approverLineLabel(doc) {
            const line = doc.approvers || []; if (!line.length) return '';
            return line.map((a, i) => `${a.status === 'approved' ? '✓' : (a.status === 'rejected' ? '✗' : '')}${esc(a.name)}`).join(' → ');
        }

        // ── 보안 감사 원장 ───────────────────────────────────────────────
        const AUDIT_ACTIONS = { doc_submit: '결재 상신', doc_approve: '문서 승인', doc_reject: '문서 반려', doc_delete: '문서 삭제', user_edit: '권한/정보 변경', user_terminate: '계정 해지', user_approve: '가입 승인', user_reject: '가입 반려', feature_deploy: '기능 배포', feature_edit: '기능 수정', feature_remove: '기능 제거', maintenance: '점검 설정', ticket_delete: 'AS 티켓 삭제', asset_delete: '설비 삭제', project_delete: '프로젝트 삭제', meeting_delete: '주간보고 철회', inventory_create: '품목 등록', inventory_update: '품목 수정', inventory_delete: '품목 삭제', stock_in: '입고', stock_out: '출고', trade_create: '발주/견적 작성', trade_update: '발주/견적 수정', trade_delete: '발주/견적 삭제' };
        // 감사 로그는 이제 DB 트리거가 실제 사용자로 자동 기록합니다(위변조·누락 불가). 클라이언트 기록은 비활성화.
        async function logAudit(action, target, detail) { /* no-op: server-side audit triggers */ }
        const AUDIT_ENTITY = { profiles: '직원', projects: '프로젝트', documents: '문서', weekly_meetings: '주간보고', tickets: 'AS 티켓', assets: '설비', inventory_items: '재고 품목', trade_documents: '발주/견적', sites: '현장', inventory_options: '재고 옵션', app_settings: '설정', events: '일정', stock_moves: '입출고', partners: '거래처' };
        const AUDIT_OP = { insert: '등록', update: '수정', delete: '삭제' };
        function auditLabel(action) {
            if (AUDIT_ACTIONS[action]) return AUDIT_ACTIONS[action]; // 구버전(클라이언트 기록) 로그 호환
            const m = (action || '').match(/^(.*)_(insert|update|delete)$/);
            if (m && AUDIT_ENTITY[m[1]]) return AUDIT_ENTITY[m[1]] + ' ' + (AUDIT_OP[m[2]] || m[2]);
            return action || '';
        }
        async function reloadAuditLogs() {
            try {
                const { data, error } = await sb.from('audit_logs').select('*').order('id', { ascending: false }).limit(500);
                if (error) { STATE.auditTableMissing = true; STATE.auditLogs = []; return; }
                STATE.auditTableMissing = false;
                STATE.auditLogs = (data || []).slice(0, 500);
            } catch (e) { STATE.auditTableMissing = true; STATE.auditLogs = []; }
        }
        function auditApplyFilter() { resetPage('audit'); renderAuditLogs(); }
        function renderAuditLogs() {
            const body = document.getElementById('audit-log-body'); if (!body) return;
            const fsel = document.getElementById('audit-filter-action');
            if (fsel) {
                const keep = fsel.value || 'all';
                const actions = [...new Set((STATE.auditLogs || []).map(l => l.action).filter(Boolean))].sort();
                fsel.innerHTML = `<option value="all">전체 유형</option>` + actions.map(a => `<option value="${esc(a)}">${esc(auditLabel(a))}</option>`).join('');
                fsel.value = [...fsel.options].some(o => o.value === keep) ? keep : 'all';
            }
            if (STATE.auditTableMissing) { body.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 text-sm">감사 로그 테이블이 아직 없습니다. 안내된 SQL을 실행하세요.</td></tr>`; return; }
            const fv = fsel ? fsel.value : 'all';
            const list = STATE.auditLogs.filter(l => fv === 'all' || l.action === fv);
            if (list.length === 0) { body.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 text-sm">기록된 감사 로그가 없습니다.</td></tr>`; return; }
            body.innerHTML = list.slice(0, pageCount('audit')).map(l => `<tr class="hover:bg-rose-50/20 align-top"><td class="px-4 py-2.5 font-mono text-[12px] text-slate-400 whitespace-nowrap">${(l.created_at || '').replace('T', ' ').slice(0, 19)}</td><td class="px-4 py-2.5 font-bold text-slate-700 whitespace-nowrap">${esc(l.actor) || '<span class=\"text-slate-300\">시스템</span>'}<div class="text-[11px] text-slate-400 font-normal">${esc(l.actor_email)}</div></td><td class="px-4 py-2.5 whitespace-nowrap">${chip(esc(auditLabel(l.action)), 'neutral')}</td><td class="px-4 py-2.5 text-slate-700">${esc(l.target)}</td><td class="px-4 py-2.5 text-slate-500">${esc(l.detail)}</td></tr>`).join('');
            body.insertAdjacentHTML('beforeend', moreRowHTML(list.length, 'audit', 5));
        }

        // ── 설비 자산 대장 + 정기점검(PM) ────────────────────────────────
        async function reloadAssets() {
            try {
                const { data, error } = await sb.from('assets').select('*').order('id', { ascending: false }).limit(1000);
                if (error) { STATE.assetsTableMissing = true; STATE.assets = []; return; }
                STATE.assetsTableMissing = false;
                STATE.assets = normalizeList('asset', (data || []).map(r => ({ id: r.id, name: r.name, model: r.model, customer: r.customer, site: r.site, pmCycle: r.pm_cycle || 0, lastPm: r.last_pm || '', notes: r.notes || '', assignee: r.assignee || '', position: r.position || '', deptId: r.dept_id || '', assigneeId: r.assignee_id || '' })));
            } catch (e) { STATE.assetsTableMissing = true; STATE.assets = []; }
        }
        function assetPmInfo(a) {
            if (!a.pmCycle || !a.lastPm) return { state: 'none', next: '', dday: null };
            const [y, m, d] = a.lastPm.split('-').map(Number);
            const next = new Date(y, m - 1, d); next.setDate(next.getDate() + a.pmCycle);
            const nextStr = formatDate(next);
            const today = formatDate(new Date());
            const dday = Math.round((next - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000);
            let state = 'ok'; if (nextStr < today) state = 'overdue'; else if (dday <= 7) state = 'due';
            return { state, next: nextStr, dday };
        }
        function assetPmBadge(a) {
            const info = assetPmInfo(a);
            if (info.state === 'none') return chip('미사용', 'neutral');
            if (info.state === 'overdue') return chip(`지연 ${Math.abs(info.dday)}일`, 'danger');
            if (info.state === 'due') return chip(`D-${info.dday}`, 'warn');
            return chip('정상', 'success');
        }
        function renderAssets() {
            const body = document.getElementById('asset-list-body'); if (!body) return;
            const cardBox = document.getElementById('asset-card-list');
            const statsBox = document.getElementById('asset-stats');
            if (STATE.assetsTableMissing) { body.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 text-sm">설비 테이블이 아직 없습니다. 안내된 SQL을 실행하세요.</td></tr>`; if (statsBox) statsBox.innerHTML = ''; return; }
            const all = STATE.assets || [];
            if (statsBox) {
                const cnt = (s) => all.filter(a => assetPmInfo(a).state === s).length;
                statsBox.innerHTML = [['전체 설비', all.length, 'text-slate-700'], ['점검 지연', cnt('overdue'), 'text-rose-600'], ['점검 임박', cnt('due'), 'text-amber-600'], ['정상', cnt('ok'), 'text-emerald-600']].map(([l, v, c]) => `<div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><div class="text-2xl font-extrabold ${c}">${v}</div><div class="text-[13px] text-slate-400 font-medium mt-0.5">${l}</div></div>`).join('');
            }
            const q = ((document.getElementById('asset-search') || {}).value || '').trim().toLowerCase();
            const fp = (document.getElementById('asset-filter-pm') || {}).value || 'all';
            const list = all.filter(a => {
                if (fp !== 'all' && assetPmInfo(a).state !== fp) return false;
                if (q) { const hay = `${a.name || ''} ${a.customer || ''} ${a.site || ''} ${a.model || ''}`.toLowerCase(); if (hay.indexOf(q) < 0) return false; }
                return true;
            });
            if (list.length === 0) { body.innerHTML = emptyCell(6, 'server-cog', '표시할 설비가 없습니다', '설비 자산을 등록하거나 상단 필터 조건을 바꿔보세요.'); if (cardBox) cardBox.innerHTML = `<div class="sm:col-span-2">${emptyState('server-cog', '표시할 설비가 없습니다', '설비 자산을 등록하거나 상단 필터 조건을 바꿔보세요.', true)}</div>`; if (window.lucide) lucide.createIcons(); return; }
            body.innerHTML = list.slice(0, pageCount('assets')).map(a => {
                const info = assetPmInfo(a);
                const dept = STATE.departments.find(d => d.id === a.deptId);
                const manage = canManageAsset(a);
                const mgrLine = `${esc(a.assignee) || '-'}${a.position ? ' <span class=\'text-[12px] text-slate-400\'>' + esc(a.position) + '</span>' : ''}`;
                const actions = manage
                    ? `<button onclick="event.stopPropagation();createTicketFromAsset(${a.id})" class="text-rose-500 hover:text-rose-700 font-bold mr-2">AS 접수</button><button onclick="event.stopPropagation();markAssetPmDone(${a.id})" class="text-emerald-600 hover:text-emerald-800 font-bold mr-2">점검 완료</button><button onclick="event.stopPropagation();openAssetForm(${a.id})" class="text-indigo-500 hover:text-indigo-700 font-bold mr-2">편집</button><button onclick="event.stopPropagation();deleteAsset(${a.id})" class="text-rose-400 hover:text-rose-600 font-bold">삭제</button>`
                    : `<span class="text-slate-300">열람</span>`;
                return `<tr class="hover:bg-emerald-50/20 align-top cursor-pointer" onclick="openAssetDetail(${a.id})">
                    <td class="px-4 py-3"><div class="font-bold text-slate-800">${esc(a.name)}</div><div class="text-[12px] text-slate-400">${esc(a.model) || ''}</div></td>
                    <td class="px-4 py-3"><div class="font-semibold text-slate-700">${esc(a.customer) || '-'}</div><div class="text-[12px] text-slate-400">${esc(a.site) || ''}</div></td>
                    <td class="px-4 py-3"><div class="text-slate-700">${mgrLine}</div><div class="text-[12px] text-slate-400">${dept ? dept.name : '-'}</div></td>
                    <td class="px-4 py-3">${assetPmBadge(a)}<div class="text-[12px] text-slate-400 mt-0.5">${a.pmCycle ? '주기 ' + a.pmCycle + '일' : ''}</div></td>
                    <td class="px-4 py-3 font-mono text-[13px] ${info.state === 'overdue' ? 'text-rose-600 font-bold' : 'text-slate-500'}">${info.next || '-'}</td>
                    <td class="px-4 py-3 text-right whitespace-nowrap text-[13px]">${actions}</td>
                </tr>`;
            }).join('');
            body.insertAdjacentHTML('beforeend', moreRowHTML(list.length, 'assets', 6));
            if (cardBox) {
                cardBox.innerHTML = list.slice(0, pageCount('assets')).map(a => {
                    const info = assetPmInfo(a);
                    const dept = STATE.departments.find(d => d.id === a.deptId);
                    const manage = canManageAsset(a);
                    return `<div onclick="openAssetDetail(${a.id})" class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 cursor-pointer active:bg-emerald-50/30">
                        <div class="flex items-start justify-between gap-2 mb-1.5">
                            <div class="min-w-0"><div class="font-bold text-slate-800 break-keep">${esc(a.name)}</div><div class="text-[12px] text-slate-400">${esc(a.model) || ''}</div></div>
                            <div class="flex-shrink-0">${assetPmBadge(a)}</div>
                        </div>
                        <div class="text-[13px] text-slate-700 break-keep">${esc(a.customer) || '-'}${a.site ? ' · ' + esc(a.site) : ''}</div>
                        <div class="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100">
                            <div class="text-[12px] text-slate-500 break-keep">${esc(a.assignee) || '-'}${dept ? ' · ' + dept.name : ''}</div>
                            <div class="text-[12px] font-mono flex-shrink-0 ${info.state === 'overdue' ? 'text-rose-600 font-bold' : 'text-slate-400'}">다음 ${info.next || '-'}</div>
                        </div>
                        ${manage ? `<div class="grid grid-cols-2 gap-2 mt-2.5" onclick="event.stopPropagation()">
                            <button onclick="createTicketFromAsset(${a.id})" class="py-2 rounded-lg border border-slate-200 text-rose-500 font-bold text-[13px]">AS 접수</button>
                            <button onclick="markAssetPmDone(${a.id})" class="py-2 rounded-lg border border-slate-200 text-emerald-600 font-bold text-[13px]">점검 완료</button>
                            <button onclick="openAssetForm(${a.id})" class="py-2 rounded-lg border border-slate-200 text-indigo-600 font-bold text-[13px]">편집</button>
                            <button onclick="deleteAsset(${a.id})" class="py-2 rounded-lg border border-slate-200 text-rose-400 font-bold text-[13px]">삭제</button>
                        </div>` : ''}
                    </div>`;
                }).join('');
                const moreA = moreDivHTML(list.length, 'assets');
                if (moreA) cardBox.insertAdjacentHTML('beforeend', `<div class="sm:col-span-2">${moreA}</div>`);
            }
            if (window.lucide) lucide.createIcons();
        }
        function assetsApplyFilter() { resetPage('assets'); renderAssets(); }
        function canManageAsset(a) { return STATE.profile.role === 'admin' || (a && a.deptId === STATE.profile.deptId); }
        function openAssetForm(id) {
            if (STATE.assetsTableMissing) { showToast('준비 필요', '설비 테이블 생성 SQL을 먼저 실행하세요.'); return; }
            const a = id ? STATE.assets.find(x => x.id === id) : null;
            if (a && !canManageAsset(a)) { showToast('권한 없음', '본인 부서의 설비만 편집할 수 있습니다.'); return; }
            document.getElementById('asset-id').value = id || '';
            document.getElementById('asset-name').value = a ? (a.name || '') : '';
            document.getElementById('asset-model').value = a ? (a.model || '') : '';
            document.getElementById('asset-customer').value = a ? (a.customer || '') : '';
            document.getElementById('asset-site').value = a ? (a.site || '') : '';
            document.getElementById('asset-pm-cycle').value = a ? (a.pmCycle || '') : '';
            document.getElementById('asset-last-pm').value = a ? (a.lastPm || '') : '';
            fillPersonSelect('asset-assignee-select', 'asset-assignee-custom', a ? a.assigneeId : (STATE.currentUser ? STATE.currentUser.id : ''), a ? a.assignee : (STATE.profile.name || ''));
            document.getElementById('asset-position').value = a ? (a.position || '') : (STATE.profile.position || '');
            const dsel = document.getElementById('asset-dept'); if (dsel) dsel.value = a ? (a.deptId || STATE.profile.deptId) : (STATE.profile.deptId || '');
            document.getElementById('asset-notes').value = a ? (a.notes || '') : '';
            document.getElementById('asset-form-title').innerText = id ? '설비 편집' : '설비 등록';
            openModal('asset-form-modal');
        }
        async function handleSaveAsset(e) {
            e.preventDefault();
            const id = document.getElementById('asset-id').value;
            const _aa = readPerson('asset-assignee-select', 'asset-assignee-custom');
            const row = { name: document.getElementById('asset-name').value.trim(), model: document.getElementById('asset-model').value.trim(), customer: document.getElementById('asset-customer').value.trim(), site: document.getElementById('asset-site').value.trim(), pm_cycle: parseInt(document.getElementById('asset-pm-cycle').value) || 0, last_pm: document.getElementById('asset-last-pm').value || null, notes: document.getElementById('asset-notes').value.trim(), assignee: _aa.name, assignee_id: _aa.id, position: document.getElementById('asset-position').value.trim(), dept_id: document.getElementById('asset-dept').value };
            let error;
            if (id) { ({ error } = await sb.from('assets').update(row).eq('id', parseInt(id))); }
            else { ({ error } = await sb.from('assets').insert(row)); }
            if (error) { showToast('저장 실패', error.message); return; }
            await reloadAssets(); renderAssets(); renderDashboardWidgets(); closeModal('asset-form-modal');
            if (id && !document.getElementById('asset-detail-modal').classList.contains('hidden')) openAssetDetail(parseInt(id));
            showToast('저장 완료', id ? '설비 정보가 수정되었습니다.' : '설비가 등록되었습니다.');
        }
        async function markAssetPmDone(id) {
            const a = STATE.assets.find(x => x.id === id); if (!a) return;
            if (!canManageAsset(a)) { showToast('권한 없음', '본인 부서의 설비만 처리할 수 있습니다.'); return; }
            if (!confirm(`[${a.name}] 정기점검을 오늘 완료 처리하시겠습니까?`)) return;
            const { error } = await sb.from('assets').update({ last_pm: formatDate(new Date()) }).eq('id', id);
            if (error) { showToast('처리 실패', error.message); return; }
            await reloadAssets(); renderAssets(); renderDashboardWidgets(); if (!document.getElementById('asset-detail-modal').classList.contains('hidden')) openAssetDetail(id); showToast('점검 완료', `[${a.name}] 최근 점검일이 오늘로 갱신되었습니다.`);
        }
        async function deleteAsset(id) {
            const a = STATE.assets.find(x => x.id === id); if (!a) return;
            if (!canManageAsset(a)) { showToast('권한 없음', '본인 부서의 설비만 삭제할 수 있습니다.'); return; }
            if (!confirm(`설비 [${a.name}] 을(를) 대장에서 삭제하시겠습니까?`)) return;
            const { error } = await sb.from('assets').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            logAudit('asset_delete', a.name, `${a.customer || ''} ${a.site || ''}`.trim());
            await reloadAssets(); renderAssets(); renderDashboardWidgets(); closeModal('asset-detail-modal'); showToast('삭제', '설비가 삭제되었습니다.');
        }
        function openAssetDetail(id) {
            const a = STATE.assets.find(x => x.id === id); if (!a) return;
            STATE._openDetail = { type: 'asset', id };
            const dept = STATE.departments.find(d => d.id === a.deptId);
            const info = assetPmInfo(a);
            const manage = canManageAsset(a);
            const field = (label, val, pre) => `<div><div class="text-[12px] font-bold text-slate-400 mb-0.5">${label}</div><div class="text-sm text-slate-700 ${pre ? 'whitespace-pre-line leading-relaxed' : 'font-semibold'}">${esc(val) || '-'}</div></div>`;
            const ctrl = manage ? `<div class="flex gap-2 flex-wrap"><button onclick="createTicketFromAsset(${a.id})" class="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg">AS 접수</button><button onclick="markAssetPmDone(${a.id})" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">점검 완료</button><button onclick="openAssetForm(${a.id})" class="px-3 py-2 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg">편집</button><button onclick="deleteAsset(${a.id})" class="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg">삭제</button></div>` : '<span class="text-[12px] text-slate-400">본인 부서 설비만 관리할 수 있습니다.</span>';
            document.getElementById('asset-detail-body').innerHTML = `
                <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                    <div class="flex items-start justify-between gap-3 flex-wrap">
                        <div class="space-y-2">
                            <div class="flex items-center gap-2 flex-wrap">${assetPmBadge(a)}<span class="wsp-chip ${dept ? dept.textTheme : 'bg-slate-100 text-slate-600 border-slate-200'}">${dept ? dept.name : '부서 미지정'}</span></div>
                            <h3 class="text-xl font-extrabold text-slate-800">${esc(a.name)}</h3>
                            <div class="text-[13px] text-slate-400">${esc(a.model) || '모델 미등록'}</div>
                        </div>
                        ${ctrl}
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        ${field('고객사', a.customer)}
                        ${field('현장명', a.site)}
                        ${field('담당자', a.assignee)}
                        ${field('직책', a.position)}
                        ${field('점검 주기', a.pmCycle ? a.pmCycle + '일' : '미사용')}
                        ${field('최근 점검일', a.lastPm)}
                        ${field('다음 점검 예정', info.next || '-')}
                        ${field('점검 상태', info.state === 'overdue' ? '지연' : info.state === 'due' ? '임박' : info.state === 'ok' ? '정상' : '미사용')}
                    </div>
                    ${a.notes ? `<div class="border-t border-slate-100 pt-3">${field('비고', a.notes, true)}</div>` : ''}
                </div>`;
            openModal('asset-detail-modal'); if (window.lucide) lucide.createIcons();
        }
        function createTicketFromAsset(id) {
            const a = STATE.assets.find(x => x.id === id); if (!a) return;
            switchTab('field-support');
            setTimeout(() => {
                openTicketForm();
                document.getElementById('ticket-customer').value = a.customer || '';
                document.getElementById('ticket-site').value = a.site || '';
                document.getElementById('ticket-equipment').value = a.name || '';
            }, 80);
        }

        // ── 대시보드 차트 ────────────────────────────────────────────────
        STATE._charts = {};
        function drawChart(id, cfg) {
            const el = document.getElementById(id); if (!el || typeof Chart === 'undefined') return;
            if (STATE._charts[id]) { try { STATE._charts[id].destroy(); } catch (e) { } }
            try { STATE._charts[id] = new Chart(el.getContext('2d'), cfg); } catch (e) { }
        }
        async function renderDashboardCharts() {
            await ensureChart(); if (typeof Chart === 'undefined') return;
            const dark = document.documentElement.classList.contains('dark');
            const axisC = dark ? '#c9c6bd' : '#475569';
            const gridC = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
            try { Chart.defaults.color = axisC; Chart.defaults.borderColor = gridC; } catch (e) { }
            const isAdmin = STATE.profile.role === 'admin';
            const myDept = STATE.profile.deptId;
            const scope = (arr) => isAdmin ? arr : arr.filter(x => x.deptId === myDept);
            const projs = scope(STATE.projects);
            const sCnt = (s) => projs.filter(p => p.status === s).length;
            drawChart('chart-proj-status', { type: 'doughnut', data: { labels: ['대기', '진행', '완료'], datasets: [{ data: [sCnt('paused'), sCnt('ongoing'), sCnt('completed')], backgroundColor: ['#94a3b8', '#3b82f6', '#10b981'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: axisC, font: { size: 12 } } } } } });
            const depts = STATE.departments.filter(d => d.id !== 'ceo');
            const avg = depts.map(d => { const list = STATE.projects.filter(p => p.deptId === d.id); return list.length ? Math.round(list.reduce((s, p) => s + (p.progress || 0), 0) / list.length) : 0; });
            drawChart('chart-dept-progress', { type: 'bar', data: { labels: depts.map(d => d.name), datasets: [{ data: avg, backgroundColor: '#6366f1', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100, ticks: { color: axisC, font: { size: 11 } }, grid: { color: gridC } }, x: { ticks: { color: axisC, font: { size: 10 } }, grid: { color: gridC } } }, plugins: { legend: { display: false } } } });
            const tks = STATE.tickets || [];
            const tCnt = (s) => tks.filter(t => t.status === s).length;
            drawChart('chart-ticket-status', { type: 'bar', data: { labels: ['접수', '진행중', '보류', '완료'], datasets: [{ data: [tCnt('received'), tCnt('in_progress'), tCnt('hold'), tCnt('done')], backgroundColor: ['#94a3b8', '#3b82f6', '#f59e0b', '#10b981'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { color: axisC, stepSize: 1, font: { size: 11 } }, grid: { color: gridC } }, x: { ticks: { color: axisC }, grid: { color: gridC } } }, plugins: { legend: { display: false } } } });
        }

        // ── 전역 통합 검색 ───────────────────────────────────────────────
        function buildSearchResults(q) {
            q = (q || '').trim().toLowerCase();
            if (q.length < 1) return null;
            const results = [];
            STATE.projects.forEach(p => { if (`${p.title} ${p.desc || ''}`.toLowerCase().indexOf(q) >= 0) results.push({ type: '프로젝트', color: 'bg-blue-50 text-blue-600', title: p.title, sub: `${(STATE.departments.find(d => d.id === p.deptId) || {}).name || ''} · ${p.progress}%`, onclick: `gsOpen('proj',${p.id})` }); });
            STATE.documents.forEach(d => { if (`${d.title} ${d.author || ''}`.toLowerCase().indexOf(q) >= 0) results.push({ type: '문서', color: 'bg-slate-100 text-slate-600', title: d.title, sub: `${esc(d.author) || ''} · ${(DOC_STATUS[d.status] || ['', ''])[0]}`, onclick: `gsOpen('doc',${d.id})` }); });
            STATE.weeklyMeetings.forEach(m => { if (`${m.title || ''} ${m.week} ${m.content || ''}`.toLowerCase().indexOf(q) >= 0) results.push({ type: '주간보고', color: 'bg-indigo-50 text-indigo-600', title: m.title || m.week, sub: `${m.week} · ${esc(m.author) || ''}`, onclick: `gsOpen('meeting',${m.id})` }); });
            (STATE.tickets || []).forEach(t => { if (`${t.customer || ''} ${t.site || ''} ${t.equipment || ''} ${t.issue || ''}`.toLowerCase().indexOf(q) >= 0) results.push({ type: 'AS', color: 'bg-rose-50 text-rose-600', title: `${t.customer || ''} ${t.equipment || ''}`.trim(), sub: (t.issue || '').slice(0, 40), onclick: `gsOpen('ticket',${t.id})` }); });
            (STATE.assets || []).forEach(a => { if (`${a.name || ''} ${a.customer || ''} ${a.site || ''} ${a.model || ''}`.toLowerCase().indexOf(q) >= 0) results.push({ type: '설비', color: 'bg-emerald-50 text-emerald-600', title: a.name, sub: `${a.customer || ''} ${a.site || ''}`.trim(), onclick: `gsOpen('asset',${a.id})` }); });
            if (results.length === 0) return `<div class="p-4 text-center text-[13px] text-slate-300">검색 결과가 없습니다.</div>`;
            return results.slice(0, 20).map(r => `<div onclick="${r.onclick}" class="px-4 py-2.5 hover:bg-indigo-50/50 cursor-pointer flex items-center gap-3 border-b border-slate-50 last:border-0"><span class="px-1.5 py-0.5 rounded text-[11px] font-bold flex-shrink-0 ${r.color}">${r.type}</span><div class="min-w-0"><div class="text-sm font-bold text-slate-800 truncate">${esc(r.title)}</div><div class="text-[12px] text-slate-400 truncate">${r.sub}</div></div></div>`).join('');
        }
        function runGlobalSearch() {
            const inp = document.getElementById('global-search'); const box = document.getElementById('global-search-results');
            if (!inp || !box) return;
            const html = buildSearchResults(inp.value);
            if (html === null) { box.classList.add('hidden'); box.innerHTML = ''; return; }
            box.innerHTML = html; box.classList.remove('hidden');
        }
        function openMobileSearch() { openModal('mobile-search-modal'); setTimeout(() => { const i = document.getElementById('mobile-global-search'); if (i) i.focus(); }, 50); }
        function runGlobalSearchMobile() {
            const inp = document.getElementById('mobile-global-search'); const box = document.getElementById('mobile-global-search-results');
            if (!inp || !box) return;
            const html = buildSearchResults(inp.value);
            box.innerHTML = html === null ? '<div class="p-6 text-center text-[13px] text-slate-300">검색어를 입력하세요.</div>' : html;
        }
        function gsClose() { const box = document.getElementById('global-search-results'); if (box) box.classList.add('hidden'); const inp = document.getElementById('global-search'); if (inp) inp.value = ''; }
        function gsOpen(kind, id) {
            gsClose(); closeModal('mobile-search-modal');
            if (kind === 'proj') openProjectDetail(id);
            else if (kind === 'doc') { switchTab('documents'); setTimeout(() => viewDocument(id), 60); }
            else if (kind === 'meeting') { switchTab('weekly-meeting'); setTimeout(() => openMeetingDetail(id), 60); }
            else if (kind === 'ticket') { switchTab('field-support'); setTimeout(() => openTicketDetail(id), 60); }
            else if (kind === 'asset') { switchTab('assets'); }
        }
        document.addEventListener('click', (e) => { const wrap = e.target.closest && e.target.closest('#global-search, #global-search-results'); if (!wrap) { const box = document.getElementById('global-search-results'); if (box) box.classList.add('hidden'); } });

        // ── 모바일 사이드바 토글 ─────────────────────────────────────────
        function toggleSidebar() { const sb = document.getElementById('app-sidebar'); const bd = document.getElementById('sidebar-backdrop'); if (!sb) return; const open = sb.classList.toggle('open'); if (bd) bd.classList.toggle('hidden', !open); updateSidebarHandle(); }
        function closeSidebar() { const sb = document.getElementById('app-sidebar'); const bd = document.getElementById('sidebar-backdrop'); if (sb) sb.classList.remove('open'); if (bd) bd.classList.add('hidden'); updateSidebarHandle(); }
        // 사이드바 접기/펼치기 + 좌측 확장 핸들
        function isNarrowWidth() { try { return window.matchMedia ? window.matchMedia('(max-width: 1023px)').matches : (window.innerWidth || 1280) < 1024; } catch (e) { return (window.innerWidth || 1280) < 1024; } }
        function sidebarVisible() {
            const sb = document.getElementById('app-sidebar'); if (!sb) return true;
            return isNarrowWidth() ? sb.classList.contains('open') : !document.body.classList.contains('sidebar-collapsed');
        }
        function updateSidebarHandle() {
            const handle = document.getElementById('sidebar-expand-handle');
            if (!handle) return;
            // 펼쳐져 있으면 우측 가장자리에서 "<"(접기), 접혀/닫혀 있으면 좌측에서 ">"(펼치기) — 항상 표시
            handle.classList.toggle('expanded', sidebarVisible());
        }
        function toggleSidebarEdge() { // 가장자리 핸들: 현재 상태에 따라 접기 ↔ 펼치기
            if (sidebarVisible()) { if (isNarrowWidth()) closeSidebar(); else collapseSidebar(); }
            else { expandSidebar(); }
        }
        function collapseSidebar() { // 사이드바 접어 본문 폭 확보
            document.body.classList.add('sidebar-collapsed');
            try { localStorage.setItem('wsp_sidebar_collapsed', '1'); } catch (e) {}
            updateSidebarHandle();
        }
        function expandSidebar() { // 다시 펼치기 (데스크톱/모바일 공통)
            document.body.classList.remove('sidebar-collapsed');
            try { localStorage.removeItem('wsp_sidebar_collapsed'); } catch (e) {}
            if (isNarrowWidth()) {
                const sb = document.getElementById('app-sidebar'); const bd = document.getElementById('sidebar-backdrop');
                if (sb) sb.classList.add('open'); if (bd) bd.classList.remove('hidden');
            }
            updateSidebarHandle();
            if (window.lucide) lucide.createIcons();
        }
        window.addEventListener('resize', updateSidebarHandle);

        // ── 메일 연동 센터 (시뮬레이션) ──────────────────────────────────
        function toggleMailFields() {
            const sel = document.getElementById('mail-provider-select'); if (!sel) return;
            const provider = sel.value; STATE.mailplug.provider = provider;
            const api = document.getElementById('panel-api-config');
            const oauth = document.getElementById('panel-oauth-config');
            const imap = document.getElementById('panel-custom-imap');
            [api, oauth, imap].forEach(p => p && p.classList.add('hidden'));
            if (provider === 'mailplug') { if (api) api.classList.remove('hidden'); }
            else if (provider === 'gmail' || provider === 'outlook') {
                if (oauth) oauth.classList.remove('hidden');
                const prompt = document.getElementById('oauth-prompt-text');
                const btn = document.getElementById('oauth-btn-text');
                const label = provider === 'gmail' ? 'Google Gmail' : 'MS Outlook';
                if (prompt) prompt.innerText = STATE.mailplug.oauthConnected ? `${label} 토큰 발급 완료` : `${label} 보안 연동 토큰이 필요합니다.`;
                if (btn) btn.innerText = STATE.mailplug.oauthConnected ? '재인증 요청' : '보안 OAuth 2.0 연결';
            }
            else if (provider === 'custom_imap') { if (imap) imap.classList.remove('hidden'); }
            updateMailStatusBadge();
        }
        function updateMailStatusBadge() {
            const badge = document.getElementById('mp-status-badge'); if (!badge) return;
            if (STATE.mailplug.connected) { badge.innerText = '연동 활성'; badge.className = "px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-50 text-emerald-600 border border-emerald-200/50"; }
            else { badge.innerText = '연동 끊김'; badge.className = "px-2 py-0.5 text-[11px] font-bold rounded bg-rose-50 text-rose-600 border border-rose-200/50"; }
        }
        function handleOAuthSimulation() {
            STATE.mailplug.oauthConnected = true; toggleMailFields();
            showToast('토큰 발급', '보안 인증 토큰이 발급되었습니다. [연동 저장]을 눌러 완료하십시오.');
        }
        function handleUnifiedMailConnect(save) {
            if (!save) {
                STATE.mailplug.connected = false; STATE.mailplug.oauthConnected = false; STATE.mailplug.emails = [];
                updateMailStatusBadge(); renderMailInbox(); renderDashboardWidgets();
                showToast('연동 해제', '메일 보안 터널 세션이 종료되었습니다.'); return;
            }
            const provider = STATE.mailplug.provider || (document.getElementById('mail-provider-select') ? document.getElementById('mail-provider-select').value : 'mailplug');
            if (provider === 'mailplug') {
                const domain = document.getElementById('mp-domain') ? document.getElementById('mp-domain').value.trim() : '';
                if (!domain) { showToast('입력 필요', '메일플러그 회사 ID를 입력하십시오.'); return; }
                STATE.mailplug.domain = domain;
            } else if (provider === 'gmail' || provider === 'outlook') {
                if (!STATE.mailplug.oauthConnected) { showToast('인증 필요', '먼저 OAuth 2.0 보안 연결을 완료하십시오.'); return; }
            } else if (provider === 'custom_imap') {
                const host = document.getElementById('imap-host') ? document.getElementById('imap-host').value.trim() : '';
                const email = document.getElementById('custom-email') ? document.getElementById('custom-email').value.trim() : '';
                if (!host || !email) { showToast('입력 필요', 'IMAP 서버 주소와 이메일을 입력하십시오.'); return; }
            }
            STATE.mailplug.connected = true;
            STATE.mailplug.emails = (STATE.mailplug.mockDB[provider] || []).map(m => ({ ...m }));
            updateMailStatusBadge(); renderMailInbox(); renderDashboardWidgets();
            showToast('연동 완료', '메일 서버와의 보안 동기화가 활성화되었습니다.');
        }
        function triggerApprovalSync() {
            if (!STATE.mailplug.connected) { showToast('연동 필요', '먼저 메일 서버 연동을 완료하십시오.'); return; }
            const provider = STATE.mailplug.provider;
            const base = (STATE.mailplug.mockDB[provider] || []).map(m => ({ ...m }));
            base.unshift({ id: Date.now(), sender: '동기화 엔진', subject: '[동기화] 신규 수신 메일 확인 완료', time: '방금 전', content: '수동 동기화 요청에 따라 사서함을 갱신했습니다.' });
            STATE.mailplug.emails = base; renderMailInbox(); renderDashboardWidgets();
            showToast('동기화 완료', '최신 수신 메일을 불러왔습니다.');
        }
        function renderMailInbox() {
            const grid = document.getElementById('mailplug-grid'); if (!grid) return;
            if (!STATE.mailplug.connected) {
                grid.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-center text-slate-400 py-16"><i data-lucide="mail-x" class="w-9 h-9 mb-3 opacity-30"></i><p class="text-xs font-medium">메일 서버가 연동되지 않았습니다.</p><p class="text-[12px] mt-1">좌측 패널에서 연동을 완료하면 수신 메일이 표시됩니다.</p></div>`;
                lucide.createIcons(); return;
            }
            grid.innerHTML = '';
            STATE.mailplug.emails.forEach(m => {
                const row = document.createElement('div');
                row.className = "p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-all cursor-pointer";
                row.onclick = () => showToast(m.subject, m.content);
                row.innerHTML = `<div class="flex justify-between items-center text-[12px] text-slate-400"><span class="font-bold text-slate-600">${m.sender}</span><span>${m.time}</span></div><h5 class="font-bold text-xs text-slate-800 truncate mt-0.5">${m.subject}</h5><p class="text-[13px] text-slate-500 truncate mt-0.5">${m.content}</p>`;
                grid.appendChild(row);
            });
        }

        // ── 라우터 / 네비게이션 가드 ─────────────────────────────────────
        const TAB_META = {
            'dashboard': { title: '종합 대시보드', desc: '사내 전 부서의 실시간 업무 활동 상태를 통합 관제합니다.' },
            'calendar': { title: '부서 통합 캘린더', desc: '전 부서의 일정을 한 화면에서 통합 관리합니다.' },
            'management-progress': { title: '프로젝트 협업 관제 센터', desc: '부서별 프로젝트 진척을 칸반·간트 타임라인으로 관리합니다.' },
            'weekly-meeting': { title: '주간 회의 대시보드', desc: '부서별 주간 업무 보고를 작성하고 공유합니다.' },
            'documents': { title: '통합 보고 허브', desc: '사내 보고서를 등록·열람·수정·관리합니다.' },
            'documents-pending': { title: '결재 대기 함', desc: '결재 대기 중인 문서를 확인하고 승인·반려합니다.' },
            'documents-archive': { title: '승인 완료 보관소', desc: '전결 처리되어 정식 등록된 보고 문서를 조회합니다.' },
            'mail-integration': { title: '통합 메일 연동 센터', desc: '사내·외부 메일 사서함을 연동합니다.' },
            'field-support': { title: '현장 지원 / AS 관리', desc: '고객사·현장 설비 장애 접수부터 처리 완료까지 관리합니다.' },
            'assets': { title: '설비 자산 대장', desc: '현장 설비 자산과 정기점검(PM) 일정을 관리합니다.' },
            'inventory': { title: '재고 관리', desc: '품목 재고 현황과 입고·출고를 실시간으로 관리합니다.' },
            'trade': { title: '발주 · 견적', desc: '재고 품목으로 발주서·견적서를 작성하고 발행·인쇄합니다.' },
            'management-stats': { title: '조직 권한 제어 센터', desc: '임직원 승인·인가 등급·소속 부서를 관리합니다.' },
            'management-logs': { title: '보안 감사 원장', desc: '시스템 보안 활동 로그를 점검합니다.' }
        };
        async function switchTab(tabId) {
            if (typeof tabId === 'string' && tabId.indexOf('custom_') === 0) { launchCustomFeature(tabId); closeSidebar(); return; }
            STATE.currentTab = tabId;
            closeSidebar();
            const meta = TAB_META[tabId];
            if (meta) { const vt = document.getElementById('view-title'); if (vt) vt.innerText = meta.title; const vd = document.getElementById('view-description'); if (vd) vd.innerText = meta.desc; }
            const isAdmin = (STATE.profile.role === 'admin');
            const adminOnly = ['management-stats', 'management-logs'];
            document.getElementById('main-content-sections').classList.remove('hidden');
            document.getElementById('maintenance-overlay').classList.add('hidden');
            document.getElementById('access-denied-overlay').classList.add('hidden');
            document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
            if (!isAdmin) {
                if (adminOnly.includes(tabId)) {
                    document.getElementById('main-content-sections').classList.add('hidden');
                    document.getElementById('access-denied-overlay').classList.remove('hidden');
                    syncSidebarActiveState(tabId); return;
                }
                const dept = STATE.profile.deptId || 'strategy';
                if (STATE.permissions[dept] && STATE.permissions[dept][tabId] === false) {
                    document.getElementById('main-content-sections').classList.add('hidden');
                    document.getElementById('access-denied-overlay').classList.remove('hidden');
                    syncSidebarActiveState(tabId); return;
                }
                if (STATE.maintenance[tabId]) {
                    document.getElementById('main-content-sections').classList.add('hidden');
                    document.getElementById('maintenance-overlay').classList.remove('hidden');
                    syncSidebarActiveState(tabId); return;
                }
            }
            const target = document.getElementById(`view-${tabId}`); if (target) target.classList.remove('hidden');
            syncSidebarActiveState(tabId);
            const badge = document.getElementById('tab-maintenance-badge'); if (badge) badge.classList.toggle('hidden', !STATE.maintenance[tabId]);
            const mb = document.getElementById('maintenance-btn-text'); if (mb) mb.innerText = STATE.maintenance[tabId] ? '점검 해제하기' : '현재 메뉴 점검 설정';
            if (tabId === 'dashboard') { renderDashboardWidgets(); renderDashboardNotice(); }
            else if (tabId === 'calendar') renderCalendar();
            else if (tabId === 'documents') { resetPage('documents'); filterDocs(); }
            else if (tabId === 'documents-pending') { resetPage('pendingDocs'); renderPendingDocs(); }
            else if (tabId === 'documents-archive') { resetPage('archiveDocs'); renderArchiveDocs(); }
            else if (tabId === 'field-support') { resetPage('tickets'); renderTickets(); }
            else if (tabId === 'assets') { resetPage('assets'); renderAssets(); }
            else if (tabId === 'inventory') { resetPage('inventory'); setInventoryView(STATE.inventoryView || 'dashboard'); }
            else if (tabId === 'trade') { resetPage('trade'); renderTrade(); }
            else if (tabId === 'management-logs') { resetPage('audit'); await reloadAuditLogs(); renderAuditLogs(); }
            else if (tabId === 'management-progress') renderProjects();
            else if (tabId === 'weekly-meeting') renderWeeklyMeetings();
            else if (tabId === 'mail-integration') { toggleMailFields(); renderMailInbox(); }
            else if (tabId === 'management-stats') { await reloadProfiles(); renderPermissionMatrix(); renderPendingUsers(); renderActiveUsers(); }
            if (window.lucide) lucide.createIcons();
        }

        function syncSidebarActiveState(id) { document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active')); const active = document.getElementById(`nav-${id}`); if (active) active.classList.add('active'); }

        function showToast(title, message) {
            const container = document.getElementById('toast-container'); if (!container) return;
            const toast = document.createElement('div');
            toast.className = "bg-white border border-slate-200 rounded-xl shadow-lg p-3.5 w-72 flex items-start gap-3 transition-all duration-300";
            toast.innerHTML = `<div class="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0"><i data-lucide="bell" class="w-4 h-4"></i></div><div class="flex-1 min-w-0"><h5 class="text-xs font-bold text-slate-800">${title}</h5><p class="text-[13px] text-slate-500 mt-0.5 break-words">${message}</p></div>`;
            container.appendChild(toast);
            if (window.lucide) lucide.createIcons();
            setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; setTimeout(() => toast.remove(), 300); }, 3200);
        }
        // ── 공통 빈 상태(empty state) — 아이콘 + 진한 제목 + 안내(가독성 표준) ──
        function emptyState(icon, title, hint, compact) {
            const pad = compact ? 'py-8 px-4' : 'py-12 px-4';
            const ic = compact ? 'w-10 h-10' : 'w-14 h-14';
            const ici = compact ? 'w-5 h-5' : 'w-7 h-7';
            return `<div class="${pad} text-center">
                <div class="${ic} mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><i data-lucide="${icon || 'inbox'}" class="${ici} text-slate-400"></i></div>
                <div class="text-sm font-bold text-slate-700">${title || '표시할 항목이 없습니다'}</div>
                ${hint ? `<div class="text-[13px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed break-keep">${hint}</div>` : ''}
            </div>`;
        }
        // 표(table) 안에서 쓰는 빈 상태 행
        function emptyCell(colspan, icon, title, hint) {
            return `<tr><td colspan="${colspan}">${emptyState(icon, title, hint, true)}</td></tr>`;
        }
        function handleGlobalModalKeydown(e) {
            if (e.key !== 'Escape') return;
            const stack = STATE.modalStack || [];
            if (!stack.length) return;
            closeModal(stack[stack.length - 1]);
        }
        function focusFirstInModal(m) {
            try {
                const el = m.querySelector('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
                if (el) setTimeout(() => { try { el.focus(); } catch (e) { } }, 30);
            } catch (e) { }
        }
        function enhanceA11y(root) {
            const labels = { x: '닫기', plus: '추가', 'plus-circle': '추가', trash: '삭제', 'trash-2': '삭제', pencil: '편집', edit: '편집', 'edit-2': '편집', search: '검색', 'chevron-left': '이전', 'chevron-right': '다음', 'chevron-down': '펼치기', download: '다운로드', upload: '업로드', printer: '인쇄', settings: '설정', bell: '알림', menu: '메뉴', 'more-vertical': '더보기', 'more-horizontal': '더보기', filter: '필터', 'refresh-cw': '새로고침', check: '확인', save: '저장', copy: '복사' };
            try {
                (root || document).querySelectorAll('button:not([aria-label])').forEach(b => {
                    if ((b.textContent || '').trim()) return;
                    const ic = b.querySelector('[data-lucide], svg[class*="lucide-"]');
                    let nm = '';
                    if (ic) { nm = ic.getAttribute('data-lucide') || ''; if (!nm) { const mm = (ic.getAttribute('class') || '').match(/lucide-([a-z0-9-]+)/); if (mm) nm = mm[1]; } }
                    b.setAttribute('aria-label', labels[nm] || (nm || '버튼'));
                });
            } catch (e) { }
        }
        function openModal(id) {
            if (id === 'add-doc-modal') { STATE.docApprovers = STATE.docApprovers || []; STATE.docViewers = STATE.docViewers || []; populateDocPeoplePickers(); renderDocPeopleChips(); }
            if (id === 'profile-setting-modal' && STATE.currentUser) {
                const n = document.getElementById('profile-name'); if (n) n.value = STATE.currentUser.name;
                const d = document.getElementById('profile-dept'); if (d) { d.value = STATE.currentUser.deptId; const adm = STATE.profile.role === 'admin'; d.disabled = !adm; d.classList.toggle('opacity-60', !adm); d.classList.toggle('cursor-not-allowed', !adm); }
            }
            if (id === 'add-meeting-modal') applyDeptLock('meeting-dept');
            if (id === 'add-project-modal') applyDeptLock('project-dept');
            if (id === 'add-feature-modal') { renderFeatureIconGrid(); renderFeatureGroupSelect(); }
            if (!STATE._a11yKeys) { STATE._a11yKeys = true; document.addEventListener('keydown', handleGlobalModalKeydown); }
            const m = document.getElementById(id);
            if (m) {
                const isDrawer = DRAWER_MODALS.has(id);
                m._returnFocus = document.activeElement;
                const _pp = m.querySelector(':scope > div');
                if (_pp) { _pp.classList.remove('modal-maximized', 'modal-resized', 'drawer-full'); _pp.style.width = ''; _pp.style.height = ''; const _mb = m.querySelector('[data-maximize-btn]'); if (_mb) { _mb.innerHTML = '<i data-lucide=\'maximize-2\' class=\'w-3.5 h-3.5\'></i>'; _mb.title = '전체화면'; } }
                m.classList.remove('hidden'); m.classList.add('flex');
                m.classList.toggle('modal-drawer', isDrawer);
                if (isDrawer) {
                    m.classList.remove('drawer-open');
                    m.onclick = (e) => { if (e.target === m) closeModal(id); };
                    if (_pp) {
                        let tab = _pp.querySelector('.drawer-expand-tab');
                        if (!tab) { tab = document.createElement('button'); tab.className = 'drawer-expand-tab'; tab.title = '전체화면'; tab.onclick = (ev) => { ev.stopPropagation(); toggleModalMaximize(id); }; _pp.appendChild(tab); }
                        tab.innerHTML = '<i data-lucide="chevron-left" class="w-4 h-4"></i>';
                    }
                    requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('drawer-open')));
                    if (window.lucide) lucide.createIcons();
                }
                else { makeModalResizable(m); }
                STATE.modalStack = STATE.modalStack || []; if (STATE.modalStack[STATE.modalStack.length - 1] !== id) STATE.modalStack.push(id);
                enhanceA11y(m); focusFirstInModal(m);
            }
        }
        let _rzState = null;
        // 상세·미리보기 화면은 우측 사이드 패널(슬라이드오버)로, 폼·확인창은 기존 모달로 (하이브리드)
        const DRAWER_MODALS = new Set(['doc-preview-modal', 'meeting-detail-modal', 'trade-detail-modal', 'project-detail-modal', 'ticket-detail-modal', 'asset-detail-modal', 'inventory-detail-modal']);
        function toggleModalMaximize(id) {
            const m = document.getElementById(id); if (!m) return;
            const panel = m.querySelector(':scope > div'); if (!panel) return;
            const drawer = m.classList.contains('modal-drawer');
            const cls = drawer ? 'drawer-full' : 'modal-maximized';
            const on = panel.classList.toggle(cls);
            if (!drawer) { panel.classList.remove('modal-resized'); panel.style.width = ''; panel.style.height = ''; }
            const btn = m.querySelector('[data-maximize-btn]');
            if (btn) { btn.innerHTML = `<i data-lucide="${on ? 'minimize-2' : 'maximize-2'}" class="w-3.5 h-3.5"></i>`; btn.title = on ? (drawer ? '사이드로' : '창 축소') : '전체화면'; }
            if (drawer) { const tab = m.querySelector('.drawer-expand-tab'); if (tab) tab.innerHTML = `<i data-lucide="${on ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>`; }
            if (window.lucide) lucide.createIcons();
        }
        function makeModalResizable(m) {
            const panel = m.querySelector(':scope > div'); if (!panel) return;
            if (getComputedStyle(panel).position === 'static') panel.style.position = 'relative';
            if (!panel.style.minWidth) panel.style.minWidth = '300px';
            if (!panel.style.minHeight) panel.style.minHeight = '180px';
            if (!panel.querySelector(':scope > .modal-resize-grip')) {
                const grip = document.createElement('div');
                grip.className = 'modal-resize-grip'; grip.title = '드래그하여 창 크기 조절';
                grip.addEventListener('mousedown', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const r = panel.getBoundingClientRect();
                    panel.classList.add('modal-resized'); panel.classList.remove('modal-maximized');
                    _rzState = { panel, sx: e.clientX, sy: e.clientY, sw: r.width, sh: r.height };
                    document.body.style.userSelect = 'none';
                });
                panel.appendChild(grip);
            }
            if (!window._rzBound) {
                window._rzBound = true;
                window.addEventListener('mousemove', (e) => {
                    if (!_rzState) return;
                    _rzState.panel.style.width = Math.max(300, Math.min(window.innerWidth * 0.98, _rzState.sw + (e.clientX - _rzState.sx))) + 'px';
                    _rzState.panel.style.height = Math.max(180, Math.min(window.innerHeight * 0.96, _rzState.sh + (e.clientY - _rzState.sy))) + 'px';
                });
                window.addEventListener('mouseup', () => { if (_rzState) { _rzState = null; document.body.style.userSelect = ''; } });
            }
        }
        function closeModal(id, immediate) {
            const m = document.getElementById(id);
            if (m && m.classList.contains('modal-drawer') && !immediate) {
                m.classList.remove('drawer-open');
                setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex', 'modal-drawer'); }, 280);
            } else if (m) { m.classList.add('hidden'); m.classList.remove('flex', 'modal-drawer', 'drawer-open'); }
            STATE.modalStack = (STATE.modalStack || []).filter(x => x !== id);
            if (m && m._returnFocus && typeof m._returnFocus.focus === 'function') { try { m._returnFocus.focus(); } catch (e) { } }
            if (m) m._returnFocus = null;
        }

        // ── 다크 모드 ────────────────────────────────────────────────────
        function applyTheme(on) {
            document.documentElement.classList.toggle('dark', !!on);
            const lbl = document.getElementById('darkmode-label'); if (lbl) lbl.innerText = on ? '라이트 모드' : '다크 모드';
            const btn = document.getElementById('darkmode-btn'); if (btn) { const ic = btn.querySelector('i'); if (ic) ic.setAttribute('data-lucide', on ? 'sun' : 'moon'); }
            if (window.lucide) lucide.createIcons();
            if (STATE.currentTab === 'dashboard') { try { renderDashboardCharts(); } catch (e) { } }
        }
        function toggleDarkMode() {
            const on = !document.documentElement.classList.contains('dark');
            applyTheme(on);
            try { localStorage.setItem('wsp_theme', on ? 'dark' : 'light'); } catch (e) { }
        }
        function initTheme() {
            let saved = null; try { saved = localStorage.getItem('wsp_theme'); } catch (e) { }
            applyTheme(saved === 'dark');
        }
        // ── 통합 알림 센터 (개인 확인 상태) ──────────────────────────────
        function seenTasksKey() { return 'wsp_seen_notif_' + (STATE.currentUser ? STATE.currentUser.id : 'anon'); }
        function getSeenTasks() {
            try { const raw = localStorage.getItem(seenTasksKey()); return new Set(raw ? JSON.parse(raw) : []); } catch (e) { return new Set(); }
        }
        function buildNotifications() {
            const isAdmin = STATE.profile.role === 'admin';
            const myDept = STATE.profile.deptId;
            const myName = (STATE.profile.name || '').trim();
            const todayStr = formatDate(new Date());
            const soon = new Date(); soon.setDate(soon.getDate() + 3); const soonStr = formatDate(soon);
            const items = [];
            // 1) 내가 결재할 문서 (결재선이 있으면 내 차례일 때만)
            STATE.documents.filter(d => d.status === 'pending').forEach(d => {
                const line = d.approvers || [];
                const cur = currentApproverOf(d);
                const myTurn = line.length > 0 ? (cur && STATE.currentUser && cur.id === STATE.currentUser.id) : canApproveDoc(d);
                if (myTurn) items.push({ id: 'appr_' + d.id, group: '결재', icon: 'stamp', color: 'text-amber-600', title: d.title, sub: line.length ? `내 결재 차례 (${line.filter(a=>a.status==='approved').length + 1}/${line.length}차)` : '결재 대기 · 승인/반려 필요', onclick: `notifOpen('doc', ${d.id})` });
            });
            // 1-2) 내가 열람자로 지정된 문서
            if (STATE.currentUser) STATE.documents.forEach(d => {
                if ((d.viewers || []).some(v => v.id === STATE.currentUser.id)) {
                    const st = (DOC_STATUS[d.status] || ['',''])[0];
                    items.push({ id: 'view_' + d.id + '_' + d.status, group: '열람', icon: 'eye', color: 'text-sky-600', title: d.title, sub: `열람 지정 문서 · ${st} · ${esc(d.author) || ''}`, onclick: `notifOpen('doc', ${d.id})` });
                }
            });
            // 2) 내가 올린 문서 반려됨
            STATE.documents.filter(d => d.status === 'rejected' && (d.author || '').trim() === myName).forEach(d => {
                items.push({ id: 'rej_' + d.id, group: '결재', icon: 'x-circle', color: 'text-rose-600', title: d.title, sub: '반려됨' + (d.rejectReason ? ' · ' + d.rejectReason : ''), onclick: `notifOpen('doc', ${d.id})` });
            });
            // 3) 내 담당 프로젝트 항목 + 마감/지연
            const _hasMe = myName || (STATE.currentUser && STATE.currentUser.id);
            if (_hasMe) STATE.projects.forEach(p => (p.items || []).forEach(it => {
                if (!isMine(it.managerId, it.manager)) return;
                let tag = '담당', col = 'text-indigo-600', ic = 'user-check', grp = '담당 · 후속조치';
                if (!it.done && it.end) { if (it.end < todayStr) { tag = '지연'; col = 'text-rose-600'; ic = 'alarm-clock'; grp = '마감 · 지연'; } else if (it.end <= soonStr) { tag = '마감임박'; col = 'text-amber-600'; ic = 'alarm-clock'; grp = '마감 · 지연'; } }
                if (it.done) return;
                items.push({ id: 'task_' + it.id, group: grp, icon: ic, color: col, title: it.info, sub: `${p.title} · ${tag}${it.end ? ' · ~' + it.end : ''}`, onclick: `notifOpen('proj', ${p.id}, '${it.id}')` });
            }));
            // 4) 회의 후속조치 (일별 업무 담당자 = 나)
            if (_hasMe) STATE.weeklyMeetings.forEach(m => (m.days || []).forEach(en => {
                if (isMine(en.managerId, en.manager)) items.push({ id: 'mday_' + en.id, group: '담당 · 후속조치', icon: 'list-checks', color: 'text-indigo-600', title: en.taskName || en.content || '회의 후속조치', sub: `${m.week} ${WEEKDAY_KO[en.weekday] || ''} 후속조치`, onclick: `notifOpen('meeting', ${m.id})` });
            }));
            // 5) 내 담당 AS 티켓 (완료 외)
            if (_hasMe) (STATE.tickets || []).forEach(t => {
                if (t.status !== 'done' && isMine(t.assigneeId, t.assignee)) items.push({ id: 'tkt_' + t.id, group: '현장 / AS', icon: 'wrench', color: 'text-rose-500', title: `${t.customer || ''} ${t.equipment || ''}`.trim() || 'AS 티켓', sub: `${(TICKET_STATUS[t.status] || ['',''])[0]} · ${t.issue || ''}`.slice(0, 60), onclick: `notifOpen('ticket', ${t.id})` });
            });
            // 5-2) 정기점검 도래/지연 설비
            (STATE.assets || []).forEach(a => {
                const info = assetPmInfo(a);
                if (info.state === 'overdue') items.push({ id: 'pm_' + a.id + '_' + info.next, group: '마감 · 지연', icon: 'server-cog', color: 'text-rose-600', title: a.name, sub: `정기점검 지연 (${info.next} 예정) · ${a.site || ''}`, onclick: `notifOpen('asset', ${a.id})` });
                else if (info.state === 'due') items.push({ id: 'pm_' + a.id + '_' + info.next, group: '마감 · 지연', icon: 'server-cog', color: 'text-amber-600', title: a.name, sub: `정기점검 D-${info.dday} (${info.next}) · ${a.site || ''}`, onclick: `notifOpen('asset', ${a.id})` });
            });
            // 6) 오늘 일정
            STATE.events.filter(e => (isAdmin || e.deptId === myDept) && e.startDate <= todayStr && e.endDate >= todayStr).forEach(e => {
                items.push({ id: 'evt_' + e.id, group: '오늘 일정', icon: 'calendar', color: 'text-blue-600', title: e.title, sub: `${e.site ? '[' + e.site + '] ' : ''}${e.startDate} ~ ${e.endDate}`, onclick: `notifOpen('calendar')` });
            });
            // 7) 재고 부족(안전재고 이하) — 관리자 또는 해당 품목 담당 부서
            (STATE.inventory || []).filter(isLowStock).sort((a, b) => (Number(a.stock) - Number(a.safeStock)) - (Number(b.stock) - Number(b.safeStock))).slice(0, 20).forEach(i => {
                if (!(isAdmin || (i.deptId && i.deptId === myDept))) return;
                items.push({ id: 'lowstock_' + i.id, group: '재고 부족', icon: 'package-x', color: 'text-rose-600', title: i.name, sub: `현재고 ${fmtNum(i.stock)}/${fmtNum(i.safeStock)} ${esc(i.unit || '')} · 발주 필요`, onclick: `notifOpen('inventory', ${i.id})` });
            });
            // 8) 발주 납기 임박/지남 · 견적 유효기간 임박/만료 — 관리자 또는 문서 담당 부서
            const _today0 = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
            const _ddayOf = (ds) => { if (!ds) return null; const p = String(ds).split('-').map(Number); if (!p[0] || !p[1] || !p[2]) return null; return Math.round((new Date(p[0], p[1] - 1, p[2]) - _today0) / 86400000); };
            (STATE.trade || []).forEach(t => {
                if (t.status === 'done') return;
                if (!(isAdmin || (t.deptId && t.deptId === myDept))) return;
                if (t.kind === 'po' && t.dueDate) {
                    const dd = _ddayOf(t.dueDate); if (dd === null || dd > 7 || dd < -90) return;
                    const over = dd < 0;
                    items.push({ id: 'tradedue_' + t.id, group: '납기 · 유효기간', icon: 'truck', color: over ? 'text-rose-600' : 'text-amber-600', title: `${t.docNo || '발주서'} 납기 ${over ? Math.abs(dd) + '일 지남' : (dd === 0 ? '오늘' : 'D-' + dd)}`, sub: [t.client, t.service].filter(Boolean).join(' · '), onclick: `notifOpen('trade', ${t.id})` });
                } else if (t.kind === 'quote' && t.validity) {
                    const dd = _ddayOf(t.validity); if (dd === null || dd > 7 || dd < -90) return;
                    const over = dd < 0;
                    items.push({ id: 'tradeval_' + t.id, group: '납기 · 유효기간', icon: 'file-clock', color: over ? 'text-rose-600' : 'text-amber-600', title: `${t.docNo || '견적서'} 유효기간 ${over ? '만료(' + Math.abs(dd) + '일 지남)' : (dd === 0 ? '오늘 만료' : 'D-' + dd)}`, sub: [t.client, t.service].filter(Boolean).join(' · '), onclick: `notifOpen('trade', ${t.id})` });
                }
            });
            return items;
        }
        function renderNotificationCenter() {
            const wrap = document.getElementById('dashboard-mytasks-wrap');
            const box = document.getElementById('dashboard-mytasks');
            const countEl = document.getElementById('dashboard-mytasks-count');
            const ackBtn = document.getElementById('dashboard-mytasks-ack');
            const allItems = buildNotifications();
            const dismissed = getDismissedNotif();
            const items = allItems.filter(n => !dismissed.has(n.id));
            STATE._notifIds = items.map(n => n.id);
            const seen = getSeenTasks();
            const unseen = items.filter(n => !seen.has(n.id)).length;
            // 헤더 종 배지
            const bell = document.getElementById('notif-bell-count');
            if (bell) { bell.innerText = unseen; bell.classList.toggle('hidden', unseen === 0); }
            if (!wrap || !box) return;
            if (items.length === 0) { wrap.classList.add('hidden'); box.innerHTML = ''; return; }
            wrap.classList.remove('hidden');
            if (countEl) { countEl.innerText = unseen; countEl.classList.toggle('hidden', unseen === 0); }
            if (ackBtn) ackBtn.classList.toggle('hidden', unseen === 0);
            const order = ['결재', '열람', '재고 부족', '납기 · 유효기간', '마감 · 지연', '담당 · 후속조치', '현장 / AS', '오늘 일정'];
            const groups = {};
            items.forEach(n => { (groups[n.group] = groups[n.group] || []).push(n); });
            box.innerHTML = order.filter(g => groups[g]).map(g => {
                const rows = groups[g].map(n => {
                    const isNew = !seen.has(n.id);
                    return `<div onclick="${n.onclick}" class="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 cursor-pointer transition-all flex items-center justify-between gap-3">
                        <div class="min-w-0 flex items-start gap-2.5">
                            <i data-lucide="${n.icon}" class="w-4 h-4 ${n.color} mt-0.5 flex-shrink-0"></i>
                            <div class="min-w-0"><div class="text-sm font-bold text-slate-800 truncate">${esc(n.title)} ${isNew ? '<span class=\'ml-1 inline-block w-2 h-2 rounded-full bg-rose-500 align-middle\'></span>' : ''}</div><div class="text-[12px] text-slate-400 truncate">${esc(n.sub)}</div></div>
                        </div>
                        <button onclick="event.stopPropagation(); dismissNotif('${n.id}')" title="이 알림 삭제" class="w-6 h-6 rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center flex-shrink-0"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                    </div>`;
                }).join('');
                return `<div class="space-y-1.5"><div class="text-[12px] font-bold text-slate-500 flex items-center gap-1.5">${esc(g)} <span class="text-slate-300">${groups[g].length}</span></div>${rows}</div>`;
            }).join('');
            if (window.lucide) lucide.createIcons();
        }
        function markAllNotifSeen() {
            try { const seen = getSeenTasks(); (STATE._notifIds || []).forEach(id => seen.add(id)); localStorage.setItem(seenTasksKey(), JSON.stringify([...seen])); } catch (e) { }
        }
        function notifOpen(kind, id, itemId) {
            markAllNotifSeen();
            const c = document.getElementById('dashboard-mytasks-count'); if (c) c.classList.add('hidden');
            const a = document.getElementById('dashboard-mytasks-ack'); if (a) a.classList.add('hidden');
            const b = document.getElementById('notif-bell-count'); if (b) b.classList.add('hidden');
            if (kind === 'doc') { switchTab('documents'); setTimeout(() => viewDocument(id), 60); }
            else if (kind === 'proj') { openProjectDetail(id, itemId || undefined); }
            else if (kind === 'meeting') { switchTab('weekly-meeting'); setTimeout(() => openMeetingDetail(id), 60); }
            else if (kind === 'ticket') { switchTab('field-support'); setTimeout(() => openTicketDetail(id), 60); }
            else if (kind === 'asset') { switchTab('assets'); }
            else if (kind === 'inventory') { switchTab('inventory'); setTimeout(() => { if (id) openInventoryDetail(id); else setInventoryView('dashboard'); }, 60); }
            else if (kind === 'trade') { switchTab('trade'); setTimeout(() => openTradeDetail(id), 60); }
            else if (kind === 'calendar') { switchTab('calendar'); }
        }
        function acknowledgeAndOpen(projId, itemId) { notifOpen('proj', projId, itemId); }
        function acknowledgeTasks() { markAllNotifSeen(); renderDashboardWidgets(); }
        function openNotifCenter() { switchTab('dashboard'); }