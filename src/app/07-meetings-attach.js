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
