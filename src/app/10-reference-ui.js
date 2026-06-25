        // ============================================================
        // 기준 HTML(workspace-pro (1).html) UI/UX 정합화
        // 기존 Supabase 기능과 이벤트는 유지하고 화면 표현만 공통 규격으로 정규화한다.
        // ============================================================
        const REFERENCE_PAGE_ACTIONS = {
            calendar: [['primary', 'plus', '일정 등록', "quickAddEvent('')"]],
            'management-progress': [['primary', 'plus', '프로젝트 추가', 'openAddProject()']],
            'weekly-meeting': [['primary', 'plus', '업무 보고 작성', 'openAddMeeting()']],
            documents: [['primary', 'file-plus', '보고서 등록', "openModal('add-doc-modal')"]],
            'field-support': [['primary', 'plus', 'AS 접수', 'openTicketForm()']],
            assets: [['primary', 'plus', '설비 등록', 'openAssetForm()']],
            trade: [
                ['ghost', 'contact', '거래처', 'openPartnerManager()'],
                ['primary', 'file-plus', '발주서', "openTradeForm(null,'po')"],
                ['primary', 'file-plus', '견적서', "openTradeForm(null,'quote')"]
            ],
            inventory: [
                ['ghost', 'warehouse', '창고', 'openWarehouseManager()'],
                ['primary', 'plus', '품목 등록', 'openInventoryForm()']
            ],
            'management-stats': [['ghost', 'settings-2', '직급 옵션', 'openTaxonomyManager()']]
        };

        function referenceActionHTML(action) {
            const [tone, icon, label, onclick] = action;
            return `<button type="button" onclick="${onclick}" class="wsp-ref-btn wsp-ref-btn-${tone}"><i data-lucide="${icon}" class="w-4 h-4"></i>${label}</button>`;
        }

        function syncReferencePageHead() {
            const title = document.getElementById('wsp-page-head-title');
            const desc = document.getElementById('wsp-page-head-description');
            const actions = document.getElementById('wsp-page-head-actions');
            const sourceTitle = document.getElementById('view-title');
            const sourceDesc = document.getElementById('view-description');
            const nextTitle = sourceTitle ? (sourceTitle.textContent || '') : '';
            const nextDesc = sourceDesc ? (sourceDesc.textContent || '') : '';
            if (title && title.textContent !== nextTitle) title.textContent = nextTitle;
            if (desc && desc.textContent !== nextDesc) desc.textContent = nextDesc;
            if (actions && actions.dataset.tab !== STATE.currentTab) {
                actions.dataset.tab = STATE.currentTab || '';
                actions.innerHTML = (REFERENCE_PAGE_ACTIONS[STATE.currentTab] || []).map(referenceActionHTML).join('');
                if (window.lucide) lucide.createIcons();
            }
        }

        function referenceButtonTone(button) {
            const cls = String(button.className || '');
            const text = (button.textContent || '').trim();
            if (/rose|danger|delete|remove/i.test(cls) || /삭제|반려|해지|초기화/.test(text)) return 'danger';
            if (/bg-(blue|indigo|amber|emerald|teal|sky|slate-9|rose)-[56789]00/.test(cls) || button.getAttribute('type') === 'submit') return 'primary';
            return 'ghost';
        }

        function normalizeReferenceButtons(root) {
            root.querySelectorAll('button:not([data-wsp-ref-button])').forEach(button => {
                button.dataset.wspRefButton = '1';
                if (button.closest('.wsp-ref-tabs') || button.closest('#wsp-page-head-actions')) return;
                const hasText = (button.textContent || '').trim().length > 0;
                if (!hasText) {
                    button.classList.add('icon-btn');
                    return;
                }
                if (button.classList.contains('sidebar-item') || button.id === 'mobile-hamburger') return;
                button.classList.add('wsp-ref-btn', `wsp-ref-btn-${referenceButtonTone(button)}`);
            });
        }

        function normalizeReferenceFields(root) {
            root.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea').forEach(field => {
                field.classList.add('wsp-ref-field');
            });
        }

        function normalizeReferenceSurfaces(root) {
            root.querySelectorAll('div.bg-white[class*="rounded-"], article.bg-white[class*="rounded-"]').forEach(card => {
                if (!card.closest('#auth-gateway-overlay')) card.classList.add('wsp-ref-surface');
            });
            root.querySelectorAll('table').forEach(table => table.classList.add('wsp-ref-table'));
        }

        function normalizeReferenceUI(root) {
            const scope = root || document;
            normalizeReferenceFields(scope);
            normalizeReferenceSurfaces(scope);
            normalizeReferenceButtons(scope);
        }

        function syncReferenceInventoryTabs() {
            const tabs = document.querySelector('#view-inventory > div:first-child > div');
            if (tabs) tabs.classList.add('wsp-ref-tabs');
            const map = {
                dashboard: document.getElementById('inv-tab-dashboard'),
                list: document.getElementById('inv-tab-list'),
                receiving: document.getElementById('inv-tab-receiving')
            };
            Object.entries(map).forEach(([key, button]) => {
                if (button) button.classList.toggle('wsp-ref-tab-active', (STATE.inventoryView || 'dashboard') === key);
            });
        }

        function applyReferenceUI() {
            syncReferencePageHead();
            syncReferenceInventoryTabs();
            normalizeReferenceUI(document.getElementById('main-content-sections') || document);
            document.querySelectorAll('[id$="-modal"]').forEach(normalizeReferenceUI);
        }

        let _referenceUiTimer = null;
        const referenceUiObserver = new MutationObserver(() => {
            clearTimeout(_referenceUiTimer);
            _referenceUiTimer = setTimeout(applyReferenceUI, 20);
        });

        function initReferenceUI() {
            const main = document.getElementById('main-content-sections');
            if (main) referenceUiObserver.observe(main, { childList: true, subtree: true });
            document.querySelectorAll('[id$="-modal"]').forEach(modal => referenceUiObserver.observe(modal, { childList: true, subtree: true }));
            const sourceTitle = document.getElementById('view-title');
            if (sourceTitle) referenceUiObserver.observe(sourceTitle, { childList: true, characterData: true, subtree: true });
            applyReferenceUI();
        }

        try {
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initReferenceUI);
            else initReferenceUI();
        } catch (e) { }
