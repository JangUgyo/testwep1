        // ── 대시보드 위젯 ────────────────────────────────────────────────
        function renderDashboardWidgets() {
            const isAdmin = STATE.profile.role === 'admin';
            const myDept = STATE.profile.deptId;
            const scope = (arr) => isAdmin ? arr : arr.filter(x => x.deptId === myDept);
            if (typeof renderActionInbox === 'function') renderActionInbox();
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
        function toggleSidebar() { const sb = document.getElementById('app-sidebar'); const bd = document.getElementById('sidebar-backdrop'); if (!sb) return; const open = sb.classList.toggle('open'); if (bd) bd.classList.toggle('hidden', !open); }
        function closeSidebar() { const sb = document.getElementById('app-sidebar'); const bd = document.getElementById('sidebar-backdrop'); if (sb) sb.classList.remove('open'); if (bd) bd.classList.add('hidden'); }

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

        function syncSidebarActiveState(id) { document.querySelectorAll('.sidebar-item').forEach(i => { i.classList.remove('active'); i.removeAttribute('aria-current'); }); const active = document.getElementById(`nav-${id}`); if (active) { active.classList.add('active'); active.setAttribute('aria-current', 'page'); } }

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
            const stack = STATE.modalStack || [];
            if (!stack.length) return;
            const m = document.getElementById(stack[stack.length - 1]);
            if (!m) return;
            if (e.key === 'Escape') { closeModal(stack[stack.length - 1]); return; }
            if (e.key !== 'Tab') return;
            // 포커스 트랩: Tab이 모달 밖으로 새어나가지 않도록 처음↔끝을 순환
            const sel = 'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
            const list = Array.from(m.querySelectorAll(sel)).filter(el => el.offsetParent !== null);
            if (!list.length) return;
            const first = list[0], last = list[list.length - 1];
            if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
            else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
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
                        if (!tab) { tab = document.createElement('button'); tab.className = 'drawer-expand-tab'; tab.title = '넓게 보기'; tab.onclick = (ev) => { ev.stopPropagation(); toggleModalMaximize(id); }; _pp.appendChild(tab); }
                        tab.innerHTML = '<i data-lucide="chevron-left" class="w-4 h-4"></i>';
                    }
                    requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('drawer-open')));
                    if (window.lucide) lucide.createIcons();
                }
                else { makeModalResizable(m); }
                if (_pp) { // 다이얼로그 시맨틱(스크린리더): role + aria-modal + 제목 라벨 연결
                    _pp.setAttribute('role', 'dialog'); _pp.setAttribute('aria-modal', 'true');
                    const titleEl = m.querySelector('h2, h3, h4, h5, [id$="-title"]');
                    if (titleEl) { if (!titleEl.id) titleEl.id = id + '-a11y-title'; _pp.setAttribute('aria-labelledby', titleEl.id); }
                }
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
            if (drawer) { const tab = m.querySelector('.drawer-expand-tab'); if (tab) { tab.innerHTML = `<i data-lucide="${on ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>`; tab.title = on ? '좁게 보기' : '넓게 보기'; } }
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