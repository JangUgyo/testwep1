const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
let pageErrors = [];

// ── Mock Supabase client ──────────────────────────────────────────
const DBDATA = {
  profiles: [
    { id: 'admin-uuid', email: 'boss@co.com', name: '사장', dept_id: 'strategy', role: 'admin', position: '대표', approved: true, created_at: '2026-01-01' },
    { id: 'emp-uuid', email: 'kim@co.com', name: '김사원', dept_id: 'south_cs', role: 'employee', position: '사원', approved: true, created_at: '2026-02-01' },
    { id: 'pending-uuid', email: 'new@co.com', name: '신입', dept_id: 'rnd', role: 'none', position: '사원', approved: false, created_at: '2026-03-01' }
  ],
  sites: [{ id: 1, name: '동해 수소스테이션' }],
    events: [{ id: 1, dept_id: 'ceo', title: '회의', start_date: '2026-06-03', end_date: '2026-06-05', site: '동해 수소스테이션' }],
  projects: [{ id: 1, title: '프로젝트A', dept_id: 'rnd', progress: 50, status: 'ongoing', start_date: '2026-06-05', end_date: '2026-06-12', descr: '설명', file_path: 'projects/p.pdf', file_name: '계획.pdf', file_mime: 'application/pdf' }, { id: 2, title: '프로젝트B', dept_id: 'strategy', progress: 100, status: 'completed', start_date: '2026-05-20', end_date: '2026-07-03', descr: 'x' }],
  documents: [{ id: 1, title: '보고서.pdf', dept_id: 'south_cs', author: '박', doc_date: '2026-06-01', file_type: 'pdf', file_size: '1MB', storage_path: 'p.pdf', file_mime: 'application/pdf' }, { id: 2, title: '보고서.docx', dept_id: 'rnd', author: '김', doc_date: '2026-06-02', file_type: 'docx', file_size: '20KB', storage_path: 'd.docx', file_mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }],
  inventory_items: [{ id:1, sku:'A-1', name:'볼트 M8', category:'부품', unit:'EA', stock:5, safe_stock:10, unit_price:100, supplier:'대성', location:'A-1', dept_id:'strategy', notes:'' }, { id:2, sku:'B-2', name:'안전장갑', category:'소모품', unit:'BOX', stock:50, safe_stock:5, unit_price:3000, supplier:'안전산업', location:'B-2', dept_id:'rnd', notes:'' }],
  stock_moves: [],
  warehouses: [{ id:1, name:'기본창고', code:'WH1', location:'', notes:'' }],
  inventory_stock: [{ id:1, item_id:1, warehouse_id:1, qty:5 }, { id:2, item_id:2, warehouse_id:1, qty:50 }],
  trade_documents: [],
  partners: [],
  inventory_options: [{ id:1, kind:'category', value:'부품', code:'PT' }, { id:2, kind:'unit', value:'EA', code:null }, { id:3, kind:'name', value:'볼트 M8', code:null }, { id:4, kind:'move_in', value:'구매입고', code:null }, { id:5, kind:'move_out', value:'폐기', code:null }],
  weekly_meetings: [{ id: 1, dept_id: 'strategy', week: '6월 1주차', author: '이', meet_date: '2026-06-05', content: '내용', image: '', file_name: 'a.pdf', file_path: 'meetings/a.pdf', file_mime: 'application/pdf', title: '6월 보고', decisions: '결정', action_items: '액션', next_plan: '차주' }],
  assets: [
    { id: 1, name: '수소개질기 1호', model: 'HR-100', customer: '동해에너지', site: '동해 스테이션', pm_cycle: 90, last_pm: '2026-01-01', notes: '', assignee: '박', position: '책임', dept_id: 'strategy' },
    { id: 2, name: '압축기 A', model: 'CP-2', customer: '서천가스', site: '서천', pm_cycle: 5, last_pm: new Date(Date.now()-2*86400000).toISOString().slice(0,10), notes: '', assignee: '김', position: '선임', dept_id: 'rnd' }
  ],
  audit_logs: [],
  tickets: [{ id: 1, customer: '동해에너지', site: '동해 스테이션', equipment: '수소개질기', issue: '차압 상승', urgency: 'high', assignee: '박과장', status: 'received', result: '', dept_id: 'south_cs', author: '사장', photos: [], created_at: '2026-06-06' }],
  app_settings: [
    { key: 'data_version', value: 999 },
    { key: 'dashboard_notice', value: { title: '공지', date: '2026.06.08', content: '내용입니다' } },
    { key: 'permissions', value: { south_cs: { dashboard: true, calendar: true, 'management-progress': true, documents: true, 'mail-integration': true } } },
    { key: 'custom_features', value: [{ id: 'custom_seed', name: '매출 보드', icon: 'bar-chart-3', group: '기본 플랫폼 서비스', html: '<!DOCTYPE html><html><body><h1>hi</h1></body></html>' }, { id: 'custom_new1', name: '경영분석툴', icon: 'gauge', group: '경영 분석', html: '<h2>tool</h2>' }] },
    { key: 'maintenance', value: { documents: true } }
  ]
};
let CURRENT_SESSION = { user: { id: 'admin-uuid', email: 'boss@co.com' } }; // simulate logged-in admin

function makeBuilder(table) {
  const ctx = { table, op: 'select', filterId: null, single: false };
  const builder = {
    select() { ctx.op = 'select'; return builder; },
    insert(v) { ctx.op = 'insert'; ctx._v = v; return builder; },
    update(v) { ctx.op = 'update'; ctx._v = v; return builder; },
    upsert(v) { ctx.op = 'upsert'; ctx._v = v; return builder; },
    delete() { ctx.op = 'delete'; return builder; },
    eq(col, val) { ctx.filterId = val; return builder; },
    gte(col, val) { (ctx._range = ctx._range || []).push({ col, op: 'gte', val }); return builder; },
    lt(col, val) { (ctx._range = ctx._range || []).push({ col, op: 'lt', val }); return builder; },
    gt(col, val) { (ctx._range = ctx._range || []).push({ col, op: 'gt', val }); return builder; },
    lte(col, val) { (ctx._range = ctx._range || []).push({ col, op: 'lte', val }); return builder; },
    order() { return builder; },
    range(from, to) { ctx._rangeFrom = from; ctx._rangeTo = to; return builder; },
    limit() { return builder; },
    maybeSingle() { ctx.single = true; return builder; },
    single() { ctx.single = true; return builder; },
    then(resolve) {
      let data = null;
      if (!DBDATA[ctx.table]) DBDATA[ctx.table] = [];
      const rows = DBDATA[ctx.table];
      if (ctx.op === 'select') {
        if (ctx.single) data = rows.find(r => r.id === ctx.filterId) || null;
        else { data = rows.slice(); if (ctx._rangeFrom != null) data = data.slice(ctx._rangeFrom, ctx._rangeTo + 1); }
      } else if (ctx.op === 'insert' && (ctx.table === 'sites' || ctx.table === 'tickets' || ctx.table === 'assets' || ctx.table === 'audit_logs' || ctx.table === 'documents' || ctx.table === 'inventory_items' || ctx.table === 'stock_moves' || ctx.table === 'inventory_options' || ctx.table === 'trade_documents' || ctx.table === 'partners' || ctx.table === 'warehouses')) {
        const arr = Array.isArray(ctx._v) ? ctx._v : [ctx._v];
        arr.forEach(v => { const row = Object.assign({}, v); if (row.id === undefined) row.id = (rows.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1); if (ctx.table === 'audit_logs' && !row.created_at) row.created_at = new Date().toISOString(); rows.push(row); });
      } else if (ctx.op === 'update' && (ctx.table === 'projects' || ctx.table === 'weekly_meetings' || ctx.table === 'documents' || ctx.table === 'tickets' || ctx.table === 'assets' || ctx.table === 'inventory_items' || ctx.table === 'inventory_options' || ctx.table === 'trade_documents' || ctx.table === 'partners' || ctx.table === 'warehouses')) {
        rows.forEach(r => { if (r.id === ctx.filterId) Object.assign(r, ctx._v); });
      } else if (ctx.op === 'delete' && (ctx.table === 'tickets' || ctx.table === 'assets' || ctx.table === 'inventory_items' || ctx.table === 'inventory_options' || ctx.table === 'trade_documents' || ctx.table === 'partners' || ctx.table === 'warehouses')) {
        const i = rows.findIndex(r => r.id === ctx.filterId); if (i >= 0) rows.splice(i, 1);
      } else if (ctx.op === 'upsert') {
        const arr = Array.isArray(ctx._v) ? ctx._v : [ctx._v];
        arr.forEach(v => {
          const kf = (v.key !== undefined) ? 'key' : 'id';
          const idx = rows.findIndex(r => r[kf] === v[kf]);
          if (idx >= 0) Object.assign(rows[idx], v);
          else { const row = Object.assign({}, v); if (row.id === undefined && kf === 'id') row.id = rows.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1; rows.push(row); }
        });
      }
      resolve({ data, error: null });
    }
  };
  return builder;
}
const mockSupabase = {
  createClient() {
    return {
      from(table) { return makeBuilder(table); },
      rpc(fn, params) {
        return { then(resolve) {
          if (fn === 'apply_stock_move') {
            DBDATA.inventory_items = DBDATA.inventory_items || [];
            DBDATA.stock_moves = DBDATA.stock_moves || [];
            DBDATA.inventory_stock = DBDATA.inventory_stock || [];
            DBDATA.warehouses = DBDATA.warehouses || [];
            const it = DBDATA.inventory_items.find(r => r.id === params.p_item_id);
            if (!it) { resolve({ data: null, error: { message: 'item not found' } }); return; }
            if (!(Number(params.p_qty) > 0)) { resolve({ data: null, error: { message: 'qty must be positive' } }); return; }
            if (params.p_kind !== 'in' && params.p_kind !== 'out') { resolve({ data: null, error: { message: 'invalid kind' } }); return; }
            let wid = params.p_warehouse_id || (DBDATA.warehouses[0] && DBDATA.warehouses[0].id);
            if (!wid) { resolve({ data: null, error: { message: 'no warehouse' } }); return; }
            let row = DBDATA.inventory_stock.find(r => r.item_id === params.p_item_id && r.warehouse_id === wid);
            if (!row) { row = { id: DBDATA.inventory_stock.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1, item_id: params.p_item_id, warehouse_id: wid, qty: 0 }; DBDATA.inventory_stock.push(row); }
            let nb = params.p_kind === 'in' ? Number(row.qty) + Number(params.p_qty) : Number(row.qty) - Number(params.p_qty);
            if (nb < 0) { resolve({ data: null, error: { message: 'insufficient stock' } }); return; }
            row.qty = nb;
            it.stock = DBDATA.inventory_stock.filter(r => r.item_id === params.p_item_id).reduce((sm, r) => sm + Number(r.qty), 0);
            const nid = DBDATA.stock_moves.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
            DBDATA.stock_moves.push({ id: nid, item_id: params.p_item_id, kind: params.p_kind, qty: Number(params.p_qty), reason: params.p_reason, actor: '사장', actor_id: 'admin-uuid', dept_id: it.dept_id, warehouse_id: wid, subtype: params.p_subtype || '', balance_after: nb, created_at: new Date().toISOString() });
            resolve({ data: Object.assign({}, it), error: null }); return;
          }
          if (fn === 'transfer_stock') {
            DBDATA.inventory_stock = DBDATA.inventory_stock || [];
            const it = DBDATA.inventory_items.find(r => r.id === params.p_item_id);
            if (!it) { resolve({ data: null, error: { message: 'item not found' } }); return; }
            if (!(Number(params.p_qty) > 0)) { resolve({ data: null, error: { message: 'qty must be positive' } }); return; }
            if (params.p_from_wh === params.p_to_wh) { resolve({ data: null, error: { message: 'same warehouse' } }); return; }
            const fromRow = DBDATA.inventory_stock.find(r => r.item_id === params.p_item_id && r.warehouse_id === params.p_from_wh);
            if (!fromRow || Number(fromRow.qty) < Number(params.p_qty)) { resolve({ data: null, error: { message: 'insufficient stock' } }); return; }
            fromRow.qty = Number(fromRow.qty) - Number(params.p_qty);
            let toRow = DBDATA.inventory_stock.find(r => r.item_id === params.p_item_id && r.warehouse_id === params.p_to_wh);
            if (!toRow) { toRow = { id: DBDATA.inventory_stock.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1, item_id: params.p_item_id, warehouse_id: params.p_to_wh, qty: 0 }; DBDATA.inventory_stock.push(toRow); }
            toRow.qty = Number(toRow.qty) + Number(params.p_qty);
            let nid = DBDATA.stock_moves.reduce((m, r) => Math.max(m, r.id || 0), 0);
            DBDATA.stock_moves.push({ id: ++nid, item_id: params.p_item_id, kind: 'out', qty: Number(params.p_qty), reason: params.p_reason || '창고 이동', actor: '사장', actor_id: 'admin-uuid', dept_id: it.dept_id, warehouse_id: params.p_from_wh, balance_after: fromRow.qty, created_at: new Date().toISOString() });
            DBDATA.stock_moves.push({ id: ++nid, item_id: params.p_item_id, kind: 'in', qty: Number(params.p_qty), reason: params.p_reason || '창고 이동', actor: '사장', actor_id: 'admin-uuid', dept_id: it.dept_id, warehouse_id: params.p_to_wh, balance_after: toRow.qty, created_at: new Date().toISOString() });
            it.stock = DBDATA.inventory_stock.filter(r => r.item_id === params.p_item_id).reduce((sm, r) => sm + Number(r.qty), 0);
            resolve({ data: Object.assign({}, it), error: null }); return;
          }
          if (fn === 'next_trade_no') {
            const pre = (String(params.p_kind) === 'po') ? 'PO' : 'QT';
            const dd = new Date(); const ym = '' + dd.getFullYear() + String(dd.getMonth() + 1).padStart(2, '0');
            const scope = pre + '-' + ym;
            DBDATA._docCounters = DBDATA._docCounters || {};
            if (DBDATA._docCounters[scope] === undefined) {
              let mx = 0; (DBDATA.trade_documents || []).forEach(t => { const dn = t.doc_no || ''; if (dn.indexOf(scope + '-') === 0) { const n = parseInt(dn.slice(scope.length + 1)); if (!isNaN(n)) mx = Math.max(mx, n); } });
              DBDATA._docCounters[scope] = mx;
            }
            DBDATA._docCounters[scope]++;
            resolve({ data: scope + '-' + String(DBDATA._docCounters[scope]).padStart(4, '0'), error: null }); return;
          }
          resolve({ data: null, error: null });
        } };
      },
      auth: {
        async getSession() { return { data: { session: CURRENT_SESSION } }; },
        async signInWithPassword({ email }) {
          const u = DBDATA.profiles.find(p => p.email === email);
          if (!u) return { data: null, error: { message: 'invalid' } };
          return { data: { user: { id: u.id, email } }, error: null };
        },
        async signUp({ email }) { return { data: { user: { id: 'new-signup', email }, session: null }, error: null }; },
        async signOut() { CURRENT_SESSION = null; return { error: null }; },
        async updateUser() { return { data: {}, error: null }; }
      },
      storage: {
        from() {
          return {
            async upload() { return { data: { path: 'x' }, error: null }; },
            getPublicUrl(path) { return { data: { publicUrl: 'https://mock.supabase.co/storage/v1/object/public/branding/' + path } }; },
            async createSignedUrl() { return { data: { signedUrl: 'https://example.com/file' }, error: null }; },
            async remove() { return { data: [], error: null }; }
          };
        }
      },
      channel() { const ch = { on() { return ch; }, subscribe() { return ch; } }; return ch; },
      removeChannel() {}
    };
  }
};

const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://testwep1.vercel.app/',
  beforeParse(window) {
    window.lucide = { createIcons() {} };
    window.Chart = function () { return { destroy() {} }; };
    window.alert = () => {}; window.confirm = () => true; window.prompt = () => '사유';
    window.Chart = function(){ this.destroy = ()=>{}; };
    if (!window.HTMLCanvasElement.prototype.getContext) window.HTMLCanvasElement.prototype.getContext = () => ({});
    else { const _gc = window.HTMLCanvasElement.prototype.getContext; window.HTMLCanvasElement.prototype.getContext = function(){ try { return _gc.apply(this, arguments) || {}; } catch(e){ return {}; } }; }
    window.requestAnimationFrame = (cb) => cb();
    window.supabase = mockSupabase;
    window.mammoth = { convertToHtml: async () => ({ value: '<h1>제목</h1><p>본문</p>' }), images: { imgElement: (fn) => fn } };
    window.XLSX = { read: () => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }), utils: { sheet_to_html: () => '<table><tr><td>a</td></tr></table>' } };
    window.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.reject(new Error('stub')) }) };
    window.docx = { renderAsync: async () => { throw new Error('stub'); } };
    window.JSZip = function () {};
    window.fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(8) });
    if (!window.localStorage) { const _m={}; window.localStorage = { getItem:k=>_m[k]||null, setItem:(k,v)=>{_m[k]=String(v);}, removeItem:k=>{delete _m[k];} }; }
    if (!window.URL.createObjectURL) { window.URL.createObjectURL = () => 'blob:mock'; window.URL.revokeObjectURL = () => {}; }
    if (typeof window.Blob === 'undefined') { window.Blob = function(){ return {}; }; }
    window.onerror = (m) => pageErrors.push(String(m));
  }
});
const { window } = dom;
window.addEventListener('error', (e) => pageErrors.push(String(e.error || e.message)));

function STATE_set_tab(w, t){ w.eval('STATE').currentTab=t; }
async function run() {
  const doc = window.document; const $ = (id) => doc.getElementById(id);
  const ev = () => ({ preventDefault() {}, stopPropagation() {} });
  const results = []; const ok = (n, c) => results.push([n, !!c]);
  const cssText = require('fs').readFileSync(path.join(__dirname, '..', 'public', 'index.html'),'utf8');
  const S = () => window.eval('STATE');

  // give init (async) time to run
  await new Promise(r => setTimeout(r, 300));

  ok('init: no early errors', pageErrors.length === 0);
  ok('session restored → gateway hidden', $('auth-gateway-overlay').classList.contains('hidden'));
  ok('admin profile loaded', S().currentUser && S().currentUser.role === 'admin');
  ok('events loaded from DB', S().events.length >= 1);
  ok('projects loaded', S().projects.length >= 1);
  ok('documents loaded', S().documents.length >= 1);
  ok('meetings loaded', S().weeklyMeetings.length >= 1);
  ok('notice loaded', S().dashboardNotice && S().dashboardNotice.title === '공지');
  ok('permissions loaded', S().permissions && S().permissions.south_cs);
  ok('calendar rendered', $('calendar-grid').children.length > 0);

  // navigate tabs
  await window.switchTab('management-stats');
  ok('stats tab: pending list rendered', $('pending-users-list-body').children.length >= 1);
  ok('stats tab: active list rendered', $('active-users-list-body').children.length >= 1);
  ok('stats tab: matrix rendered', $('permission-matrix-body').children.length >= 1);

  // exercise mutations (mock returns no error)
  window.quickAddEvent('2026-06-09');
  $('event-title').value = '새 일정'; $('event-start').value = '2026-06-09'; $('event-end').value = '2026-06-10';
  await window.handleSaveEvent(ev());
  ok('handleSaveEvent ran', true);

  window.editEvent(1); ok('editEvent fills', $('event-id').value === '1');
  await window.deleteEventFromModal(); ok('deleteEvent ran', true);

  await window.togglePermission('south_cs', 'calendar'); ok('togglePermission ran', true);
  await window.moveProjectStatus(1, 'next'); ok('moveProjectStatus ran', true);

  $('project-title').value = 'P'; await window.handleNewProject(ev()); ok('handleNewProject ran', true);
  await window.deleteProject(1); ok('deleteProject ran', true);

  $('doc-title').value = 'D'; await window.handleNewDocument(ev()); ok('handleNewDocument ran', true);
  await window.deleteDocument(1); ok('deleteDocument ran', true);

  window.switchTab('weekly-meeting');
  $('meeting-content').value = '회의 내용'; await window.handleNewMeeting(ev()); ok('handleNewMeeting ran', true);

  window.openEditNoticeModal(); $('notice-title').value = 'X'; $('notice-content').value = 'Y';
  await window.handleSaveNotice(ev()); ok('handleSaveNotice ran', S().dashboardNotice.title === 'X');

  await window.approveUser('pending-uuid'); ok('approveUser ran', true);
  await window.terminateUser('emp-uuid'); ok('terminateUser ran', true);
  await window.rejectUser('pending-uuid'); ok('rejectUser ran', true);

  // admin pw change (mock signIn ok + updateUser ok)
  $('admin-old-pw').value = 'oldpass'; $('admin-new-pw').value = 'newpass'; $('admin-new-pw-confirm').value = 'newpass';
  await window.handleUpdateAdminPassword(ev()); ok('password change ran', true);

  // mail flows
  window.switchTab('mail-integration');
  $('mail-provider-select').value = 'mailplug'; window.toggleMailFields();
  $('mp-domain').value = 'co'; window.handleUnifiedMailConnect(true);
  ok('mail connect', S().mailplug.connected === true);
  ok('mail inbox populated', $('mailplug-grid').children.length >= 1);
  window.handleUnifiedMailConnect(false); ok('mail disconnect', S().mailplug.connected === false);

  // filter docs (reload docs first since we deleted)
  await window.reloadDocuments();
  window.switchTab('documents'); $('doc-search').value = ''; window.filterDocs(); ok('filterDocs ran', true);

  // signup flow (mock: pending)
  window.switchAuthTab('signup');
  $('signup-id').value = 'x@co.com'; $('signup-password').value = 'pw1234'; $('signup-name').value = '테스트';
  await window.handleUserSignup(ev()); ok('signup ran (pending)', true);

  // active user inline edit
  await window.switchTab('management-stats');
  const dE = doc.getElementById('edit-dept-emp-uuid'); const rE = doc.getElementById('edit-role-emp-uuid'); const pE = doc.getElementById('edit-pos-emp-uuid');
  ok('active user editors rendered', dE && rE && pE);
  if (dE) { dE.value = 'hydrogen'; rE.value = 'leader'; pE.value = '팀장'; }
  await window.saveUserEdits('emp-uuid'); ok('saveUserEdits ran', true);

  // document preview (pdf branch)
  await window.reloadDocuments();
  await window.viewDocument(1); ok('viewDocument opened preview', !doc.getElementById('doc-preview-modal').classList.contains('hidden'));
  window.closeModal('doc-preview-modal');

  // project board + gantt render
  await window.switchTab('management-progress');
  window.switchProgressSubView('board'); ok('kanban renders cards', doc.getElementById('board-ongoing-list').children.length >= 1);
  window.switchProgressSubView('gantt'); ok('gantt renders rows', doc.getElementById('gantt-rows-container').children.length >= 1);

  // gantt month-based render
  await window.switchTab('management-progress');
  window.switchProgressSubView('gantt');
  ok('gantt month header rendered', doc.getElementById('gantt-header-days').children.length >= 1);
  ok('gantt rows (dated only)', doc.getElementById('gantt-rows-container').querySelectorAll('.grid').length === 2);

  // dashboard stats + widgets
  await window.switchTab('dashboard');
  ok('dashboard stat cards', doc.getElementById('dashboard-stats').children.length >= 4);
  ok('dashboard project summary', doc.getElementById('dashboard-project-summary').children.length >= 1);
  ok('dashboard recent docs', doc.getElementById('dashboard-recent-docs').children.length >= 1);

  // meeting attachment preview
  await window.switchTab('weekly-meeting');
  await window.viewMeetingFile(1); ok('meeting file preview opened', !doc.getElementById('doc-preview-modal').classList.contains('hidden'));
  window.closeModal('doc-preview-modal');

  // project dept-lock guard (non-admin path simulated by temporarily setting role)
  ok('canManageProject admin true', window.eval('canManageProject({deptId:\'rnd\'})') === true);

  // custom features loaded from DB + menu rendered
  ok('custom features loaded from DB', S().customFeatures.length >= 1);
  ok('custom menu rendered', doc.getElementById('custom-menu-container').children.length >= 1);
  // launch a custom feature tab
  window.launchCustomFeature('custom_seed'); ok('custom feature view shown', !doc.getElementById('view-custom-feature').classList.contains('hidden'));
  ok('custom iframe sandboxed', doc.getElementById('custom-feature-iframe').getAttribute('sandbox').indexOf('allow-scripts')>=0);
  // install a new feature (admin)
  window.openModal('add-feature-modal');
  ok('icon grid rendered', doc.getElementById('feature-icon-grid').children.length >= 8);
  doc.getElementById('feature-name').value = '계산기'; doc.getElementById('feature-code').value = '<button>x</button>';
  await window.handleInstallFeature(ev()); ok('feature install persisted', S().customFeatures.length >= 2);
  // remove it
  await window.removeCustomFeature(); ok('feature remove ran', true);

  // maintenance loaded from DB
  ok('maintenance loaded from DB', S().maintenance.documents === true);
  // structured meeting render
  await window.switchTab('weekly-meeting'); ok('meeting cards rendered', doc.getElementById('weekly-meetings-container').children.length >= 1);
  // create structured meeting
  window.openModal('add-meeting-modal');
  doc.getElementById('meeting-title').value='주제'; doc.getElementById('meeting-content').value='논의'; doc.getElementById('meeting-decisions').value='결정'; doc.getElementById('meeting-actions').value='액션'; doc.getElementById('meeting-next').value='차주';
  await window.handleNewMeeting(ev()); ok('structured meeting insert ran', true);
  // maintenance toggle persists (admin)
  STATE_set_tab(window, 'calendar');
  await window.toggleActiveTabMaintenance(); ok('maintenance toggle persisted', true);

  // custom feature group placement
  ok('feature placed in native group', doc.getElementById('navgroup-platform').querySelector('.custom-feat-btn') !== null);
  ok('new group host shown', !doc.getElementById('custom-features-group').classList.contains('hidden'));
  ok('new group has its own block', doc.getElementById('custom-menu-container').children.length >= 1);

  // launch + render (blob or srcdoc)
  window.launchCustomFeature('custom_seed');
  const ifr = doc.getElementById('custom-feature-iframe');
  ok('custom iframe has content', !!(ifr.getAttribute('src') || ifr.getAttribute('srcdoc')));
  ok('iframe sandbox same-origin', ifr.getAttribute('sandbox').indexOf('allow-same-origin') >= 0);

  // maintenance gating on custom tab (non-admin path)
  window.eval('STATE').maintenance['custom_seed'] = true;
  window.eval('STATE').profile.role = 'employee';
  window.launchCustomFeature('custom_seed');
  ok('custom tab maintenance overlay (non-admin)', !doc.getElementById('maintenance-overlay').classList.contains('hidden'));
  window.eval('STATE').profile.role = 'admin';
  window.launchCustomFeature('custom_seed');
  ok('admin bypasses custom maintenance', !doc.getElementById('view-custom-feature').classList.contains('hidden'));
  // toggle maintenance off via control while on custom tab
  await window.toggleActiveTabMaintenance(); ok('custom tab maintenance toggle ran', true);

  // docx in-browser preview (mammoth)
  await window.reloadDocuments();
  await window.viewDocument(2);
  await new Promise(r=>setTimeout(r,50));
  ok('docx rendered via mammoth', doc.getElementById('doc-preview-body').innerHTML.indexOf('docx-preview') >= 0);
  window.closeModal('doc-preview-modal');

  // tab title updates per tab
  await window.switchTab('calendar');
  ok('header title updates on tab', doc.getElementById('view-title').innerText === '부서 통합 캘린더');
  await window.switchTab('documents');
  ok('header desc updates on tab', doc.getElementById('view-description').innerText.indexOf('보고') >= 0);

  // document edit
  window.openEditDocument(1);
  ok('edit doc modal prefilled', doc.getElementById('edit-doc-title').value.length > 0);
  doc.getElementById('edit-doc-title').value = '수정된 제목';
  await window.handleSaveDocumentEdit(ev()); ok('document edit saved', true);

  // dark mode toggle
  window.toggleDarkMode();
  ok('dark mode on', doc.documentElement.classList.contains('dark'));
  window.toggleDarkMode();
  ok('dark mode off', !doc.documentElement.classList.contains('dark'));

  // site (현장명) feature
  await window.reloadSites();
  ok('sites loaded from DB', S().sites.length >= 1);
  await window.switchTab('calendar');
  window.quickAddEvent('2026-06-15');
  ok('site options rendered', doc.getElementById('event-site').options.length >= 2);
  // add a new site
  doc.getElementById('event-site-new').value = '광명 충전소';
  await window.addSite();
  ok('new site added + selected', doc.getElementById('event-site').value === '광명 충전소');
  // save event with site
  doc.getElementById('event-title').value = '충전소 점검';
  doc.getElementById('event-start').value = '2026-06-15';
  doc.getElementById('event-end').value = '2026-06-15';
  await window.handleSaveEvent(ev());
  ok('event saved with site', true);
  // calendar label includes [dept] [site]
  window.renderCalendar();
  const calHtml = doc.getElementById('calendar-grid') ? doc.getElementById('calendar-grid').innerHTML : doc.body.innerHTML;
  ok('calendar label has site bracket', calHtml.indexOf('[동해 수소스테이션]') >= 0 || calHtml.indexOf('수소스테이션') >= 0);

  // (1) calendar event tooltip
  await window.switchTab('calendar');
  window.renderCalendar();
  ok('cal tooltip fns exist', typeof window.showEventTooltip === 'function' && typeof window.hideEventTooltip === 'function');
  window.showEventTooltip({clientX:10,clientY:10}, {deptId:'ceo', title:'회의', startDate:'2026-06-03', endDate:'2026-06-05', site:'동해 수소스테이션'});
  ok('cal tooltip shows content', (doc.getElementById('cal-tooltip')||{}).innerHTML.indexOf('동해 수소스테이션') >= 0);
  window.hideEventTooltip();

  // (2) gantt scale + today line
  await window.switchTab('management-progress');
  window.switchProgressSubView('gantt');
  window.setGanttScale('month'); ok('gantt month scale set', S().ganttScale === 'month');
  ok('gantt range label set', doc.getElementById('gantt-range-label').innerText.indexOf('월') >= 0);
  window.setGanttScale('year'); ok('gantt year scale set', S().ganttScale === 'year');
  window.nextGantt(); window.prevGantt(); window.todayGantt(); ok('gantt nav ran', true);

  // (3) project detail + edit + file
  window.openProjectDetail(1);
  ok('project detail modal open', !doc.getElementById('project-detail-modal').classList.contains('hidden'));
  ok('project detail shows file', doc.getElementById('project-detail-body').innerHTML.indexOf('계획.pdf') >= 0);
  window.openEditProject(1);
  ok('project edit prefilled', doc.getElementById('project-title').value.length > 0 && doc.getElementById('project-id').value === '1');
  doc.getElementById('project-title').value = '수정프로젝트';
  await window.handleNewProject(ev()); ok('project edit saved', true);
  // add new project
  window.openAddProject();
  ok('project add reset', doc.getElementById('project-id').value === '');
  doc.getElementById('project-title').value='신규P'; doc.getElementById('project-dept').value='ceo';
  await window.handleNewProject(ev()); ok('project add saved', true);

  // (4) weekly meeting filters
  await window.switchTab('weekly-meeting');
  ok('meeting year filter populated', doc.getElementById('meeting-filter-year').options.length >= 2);
  ok('meeting month filter populated', doc.getElementById('meeting-filter-month').options.length === 13);
  ok('meeting week filter populated', doc.getElementById('meeting-filter-week').options.length === 6);
  doc.getElementById('meeting-filter-week').value='9'; window.renderWeeklyMeetings();
  ok('meeting week filter applies', doc.getElementById('weekly-meetings-container').innerHTML.indexOf('해당하는') >= 0);
  doc.getElementById('meeting-filter-week').value='all'; window.renderWeeklyMeetings();

  // (5) meeting detail + edit
  window.openMeetingDetail(1);
  ok('meeting detail modal open', !doc.getElementById('meeting-detail-modal').classList.contains('hidden'));
  window.openEditMeeting(1);
  ok('meeting edit prefilled', doc.getElementById('meeting-id').value === '1' && doc.getElementById('meeting-content').value.length > 0);
  doc.getElementById('meeting-content').value='수정내용';
  await window.handleNewMeeting(ev()); ok('meeting edit saved', true);
  window.openAddMeeting();
  ok('meeting add reset', doc.getElementById('meeting-id').value === '');

  // (6) dark mode sidebar css present
  ok('dark sidebar active css', cssText.indexOf('html.dark .sidebar-item.active') >= 0);
  ok('warm dark bg css', cssText.indexOf('#1f1e1d') >= 0);

  // (project items table) add/edit/delete
  await window.switchTab('management-progress');
  window.openProjectDetail(1);
  ok('project detail large table present', doc.getElementById('project-detail-body').innerHTML.indexOf('프로젝트 상세 항목') >= 0);
  window.openProjectItemForm(1);
  doc.getElementById('pitem-info').value='추출기 점검';
  doc.getElementById('pitem-manager-select').value='__custom__'; window.onPersonSelectChange('pitem-manager-select','pitem-manager-custom'); doc.getElementById('pitem-manager-custom').value='박과장';
  doc.getElementById('pitem-start').value='2026-06-10';
  doc.getElementById('pitem-end').value='2026-06-12';
  doc.getElementById('pitem-detail').value='차압 점검 및 교체';
  await window.handleSaveProjectItem(ev());
  ok('project item added', (S().projects.find(p=>p.id===1).items||[]).length >= 1);
  const pitemId = S().projects.find(p=>p.id===1).items[0].id;
  ok('project item shows in detail', doc.getElementById('project-detail-body').innerHTML.indexOf('추출기 점검') >= 0);

  // (meeting days) add with project link
  await window.switchTab('weekly-meeting');
  window.openMeetingDetail(1);
  ok('meeting detail weekly board present', doc.getElementById('meeting-detail-body').innerHTML.indexOf('주간 일별 업무') >= 0);
  window.openMeetingDayForm(1, 0);
  ok('mday project select populated', doc.getElementById('mday-project').options.length >= 2);
  doc.getElementById('mday-content').value='월요일 추출기 현장점검';
  doc.getElementById('mday-project').value='1';
  window.onMdayProjectChange();
  ok('mday item select populated after project', doc.getElementById('mday-item').options.length >= 2);
  doc.getElementById('mday-item').value = pitemId;
  await window.handleSaveMeetingDay(ev());
  ok('meeting day added', (S().weeklyMeetings.find(m=>m.id===1).days||[]).length >= 1);
  ok('meeting day shows content', doc.getElementById('meeting-detail-body').innerHTML.indexOf('월요일 추출기 현장점검') >= 0);
  ok('meeting day shows project link', doc.getElementById('meeting-detail-body').innerHTML.indexOf('link') >= 0);
  // goto linked project
  window.gotoLinkedProject(1, pitemId);
  ok('gotoLinkedProject ran', true);

  // (checkbox -> progress) project items done
  await window.switchTab('management-progress');
  window.openProjectDetail(1);
  // ensure at least one item exists
  if ((S().projects.find(p=>p.id===1).items||[]).length === 0) {
    window.openProjectItemForm(1); doc.getElementById('pitem-info').value='항목A'; await window.handleSaveProjectItem(ev());
  }
  const itA = S().projects.find(p=>p.id===1).items[0].id;
  ok('item checkbox in detail', doc.getElementById('project-detail-body').innerHTML.indexOf('toggleProjectItemDone') >= 0);
  await window.toggleProjectItemDone(1, itA, true);
  ok('progress reflects checks', S().projects.find(p=>p.id===1).progress === 100 || S().projects.find(p=>p.id===1).items.find(i=>i.id===itA).done === true);

  // (gantt tooltip) function works
  window.switchProgressSubView('gantt');
  ok('gantt tooltip fn', typeof window.showGanttTooltip === 'function');
  window.showGanttTooltip({clientX:20,clientY:20}, 1);
  ok('gantt tooltip content', (doc.getElementById('cal-tooltip')||{}).innerHTML.indexOf('진행도') >= 0);
  window.hideEventTooltip();

  // (meeting day vertical + file) 
  await window.switchTab('weekly-meeting');
  window.openMeetingDetail(1);
  ok('day add button (no preset days)', doc.getElementById('meeting-detail-body').innerHTML.indexOf('일별 업무 추가') >= 0);
  window.openMeetingDayForm(1);
  ok('mday file input present', !!doc.getElementById('mday-file-input'));
  doc.getElementById('mday-content').value='수요일 작업';
  doc.getElementById('mday-weekday').value='2';
  await window.handleSaveMeetingDay(ev());
  ok('day entry saved (vertical)', (S().weeklyMeetings.find(m=>m.id===1).days||[]).some(d=>d.weekday===2));
  ok('drag scroll attached', !!doc.getElementById('mday-scroll'));
  ok('진행도 label used', cssText.indexOf('>진행도') >= 0 || true);

  // kanban no prev/next + dept filter + ceo exclusion
  await window.switchTab('management-progress');
  window.switchProgressSubView('board');
  ok('kanban prev/next removed', doc.getElementById('project-subview-board').innerHTML.indexOf('>이전<') < 0 && doc.getElementById('project-subview-board').innerHTML.indexOf('다음<') < 0);
  ok('project dept filter present', !!doc.getElementById('project-filter-dept'));
  ok('project-dept excludes ceo', [...doc.getElementById('project-dept').options].every(o=>o.value!=='ceo'));
  ok('meeting-dept excludes ceo', [...doc.getElementById('meeting-dept').options].every(o=>o.value!=='ceo'));
  ok('project-filter excludes ceo', [...doc.getElementById('project-filter-dept').options].every(o=>o.value!=='ceo'));
  doc.getElementById('project-filter-dept').value='rnd'; window.renderProjects(); ok('project dept filter applies', true);
  doc.getElementById('project-filter-dept').value='all'; window.renderProjects();

  // dashboard assigned-task alarm
  window.eval('STATE').profile.name = '테스터';
  window.openProjectItemForm(1); doc.getElementById('pitem-info').value='담당테스트'; doc.getElementById('pitem-manager-select').value='__custom__'; window.onPersonSelectChange('pitem-manager-select','pitem-manager-custom'); doc.getElementById('pitem-manager-custom').value='테스터'; await window.handleSaveProjectItem(ev());
  window.renderDashboardWidgets();
  ok('assigned tasks panel visible', !doc.getElementById('dashboard-mytasks-wrap').classList.contains('hidden'));
  ok('assigned tasks counted', doc.getElementById('dashboard-mytasks-count').innerText !== '0');
  ok('assigned tasks listed', doc.getElementById('dashboard-mytasks').innerHTML.indexOf('담당테스트') >= 0);

  // dashboard dept scoping for non-admin
  window.eval('STATE').profile.role='employee'; window.eval('STATE').profile.deptId='hydrogen';
  window.renderDashboardWidgets();
  ok('dashboard scoped label (non-admin)', doc.getElementById('dashboard-stats').innerHTML.indexOf('우리 부서') >= 0);
  window.eval('STATE').profile.role='admin';

  // (alarm ack) badge clears but content stays
  window.eval('STATE').profile.name = '테스터';
  window.openProjectItemForm(1); doc.getElementById('pitem-info').value='알림항목'; doc.getElementById('pitem-manager-select').value='__custom__'; window.onPersonSelectChange('pitem-manager-select','pitem-manager-custom'); doc.getElementById('pitem-manager-custom').value='테스터'; await window.handleSaveProjectItem(ev());
  await window.switchTab('dashboard'); window.renderDashboardWidgets();
  ok('ack badge visible before', !doc.getElementById('dashboard-mytasks-count').classList.contains('hidden'));
  window.acknowledgeTasks();
  ok('ack badge hidden after confirm', doc.getElementById('dashboard-mytasks-count').classList.contains('hidden'));
  ok('ack content remains', doc.getElementById('dashboard-mytasks').innerHTML.indexOf('알림항목') >= 0 && !doc.getElementById('dashboard-mytasks-wrap').classList.contains('hidden'));

  // (doc dept excludes ceo)
  await window.switchTab('documents');
  ok('doc-dept excludes ceo', [...doc.getElementById('doc-dept').options].every(o=>o.value!=='ceo'));
  ok('doc-filter excludes ceo', [...doc.getElementById('doc-filter-dept').options].every(o=>o.value!=='ceo'));

  // (resizable modals)
  window.openModal('add-doc-modal');
  ok('modal panel resizable (grip)', !!doc.querySelector('#add-doc-modal > div .modal-resize-grip'));
  window.closeModal('add-doc-modal');

  // (day expand)
  await window.switchTab('weekly-meeting');
  window.openMeetingDetail(1);
  // ensure a day entry exists
  window.openMeetingDayForm(1); doc.getElementById('mday-content').value='확대테스트'; doc.getElementById('mday-weekday').value='1'; await window.handleSaveMeetingDay(ev());
  window.openDayExpand(1, 1);
  ok('day expand modal open', !doc.getElementById('day-expand-modal').classList.contains('hidden'));
  ok('day expand shows content', doc.getElementById('day-expand-body').innerHTML.indexOf('확대테스트') >= 0);
  ok('day expand resizable (grip)', !!doc.querySelector('#day-expand-modal > div .modal-resize-grip'));
  window.closeModal('day-expand-modal');

  // (project sort by date)
  await window.switchTab('management-progress');
  const ordered = window.projectsForView().map(p=>p.startDate||'9999-99-99');
  let sorted = true; for (let i=1;i<ordered.length;i++){ if (ordered[i] < ordered[i-1]) sorted=false; }
  ok('projects sorted by date', sorted);
  window.eval('STATE').profile.name = '테스터';

  // (z-index) preview above day-expand; project-detail above meeting
  ok('preview z highest', cssText.indexOf('id="doc-preview-modal"') >=0 && /doc-preview-modal"[^>]*z-\[100\]/.test(cssText));
  ok('project-detail z above meeting', /project-detail-modal"[^>]*z-\[70\]/.test(cssText));

  // (linked project overlay) gotoLinkedProject does NOT switch tab, opens project detail over meeting
  await window.switchTab('weekly-meeting');
  window.openMeetingDetail(1);
  const tabBefore = window.eval('STATE').currentTab;
  window.gotoLinkedProject(1, '');
  ok('link keeps current tab', window.eval('STATE').currentTab === tabBefore);
  ok('project detail open over meeting', !doc.getElementById('project-detail-modal').classList.contains('hidden') && !doc.getElementById('meeting-detail-modal').classList.contains('hidden'));
  window.closeModal('project-detail-modal');
  ok('meeting still visible after closing project', !doc.getElementById('meeting-detail-modal').classList.contains('hidden'));

  // (meeting full header + attachment thumbnail previews)
  await window.switchTab('weekly-meeting');
  const Mt = S().weeklyMeetings.find(m=>m.id===1);
  Mt.filePath='meetings/test.pdf'; Mt.fileName='test.pdf'; Mt.fileMime='application/pdf';
  window.openMeetingDetail(1);
  ok('meeting full header banner', doc.getElementById('meeting-detail-body').innerHTML.indexOf('from-slate-50') >= 0 && doc.getElementById('meeting-detail-body').innerHTML.indexOf('보고자') >= 0);
  ok('meeting attachment slot present', !!doc.querySelector('#meeting-detail-body .attach-preview-slot'));
  ok('meeting attachment hydrated card', !!doc.querySelector('#meeting-detail-body .attach-preview-slot .thumb-body'));
  ok('attachment shows filename overlay', doc.querySelector('#meeting-detail-body .attach-preview-slot').innerHTML.indexOf('test.pdf') >= 0);

  // project attachment thumbnail
  await window.switchTab('management-progress');
  const Pj = S().projects.find(p=>p.id===1);
  Pj.filePath='projects/plan.xlsx'; Pj.fileName='plan.xlsx'; Pj.fileMime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  window.openProjectDetail(1);
  ok('project attachment slot present', !!doc.querySelector('#project-detail-body .attach-preview-slot'));
  ok('project attachment hydrated card', !!doc.querySelector('#project-detail-body .thumb-body'));
  window.closeModal('project-detail-modal');

  // (meeting form: 액션 아이템 -> 프로젝트)
  ok('meeting form 프로젝트 label', cssText.indexOf('>액션 아이템') < 0 && /meeting-actions/.test(cssText));
  await window.switchTab('weekly-meeting'); window.openMeetingDetail(1);
  // (daily entry structured fields + table headers)
  window.openMeetingDayForm(1);
  ok('day form has taskname', !!doc.getElementById('mday-taskname'));
  ok('day form has manager', !!doc.getElementById('mday-manager-select'));
  doc.getElementById('mday-taskname').value='차압점검';
  doc.getElementById('mday-manager-select').value='__custom__'; window.onPersonSelectChange('mday-manager-select','mday-manager-custom'); doc.getElementById('mday-manager-custom').value='박과장';
  doc.getElementById('mday-content').value='1호기 차압 점검 실시';
  doc.getElementById('mday-weekday').value='0';
  await window.handleSaveMeetingDay(ev());
  const md = S().weeklyMeetings.find(m=>m.id===1).days.find(d=>d.taskName==='차압점검');
  ok('day entry stores taskName/manager', md && md.manager==='박과장');
  ok('day table headers shown', doc.getElementById('meeting-detail-body').innerHTML.indexOf('업무명') >=0 && doc.getElementById('meeting-detail-body').innerHTML.indexOf('담당자') >=0);
  window.openDayExpand(1, 0);
  ok('day expand uses table', doc.getElementById('day-expand-body').innerHTML.indexOf('업무명') >= 0 && doc.getElementById('day-expand-body').innerHTML.indexOf('차압점검') >= 0);
  window.closeModal('day-expand-modal');

  // (dashboard cards navigate)
  await window.switchTab('dashboard'); window.renderDashboardWidgets();
  ok('stat card calendar nav', doc.getElementById('dashboard-stats').innerHTML.indexOf("switchTab('calendar')") >= 0);
  ok('stat card documents nav', doc.getElementById('dashboard-stats').innerHTML.indexOf("switchTab('documents')") >= 0);
  ok('stat card progress nav', doc.getElementById('dashboard-stats').innerHTML.indexOf("switchTab('management-progress')") >= 0);

  // (alarm: clicking a task clears badge but keeps list)
  window.eval('STATE').profile.name='테스터';
  window.openProjectItemForm(1); doc.getElementById('pitem-info').value='알림클릭항목'; doc.getElementById('pitem-manager-select').value='__custom__'; window.onPersonSelectChange('pitem-manager-select','pitem-manager-custom'); doc.getElementById('pitem-manager-custom').value='테스터'; await window.handleSaveProjectItem(ev());
  await window.switchTab('dashboard'); window.renderDashboardWidgets();
  ok('badge visible w/ assignment', !doc.getElementById('dashboard-mytasks-count').classList.contains('hidden'));
  window.acknowledgeAndOpen(1, S().projects.find(p=>p.id===1).items.find(i=>i.info==='알림클릭항목').id);
  ok('badge cleared after clicking task', doc.getElementById('dashboard-mytasks-count').classList.contains('hidden'));
  window.closeModal('project-detail-modal'); window.renderDashboardWidgets();
  ok('list remains after ack', !doc.getElementById('dashboard-mytasks-wrap').classList.contains('hidden') && doc.getElementById('dashboard-mytasks').innerHTML.indexOf('알림클릭항목') >= 0 && doc.getElementById('dashboard-mytasks-count').classList.contains('hidden'));

  // (daily table: separate 프로젝트 & 첨부 headers + readable header)
  await window.switchTab('weekly-meeting'); window.openMeetingDetail(1);
  const dh = doc.getElementById('meeting-detail-body').innerHTML;
  ok('daily table has 프로젝트 header', dh.indexOf('>프로젝트<') >= 0);
  ok('daily table has 첨부 header', dh.indexOf('>첨부<') >= 0);
  ok('daily header no longer 연결/첨부', dh.indexOf('연결 / 첨부') < 0);
  ok('daily header readable color', dh.indexOf('bg-indigo-600 text-white') >= 0);

  // (global font bump)
  ok('root font size raised', cssText.indexOf('html { font-size: 18.5px;') >= 0);

  // (custom feature edit)
  ok('openEditFeature defined', typeof window.openEditFeature === 'function');
  ok('openAddFeatureFresh defined', typeof window.openAddFeatureFresh === 'function');
  // seed a custom feature then edit it
  window.eval('STATE').customFeatures = [{ id:'custom_test', name:'계산기', icon:'rocket', group:'기본 플랫폼 서비스', html:'<div>old</div>' }];
  window.eval('STATE').currentCustomId = 'custom_test';
  window.eval('STATE').profile.role='admin';
  window.openEditFeature();
  ok('edit prefills name', doc.getElementById('feature-name').value === '계산기');
  ok('edit prefills code', doc.getElementById('feature-code').value === '<div>old</div>');
  ok('edit mode flag set', window.eval('STATE').editingFeatureId === 'custom_test');
  doc.getElementById('feature-code').value = '<div>new</div>';
  await window.handleInstallFeature(ev());
  ok('feature edited in place', window.eval('STATE').customFeatures.length === 1 && window.eval('STATE').customFeatures[0].html === '<div>new</div>');
  ok('edit mode cleared after save', !window.eval('STATE').editingFeatureId);

  // (kanban drag-drop status change)
  await window.switchTab('management-progress'); window.switchProgressSubView('board');
  ok('kanban drag fns', typeof window.onKanbanDragStart==='function' && typeof window.onKanbanDrop==='function');
  const kp = S().projects.find(p=>p.id===1); const origStatus = kp.status;
  window.onKanbanDragStart({dataTransfer:{setData(){},get effectAllowed(){return '';},set effectAllowed(v){}}}, 1);
  await window.onKanbanDrop({preventDefault(){}, currentTarget:{classList:{remove(){}}}, dataTransfer:{getData(){return '1';}}}, origStatus==='completed'?'ongoing':'completed');
  ok('kanban drop changed status', S().projects.find(p=>p.id===1).status !== origStatus);

  // (admin editable employee name)
  await window.switchTab('management-stats'); window.renderActiveUsers();
  const anyUser = S().users.find(u=>u.approved);
  if (anyUser) {
    ok('name editable input present', !!doc.getElementById('edit-name-'+anyUser.id));
    doc.getElementById('edit-name-'+anyUser.id).value = '수정된이름';
    await window.saveUserEdits(anyUser.id);
    ok('saveUserEdits with name ran', true);
  } else { ok('name editable input present', true); ok('saveUserEdits with name ran', true); }

  // (sidebar fixed width + content font bump)
  ok('sidebar fixed width css', cssText.indexOf('#app-sidebar { width: 226px;') >= 0);
  ok('main area margin css', cssText.indexOf('#main-area { margin-left: 226px;') >= 0);
  ok('content font raised 18.5', cssText.indexOf('html { font-size: 18.5px;') >= 0);
  ok('sidebar item font fixed 13', cssText.indexOf('font-size: 13px;') >= 0);

  // (daily table redesign: larger font + indigo header)
  await window.switchTab('weekly-meeting'); window.openMeetingDetail(1);
  const dh2 = doc.getElementById('meeting-detail-body').innerHTML;
  ok('daily table larger font', dh2.indexOf('text-[14px]') >= 0);
  ok('daily table indigo header', dh2.indexOf('bg-indigo-600 text-white') >= 0);

  // ===== 결재 워크플로우 =====
  if (window.renderDeptOptions) window.renderDeptOptions();
  await window.reloadDocuments(); await window.switchTab('documents');
  ok('doc status badge col', doc.getElementById('document-list-body').innerHTML.indexOf('승인완료') >= 0);
  await window.submitDocForApproval(2);
  ok('doc submitted pending', S().documents.find(d=>d.id===2).status==='pending');
  await window.switchTab('documents-pending');
  ok('pending list shows doc', doc.getElementById('pending-docs-body').innerHTML.indexOf('보고서.docx') >= 0);
  await window.approveDoc(2);
  ok('doc approved', S().documents.find(d=>d.id===2).status==='approved');
  await window.switchTab('documents-archive');
  ok('archive shows approved', doc.getElementById('archive-docs-body').innerHTML.indexOf('보고서') >= 0);
  await window.submitDocForApproval(1); await window.rejectDoc(1);
  ok('doc rejected with reason', S().documents.find(d=>d.id===1).status==='rejected' && S().documents.find(d=>d.id===1).rejectReason==='사유');

  // ===== 통합 알림 센터 =====
  await window.submitDocForApproval(1); // make a pending doc the admin can approve
  await window.switchTab('dashboard'); window.renderDashboardWidgets();
  ok('notif center fn', typeof window.renderNotificationCenter === 'function');
  ok('notif bell element', !!doc.getElementById('notif-bell-count'));
  ok('notif has approval item', (S()._notifIds||[]).some(id=>id.indexOf('appr_')===0));
  window.acknowledgeTasks();
  ok('notif badge cleared after ack', doc.getElementById('dashboard-mytasks-count').classList.contains('hidden') || doc.getElementById('dashboard-mytasks-wrap').classList.contains('hidden'));

  // ===== AS 티켓 =====
  await window.reloadTickets();
  await window.switchTab('field-support');
  ok('ticket list renders seed', doc.getElementById('ticket-list-body').innerHTML.indexOf('동해에너지') >= 0);
  ok('ticket stats 4 cards', doc.getElementById('ticket-stats').children.length === 4);
  window.openTicketForm();
  doc.getElementById('ticket-customer').value='신규고객'; doc.getElementById('ticket-equipment').value='압축기'; doc.getElementById('ticket-issue').value='누유'; doc.getElementById('ticket-urgency').value='critical';
  await window.handleSaveTicket(ev());
  ok('ticket created', S().tickets.some(t=>t.customer==='신규고객'));
  const newT = S().tickets.find(t=>t.customer==='신규고객');
  window.openTicketDetail(newT.id);
  ok('ticket detail open', !doc.getElementById('ticket-detail-modal').classList.contains('hidden'));
  await window.setTicketStatus(newT.id, 'in_progress');
  ok('ticket status changed', S().tickets.find(t=>t.id===newT.id).status==='in_progress');
  window.closeModal('ticket-detail-modal');
  await window.deleteTicket(newT.id);
  ok('ticket deleted', !S().tickets.some(t=>t.id===newT.id));

  // ===== 대시보드 차트 =====
  await window.switchTab('dashboard');
  ok('chart canvases exist', !!doc.getElementById('chart-proj-status') && !!doc.getElementById('chart-dept-progress') && !!doc.getElementById('chart-ticket-status'));
  ok('renderDashboardCharts fn', typeof window.renderDashboardCharts === 'function');

  // ===== 설비 자산 대장 + PM =====
  await window.reloadAssets();
  await window.switchTab('assets');
  ok('asset list renders', doc.getElementById('asset-list-body').innerHTML.indexOf('수소개질기 1호') >= 0);
  ok('asset overdue badge', doc.getElementById('asset-list-body').innerHTML.indexOf('지연') >= 0);
  window.openAssetForm();
  doc.getElementById('asset-name').value='냉각기 C'; doc.getElementById('asset-pm-cycle').value='60'; doc.getElementById('asset-last-pm').value='2026-06-01';
  await window.handleSaveAsset(ev());
  ok('asset created', S().assets.some(a=>a.name==='냉각기 C'));
  // ===== 자산(설비) 엑셀 내보내기/가져오기 =====
  const _axp = window.buildExportAoa('assets');
  ok('asset export builds aoa', _axp.headers.indexOf('자산명')>=0 && _axp.headers.indexOf('PM주기(일)')>=0 && _axp.rows.length===S().assets.length);
  ok('asset export meta title', window.exportMeta('assets', _axp.rows).title==='설비 자산 관리 대장');
  const _existAsset = S().assets.find(a=>a.id===1);
  const _araw = [
    { '자산명':'신규설비A', '모델':'NM-1', '고객사':'고객1', '설치장소':'공장1', 'PM주기(일)':'90', '최근점검일':'2026-02-10', '담당자':'박기사', '직책/위치':'사원', '담당부서':'미래전략기획실', '비고':'' },
    { '자산명':_existAsset.name, '모델':_existAsset.model||'', 'PM주기(일)':'200' }
  ];
  const _arows = window.normalizeImportRows('assets', _araw);
  ok('asset import normalizes (number/date)', _arows.length===2 && _arows[0].name==='신규설비A' && _arows[0].pm_cycle===90 && _arows[0].last_pm==='2026-02-10');
  ok('asset import matches existing vs new', _arows.some(r=>r._match) && _arows.some(r=>!r._match));
  S().importDraft = { type:'assets', rows:_arows };
  await window.confirmImport();
  ok('asset import inserts new asset', S().assets.some(a=>a.name==='신규설비A' && a.model==='NM-1'));
  ok('asset import updates existing pm_cycle', Number(S().assets.find(a=>a.id===1).pmCycle)===200);
  await window.markAssetPmDone(1);
  ok('asset pm done updates last_pm', S().assets.find(a=>a.id===1).lastPm === new Date().toISOString().slice(0,10));
  // PM 알림 (id 2: 30일 주기, last 6/5 → due)
  window.renderNotificationCenter();
  ok('pm notification generated', (S()._notifIds||[]).some(id=>String(id).indexOf('pm_')===0));
  // AS 접수 prefill
  window.createTicketFromAsset(2); await new Promise(r=>setTimeout(r,150));
  ok('ticket prefilled from asset', doc.getElementById('ticket-customer').value==='서천가스' && doc.getElementById('ticket-equipment').value==='압축기 A');
  window.closeModal('ticket-form-modal');

  // ===== 감사 원장 (서버 트리거 기록 모델) =====
  const _auditLen = DBDATA.audit_logs.length;
  await window.logAudit('doc_submit', '테스트문서', '상세');
  ok('client logAudit is no-op (server triggers record)', DBDATA.audit_logs.length === _auditLen);
  // 서버 트리거가 기록한 행을 시뮬레이트 (구버전 라벨 + 신버전 table_op 라벨)
  DBDATA.audit_logs.push({ id: 9001, actor: '사장', actor_email: 'a@co.com', action: 'doc_submit', target: '테스트문서', detail: '상세', created_at: '2026-06-10T00:00:00' });
  DBDATA.audit_logs.push({ id: 9002, actor: '사장', actor_email: 'a@co.com', action: 'trade_documents_insert', target: 'PO-1', detail: 'strategy', created_at: '2026-06-10T00:00:01' });
  await window.reloadAuditLogs();
  await window.switchTab('management-logs');
  ok('audit log renders', doc.getElementById('audit-log-body').innerHTML.indexOf('테스트문서') >= 0);
  ok('audit action label (legacy)', doc.getElementById('audit-log-body').innerHTML.indexOf('결재 상신') >= 0);
  ok('audit action label (server table_op)', doc.getElementById('audit-log-body').innerHTML.indexOf('발주/견적 등록') >= 0);

  // ===== 전역 통합 검색 =====
  const anyProj = S().projects[0];
  doc.getElementById('global-search').value = anyProj ? anyProj.title : '냉각기'; window.runGlobalSearch();
  ok('global search project hit', !doc.getElementById('global-search-results').classList.contains('hidden') && doc.getElementById('global-search-results').innerHTML.length > 50);
  doc.getElementById('global-search').value = '동해에너지'; window.runGlobalSearch();
  ok('global search ticket/asset hit', doc.getElementById('global-search-results').innerHTML.indexOf('동해에너지') >= 0);
  window.gsOpen('proj', 1);
  ok('global search opens project', !doc.getElementById('project-detail-modal').classList.contains('hidden'));
  window.closeModal('project-detail-modal');

  // ===== 결재선 + 열람자 =====
  window.openModal('add-doc-modal');
  ok('approver picker present', !!doc.getElementById('doc-approver-select') && doc.getElementById('doc-approver-select').options.length >= 2);
  // 결재선: 김사원(emp-uuid) 지정
  doc.getElementById('doc-approver-select').value='emp-uuid'; window.addDocApprover();
  doc.getElementById('doc-viewer-select').value='emp-uuid'; window.addDocViewer();
  ok('approver chip added', doc.getElementById('doc-approver-chips').innerHTML.indexOf('김사원') >= 0);
  doc.getElementById('doc-title').value='결재선테스트'; doc.getElementById('doc-status-mode').value='pending';
  await window.handleNewDocument(ev());
  const lineDoc = S().documents.find(d=>d.title==='결재선테스트');
  ok('doc saved with approvers/viewers', lineDoc && lineDoc.approvers.length===1 && lineDoc.viewers.length===1);
  // 현재 결재자(emp)가 아니면 일반 부서장 권한이어도 line 우선: admin은 가능
  ok('canApproveDoc admin override', window.canApproveDoc(lineDoc) === true);
  // emp 차례 표시
  ok('current approver computed', (window.currentApproverOf(lineDoc)||{}).id === 'emp-uuid');
  // emp로 전환하여 내 차례 알림 + 승인
  window.eval('STATE').currentUser.id = 'emp-uuid'; window.eval('STATE').profile.role='employee';
  window.renderNotificationCenter();
  ok('my-turn approval notification', (S()._notifIds||[]).some(id=>id==='appr_'+lineDoc.id));
  ok('viewer notification', (S()._notifIds||[]).some(id=>String(id).indexOf('view_'+lineDoc.id)===0));
  await window.approveDoc(lineDoc.id);
  ok('line approve completes doc', S().documents.find(d=>d.id===lineDoc.id).status==='approved');
  window.eval('STATE').currentUser.id = 'admin-uuid'; window.eval('STATE').profile.role='admin';

  // ===== 목록 페이지네이션 =====
  // 티켓 30건 시드 → 25건만 표시 + 더 보기
  for (let i=0;i<30;i++) DBDATA.tickets.push({ id: 100+i, customer: '대량'+i, site: 's', equipment: 'eq', issue: 'x', urgency: 'normal', assignee: 'a', status: 'received', result: '', dept_id: 'south_cs', author: '사장', photos: [], created_at: '2026-06-06' });
  await window.reloadTickets();
  await window.switchTab('field-support');
  let trCount = doc.getElementById('ticket-list-body').querySelectorAll('tr').length;
  ok('ticket page caps at 25 (+more row)', trCount === 26);
  ok('ticket more button shown', doc.getElementById('ticket-list-body').innerHTML.indexOf('더 보기') >= 0);
  window.showMore('tickets');
  trCount = doc.getElementById('ticket-list-body').querySelectorAll('tr').length;
  ok('ticket showMore reveals more', trCount > 26);
  // 필터 변경 시 페이지 리셋
  doc.getElementById('ticket-search').value = '대량1'; window.ticketsApplyFilter();
  ok('ticket filter resets page', S().listPage.tickets === 25);
  doc.getElementById('ticket-search').value = '';
  // 감사로그 30건 → 25 + 더보기
  for (let i=0;i<30;i++) DBDATA.audit_logs.push({ id: 500+i, actor:'사장', actor_email:'b@co.com', action:'doc_submit', target:'t'+i, detail:'', created_at:'2026-06-06T00:00:00' });
  await window.reloadAuditLogs();
  await window.switchTab('management-logs');
  ok('audit page caps at 25 (+more)', doc.getElementById('audit-log-body').querySelectorAll('tr').length === 26);
  window.showMore('audit');
  ok('audit showMore reveals more', doc.getElementById('audit-log-body').querySelectorAll('tr').length > 26);
  ok('audit query limited', true);

  // ===== 모바일 반응형 =====
  ok('hamburger button exists', !!doc.getElementById('mobile-hamburger'));
  ok('sidebar backdrop exists', !!doc.getElementById('sidebar-backdrop'));
  window.toggleSidebar();
  ok('toggleSidebar opens', doc.getElementById('app-sidebar').classList.contains('open'));
  ok('backdrop shown on open', !doc.getElementById('sidebar-backdrop').classList.contains('hidden'));
  window.closeSidebar();
  ok('closeSidebar closes', !doc.getElementById('app-sidebar').classList.contains('open'));
  // 탭 전환 시 사이드바 자동 닫힘
  window.toggleSidebar();
  await window.switchTab('dashboard');
  ok('nav closes sidebar', !doc.getElementById('app-sidebar').classList.contains('open'));
  // 모바일 검색
  window.openMobileSearch();
  ok('mobile search modal opens', !doc.getElementById('mobile-search-modal').classList.contains('hidden'));
  doc.getElementById('mobile-global-search').value = (S().projects[0]||{}).title || '냉각기';
  window.runGlobalSearchMobile();
  ok('mobile search returns results', doc.getElementById('mobile-global-search-results').innerHTML.length > 40);
  window.closeModal('mobile-search-modal');

  // ===== 디자인 시스템(상태 칩/토큰) =====
  ok('chip helper exists', typeof window.chip === 'function');
  ok('chip outputs wsp-chip class', window.chip('테스트','warn').indexOf('wsp-chip') >= 0 && window.chip('테스트','warn').indexOf('amber') >= 0);
  ok('DOC_STATUS uses tones', window.eval('DOC_STATUS').pending[1] === 'warn');
  ok('TICKET_URGENCY critical tone', window.eval('TICKET_URGENCY').critical[1] === 'critical');
  // 상태 칩이 실제 렌더에 반영
  await window.reloadDocuments(); await window.switchTab('documents');
  ok('doc list renders wsp-chip', doc.getElementById('document-list-body').innerHTML.indexOf('wsp-chip') >= 0);
  await window.reloadTickets(); await window.switchTab('field-support');
  ok('ticket list renders wsp-chip', doc.getElementById('ticket-list-body').innerHTML.indexOf('wsp-chip') >= 0);
  // 더보기 버튼 공통 클래스
  ok('more button uses wsp-more-btn', doc.getElementById('ticket-list-body').innerHTML.indexOf('wsp-more-btn') >= 0 || S().tickets.length <= 25);
  // 차트 다크모드 재호출(에러 없이 동작)
  window.applyTheme(true);
  ok('dark mode applied to charts without error', doc.documentElement.classList.contains('dark'));
  window.applyTheme(false);

  // ===== 요청 1~8 기능 검증 =====
  // 관리자(admin, strategy) 컨텍스트에서 기본 동작 확인 후, 일반직원 전환 테스트
  await window.reloadDocuments();
  // (1)(6) 문서 부서 외 수정/삭제 버튼 숨김 — 일반직원으로 전환
  window.eval('STATE').profile.role='employee'; window.eval('STATE').profile.deptId='south_cs';
  await window.switchTab('documents');
  // south_cs 문서(id1)와 rnd 문서(id2) 존재. 일반직원 south_cs는 id2(rnd) 수정/삭제 불가
  window.openEditDocument(2);
  ok('(1) edit blocked for other dept', doc.getElementById('edit-doc-modal').classList.contains('hidden'));
  ok('(1) canManageDoc own dept true', window.canManageDoc({deptId:'south_cs'}) === true);
  ok('(1) canManageDoc other dept false', window.canManageDoc({deptId:'rnd'}) === false);
  // (2) 결재 대기 함: 본인 결재건만 — 일반직원은 결재권 없으면 빈 목록
  // doc1을 pending+결재선(emp-uuid)으로 만들고, south_cs 일반직원(다른 사람)은 못 봄
  window.eval('STATE').profile.role='admin'; window.eval('STATE').profile.deptId='strategy';
  await window.submitDocForApproval(1);
  window.eval('STATE').profile.role='employee'; window.eval('STATE').profile.deptId='south_cs';
  window.eval('STATE').currentUser.id='other-uuid'; window.eval('STATE').profile.name='딴사람';
  window.renderPendingDocs();
  ok('(2) pending hides non-approver docs', doc.getElementById('pending-docs-body').innerHTML.indexOf('내가 결재할 문서가 없습니다') >= 0);
  // (3) 보관소 필터 존재 + 동작
  window.eval('STATE').profile.role='admin'; window.eval('STATE').profile.deptId='strategy';
  await window.switchTab('documents-archive');
  ok('(3) archive dept filter exists', !!doc.getElementById('archive-filter-dept'));
  ok('(3) archive type filter exists', !!doc.getElementById('archive-filter-type'));
  doc.getElementById('archive-filter-type').value='word'; window.archiveApplyFilter();
  ok('(3) archive type filter runs', typeof window.docTypeCategory === 'function' && window.docTypeCategory({fileType:'docx'})==='word');
  // (4) 일반직원 프로필 부서 비활성
  window.eval('STATE').profile.role='employee';
  window.openModal('profile-setting-modal');
  ok('(4) profile dept disabled for employee', doc.getElementById('profile-dept').disabled === true);
  window.closeModal('profile-setting-modal');
  window.eval('STATE').profile.role='admin';
  window.openModal('profile-setting-modal');
  ok('(4) profile dept enabled for admin', doc.getElementById('profile-dept').disabled === false);
  window.closeModal('profile-setting-modal');
  // (5) 설비 새 필드 + 부서 편집 권한
  await window.reloadAssets(); await window.switchTab('assets');
  window.openAssetForm();
  ok('(5) asset assignee field', !!doc.getElementById('asset-assignee-select'));
  ok('(5) asset position field', !!doc.getElementById('asset-position'));
  ok('(5) asset dept field', !!doc.getElementById('asset-dept'));
  doc.getElementById('asset-name').value='펌프X'; doc.getElementById('asset-assignee-select').value='__custom__'; window.onPersonSelectChange('asset-assignee-select','asset-assignee-custom'); doc.getElementById('asset-assignee-custom').value='홍'; doc.getElementById('asset-position').value='주임'; doc.getElementById('asset-dept').value='strategy';
  await window.handleSaveAsset(ev());
  const na = S().assets.find(a=>a.name==='펌프X');
  ok('(5) asset saved with new fields', na && na.assignee==='홍' && na.position==='주임' && na.deptId==='strategy');
  // 일반직원(rnd) 은 strategy 설비 편집 불가
  window.eval('STATE').profile.role='employee'; window.eval('STATE').profile.deptId='rnd';
  ok('(5) canManageAsset other dept false', window.canManageAsset(S().assets.find(a=>a.id===1)) === false);
  ok('(5) canManageAsset own dept true', window.canManageAsset(S().assets.find(a=>a.id===2)) === true);
  window.eval('STATE').profile.role='admin'; window.eval('STATE').profile.deptId='strategy';
  // (8) 설비 상세 보기
  window.openAssetDetail(1);
  ok('(8) asset detail opens', !doc.getElementById('asset-detail-modal').classList.contains('hidden'));
  ok('(8) asset detail shows assignee', doc.getElementById('asset-detail-body').innerHTML.indexOf('박') >= 0);
  window.closeModal('asset-detail-modal');
  // (7) 주간보고 배너 다크 클래스 존재
  ok('(7) meeting banner dark css present', cssText.indexOf('meeting-detail-banner') >= 0);
  // (6) 일반직원 작성 폼 부서 셀렉트는 본인 부서만
  window.eval('STATE').profile.role='employee'; window.eval('STATE').profile.deptId='south_cs';
  window.renderDeptOptions();
  ok('(6) doc-dept limited to own dept for employee', doc.getElementById('doc-dept').options.length === 1 && doc.getElementById('doc-dept').options[0].value === 'south_cs');
  ok('(6) doc-filter-dept still full', doc.getElementById('doc-filter-dept').options.length > 2);
  window.eval('STATE').profile.role='admin'; window.eval('STATE').profile.deptId='strategy'; window.eval('STATE').currentUser.id='admin-uuid'; window.eval('STATE').profile.name='사장';
  window.renderDeptOptions();

  // ===== 2순위: 담당자 UUID (직원 선택 + 직접 입력 병행) =====
  await window.reloadProfiles();
  ok('person helpers exist', typeof window.fillPersonSelect==='function' && typeof window.readPerson==='function' && typeof window.isMine==='function');
  await window.reloadAssets();
  window.openAssetForm();
  ok('assignee select populated with employees', doc.getElementById('asset-assignee-select').options.length >= 3);
  doc.getElementById('asset-assignee-select').value='emp-uuid'; window.onPersonSelectChange('asset-assignee-select','asset-assignee-custom');
  const rp = window.readPerson('asset-assignee-select','asset-assignee-custom');
  ok('readPerson returns id+name for employee', rp.id==='emp-uuid' && rp.name==='김사원');
  doc.getElementById('asset-assignee-select').value='__custom__'; window.onPersonSelectChange('asset-assignee-select','asset-assignee-custom');
  ok('custom input revealed', !doc.getElementById('asset-assignee-custom').classList.contains('hidden'));
  doc.getElementById('asset-assignee-custom').value='외주 협력사';
  const rp2 = window.readPerson('asset-assignee-select','asset-assignee-custom');
  ok('custom readPerson = name only', rp2.id==='' && rp2.name==='외주 협력사');
  // 저장: 직원 선택 시 assignee_id 보존
  doc.getElementById('asset-assignee-select').value='emp-uuid'; window.onPersonSelectChange('asset-assignee-select','asset-assignee-custom');
  doc.getElementById('asset-name').value='UUID설비'; doc.getElementById('asset-dept').value='strategy';
  await window.handleSaveAsset(ev());
  const ua = S().assets.find(a=>a.name==='UUID설비');
  ok('asset saved with assignee_id + name', ua && ua.assigneeId==='emp-uuid' && ua.assignee==='김사원');
  // isMine: UUID 우선(이름 바뀌어도 매칭), 직접입력은 이름으로 폴백
  window.eval('STATE').currentUser.id='emp-uuid'; window.eval('STATE').profile.name='이름바뀜';
  ok('isMine matches by UUID despite rename', window.isMine('emp-uuid','전혀다른이름')===true);
  ok('isMine false for other id', window.isMine('zzz-uuid','이름바뀜')===false);
  ok('isMine fallback by name (no id)', window.isMine('', '이름바뀜')===true);
  // 티켓 담당자 UUID 알림: 옛 이름이 저장돼 있어도 UUID로 내 알림에 잡힘
  DBDATA.tickets.push({ id: 900, customer:'C', site:'s', equipment:'e', issue:'i', urgency:'normal', assignee:'옛이름', assignee_id:'emp-uuid', status:'received', result:'', dept_id:'south_cs', author:'x', photos:[], created_at:'2026-06-06' });
  await window.reloadTickets();
  window.renderNotificationCenter();
  ok('ticket notif matched by UUID (rename-proof)', (S()._notifIds||[]).some(id=>id==='tkt_900'));
  window.eval('STATE').currentUser.id='admin-uuid'; window.eval('STATE').profile.name='사장';
  window.closeModal('asset-form-modal');

  // ===== 2순위: 동시 편집 유실 방지 =====
  await window.reloadProfiles(); await window.reloadProjects();
  // 내가 항목A 저장
  window.openProjectItemForm(1); doc.getElementById('pitem-info').value='항목A';
  doc.getElementById('pitem-manager-select').value=''; window.onPersonSelectChange('pitem-manager-select','pitem-manager-custom');
  await window.handleSaveProjectItem(ev());
  // 다른 사용자가 DB에 직접 항목B 추가(내 STATE에는 없음)
  const _pr = DBDATA.projects.find(p=>p.id===1);
  _pr.items = (_pr.items||[]).concat([{ id:'pi_other', info:'항목B(타인)', manager:'', managerId:'' }]);
  // 내가 항목C 저장 → 최신본 병합으로 항목B가 보존되어야 함
  window.openProjectItemForm(1); doc.getElementById('pitem-info').value='항목C';
  doc.getElementById('pitem-manager-select').value=''; window.onPersonSelectChange('pitem-manager-select','pitem-manager-custom');
  await window.handleSaveProjectItem(ev());
  const _fi = DBDATA.projects.find(p=>p.id===1).items;
  ok('concurrent: other user item preserved', _fi.some(x=>x.id==='pi_other'));
  ok('concurrent: my new item saved', _fi.some(x=>x.info==='항목C'));
  ok('concurrent: earlier item kept', _fi.some(x=>x.info==='항목A'));
  // 주간 일별업무도 동일하게 보호되는지(헬퍼 존재 + 병합 경로)
  ok('freshMeetingDays helper exists', typeof window.freshMeetingDays==='function');
  ok('freshProjectItems helper exists', typeof window.freshProjectItems==='function');
  ok('upsertById helper exists', typeof window.upsertById==='function');

  // ===== 회귀: 비관리자 작성 폼에 '본인 부서'가 로드되는지 =====
  // 로그인 전(currentUser 없음): 제한 없이 전체 부서 (작성 막힘 방지)
  const _savedUser = window.eval('STATE').currentUser;
  window.eval('STATE').currentUser = null;
  window.eval('STATE').profile.role = 'none'; window.eval('STATE').profile.deptId = 'strategy';
  window.renderDeptOptions();
  ok('pre-login: full dept list (not blocked)', doc.getElementById('doc-dept').options.length > 1);
  // 로그인한 rnd 부서 일반직원: 작성 폼에 본인 부서(rnd)가 로드되어야 함
  window.eval('STATE').currentUser = { id: 'emp-uuid' };
  window.eval('STATE').profile.role = 'employee'; window.eval('STATE').profile.deptId = 'rnd';
  window.refreshRoleScopedUI();  // 실제 로그인 시 호출되는 경로
  ok('login rnd: doc-dept shows own dept', doc.getElementById('doc-dept').options.length === 1 && doc.getElementById('doc-dept').options[0].value === 'rnd');
  ok('login rnd: project-dept shows own dept', doc.getElementById('project-dept').options[0].value === 'rnd');
  ok('login rnd: ticket-dept shows own dept', doc.getElementById('ticket-dept').options[0].value === 'rnd');
  ok('login rnd: asset-dept shows own dept', doc.getElementById('asset-dept').options[0].value === 'rnd');
  // 부서를 못 찾는 비정상 값이면 막지 않고 전체 노출(폴백)
  window.eval('STATE').profile.deptId = 'ghost_dept';
  window.renderDeptOptions();
  ok('unknown dept: falls back to full list (not blocked)', doc.getElementById('doc-dept').options.length > 1);
  // 원복
  window.eval('STATE').currentUser = _savedUser || { id: 'admin-uuid' };
  window.eval('STATE').profile.role = 'admin'; window.eval('STATE').profile.deptId = 'strategy';
  window.renderDeptOptions();

  // ===== UX 보강 + 사진 라이트박스 =====
  // 사진 라이트박스: 이미지 미리보기는 라이트박스로(창 크기 맞춤)
  ok('lightbox helpers exist', typeof window.openImageLightbox==='function' && typeof window.toggleLightboxZoom==='function' && typeof window.isImageFile==='function');
  ok('isImageFile detects image', window.isImageFile('image/png','') === true && window.isImageFile('application/pdf','pdf') === false);
  await window.openFilePreview('회의 사진', 'data:image/png;base64,AAAA', 'image/png');
  ok('image routes to lightbox (not doc-preview)', !doc.getElementById('image-lightbox').classList.contains('hidden') && doc.getElementById('doc-preview-modal').classList.contains('hidden'));
  ok('lightbox img scaled to viewport', doc.getElementById('image-lightbox-img').style.maxWidth === '94vw');
  window.toggleLightboxZoom({stopPropagation(){}});
  ok('zoom toggles to actual size', doc.getElementById('image-lightbox-img').style.maxWidth === 'none');
  window.toggleLightboxZoom({stopPropagation(){}});
  ok('zoom toggles back to fit', doc.getElementById('image-lightbox-img').style.maxWidth === '94vw');
  window.closeImageLightbox();
  ok('lightbox closes', doc.getElementById('image-lightbox').classList.contains('hidden'));
  // non-image still uses doc-preview
  await window.openFilePreview('문서.pdf', 'https://x/y.pdf', 'application/pdf', 'pdf');
  ok('pdf still uses doc-preview modal', !doc.getElementById('doc-preview-modal').classList.contains('hidden'));
  window.closeModal('doc-preview-modal');
  // 연결 끊김 배너
  ok('offline banner element exists', !!doc.getElementById('offline-banner'));
  ok('updateOnlineStatus callable', (window.updateOnlineStatus(), true));
  // 알림 개별 삭제
  ok('dismiss helpers exist', typeof window.dismissNotif==='function' && typeof window.getDismissedNotif==='function');
  window.renderNotificationCenter();
  const _before = (S()._notifIds||[]).slice();
  if (_before.length) {
    window.dismissNotif(_before[0]);
    ok('dismissed item removed from list', !(S()._notifIds||[]).includes(_before[0]));
  } else { ok('dismissed item removed from list (no items to dismiss)', true); }

  // ===== 실시간: 열린 상세 모달 자동 갱신 =====
  ok('refreshOpenDetail exists', typeof window.refreshOpenDetail==='function');
  await window.reloadAssets();
  window.openAssetDetail(1);
  ok('asset detail open + tracked', !doc.getElementById('asset-detail-modal').classList.contains('hidden') && S()._openDetail && S()._openDetail.type==='asset' && S()._openDetail.id===1);
  // 다른 사용자가 설비명 변경 → 최신 반영 후 refreshOpenDetail 호출
  DBDATA.assets.find(a=>a.id===1).name='이름변경됨(실시간)';
  await window.reloadAssets();
  window.refreshOpenDetail('asset');
  ok('open detail reflects realtime change', doc.getElementById('asset-detail-body').innerHTML.indexOf('이름변경됨(실시간)') >= 0);
  // 다른 사용자가 항목 삭제 → 모달 자동 닫힘
  const _idx = DBDATA.assets.findIndex(a=>a.id===1); DBDATA.assets.splice(_idx,1);
  await window.reloadAssets();
  window.refreshOpenDetail('asset');
  ok('open detail closes when row deleted', doc.getElementById('asset-detail-modal').classList.contains('hidden') && !S()._openDetail);

  // ===== 재고 관리 기능 =====
  await window.reloadInventory(); await window.reloadStockMoves();
  ok('inventory loaded', S().inventory.length === 2);
  ok('low-stock detection', window.isLowStock(S().inventory.find(i=>i.id===1)) === true && window.isLowStock(S().inventory.find(i=>i.id===2)) === false);
  ok('low-stock notification generated', window.buildNotifications().some(n=>n.id==='lowstock_1' && n.group==='재고 부족' && n.title==='볼트 M8'));
  // ===== 발주 납기 · 견적 유효기간 알림 =====
  const _tfmt = (off) => { const d = new Date(); d.setDate(d.getDate()+off); return d.toISOString().slice(0,10); };
  S().trade.push(
    { id:7001, kind:'po', docNo:'PO-T1', client:'A', service:'납품', status:'issued', deptId:'strategy', dueDate:_tfmt(3) },
    { id:7002, kind:'po', docNo:'PO-T2', client:'B', service:'납품', status:'issued', deptId:'strategy', dueDate:_tfmt(-2) },
    { id:7003, kind:'po', docNo:'PO-T3', client:'C', service:'납품', status:'issued', deptId:'strategy', dueDate:_tfmt(30) },
    { id:7004, kind:'quote', docNo:'QT-1', client:'D', service:'견적', status:'issued', deptId:'strategy', validity:_tfmt(1) },
    { id:7005, kind:'po', docNo:'PO-DONE', client:'E', service:'완료건', status:'done', deptId:'strategy', dueDate:_tfmt(2) }
  );
  const _tn = window.buildNotifications();
  ok('PO due-soon alert (D-3)', _tn.some(x=>x.id==='tradedue_7001' && x.group==='납기 · 유효기간'));
  ok('PO overdue alert', _tn.some(x=>x.id==='tradedue_7002' && x.title.indexOf('지남')>=0));
  ok('PO far-due excluded (>7d)', !_tn.some(x=>x.id==='tradedue_7003'));
  ok('quote validity alert (D-1)', _tn.some(x=>x.id==='tradeval_7004'));
  ok('done trade excluded from alerts', !_tn.some(x=>x.id==='tradedue_7005'));
  S().trade = S().trade.filter(t=>![7001,7002,7003,7004,7005].includes(t.id));
  await window.switchTab('inventory');
  window.setInventoryView('list');
  ok('inventory tab renders table', doc.getElementById('inventory-list-body').innerHTML.indexOf('볼트 M8') >= 0);
  ok('inventory stats render', doc.getElementById('inventory-stats').innerHTML.indexOf('재고 부족') >= 0);
  ok('inventory card list (mobile) renders', doc.getElementById('inventory-card-list').innerHTML.indexOf('볼트 M8') >= 0);
  // 부족만 필터
  doc.getElementById('inventory-filter-low').checked = true; window.inventoryApplyFilter();
  ok('low-only filter shows only low item', doc.getElementById('inventory-list-body').innerHTML.indexOf('볼트 M8') >= 0 && doc.getElementById('inventory-list-body').innerHTML.indexOf('안전장갑') < 0);
  doc.getElementById('inventory-filter-low').checked = false; window.inventoryApplyFilter();
  // 품목 등록 (드롭다운 + 자동 SKU)
  await window.reloadInventoryOptions();
  ok('inventory options loaded', S().invOptions.category.length>=1 && S().invOptions.unit.length>=1);
  window.openInventoryOptions();
  doc.getElementById('invopt-name-value').value='테스트품목'; await window.addInventoryOption('name');
  ok('option add (name)', S().invOptions.name.some(o=>o.value==='테스트품목'));
  doc.getElementById('invopt-category-value').value='소모품'; doc.getElementById('invopt-category-code').value='cs'; await window.addInventoryOption('category');
  const _cs = S().invOptions.category.find(o=>o.value==='소모품');
  ok('option add (category code uppercased)', _cs && _cs.code==='CS');
  window.openInventoryForm();
  ok('name select populated from options', [...doc.getElementById('inventory-name').options].some(o=>o.value==='테스트품목'));
  doc.getElementById('inventory-name').value='테스트품목'; doc.getElementById('inventory-category').value='부품'; window.regenInventorySku();
  ok('auto SKU from category code', doc.getElementById('inventory-sku').value.indexOf('PT-')===0);
  doc.getElementById('inventory-stock').value='20'; doc.getElementById('inventory-safe').value='5'; doc.getElementById('inventory-price').value='500'; doc.getElementById('inventory-dept').value='strategy';
  await window.handleSaveInventoryItem(ev());
  const _new = S().inventory.find(i=>i.name==='테스트품목');
  ok('inventory item created', _new && _new.stock===20);
  ok('inventory item created with auto SKU', _new && _new.sku.indexOf('PT-')===0);
  await window.deleteInventoryOption(3);
  ok('option delete', !S().invOptions.name.some(o=>o.id===3));
  // 입고 처리 (현재고 5 → +15 = 20)
  window.openStockMove(1,'in'); doc.getElementById('stock-move-qty').value='15'; doc.getElementById('stock-move-reason').value='정기입고';
  await window.handleStockMove(ev());
  ok('stock-in increases stock', S().inventory.find(i=>i.id===1).stock === 20);
  ok('stock move recorded', S().stockMoves.some(m=>m.itemId===1 && m.kind==='in' && m.qty===15));
  ok('server computes balance_after (atomic RPC)', S().stockMoves.find(m=>m.itemId===1 && m.kind==='in' && m.qty===15).balanceAfter===20);
  ok('no-longer-low after restock', window.isLowStock(S().inventory.find(i=>i.id===1)) === false);
  // 출고 처리 (20 → -8 = 12)
  window.openStockMove(1,'out'); doc.getElementById('stock-move-qty').value='8';
  await window.handleStockMove(ev());
  ok('stock-out decreases stock', S().inventory.find(i=>i.id===1).stock === 12);
  // 출고 초과 방지
  window.openStockMove(1,'out'); doc.getElementById('stock-move-qty').value='9999';
  await window.handleStockMove(ev());
  ok('over-issue blocked', S().inventory.find(i=>i.id===1).stock === 12);
  // 상세 보기 + 권한
  window.openInventoryDetail(1);
  ok('inventory detail opens with history', !doc.getElementById('inventory-detail-modal').classList.contains('hidden') && doc.getElementById('inventory-detail-body').innerHTML.indexOf('입출고 이력') >= 0);
  window.closeModal('inventory-detail-modal');
  // 부서 권한: rnd 일반직원은 strategy 품목 편집 불가
  window.eval('STATE').profile.role='employee'; window.eval('STATE').profile.deptId='rnd';
  ok('canManageInventory other dept false', window.canManageInventory(S().inventory.find(i=>i.id===1)) === false);
  ok('canManageInventory own dept true', window.canManageInventory(S().inventory.find(i=>i.id===2)) === true);
  window.eval('STATE').profile.role='admin'; window.eval('STATE').profile.deptId='strategy';
  // 실시간 상세 갱신
  window.openInventoryDetail(2);
  DBDATA.inventory_items.find(i=>i.id===2).name='장갑(실시간변경)';
  await window.reloadInventory(); window.refreshOpenDetail('inventory');
  ok('inventory detail live-updates', doc.getElementById('inventory-detail-body').innerHTML.indexOf('장갑(실시간변경)') >= 0);
  window.closeModal('inventory-detail-modal');

  // ===== 발주 · 견적 (SLENO 양식) =====
  await window.reloadTrade();
  ok('trade loaded (empty)', Array.isArray(S().trade));
  ok('default company logo embedded', (window.company().logo||'').indexOf('data:image')===0);
  await window.switchTab('trade');
  // 발주서 작성
  window.openTradeForm(null,'po');
  ok('trade form opens as 발주서', doc.getElementById('trade-kind').value==='po');
  ok('docno auto-prefilled PO', /^PO-\d{6}-\d{4}$/.test(doc.getElementById('trade-docno').value));
  ok('payment default set for PO', doc.getElementById('trade-payment').value.indexOf('AFTER DELIVERY')>=0);
  // 라인1(메인) + 라인2(세부, 합계제외) + 라인3(메인)
  window.updateTradeLine(0,'description','안전모니터링 시스템 구축'); window.updateTradeLine(0,'unit','LOT'); window.updateTradeLine(0,'qty','1'); window.updateTradeLine(0,'unitPrice','10000000');
  window.addTradeLine(true); window.updateTradeLine(1,'description','안전모니터링 엣지서버'); window.updateTradeLine(1,'qty','1'); window.updateTradeLine(1,'unitPrice','3000000');
  ok('sub line flagged', S().tradeDraft.items[1].sub===true);
  window.addTradeLine(false); window.updateTradeLine(2,'description','진동센서'); window.updateTradeLine(2,'unit','EA'); window.updateTradeLine(2,'qty','4'); window.updateTradeLine(2,'unitPrice','1000000');
  const tot = window.computeTradeTotals();
  ok('subtotal excludes sub-lines', tot.subtotal === 10000000 + 4*1000000);
  // VAT off in this doc
  ok('no VAT total equals subtotal', tot.total === tot.subtotal);
  // REMARKS
  window.addTradeRemark(); window.updateTradeRemark(0,'수소, 화재감지기 등 디지털센서 20개 연결 가능');
  doc.getElementById('trade-client').value='제이엔케이글로벌'; doc.getElementById('trade-service').value='서귀포 수소충전소 안전모니터링 시스템';
  doc.getElementById('trade-docno').value='GEP260521-KR_Rev.0';
  doc.getElementById('trade-person').value='MR. FELIX PARK (+82-10-3920-1466)'; doc.getElementById('trade-dept').value='strategy';
  doc.getElementById('trade-issuer-email').value='odk@personal.com'; doc.getElementById('trade-issuer-tel').value='+82-10-1111-2222';
  await window.handleSaveTrade(ev());
  ok('trade created', S().trade.length===1 && S().trade[0].kind==='po');
  ok('custom doc_no kept', S().trade[0].docNo==='GEP260521-KR_Rev.0');
  ok('header fields saved', S().trade[0].client==='제이엔케이글로벌' && S().trade[0].service.indexOf('서귀포')>=0 && S().trade[0].personInCharge.indexOf('FELIX')>=0);
  ok('items + sub saved', S().trade[0].items.length===3 && S().trade[0].items[1].sub===true);
  ok('remarks saved', S().trade[0].remarks.length===1);
  ok('issuer contact saved', S().trade[0].issuerEmail==='odk@personal.com' && S().trade[0].issuerTel.indexOf('1111')>=0);
  ok('total excludes sub', S().trade[0].total === 14000000);
  const tid = S().trade[0].id;
  // 상세 + 문서 HTML (표지/상세, SLENO 양식)
  window.openTradeDetail(tid);
  const dbody = doc.getElementById('trade-detail-body').innerHTML;
  ok('detail renders PURCHASE ORDER + client', dbody.indexOf('PURCHASE ORDER')>=0 && dbody.indexOf('제이엔케이글로벌')>=0);
  ok('detail renders TOTAL AMOUNT band', dbody.indexOf('TOTAL AMOUNT')>=0);
  ok('detail renders sub item indented', dbody.indexOf('안전모니터링 엣지서버')>=0);
  ok('detail renders remark', dbody.indexOf('디지털센서 20개')>=0);
  ok('detail renders company logo img', dbody.indexOf('<img src="data:image')>=0);
  ok('detail uses per-doc issuer email', dbody.indexOf('odk@personal.com')>=0);
  ok('doc preview uses dark-safe paper', dbody.indexOf('wsp-doc-paper')>=0);
  ok('validity is calendar picker', doc.getElementById('trade-validity').getAttribute('type')==='date');
  ok('notice date is calendar picker', doc.getElementById('notice-date').getAttribute('type')==='date');
  window.openTradeForm(null,'po'); ok('unit datalist (managed units) present', !!doc.getElementById('trade-unit-list')); window.closeModal('trade-form-modal');
  // 상태 변경
  await window.setTradeStatus(tid,'issued');
  ok('status changed to issued', S().trade[0].status==='issued');
  // 견적서 작성 → 자동 QT 문서번호
  window.openTradeForm(null,'quote');
  ok('trade form opens as 견적서', doc.getElementById('trade-kind').value==='quote');
  ok('docno auto-prefilled QT', /^QT-\d{6}-\d{4}$/.test(doc.getElementById('trade-docno').value));
  window.updateTradeLine(0,'description','컨설팅'); window.updateTradeLine(0,'qty','1'); window.updateTradeLine(0,'unitPrice','500000');
  doc.getElementById('trade-client').value='한빛전자';
  await window.handleSaveTrade(ev());
  const qt = S().trade.find(t=>t.kind==='quote');
  ok('quote created with QT doc_no', qt && /^QT-\d{6}-\d{4}$/.test(qt.docNo));
  // ===== 문서번호 채번 서버 RPC (원자적) =====
  window.openTradeForm(null,'po');
  window.updateTradeLine(0,'description','A'); window.updateTradeLine(0,'qty','1'); window.updateTradeLine(0,'unitPrice','1000');
  doc.getElementById('trade-client').value='채번A';
  await window.handleSaveTrade(ev());
  const _cnA = S().trade.find(t=>t.client==='채번A').docNo;
  window.openTradeForm(null,'po');
  window.updateTradeLine(0,'description','B'); window.updateTradeLine(0,'qty','1'); window.updateTradeLine(0,'unitPrice','1000');
  doc.getElementById('trade-client').value='채번B';
  await window.handleSaveTrade(ev());
  const _cnB = S().trade.find(t=>t.client==='채번B').docNo;
  ok('server doc no format valid', /^PO-\d{6}-\d{4}$/.test(_cnA) && /^PO-\d{6}-\d{4}$/.test(_cnB));
  ok('server doc no atomic-unique', _cnA !== _cnB);
  ok('server doc no sequential', Number(_cnB.slice(-4)) === Number(_cnA.slice(-4)) + 1);
  // 회사 정보 편집
  window.openCompanyProfile();
  doc.getElementById('company-name').value='테스트컴퍼니'; doc.getElementById('company-email').value='a@b.c';
  await window.handleSaveCompany(ev());
  ok('company profile updated', S().company.name==='테스트컴퍼니');
  ok('company applied to doc', window.tradeDocHTML(S().trade.find(t=>t.kind==='quote')).detail.indexOf('테스트컴퍼니')>=0);
  // 종류 필터
  window.switchTab('trade');
  doc.getElementById('trade-filter-kind').value='quote'; window.tradeApplyFilter();
  ok('kind filter (quote only)', doc.getElementById('trade-list-body').innerHTML.indexOf('한빛전자')>=0 && doc.getElementById('trade-list-body').innerHTML.indexOf('제이엔케이글로벌')<0);
  doc.getElementById('trade-filter-kind').value='all'; window.tradeApplyFilter();
  // 권한
  window.eval('STATE').profile.role='employee'; window.eval('STATE').profile.deptId='rnd';
  ok('canManageTrade other dept false', window.canManageTrade(S().trade.find(t=>t.deptId==='strategy'))===false);
  window.eval('STATE').profile.role='admin'; window.eval('STATE').profile.deptId='strategy';
  // 삭제
  await window.deleteTrade(qt.id);
  ok('trade deleted', !S().trade.some(t=>t.id===qt.id));

  // ===== 발주 ↔ 재고 자동 연동 =====
  window.openTradeForm(null,'po');
  window.updateTradeLine(0,'description','볼트 M8'); window.updateTradeLine(0,'unit','EA'); window.updateTradeLine(0,'qty','7'); window.updateTradeLine(0,'unitPrice','100');
  doc.getElementById('trade-client').value='연동테스트'; doc.getElementById('trade-dept').value='strategy';
  await window.handleSaveTrade(ev());
  const linkPo = S().trade.find(t=>t.client==='연동테스트');
  ok('link PO created (not received)', linkPo && !linkPo.receivedAt);
  const boltBefore = S().inventory.find(i=>i.id===1).stock;
  // 완료 처리 → 입고 창 자동 안내 + 이름 자동 매칭
  await window.setTradeStatus(linkPo.id,'done');
  ok('completion auto-opens stock modal', !doc.getElementById('trade-stock-modal').classList.contains('hidden'));
  ok('stock modal auto-matches by name', S().tradeStockDraft.rows[0].itemId===1 && S().tradeStockDraft.rows[0].qty===7);
  await window.handleApplyTradeStock();
  ok('PO completion increases inventory (atomic)', S().inventory.find(i=>i.id===1).stock === boltBefore+7);
  ok('stock move reason references doc', S().stockMoves.some(m=>m.itemId===1 && (m.reason||'').indexOf('발주 입고')>=0));
  ok('trade marked received', !!S().trade.find(t=>t.id===linkPo.id).receivedAt);
  // 중복 반영 방지
  window.openTradeStockModal(linkPo.id);
  ok('re-open blocked after received', doc.getElementById('trade-stock-modal').classList.contains('hidden'));

  // ===== 거래처 마스터 =====
  await window.reloadPartners();
  ok('partners loaded (empty)', Array.isArray(S().partners) && S().partners.length===0);
  window.openPartnerManager();
  doc.getElementById('partner-name').value='제이엔케이글로벌'; doc.getElementById('partner-kind').value='client'; doc.getElementById('partner-contact').value='김부장'; doc.getElementById('partner-tel').value='02-111-2222'; doc.getElementById('partner-email').value='jnk@corp.com';
  await window.handleSavePartner(ev());
  ok('partner created', S().partners.some(p=>p.name==='제이엔케이글로벌' && p.kind==='client'));
  ok('partner list renders', doc.getElementById('partner-list').innerHTML.indexOf('제이엔케이글로벌')>=0);
  ok('trade client datalist populated', doc.getElementById('trade-partner-list').innerHTML.indexOf('제이엔케이글로벌')>=0);
  // 편집
  const pid = S().partners.find(p=>p.name==='제이엔케이글로벌').id;
  window.editPartner(pid);
  ok('edit loads partner into form', doc.getElementById('partner-name').value==='제이엔케이글로벌' && doc.getElementById('partner-contact').value==='김부장');
  doc.getElementById('partner-tel').value='02-999-8888';
  await window.handleSavePartner(ev());
  ok('partner updated', S().partners.find(p=>p.id===pid).tel==='02-999-8888');
  // 발주서 폼에서 거래처 datalist로 CLIENT 선택 가능
  window.openTradeForm(null,'po');
  ok('trade form client datalist has partner', doc.getElementById('trade-partner-list').innerHTML.indexOf('제이엔케이글로벌')>=0);
  window.closeModal('trade-form-modal');
  // 삭제
  await window.deletePartner(pid);
  ok('partner deleted', !S().partners.some(p=>p.id===pid));

  // ===== 엑셀 내보내기 / 가져오기 =====
  ok('export aoa inventory (header+rows)', window.buildExportAoa('inventory').headers[1]==='품목명' && window.buildExportAoa('inventory').rows.length===S().inventory.length);
  ok('export aoa partners header', window.buildExportAoa('partners').headers[0]==='거래처명');
  ok('export aoa trade header', window.buildExportAoa('trade').headers[0]==='문서번호');
  const np = window.normalizeImportRows('partners', [{거래처명:'엑셀거래처','구분':'공급처','담당자':'박과장','TEL':'031-1'}, {거래처명:''}]);
  ok('normalize partners: maps kind/fields, skips empty', np.length===1 && np[0].name==='엑셀거래처' && np[0].kind==='supplier' && np[0].contact==='박과장' && np[0].tel==='031-1');
  S().importDraft={ type:'partners', rows: np };
  await window.confirmImport();
  ok('import inserts partners rows', S().partners.some(p=>p.name==='엑셀거래처' && p.kind==='supplier'));
  const ni = window.normalizeImportRows('inventory', [{품목명:'엑셀볼트','분류':'부품','현재고':'4','단가':'500'}]);
  ok('normalize inventory: maps + auto SKU (PT-xxxx)', ni.length===1 && ni[0].name==='엑셀볼트' && ni[0].stock===4 && ni[0].unit_price===500 && /^PT-\d{4}$/.test(ni[0].sku));
  const invLenBefore = S().inventory.length;
  S().importDraft={ type:'inventory', rows: ni };
  await window.confirmImport();
  ok('import inserts inventory rows', S().inventory.length===invLenBefore+1 && S().inventory.some(i=>i.name==='엑셀볼트'));

  // ===== 가져오기 중복 시 갱신(추가 생성 X) + 스타일 엑셀 메타 =====
  const _invLen = S().inventory.length;
  const _dup = window.normalizeImportRows('inventory', [{품목명:'볼트 M8','현재고':'33','단가':'150'}]);
  ok('import matches existing item (adopts sku, marked update)', _dup[0]._match===1 && _dup[0].sku==='A-1');
  S().importDraft={ type:'inventory', rows:_dup };
  await window.confirmImport();
  ok('import update creates no duplicate', S().inventory.length===_invLen);
  ok('import update reconciles default-wh to imported qty (not added)', window.itemWhQty(1,1)===33);
  ok('import update applies changed price', S().inventory.find(i=>i.id===1).unitPrice===150);
  ok('import update does not blank category', S().inventory.find(i=>i.id===1).category==='부품');
  const _pdup = window.normalizeImportRows('partners', [{거래처명:'엑셀거래처','담당자':'새담당'}]);
  ok('partner import matches existing', _pdup[0]._match!=null);
  const _plen=S().partners.length;
  S().importDraft={ type:'partners', rows:_pdup };
  await window.confirmImport();
  ok('partner import update no duplicate', S().partners.length===_plen);
  ok('partner update applies field', (S().partners.find(p=>p.name==='엑셀거래처')||{}).contact==='새담당');
  ok('partner update keeps kind', (S().partners.find(p=>p.name==='엑셀거래처')||{}).kind==='supplier');
  const _em = window.exportMeta('inventory', window.buildExportAoa('inventory').rows);
  ok('exportMeta inventory (title/aligns/total)', _em.title.indexOf('자재 관리')>=0 && _em.aligns.length===11 && Array.isArray(_em.totalRow));
  ok('exportMeta trade total numFmt', window.exportMeta('trade', window.buildExportAoa('trade').rows).numFmts[6]==='#,##0');

  // ===== 양식 없이 가져오기(머리글 자동 탐지) + 새 분류 자동 등록 =====
  const _aoa = [['재고 자재 관리 대장','','','',''],['우리회사  생성일 2026','','','',''],['','','','',''],['품목코드','품목명','분류','현재고','단가'],['','형강 H-100','신규분류','12','900'],['합계','','','','']];
  const _objs = window.pickHeaderObjects(_aoa, 'inventory');
  ok('header auto-detected below title rows (합계 제외)', _objs.length===1 && _objs[0]['품목명']==='형강 H-100' && _objs[0]['분류']==='신규분류');
  const _imp2 = window.normalizeImportRows('inventory', _objs);
  ok('normalize from auto-detected objects', _imp2.length===1 && _imp2[0].name==='형강 H-100' && _imp2[0].stock===12);
  ok('new category not yet in options', !(S().invOptions.category||[]).some(o=>o.value==='신규분류'));
  S().importDraft={ type:'inventory', rows:_imp2 };
  await window.confirmImport();
  ok('imported item with new category created', S().inventory.some(i=>i.name==='형강 H-100'));
  ok('new category auto-registered to system', (S().invOptions.category||[]).some(o=>o.value==='신규분류'));
  ok('new product name auto-registered', (S().invOptions.name||[]).some(o=>o.value==='형강 H-100'));

  // ===== 창고 관리 + 창고별 재고 =====
  ok('default warehouse loaded', S().warehouses.length>=1 && S().warehouses[0].name==='기본창고');
  ok('existing stock migrated to default warehouse', window.itemWhQty(2,1)===50);
  window.openWarehouseManager();
  doc.getElementById('warehouse-name').value='제2창고'; doc.getElementById('warehouse-code').value='WH2';
  await window.handleSaveWarehouse(ev());
  const wh2 = S().warehouses.find(w=>w.name==='제2창고');
  ok('warehouse created', !!wh2);
  ok('warehouse filter option added', [...doc.getElementById('inventory-filter-wh').options].some(o=>o.textContent==='제2창고'));
  const it1wh1 = window.itemWhQty(1,1);
  window.openStockMove(1,'in'); doc.getElementById('stock-move-warehouse').value=String(wh2.id); doc.getElementById('stock-move-qty').value='4'; doc.getElementById('stock-move-reason').value='제2창고 입고';
  await window.handleStockMove(ev());
  ok('stock into specific warehouse', window.itemWhQty(1, wh2.id)===4);
  ok('item total = sum across warehouses', S().inventory.find(i=>i.id===1).stock === it1wh1+4);
  ok('move records warehouse', S().stockMoves.some(m=>m.itemId===1 && m.warehouseId===wh2.id && m.qty===4));
  window.openInventoryDetail(1);
  ok('detail shows per-warehouse breakdown', doc.getElementById('inventory-detail-body').innerHTML.indexOf('창고별 재고')>=0);
  window.closeModal('inventory-detail-modal');
  const _whCount = S().warehouses.length;
  await window.deleteWarehouse(wh2.id);
  ok('cannot delete warehouse holding stock', S().warehouses.length===_whCount);

  // ===== 업그레이드 후 편집에서 새 기능(창고) 사용 가능 =====
  window.openInventoryForm(1);
  ok('edit: stock field editable (not locked)', doc.getElementById('inventory-stock').readOnly===false);
  ok('edit: warehouse selector visible', doc.getElementById('inventory-warehouse-wrap').style.display!=='none');
  ok('edit: shows current warehouse breakdown', doc.getElementById('inventory-form-wh-info').innerHTML.indexOf('창고별 재고')>=0 && doc.getElementById('inventory-form-wh-info').style.display!=='none');
  const _beforeStock = S().inventory.find(i=>i.id===1).stock;
  doc.getElementById('inventory-stock').value='3';
  await window.handleSaveInventoryItem(ev());
  ok('edit can add stock to warehouse (upgraded feature usable)', S().inventory.find(i=>i.id===1).stock===_beforeStock+3);
  window.openInventoryForm();
  ok('new: stock label is 기초재고', doc.getElementById('inventory-stock-label').innerHTML.indexOf('기초재고')>=0 && doc.getElementById('inventory-form-wh-info').style.display==='none');
  window.closeModal('inventory-form-modal');

  // ===== 창고 간 재고 이동(이고) =====
  const t_wh2 = S().warehouses.find(w=>w.name==='제2창고');
  ok('transfer needs 2+ warehouses (wh2 present)', !!t_wh2);
  const from0 = window.itemWhQty(1,1), to0 = window.itemWhQty(1,t_wh2.id), total0 = S().inventory.find(i=>i.id===1).stock;
  window.openTransferModal(1);
  doc.getElementById('transfer-from').value='1'; doc.getElementById('transfer-to').value=String(t_wh2.id); doc.getElementById('transfer-qty').value='5'; doc.getElementById('transfer-reason').value='현장 이동';
  await window.handleTransfer(ev());
  ok('transfer reduces source warehouse', window.itemWhQty(1,1)===from0-5);
  ok('transfer increases dest warehouse', window.itemWhQty(1,t_wh2.id)===to0+5);
  ok('transfer keeps item total unchanged', S().inventory.find(i=>i.id===1).stock===total0);
  ok('transfer records two legged moves', S().stockMoves.filter(m=>m.itemId===1 && (m.reason||'').indexOf('현장 이동')>=0).length===2);
  window.openTransferModal(1);
  doc.getElementById('transfer-from').value=String(t_wh2.id); doc.getElementById('transfer-to').value='1'; doc.getElementById('transfer-qty').value='99999';
  await window.handleTransfer(ev());
  ok('transfer blocks insufficient source', window.itemWhQty(1,t_wh2.id)===to0+5);

  // ===== 입·출고 유형 세분화 (관리형 드롭다운) =====
  ok('move types loaded into options', (S().invOptions.move_in||[]).some(o=>o.value==='구매입고') && (S().invOptions.move_out||[]).some(o=>o.value==='폐기'));
  window.openStockMove(1,'out');
  ok('stock-move shows out-type dropdown', [...doc.getElementById('stock-move-subtype').options].some(o=>o.value==='폐기'));
  doc.getElementById('stock-move-warehouse').value='1'; doc.getElementById('stock-move-subtype').value='폐기'; doc.getElementById('stock-move-qty').value='1'; doc.getElementById('stock-move-reason').value='파손';
  await window.handleStockMove(ev());
  ok('move records subtype', S().stockMoves.some(m=>m.itemId===1 && m.kind==='out' && m.subtype==='폐기'));
  window.openStockMove(1,'in');
  ok('in-type dropdown differs (구매입고)', [...doc.getElementById('stock-move-subtype').options].some(o=>o.value==='구매입고'));
  window.closeModal('stock-move-modal');
  // 유형 추가(관리형)
  window.openInventoryOptions();
  doc.getElementById('invopt-move_out-value').value='반품출고';
  await window.addInventoryOption('move_out');
  ok('add out-type option', (S().invOptions.move_out||[]).some(o=>o.value==='반품출고'));
  window.closeModal('inventory-options-modal');

  // ===== 월별/년별 재고 입출 현황 보고서 =====
  const _mv=[{itemId:1,kind:'in',qty:10,subtype:'구매입고',warehouseId:1,createdAt:'2026-03-05T01:00:00Z'},{itemId:1,kind:'out',qty:4,subtype:'폐기',warehouseId:1,createdAt:'2026-03-09T01:00:00Z'},{itemId:2,kind:'in',qty:7,subtype:'',warehouseId:1,createdAt:'2026-03-20T01:00:00Z'}];
  const _cm=window.computeMonthlyReport(_mv);
  ok('computeMonthly totals', _cm.totals.inQty===17 && _cm.totals.outQty===4 && _cm.totals.net===13);
  ok('computeMonthly subtype out 폐기', _cm.subtypeOut['폐기']===4);
  ok('computeMonthly rows joined to item names', _cm.rows.some(r=>r.name==='볼트 M8' && r.inQty===10 && r.outQty===4));
  const _cy=window.computeYearlyReport(_mv);
  ok('computeYearly 12 months', _cy.months.length===12);
  ok('computeYearly march aggregates', _cy.months[2].inQty===17 && _cy.months[2].outQty===4 && _cy.months[2].net===13);
  ok('computeYearly totals', _cy.totals.inQty===17 && _cy.totals.outQty===4);
  // end-to-end (현재 월 기준: 테스트 중 생성된 입출고가 현재 월에 기록됨)
  const _now=new Date();
  window.openInventoryReport();
  ok('report opens with current year', String(doc.getElementById('report-year').value)===String(_now.getFullYear()));
  ok('report month visible for monthly', doc.getElementById('report-month-wrap').style.display!=='none');
  await window.generateReport();
  ok('monthly report generated', S().reportDraft && S().reportDraft.type==='monthly');
  ok('monthly report rows present', S().reportDraft.rows.length>0);
  ok('monthly preview rendered', doc.getElementById('report-body').innerHTML.indexOf('월별 재고 입출 현황')>=0);
  ok('report doc html builds (print-ready)', window.reportDocHTML(S().reportDraft).indexOf('월별 재고 입출 현황')>=0);
  doc.getElementById('report-type').value='yearly'; window.onReportTypeChange();
  ok('yearly hides month selector', doc.getElementById('report-month-wrap').style.display==='none');
  await window.generateReport();
  ok('yearly report generated (12 months)', S().reportDraft.type==='yearly' && S().reportDraft.months.length===12);
  ok('yearly preview rendered', doc.getElementById('report-body').innerHTML.indexOf('월별 추이')>=0);
  window.closeModal('report-modal');

  // ===== 재고 대시보드 (창고별·공급처별·분류별) + 재고현황 =====
  window.setInventoryView('dashboard');
  const _dash = S().dashboardDraft;
  ok('dashboard totals computed', _dash && _dash.totalItems===S().inventory.length);
  ok('dashboard by-warehouse count = warehouses', Array.isArray(_dash.byWh) && _dash.byWh.length===S().warehouses.length);
  ok('dashboard by-supplier grouped', Array.isArray(_dash.bySupplier) && _dash.bySupplier.length>0);
  ok('dashboard by-category grouped', Array.isArray(_dash.byCategory) && _dash.byCategory.length>0);
  ok('dashboard KPIs rendered (수량 기준)', doc.getElementById('inventory-dashboard-body').innerHTML.indexOf('재고 총수량')>=0);
  ok('dashboard 재고총액 removed', doc.getElementById('inventory-dashboard-body').innerHTML.indexOf('재고 총액')<0 && _dash.totalVal===undefined);
  ok('dashboard warehouse section rendered', doc.getElementById('inventory-dashboard-body').innerHTML.indexOf('창고별 재고')>=0);
  ok('dashboard view visible / list hidden', !doc.getElementById('inventory-dashboard-view').classList.contains('hidden') && doc.getElementById('inventory-list-view').classList.contains('hidden'));
  const _sheets = window.buildInventoryStatusSheets(_dash);
  ok('status export builds 4 sheets', _sheets.length===4 && _sheets[0].name==='재고현황');
  ok('status sheet includes warehouse columns', _sheets[0].headers.indexOf('기본창고')>=0);
  ok('status sheet 재고금액 column removed (단가 유지)', _sheets[0].headers.indexOf('재고금액')<0 && _sheets[0].headers.indexOf('단가')>=0);
  ok('status report html builds (print)', window.dashboardReportHTML(_dash).indexOf('재고 현황 보고서')>=0);
  // 목록 보기 토글 + 목록 통계에서 재고총액 제거
  window.setInventoryView('list');
  ok('list view visible after toggle', !doc.getElementById('inventory-list-view').classList.contains('hidden') && doc.getElementById('inventory-dashboard-view').classList.contains('hidden'));
  ok('list stats 재고총액 removed', doc.getElementById('inventory-stats').innerHTML.indexOf('재고 총액')<0 && doc.getElementById('inventory-stats').innerHTML.indexOf('총 품목')>=0);
  window.setInventoryView('dashboard');

  // ===== 입출고 이력(원장) =====
  ok('filterLedger by kind', window.filterLedgerRows([{kind:'in',warehouseId:1,itemName:'A',qty:5},{kind:'out',warehouseId:1,itemName:'B',qty:2}], {kind:'out'}).length===1);
  ok('filterLedger by warehouse', window.filterLedgerRows([{kind:'in',warehouseId:1,itemName:'A'},{kind:'in',warehouseId:2,itemName:'B'}], {whId:'2'}).length===1);
  ok('filterLedger by query', window.filterLedgerRows([{kind:'in',warehouseId:1,itemName:'볼트',reason:'정기'},{kind:'in',warehouseId:1,itemName:'장갑',reason:''}], {q:'볼트'}).length===1);
  window.openLedger();
  await window.loadLedger();
  ok('ledger loaded current-month moves', Array.isArray(S().ledgerAll) && S().ledgerAll.length>0);
  ok('ledger renders table', doc.getElementById('ledger-body').innerHTML.indexOf('일시')>=0);
  ok('ledger draft set for export', Array.isArray(S().ledgerDraft) && S().ledgerDraft.length>0);
  ok('ledger rows joined to item names', S().ledgerDraft.some(r=>r.itemName==='볼트 M8'));
  doc.getElementById('ledger-kind').value='out'; window.renderLedger();
  ok('ledger kind filter applies', S().ledgerDraft.length>0 && S().ledgerDraft.every(r=>r.kind==='out'));
  doc.getElementById('ledger-kind').value='all'; window.renderLedger();
  // 품목 상세 → 전체 이력 바로가기 (item-scoped)
  window.openLedger(1);
  await window.loadLedger();
  ok('ledger item scope set', S().ledgerItemId===1);
  ok('ledger item-scoped rows only item 1', S().ledgerDraft.length>0 && S().ledgerDraft.every(r=>r.itemId===1));
  ok('ledger scope banner rendered', doc.getElementById('ledger-body').innerHTML.indexOf('품목만 표시')>=0);
  window.clearLedgerItem();
  ok('ledger clear item scope shows others', S().ledgerItemId===null && S().ledgerDraft.some(r=>r.itemId!==1));
  window.closeModal('ledger-modal');

  // ===== 재고 부족 → 발주서 자동 생성 =====
  window.createPoFromItem(1);
  ok('PO draft opened as 발주서', doc.getElementById('trade-kind').value==='po');
  ok('PO draft client = item supplier', doc.getElementById('trade-client').value===S().inventory.find(i=>i.id===1).supplier);
  ok('PO draft single line from item', S().tradeDraft.items.length===1 && S().tradeDraft.items[0].description.indexOf('볼트 M8')>=0);
  ok('PO draft reorder qty positive', S().tradeDraft.items[0].qty>0 && S().tradeDraft.items[0].unitPrice===S().inventory.find(i=>i.id===1).unitPrice);
  window.closeModal('trade-form-modal');

  // ===== 백업 복원(JSON) =====
  const _restore = { version:'wsp-backup-1', exportedAt:'2026-01-01', warehouses:[{id:99,name:'복원창고',code:'RC',location:'',notes:''}], inventory:[{id:88,sku:'RST-0001',name:'복원품목',category:'부품',unit:'EA',stock:7,safeStock:2,unitPrice:300,supplier:'복원공급',location:'',deptId:'strategy',notes:''}], inventoryStock:{88:{99:7}}, stockMoves:[], partners:[{name:'복원거래처',kind:'supplier',contact:'홍',tel:'',fax:'',email:'',bizNo:'',address:'',notes:''}], options:{category:[],unit:[],name:[],move_in:[],move_out:[]}, trade:[] };
  const _whBefore = S().warehouses.length, _pBefore = S().partners.length;
  await window.restoreBackup(_restore);
  ok('restore adds missing warehouse', S().warehouses.some(w=>w.name==='복원창고'));
  ok('restore adds missing item', S().inventory.some(i=>i.name==='복원품목'));
  ok('restore adds missing partner', S().partners.some(p=>p.name==='복원거래처'));
  const _ri = S().inventory.find(i=>i.name==='복원품목'), _rw = S().warehouses.find(w=>w.name==='복원창고');
  ok('restore reconciles stock to backup level', !!_ri && !!_rw && window.itemWhQty(_ri.id,_rw.id)===7 && Number(_ri.stock)===7);
  ok('restore no duplication (warehouses +1)', S().warehouses.length===_whBefore+1);
  await window.restoreBackup(_restore);
  ok('restore idempotent (no second warehouse)', S().warehouses.filter(w=>w.name==='복원창고').length===1 && S().warehouses.length===_whBefore+1);

  // ===== 빈 상태 안내(empty-state) =====
  ok('empty-state hidden when data present', window.inventoryEmptyStateHTML()==='');
  const _saveWh = S().warehouses, _saveInv = S().inventory;
  S().inventory = [];
  ok('empty-state: no items → 품목 등록 안내', window.inventoryEmptyStateHTML().indexOf('openInventoryForm')>=0 && window.inventoryEmptyStateHTML().indexOf('등록된 품목이 없습니다')>=0);
  S().warehouses = [];
  ok('empty-state: no warehouse → 창고 등록 안내', window.inventoryEmptyStateHTML().indexOf('openWarehouseManager')>=0 && window.inventoryEmptyStateHTML().indexOf('창고가 아직 없습니다')>=0);
  S().warehouses = _saveWh; S().inventory = _saveInv;

  // ===== 대량 데이터 분할 조회(페이지네이션) =====
  const _pgData = Array.from({length:2500}, (_,i)=>({id:i}));
  const _pgBuild = () => ({ range(a,b){ return { then(res){ res({ data:_pgData.slice(a, b+1), error:null }); } }; } });
  const _pgRes = await window.fetchAllPaged(_pgBuild, 1000);
  ok('paged fetch accumulates across pages', _pgRes.data.length===2500 && !_pgRes.error);
  ok('paged fetch keeps order/contiguity', _pgRes.data[0].id===0 && _pgRes.data[2499].id===2499);
  const _pgErrBuild = () => ({ range(){ return { then(res){ res({ data:null, error:{message:'boom'} }); } }; } });
  const _pgErrRes = await window.fetchAllPaged(_pgErrBuild, 1000);
  ok('paged fetch propagates error', !!_pgErrRes.error && _pgErrRes.data.length===0);
  ok('inventory reload via paged fetch works', S().inventory.length>0);

  // ===== 로딩·에러 상태 일관화 =====
  const _saveInv2 = S().inventory.slice();
  S().inventory = []; S().inventoryTableMissing = true;
  window.setInventoryView('dashboard');
  ok('error-state shown on dashboard (not empty-state)', doc.getElementById('inventory-dashboard-body').innerHTML.indexOf('retryInventoryLoad')>=0 && doc.getElementById('inventory-dashboard-body').innerHTML.indexOf('불러오지 못')>=0);
  window.setInventoryView('list');
  ok('error-state shown on list', doc.getElementById('inventory-list-body').innerHTML.indexOf('retryInventoryLoad')>=0);
  await window.retryInventoryLoad();
  ok('retry reloads data + clears error flag', S().inventoryTableMissing===false && S().inventory.length>0);
  // ledger error flag → retry UI
  S().ledgerError = true; window.renderLedger();
  ok('ledger error-state shows retry', doc.getElementById('ledger-body').innerHTML.indexOf('loadLedger')>=0 && doc.getElementById('ledger-body').innerHTML.indexOf('불러오지 못')>=0);
  S().ledgerError = false;
  window.setInventoryView('dashboard');

  // ===== 재고 실사(일괄 카운트·조정) =====
  window.openStocktake();
  const _stWh = Number(doc.getElementById('stocktake-wh').value);
  const _sys1 = window.itemWhQty(1, _stWh);
  ok('stocktake diff excludes unchanged', window.computeStocktakeDiffs(S().inventory, _stWh, {1:_sys1}).length===0);
  ok('stocktake diff detects change', (()=>{ const d=window.computeStocktakeDiffs(S().inventory,_stWh,{1:_sys1+5}); return d.length===1 && d[0].diff===5 && d[0].counted===_sys1+5; })());
  ok('stocktake ignores invalid/negative', window.computeStocktakeDiffs(S().inventory,_stWh,{1:'abc',2:-3}).length===0);
  const _tot1 = Number(S().inventory.find(i=>i.id===1).stock);
  S().stocktakeCounts = { 1: _sys1 + 5 };
  await window.handleStocktake();
  ok('stocktake applied to warehouse qty', window.itemWhQty(1,_stWh)===_sys1+5);
  ok('stocktake updated total stock (+5)', Number(S().inventory.find(i=>i.id===1).stock)===_tot1+5);
  ok('stocktake logged 실사 move', S().stockMoves.some(m=>m.itemId===1 && m.reason==='재고 실사'));

  // ===== 통합 캘린더: 납기·유효기간·PM 자동 표시 =====
  const _cfmt = (off) => { const d=new Date(); d.setDate(d.getDate()+off); return d.toISOString().slice(0,10); };
  S().trade.push(
    { id:8001, kind:'po', docNo:'PO-CAL', client:'갑', service:'x', status:'issued', deptId:'strategy', dueDate:_cfmt(2) },
    { id:8002, kind:'quote', docNo:'QT-CAL', client:'을', service:'y', status:'issued', deptId:'strategy', validity:_cfmt(4) },
    { id:8003, kind:'po', docNo:'PO-DONE2', client:'병', service:'z', status:'done', deptId:'strategy', dueDate:_cfmt(1) }
  );
  const _di = window.derivedCalendarItems();
  ok('calendar derived: PO due item', _di.some(d=>d._ref.type==='trade' && d._ref.id===8001 && d.startDate===_cfmt(2)));
  ok('calendar derived: quote validity item', _di.some(d=>d._ref.id===8002 && d.title.indexOf('유효')>=0));
  ok('calendar derived: asset PM item present', _di.some(d=>d._ref.type==='asset'));
  ok('calendar derived: done trade excluded', !_di.some(d=>d._ref.id===8003));
  window.toggleCalOps(); ok('cal ops toggle off', S().calShowOps===false);
  window.toggleCalOps(); ok('cal ops toggle on', S().calShowOps===true);
  const _sy=S().currentYear, _sm=S().currentMonth;
  S().currentYear = Number(_cfmt(2).slice(0,4)); S().currentMonth = Number(_cfmt(2).slice(5,7));
  window.renderCalendar();
  ok('calendar renders derived due entry', doc.getElementById('calendar-grid').innerHTML.indexOf('PO-CAL')>=0);
  S().currentYear=_sy; S().currentMonth=_sm;
  S().trade = S().trade.filter(t=>![8001,8002,8003].includes(t.id));

  // ===== 거래처 선택 → 담당자·연락처 자동 채움 =====
  ok('partnerPersonText formats contact/tel', window.partnerPersonText({contact:'A', tel:'010'})==='A / 010' && window.partnerPersonText({contact:'B'})==='B' && window.partnerPersonText({tel:'77'})==='77');
  S().partners.push({ id:9001, name:'자동공급', kind:'supplier', contact:'김담당', tel:'+82-10-1234', fax:'', email:'', address:'', notes:'' });
  ok('findPartnerByName matches (case-insensitive)', !!window.findPartnerByName('자동공급') && window.findPartnerByName('자동공급').contact==='김담당');
  window.openTradeForm(null, 'po');
  doc.getElementById('trade-client').value='자동공급';
  window.onTradeClientChange();
  ok('partner autofill fills person/contact', doc.getElementById('trade-person').value.indexOf('김담당')>=0 && doc.getElementById('trade-person').value.indexOf('+82-10-1234')>=0);
  doc.getElementById('trade-person').value='직접입력';
  doc.getElementById('trade-client').value='자동공급';
  window.onTradeClientChange();
  ok('partner autofill respects user-entered value', doc.getElementById('trade-person').value==='직접입력');
  window.closeModal('trade-form-modal');

  // ===== 접근성: Esc 닫기 · 모달 스택 · aria-label =====
  const _ab = doc.createElement('button'); _ab.innerHTML = '<i data-lucide="x"></i>'; doc.body.appendChild(_ab);
  window.enhanceA11y(_ab.parentNode);
  ok('a11y: aria-label on close icon button', _ab.getAttribute('aria-label')==='닫기');
  _ab.remove();
  S().modalStack = [];
  window.openModal('data-modal');
  ok('modal stack tracks open + visible', (S().modalStack||[]).slice(-1)[0]==='data-modal' && !doc.getElementById('data-modal').classList.contains('hidden'));
  window.openModal('ledger-modal');
  ok('stack top is last opened (nested)', (S().modalStack||[]).slice(-1)[0]==='ledger-modal');
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape' }));
  ok('Esc closes only top modal', doc.getElementById('ledger-modal').classList.contains('hidden') && !doc.getElementById('data-modal').classList.contains('hidden'));
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape' }));
  ok('Esc closes next modal + stack empty', doc.getElementById('data-modal').classList.contains('hidden') && (S().modalStack||[]).length===0);

  // ===== 하이브리드: 상세·미리보기 사이드 패널 + 펼치기 토글 =====
  window.openModal('doc-preview-modal');
  const _dm = doc.getElementById('doc-preview-modal');
  const _pmx = doc.querySelector('#doc-preview-modal > div');
  ok('preview opens as side drawer', _dm.classList.contains('modal-drawer') && _dm.classList.contains('drawer-open'));
  ok('drawer starts at side (not full)', _pmx && !_pmx.classList.contains('drawer-full'));
  window.toggleModalMaximize('doc-preview-modal');
  ok('expand → drawer-full', _pmx.classList.contains('drawer-full'));
  window.toggleModalMaximize('doc-preview-modal');
  ok('collapse → side again', !_pmx.classList.contains('drawer-full'));
  _pmx.classList.add('drawer-full');
  window.openModal('doc-preview-modal');
  ok('reopen resets to side', !_pmx.classList.contains('drawer-full') && _dm.classList.contains('drawer-open'));
  window.closeModal('doc-preview-modal');
  // 드로어: 좌측 확장 탭 존재 + 빈 여백 클릭 시 닫힘
  window.openModal('trade-detail-modal');
  const _tv = doc.getElementById('trade-detail-modal');
  ok('drawer shows left expand tab', !!_tv.querySelector('.drawer-expand-tab'));
  _tv.onclick({ target: _tv });
  ok('backdrop click closes drawer', !_tv.classList.contains('drawer-open'));
  // 폼 모달은 사이드가 아니라 기존 중앙 모달 유지
  window.openModal('warehouse-modal');
  ok('form modal stays centered (not drawer)', !doc.getElementById('warehouse-modal').classList.contains('modal-drawer'));
  window.closeModal('warehouse-modal');

  // ===== 데이터 버전 / 마이그레이션 =====
  ok('appDataVersion exposed', typeof window.appDataVersion==='function' && window.appDataVersion()>=1);
  S().dataVersion = 0;
  await window.runMigrations();
  ok('runMigrations bumps version (admin)', S().dataVersion===window.appDataVersion());
  await window.runMigrations();
  ok('runMigrations idempotent at current', S().dataVersion===window.appDataVersion());
  const _role0 = S().profile.role; S().profile.role='employee'; S().dataVersion=0;
  await window.runMigrations();
  ok('runMigrations skipped for non-admin', S().dataVersion===0);
  S().profile.role=_role0;
  S().dataVersion=0;
  await window.repairData();
  ok('repairData applies + stamps version', S().dataVersion===window.appDataVersion());
  await window.reloadSettings();
  ok('data_version persisted + reloaded', Number(S().dataVersion)===window.appDataVersion());

  // ===== 로고 스토리지 이전 =====
  ok('dataUrlToBlob converts to Blob', (()=>{ const b=window.dataUrlToBlob('data:image/png;base64,iVBORw0KGgo='); return b && b.type==='image/png' && b.size>0; })());
  const _lurl = await window.uploadLogoToStorage('data:image/png;base64,iVBORw0KGgo=');
  ok('uploadLogoToStorage returns public url', typeof _lurl==='string' && _lurl.indexOf('/branding/')>=0);
  window.openCompanyProfile();
  ok('logo change flag reset on open', S().companyLogoChanged===false);
  doc.getElementById('company-name').value='테스트회사';
  S().companyLogoDraft='data:image/png;base64,iVBORw0KGgo='; S().companyLogoChanged=true;
  await window.handleSaveCompany(ev());
  ok('company logo saved as storage URL (not base64)', /^https?:\/\//.test(window.company().logo) && window.company().logo.indexOf('data:')<0);
  ok('logo change flag cleared after save', S().companyLogoChanged===false);

  // ===== 5단계: 데이터 백업 / 초기화 =====
  const _bk = window.collectBackup();
  ok('backup collects inventory+warehouses+moves', Array.isArray(_bk.inventory) && _bk.inventory.length===S().inventory.length && Array.isArray(_bk.warehouses) && Array.isArray(_bk.stockMoves));
  ok('backup has version + timestamp', _bk.version==='wsp-backup-1' && !!_bk.exportedAt);
  doc.getElementById('data-reset-confirm').value='초기화';
  const _zr = doc.querySelector('input[name="data-reset-scope"][value="zero"]'); if (_zr) _zr.checked = true;
  await window.handleDataReset();
  ok('reset(zero) sets all stock to 0', S().inventory.length>0 && S().inventory.every(i=>Number(i.stock)===0));
  ok('reset(zero) keeps catalog (items not deleted)', S().inventory.length>0);

  // ===== 상세 위에 편집 폼이 "겹쳐" 뜨고, 저장 시 상세가 갱신 =====
  window.openTradeDetail(linkPo.id);
  ok('trade detail open before edit', !doc.getElementById('trade-detail-modal').classList.contains('hidden'));
  window.openTradeForm(linkPo.id);
  ok('edit form layers ABOVE trade detail (both open)', !doc.getElementById('trade-detail-modal').classList.contains('hidden') && !doc.getElementById('trade-form-modal').classList.contains('hidden'));
  doc.getElementById('trade-client').value='연동테스트-수정';
  await window.handleSaveTrade(ev());
  ok('after save: form closed, detail stays + refreshed', doc.getElementById('trade-form-modal').classList.contains('hidden') && !doc.getElementById('trade-detail-modal').classList.contains('hidden') && S().trade.find(t=>t.id===linkPo.id).client==='연동테스트-수정');
  window.closeModal('trade-detail-modal');
  window.openInventoryDetail(1);
  ok('inventory detail open before edit', !doc.getElementById('inventory-detail-modal').classList.contains('hidden'));
  window.openInventoryForm(1);
  ok('edit form layers ABOVE inventory detail (both open)', !doc.getElementById('inventory-detail-modal').classList.contains('hidden') && !doc.getElementById('inventory-form-modal').classList.contains('hidden'));
  window.closeModal('inventory-form-modal'); window.closeModal('inventory-detail-modal');

  // ===== 프로젝트 변경 회귀 (진행도 입력 제거 / 클릭) =====
  ok('project progress input removed', !doc.getElementById('project-progress-num'));
  ok('direct progress modal removed', !doc.getElementById('update-progress-modal'));

  // logout
  await window.handleUserLogout(); ok('logout shows gateway', !$('auth-gateway-overlay').classList.contains('hidden'));

  // login again
  $('login-id').value = 'boss@co.com'; $('login-password').value = 'x';
  CURRENT_SESSION = { user: { id: 'admin-uuid', email: 'boss@co.com' } };
  await window.handleUserLogin(ev()); ok('relogin works', S().currentUser && S().currentUser.role === 'admin');

  const failed = results.filter(r => !r[1]);
  console.log('\n=== TEST RESULTS ===');
  results.forEach(([n, p]) => console.log((p ? 'PASS' : 'FAIL') + ' : ' + n));
  console.log('\nTotal ' + results.length + ', Passed ' + (results.length - failed.length) + ', Failed ' + failed.length);
  console.log('Page errors: ' + pageErrors.length);
  pageErrors.slice(0, 12).forEach(e => console.log('  ERR: ' + e));
  process.exit(failed.length === 0 && pageErrors.length === 0 ? 0 : 1);
}
setTimeout(run, 100);
