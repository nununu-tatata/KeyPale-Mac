// js/ui.js
// UIのイベントハンドリング (ウィンドウ操作、パネル開閉、リサイズ、テーマ設定)

import { els } from './dom.js';

export function initUI(onUpdatePreview) {
  
  // --- ウィンドウ操作 ---
  if(els.minBtn) els.minBtn.addEventListener('click', () => window.myApi && window.myApi.minimizeWindow());
  if(els.maxBtn) els.maxBtn.addEventListener('click', () => window.myApi && window.myApi.maximizeWindow());
  if(els.closeBtn) els.closeBtn.addEventListener('click', () => window.myApi && window.myApi.closeWindow());

  // --- メニュー・パネル開閉 ---
  if (els.settingsBtn) {
    els.settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); els.settingsPanel.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
      if (els.settingsPanel && !els.settingsPanel.classList.contains('hidden') && !els.settingsPanel.contains(e.target) && e.target !== els.settingsBtn) els.settingsPanel.classList.add('hidden');
    });
  }

  if (els.appMenuBtn) {
    els.appMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); els.appMenuDropdown.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
      if (els.appMenuDropdown && !els.appMenuDropdown.classList.contains('hidden') && !els.appMenuDropdown.contains(e.target) && e.target !== els.appMenuBtn) els.appMenuDropdown.classList.add('hidden');
    });
  }

  if (els.menuOptions) els.menuOptions.addEventListener('click', () => { els.appMenuDropdown.classList.add('hidden'); els.optionModal.classList.remove('hidden'); });
  // ▼▼▼ 修正箇所: 余分なセミコロンを削除しました ▼▼▼
  if (els.optionClose) els.optionClose.addEventListener('click', () => els.optionModal.classList.add('hidden'));

  const togglePane = (pane) => { if(pane) pane.classList.toggle('collapsed'); els.appMenuDropdown.classList.add('hidden'); };
  if(els.menuToggleSnippet) els.menuToggleSnippet.addEventListener('click', () => togglePane(els.snippetPane));
  if(els.menuToggleVariable) els.menuToggleVariable.addEventListener('click', () => togglePane(els.variablePane));
  if(els.menuTogglePreview) els.menuTogglePreview.addEventListener('click', () => togglePane(els.previewPane));

  if(els.snippetToggle) els.snippetToggle.addEventListener('click', () => els.snippetPane.classList.toggle('collapsed'));
  if(els.variableToggle) els.variableToggle.addEventListener('click', () => els.variablePane.classList.toggle('collapsed'));
  if(els.previewToggle) els.previewToggle.addEventListener('click', () => els.previewPane.classList.toggle('collapsed'));

  // --- リサイズ機能 & 状態復元 ---
  initResizers();
  restoreLayout(); 

  // --- プレビュー設定 (動的に要素を取得) ---
  const fontSizeSlider = document.getElementById('font-size-slider');
  const fontSizeValue = document.getElementById('font-size-value');
  const lineHeightSlider = document.getElementById('line-height-slider');
  const lineHeightValue = document.getElementById('line-height-value');
  const bgToggleBtn = document.getElementById('bg-toggle-btn');
  const previewContent = document.getElementById('preview-content');
  
  if(fontSizeSlider) {
    fontSizeSlider.addEventListener('input', (e) => {
      const size = e.target.value;
      if(fontSizeValue) fontSizeValue.textContent = `${size}px`;
      document.documentElement.style.setProperty('--preview-font-size', `${size}px`);
      if(previewContent) previewContent.style.fontSize = `${size}px`;
    });
  }
  if(lineHeightSlider) {
    lineHeightSlider.addEventListener('input', (e) => {
      const lh = e.target.value;
      const actualLh = (parseFloat(lh) * 0.8).toFixed(2); // 表記 * 0.8 = 実際の行間
      if(lineHeightValue) lineHeightValue.textContent = lh;
      document.documentElement.style.setProperty('--preview-line-height', actualLh);
      if(previewContent) previewContent.style.lineHeight = actualLh;
    });
  }
  if(bgToggleBtn && previewContent) {
    bgToggleBtn.addEventListener('click', () => {
      // bg-dark -> bg-light -> bg-transparent -> bg-dark
      if (previewContent.classList.contains('bg-dark')) {
        previewContent.classList.remove('bg-dark');
        previewContent.classList.add('bg-light');
        bgToggleBtn.textContent = "背景: Light";
      } else if (previewContent.classList.contains('bg-light')) {
        previewContent.classList.remove('bg-light');
        previewContent.classList.add('bg-transparent');
        bgToggleBtn.textContent = "背景: None";
      } else {
        previewContent.classList.remove('bg-transparent');
        previewContent.classList.add('bg-dark');
        bgToggleBtn.textContent = "背景: Dark";
      }
    });
    // 初期状態
    previewContent.classList.add('bg-dark');
  }

  // --- テーマ・アクセントカラー ---
  if(els.themeBtns) {
    els.themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        document.body.className = `theme-${theme}`;
        localStorage.setItem('appTheme', theme);
      });
    });
  }
  const savedTheme = localStorage.getItem('appTheme') || 'dark';
  document.body.className = `theme-${savedTheme}`;

  if(els.accentColorPicker) {
    els.accentColorPicker.addEventListener('input', (e) => {
      const color = e.target.value;
      if(els.accentColorValue) els.accentColorValue.textContent = color.toUpperCase();
      document.documentElement.style.setProperty('--accent-color', color);
      localStorage.setItem('accentColor', color);
    });
  }
  const savedAccent = localStorage.getItem('accentColor');
  if (savedAccent) {
    document.documentElement.style.setProperty('--accent-color', savedAccent);
    if(els.accentColorPicker) els.accentColorPicker.value = savedAccent;
    if(els.accentColorValue) els.accentColorValue.textContent = savedAccent.toUpperCase();
  }

  // --- カラーパレット ---
  initPalette(onUpdatePreview);
}

function initPalette(onUpdatePreview) {
  const tekeyColors = [
    "#4D4D4D", "#999999", "#FFFFFF", "#F44E3B", "#FE9200", "#FCDC00", 
    "#DBDF00", "#A4DD00", "#68CCCA", "#73D8FF", "#AEA1FF", "#FDA1FF",
    "#333333", "#808080", "#CCCCCC", "#D33115", "#E27300", "#FCC400", 
    "#B0BC00", "#68BC00", "#16A5A5", "#009CE0", "#7B64FF", "#FA28FF",
    "#000000", "#666666", "#B3B3B3", "#9F0500", "#C45100", "#FB9E00", 
    "#808900", "#194D33", "#0C797D", "#0062B1", "#653294", "#AB149E"
  ];
  
  // 動的に要素を取得
  const palettePopup = document.getElementById('color-palette-popup');
  const paletteBtn = document.getElementById('palette-btn');
  const colorPicker = document.getElementById('default-color-picker');
  const colorCode = document.getElementById('default-color-code');
  
  if(palettePopup && palettePopup.children.length === 0) {
    // パレットがまだ初期化されていない場合のみ
    tekeyColors.forEach(c => {
      const d = document.createElement('div');
      d.className = 'color-swatch';
      d.style.backgroundColor = c;
      d.title = c;
      d.addEventListener('click', () => {
        if(colorPicker) colorPicker.value = c;
        if(colorCode) colorCode.value = c.toUpperCase();
        palettePopup.classList.add('hidden');
        // カラーピッカーの input イベントを発火（tabManager更新とプレビュー更新をトリガー）
        if(colorPicker) colorPicker.dispatchEvent(new Event('input'));
      });
      palettePopup.appendChild(d);
    });
  }
  
  if(paletteBtn && palettePopup && !paletteBtn.hasAttribute('data-initialized')) {
    paletteBtn.setAttribute('data-initialized', 'true');
    paletteBtn.addEventListener('click', (e) => { e.stopPropagation(); palettePopup.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => { 
      if(palettePopup && !palettePopup.contains(e.target) && e.target !== paletteBtn) palettePopup.classList.add('hidden'); 
    });
  }
}

// --- リサイズ機能 & 状態保存 ---
function initResizers() {
  const setupResizer = (resizer, leftPane, storageKey) => {
    if (!resizer || !leftPane) return;
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.body.style.cursor = 'col-resize';
      const startX = e.clientX;
      const startWidth = leftPane.getBoundingClientRect().width;
      
      const onMouseMove = (moveEvent) => {
        const newWidth = startWidth + (moveEvent.clientX - startX);
        if (newWidth > 50) { 
           leftPane.style.flex = `0 0 ${newWidth}px`;
           leftPane.style.maxWidth = 'none';
        }
      };
      const onMouseUp = () => {
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (window.cmInstance) window.cmInstance.refresh();
        localStorage.setItem(storageKey, leftPane.style.flex);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  };

  setupResizer(els.snippetResizer, els.snippetPane, 'layout_snippet_width');
  setupResizer(els.variableResizer, els.variablePane, 'layout_variable_width');
  setupResizer(els.previewResizer, els.editorPane, 'layout_editor_width'); 
}

function restoreLayout() {
  const applyWidth = (pane, key) => {
    const saved = localStorage.getItem(key);
    if (saved && pane) {
      pane.style.flex = saved;
      pane.style.maxWidth = 'none';
    }
  };

  // デフォルト幅設定 (スニペットと変数は初期値180px)
  if(els.snippetPane && !localStorage.getItem('layout_snippet_width')) {
    els.snippetPane.style.flex = '0 0 180px';
  }
  if(els.variablePane && !localStorage.getItem('layout_variable_width')) {
    els.variablePane.style.flex = '0 0 180px';
  }

  applyWidth(els.snippetPane, 'layout_snippet_width');
  applyWidth(els.variablePane, 'layout_variable_width');
  applyWidth(els.editorPane, 'layout_editor_width');
}