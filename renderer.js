// renderer.js

import { els } from './js/dom.js';
import { parseTekeySyntax } from './js/parser.js';
import { initUI } from './js/ui.js';
import { initLists, userVariables, renderVariables } from './js/lists.js';
import { tabManager } from './js/tabs.js';
import { initHighlight, applySyntaxColors } from './js/highlight.js'; 

// CodeMirror初期化
CodeMirror.registerHelper("fold", "tekey", function(cm, start) {
  const line = cm.getLine(start.line);
  const trimmed = line.trim();
  const match = trimmed.match(/^(#{3,4})(?!#)(.*)/);
  if (!match) return;
  const hashes = match[1];
  const content = match[2].trim();
  if (content === "") return;
  const isParent = (hashes === "###");
  const endToken = isParent ? "###" : "####";
  const lastLine = cm.lineCount();
  for (let i = start.line + 1; i < lastLine; ++i) {
    const nextLineRaw = cm.getLine(i);
    const nextLine = nextLineRaw.trim();
    if (nextLine === endToken) {
      return { from: CodeMirror.Pos(start.line, line.length), to: CodeMirror.Pos(i, nextLineRaw.length) };
    }
  }
  return;
});

const cm = CodeMirror.fromTextArea(els.editor, {
  mode: 'markdown', theme: 'pastel-on-dark', lineNumbers: true, lineWrapping: true, foldGutter: true, 
  gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
  foldOptions: { rangeFinder: CodeMirror.helpers.fold.tekey, widget: "..." }
});
window.cmInstance = cm;

// ハイライト機能
initHighlight(cm);

cm.addOverlay({
  token: function(stream) {
    if (stream.sol()) {
      if (stream.match(/^###(?!#).+/)) { stream.skipToEnd(); return "tekey-parent"; }
      if (stream.match(/^####(?!#).+/)) { stream.skipToEnd(); return "tekey-child"; }
    }
    stream.skipToEnd(); return null;
  }
});

function updateStatusBar() {
  const doc = cm.getDoc();
  const cursor = doc.getCursor();
  const content = doc.getValue();
  if(els.cursorPosLabel) els.cursorPosLabel.textContent = `行: ${cursor.line + 1}, 列: ${cursor.ch + 1}`;
  if(els.charCountLabel) els.charCountLabel.textContent = `${content.length} 文字`;
}
cm.on('cursorActivity', updateStatusBar);

function refreshAll() {
  const isGlobal = els.variableGlobalSwitch ? els.variableGlobalSwitch.checked : false;
  const sourceText = isGlobal ? tabManager.getAllContent() : cm.getValue();
  renderVariables(sourceText);
  updatePreview(); 
  updateStatusBar();
}
cm.on('change', refreshAll);

const tabsContainer = document.getElementById('tabs-container');
const newTabBtn = document.getElementById('new-tab-btn');

// タブマネージャー初期化 (セッション復元含む)
tabManager.init(tabsContainer, cm, (activeTab) => {
  if (activeTab) {
    if (els.defaultName) els.defaultName.value = activeTab.name || "";
    if (els.defaultLabel) els.defaultLabel.value = activeTab.label || "";
    if (els.colorCode) els.colorCode.value = (activeTab.color || "#FFFFFF").toUpperCase();
    if (els.defaultColorPicker) els.defaultColorPicker.value = activeTab.color || "#ffffff";
  }
  refreshAll();
});

if(newTabBtn) newTabBtn.addEventListener('click', () => tabManager.newTab());
if(els.menuNewTab) els.menuNewTab.addEventListener('click', () => {
  tabManager.newTab();
  els.appMenuDropdown.classList.add('hidden');
});

// UI初期化 (レイアウト復元含む)
initUI(updatePreview);
initLists(insertTextAtCursor, updatePreview, () => cm.getValue(), () => cm.focus()); 

// イベントリスナー
if (els.defaultName) els.defaultName.addEventListener('input', (e) => { tabManager.updateActiveTabInfo(e.target.value, undefined, undefined); updatePreview(); });
if (els.defaultLabel) els.defaultLabel.addEventListener('input', (e) => { tabManager.updateActiveTabInfo(undefined, e.target.value, undefined); });
if (els.defaultColorPicker) els.defaultColorPicker.addEventListener('input', (e) => { tabManager.updateActiveTabInfo(undefined, undefined, e.target.value); updatePreview(); });
if (els.colorCode) els.colorCode.addEventListener('input', (e) => { if(/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) { tabManager.updateActiveTabInfo(undefined, undefined, e.target.value); updatePreview(); } });
if (els.variableGlobalSwitch) els.variableGlobalSwitch.addEventListener('change', refreshAll);

const themeDefaultColors = {
  dark: { parent: '#aaddff', child: '#dddddd' },
  light: { parent: '#0055aa', child: '#666666' }, 
  sepia: { parent: '#a0522d', child: '#6b5646' },
  green: { parent: '#2e8b57', child: '#4f7942' }
};
function applyThemeColors() {
  const bodyClass = document.body.className || 'theme-dark';
  const currentTheme = bodyClass.replace('theme-', '') || 'dark';
  const key = `colors_${currentTheme}`;
  const saved = JSON.parse(localStorage.getItem(key)) || themeDefaultColors[currentTheme] || themeDefaultColors.dark;
  document.documentElement.style.setProperty('--tekey-parent-color', saved.parent);
  document.documentElement.style.setProperty('--tekey-child-color', saved.child);
  if (els.pdParentColorPicker) els.pdParentColorPicker.value = saved.parent;
  if (els.pdChildColorPicker) els.pdChildColorPicker.value = saved.child;
  if (els.currentThemeName) els.currentThemeName.textContent = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);
  applySyntaxColors();
}
function saveThemeColors() {
  const bodyClass = document.body.className || 'theme-dark';
  const currentTheme = bodyClass.replace('theme-', '') || 'dark';
  const parentVal = els.pdParentColorPicker.value;
  const childVal = els.pdChildColorPicker.value;
  const data = { parent: parentVal, child: childVal };
  localStorage.setItem(`colors_${currentTheme}`, JSON.stringify(data));
  applyThemeColors();
}
function resetThemeColors() {
  const bodyClass = document.body.className || 'theme-dark';
  const currentTheme = bodyClass.replace('theme-', '') || 'dark';
  localStorage.removeItem(`colors_${currentTheme}`); 
  applyThemeColors();
}
applyThemeColors();
const observer = new MutationObserver(() => applyThemeColors());
observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
if(els.pdParentColorPicker) els.pdParentColorPicker.addEventListener('input', saveThemeColors);
if(els.pdChildColorPicker) els.pdChildColorPicker.addEventListener('input', saveThemeColors);
if(els.resetThemeBtn) els.resetThemeBtn.addEventListener('click', resetThemeColors);

window.myApi.onMenuSaveRequest(async () => {
  const activeTab = tabManager.getActiveTab();
  if (!activeTab) return;
  const result = await window.myApi.saveFile(cm.getValue()); 
  if (result.status === 'success') {
    activeTab.path = result.path;
    if(!activeTab.label) {
        activeTab.label = result.path.split(/[/\\]/).pop();
        if(els.defaultLabel) els.defaultLabel.value = activeTab.label;
    }
    tabManager.renderTabs();
    document.title = `KeyPale - ${result.path}`;
  }
});

if (els.menuSaveTekeyTab) els.menuSaveTekeyTab.addEventListener('click', async () => { els.appMenuDropdown.classList.add('hidden'); const json = tabManager.exportTekeyJson('current'); const result = await window.myApi.saveFile(json, true, 'json'); if (result.status === 'success') alert('Tekey形式(.json)で保存しました'); });
if (els.menuSaveTekeyAll) els.menuSaveTekeyAll.addEventListener('click', async () => { els.appMenuDropdown.classList.add('hidden'); const json = tabManager.exportTekeyJson('all'); const result = await window.myApi.saveFile(json, true, 'json'); if (result.status === 'success') alert('全タブをTekey形式(.json)で保存しました'); });

window.myApi.onMenuOpenFile((content, filePath) => { tabManager.openFile(content, filePath); });
if (els.menuOpen) els.menuOpen.addEventListener('click', () => { els.appMenuDropdown.classList.add('hidden'); alert('ファイルを開く機能はウィンドウ左上の標準メニューから行ってください'); });
if (els.menuSave) els.menuSave.addEventListener('click', () => { els.appMenuDropdown.classList.add('hidden'); window.myApi.saveFile(cm.getValue()); });
if (els.menuSaveAs) els.menuSaveAs.addEventListener('click', () => { els.appMenuDropdown.classList.add('hidden'); window.myApi.saveFile(cm.getValue(), true); });

function updatePreview() { const text = cm.getValue(); els.preview.innerHTML = parseTekeySyntax(text, userVariables); }
function insertTextAtCursor(text) { cm.focus(); cm.replaceSelection(text); updatePreview(); }

let searchCursor = null;
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); els.searchPanel.classList.remove('hidden'); els.replaceRow.classList.add('hidden'); els.searchInput.focus(); els.searchInput.select(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); els.searchPanel.classList.remove('hidden'); els.replaceRow.classList.remove('hidden'); els.searchInput.focus(); els.searchInput.select(); }
});
els.closeSearch.addEventListener('click', () => { els.searchPanel.classList.add('hidden'); cm.focus(); });
els.findNext.addEventListener('click', () => doSearch(true));
els.findPrev.addEventListener('click', () => doSearch(false));
els.searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(!e.shiftKey); } });
function doSearch(next) {
  const query = els.searchInput.value; if (!query) return;
  if (!searchCursor || searchCursor.query !== query) { searchCursor = cm.getSearchCursor(query, cm.getCursor()); searchCursor.query = query; }
  const found = next ? searchCursor.findNext() : searchCursor.findPrevious();
  if (!found) {
    const startPos = next ? {line: 0, ch: 0} : {line: cm.lineCount(), ch: 0};
    searchCursor = cm.getSearchCursor(query, startPos); if (!searchCursor.find(next)) return; 
  }
  cm.setSelection(searchCursor.from(), searchCursor.to());
  cm.scrollIntoView({from: searchCursor.from(), to: searchCursor.to()}, 20);
}
els.replaceBtn.addEventListener('click', () => {
  const replacement = els.replaceInput.value;
  if (cm.getSelection() === els.searchInput.value) { cm.replaceSelection(replacement); doSearch(true); } else { doSearch(true); }
});
els.replaceAllBtn.addEventListener('click', () => {
  const query = els.searchInput.value; if (!query) return;
  const text = cm.getValue(); const newText = text.split(query).join(els.replaceInput.value);
  if (text !== newText) { cm.setValue(newText); alert('置換完了'); }
});

setTimeout(() => { cm.refresh(); updateStatusBar(); }, 1);
refreshAll();