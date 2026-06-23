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
            await Promise.all([reloadEvents(), reloadProjects(), reloadDocuments(), reloadMeetings(), reloadSettings(), reloadProfiles(), reloadSites(), reloadTickets(), reloadAssets(), reloadInventory(), reloadStockMoves(), reloadInventoryOptions(), reloadTrade(), reloadPartners(), reloadWarehouses(), reloadInventoryStock(), reloadTaxonomy(), reloadCompletionReports(), reloadPoReceipts()]);
            await runMigrations();
            updateDataVersionBadge();
            renderCalendar(); renderDocuments(); renderDashboardNotice(); renderDashboardWidgets(); enhanceA11y(document);
        }
        // 실시간 재연결·탭 복귀 시: 끊긴 사이 놓친 변경을 따라잡는 전체 재동기화 (마이그레이션 제외, 중복 실행 방지)
        async function resyncAllData() {
            if (STATE._resyncing) return; STATE._resyncing = true;
            try {
                await Promise.all([reloadEvents(), reloadProjects(), reloadDocuments(), reloadMeetings(), reloadSettings(), reloadProfiles(), reloadSites(), reloadTickets(), reloadAssets(), reloadInventory(), reloadStockMoves(), reloadInventoryOptions(), reloadTrade(), reloadPartners(), reloadWarehouses(), reloadInventoryStock(), reloadTaxonomy(), reloadCompletionReports(), reloadPoReceipts()]);
                renderFilters(); renderCalendar(); renderDocuments(); renderDashboardNotice(); renderDashboardWidgets(); renderCustomFeaturesMenu();
                if (STATE.currentUser && STATE.currentTab) switchTab(STATE.currentTab);
                if (STATE._openDetail) refreshOpenDetail(STATE._openDetail.type);
                STATE._lastResync = Date.now();
            } catch (e) { } finally { STATE._resyncing = false; }
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
