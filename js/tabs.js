// js/tabs.js
// タブ管理 & セッション自動保存

export const tabManager = {
  docs: [], 
  activeId: null,
  container: null,
  cm: null, 
  onUpdate: null, 

  init(containerEl, cmInstance, updateCallback) {
    this.container = containerEl;
    this.cm = cmInstance;
    this.onUpdate = updateCallback;
    
    // ▼▼▼ 自動復元処理 ▼▼▼
    const savedSession = localStorage.getItem('keypale_session');
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);
        if (sessionData && sessionData.tabs && sessionData.tabs.length > 0) {
          sessionData.tabs.forEach(t => {
            this.newTab(t.content, t.path, t.name, t.label, t.color, t.id, t.underlineColor); // underlineColor も復元
          });
          if (sessionData.activeId) {
            this.switchTab(sessionData.activeId);
          } else {
            this.switchTab(this.docs[0].id);
          }
        } else {
          this.newTab();
        }
      } catch (e) {
        console.error("Session restore failed", e);
        this.newTab();
      }
    } else {
      this.newTab();
    }
    
    this.setupTabDragAndDrop();
  },

  // 引数に id を追加 (復元用)、underlineColor も追加
  newTab(content = "", path = null, name = "KP", label = "", color = "#ffffff", existingId = null, underlineColor = null) {
    const id = existingId || (Date.now().toString() + Math.random().toString(36).substring(2));
    const doc = new CodeMirror.Doc(content, 'markdown');
    
    // 変更があったら自動保存をトリガー
    doc.on('change', () => {
        this.saveSession();
    });

    const tabData = { id, path, name, label, color, doc, underlineColor: underlineColor || null };
    
    this.docs.push(tabData);
    this.renderTabs();
    if(!existingId) this.switchTab(id); // 新規作成時は切り替え
    this.saveSession(); // 保存
    return id;
  },

  // ... (openFile, switchTab などの既存処理は大きく変更なし) ...

  openFile(content, path) {
    if (path && path.toLowerCase().endsWith('.json')) {
      try {
        const json = JSON.parse(content);
        if (json && Array.isArray(json.tabs)) {
          this.importTabsFromSession(json);
          return;
        }
        if (json.palettes && Array.isArray(json.palettes)) {
          json.palettes.sort((a, b) => a.order - b.order).forEach(p => {
            this.newTab(p.stock || "", null, p.name || "", p.label || "", p.textColor || "#ffffff");
          });
          return; 
        }
      } catch (e) { console.warn("JSON解析失敗", e); }
    }

    const existing = this.docs.find(d => d.path === path);
    if (existing) {
      this.switchTab(existing.id);
      return;
    }
    const current = this.getActiveTab();
    if (current && !current.path && current.doc.getValue() === "" && this.docs.length === 1) {
      current.doc.setValue(content);
      current.path = path;
      current.label = path ? path.split(/[/\\]/).pop() : "";
      this.renderTabs();
      this.switchTab(current.id);
    } else {
      const fileName = path ? path.split(/[/\\]/).pop() : "無題";
      this.newTab(content, path, "KP", fileName);
    }
    this.saveSession();
  },

  switchTab(id) {
    const target = this.docs.find(d => d.id === id);
    if (!target) return;
    this.activeId = id;
    this.cm.swapDoc(target.doc);
    
    document.title = `KeyPale - ${target.label || target.name || "無題"}`;
    this.renderTabs();
    
    if (this.onUpdate) this.onUpdate(target); 
    this.cm.focus();
    this.saveSession(); // アクティブタブ変更も保存
  },

  closeTab(id) {
    if (this.docs.length <= 1) {
      const tab = this.docs[0];
      tab.doc.setValue("");
      tab.path = null;
      tab.label = "";
      tab.name = "KP";
      tab.color = "#ffffff";
      this.renderTabs();
      this.switchTab(tab.id);
      this.saveSession();
      return;
    }
    const index = this.docs.findIndex(d => d.id === id);
    if (index === -1) return;
    if (id === this.activeId) {
      const nextTab = this.docs[index - 1] || this.docs[index + 1];
      this.switchTab(nextTab.id);
    }
    this.docs.splice(index, 1);
    this.renderTabs();
    this.saveSession();
  },

  getActiveTab() { return this.docs.find(d => d.id === this.activeId); },
  getAllContent() { return this.docs.map(tab => tab.doc.getValue()).join('\n\n'); },

  updateActiveTabInfo(name, label, color) {
    const tab = this.getActiveTab();
    if (tab) {
      if (name !== undefined) tab.name = name;
      if (label !== undefined) tab.label = label;
      if (color !== undefined) tab.color = color;
      this.renderTabs();
      this.saveSession();
    }
  },

  setupTabDragAndDrop() {
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault(); 
      const draggingTab = document.querySelector('.editor-tab.dragging');
      const siblings = [...this.container.querySelectorAll('.editor-tab:not(.dragging)')];
      const nextSibling = siblings.find(sibling => e.clientX <= sibling.getBoundingClientRect().left + sibling.getBoundingClientRect().width / 2);
      this.container.insertBefore(draggingTab, nextSibling);
    });
  },

  reorderTabsBasedOnDom() {
    const newDocs = [];
    const tabElements = this.container.querySelectorAll('.editor-tab');
    tabElements.forEach(el => {
      const id = el.dataset.id;
      const doc = this.docs.find(d => d.id === id);
      if (doc) newDocs.push(doc);
    });
    this.docs = newDocs;
    this.saveSession(); // 並び順保存
  },

  renderTabs() {
    this.container.innerHTML = '';
    this.docs.forEach(tab => {
      const el = document.createElement('div');
      el.className = `editor-tab ${tab.id === this.activeId ? 'active' : ''}`;
      el.draggable = true; 
      el.dataset.id = tab.id;
      if (tab.underlineColor && tab.id === this.activeId) {
        el.style.borderBottomColor = tab.underlineColor;
      }
      const displayText = tab.label ? tab.label : (tab.name || "無題");
      el.innerHTML = `<span class="tab-title">${displayText}</span><span class="tab-close" title="閉じる"></span>`;
      el.addEventListener('click', (e) => { if (!e.target.classList.contains('tab-close')) this.switchTab(tab.id); });
      el.querySelector('.tab-close').addEventListener('click', (e) => { e.stopPropagation(); this.closeTab(tab.id); });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.showTabContextMenu(tab.id, e.clientX, e.clientY); });
      el.addEventListener('dragstart', () => el.classList.add('dragging'));
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); this.reorderTabsBasedOnDom(); });
      this.container.appendChild(el);
    });
  },

  showTabContextMenu(tabId, x, y) {
    const existingMenu = document.getElementById('tab-context-menu');
    if (existingMenu) existingMenu.remove();
    
    const menu = document.createElement('div');
    menu.id = 'tab-context-menu';
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    const presetColors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ff8b94', '#c7ceea'];
    const colorButtons = presetColors.map(c => 
      `<div class="tab-color-preset" style="background-color:${c};" data-color="${c}"></div>`
    ).join('');
    
    menu.innerHTML = `
      <div style="padding: 8px; font-size: 11px; font-weight: bold; border-bottom: 1px solid var(--ui-border);">タブ下線の色</div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 8px;">${colorButtons}</div>
      <div style="padding: 8px; border-top: 1px solid var(--ui-border);">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px;">
          <input type="color" id="tab-underline-custom-picker" style="width: 32px; height: 24px; cursor: pointer;">
          <span>カスタム</span>
        </label>
      </div>
      <div style="padding: 4px 8px; border-top: 1px solid var(--ui-border);">
        <div class="context-menu-item" id="tab-underline-reset">デフォルトに戻す</div>
      </div>
    `;
    
    document.body.appendChild(menu);
    
    menu.querySelectorAll('.tab-color-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTabUnderlineColor(tabId, btn.dataset.color);
        menu.remove();
      });
    });
    
    const picker = menu.querySelector('#tab-underline-custom-picker');
    if (picker) {
      picker.addEventListener('change', () => {
        this.setTabUnderlineColor(tabId, picker.value);
        menu.remove();
      });
    }
    
    const reset = menu.querySelector('#tab-underline-reset');
    if (reset) {
      reset.addEventListener('click', () => {
        this.setTabUnderlineColor(tabId, null);
        menu.remove();
      });
    }
    
    const closeMenu = () => menu.remove();
    setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 100);
  },

  setTabUnderlineColor(tabId, color) {
    const tab = this.docs.find(d => d.id === tabId);
    if (!tab) return;
    tab.underlineColor = color;
    this.saveSession();
    this.renderTabs();
  },

  exportTekeyJson(target = 'current') { 
    const targets = target === 'all' ? this.docs : [this.getActiveTab()];
    const palettes = targets.map((tab, index) => {
      return {
        paletteID: index + 1, order: index, label: tab.label || "", name: tab.name || "KP", 
        stock: tab.doc.getValue(), textColor: tab.color || "#ffffff", isSearchOn: true, expandeds: []
      };
    });
    return JSON.stringify({ palettes }, null, 2);
  },

  importTabsFromSession(sessionData) {
    if (!sessionData || !Array.isArray(sessionData.tabs) || sessionData.tabs.length === 0) return;
    this.docs = [];
    this.activeId = null;
    this.renderTabs();
    sessionData.tabs.forEach(t => {
      this.newTab(
        t.content || "",
        t.path || null,
        t.name || "KP",
        t.label || "",
        t.color || "#ffffff",
        t.id || null,
        t.underlineColor || null
      );
    });
    const activeId = sessionData.activeId;
    if (activeId && this.docs.find(d => d.id === activeId)) {
      this.switchTab(activeId);
    } else if (this.docs[0]) {
      this.switchTab(this.docs[0].id);
    }
  },

  // ▼▼▼ セッション保存ロジック ▼▼▼
  saveSession() {
    const sessionData = {
      activeId: this.activeId,
      tabs: this.docs.map(d => ({
        id: d.id,
        path: d.path,
        name: d.name,
        label: d.label,
        color: d.color,
        underlineColor: d.underlineColor,
        content: d.doc.getValue()
      }))
    };
    localStorage.setItem('keypale_session', JSON.stringify(sessionData));
  }
};