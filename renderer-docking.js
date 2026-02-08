// renderer-docking.js
// ドッキングシステム対応版レンダラー

import { parseTekeySyntax } from './js/parser.js';
import { initUI } from './js/ui.js';
import { initLists, userVariables, renderVariables, getSnippetShortcuts, getVariableShortcuts } from './js/lists.js';
import { tabManager } from './js/tabs.js';
import { initHighlight, applySyntaxColors } from './js/highlight.js';
import { initDocking, resetLayout, getLayoutInstance, saveLayoutNow, isPanelVisible, closePanel, addPanel } from './js/docking.js';

let cm = null;
let fullSpaceOverlay = null;
let halfSpaceOverlay = null;
let highlightFullSpace = false;
let highlightHalfSpace = false;
let showNewline = false;

const SHORTCUT_STORAGE_KEY = 'keypale_shortcuts';
const shortcutDefaults = {
  newTab: 'Ctrl+N',
  openTxt: 'Ctrl+O',
  openJson: 'Ctrl+Shift+O',
  save: 'Ctrl+S',
  saveAs: 'Ctrl+Shift+S',
  saveTekeyTab: 'Ctrl+Alt+S',
  saveTekeyAll: 'Ctrl+Alt+Shift+S',
  zoomIn: 'Ctrl++',
  zoomOut: 'Ctrl+-',
  zoomReset: 'Ctrl+0',
  options: 'Ctrl+,',
  resetLayout: 'Ctrl+Alt+R',
  openHelp: '',
  about: 'F1',
  indentAllFull: 'Ctrl+Alt+I',
  indentSelectionFull: 'Ctrl+Alt+Shift+I'
};

function getShortcutConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(SHORTCUT_STORAGE_KEY) || '{}');
    return Object.assign({}, shortcutDefaults, saved);
  } catch {
    return Object.assign({}, shortcutDefaults);
  }
}

function saveShortcutConfig(cfg) {
  localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(cfg));
}

function applyShortcutLabels() {
  const cfg = getShortcutConfig();
  document.querySelectorAll('[data-shortcut-id]').forEach((el) => {
    const id = el.dataset.shortcutId;
    el.textContent = cfg[id] || '';
  });
}

function showFatalOverlay(title, detail) {
  const host = document.getElementById('docking-container') || document.body;
  const msg = `${title}\n\n${detail || ''}`.trim();
  const pre = document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.padding = '16px';
  pre.style.margin = '12px';
  pre.style.border = '1px solid #aa3333';
  pre.style.background = '#2a0f0f';
  pre.style.color = '#ffb3b3';
  pre.style.borderRadius = '8px';
  pre.textContent = msg;
  host.appendChild(pre);
}

window.addEventListener('error', (e) => {
  showFatalOverlay('初期化中にエラーが発生しました', String(e?.error?.stack || e?.message || e));
});
window.addEventListener('unhandledrejection', (e) => {
  showFatalOverlay('Promiseのエラーが発生しました', String(e?.reason?.stack || e?.reason || e));
});

function updateStatusBar() {
  if (!cm) return;
  const cursor = cm.getCursor();
  const content = cm.getValue();
  const posLabel = document.getElementById('cursor-pos-label');
  const charLabel = document.getElementById('char-count-label');
  if (posLabel) posLabel.textContent = `行: ${cursor.line + 1}, 列: ${cursor.ch + 1}`;
  if (charLabel) charLabel.textContent = `${content.length} 文字`;
}

const TOOL_NO_PREVIEW_DROPDOWN_KEY = 'keypale_tool_no_preview_dropdown_toggle';
const TOOL_SYNC_EDITOR_PREVIEW_KEY = 'keypale_tool_sync_editor_preview_line';

function updatePreview() {
  if (!cm) return;
  const el = document.getElementById('preview-content');
  if (!el) return;
  const effectToggle = document.getElementById('effect-notation-toggle');
  const showEffectNotation = effectToggle ? effectToggle.checked : false;
  const noDropdownToggle = localStorage.getItem(TOOL_NO_PREVIEW_DROPDOWN_KEY) === 'true';

  let openStates = [];
  if (noDropdownToggle) {
    el.querySelectorAll('details').forEach((d) => openStates.push(d.open));
  }

  el.innerHTML = parseTekeySyntax(cm.getValue(), userVariables, { showEffectNotation });

  if (noDropdownToggle && openStates.length > 0) {
    const detailsList = el.querySelectorAll('details');
    detailsList.forEach((d, i) => {
      if (i < openStates.length) d.open = openStates[i];
    });
  }
  document.dispatchEvent(new CustomEvent('preview-updated'));
}

function refreshAll() {
  if (!cm) return;
  const switchEl = document.getElementById('variable-global-switch');
  const isGlobal = switchEl ? switchEl.checked : false;
  const sourceText = isGlobal ? tabManager.getAllContent() : cm.getValue();
  renderVariables(sourceText);
  updatePreview();
  updateDropdownToc();
  updateStatusBar();
}

function updateDropdownToc() {
  const listEl = document.getElementById('dropdown-toc-list');
  if (!listEl || !cm) return;
  const text = cm.getValue();
  const lines = text.split(/\r?\n/);
  const items = [];
  lines.forEach((line, i) => {
    const t = line.trim();
    const parentMatch = t.match(/^###(?!#)\s*(.+)/);
    const childMatch = t.match(/^####(?!#)\s*(.+)/);
    if (parentMatch) items.push({ line: i, title: parentMatch[1], type: 'parent' });
    else if (childMatch) items.push({ line: i, title: childMatch[1], type: 'child' });
  });
  const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  listEl.innerHTML = items.length === 0
    ? '<p class="dropdown-toc-empty">プルダウン（### / ####）がありません</p>'
    : items.map((it) => {
        const cls = it.type === 'parent' ? 'dropdown-toc-item toc-parent' : 'dropdown-toc-item toc-child';
        return `<div class="${cls}" data-line="${it.line}" role="button" tabindex="0">${escape(it.title)}</div>`;
      }).join('');
  listEl.querySelectorAll('.dropdown-toc-item').forEach((el) => {
    el.addEventListener('click', () => {
      const line = parseInt(el.getAttribute('data-line'), 10);
      if (!isNaN(line)) {
        cm.setCursor(line, 0);
        cm.focus();
        cm.getWrapperElement().scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  });
}

function insertTextAtCursor(text) {
  if (!cm) return;
  cm.focus();
  cm.replaceSelection(text);
  updatePreview();
}

let lastAppliedThemeColors = { parent: '', child: '' };

function getCurrentThemeName() {
  const m = (document.body.className || '').match(/\btheme-(\w+)/);
  return m ? m[1] : 'dark';
}

function hexToRgba(hex, alpha) {
  const v = (hex || '').replace('#', '');
  if (v.length !== 6) return `rgba(255, 255, 255, ${alpha})`;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseShortcut(text) {
  if (!text) return null;
  const raw = text.trim();
  if (!raw) return null;
  let parts = raw.split('+');
  let key = '';
  if (raw.includes('++') && parts[parts.length - 1] === '') {
    key = '+';
    parts = parts.slice(0, -1);
  } else {
    key = parts.pop() || '';
  }
  const mods = parts.map(p => p.trim().toLowerCase()).filter(Boolean);
  return {
    ctrl: mods.includes('ctrl') || mods.includes('control'),
    shift: mods.includes('shift'),
    alt: mods.includes('alt') || mods.includes('option'),
    cmd: mods.includes('cmd') || mods.includes('command') || mods.includes('meta'),
    key: key.trim().toLowerCase()
  };
}

function shortcutMatchesEvent(shortcutText, e) {
  const def = parseShortcut(shortcutText);
  if (!def || !def.key) return false;
  const isMac = navigator.platform.toLowerCase().includes('mac');
  if (def.ctrl && !(isMac ? e.metaKey : e.ctrlKey)) return false;
  if (def.cmd && !e.metaKey) return false;
  if (def.shift !== !!e.shiftKey) return false;
  if (def.alt !== !!e.altKey) return false;

  const key = def.key;
  const ek = (e.key || '').toLowerCase();
  if (key === '+') return ek === '+' || ek === '=';
  return ek === key;
}

function formatShortcutFromEvent(e) {
  e.preventDefault();
  e.stopPropagation();
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const parts = [];
  if (e.ctrlKey && !isMac) parts.push('Ctrl');
  if (e.metaKey || (e.ctrlKey && isMac)) parts.push('Cmd');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  let key = (e.key || '').toUpperCase();
  if (key === '+') key = 'Plus';
  if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join('+');
}

function normalizeShortcut(text) {
  const def = parseShortcut(text);
  if (!def || !def.key) return null;
  const parts = [];
  if (def.ctrl) parts.push('CTRL');
  if (def.alt) parts.push('ALT');
  if (def.shift) parts.push('SHIFT');
  if (def.cmd) parts.push('CMD');
  let key = def.key;
  if (key === '+') key = 'PLUS';
  key = key.toUpperCase();
  return parts.concat(key).join('+');
}

function applyThemeColors() {
  const currentTheme = getCurrentThemeName();
  const key = `colors_${currentTheme}`;
  const saved = JSON.parse(localStorage.getItem(key)) || themeDefaultColors[currentTheme] || themeDefaultColors.dark;

  lastAppliedThemeColors.parent = saved.parent;
  lastAppliedThemeColors.child = saved.child;
  document.documentElement.style.setProperty('--tekey-parent-color', saved.parent);
  document.documentElement.style.setProperty('--tekey-child-color', saved.child);

  const lineColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#007acc';
  document.documentElement.style.setProperty('--tekey-line-color', lineColor);

  const effectColor = localStorage.getItem('keypale_tekey_effect_notation_color') || '#888888';
  document.documentElement.style.setProperty('--tekey-effect-notation-color', effectColor);

  const editorLinkColor = localStorage.getItem('keypale_editor_link_color') || '#569cd6';
  document.documentElement.style.setProperty('--editor-link-color', editorLinkColor);

  const fullSpaceColor = localStorage.getItem('keypale_space_full_color') || '#ffb400';
  const halfSpaceColor = localStorage.getItem('keypale_space_half_color') || '#00b4ff';
  const newlineMarkColor = localStorage.getItem('keypale_newline_mark_color') || '#6a6a6a';
  document.documentElement.style.setProperty('--space-fullwidth-bg', hexToRgba(fullSpaceColor, 0.35));
  document.documentElement.style.setProperty('--space-halfwidth-bg', hexToRgba(halfSpaceColor, 0.28));
  document.documentElement.style.setProperty('--newline-mark-color', newlineMarkColor);

  const themeName = document.getElementById('current-theme-name');
  if (themeName) themeName.textContent = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);
  const parentPicker = document.getElementById('pd-parent-color-picker');
  const childPicker = document.getElementById('pd-child-color-picker');
  const effectPicker = document.getElementById('tekey-effect-notation-color-picker');
  const editorLinkPicker = document.getElementById('editor-link-color-picker');
  const fullSpacePicker = document.getElementById('editor-full-space-color-picker');
  const halfSpacePicker = document.getElementById('editor-half-space-color-picker');
  const newlineMarkPicker = document.getElementById('editor-newline-mark-color-picker');
  if (parentPicker) parentPicker.value = saved.parent;
  if (childPicker) childPicker.value = saved.child;
  if (effectPicker) effectPicker.value = effectColor;
  if (editorLinkPicker) editorLinkPicker.value = editorLinkColor;
  if (fullSpacePicker) fullSpacePicker.value = fullSpaceColor;
  if (halfSpacePicker) halfSpacePicker.value = halfSpaceColor;
  if (newlineMarkPicker) newlineMarkPicker.value = newlineMarkColor;

  applySyntaxColors();
}

function setupMenuHandlers() {
  const dropdown = document.getElementById('app-menu-dropdown');
  const hideMenu = () => {
    if (dropdown) {
      dropdown.classList.add('hidden');
      dropdown.querySelectorAll('.menu-category.is-open').forEach(c => c.classList.remove('is-open'));
    }
  };
  function updateWindowPanelChecks() {
    const layout = getLayoutInstance();
    if (!layout) return;
    dropdown?.querySelectorAll('.menu-item-checkable[data-panel]').forEach((el) => {
      const type = el.dataset.panel;
      const visible = isPanelVisible(layout, type);
      el.classList.toggle('checked', visible);
    });
  }

  dropdown?.querySelectorAll('.menu-category').forEach(cat => {
    cat.addEventListener('click', (e) => {
      if (e.target.closest('.menu-item')) return;
      e.stopPropagation();
      const isOpen = cat.classList.toggle('is-open');
      dropdown.querySelectorAll('.menu-category').forEach(other => {
        if (other !== cat) other.classList.remove('is-open');
      });
      if (!isOpen) cat.classList.remove('is-open');
      if (cat.dataset.category === 'window' && isOpen) updateWindowPanelChecks();
    });
  });

  dropdown?.querySelectorAll('.menu-item-checkable[data-panel]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const layout = getLayoutInstance();
      const type = el.dataset.panel;
      const title = el.dataset.panelTitle || type;
      if (!layout) return;
      if (isPanelVisible(layout, type)) {
        closePanel(layout, type);
      } else {
        addPanel(layout, type, title);
      }
      updateWindowPanelChecks();
    });
  });

  const menuNewTab = document.getElementById('menu-new-tab');
  const runNewTab = () => { tabManager.newTab(); hideMenu(); };
  if (menuNewTab) menuNewTab.addEventListener('click', runNewTab);

  const menuOpen = document.getElementById('menu-open');
  const runOpenTxt = async () => { hideMenu(); await window.myApi.openFile(); };
  if (menuOpen) menuOpen.addEventListener('click', runOpenTxt);

  const menuOpenJson = document.getElementById('menu-open-json');
  const runOpenJson = async () => {
    hideMenu();
    if (!window.myApi?.openJsonFile) return;
    const result = await window.myApi.openJsonFile();
    if (result?.status === 'success') {
      tabManager.openFile(result.content, result.path);
    }
  };
  if (menuOpenJson) menuOpenJson.addEventListener('click', runOpenJson);

  const menuSave = document.getElementById('menu-save');
  const runSave = async () => { hideMenu(); if (cm) await window.myApi.saveFile(cm.getValue()); };
  if (menuSave) menuSave.addEventListener('click', runSave);

  const menuSaveAs = document.getElementById('menu-save-as');
  const runSaveAs = async () => { hideMenu(); if (cm) await window.myApi.saveFile(cm.getValue(), true); };
  if (menuSaveAs) menuSaveAs.addEventListener('click', runSaveAs);

  const menuSaveTekeyTab = document.getElementById('menu-save-tekey-tab');
  const runSaveTekeyTab = async () => {
    hideMenu();
    const json = tabManager.exportTekeyJson('current');
    const result = await window.myApi.saveFile(json, true, 'json', 'KeyPale-Current-Tab');
    if (result.status === 'success') alert('Tekey形式(.json)で保存しました');
  };
  if (menuSaveTekeyTab) menuSaveTekeyTab.addEventListener('click', runSaveTekeyTab);

  const menuSaveTekeyAll = document.getElementById('menu-save-tekey-all');
  const runSaveTekeyAll = async () => {
    hideMenu();
    const json = tabManager.exportTekeyJson('all');
    const result = await window.myApi.saveFile(json, true, 'json', 'KeyPale-ALL-Chatpalette');
    if (result.status === 'success') alert('全タブをTekey形式(.json)で保存しました');
  };
  if (menuSaveTekeyAll) menuSaveTekeyAll.addEventListener('click', runSaveTekeyAll);

  const menuOptions = document.getElementById('menu-options');
  const optionModal = document.getElementById('option-modal-overlay');
  const runOptions = () => { hideMenu(); optionModal.classList.remove('hidden'); };
  if (menuOptions && optionModal) {
    menuOptions.addEventListener('click', runOptions);
  }
  const optionClose = document.getElementById('option-modal-close');
  if (optionClose && optionModal) {
    optionClose.addEventListener('click', () => optionModal.classList.add('hidden'));
  }

  const menuReset = document.getElementById('menu-reset-layout');
  const runResetLayout = () => { hideMenu(); resetLayout(); };
  if (menuReset) menuReset.addEventListener('click', runResetLayout);

  // 表示 → ズーム
  const EDITOR_FONT_MIN = 10;
  const EDITOR_FONT_MAX = 24;
  const EDITOR_FONT_DEFAULT = 13;
  const editorFontSizeKey = 'keypale_editor_font_size';

  function getEditorFontSize() {
    return parseInt(localStorage.getItem(editorFontSizeKey), 10) || EDITOR_FONT_DEFAULT;
  }
  function setEditorFontSize(px) {
    const v = Math.min(EDITOR_FONT_MAX, Math.max(EDITOR_FONT_MIN, px));
    document.documentElement.style.setProperty('--editor-font-size', v + 'px');
    localStorage.setItem(editorFontSizeKey, String(v));
    if (cm) cm.refresh();
  }

  const menuZoomIn = document.getElementById('menu-zoom-in');
  const menuZoomOut = document.getElementById('menu-zoom-out');
  const menuZoomReset = document.getElementById('menu-zoom-reset');
  const runZoomIn = () => { hideMenu(); setEditorFontSize(getEditorFontSize() + 2); };
  const runZoomOut = () => { hideMenu(); setEditorFontSize(getEditorFontSize() - 2); };
  const runZoomReset = () => { hideMenu(); setEditorFontSize(EDITOR_FONT_DEFAULT); };
  if (menuZoomIn) menuZoomIn.addEventListener('click', runZoomIn);
  if (menuZoomOut) menuZoomOut.addEventListener('click', runZoomOut);
  if (menuZoomReset) menuZoomReset.addEventListener('click', runZoomReset);

  setEditorFontSize(getEditorFontSize());

  // ヘルプ → ヘルプを開く・バージョン情報
  const menuHelp = document.getElementById('menu-help');
  const runOpenHelp = () => {
    hideMenu();
    if (window.myApi?.openHelp) window.myApi.openHelp();
  };
  if (menuHelp) menuHelp.addEventListener('click', runOpenHelp);

  const menuAbout = document.getElementById('menu-about');
  const aboutModal = document.getElementById('about-modal-overlay');
  const aboutClose = document.getElementById('about-modal-close');
  const runAbout = () => { hideMenu(); aboutModal.classList.remove('hidden'); };
  if (menuAbout && aboutModal) {
    menuAbout.addEventListener('click', runAbout);
  }
  if (aboutClose && aboutModal) {
    aboutClose.addEventListener('click', () => aboutModal.classList.add('hidden'));
  }
  const aboutLink = document.getElementById('about-developer-link');
  if (aboutLink) {
    aboutLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.myApi?.openExternal) window.myApi.openExternal(aboutLink.href);
    });
  }

  const menuDevTools = document.getElementById('menu-devtools');
  if (menuDevTools) menuDevTools.remove();

  document.addEventListener('keydown', (e) => {
    const actions = {
      newTab: runNewTab,
      openTxt: runOpenTxt,
      openJson: runOpenJson,
      save: runSave,
      saveAs: runSaveAs,
      saveTekeyTab: runSaveTekeyTab,
      saveTekeyAll: runSaveTekeyAll,
      zoomIn: runZoomIn,
      zoomOut: runZoomOut,
      zoomReset: runZoomReset,
      options: runOptions,
      resetLayout: runResetLayout,
      openHelp: runOpenHelp,
      about: runAbout,
      indentAllFull: () => document.getElementById('editor-opt-all-line-space')?.click(),
      indentSelectionFull: () => document.getElementById('editor-opt-selection-line-space')?.click()
    };
    const cfg = getShortcutConfig();
    const ids = Object.keys(actions);
    for (const id of ids) {
      const shortcut = cfg[id];
      if (!shortcut) continue;
      if (shortcutMatchesEvent(shortcut, e)) {
        e.preventDefault();
        actions[id]();
        return;
      }
    }
    // エディタフォーカス時: 定型文 → スニペットショートカットで挿入
    if (cm && cm.getWrapperElement().contains(document.activeElement)) {
      try {
        const templatePhrases = JSON.parse(localStorage.getItem('keypale_template_phrases') || '[]');
        for (const item of templatePhrases) {
          if (item.shortcut && item.text != null && shortcutMatchesEvent(item.shortcut, e)) {
            e.preventDefault();
            cm.replaceSelection(item.text, null, 'paste');
            return;
          }
        }
        const snippetShortcuts = getSnippetShortcuts();
        for (const item of snippetShortcuts) {
          if (shortcutMatchesEvent(item.shortcut, e)) {
            e.preventDefault();
            cm.replaceSelection(item.content, null, 'paste');
            return;
          }
        }
        const variableShortcuts = getVariableShortcuts();
        for (const item of variableShortcuts) {
          if (shortcutMatchesEvent(item.shortcut, e)) {
            e.preventDefault();
            cm.replaceSelection(`{${item.key}}`, null, 'paste');
            return;
          }
        }
      } catch (_) {}
    }
  });

  if (window.myApi) {
    window.myApi.onMenuSaveRequest(async () => {
      if (!cm) return;
      const activeTab = tabManager.getActiveTab();
      const result = await window.myApi.saveFile(cm.getValue());
      if (result.status === 'success' && activeTab) {
        activeTab.path = result.path;
        if (!activeTab.label) {
          activeTab.label = result.path.split(/[/\\]/).pop();
          const labelInput = document.getElementById('default-label');
          if (labelInput) labelInput.value = activeTab.label;
        }
        tabManager.renderTabs();
      }
    });

    window.myApi.onMenuOpenFile((content, filePath) => {
      tabManager.openFile(content, filePath);
    });
  }
}

const themeDefaultColors = {
  dark: { parent: '#aaddff', child: '#dddddd' },
  light: { parent: '#0055aa', child: '#666666' },
  sepia: { parent: '#a0522d', child: '#6b5646' },
  green: { parent: '#2e8b57', child: '#4f7942' }
};

function saveThemeColors() {
  const currentTheme = getCurrentThemeName();
  const parentPicker = document.getElementById('pd-parent-color-picker');
  const childPicker = document.getElementById('pd-child-color-picker');
  if (parentPicker && childPicker) {
    const data = { parent: parentPicker.value, child: childPicker.value };
    localStorage.setItem(`colors_${currentTheme}`, JSON.stringify(data));
  }
  applyThemeColors();
}

function resetThemeColors() {
  const currentTheme = getCurrentThemeName();
  localStorage.removeItem(`colors_${currentTheme}`);
  localStorage.removeItem('keypale_editor_link_color');
  localStorage.removeItem('keypale_tekey_effect_notation_color');
  localStorage.removeItem('keypale_space_full_color');
  localStorage.removeItem('keypale_space_half_color');
  localStorage.removeItem('keypale_newline_mark_color');
  applyThemeColors();
}

function setupThemeColorHandlers() {
  const parentPicker = document.getElementById('pd-parent-color-picker');
  const childPicker = document.getElementById('pd-child-color-picker');
  const effectPicker = document.getElementById('tekey-effect-notation-color-picker');
  const editorLinkPicker = document.getElementById('editor-link-color-picker');
  const fullSpacePicker = document.getElementById('editor-full-space-color-picker');
  const halfSpacePicker = document.getElementById('editor-half-space-color-picker');
  const newlineMarkPicker = document.getElementById('editor-newline-mark-color-picker');
  const resetBtn = document.getElementById('reset-theme-btn');

  if (parentPicker) parentPicker.addEventListener('input', saveThemeColors);
  if (childPicker) childPicker.addEventListener('input', saveThemeColors);
  if (effectPicker) effectPicker.addEventListener('input', () => {
    const v = effectPicker.value;
    localStorage.setItem('keypale_tekey_effect_notation_color', v);
    document.documentElement.style.setProperty('--tekey-effect-notation-color', v);
  });
  if (editorLinkPicker) editorLinkPicker.addEventListener('input', () => {
    const v = editorLinkPicker.value;
    localStorage.setItem('keypale_editor_link_color', v);
    document.documentElement.style.setProperty('--editor-link-color', v);
  });
  if (fullSpacePicker) fullSpacePicker.addEventListener('input', () => {
    const v = fullSpacePicker.value;
    localStorage.setItem('keypale_space_full_color', v);
    document.documentElement.style.setProperty('--space-fullwidth-bg', hexToRgba(v, 0.35));
  });
  if (halfSpacePicker) halfSpacePicker.addEventListener('input', () => {
    const v = halfSpacePicker.value;
    localStorage.setItem('keypale_space_half_color', v);
    document.documentElement.style.setProperty('--space-halfwidth-bg', hexToRgba(v, 0.28));
  });
  if (newlineMarkPicker) newlineMarkPicker.addEventListener('input', () => {
    const v = newlineMarkPicker.value;
    localStorage.setItem('keypale_newline_mark_color', v);
    document.documentElement.style.setProperty('--newline-mark-color', v);
  });
  if (resetBtn) resetBtn.addEventListener('click', () => {
    resetThemeColors();
  });

  const observer = new MutationObserver(() => applyThemeColors());
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const bodyObserver = new MutationObserver(() => {
    if (document.body.classList.contains('lm_dragging')) {
      requestAnimationFrame(() => {
        if (!document.body.classList.contains('lm_dragging')) return;
        if (lastAppliedThemeColors.parent) document.body.style.setProperty('--tekey-parent-color', lastAppliedThemeColors.parent);
        if (lastAppliedThemeColors.child) document.body.style.setProperty('--tekey-child-color', lastAppliedThemeColors.child);
      });
    } else {
      document.body.style.removeProperty('--tekey-parent-color');
      document.body.style.removeProperty('--tekey-child-color');
    }
  });
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

function setupEditorToolbar() {
  const defaultName = document.getElementById('default-name');
  const defaultLabel = document.getElementById('default-label');
  const colorPicker = document.getElementById('default-color-picker');
  const colorCode = document.getElementById('default-color-code');
  const newTabBtn = document.getElementById('new-tab-btn');

  if (newTabBtn) newTabBtn.addEventListener('click', () => tabManager.newTab());

  if (defaultLabel) {
    defaultLabel.addEventListener('input', (e) => {
      tabManager.updateActiveTabInfo(undefined, e.target.value, undefined);
    });
  }

  if (defaultName) {
    defaultName.addEventListener('input', (e) => {
      tabManager.updateActiveTabInfo(e.target.value, undefined, undefined);
      updatePreview();
    });
  }

  if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
      if (colorCode) colorCode.value = e.target.value.toUpperCase();
      tabManager.updateActiveTabInfo(undefined, undefined, e.target.value);
      updatePreview();
    });
  }

  if (colorCode) {
    colorCode.addEventListener('input', (e) => {
      const val = e.target.value;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        if (colorPicker) colorPicker.value = val;
        tabManager.updateActiveTabInfo(undefined, undefined, val);
        updatePreview();
      }
    });
  }

  const variableGlobalSwitch = document.getElementById('variable-global-switch');
  if (variableGlobalSwitch) variableGlobalSwitch.addEventListener('change', refreshAll);

  setupEditorOptionsBar();
  setupEditorSearch();
}

function getPairedDropdownLineIndices(lines) {
  const paired = new Set();
  const parentOpenStack = [];
  const childOpenStack = [];
  lines.forEach((line, i) => {
    const t = line.replace(/^　+/, '').trim();
    if (t === '###') {
      if (parentOpenStack.length > 0) {
        paired.add(parentOpenStack.pop());
        paired.add(i);
      }
    } else if (t === '####') {
      if (childOpenStack.length > 0) {
        paired.add(childOpenStack.pop());
        paired.add(i);
      }
    } else if (/^###(?!#)\s*.+/.test(t)) parentOpenStack.push(i);
    else if (/^####(?!#)\s*.+/.test(t)) childOpenStack.push(i);
  });
  return paired;
}

function setupEditorOptionsBar() {
  if (!cm) return;
  const toggleBtn = document.getElementById('editor-options-toggle');
  const optionsBar = document.getElementById('editor-options-bar');
  const fullWidthSpace = '　';

  if (toggleBtn && optionsBar) {
    toggleBtn.addEventListener('click', () => {
      optionsBar.classList.toggle('hidden');
      toggleBtn.classList.toggle('editor-options-open', !optionsBar.classList.contains('hidden'));
    });
  }

  const allLineBtn = document.getElementById('editor-opt-all-line-space');
  if (allLineBtn && cm) {
    allLineBtn.addEventListener('click', () => {
      const content = cm.getValue();
      const lines = content.split(/\n/);
      const paired = getPairedDropdownLineIndices(lines);
      const newContent = lines.map((line, i) => {
        if (paired.has(i)) return line;
        return fullWidthSpace + line;
      }).join('\n');
      cm.setValue(newContent);
      updatePreview();
    });
  }

  const selectionLineBtn = document.getElementById('editor-opt-selection-line-space');
  if (selectionLineBtn && cm) {
    selectionLineBtn.addEventListener('click', () => {
      const from = cm.getCursor('from');
      const to = cm.getCursor('to');
      const startLine = Math.min(from.line, to.line);
      const endLine = Math.max(from.line, to.line);
      const fromPos = { line: startLine, ch: 0 };
      const toPos = { line: endLine, ch: cm.getLine(endLine).length };
      const text = cm.getRange(fromPos, toPos);
      const selectionLines = text.split(/\n/);
      const paired = getPairedDropdownLineIndices(selectionLines);
      const newText = selectionLines.map((line, i) => {
        if (paired.has(i)) return line;
        return fullWidthSpace + line;
      }).join('\n');
      cm.replaceRange(newText, fromPos, toPos);
      cm.setSelection(
        { line: startLine, ch: 0 },
        { line: endLine, ch: cm.getLine(endLine).length }
      );
      updatePreview();
    });
  }

  const highlightFullBtn = document.getElementById('editor-opt-highlight-full-space');
  const highlightHalfBtn = document.getElementById('editor-opt-highlight-half-space');

  function createSpaceOverlay(targetChar, className) {
    return {
      token(stream) {
        if (stream.peek() === targetChar) {
          stream.next();
          return className;
        }
        stream.next();
        return null;
      }
    };
  }

  function setButtonActive(btn, active) {
    if (!btn) return;
    btn.classList.toggle('is-active', active);
  }

  function updateSpaceOverlay(target, enabled) {
    if (!cm) return;
    if (target === 'full') {
      if (enabled) {
        if (!fullSpaceOverlay) fullSpaceOverlay = createSpaceOverlay('　', 'space-fullwidth');
        cm.addOverlay(fullSpaceOverlay);
      } else if (fullSpaceOverlay) {
        cm.removeOverlay(fullSpaceOverlay);
      }
    } else {
      if (enabled) {
        if (!halfSpaceOverlay) halfSpaceOverlay = createSpaceOverlay(' ', 'space-halfwidth');
        cm.addOverlay(halfSpaceOverlay);
      } else if (halfSpaceOverlay) {
        cm.removeOverlay(halfSpaceOverlay);
      }
    }
    cm.refresh();
  }

  if (highlightFullBtn) {
    highlightFullBtn.addEventListener('click', () => {
      highlightFullSpace = !highlightFullSpace;
      updateSpaceOverlay('full', highlightFullSpace);
      setButtonActive(highlightFullBtn, highlightFullSpace);
    });
  }
  if (highlightHalfBtn) {
    highlightHalfBtn.addEventListener('click', () => {
      highlightHalfSpace = !highlightHalfSpace;
      updateSpaceOverlay('half', highlightHalfSpace);
      setButtonActive(highlightHalfBtn, highlightHalfSpace);
    });
  }

  const showNewlineBtn = document.getElementById('editor-opt-show-newline');
  if (showNewlineBtn && cm) {
    showNewlineBtn.addEventListener('click', () => {
      showNewline = !showNewline;
      const wrapper = cm.getWrapperElement();
      if (wrapper) {
        if (showNewline) wrapper.classList.add('editor-show-newline');
        else wrapper.classList.remove('editor-show-newline');
      }
      setButtonActive(showNewlineBtn, showNewline);
    });
  }
}

function setupEditorSearch() {
  if (!cm) return;
  const searchPanel = document.getElementById('search-panel');
  const searchInput = document.getElementById('search-input');
  const replaceInput = document.getElementById('replace-input');
  const replaceRow = document.getElementById('replace-row');
  const findPrevBtn = document.getElementById('find-prev-btn');
  const findNextBtn = document.getElementById('find-next-btn');
  const replaceBtn = document.getElementById('replace-btn');
  const replaceAllBtn = document.getElementById('replace-all-btn');
  const closeSearchBtn = document.getElementById('close-search-btn');
  const toggleReplaceBtn = document.getElementById('toggle-replace-btn');
  const searchRegex = document.getElementById('search-regex');
  const searchCase = document.getElementById('search-case');

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getQuery() {
    const raw = searchInput?.value ?? '';
    const useRegex = searchRegex?.checked ?? false;
    const caseInsensitive = !(searchCase?.checked ?? false);
    if (!raw) return null;
    if (useRegex) {
      try {
        return new RegExp(raw, caseInsensitive ? 'gim' : 'gm');
      } catch (_) {
        return new RegExp(escapeRegExp(raw), caseInsensitive ? 'gi' : 'g');
      }
    }
    return raw;
  }

  function findNext(forward) {
    const query = getQuery();
    if (!query) return;
    const cursor = cm.getSearchCursor(query, cm.getCursor(), { caseFold: typeof query === 'string' && query === query.toLowerCase(), multiline: true });
    const found = cursor.find(forward);
    if (found) {
      cm.setSelection(cursor.from(), cursor.to());
      cm.scrollIntoView({ from: cursor.from(), to: cursor.to() }, 20);
    }
  }

  function doReplace(one) {
    const query = getQuery();
    if (!query) return;
    const replacement = replaceInput?.value ?? '';
    const caseFold = typeof query === 'string' && query === query.toLowerCase();
    if (one) {
      const cursor = cm.getSearchCursor(query, cm.getCursor(), { caseFold, multiline: true });
      if (!cursor.find(false)) return;
      const from = cursor.from(), to = cursor.to();
      const text = cm.getRange(from, to);
      const newText = typeof query === 'string' ? replacement : text.replace(query, replacement);
      cm.replaceRange(newText, from, to);
    } else {
      const selFrom = cm.getCursor('from');
      const selTo = cm.getCursor('to');
      const inSelection = cm.somethingSelected() && CodeMirror.cmpPos(selFrom, selTo) !== 0;
      if (inSelection) {
        const selectedText = cm.getRange(selFrom, selTo);
        const newText = typeof query === 'string'
          ? selectedText.split(query).join(replacement)
          : selectedText.replace(query, replacement);
        cm.replaceRange(newText, selFrom, selTo);
      } else {
        cm.operation(() => {
          const cursor = cm.getSearchCursor(query, CodeMirror.Pos(cm.firstLine(), 0), { caseFold, multiline: true });
          while (cursor.findNext()) {
            const from = cursor.from(), to = cursor.to();
            const text = cm.getRange(from, to);
            const newText = typeof query === 'string' ? replacement : text.replace(query, replacement);
            cm.replaceRange(newText, from, to);
          }
        });
      }
    }
  }

  function openSearchPanel() {
    if (!searchPanel) return;
    if (searchPanel.classList.contains('hidden')) {
      searchPanel.classList.remove('hidden');
      if (replaceRow) replaceRow.classList.add('hidden');
      if (searchInput) { searchInput.focus(); searchInput.select(); }
    } else {
      searchPanel.classList.add('hidden');
    }
  }
  function openReplacePanel() {
    if (!searchPanel) return;
    if (searchPanel.classList.contains('hidden')) {
      searchPanel.classList.remove('hidden');
      if (replaceRow) replaceRow.classList.remove('hidden');
      if (searchInput) { searchInput.focus(); searchInput.select(); }
      if (cm) cm.focus();
    } else {
      searchPanel.classList.add('hidden');
    }
  }
  function togglePreviewSearchPanel() {
    const panel = document.getElementById('preview-search-panel');
    const inp = document.getElementById('preview-search-input');
    if (!panel) return;
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      if (inp) { inp.focus(); inp.select(); }
    } else {
      panel.classList.add('hidden');
    }
  }
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
    if (ctrlOrCmd && e.key === 'f') {
      e.preventDefault();
      e.stopPropagation();
      const previewPanel = document.querySelector('.preview-panel-content');
      const previewFocused = previewPanel && previewPanel.contains(document.activeElement);
      if (previewFocused) {
        togglePreviewSearchPanel();
      } else {
        openSearchPanel();
      }
      return;
    }
    if (ctrlOrCmd && e.key === 'h') {
      e.preventDefault();
      e.stopPropagation();
      openReplacePanel();
      if (cm && !document.getElementById('search-panel')?.classList.contains('hidden')) cm.focus();
    }
  }, true);
  const extraKeys = cm.getOption('extraKeys') || {};
  cm.setOption('extraKeys', Object.assign({}, extraKeys, {
    'Ctrl-F': openSearchPanel,
    'Cmd-F': openSearchPanel,
    'Ctrl-H': openReplacePanel,
    'Cmd-H': openReplacePanel
  }));

  if (closeSearchBtn) closeSearchBtn.addEventListener('click', () => { if (searchPanel) searchPanel.classList.add('hidden'); });
  if (toggleReplaceBtn) toggleReplaceBtn.addEventListener('click', () => { if (replaceRow) replaceRow.classList.toggle('hidden'); });
  if (findPrevBtn) findPrevBtn.addEventListener('click', () => findNext(false));
  if (findNextBtn) findNextBtn.addEventListener('click', () => findNext(true));
  if (replaceBtn) replaceBtn.addEventListener('click', () => doReplace(true));
  if (replaceAllBtn) replaceAllBtn.addEventListener('click', () => doReplace(false));
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); findNext(!e.shiftKey); }
    });
  }
}

function initializeApp() {
  const editorTextarea = document.getElementById('editor');
  if (!editorTextarea) {
    setTimeout(initializeApp, 50);
    return;
  }

  CodeMirror.registerHelper('fold', 'tekey', function (cmInstance, start) {
    const line = cmInstance.getLine(start.line);
    const trimmed = line.replace(/^　+/, '').trim();
    const match = trimmed.match(/^(#{3,4})(?!#)(.*)/);
    if (!match) return;
    if (match[2].trim() === '') return;
    const isParent = match[1] === '###';
    const lastLine = cmInstance.lineCount();
    const parentStack = [];
    const childStack = [];
    for (let i = start.line; i < lastLine; ++i) {
      const raw = cmInstance.getLine(i);
      const t = raw.replace(/^　+/, '').trim();
      if (i === start.line) {
        if (isParent) parentStack.push(i);
        else childStack.push(i);
        continue;
      }
      if (t === '###') {
        if (parentStack.length > 0) {
          const openIdx = parentStack.pop();
          if (openIdx === start.line) {
            return { from: CodeMirror.Pos(start.line, line.length), to: CodeMirror.Pos(i, raw.length) };
          }
        }
      } else if (t === '####') {
        if (childStack.length > 0) {
          const openIdx = childStack.pop();
          if (openIdx === start.line) {
            return { from: CodeMirror.Pos(start.line, line.length), to: CodeMirror.Pos(i, raw.length) };
          }
        }
      } else if (/^###(?!#)\s*.+/.test(t)) parentStack.push(i);
      else if (/^####(?!#)\s*.+/.test(t)) childStack.push(i);
    }
    return;
  });

  cm = CodeMirror.fromTextArea(editorTextarea, {
    mode: 'null',
    theme: 'pastel-on-dark',
    lineNumbers: true,
    lineWrapping: true,
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    foldOptions: { rangeFinder: CodeMirror.helpers.fold.tekey, widget: '...' },
    extraKeys: {
      'Ctrl-Z': 'undo',
      'Ctrl-Y': 'redo',
      'Ctrl-X': (cm) => { cm.getWrapperElement().ownerDocument.execCommand('cut'); },
      'Ctrl-C': (cm) => { cm.getWrapperElement().ownerDocument.execCommand('copy'); },
      'Ctrl-V': (cm) => {
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then((text) => {
            if (text != null) cm.replaceSelection(text, null, 'paste');
          }).catch(() => { cm.getWrapperElement().ownerDocument.execCommand('paste'); });
        } else {
          cm.getWrapperElement().ownerDocument.execCommand('paste');
        }
      },
      'Cmd-V': (cm) => {
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then((text) => {
            if (text != null) cm.replaceSelection(text, null, 'paste');
          }).catch(() => { cm.getWrapperElement().ownerDocument.execCommand('paste'); });
        } else {
          cm.getWrapperElement().ownerDocument.execCommand('paste');
        }
      },
      'Delete': 'delCharAfter',
      'Ctrl-A': 'selectAll'
    }
  });
  window.cmInstance = cm;
  cm.setSize('100%', '100%');

  initHighlight(cm);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') {
      e.preventDefault();
      if (window.myApi?.openDevTools) window.myApi.openDevTools();
    }
  });

  (function initEditorContextMenu() {
    const menu = document.getElementById('editor-context-menu');
    if (!menu) return;
    const wrapper = cm.getWrapperElement();
    wrapper.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const doc = wrapper.ownerDocument;
      const rect = doc.body.getBoundingClientRect();
      let x = e.clientX, y = e.clientY;
      menu.classList.remove('hidden');
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.right > rect.right) menu.style.left = (x - menuRect.width) + 'px';
      if (menuRect.bottom > rect.bottom) menu.style.top = (y - menuRect.height) + 'px';
      const hist = cm.getDoc().historySize();
      const undoEl = document.getElementById('editor-ctx-undo');
      const redoEl = document.getElementById('editor-ctx-redo');
      if (undoEl) { undoEl.classList.toggle('disabled', !hist.undo); }
      if (redoEl) { redoEl.classList.toggle('disabled', !hist.redo); }
    });
    const runCmd = (cmd) => {
      menu.classList.add('hidden');
      cm.focus();
      if (cmd === 'undo') { cm.undo(); return; }
      if (cmd === 'redo') { cm.redo(); return; }
      if (cmd === 'selectAll') { cm.execCommand('selectAll'); return; }
      if (cmd === 'delete') { cm.execCommand('delCharAfter'); return; }
      const doc = cm.getWrapperElement().ownerDocument;
      if (cmd === 'cut') { doc.execCommand('cut'); return; }
      if (cmd === 'copy') { doc.execCommand('copy'); return; }
      if (cmd === 'paste') { doc.execCommand('paste'); return; }
      if (cmd === 'indentAllFullWidth') { document.getElementById('editor-opt-all-line-space')?.click(); return; }
      if (cmd === 'indentSelectionFullWidth') { document.getElementById('editor-opt-selection-line-space')?.click(); return; }
    };
    menu.querySelectorAll('.context-menu-item[data-cmd]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (el.classList.contains('disabled')) return;
        runCmd(el.getAttribute('data-cmd'));
      });
    });
    document.addEventListener('click', () => menu.classList.add('hidden'));
  })();

  (function () {
    let pairedCacheSource = '';
    let pairedCache = new Set();
    cm.addOverlay({
      token: function (stream) {
        if (stream.sol()) {
          const lineText = stream.string;
          const docValue = cm.getValue();
          if (docValue !== pairedCacheSource) {
            pairedCacheSource = docValue;
            pairedCache = getPairedDropdownLineIndices(docValue.split(/\n/));
          }
          const lineNo = (stream.lineOracle && stream.lineOracle.line != null) ? stream.lineOracle.line : 0;
          if (pairedCache.has(lineNo)) {
            if (stream.match(/^###(?!#).+/)) { stream.skipToEnd(); return 'tekey-parent'; }
            if (stream.match(/^####(?!#).+/)) { stream.skipToEnd(); return 'tekey-child'; }
            if (stream.match(/^[\s\u3000]*###\s*$/)) { stream.skipToEnd(); return 'tekey-parent'; }
            if (stream.match(/^[\s\u3000]*####\s*$/)) { stream.skipToEnd(); return 'tekey-child'; }
          }
          if (/^[―\-]+$/.test(lineText)) { stream.skipToEnd(); return 'tekey-hr'; }
        }
        stream.next();
        return null;
      }
    });
  })();

  const urlRegex = /^(https?:\/\/|www\.)[^\s<>"')\]\u3000-\u303f\uff00-\uffef]+/;
  cm.addOverlay({
    name: 'editor-url',
    token: function (stream) {
      if (stream.match(urlRegex)) return 'editor-link';
      stream.next();
      return null;
    }
  });
  cm.getWrapperElement().addEventListener('mousedown', (e) => {
    if (!cm || e.button !== 0) return;
    const pos = cm.posFromCoords({ left: e.clientX, top: e.clientY });
    if (!pos) return;
    const token = cm.getTokenAt(pos);
    if (!token || !token.string || !/editor-link/.test(String(token.type || ''))) return;
    const raw = token.string;
    const url = /^www\./i.test(raw) ? 'https://' + raw : raw;
    if (/^https?:\/\/\S+/.test(url)) {
      e.preventDefault();
      if (window.myApi && window.myApi.openExternal) {
        window.myApi.openExternal(url);
      } else {
        window.open(url, '_blank', 'noopener');
      }
    }
  });

  function syncPreviewScrollToCursor() {
    if (localStorage.getItem(TOOL_SYNC_EDITOR_PREVIEW_KEY) !== 'true') return;
    const previewEl = document.getElementById('preview-content');
    if (!previewEl || !cm) return;
    const line = cm.getCursor().line;
    let target = previewEl.querySelector(`[data-line="${line}"]`);
    if (!target) {
      const all = [...previewEl.querySelectorAll('[data-line]')];
      const atOrBefore = all.filter((el) => parseInt(el.getAttribute('data-line'), 10) <= line);
      target = atOrBefore.length ? atOrBefore[atOrBefore.length - 1] : all[0];
    }
    if (target) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  cm.on('cursorActivity', () => {
    updateStatusBar();
    syncPreviewScrollToCursor();
  });
  cm.on('change', refreshAll);

  const tabsContainer = document.getElementById('tabs-container');
  tabManager.init(tabsContainer, cm, (activeTab) => {
    const nameInput = document.getElementById('default-name');
    const labelInput = document.getElementById('default-label');
    const colorCode = document.getElementById('default-color-code');
    const colorPicker = document.getElementById('default-color-picker');
    if (activeTab) {
      if (nameInput) nameInput.value = activeTab.name || '';
      if (labelInput) labelInput.value = activeTab.label || '';
      if (colorCode) colorCode.value = (activeTab.color || '#FFFFFF').toUpperCase();
      if (colorPicker) colorPicker.value = activeTab.color || '#ffffff';
    }
    refreshAll();
  });

  initUI(updatePreview);
  initLists(insertTextAtCursor, updatePreview, () => cm.getValue(), () => cm.focus());
  setupMenuHandlers();
  applyShortcutLabels();
  setupEditorToolbar();
  applyThemeColors();

  const editorWrapper = document.getElementById('editor-wrapper');
  if (editorWrapper && globalThis.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      if (!cm) return;
      requestAnimationFrame(() => cm.refresh());
    });
    ro.observe(editorWrapper);
  }

  setTimeout(() => {
    cm.refresh();
    refreshAll();
    const layout = getLayoutInstance();
    if (layout && layout.updateSize) layout.updateSize();
  }, 150);
}

function setupPanelSizeSliders() {
  const snippetSlider = document.getElementById('snippet-size-slider');
  const snippetValue = document.getElementById('snippet-size-value');
  const variableSlider = document.getElementById('variable-size-slider');
  const variableValue = document.getElementById('variable-size-value');

  const applySnippetHeight = (px) => {
    const panel = document.querySelector('.snippet-panel-content');
    if (panel) panel.style.setProperty('--snippet-item-height', px + 'px');
    if (snippetValue) snippetValue.textContent = px;
    localStorage.setItem('keypale_snippet_item_height', String(px));
  };
  const applyVariableHeight = (px) => {
    const panel = document.querySelector('.variable-panel-content');
    if (panel) panel.style.setProperty('--variable-item-height', px + 'px');
    if (variableValue) variableValue.textContent = px;
    localStorage.setItem('keypale_variable_item_height', String(px));
  };

  const savedSnippet = parseInt(localStorage.getItem('keypale_snippet_item_height'), 10) || 26;
  const savedVariable = parseInt(localStorage.getItem('keypale_variable_item_height'), 10) || 26;
  if (snippetSlider) {
    snippetSlider.value = Math.min(40, Math.max(20, savedSnippet));
    applySnippetHeight(Number(snippetSlider.value));
    snippetSlider.addEventListener('input', () => applySnippetHeight(Number(snippetSlider.value)));
  }
  if (variableSlider) {
    variableSlider.value = Math.min(40, Math.max(20, savedVariable));
    applyVariableHeight(Number(variableSlider.value));
    variableSlider.addEventListener('input', () => applyVariableHeight(Number(variableSlider.value)));
  }
}

function setupShortcutCaptureInputs() {
  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (!el || !el.classList || !el.classList.contains('shortcut-capture-input')) return;
    if (el.readOnly || el.disabled) return;
    el.value = formatShortcutFromEvent(e);
  }, true);
}

const TEMPLATE_PHRASES_KEY = 'keypale_template_phrases';

function getTemplatePhrases() {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATE_PHRASES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveTemplatePhrases(arr) {
  localStorage.setItem(TEMPLATE_PHRASES_KEY, JSON.stringify(arr));
}

function setupTemplatePhrases() {
  const listEl = document.getElementById('template-phrases-list');
  const shortcutInput = document.getElementById('tp-shortcut-input');
  const textInput = document.getElementById('tp-text-input');
  const addBtn = document.getElementById('tp-add-btn');
  const ctxMenu = document.getElementById('tp-context-menu');
  const editForm = document.getElementById('tp-edit-form');
  const editShortcut = document.getElementById('tp-edit-shortcut');
  const editText = document.getElementById('tp-edit-text');
  const editUpdateBtn = document.getElementById('tp-edit-update-btn');
  const editCancelBtn = document.getElementById('tp-edit-cancel-btn');
  if (!listEl) return;

  let editingIndex = -1;

  function renderList() {
    const arr = getTemplatePhrases();
    listEl.innerHTML = '';
    arr.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'options-highlight-item';
      div.dataset.index = String(index);
      div.innerHTML = `<span class="options-highlight-keyword">${escapeHtmlForOptions(item.shortcut)}</span><span class="options-highlight-preview">→ ${escapeHtmlForOptions(item.text)}</span>`;
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        ctxMenu.classList.remove('hidden');
        ctxMenu.style.left = e.clientX + 'px';
        ctxMenu.style.top = e.clientY + 'px';
        ctxMenu.dataset.index = String(index);
      });
      listEl.appendChild(div);
    });
  }

  function escapeHtmlForOptions(s) {
    if (s == null) return '';
    const str = String(s);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  addBtn?.addEventListener('click', () => {
    const shortcut = (shortcutInput?.value || '').trim();
    const text = (textInput?.value ?? '');
    if (!shortcut) return;
    const arr = getTemplatePhrases();
    arr.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), shortcut, text });
    saveTemplatePhrases(arr);
    renderList();
    if (shortcutInput) shortcutInput.value = '';
    if (textInput) textInput.value = '';
  });

  document.addEventListener('click', () => {
    if (ctxMenu && !ctxMenu.classList.contains('hidden')) ctxMenu.classList.add('hidden');
  });

  ctxMenu?.querySelectorAll('.options-context-menu-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(ctxMenu.dataset.index, 10);
      ctxMenu.classList.add('hidden');
      const arr = getTemplatePhrases();
      const entry = arr[index];
      if (!entry) return;
      if (item.dataset.action === 'delete') {
        arr.splice(index, 1);
        saveTemplatePhrases(arr);
        renderList();
      } else if (item.dataset.action === 'edit') {
        editingIndex = index;
        if (editShortcut) editShortcut.value = entry.shortcut || '';
        if (editText) editText.value = entry.text ?? '';
        editForm?.classList.remove('hidden');
      }
    });
  });

  editUpdateBtn?.addEventListener('click', () => {
    if (editingIndex < 0) return;
    const arr = getTemplatePhrases();
    const shortcut = (editShortcut?.value || '').trim();
    const text = editText?.value ?? '';
    if (!shortcut) return;
    arr[editingIndex] = { ...arr[editingIndex], shortcut, text };
    saveTemplatePhrases(arr);
    renderList();
    editForm?.classList.add('hidden');
    editingIndex = -1;
  });

  editCancelBtn?.addEventListener('click', () => {
    editForm?.classList.add('hidden');
    editingIndex = -1;
  });

  renderList();
}

async function loadOptionsContent() {
  const body = document.getElementById('options-modal-body');
  if (!body || body.querySelector('.options-tabs')) return;
  try {
    const r = await fetch('options-content.html');
    const html = await r.text();
    body.innerHTML = html;
    setupOptionsTabs();
    setupShortcutOptions();
    setupThemeColorHandlers();
    setupToolSettings();
    setupTemplatePhrases();
    applyThemeColors();
    applyShortcutLabels();
  } catch (e) {
    console.warn('options-content.html の読み込みに失敗しました', e);
  }
}

function setupOptionsTabs() {
  const tabs = document.querySelectorAll('.options-tab');
  const panels = document.querySelectorAll('.options-tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => {
        p.classList.toggle('active', p.id === 'tab-' + id);
      });
      tab.classList.add('active');
    });
  });
}

function setupToolSettings() {
  const noDropdownToggle = document.getElementById('tool-no-preview-dropdown-toggle');
  const syncLineToggle = document.getElementById('tool-sync-editor-preview-line');
  if (noDropdownToggle) {
    noDropdownToggle.checked = localStorage.getItem(TOOL_NO_PREVIEW_DROPDOWN_KEY) === 'true';
    noDropdownToggle.addEventListener('change', () => {
      localStorage.setItem(TOOL_NO_PREVIEW_DROPDOWN_KEY, noDropdownToggle.checked);
    });
  }
  if (syncLineToggle) {
    syncLineToggle.checked = localStorage.getItem(TOOL_SYNC_EDITOR_PREVIEW_KEY) === 'true';
    syncLineToggle.addEventListener('change', () => {
      localStorage.setItem(TOOL_SYNC_EDITOR_PREVIEW_KEY, syncLineToggle.checked);
    });
  }
}

function setupShortcutOptions() {
  const inputs = document.querySelectorAll('.options-shortcut-input');
  if (!inputs.length) return;
  const cfg = getShortcutConfig();

  const setInputError = (input, message) => {
    let err = input.parentElement.querySelector('.options-shortcut-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'options-shortcut-error';
      input.parentElement.appendChild(err);
    }
    if (message) {
      err.textContent = message;
      input.classList.add('has-error');
    } else {
      err.textContent = '';
      input.classList.remove('has-error');
    }
  };

  const validateAndSave = () => {
    const used = new Map();
    let hasError = false;

    inputs.forEach((input) => {
      const raw = input.value.trim();
      const id = input.dataset.shortcutId;
      if (!id) return;
      if (!raw) {
        setInputError(input, '');
        return;
      }
      const normalized = normalizeShortcut(raw);
      if (!normalized) {
        setInputError(input, '形式が正しくありません');
        hasError = true;
        return;
      }
      if (used.has(normalized)) {
        setInputError(input, `他の項目と重複しています`);
        hasError = true;
        return;
      }
      used.set(normalized, id);
      setInputError(input, '');
    });

    if (hasError) return;

    const next = getShortcutConfig();
    inputs.forEach((input) => {
      const id = input.dataset.shortcutId;
      if (!id) return;
      next[id] = input.value.trim();
    });
    saveShortcutConfig(next);
    applyShortcutLabels();
  };

  inputs.forEach((input) => {
    const id = input.dataset.shortcutId;
    if (!id) return;
    input.value = cfg[id] || '';
    input.addEventListener('input', validateAndSave);
    input.addEventListener('blur', validateAndSave);
  });

  const resetBtn = document.getElementById('reset-shortcuts-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      saveShortcutConfig(Object.assign({}, shortcutDefaults));
      const updated = getShortcutConfig();
      inputs.forEach((input) => {
        const id = input.dataset.shortcutId;
        if (id) {
          input.value = updated[id] || '';
          setInputError(input, '');
        }
      });
      applyShortcutLabels();
    });
  }

  validateAndSave();
}

initDocking(async () => {
  await loadOptionsContent();
  initializeApp();
  setupShortcutCaptureInputs();
  setupPanelSizeSliders();

  if (window.myApi?.onSaveLayoutRequest) {
    window.myApi.onSaveLayoutRequest(() => {
      const configJson = saveLayoutNow();
      window.myApi.sendSaveLayoutDone(configJson != null ? configJson : null);
    });
  }
}).catch((err) => {
  showFatalOverlay('ドッキングの初期化に失敗しました', String(err?.stack || err));
});

document.addEventListener('keydown', (e) => {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
  if ((ctrlOrCmd && e.shiftKey && (e.key === 'I' || e.key === 'i')) || e.key === 'F12') {
    if (window.myApi && window.myApi.openDevTools) window.myApi.openDevTools();
  }
});

async function updateMaximizedClass() {
  if (window.myApi && window.myApi.isMaximized) {
    const maximized = await window.myApi.isMaximized();
    document.body.classList.toggle('is-maximized', maximized);
    if (maximized) {
      document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
    } else {
      document.documentElement.style.removeProperty('--viewport-height');
    }
  }
}

const maxBtn = document.getElementById('max-btn');
if (maxBtn) {
  maxBtn.addEventListener('click', () => {
    setTimeout(updateMaximizedClass, 100);
  });
}

window.addEventListener('resize', () => {
  updateMaximizedClass();
  const layout = getLayoutInstance();
  const doUpdate = () => {
    if (layout && layout.updateSize) layout.updateSize();
  };
  requestAnimationFrame(doUpdate);
  setTimeout(doUpdate, 50);
  setTimeout(doUpdate, 150);
});

setTimeout(updateMaximizedClass, 200);

document.addEventListener('panel-menu-action', async (e) => {
  const { panelType, action } = e.detail;

  if (action === 'import') {
    const input = document.getElementById('file-import-input');
    if (!input) return;

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      const text = await file.text();
      try {
        const data = JSON.parse(text);

        if (panelType === 'snippet') {
          if (Array.isArray(data)) {
            localStorage.setItem('keypale_snippets', JSON.stringify(data));
            location.reload();
          }
        } else if (panelType === 'variable') {
          if (Array.isArray(data)) {
            localStorage.setItem('keypale_variables', JSON.stringify(data));
            location.reload();
          }
        }
      } catch (err) {
        alert('JSONの解析に失敗しました: ' + err.message);
      }
      input.value = '';
    };
    input.click();

  } else if (action === 'export') {
    let data = [];
    let defaultFileName = '';

    if (panelType === 'snippet') {
      data = JSON.parse(localStorage.getItem('keypale_snippets') || '[]');
      defaultFileName = 'KeyPale-Snippets';
    } else if (panelType === 'variable') {
      data = JSON.parse(localStorage.getItem('keypale_variables') || '[]');
      defaultFileName = 'KeyPale-Variables';
    }

    if (window.myApi && window.myApi.saveFile) {
      await window.myApi.saveFile(JSON.stringify(data, null, 2), true, 'json', defaultFileName);
    } else {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFileName ? defaultFileName + '.json' : 'export.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  } else if (action === 'reset-snippets' && panelType === 'snippet') {
    document.dispatchEvent(new CustomEvent('keypale-reset-snippets'));
  }
});

function setupPreviewToolbar() {
  const fontSlider = document.getElementById('font-size-slider');
  const fontValue = document.getElementById('font-size-value');
  const lineSlider = document.getElementById('line-height-slider');
  const lineValue = document.getElementById('line-height-value');
  const previewContent = document.getElementById('preview-content');

  const savedFontSize = localStorage.getItem('preview_font_size') || '12';
  const savedLineHeight = localStorage.getItem('preview_line_height') || '1.5';
  const savedBgMode = localStorage.getItem('preview_bg_mode') || 'dark';

  if (fontSlider) {
    fontSlider.value = savedFontSize;
    if (fontValue) fontValue.textContent = savedFontSize + 'px';
    if (previewContent) previewContent.style.fontSize = savedFontSize + 'px';

    fontSlider.addEventListener('input', () => {
      const val = fontSlider.value;
      if (fontValue) fontValue.textContent = val + 'px';
      if (previewContent) previewContent.style.fontSize = val + 'px';
      localStorage.setItem('preview_font_size', val);
    });
  }

  if (lineSlider) {
    lineSlider.value = savedLineHeight;
    if (lineValue) lineValue.textContent = savedLineHeight;
    const actualLh = (parseFloat(savedLineHeight) * 0.8).toFixed(2);
    if (previewContent) previewContent.style.lineHeight = actualLh;

    lineSlider.addEventListener('input', () => {
      const val = lineSlider.value;
      const actualVal = (parseFloat(val) * 0.8).toFixed(2);
      if (lineValue) lineValue.textContent = val;
      if (previewContent) previewContent.style.lineHeight = actualVal;
      localStorage.setItem('preview_line_height', val);
    });
  }

  const bgModeButtons = document.querySelectorAll('.bg-mode-btn');
  if (bgModeButtons.length > 0 && previewContent) {
    const updateBgMode = (mode) => {
      previewContent.classList.remove('bg-dark', 'bg-light', 'bg-transparent');
      previewContent.classList.add('bg-' + mode);
      bgModeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
      localStorage.setItem('preview_bg_mode', mode);
    };

    updateBgMode(savedBgMode);

    bgModeButtons.forEach(btn => {
      btn.addEventListener('click', () => updateBgMode(btn.dataset.mode));
    });
  }

  const effectToggle = document.getElementById('effect-notation-toggle');
  if (effectToggle) {
    const savedEffect = localStorage.getItem('preview_effect_notation') === 'true';
    effectToggle.checked = savedEffect;
    effectToggle.addEventListener('change', () => {
      localStorage.setItem('preview_effect_notation', effectToggle.checked);
      updatePreview();
    });
  }

  setupPreviewSearch();
}

function setupPreviewSearch() {
  const input = document.getElementById('preview-search-input');
  const prevBtn = document.getElementById('preview-search-prev');
  const nextBtn = document.getElementById('preview-search-next');
  const previewContent = document.getElementById('preview-content');
  const previewSearchPanel = document.getElementById('preview-search-panel');
  const closeBtn = document.getElementById('preview-close-search-btn');
  if (!input || !previewContent) return;

  if (previewContent) {
    previewContent.setAttribute('tabindex', '-1');
    previewContent.addEventListener('click', () => previewContent.focus());
  }
  if (closeBtn && previewSearchPanel) {
    closeBtn.addEventListener('click', () => previewSearchPanel.classList.add('hidden'));
  }

  let currentHitIndex = 0;
  let hitElements = [];

  function escapeForRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function clearHighlights() {
    previewContent.querySelectorAll('.preview-search-hit').forEach(mark => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
    hitElements = [];
  }

  function applyHighlights(query) {
    clearHighlights();
    if (!query || !query.trim()) return;
    const reg = new RegExp(escapeForRegex(query), 'gi');
    const walker = document.createTreeWalker(previewContent, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);
    textNodes.forEach(textNode => {
      const text = textNode.textContent;
      let lastIndex = 0;
      let m;
      reg.lastIndex = 0;
      const matches = [];
      while ((m = reg.exec(text)) !== null) {
        matches.push({ index: m.index, length: m[0].length, text: m[0] });
      }
      if (matches.length === 0) return;
      const fragment = document.createDocumentFragment();
      matches.forEach(({ index, length, text: matchText }) => {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
        const mark = document.createElement('mark');
        mark.className = 'preview-search-hit';
        mark.textContent = matchText;
        fragment.appendChild(mark);
        lastIndex = index + length;
      });
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      textNode.parentNode.replaceChild(fragment, textNode);
    });
    hitElements = [...previewContent.querySelectorAll('.preview-search-hit')];
    currentHitIndex = hitElements.length > 0 ? 0 : -1;
    if (hitElements.length > 0) {
      hitElements[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function goToHit(delta) {
    if (hitElements.length === 0) return;
    currentHitIndex = (currentHitIndex + delta + hitElements.length) % hitElements.length;
    hitElements[currentHitIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  input.addEventListener('input', () => applyHighlights(input.value.trim()));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); goToHit(e.shiftKey ? -1 : 1); }
  });
  if (prevBtn) prevBtn.addEventListener('click', () => goToHit(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => goToHit(1));

  document.addEventListener('preview-updated', () => {
    const q = input?.value?.trim();
    if (q) applyHighlights(q);
  });
}

setTimeout(setupPreviewToolbar, 300);
