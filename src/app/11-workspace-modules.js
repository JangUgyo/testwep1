        // ============================================================
        // 기준 HTML 워크스페이스 모듈
        // 공지 · 투두 · 업무일지 · 메신저 · 회계재고
        // ============================================================
        function workspaceDeptName(id) {
            const dept = (STATE.departments || []).find(d => d.id === id);
            return dept ? dept.name : (id || '전사');
        }

        function workspaceCanManage(deptId, ownerId) {
            if (!STATE.currentUser) return false;
            return STATE.profile.role === 'admin'
                || (!!deptId && deptId === STATE.profile.deptId)
                || (!!ownerId && ownerId === STATE.currentUser.id);
        }

        function workspaceDeptOptions(includeAll, selected) {
            const first = includeAll ? '<option value="all">전체 부서</option>' : '';
            return first + (STATE.departments || []).map(d =>
                `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${esc(d.name)}</option>`
            ).join('');
        }

        function workspaceSyncDeptSelect(id, includeAll, selected) {
            const el = document.getElementById(id); if (!el) return;
            const keep = selected != null ? selected : (el.value || (includeAll ? 'all' : STATE.profile.deptId));
            el.innerHTML = workspaceDeptOptions(includeAll, keep);
            if ([...el.options].some(o => o.value === keep)) el.value = keep;
        }

        function workspaceTableNotice(flag, name) {
            if (!STATE[flag]) return '';
            return `<div class="wsp-ref-surface p-6 text-center">
                <div class="t-card-title">${name} 데이터베이스 준비가 필요합니다.</div>
                <p class="t-page-sub mt-2">db/00-workspace-pro-db-full.sql을 Supabase SQL Editor에서 다시 실행해 주세요.</p>
            </div>`;
        }

        async function reloadDepartments() {
            try {
                const { data, error } = await sb.from('departments').select('*').order('sort_order', { ascending: true });
                if (error || !(data || []).length) return;
                const previous = STATE.departments || [];
                STATE.departments = data.filter(r => r.active !== false).map(r => {
                    const old = previous.find(d => d.id === r.id) || {};
                    return Object.assign({}, old, { id: r.id, name: r.name });
                });
                STATE.departments.forEach(d => { if (STATE.visibility[d.id] === undefined) STATE.visibility[d.id] = true; });
            } catch (e) { }
        }

        async function reloadNotices() {
            try {
                const { data, error } = await sb.from('notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(500);
                if (error) { STATE.noticesTableMissing = true; STATE.notices = []; return; }
                STATE.noticesTableMissing = false;
                STATE.notices = (data || []).map(r => ({
                    id: r.id, title: r.title || '', body: r.body || '', pinned: !!r.pinned,
                    deptId: r.dept_id || '', author: r.author || '', authorId: r.author_id || '',
                    createdAt: r.created_at || '', updatedAt: r.updated_at || ''
                }));
            } catch (e) { STATE.noticesTableMissing = true; STATE.notices = []; }
        }

        async function reloadTodos() {
            try {
                const { data, error } = await sb.from('todos').select('*').order('completed', { ascending: true }).order('due_date', { ascending: true }).limit(1000);
                if (error) { STATE.todosTableMissing = true; STATE.todos = []; return; }
                STATE.todosTableMissing = false;
                STATE.todos = (data || []).map(r => ({
                    id: r.id, title: r.title || '', detail: r.detail || '', owner: r.owner || '',
                    ownerId: r.owner_id || '', dueDate: r.due_date || '', completed: !!r.completed,
                    deptId: r.dept_id || '', createdBy: r.created_by || '', createdAt: r.created_at || ''
                }));
            } catch (e) { STATE.todosTableMissing = true; STATE.todos = []; }
        }

        async function reloadWorklogs() {
            try {
                const { data, error } = await sb.from('worklogs').select('*').order('work_date', { ascending: false }).order('id', { ascending: false }).limit(1000);
                if (error) { STATE.worklogsTableMissing = true; STATE.worklogs = []; return; }
                STATE.worklogsTableMissing = false;
                STATE.worklogs = (data || []).map(r => ({
                    id: r.id, workDate: r.work_date || '', projectId: r.project_id,
                    projectTitle: r.project_title || '', content: r.content || '', hours: Number(r.hours) || 0,
                    owner: r.owner || '', ownerId: r.owner_id || '', deptId: r.dept_id || '',
                    createdAt: r.created_at || ''
                }));
            } catch (e) { STATE.worklogsTableMissing = true; STATE.worklogs = []; }
        }

        async function reloadMessages() {
            try {
                const { data, error } = await sb.from('messages').select('*').order('created_at', { ascending: false }).limit(300);
                if (error) { STATE.messagesTableMissing = true; STATE.messages = []; return; }
                STATE.messagesTableMissing = false;
                STATE.messages = (data || []).map(r => ({
                    id: r.id, channel: r.channel || 'general', body: r.body || '', sender: r.sender || '',
                    senderId: r.sender_id || '', deptId: r.dept_id || '', createdAt: r.created_at || ''
                }));
            } catch (e) { STATE.messagesTableMissing = true; STATE.messages = []; }
        }

        function renderNotices() {
            const root = document.getElementById('notice-list'); if (!root) return;
            workspaceSyncDeptSelect('notice-filter-dept', true);
            if (STATE.noticesTableMissing) { root.innerHTML = workspaceTableNotice('noticesTableMissing', '공지사항'); return; }
            const q = ((document.getElementById('notice-search') || {}).value || '').trim().toLowerCase();
            const dept = ((document.getElementById('notice-filter-dept') || {}).value || 'all');
            const list = (STATE.notices || []).filter(n => {
                const text = `${n.title} ${n.body} ${n.author}`.toLowerCase();
                return (!q || text.indexOf(q) >= 0) && (dept === 'all' || n.deptId === dept);
            }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.createdAt).localeCompare(String(a.createdAt)));
            root.innerHTML = list.length ? list.map(n => {
                const manage = workspaceCanManage(n.deptId, n.authorId);
                const date = n.createdAt ? String(n.createdAt).slice(0, 10) : '';
                return `<article class="wsp-ref-surface p-5">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                ${n.pinned ? '<span class="badge" style="background:var(--wsp-warn-soft);color:var(--wsp-warn)">고정</span>' : ''}
                                <span class="badge" style="background:var(--wsp-accent-soft);color:var(--wsp-accent)">${esc(workspaceDeptName(n.deptId))}</span>
                                <h3 class="t-card-title">${esc(n.title)}</h3>
                            </div>
                            <div class="t-label mt-2">${esc(n.author || '작성자 미상')} · ${esc(date)}</div>
                        </div>
                        ${manage ? `<div class="flex gap-1"><button class="icon-btn" onclick="openNoticeForm(${n.id})" aria-label="편집"><i data-lucide="pencil" class="w-4 h-4"></i></button><button class="icon-btn" onclick="deleteNotice(${n.id})" aria-label="삭제"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>` : ''}
                    </div>
                    ${n.body ? `<p class="t-body mt-4 whitespace-pre-wrap leading-relaxed">${esc(n.body)}</p>` : ''}
                </article>`;
            }).join('') : emptyState('megaphone', '등록된 공지가 없습니다', '새 공지를 작성하면 전사에 실시간으로 공유됩니다.');
            if (window.lucide) lucide.createIcons();
        }

        function openNoticeForm(id) {
            const item = id ? (STATE.notices || []).find(n => n.id === id) : null;
            workspaceSyncDeptSelect('notice-dept', false, item ? item.deptId : STATE.profile.deptId);
            document.getElementById('notice-id').value = item ? item.id : '';
            document.getElementById('notice-title').value = item ? item.title : '';
            document.getElementById('notice-body').value = item ? item.body : '';
            document.getElementById('notice-pinned').checked = !!(item && item.pinned);
            document.getElementById('notice-form-title').textContent = item ? '공지 편집' : '공지 작성';
            const dept = document.getElementById('notice-dept');
            dept.disabled = STATE.profile.role !== 'admin';
            if (STATE.profile.role !== 'admin') dept.value = STATE.profile.deptId;
            openModal('notice-form-modal');
        }

        async function saveNotice(e) {
            e.preventDefault();
            const id = Number(document.getElementById('notice-id').value) || null;
            const payload = {
                title: document.getElementById('notice-title').value.trim(),
                body: document.getElementById('notice-body').value.trim(),
                pinned: document.getElementById('notice-pinned').checked,
                dept_id: document.getElementById('notice-dept').value || STATE.profile.deptId,
                updated_at: new Date().toISOString()
            };
            if (!id) { payload.author = STATE.currentUser.name; payload.author_id = STATE.currentUser.id; }
            const result = id ? await sb.from('notices').update(payload).eq('id', id) : await sb.from('notices').insert(payload);
            if (result.error) { showToast('저장 실패', result.error.message); return; }
            closeModal('notice-form-modal'); await reloadNotices(); renderNotices(); renderDashboardWidgets(); showToast('저장 완료', '공지사항이 반영되었습니다.');
        }

        async function deleteNotice(id) {
            if (!confirm('이 공지를 삭제할까요?')) return;
            const { error } = await sb.from('notices').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadNotices(); renderNotices(); showToast('삭제 완료', '공지가 삭제되었습니다.');
        }

        function renderTodos() {
            const root = document.getElementById('todo-list'); if (!root) return;
            workspaceSyncDeptSelect('todo-filter-dept', true);
            if (STATE.todosTableMissing) { root.innerHTML = workspaceTableNotice('todosTableMissing', '투두리스트'); return; }
            const q = ((document.getElementById('todo-search') || {}).value || '').trim().toLowerCase();
            const status = ((document.getElementById('todo-filter-status') || {}).value || 'open');
            const dept = ((document.getElementById('todo-filter-dept') || {}).value || 'all');
            const todayStr = formatDate(new Date());
            const list = (STATE.todos || []).filter(t => {
                const text = `${t.title} ${t.detail} ${t.owner}`.toLowerCase();
                const statusOk = status === 'all' || (status === 'done' ? t.completed : !t.completed);
                return (!q || text.indexOf(q) >= 0) && statusOk && (dept === 'all' || t.deptId === dept);
            });
            const all = STATE.todos || [];
            const stats = document.getElementById('todo-stats');
            if (stats) {
                const values = [
                    ['전체', all.length, 'list-checks'], ['미완료', all.filter(t => !t.completed).length, 'circle'],
                    ['오늘 마감', all.filter(t => !t.completed && t.dueDate === todayStr).length, 'calendar-clock'],
                    ['완료', all.filter(t => t.completed).length, 'circle-check']
                ];
                stats.innerHTML = values.map(v => `<div class="wsp-ref-kpi"><div class="wsp-ref-kpi-head"><span>${v[0]}</span><i data-lucide="${v[2]}" class="w-4 h-4"></i></div><div class="wsp-ref-kpi-value">${v[1]}</div></div>`).join('');
            }
            root.innerHTML = list.length ? list.map(t => {
                const manage = workspaceCanManage(t.deptId, t.ownerId);
                const overdue = !t.completed && t.dueDate && t.dueDate < todayStr;
                return `<div class="wsp-ref-surface p-4 flex items-start gap-3 ${t.completed ? 'opacity-65' : ''}">
                    <button onclick="toggleTodo(${t.id},${t.completed ? 'false' : 'true'})" class="mt-0.5 flex-shrink-0" aria-label="${t.completed ? '미완료로 변경' : '완료 처리'}">
                        <i data-lucide="${t.completed ? 'circle-check-big' : 'circle'}" class="w-5 h-5" style="color:var(${t.completed ? '--wsp-ok' : '--wsp-muted'})"></i>
                    </button>
                    <div class="min-w-0 flex-1">
                        <div class="t-body font-semibold ${t.completed ? 'line-through' : ''}">${esc(t.title)}</div>
                        ${t.detail ? `<div class="t-page-sub mt-1 whitespace-pre-wrap">${esc(t.detail)}</div>` : ''}
                        <div class="flex flex-wrap gap-2 mt-2 t-label"><span>${esc(t.owner || '담당자 미지정')}</span><span>·</span><span>${esc(workspaceDeptName(t.deptId))}</span>${t.dueDate ? `<span>·</span><span style="color:var(${overdue ? '--wsp-danger' : '--wsp-muted'})">${overdue ? '기한 초과 ' : ''}${esc(t.dueDate)}</span>` : ''}</div>
                    </div>
                    ${manage ? `<div class="flex gap-1"><button class="icon-btn" onclick="openTodoForm(${t.id})" aria-label="편집"><i data-lucide="pencil" class="w-4 h-4"></i></button><button class="icon-btn" onclick="deleteTodo(${t.id})" aria-label="삭제"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>` : ''}
                </div>`;
            }).join('') : emptyState('list-checks', '조건에 맞는 할 일이 없습니다', '필터를 바꾸거나 새 할 일을 등록해 보세요.');
            if (window.lucide) lucide.createIcons();
        }

        function populateTodoOwners(selected) {
            const el = document.getElementById('todo-owner'); if (!el) return;
            const users = (STATE.users || []).filter(u => u.approved);
            el.innerHTML = users.map(u => `<option value="${u.id}" ${u.id === selected ? 'selected' : ''}>${esc(u.name)} · ${esc(workspaceDeptName(u.deptId))}</option>`).join('');
            if (!el.value && STATE.currentUser) el.value = STATE.currentUser.id;
        }

        function openTodoForm(id) {
            const item = id ? (STATE.todos || []).find(t => t.id === id) : null;
            document.getElementById('todo-id').value = item ? item.id : '';
            document.getElementById('todo-title').value = item ? item.title : '';
            document.getElementById('todo-detail').value = item ? item.detail : '';
            document.getElementById('todo-due').value = item ? item.dueDate : '';
            document.getElementById('todo-completed').checked = !!(item && item.completed);
            document.getElementById('todo-form-title').textContent = item ? '할 일 편집' : '할 일 추가';
            populateTodoOwners(item ? item.ownerId : STATE.currentUser.id);
            workspaceSyncDeptSelect('todo-dept', false, item ? item.deptId : STATE.profile.deptId);
            const dept = document.getElementById('todo-dept');
            dept.disabled = STATE.profile.role !== 'admin';
            if (STATE.profile.role !== 'admin') dept.value = STATE.profile.deptId;
            openModal('todo-form-modal');
        }

        async function saveTodo(e) {
            e.preventDefault();
            const id = Number(document.getElementById('todo-id').value) || null;
            const ownerId = document.getElementById('todo-owner').value || STATE.currentUser.id;
            const owner = (STATE.users || []).find(u => u.id === ownerId);
            const payload = {
                title: document.getElementById('todo-title').value.trim(),
                detail: document.getElementById('todo-detail').value.trim(),
                owner: owner ? owner.name : STATE.currentUser.name,
                owner_id: ownerId,
                due_date: document.getElementById('todo-due').value || null,
                completed: document.getElementById('todo-completed').checked,
                dept_id: document.getElementById('todo-dept').value || STATE.profile.deptId,
                updated_at: new Date().toISOString()
            };
            if (!id) payload.created_by = STATE.currentUser.id;
            const result = id ? await sb.from('todos').update(payload).eq('id', id) : await sb.from('todos').insert(payload);
            if (result.error) { showToast('저장 실패', result.error.message); return; }
            closeModal('todo-form-modal'); await reloadTodos(); renderTodos(); renderDashboardWidgets(); showToast('저장 완료', '할 일이 반영되었습니다.');
        }

        async function toggleTodo(id, completed) {
            const { error } = await sb.from('todos').update({ completed: !!completed, updated_at: new Date().toISOString() }).eq('id', id);
            if (error) { showToast('변경 실패', error.message); return; }
            await reloadTodos(); renderTodos(); renderDashboardWidgets();
        }

        async function deleteTodo(id) {
            if (!confirm('이 할 일을 삭제할까요?')) return;
            const { error } = await sb.from('todos').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadTodos(); renderTodos(); renderDashboardWidgets();
        }

        function renderWorklogs() {
            const body = document.getElementById('worklog-list-body');
            const cards = document.getElementById('worklog-card-list');
            if (!body || !cards) return;
            workspaceSyncDeptSelect('worklog-filter-dept', true);
            if (STATE.worklogsTableMissing) {
                body.innerHTML = `<tr><td colspan="6">${workspaceTableNotice('worklogsTableMissing', '업무일지')}</td></tr>`;
                cards.innerHTML = workspaceTableNotice('worklogsTableMissing', '업무일지'); return;
            }
            const q = ((document.getElementById('worklog-search') || {}).value || '').trim().toLowerCase();
            const date = ((document.getElementById('worklog-filter-date') || {}).value || '');
            const dept = ((document.getElementById('worklog-filter-dept') || {}).value || 'all');
            const list = (STATE.worklogs || []).filter(w => {
                const text = `${w.projectTitle} ${w.content} ${w.owner}`.toLowerCase();
                return (!q || text.indexOf(q) >= 0) && (!date || w.workDate === date) && (dept === 'all' || w.deptId === dept);
            });
            const actions = w => workspaceCanManage(w.deptId, w.ownerId)
                ? `<button class="icon-btn" onclick="openWorklogForm(${w.id})" aria-label="편집"><i data-lucide="pencil" class="w-4 h-4"></i></button><button class="icon-btn" onclick="deleteWorklog(${w.id})" aria-label="삭제"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : '';
            body.innerHTML = list.length ? list.map(w => `<tr>
                <td class="whitespace-nowrap">${esc(w.workDate)}</td><td>${esc(w.projectTitle || '일반 업무')}</td>
                <td><div class="font-semibold">${esc(w.owner || '-')}</div><div class="t-label">${esc(workspaceDeptName(w.deptId))}</div></td>
                <td><div class="max-w-xl whitespace-pre-wrap">${esc(w.content)}</div></td><td class="whitespace-nowrap">${w.hours ? fmtNum(w.hours) + 'h' : '-'}</td>
                <td><div class="flex justify-end gap-1">${actions(w)}</div></td></tr>`).join('') : emptyCell(6, 'clipboard-list', '업무일지가 없습니다', '새 업무일지를 작성해 주세요.');
            cards.innerHTML = list.length ? list.map(w => `<article class="wsp-ref-surface p-4">
                <div class="flex justify-between gap-3"><div><div class="t-label">${esc(w.workDate)} · ${esc(workspaceDeptName(w.deptId))}</div><div class="t-card-title mt-1">${esc(w.projectTitle || '일반 업무')}</div></div><div class="flex gap-1">${actions(w)}</div></div>
                <p class="t-body mt-3 whitespace-pre-wrap">${esc(w.content)}</p><div class="t-label mt-3">${esc(w.owner || '-')} ${w.hours ? '· ' + fmtNum(w.hours) + 'h' : ''}</div>
            </article>`).join('') : emptyState('clipboard-list', '업무일지가 없습니다', '새 업무일지를 작성해 주세요.');
            if (window.lucide) lucide.createIcons();
        }

        function populateWorklogProjects(selected) {
            const el = document.getElementById('worklog-project'); if (!el) return;
            el.innerHTML = '<option value="">일반 업무</option>' + (STATE.projects || []).map(p =>
                `<option value="${p.id}" ${String(p.id) === String(selected || '') ? 'selected' : ''}>${esc(p.title)}</option>`
            ).join('');
        }

        function openWorklogForm(id) {
            const item = id ? (STATE.worklogs || []).find(w => w.id === id) : null;
            document.getElementById('worklog-id').value = item ? item.id : '';
            document.getElementById('worklog-date').value = item ? item.workDate : formatDate(new Date());
            document.getElementById('worklog-hours').value = item ? item.hours : 0;
            document.getElementById('worklog-content').value = item ? item.content : '';
            document.getElementById('worklog-form-title').textContent = item ? '업무일지 편집' : '업무일지 작성';
            populateWorklogProjects(item ? item.projectId : '');
            workspaceSyncDeptSelect('worklog-dept', false, item ? item.deptId : STATE.profile.deptId);
            const dept = document.getElementById('worklog-dept');
            dept.disabled = STATE.profile.role !== 'admin';
            if (STATE.profile.role !== 'admin') dept.value = STATE.profile.deptId;
            openModal('worklog-form-modal');
        }

        async function saveWorklog(e) {
            e.preventDefault();
            const id = Number(document.getElementById('worklog-id').value) || null;
            const projectId = Number(document.getElementById('worklog-project').value) || null;
            const project = (STATE.projects || []).find(p => p.id === projectId);
            const payload = {
                work_date: document.getElementById('worklog-date').value,
                project_id: projectId,
                project_title: project ? project.title : '',
                content: document.getElementById('worklog-content').value.trim(),
                hours: Number(document.getElementById('worklog-hours').value) || 0,
                dept_id: document.getElementById('worklog-dept').value || STATE.profile.deptId,
                updated_at: new Date().toISOString()
            };
            if (!id) { payload.owner = STATE.currentUser.name; payload.owner_id = STATE.currentUser.id; }
            const result = id ? await sb.from('worklogs').update(payload).eq('id', id) : await sb.from('worklogs').insert(payload);
            if (result.error) { showToast('저장 실패', result.error.message); return; }
            closeModal('worklog-form-modal'); await reloadWorklogs(); renderWorklogs(); renderDashboardWidgets(); showToast('저장 완료', '업무일지가 반영되었습니다.');
        }

        async function deleteWorklog(id) {
            if (!confirm('이 업무일지를 삭제할까요?')) return;
            const { error } = await sb.from('worklogs').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadWorklogs(); renderWorklogs(); renderDashboardWidgets();
        }

        function setMessageChannel(channel) {
            STATE.messageChannel = channel === 'department' ? 'department' : 'general';
            renderMessenger();
        }

        function renderMessenger() {
            const root = document.getElementById('message-list'); if (!root) return;
            const channel = STATE.messageChannel || 'general';
            const channelKey = channel === 'department' ? `dept:${STATE.profile.deptId}` : 'general';
            const general = document.getElementById('msg-channel-general');
            const dept = document.getElementById('msg-channel-dept');
            if (general) general.style.background = channel === 'general' ? 'var(--wsp-accent-soft)' : 'transparent';
            if (dept) dept.style.background = channel === 'department' ? 'var(--wsp-accent-soft)' : 'transparent';
            const title = document.getElementById('messenger-channel-title');
            if (title) title.textContent = channel === 'department' ? `# ${workspaceDeptName(STATE.profile.deptId)}` : '# 전사 공용';
            if (STATE.messagesTableMissing) { root.innerHTML = workspaceTableNotice('messagesTableMissing', '사내 메신저'); return; }
            const list = (STATE.messages || []).filter(m => m.channel === channelKey).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
            root.innerHTML = list.length ? list.map(m => {
                const mine = STATE.currentUser && m.senderId === STATE.currentUser.id;
                const canDelete = mine || STATE.profile.role === 'admin';
                const time = m.createdAt ? new Date(m.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                return `<div class="flex ${mine ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[86%] sm:max-w-[70%]">
                        <div class="t-label mb-1 ${mine ? 'text-right' : ''}">${esc(m.sender || '사용자')} · ${esc(time)}</div>
                        <div class="rounded-2xl px-4 py-3 t-body whitespace-pre-wrap relative group" style="background:${mine ? 'var(--wsp-accent)' : 'var(--wsp-surface-2)'};color:${mine ? 'var(--wsp-accent-ink)' : 'var(--wsp-ink)'}">
                            ${esc(m.body)}
                            ${canDelete ? `<button onclick="deleteMessage(${m.id})" class="ml-2 opacity-70 hover:opacity-100" aria-label="메시지 삭제">×</button>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('') : emptyState('message-square', '아직 메시지가 없습니다', '첫 메시지를 보내 대화를 시작해 보세요.', true);
            root.scrollTop = root.scrollHeight;
            if (window.lucide) lucide.createIcons();
        }

        async function sendMessage(e) {
            e.preventDefault();
            const input = document.getElementById('message-input');
            const body = (input.value || '').trim(); if (!body) return;
            const department = (STATE.messageChannel || 'general') === 'department';
            const payload = {
                channel: department ? `dept:${STATE.profile.deptId}` : 'general',
                body, sender: STATE.currentUser.name, sender_id: STATE.currentUser.id,
                dept_id: department ? STATE.profile.deptId : null
            };
            const { error } = await sb.from('messages').insert(payload);
            if (error) { showToast('전송 실패', error.message); return; }
            input.value = ''; await reloadMessages(); renderMessenger();
        }

        async function deleteMessage(id) {
            const { error } = await sb.from('messages').delete().eq('id', id);
            if (error) { showToast('삭제 실패', error.message); return; }
            await reloadMessages(); renderMessenger();
        }

        function renderAccountingInventory() {
            const body = document.getElementById('acct-inventory-body');
            const cards = document.getElementById('acct-inventory-cards');
            const stats = document.getElementById('acct-inventory-stats');
            if (!body || !cards || !stats) return;
            workspaceSyncDeptSelect('acct-inventory-dept', true);
            const q = ((document.getElementById('acct-inventory-search') || {}).value || '').trim().toLowerCase();
            const dept = ((document.getElementById('acct-inventory-dept') || {}).value || 'all');
            const all = (STATE.inventory || []).filter(i => i.acctFlag);
            const list = all.filter(i => {
                const text = `${i.name} ${i.sku} ${i.supplier} ${i.category}`.toLowerCase();
                return (!q || text.indexOf(q) >= 0) && (dept === 'all' || i.deptId === dept);
            });
            const totalQty = all.reduce((s, i) => s + Number(i.stock || 0), 0);
            const totalValue = all.reduce((s, i) => s + Number(i.stock || 0) * Number(i.avgPrice || i.unitPrice || 0), 0);
            const autoCount = all.filter(i => i.acctAuto && !i.acctLocked).length;
            const statData = [['회계 품목', all.length, 'calculator'], ['총 수량', fmtNum(totalQty), 'package-check'], ['재고 자산가액', fmtNum(totalValue) + '원', 'wallet-cards'], ['자동 분류', autoCount, 'sparkles']];
            stats.innerHTML = statData.map(v => `<div class="wsp-ref-kpi"><div class="wsp-ref-kpi-head"><span>${v[0]}</span><i data-lucide="${v[2]}" class="w-4 h-4"></i></div><div class="wsp-ref-kpi-value ${String(v[1]).length > 10 ? 'text-xl' : ''}">${v[1]}</div></div>`).join('');
            const action = i => `<button onclick="toggleInventoryAcct(${i.id},false).then(()=>renderAccountingInventory())" class="wsp-ref-btn wsp-ref-btn-ghost">회계 제외</button>`;
            body.innerHTML = list.length ? list.map(i => `<tr>
                <td><div class="font-semibold">${esc(i.name)}</div><div class="t-label font-mono">${esc(i.sku || '-')}</div></td>
                <td>${esc(i.category || '-')}</td><td>${esc(workspaceDeptName(i.deptId))}</td>
                <td class="text-right">${fmtNum(i.stock)} ${esc(i.unit || '')}</td><td class="text-right">${fmtNum(i.avgPrice || i.unitPrice)}원</td>
                <td class="text-right font-semibold">${fmtNum(Number(i.stock || 0) * Number(i.avgPrice || i.unitPrice || 0))}원</td>
                <td>${i.acctLocked ? '수동 지정' : (i.acctAuto ? '자동 분류' : '기존 지정')}</td><td class="text-right">${action(i)}</td>
            </tr>`).join('') : emptyCell(8, 'calculator', '회계 재고가 없습니다', '일반 재고의 품목 상세에서 회계재고로 지정할 수 있습니다.');
            cards.innerHTML = list.length ? list.map(i => `<article class="wsp-ref-surface p-4">
                <div class="flex justify-between gap-3"><div><div class="t-card-title">${esc(i.name)}</div><div class="t-label mt-1">${esc(i.sku || '-')} · ${esc(workspaceDeptName(i.deptId))}</div></div><span class="badge" style="background:var(--wsp-accent-soft);color:var(--wsp-accent)">회계</span></div>
                <div class="grid grid-cols-2 gap-3 mt-4"><div><div class="t-label">현재고</div><div class="t-body font-bold mt-1">${fmtNum(i.stock)} ${esc(i.unit || '')}</div></div><div><div class="t-label">자산가액</div><div class="t-body font-bold mt-1">${fmtNum(Number(i.stock || 0) * Number(i.avgPrice || i.unitPrice || 0))}원</div></div></div>
                <div class="mt-4">${action(i)}</div>
            </article>`).join('') : emptyState('calculator', '회계 재고가 없습니다', '일반 재고의 품목 상세에서 회계재고로 지정할 수 있습니다.');
            if (window.lucide) lucide.createIcons();
        }

        Object.assign(TAB_META, {
            dashboard: { title: '대시보드', desc: '사내 통합 운영 현황과 처리 대기 항목을 확인합니다.' },
            notice: { title: '공지사항', desc: '전사·부서 공지를 작성하고 실시간으로 공유합니다.' },
            calendar: { title: '캘린더', desc: '전 부서의 일정을 한 화면에서 관리합니다.' },
            'management-progress': { title: '프로젝트', desc: '부서별 프로젝트 진척을 칸반·목록·간트로 관리합니다.' },
            todo: { title: '투두리스트', desc: '담당자와 마감일이 있는 할 일을 관리합니다.' },
            worklog: { title: '업무일지', desc: '프로젝트별 일일 업무 내역과 투입 시간을 기록합니다.' },
            messenger: { title: '사내 메신저', desc: '전사 또는 내 부서 채널에서 실시간으로 대화합니다.' },
            'field-support': { title: '현장 AS 관리', desc: '고객사 장애 접수부터 처리 완료까지 관리합니다.' },
            assets: { title: '설비 · 점검 관리', desc: '현장 설비와 정기점검 일정을 관리합니다.' },
            'acct-inventory': { title: '회계 재고', desc: '회계 대상으로 지정된 재고와 자산가액을 조회합니다.' },
            documents: { title: '보고서 관리', desc: '사내 보고서를 등록하고 결재선·열람자를 관리합니다.' },
            'documents-pending': { title: '결재 대기함', desc: '검토와 승인을 기다리는 문서를 처리합니다.' },
            'documents-archive': { title: '승인 완료 보관함', desc: '승인이 끝난 문서를 조회하고 내려받습니다.' },
            'management-stats': { title: '권한 · 조직 관리', desc: '임직원 승인·권한·소속 부서를 관리합니다.' },
            'management-logs': { title: '보안 감사 로그', desc: '결재·삭제·권한 변경 이력을 점검합니다.' }
        });

        if (typeof REFERENCE_PAGE_ACTIONS !== 'undefined') {
            Object.assign(REFERENCE_PAGE_ACTIONS, {
                notice: [['primary', 'plus', '공지 작성', 'openNoticeForm()']],
                todo: [['primary', 'plus', '할 일 추가', 'openTodoForm()']],
                worklog: [['primary', 'plus', '업무일지 작성', 'openWorklogForm()']]
            });
        }
