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
            STATE.inventory = (data || []).map(r => ({ id: r.id, sku: r.sku || '', name: r.name, category: r.category || '', unit: r.unit || 'EA', stock: Number(r.stock) || 0, safeStock: Number(r.safe_stock) || 0, unitPrice: Number(r.unit_price) || 0, supplier: r.supplier || '', location: r.location || '', deptId: r.dept_id || '', notes: r.notes || '', avgPrice: Number(r.avg_price) || 0, inQtyTotal: Number(r.in_qty_total) || 0, inAmountTotal: Number(r.in_amount_total) || 0, acctFlag: !!r.acct_flag, acctAuto: !!r.acct_auto, acctLocked: !!r.acct_locked }));
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
            const dv = document.getElementById('inventory-dashboard-view'), lv = document.getElementById('inventory-list-view'), rv = document.getElementById('inventory-receiving-view');
            const td = document.getElementById('inv-tab-dashboard'), tl = document.getElementById('inv-tab-list'), tr = document.getElementById('inv-tab-receiving');
            const on = 'px-4 py-1.5 rounded-lg text-sm font-bold bg-white shadow text-slate-800', off = 'px-4 py-1.5 rounded-lg text-sm font-bold text-slate-500';
            [dv, lv, rv].forEach(el => { if (el) el.classList.add('hidden'); });
            [td, tl, tr].forEach(el => { if (el) el.className = off; });
            if (view === 'list') { if (lv) lv.classList.remove('hidden'); if (tl) tl.className = on; renderInventory(); }
            else if (view === 'receiving') { if (rv) rv.classList.remove('hidden'); if (tr) tr.className = on; renderReceivingStatus(); }
            else { if (dv) dv.classList.remove('hidden'); if (td) td.className = on; renderInventoryDashboard(); }
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
                    <td class="px-4 py-3"><div class="font-bold text-slate-800 flex items-center gap-1.5">${esc(i.name)}${i.acctFlag ? '<span class="wsp-chip bg-violet-50 text-violet-700 border-violet-200">회계</span>' : ''}</div><div class="text-[12px] text-slate-400 font-mono">${esc(i.sku) || '-'}</div></td>
                    <td class="px-4 py-3 text-slate-600">${esc(i.category) || '-'}</td>
                    <td class="px-4 py-3 text-right"><span class="font-bold ${low ? 'text-rose-600' : 'text-slate-800'}">${fmtNum(dispQty(i))}</span> <span class="text-[12px] text-slate-400">${esc(i.unit)}</span>${fw !== 'all' ? ` <span class="text-[11px] text-slate-300">/${fmtNum(i.stock)}</span>` : ''}${low ? ' ' + chip('부족', 'danger') : ''}</td>
                    <td class="px-4 py-3 text-right text-slate-500">${fmtNum(i.safeStock)}</td>
                    <td class="px-4 py-3 text-right text-slate-600">₩${fmtNum(i.unitPrice)}${i.avgPrice > 0 ? `<div class="text-[11px] text-emerald-600 font-bold" title="입고 가중평균">평균 ₩${fmtNum(i.avgPrice)}</div>` : ''}</td>
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
                        <div class="min-w-0"><div class="font-bold text-slate-800 truncate flex items-center gap-1.5">${esc(i.name)}${i.acctFlag ? '<span class="wsp-chip bg-violet-50 text-violet-700 border-violet-200 flex-shrink-0">회계</span>' : ''}</div><div class="text-[12px] text-slate-400 font-mono">${esc(i.sku) || '-'} ${i.category ? '· ' + esc(i.category) : ''}</div></div>
                        ${low ? chip('부족', 'danger') : chip('정상', 'success')}
                    </div>
                    <div class="flex items-end justify-between">
                        <div><span class="text-2xl font-extrabold ${low ? 'text-rose-600' : 'text-slate-800'}">${fmtNum(dispQty(i))}</span> <span class="text-[12px] text-slate-400">${esc(i.unit)}${fw !== 'all' ? ' /' + fmtNum(i.stock) : ''} (안전 ${fmtNum(i.safeStock)})</span>${i.avgPrice > 0 ? `<div class="text-[12px] text-emerald-600 font-bold mt-0.5">평균단가 ₩${fmtNum(i.avgPrice)}</div>` : ''}</div>
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
                        ${field('단가(기준)', '₩' + fmtNum(it.unitPrice))}
                        ${field('평균단가', it.avgPrice > 0 ? `<span class="text-emerald-600">₩${fmtNum(it.avgPrice)}</span>` : '-')}
                        ${field('재고 금액', '₩' + fmtNum(it.stock * (it.avgPrice > 0 ? it.avgPrice : it.unitPrice)))}
                        ${field('거래처', esc(it.supplier) || '-')}
                        ${field('보관 위치', esc(it.location) || '-')}
                    </div>
                    ${manage ? `<div class="border-t border-slate-100 pt-3 flex items-center justify-between gap-2 flex-wrap">
                        <div class="text-[12px] font-bold text-slate-500 flex items-center gap-1.5"><i data-lucide="calculator" class="w-3.5 h-3.5 text-violet-500"></i> 회계재고 ${it.acctFlag ? chip('지정됨', 'neutral') : '<span class="text-slate-400">미지정</span>'}${it.acctAuto ? ' <span class="text-[11px] text-violet-500">(자동분류 ≥100만원)</span>' : ''}${it.acctLocked ? ' <span class="text-[11px] text-slate-400">· 수동잠금</span>' : ''}</div>
                        <button onclick="toggleInventoryAcct(${it.id}, ${it.acctFlag ? 'false' : 'true'})" class="px-3 py-1.5 ${it.acctFlag ? 'border border-slate-200 text-slate-500 hover:bg-slate-50' : 'bg-violet-600 hover:bg-violet-700 text-white'} text-xs font-bold rounded-lg">${it.acctFlag ? '회계재고 제외' : '회계재고로 지정'}</button>
                    </div>` : ''}
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
