        // ============================================================
        // 재고 고도화 1단계 — 발주 연계 · 미착/입고 현황 · 부분입고 · 평균단가
        // (전역 스코프 유지: onclick 에서 직접 호출)
        // ============================================================
        const ACCT_THRESHOLD = 1000000; // 회계재고 자동분류 기준: 입고 1건 금액 ≥ 100만원

        // 입고 이력 로드 — 테이블 미생성 시 안전하게 비활성화
        async function reloadPoReceipts() {
            if (typeof sb === 'undefined' || !sb || !sb.from) { STATE.poReceipts = []; return; }
            const { data, error } = await fetchAllPaged(() => sb.from('po_receipts').select('*').order('received_at', { ascending: false }));
            if (error) { STATE.poReceiptsMissing = true; STATE.poReceipts = []; return; }
            STATE.poReceiptsMissing = false;
            STATE.poReceipts = (data || []).map(r => ({
                id: r.id, tradeId: r.trade_id, lineIdx: Number(r.line_idx) || 0, itemId: r.item_id,
                description: r.description || '', qty: Number(r.qty) || 0, unitPrice: Number(r.unit_price) || 0,
                amount: Number(r.amount) || 0, warehouseId: r.warehouse_id, receivedAt: r.received_at,
                actor: r.actor || '', deptId: r.dept_id || ''
            }));
        }

        // 발주서 한 라인에 대한 누적 입고 수량
        function receivedQtyForLine(tradeId, lineIdx) {
            return (STATE.poReceipts || [])
                .filter(r => String(r.tradeId) === String(tradeId) && Number(r.lineIdx) === Number(lineIdx))
                .reduce((s, r) => s + (Number(r.qty) || 0), 0);
        }

        // 발주(po) 문서의 라인별 입고/미착 현황 목록
        function poLineStatusList() {
            const out = [];
            (STATE.trade || []).filter(t => t.kind === 'po').forEach(t => {
                (t.items || []).filter(it => !it.sub).forEach((it, idx) => {
                    const ordered = Number(it.qty) || 0;
                    const received = receivedQtyForLine(t.id, idx);
                    const pending = Math.max(0, ordered - received);
                    const match = (STATE.inventory || []).find(inv => inv.name && it.description && inv.name.trim() === it.description.trim());
                    const stat = received <= 0 ? 'pending' : (pending > 0 ? 'partial' : 'done');
                    out.push({
                        tradeId: t.id, docNo: t.docNo || ('#' + t.id), status: t.status, deptId: t.deptId, client: t.client || '',
                        lineIdx: idx, description: it.description || '', unit: it.unit || '', unitPrice: Number(it.unitPrice) || 0,
                        itemId: match ? match.id : null, ordered, received, pending,
                        progress: ordered > 0 ? Math.min(100, Math.round(received / ordered * 100)) : 0, stat,
                        createdAt: t.createdAt
                    });
                });
            });
            // 미착 우선 → 부분 → 완료, 그 안에서 최신 발주순
            const rank = { pending: 0, partial: 1, done: 2 };
            return out.sort((a, b) => (rank[a.stat] - rank[b.stat]) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        }

        function recvStatChip(stat) {
            if (stat === 'done') return chip('입고완료', 'success');
            if (stat === 'partial') return chip('부분입고', 'warn');
            return chip('미착', 'danger');
        }
        function recvWon(n) { return '₩' + fmtNum(n); }

        function setReceivingFilter(f) { STATE.receivingFilter = f; renderReceivingStatus(); }

        // 미착/입고 현황 화면
        function renderReceivingStatus() {
            const body = document.getElementById('inventory-receiving-body');
            const cards = document.getElementById('inventory-receiving-card-list');
            const tabs = document.getElementById('receiving-filter-tabs');
            if (!body) return;
            if (STATE.poReceiptsMissing) {
                const msg = emptyCell(7, 'database', '입고 이력 준비 필요', '관리자에게 1단계 SQL(po_receipts) 실행을 요청하세요.');
                body.innerHTML = msg; if (cards) cards.innerHTML = ''; return;
            }
            const f = STATE.receivingFilter || 'pending';
            const all = poLineStatusList();
            const counts = { all: all.length, pending: 0, partial: 0, done: 0 };
            all.forEach(r => counts[r.stat]++);
            if (tabs) {
                const mk = (key, label) => { const on = f === key; const n = key === 'all' ? counts.all : counts[key]; return `<button onclick="setReceivingFilter('${key}')" class="px-3 py-1.5 rounded-lg text-sm font-bold ${on ? 'bg-white shadow text-slate-800' : 'text-slate-500'}">${label} <span class="${on ? 'text-amber-600' : 'text-slate-400'}">${n}</span></button>`; };
                tabs.innerHTML = mk('pending', '미착') + mk('partial', '부분') + mk('done', '완료') + mk('all', '전체');
            }
            const list = all.filter(r => f === 'all' ? true : r.stat === f);
            if (!list.length) {
                body.innerHTML = emptyCell(7, 'package-check', f === 'pending' ? '미착 품목이 없습니다' : '해당 항목이 없습니다', f === 'pending' ? '모든 발주 품목이 입고되었습니다.' : '');
                if (cards) cards.innerHTML = `<div class="col-span-full">${emptyState('package-check', '해당 항목이 없습니다', '', true)}</div>`;
                return;
            }
            const manageable = (r) => STATE.profile && (STATE.profile.role === 'admin' || r.deptId === STATE.profile.deptId);
            const bar = (p, stat) => `<div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${stat === 'done' ? 'bg-emerald-500' : stat === 'partial' ? 'bg-amber-500' : 'bg-rose-400'}" style="width:${p}%"></div></div>`;
            body.innerHTML = list.map(r => {
                const recvBtn = (manageable(r) && r.pending > 0 && !STATE.tradeTableMissing)
                    ? `<button onclick="openReceiveModal(${r.tradeId},${r.lineIdx})" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">입고</button>`
                    : (r.pending <= 0 ? '<span class="text-[12px] text-emerald-600 font-bold">완료</span>' : '<span class="text-[12px] text-slate-400">권한 없음</span>');
                return `<tr class="border-t border-slate-100 hover:bg-slate-50/60">
                    <td class="py-2.5 pr-3 pl-1"><div class="font-bold text-slate-800">${esc(r.description)}</div><div class="text-[11px] text-slate-400">${esc(r.docNo)}${r.client ? ' · ' + esc(r.client) : ''}</div></td>
                    <td class="py-2.5 pr-3 text-right tabular-nums">${fmtNum(r.ordered)} <span class="text-[11px] text-slate-400">${esc(r.unit)}</span></td>
                    <td class="py-2.5 pr-3 text-right tabular-nums text-emerald-700 font-bold">${fmtNum(r.received)}</td>
                    <td class="py-2.5 pr-3 text-right tabular-nums ${r.pending > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}">${fmtNum(r.pending)}</td>
                    <td class="py-2.5 pr-3 w-32"><div class="flex items-center gap-2"><span class="text-[11px] text-slate-500 w-9 text-right tabular-nums">${r.progress}%</span>${bar(r.progress, r.stat)}</div></td>
                    <td class="py-2.5 pr-3">${recvStatChip(r.stat)}</td>
                    <td class="py-2.5 text-right">${recvBtn}</td>
                </tr>`;
            }).join('');
            if (cards) cards.innerHTML = list.map(r => {
                const recvBtn = (manageable(r) && r.pending > 0 && !STATE.tradeTableMissing)
                    ? `<button onclick="openReceiveModal(${r.tradeId},${r.lineIdx})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">입고</button>` : '';
                return `<div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                    <div class="flex items-start justify-between gap-2"><div class="min-w-0"><div class="font-bold text-slate-800 truncate">${esc(r.description)}</div><div class="text-[11px] text-slate-400 truncate">${esc(r.docNo)}${r.client ? ' · ' + esc(r.client) : ''}</div></div>${recvStatChip(r.stat)}</div>
                    <div class="mt-2 flex items-center gap-2 text-[12px]"><span class="text-slate-500">발주 <b class="text-slate-800">${fmtNum(r.ordered)}</b></span><span class="text-slate-500">입고 <b class="text-emerald-700">${fmtNum(r.received)}</b></span><span class="text-slate-500">미착 <b class="${r.pending > 0 ? 'text-rose-600' : 'text-slate-400'}">${fmtNum(r.pending)}</b> ${esc(r.unit)}</span></div>
                    <div class="mt-2 flex items-center gap-2"><span class="text-[11px] text-slate-500 w-9 text-right">${r.progress}%</span>${bar(r.progress, r.stat)}</div>
                    ${recvBtn ? `<div class="mt-2.5 flex justify-end">${recvBtn}</div>` : ''}
                </div>`;
            }).join('');
            if (window.lucide) lucide.createIcons();
        }

        // 부분 입고 모달
        function openReceiveModal(tradeId, lineIdx) {
            const t = (STATE.trade || []).find(x => String(x.id) === String(tradeId)); if (!t) return;
            if (!(STATE.profile && (STATE.profile.role === 'admin' || t.deptId === STATE.profile.deptId))) { showToast('권한 없음', '본인 부서의 발주만 입고 처리할 수 있습니다.'); return; }
            const line = (t.items || []).filter(it => !it.sub)[lineIdx]; if (!line) return;
            const ordered = Number(line.qty) || 0;
            const pending = Math.max(0, ordered - receivedQtyForLine(tradeId, lineIdx));
            if (pending <= 0) { showToast('이미 완료', '해당 품목은 전량 입고되었습니다.'); return; }
            const match = (STATE.inventory || []).find(inv => inv.name && line.description && inv.name.trim() === line.description.trim());
            STATE.receiveDraft = { tradeId, lineIdx, itemId: match ? match.id : null, description: line.description, unit: line.unit || '', ordered, pending, unitPrice: Number(line.unitPrice) || 0, deptId: t.deptId };
            const info = document.getElementById('receive-line-info');
            if (info) info.innerHTML = `<div class="font-bold text-slate-800">${esc(line.description)}</div><div class="text-[12px] text-slate-500 mt-0.5">${esc(t.docNo || '')} · 발주 ${fmtNum(ordered)}${esc(line.unit ? ' ' + line.unit : '')} · 미착 <b class="text-rose-600">${fmtNum(pending)}</b></div>${match ? '' : '<div class="text-[11px] text-amber-600 mt-1">※ 연동된 재고 품목이 없어, 입고 시 새 품목으로 자동 등록됩니다.</div>'}`;
            const qtyEl = document.getElementById('receive-qty'); if (qtyEl) { qtyEl.value = pending; qtyEl.max = pending; }
            const priceEl = document.getElementById('receive-price'); if (priceEl) priceEl.value = STATE.receiveDraft.unitPrice || '';
            fillWarehouseSelect('receive-warehouse', defaultWarehouseId());
            updateReceiveAmount();
            openModal('receive-modal');
        }
        function updateReceiveAmount() {
            const q = parseFloat((document.getElementById('receive-qty') || {}).value) || 0;
            const p = parseFloat((document.getElementById('receive-price') || {}).value) || 0;
            const amt = q * p;
            const el = document.getElementById('receive-amount-preview');
            if (el) el.innerHTML = `입고 금액 <b class="text-slate-800">${recvWon(amt)}</b>${amt >= ACCT_THRESHOLD ? ' <span class="wsp-chip bg-violet-50 text-violet-700 border-violet-200">회계재고 자동분류</span>' : ''}`;
        }
        async function submitReceive() {
            const d = STATE.receiveDraft; if (!d) return;
            const qty = parseFloat((document.getElementById('receive-qty') || {}).value) || 0;
            const price = parseFloat((document.getElementById('receive-price') || {}).value) || 0;
            const whId = parseInt((document.getElementById('receive-warehouse') || {}).value) || defaultWarehouseId();
            if (qty <= 0) { showToast('수량 확인', '입고 수량을 입력하세요.'); return; }
            if (qty > d.pending) { showToast('수량 초과', `미착 수량(${fmtNum(d.pending)})보다 많이 입고할 수 없습니다.`); return; }
            const btn = document.getElementById('receive-submit-btn'); if (btn) { btn.disabled = true; btn.textContent = '처리 중…'; }
            try {
                // 1) 입고 대상 재고품목 확보(없으면 자동 생성)
                let itemId = d.itemId;
                if (!itemId) {
                    const ins = await sb.from('inventory_items').insert({ name: d.description, sku: '', category: '', unit: d.unit || 'EA', stock: 0, safe_stock: 0, unit_price: price, supplier: '', location: '', dept_id: d.deptId || (STATE.profile ? STATE.profile.deptId : ''), notes: '발주 자동연동' }).select('id').single();
                    if (ins.error) { showToast('품목 생성 실패', ins.error.message); return; }
                    itemId = ins.data.id;
                }
                // 2) 재고 수량 반영(기존 검증된 RPC 재사용)
                const mv = await sb.rpc('apply_stock_move', { p_item_id: itemId, p_kind: 'in', p_qty: qty, p_reason: `${d.description} 발주 입고`, p_warehouse_id: whId });
                if (mv.error) {
                    const m = (mv.error.message || '');
                    if (m.indexOf('apply_stock_move') >= 0 || m.indexOf('function') >= 0) showToast('준비 필요', '재고 처리 함수(apply_stock_move) SQL을 먼저 실행하세요.');
                    else showToast('입고 실패', m);
                    return;
                }
                // 3) 입고 이력 + 가중평균 + 회계 자동분류(원자적 RPC)
                const rec = await sb.rpc('record_po_receipt', { p_trade_id: d.tradeId, p_line_idx: d.lineIdx, p_item_id: itemId, p_qty: qty, p_unit_price: price, p_warehouse_id: whId, p_description: d.description, p_actor: (STATE.profile ? STATE.profile.name : ''), p_actor_id: (STATE.currentUser ? STATE.currentUser.id : null), p_dept_id: d.deptId || (STATE.profile ? STATE.profile.deptId : '') });
                if (rec.error) {
                    const m = (rec.error.message || '');
                    if (m.indexOf('record_po_receipt') >= 0 || m.indexOf('function') >= 0 || m.indexOf('does not exist') >= 0) showToast('준비 필요', '입고 기록 함수(record_po_receipt) SQL을 먼저 실행하세요.');
                    else showToast('이력 기록 실패', m);
                    return;
                }
                const amt = qty * price;
                closeModal('receive-modal', true);
                showToast('입고 완료', `${esc(d.description)} ${fmtNum(qty)} 입고${amt >= ACCT_THRESHOLD ? ' · 회계재고로 분류' : ''}`);
                await reloadPoReceipts(); await reloadInventory(); await reloadInventoryStock();
                renderReceivingStatus();
                if (STATE.currentTab === 'inventory') renderInventory();
            } catch (e) { showToast('오류', String(e && e.message || e)); }
            finally { const b = document.getElementById('receive-submit-btn'); if (b) { b.disabled = false; b.textContent = '입고 처리'; } }
        }

        // 발주서 등록 시 라인 품목을 재고에 자동 연동(미존재 품목만 생성) — 요청 ①
        async function autoLinkPoToInventory(tradeId) {
            if (STATE.inventoryTableMissing) return 0;
            const t = (STATE.trade || []).find(x => String(x.id) === String(tradeId)); if (!t || t.kind !== 'po') return 0;
            const lines = (t.items || []).filter(it => !it.sub && it.description && it.description.trim());
            let created = 0;
            for (const it of lines) {
                const exists = (STATE.inventory || []).find(inv => inv.name && inv.name.trim() === it.description.trim());
                if (exists) continue;
                const ins = await sb.from('inventory_items').insert({ name: it.description.trim(), sku: '', category: '', unit: it.unit || 'EA', stock: 0, safe_stock: 0, unit_price: Number(it.unitPrice) || 0, supplier: t.client || '', location: '', dept_id: t.deptId || (STATE.profile ? STATE.profile.deptId : ''), notes: `발주 자동연동 (${t.docNo || ''})` });
                if (!ins.error) created++;
            }
            if (created > 0) { await reloadInventory(); }
            return created;
        }

        // 회계재고 수동 지정/제외(담당자) — 요청 ④. set_inventory_acct RPC가 acct_locked=true 로 잠가 자동분류가 덮어쓰지 않음
        async function toggleInventoryAcct(itemId, flag) {
            const it = (STATE.inventory || []).find(x => String(x.id) === String(itemId));
            if (it && !canManageInventory(it)) { showToast('권한 없음', '본인 부서 품목만 변경할 수 있습니다.'); return; }
            const rec = await sb.rpc('set_inventory_acct', { p_item_id: itemId, p_flag: !!flag });
            if (rec.error) {
                const m = (rec.error.message || '');
                if (m.indexOf('set_inventory_acct') >= 0 || m.indexOf('function') >= 0 || m.indexOf('does not exist') >= 0) showToast('준비 필요', '회계지정 함수(set_inventory_acct) SQL을 먼저 실행하세요.');
                else showToast('변경 실패', m);
                return;
            }
            showToast('회계재고', flag ? '회계재고로 지정했습니다.' : '회계재고에서 제외했습니다.');
            await reloadInventory();
            if (STATE.currentTab === 'inventory') renderInventory();
            if (STATE._openDetail && STATE._openDetail.type === 'inventory' && String(STATE._openDetail.id) === String(itemId)) openInventoryDetail(parseInt(itemId));
        }

        // ============================================================
        // 공통 목록 카드 렌더 헬퍼(DRY) — 모바일에서 표 대신 카드로 표시
        // buildCard(item) -> 카드 HTML 문자열. 빈 목록·아이콘 갱신을 일괄 처리.
        // ============================================================
        function renderListCards(containerId, items, buildCard, emptyHint) {
            const el = document.getElementById(containerId); if (!el) return;
            if (!items || !items.length) { el.innerHTML = `<div class="sm:col-span-2">${emptyState('inbox', emptyHint || '항목이 없습니다', '', true)}</div>`; if (window.lucide) lucide.createIcons(); return; }
            el.innerHTML = items.map(buildCard).join('');
            if (window.lucide) lucide.createIcons();
        }

        // 문서 허브 모바일 카드
        function documentCardHTML(doc) {
            const dept = STATE.departments.find(d => d.id === doc.deptId);
            const fileBadge = doc.storagePath ? '<i data-lucide="paperclip" class="w-3 h-3 inline-block text-blue-500"></i> ' : '';
            let actions = `<button onclick="event.stopPropagation();viewDocument(${doc.id})" class="text-blue-600 font-bold">열람</button>`;
            if ((doc.status === 'draft' || doc.status === 'rejected') && (isDocAuthor(doc) || STATE.profile.role === 'admin')) actions += `<button onclick="event.stopPropagation();submitDocForApproval(${doc.id})" class="text-amber-600 font-bold">결재요청</button>`;
            if (doc.status === 'pending' && canApproveDoc(doc)) actions += `<button onclick="event.stopPropagation();approveDoc(${doc.id})" class="text-emerald-600 font-bold">승인</button><button onclick="event.stopPropagation();rejectDoc(${doc.id})" class="text-rose-500 font-bold">반려</button>`;
            if (canManageDoc(doc)) actions += `<button onclick="event.stopPropagation();openEditDocument(${doc.id})" class="text-slate-500 font-bold">수정</button><button onclick="event.stopPropagation();deleteDocument(${doc.id})" class="text-rose-500 font-bold">삭제</button>`;
            return `<div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2" onclick="viewDocument(${doc.id})">
                <div class="flex items-start justify-between gap-2"><div class="min-w-0"><div class="font-bold text-slate-800 truncate">${fileBadge}${esc(doc.title)}</div><div class="text-[11px] text-slate-400 mt-0.5">${esc(doc.author) || '-'}${doc.date ? ' · ' + doc.date : ''}</div></div>${docStatusBadge(doc.status)}</div>
                <div class="flex items-center justify-between gap-2"><span class="wsp-chip ${dept ? dept.textTheme : 'bg-slate-100 text-slate-600 border-slate-200'}">${dept ? esc(dept.name) : '공통'}</span></div>
                <div class="flex flex-wrap gap-x-3 gap-y-1 text-[13px] pt-1 border-t border-slate-100" onclick="event.stopPropagation()">${actions}</div>
            </div>`;
        }

        // 프로젝트 진척 모바일 카드
        function projectCardHTML(proj) {
            const dept = STATE.departments.find(d => d.id === proj.deptId);
            const bar = (typeof statusFill !== 'undefined' && statusFill[proj.status]) ? statusFill[proj.status] : 'bg-slate-400';
            const manage = canManageProject(proj);
            return `<div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2" onclick="openProjectDetail(${proj.id})">
                <div class="flex items-start justify-between gap-2"><div class="font-bold text-slate-800 min-w-0 truncate">${esc(proj.title)}</div><span class="text-slate-500 font-mono font-bold text-sm flex-shrink-0">${proj.progress}%</span></div>
                <div class="text-[11px] text-slate-400">${dept ? esc(dept.name) : '전사'} · ${proj.startDate || '-'} ~ ${proj.endDate || '-'}</div>
                <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${bar} rounded-full" style="width:${proj.progress}%"></div></div>
                ${manage ? `<div class="flex justify-end pt-1 border-t border-slate-100" onclick="event.stopPropagation()"><button onclick="deleteProject(${proj.id})" class="text-rose-400 hover:text-rose-600 font-bold text-[13px]">삭제</button></div>` : ''}
            </div>`;
        }
