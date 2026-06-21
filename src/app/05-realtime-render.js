        function setupRealtime() {
            if (STATE._rt) return;
            const myGen = (STATE._rtGen = (STATE._rtGen || 0) + 1); // 채널 세대 — 재생성 시 옛 채널의 지연 콜백(CLOSED 등) 무시용
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
                .subscribe((status) => { if (myGen === STATE._rtGen) handleRealtimeStatus(status); });
            // 탭이 백그라운드였다가 다시 보일 때: 그 사이 놓친 변경 따라잡기 (중복 등록 방지)
            if (!STATE._rtVisBound) {
                STATE._rtVisBound = true;
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible' && STATE.currentUser) {
                        if (STATE._rtWasDown || !STATE._lastResync || (Date.now() - STATE._lastResync) > 30000) resyncAllData();
                    }
                });
            }
        }
        // 실시간 연결 상태 처리 — 끊김 감지 시 백오프 재연결, 복구 시 전체 재동기화로 일관성 유지
        function handleRealtimeStatus(status) {
            if (status === 'SUBSCRIBED') {
                STATE._rtRetry = 0;
                updateRealtimeStatus(true);
                if (STATE._rtWasDown) {
                    STATE._rtWasDown = false;
                    const downMs = STATE._rtDownSince ? (Date.now() - STATE._rtDownSince) : 0;
                    STATE._rtDownSince = 0;
                    // 순간 깜빡임(1.5초 미만)은 조용히 넘어가고, 실제 끊김만 재동기화
                    if (downMs > 1500) resyncAllData();
                    // 토스트는 실제 끊김(4초 초과)에 한해 최대 2분에 1번만 — 반복 알림 방지
                    const now = Date.now();
                    if (downMs > 4000 && (now - (STATE._rtLastToast || 0)) > 120000) {
                        STATE._rtLastToast = now;
                        showToast('실시간 재연결', '연결이 복구되어 최신 데이터로 동기화했습니다.');
                    }
                }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                if (!STATE._rtWasDown) { STATE._rtWasDown = true; STATE._rtDownSince = Date.now(); }
                updateRealtimeStatus(false);
                scheduleRealtimeReconnect();
            }
        }
        function scheduleRealtimeReconnect() {
            if (STATE._rtReconnectTimer) return; // 중복 예약 방지
            const retry = STATE._rtRetry = (STATE._rtRetry || 0) + 1;
            const delay = Math.min(30000, 1000 * Math.pow(2, retry - 1)); // 1·2·4·…초, 최대 30초 백오프
            STATE._rtReconnectTimer = setTimeout(() => {
                STATE._rtReconnectTimer = null;
                STATE._rtGen = (STATE._rtGen || 0) + 1; // 옛 채널 세대 무효화 → 제거 중 발생하는 CLOSED 콜백이 재연결을 다시 걸지 않음(루프 차단)
                const old = STATE._rt; STATE._rt = null;
                try { if (old) sb.removeChannel(old); } catch (e) {}
                setupRealtime(); // 채널 재생성 → 재구독되면 SUBSCRIBED 콜백에서 재동기화
            }, delay);
        }
        function updateRealtimeStatus(connected) {
            STATE._rtConnected = !!connected;
            const dot = document.getElementById('rt-status-dot'); if (!dot) return;
            dot.classList.toggle('rt-on', !!connected);
            dot.classList.toggle('rt-off', !connected);
            dot.title = connected ? '실시간 연결됨' : '실시간 재연결 중…';
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