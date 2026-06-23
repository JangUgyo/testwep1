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
                renderListCards('project-card-list', projList, projectCardHTML, '등록된 프로젝트가 없습니다');
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
