// js/docking.js
// Golden Layout を使って既存UIを「パネル化」する
// Electron(file://) でも確実に動くよう、node_modules の ESM を動的 import する
// ※ importに失敗しても renderer 側でエラー表示できるようにするため

const LAYOUT_STORAGE_KEY = 'keypale_docking_layout_v2';
let layoutInstance = null;
let layoutCacheTimer = null;
let isResettingLayout = false;

/** 非表示にしたパネル（DOM からは外さず表示だけ隠す）。componentType -> { stack, parent, savedSize } */
const hiddenPanels = {};

// パネル内にヘッダーバーを作成するヘルパー（メニューと変数パネル用の全タブ参照トグル）
function createPanelHeader(title, panelType, hasMenu = false) {
  if (!hasMenu) return '';
  
  const variableToggle = panelType === 'variable' 
    ? `<label class="toggle-switch-wrapper" title="全てのタブの変数を参照する" style="margin-right: 8px;">
         <input type="checkbox" id="variable-global-switch">
         <span class="toggle-switch"></span>
         <span class="toggle-label">全タブ参照</span>
       </label>`
    : '';
  
  const sizeControl = (panelType === 'snippet' || panelType === 'variable')
    ? `<label class="panel-size-slider" title="項目の高さ（クリックしやすい大きさ）">
         <span class="panel-size-icon" aria-hidden="true">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
             <path d="M7 4v16M12 4v16M17 4v16M7 4h10M7 8h10M7 12h10M7 16h10"/>
           </svg>
         </span>
         <input type="range" id="${panelType}-size-slider" min="20" max="40" value="26" step="2" data-panel="${panelType}">
         <span id="${panelType}-size-value" class="slider-value">26</span>
       </label>`
    : '';
  
  return `
    <div class="panel-header panel-toolbar-simple" data-panel-type="${panelType}">
      <div class="panel-header-left">${sizeControl}</div>
      <div class="panel-header-spacer"></div>
      <div class="panel-header-actions">
        ${variableToggle}
        <div class="panel-header-menu">
          <button class="panel-menu-btn" title="メニュー">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
          <div class="panel-dropdown hidden">
            <div class="panel-menu-item" data-action="import">📂 読込 (JSON)</div>
            <div class="panel-menu-item" data-action="export">💾 保存 (JSON)</div>
            ${panelType === 'snippet' ? '<div class="panel-menu-item" data-action="reset-snippets">🔄 スニペットを初期に戻す</div>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ヘッダーバーにイベントリスナーを追加（メニューのみ）
function setupPanelHeader(element, panelType, glContainer) {
  const menuBtn = element.querySelector('.panel-menu-btn');
  const dropdown = element.querySelector('.panel-dropdown');
  
  if (menuBtn && dropdown) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.panel-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
      });
      dropdown.classList.toggle('hidden');
    });
    
    dropdown.querySelectorAll('.panel-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        dropdown.classList.add('hidden');
        document.dispatchEvent(new CustomEvent('panel-menu-action', {
          detail: { panelType, action }
        }));
      });
    });
  }
  
  document.addEventListener('click', (e) => {
    if (dropdown && !dropdown.contains(e.target) && e.target !== menuBtn) {
      dropdown.classList.add('hidden');
    }
  });
}

export async function initDocking(onLayoutReady) {
  const container = document.getElementById('docking-container');
  if (!container) return null;

  // 1ファイルにバンドルした golden-layout をローカルから読み込む（CDN・node_modules は file:// で失敗するため）
  try {
    const mod = await import('../golden-layout-bundle.js');
    const GoldenLayout = mod?.GoldenLayout;
    const LayoutConfig = mod?.LayoutConfig;
    if (!GoldenLayout) throw new Error('GoldenLayout の import に失敗しました。（ESMエクスポートが見つかりません）');

    layoutInstance = new GoldenLayout(container);

    // 1) スニペット
    layoutInstance.registerComponentFactoryFunction('snippet-panel', (glContainer) => {
      glContainer.element.style.overflow = 'hidden';
      glContainer.element.innerHTML = `
        <div class="docking-panel snippet-panel-content" style="height:100%; display:flex; flex-direction:column;">
          ${createPanelHeader('スニペット', 'snippet', true)}
          <div id="snippet-list" class="snippet-list" style="flex:1; overflow-y:auto;"></div>
          <div class="snippet-add-area"><button id="open-add-snippet-btn" class="action-btn">＋ 追加</button></div>
        </div>
      `;
      setupPanelHeader(glContainer.element, 'snippet', glContainer);
    });

    // 2) 変数
    layoutInstance.registerComponentFactoryFunction('variable-panel', (glContainer) => {
      glContainer.element.style.overflow = 'hidden';
      glContainer.element.innerHTML = `
        <div class="docking-panel variable-panel-content" style="height:100%; display:flex; flex-direction:column;">
          ${createPanelHeader('変数', 'variable', true)}
          <div id="variable-list" class="snippet-list" style="flex:1; overflow-y:auto;"></div>
          <div class="snippet-add-area">
            <button id="open-add-variable-btn" class="action-btn" style="flex:1;">＋ 追加</button>
          </div>
        </div>
      `;
      setupPanelHeader(glContainer.element, 'variable', glContainer);
    });

    // 3) エディタ
    layoutInstance.registerComponentFactoryFunction('editor-panel', (glContainer) => {
      glContainer.element.style.overflow = 'hidden';
      glContainer.element.innerHTML = `
        <div class="docking-panel editor-panel-content" style="height:100%; width:100%; display:flex; flex-direction:column;">
          <div class="tab-bar">
            <div id="tabs-container" class="tabs-container"></div>
            <button id="new-tab-btn" class="icon-btn" title="新しいタブ">＋</button>
          </div>
          <div class="toolbar">
            <div class="toolbar-groups">
              <div class="toolbar-group"><label>ラベル:</label><input type="text" id="default-label" placeholder="タブ名" class="input-text" style="width: 80px;"></div>
              <div class="toolbar-group"><label>名前:</label><input type="text" id="default-name" placeholder="キャラ名" class="input-text" style="width: 80px;"></div>
              <div class="toolbar-group">
                <label>文字色:</label>
                <div class="color-picker-wrapper">
                  <input type="color" id="default-color-picker" value="#ffffff">
                  <input type="text" id="default-color-code" value="#FFFFFF" class="input-text input-code">
                  <button id="palette-btn" title="Tekeyカラーパレット">🎨</button>
                  <div id="color-palette-popup" class="palette-popup hidden"></div>
                </div>
              </div>
            </div>
            <button type="button" id="editor-options-toggle" class="icon-btn editor-options-toggle" title="エディタオプション">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </div>
          <div id="editor-options-bar" class="editor-options-bar hidden">
            <button type="button" id="editor-opt-all-line-space" class="editor-opt-btn" title="すべての行の先頭に全角スペースを挿入">全行先頭に全角スペース</button>
            <button type="button" id="editor-opt-selection-line-space" class="editor-opt-btn" title="選択範囲の行の先頭に全角スペースを挿入">選択行の先頭に全角スペース</button>
            <button type="button" id="editor-opt-highlight-full-space" class="editor-opt-btn" title="全角スペースをハイライト">全角スペースをハイライト</button>
            <button type="button" id="editor-opt-highlight-half-space" class="editor-opt-btn" title="半角スペースをハイライト">半角スペースをハイライト</button>
            <button type="button" id="editor-opt-show-newline" class="editor-opt-btn" title="改行を表示（↵マーク）">改行を表示</button>
          </div>
          <div id="search-panel" class="search-panel hidden">
            <div class="search-panel-header">
              <span class="search-panel-title">検索</span>
              <button type="button" id="close-search-btn" class="search-panel-close" title="閉じる">×</button>
            </div>
            <div class="search-row">
              <input type="text" id="search-input" placeholder="検索..." class="input-text search-box">
              <label class="search-opt"><input type="checkbox" id="search-regex">正規表現</label>
              <label class="search-opt"><input type="checkbox" id="search-case">大/小</label>
              <button id="find-prev-btn" title="前へ">↑</button>
              <button id="find-next-btn" title="次へ">↓</button>
              <button id="toggle-replace-btn" title="置換">置換</button>
            </div>
            <div class="search-row hidden" id="replace-row">
              <input type="text" id="replace-input" placeholder="置換後..." class="input-text search-box">
              <button id="replace-btn">置換</button>
              <button id="replace-all-btn" title="全置換（選択時は選択範囲内のみ）">全置換</button>
            </div>
          </div>
          <div id="editor-wrapper" style="flex:1; position:relative; overflow:hidden; width:100%;">
            <textarea id="editor" placeholder="ここにシナリオを入力..." style="width:100%; height:100%;"></textarea>
          </div>
          <div class="status-bar"><span id="cursor-pos-label">行: 1, 列: 1</span><span id="char-count-label">0 文字</span></div>
        </div>
      `;
    });

    // 4) プレビュー（ツールバーにフォントサイズ・行間・背景切替）
    layoutInstance.registerComponentFactoryFunction('preview-panel', (glContainer) => {
      glContainer.element.style.overflow = 'hidden';
      glContainer.element.innerHTML = `
        <div class="docking-panel preview-panel-content" style="height:100%; display:flex; flex-direction:column;">
          <div class="panel-toolbar preview-toolbar">
            <label class="toolbar-slider" title="フォントサイズ">
              <span style="font-size:10px">A</span>
              <input type="range" id="font-size-slider" min="10" max="20" value="12" step="1">
              <span id="font-size-value" class="slider-value">12px</span>
            </label>
            <label class="toolbar-slider" title="行間">
              <span style="font-size:10px">↕</span>
              <input type="range" id="line-height-slider" min="1.0" max="2.0" value="1.5" step="0.1">
              <span id="line-height-value" class="slider-value">1.5</span>
            </label>
            <div id="bg-toggle-group" class="bg-toggle-group">
              <button class="bg-mode-btn active" data-mode="dark">暗</button>
              <button class="bg-mode-btn" data-mode="light">明</button>
              <button class="bg-mode-btn" data-mode="transparent">透</button>
            </div>
            <label class="toggle-switch-wrapper" title="演出表記（@の後のコマンド）を表示">
              <input type="checkbox" id="effect-notation-toggle">
              <span class="toggle-switch"></span>
              <span class="toggle-label">演出表記</span>
            </label>
          </div>
          <div id="preview-search-panel" class="preview-search-panel hidden">
            <div class="search-panel-header">
              <span class="search-panel-title">検索</span>
              <button type="button" id="preview-close-search-btn" class="search-panel-close" title="閉じる">×</button>
            </div>
            <div class="search-row">
              <input type="text" id="preview-search-input" placeholder="検索..." class="input-text search-box">
              <button type="button" id="preview-search-prev" class="small-btn" title="前へ">↑</button>
              <button type="button" id="preview-search-next" class="small-btn" title="次へ">↓</button>
            </div>
          </div>
          <div id="preview-content" tabindex="-1" style="flex:1; overflow-y:auto; padding:15px;"></div>
        </div>
      `;
    });

    // 5) プルダウン目次（### / #### の一覧、クリックでエディタの該当行へ）。タブ見出しのみでパネル内見出しは出さない
    layoutInstance.registerComponentFactoryFunction('dropdown-toc-panel', (glContainer) => {
      glContainer.element.style.overflow = 'hidden';
      glContainer.element.innerHTML = `
        <div class="docking-panel dropdown-toc-content" style="height:100%; display:flex; flex-direction:column;">
          <div id="dropdown-toc-list" class="dropdown-toc-list" style="flex:1; overflow-y:auto; padding:8px; font-size:12px;"></div>
        </div>
      `;
    });

    // レイアウト読み込み（main のファイル、なければ localStorage を使う）
    let config = await loadLayoutConfigFromMain();
    if (!config) {
      config = loadLayoutConfigFromLocalStorage();
    }
    // saveLayout() の結果（resolved: true）を読み込む場合は変換する
    if (config && config.resolved === true && LayoutConfig?.fromResolved) {
      config = LayoutConfig.fromResolved(config);
    }
    // 初期化されていない場合は明示的に init
    if (layoutInstance && layoutInstance.isInitialised === false && typeof layoutInstance.init === 'function') {
      layoutInstance.init();
    }
    try {
      Object.keys(hiddenPanels).forEach(k => delete hiddenPanels[k]);
      if (config) {
        layoutInstance.loadLayout(config);
      } else {
        layoutInstance.loadLayout(getDefaultLayoutConfig());
      }
    } catch (layoutError) {
      console.warn('保存されたレイアウトが壊れています。デフォルトで起動します:', layoutError);
      clearLayoutConfigInMain();
      layoutInstance.loadLayout(getDefaultLayoutConfig());
    }

    // 初期化完了通知
    setTimeout(() => {
      if (onLayoutReady) onLayoutReady(layoutInstance);
    }, 0);

    layoutInstance.on('stateChanged', () => {
      saveLayoutConfig();
      scheduleLayoutCacheToMain();
    });

    // ウィンドウ閉鎖時にも必ず保存（stateChanged がスロットルされていても確実に記憶）
    window.addEventListener('beforeunload', () => saveLayoutConfig());
  } catch (error) {
    console.error('Golden Layout initialization failed:', error);
    container.innerHTML = `<div style="color:red; padding:20px;">初期化エラー: ${error.message}</div>`;
  }

  return layoutInstance;
}

function getDefaultLayoutConfig() {
  return {
    root: {
      type: 'row',
      content: [
        {
          type: 'column',
          width: 22,
          content: [
            { type: 'component', componentType: 'dropdown-toc-panel', title: 'プルダウン目次' },
            { type: 'component', componentType: 'snippet-panel', title: 'スニペット' },
            { type: 'component', componentType: 'variable-panel', title: '変数' }
          ]
        },
        { type: 'component', componentType: 'editor-panel', title: 'エディタ', width: 48 },
        { type: 'component', componentType: 'preview-panel', title: 'プレビュー', width: 30 }
      ]
    }
  };
}

function saveLayoutConfig() {
  if (!layoutInstance) return;
  try {
    const config = layoutInstance.saveLayout();
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('レイアウト保存エラー:', e);
  }
}

function scheduleLayoutCacheToMain() {
  if (isResettingLayout) return;
  if (typeof window === 'undefined' || !window.myApi?.saveLayoutCache) return;
  if (layoutCacheTimer) clearTimeout(layoutCacheTimer);
  layoutCacheTimer = setTimeout(() => {
    layoutCacheTimer = null;
    if (!layoutInstance) return;
    try {
      const json = JSON.stringify(layoutInstance.saveLayout());
      window.myApi.saveLayoutCache(json);
    } catch (e) {
      console.error('レイアウトキャッシュ保存エラー:', e);
    }
  }, 500);
}


/** 起動時に main プロセスからレイアウト設定を取得 */
async function loadLayoutConfigFromMain() {
  if (typeof window === 'undefined' || !window.myApi?.getLayoutConfig) return null;
  try {
    const raw = await window.myApi.getLayoutConfig();
    if (!raw || typeof raw !== 'string') return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** フォールバック用: localStorage からレイアウト設定を取得 */
function loadLayoutConfigFromLocalStorage() {
  try {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    return null;
  }
}

/** 壊れたレイアウトをクリアするとき main 側のファイルも削除 */
function clearLayoutConfigInMain() {
  if (typeof window !== 'undefined' && window.myApi?.clearLayoutConfig) {
    window.myApi.clearLayoutConfig();
  }
  localStorage.removeItem(LAYOUT_STORAGE_KEY);
}

export function resetLayout() {
  isResettingLayout = true;
  Object.keys(hiddenPanels).forEach(k => delete hiddenPanels[k]);
  clearLayoutConfigInMain();
  localStorage.removeItem(LAYOUT_STORAGE_KEY);
  localStorage.removeItem('keypale_docking_layout');
  localStorage.removeItem('keypale_docking_v2_esm');

  const defaultConfig = getDefaultLayoutConfig();
  if (layoutInstance) {
    try {
      layoutInstance.loadLayout(defaultConfig);
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined' && window.myApi?.saveLayoutCache) {
    try {
      window.myApi.saveLayoutCache(JSON.stringify(defaultConfig));
    } catch {
      // ignore
    }
  }
  setTimeout(() => location.reload(), 50);
}

export function getLayoutInstance() {
  return layoutInstance;
}

/** レイアウト内で componentType に一致するコンポーネントを1つ返す。無ければ null */
export function findComponentByType(layout, componentType) {
  if (!layout?.root) return null;
  function walk(item) {
    if (item.isComponent && item.componentType === componentType) return item;
    if (item.contentItems && item.contentItems.length) {
      for (const child of item.contentItems) {
        const found = walk(child);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(layout.root);
}

/** 指定 componentType のパネルが表示中か（非表示リストにあれば false） */
export function isPanelVisible(layout, componentType) {
  if (hiddenPanels[componentType]) return false;
  return findComponentByType(layout, componentType) != null;
}

/** 非表示時もスプリッターが効くよう、size は 0 にせず最小値 HIDDEN_PANEL_MIN_SIZE にする */
const HIDDEN_PANEL_MIN_SIZE = 1;

/** パネルを非表示にする。DOM からは外さず表示だけ隠す（display:none + size を最小に）でレイアウト崩れを防ぐ */
export function closePanel(layout, componentType) {
  const item = findComponentByType(layout, componentType);
  if (!item) return false;
  const stack = item.parent;
  if (!stack || !stack.parent) return false;
  const parent = stack.parent;
  try {
    const savedSize = typeof stack.size === 'number' ? stack.size : 0;
    stack.size = HIDDEN_PANEL_MIN_SIZE;
    if (stack.element) stack.element.style.display = 'none';
    if (typeof parent.updateSize === 'function') parent.updateSize(false);
    hiddenPanels[componentType] = { stack, parent, savedSize };
    return true;
  } catch (e) {
    console.warn('closePanel (hide) failed', e);
    return false;
  }
}

/** パネルを表示。非表示にしていた場合は表示を戻す（size 復元）、なければ新規追加 */
export function addPanel(layout, componentType, title) {
  if (!layout) return false;
  const saved = hiddenPanels[componentType];
  if (saved?.stack) {
    try {
      saved.stack.size = saved.savedSize;
      if (saved.stack.element) saved.stack.element.style.display = '';
      if (saved.parent && typeof saved.parent.updateSize === 'function') saved.parent.updateSize(false);
      delete hiddenPanels[componentType];
      return true;
    } catch (e) {
      delete hiddenPanels[componentType];
    }
  }
  try {
    layout.newComponent(componentType, undefined, title || componentType);
    return true;
  } catch (e) {
    console.warn('addPanel failed', e);
    return false;
  }
}

/** ウィンドウ閉鎖時に main から呼ばれる用。現在のレイアウトの JSON 文字列を返す（main が layout-state.json に保存） */
export function saveLayoutNow() {
  saveLayoutConfig(); // localStorage にもバックアップ
  if (!layoutInstance) return null;
  try {
    return JSON.stringify(layoutInstance.saveLayout());
  } catch (e) {
    return null;
  }
}

