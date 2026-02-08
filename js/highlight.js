// js/highlight.js
// 構文ハイライトとカスタムキーワードの管理

import { els } from './dom.js';

// 設定データ
export const highlightSettings = {
  themeColors: {}, // 各テーマごとの構文色
  customKeywords: [] // [{ word, color, bgColor, id }]
};

let cmInstance = null; // CodeMirrorインスタンス

// 初期化
export function initHighlight(cm) {
  cmInstance = cm;
  loadSettings();
  
  // 初期適用
  applySyntaxColors();
  applyCustomKeywordsOverlay();
  renderKeywordList();

  // イベントリスナー登録
  setupEventListeners();
}

// 設定のロード
function loadSettings() {
  try {
    const saved = localStorage.getItem('keypale_highlight_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      highlightSettings.themeColors = parsed.themeColors || {};
      highlightSettings.customKeywords = parsed.customKeywords || [];
    }
  } catch (e) {
    console.error("ハイライト設定の読み込み失敗", e);
  }
}

// 設定の保存
function saveSettings() {
  localStorage.setItem('keypale_highlight_settings', JSON.stringify(highlightSettings));
}

// body に theme-XXX 以外のクラス（is-maximized, lm_dragging 等）が付いていてもテーマ名だけ取り出す
function getCurrentThemeName() {
  const m = (document.body.className || '').match(/\btheme-(\w+)/);
  return m ? m[1] : 'dark';
}

// ▼▼▼ 標準構文カラーの適用 ▼▼▼
export function applySyntaxColors() {
  const currentTheme = getCurrentThemeName();
  
  // デフォルト値
  const defaults = {
    bold: '#ffaa00',
    link: '#569cd6',
    quote: '#6a9955',
    code: '#ce9178'
  };

  // テーマごとの保存値があれば使用、なければデフォルト
  const colors = highlightSettings.themeColors[currentTheme] || defaults;

  // CSS変数を更新
  document.documentElement.style.setProperty('--cm-strong-color', colors.bold);
  document.documentElement.style.setProperty('--cm-link-color', colors.link);
  document.documentElement.style.setProperty('--cm-quote-color', colors.quote);
  document.documentElement.style.setProperty('--cm-code-color', colors.code);

  // 設定パネルのピッカーにも反映（動的に取得）
  const syntaxBoldColor = document.getElementById('syntax-bold-color');
  const syntaxLinkColor = document.getElementById('syntax-link-color');
  const syntaxQuoteColor = document.getElementById('syntax-quote-color');
  const syntaxCodeColor = document.getElementById('syntax-code-color');
  
  if(syntaxBoldColor) syntaxBoldColor.value = colors.bold;
  if(syntaxLinkColor) syntaxLinkColor.value = colors.link;
  if(syntaxQuoteColor) syntaxQuoteColor.value = colors.quote;
  if(syntaxCodeColor) syntaxCodeColor.value = colors.code;
}

// カラーピッカー操作時の保存
function updateSyntaxColor(type, color) {
  const currentTheme = getCurrentThemeName();
  if (!highlightSettings.themeColors[currentTheme]) {
    highlightSettings.themeColors[currentTheme] = {
      bold: '#ffaa00', link: '#569cd6', quote: '#6a9955', code: '#ce9178'
    };
  }
  highlightSettings.themeColors[currentTheme][type] = color;
  saveSettings();
  applySyntaxColors(); // 即時反映
}


// ▼▼▼ カスタムキーワードハイライト (Overlay) ▼▼▼

// CodeMirrorにオーバーレイを登録（または更新）
function applyCustomKeywordsOverlay() {
  if (!cmInstance) return;

  // 既存のカスタム用スタイルタグがあれば更新、なければ作成
  let styleTag = document.getElementById('custom-highlight-styles');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'custom-highlight-styles';
    document.head.appendChild(styleTag);
  }

  // 1. 動的CSSの生成 (.cm-chk-ID { ... })
  let cssRules = "";
  const keywords = highlightSettings.customKeywords;
  
  keywords.forEach(k => {
    const bgStyle = k.bgColor === 'transparent' ? '' : `background-color: ${k.bgColor};`;
    cssRules += `.cm-chk-${k.id} { color: ${k.color} !important; ${bgStyle} border-radius: 2px; }\n`;
  });
  styleTag.textContent = cssRules;

  // 2. CodeMirrorのオーバーレイ再登録
  cmInstance.removeOverlay("custom-highlight"); // 古いものを削除
  
  if (keywords.length === 0) return;

  // 正規表現の作成 (エスケープ処理付き)
  // 単語境界を含めるか、部分一致にするかは好みですが、今回は「部分一致」で強力にハイライトします
  const pattern = new RegExp(keywords.map(k => escapeRegExp(k.word)).join('|'), 'g');

  cmInstance.addOverlay({
    name: "custom-highlight",
    token: function(stream) {
      // プルダウン行（### / #### のタイトル・閉じ）にはカスタムハイライトを適用しない（行全体をスキップ）
      if (stream.sol() && /^[\s\u3000]*(###|####)/.test(stream.string)) {
        stream.skipToEnd();
        return null;
      }
      for (let i = 0; i < keywords.length; i++) {
        const k = keywords[i];
        if (stream.match(k.word)) {
          return `chk-${k.id}`;
        }
      }
      stream.next();
      return null;
    }
  });
}

// リスト表示のレンダリング
function renderKeywordList() {
  const highlightList = document.getElementById('highlight-list');
  if (!highlightList) return;
  highlightList.innerHTML = '';

  const contextMenu = document.getElementById('hl-context-menu');

  highlightSettings.customKeywords.forEach((k, index) => {
    const row = document.createElement('div');
    row.style.cssText = "display:flex; align-items:center; padding:4px; border-bottom:1px solid rgba(128,128,128,0.2); font-size:11px; cursor:context-menu;";
    
    // プレビュー
    const preview = document.createElement('span');
    preview.textContent = k.word;
    preview.style.cssText = `color:${k.color}; background:${k.bgColor === 'transparent' ? 'none' : k.bgColor}; padding:0 4px; border-radius:2px; margin-right:10px; flex:1;`;
    
    // 削除ボタン
    const delBtn = document.createElement('button');
    delBtn.textContent = "×";
    delBtn.style.cssText = "border:none; background:none; color:#999; cursor:pointer; font-weight:bold;";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      highlightSettings.customKeywords.splice(index, 1);
      saveSettings();
      renderKeywordList();
      applyCustomKeywordsOverlay();
    };

    row.appendChild(preview);
    row.appendChild(delBtn);
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (contextMenu) {
        contextMenu.dataset.editIndex = String(index);
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        contextMenu.classList.remove('hidden');
      }
    });
    highlightList.appendChild(row);
  });
}

// イベントリスナー設定
function setupEventListeners() {
  // 動的に要素を取得
  const syntaxBoldColor = document.getElementById('syntax-bold-color');
  const syntaxLinkColor = document.getElementById('syntax-link-color');
  const syntaxQuoteColor = document.getElementById('syntax-quote-color');
  const syntaxCodeColor = document.getElementById('syntax-code-color');
  const hlAddBtn = document.getElementById('hl-add-btn');
  const hlTextColor = document.getElementById('hl-text-color');
  const hlBgColor = document.getElementById('hl-bg-color');
  const hlBgTransparent = document.getElementById('hl-bg-transparent');
  
  // 標準カラーピッカー
  if(syntaxBoldColor) syntaxBoldColor.addEventListener('input', (e) => updateSyntaxColor('bold', e.target.value));
  if(syntaxLinkColor) syntaxLinkColor.addEventListener('input', (e) => updateSyntaxColor('link', e.target.value));
  if(syntaxQuoteColor) syntaxQuoteColor.addEventListener('input', (e) => updateSyntaxColor('quote', e.target.value));
  if(syntaxCodeColor) syntaxCodeColor.addEventListener('input', (e) => updateSyntaxColor('code', e.target.value));

  // カスタムキーワード追加（1行に1キーワードで複数登録）
  const hlKeywordsInput = document.getElementById('hl-keywords-input');
  if(hlAddBtn && hlKeywordsInput) {
    hlAddBtn.addEventListener('click', () => {
      const lines = (hlKeywordsInput.value || '').split(/\n/).map(s => s.trimStart()).filter(Boolean);
      if (lines.length === 0) return;

      const color = hlTextColor ? hlTextColor.value : '#ff0000';
      const isTransparent = hlBgTransparent ? hlBgTransparent.checked : true;
      const bgColor = isTransparent ? 'transparent' : (hlBgColor ? hlBgColor.value : '#ffffff');

      lines.forEach(word => {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        highlightSettings.customKeywords.push({ id, word, color, bgColor });
      });
      saveSettings();
      hlKeywordsInput.value = '';
      renderKeywordList();
      applyCustomKeywordsOverlay();
    });
  }

  // 右クリックで編集
  let editingKeywordIndex = -1;
  const hlContextMenu = document.getElementById('hl-context-menu');
  const hlEditForm = document.getElementById('hl-edit-form');
  const hlEditKeyword = document.getElementById('hl-edit-keyword');
  const hlEditTextColor = document.getElementById('hl-edit-text-color');
  const hlEditBgColor = document.getElementById('hl-edit-bg-color');
  const hlEditBgTransparent = document.getElementById('hl-edit-bg-transparent');
  const hlEditUpdateBtn = document.getElementById('hl-edit-update-btn');
  const hlEditCancelBtn = document.getElementById('hl-edit-cancel-btn');

  function showEditForm(index) {
    const k = highlightSettings.customKeywords[index];
    if (!k) return;
    editingKeywordIndex = index;
    if (hlEditKeyword) hlEditKeyword.value = k.word;
    if (hlEditTextColor) hlEditTextColor.value = k.color;
    if (hlEditBgColor) hlEditBgColor.value = k.bgColor === 'transparent' ? '#ffffff' : k.bgColor;
    if (hlEditBgTransparent) hlEditBgTransparent.checked = k.bgColor === 'transparent';
    if (hlEditForm) hlEditForm.classList.remove('hidden');
    if (hlContextMenu) hlContextMenu.classList.add('hidden');
  }

  function hideEditForm() {
    editingKeywordIndex = -1;
    if (hlEditForm) hlEditForm.classList.add('hidden');
  }

  if (hlEditUpdateBtn) {
    hlEditUpdateBtn.addEventListener('click', () => {
      if (editingKeywordIndex < 0) return;
      const word = hlEditKeyword ? (hlEditKeyword.value || '').replace(/^\s+/, '') : '';
      if (!word) return;
      const color = hlEditTextColor ? hlEditTextColor.value : '#ff0000';
      const isTransparent = hlEditBgTransparent ? hlEditBgTransparent.checked : true;
      const bgColor = isTransparent ? 'transparent' : (hlEditBgColor ? hlEditBgColor.value : '#ffffff');
      highlightSettings.customKeywords[editingKeywordIndex] = {
        ...highlightSettings.customKeywords[editingKeywordIndex],
        word,
        color,
        bgColor
      };
      saveSettings();
      renderKeywordList();
      applyCustomKeywordsOverlay();
      hideEditForm();
    });
  }
  if (hlEditCancelBtn) hlEditCancelBtn.addEventListener('click', hideEditForm);

  const hlContextMenuEdit = hlContextMenu ? hlContextMenu.querySelector('[data-action="edit"]') : null;
  if (hlContextMenuEdit) {
    hlContextMenuEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(hlContextMenu.dataset.editIndex, 10);
      if (!isNaN(idx)) showEditForm(idx);
      hlContextMenu.classList.add('hidden');
    });
  }

  document.addEventListener('click', () => {
    if (hlContextMenu && !hlContextMenu.classList.contains('hidden')) hlContextMenu.classList.add('hidden');
  });

  // カスタムハイライトの保存 (JSON)
  const hlExportBtn = document.getElementById('hl-export-btn');
  if (hlExportBtn) {
    hlExportBtn.addEventListener('click', async () => {
      const data = highlightSettings.customKeywords.map(k => ({ word: k.word, color: k.color, bgColor: k.bgColor }));
      const json = JSON.stringify(data, null, 2);
      const defaultFileName = 'KeyPale-CustomHighlight';
      if (window.myApi && window.myApi.saveFile) {
        await window.myApi.saveFile(json, true, 'json', defaultFileName);
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFileName + '.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  // カスタムハイライトの読込 (JSON)
  const hlImportBtn = document.getElementById('hl-import-btn');
  const hlImportInput = document.getElementById('hl-import-input');
  if (hlImportBtn && hlImportInput) {
    hlImportBtn.addEventListener('click', () => hlImportInput.click());
    hlImportInput.addEventListener('change', async () => {
      const file = hlImportInput.files[0];
      hlImportInput.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('配列形式のJSONが必要です');
        highlightSettings.customKeywords = data.map((item) => ({
          id: item.id != null ? String(item.id) : Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          word: String(item.word != null ? item.word : '') || '（未入力）',
          color: /^#[0-9A-Fa-f]{6}$/.test(item.color) ? item.color : '#ff0000',
          bgColor: item.bgColor === 'transparent' || item.bgColor === '' ? 'transparent' : (/^#[0-9A-Fa-f]{6}$/.test(item.bgColor) ? item.bgColor : '#ffffff')
        }));
        saveSettings();
        renderKeywordList();
        applyCustomKeywordsOverlay();
      } catch (err) {
        alert('JSONの読込に失敗しました: ' + (err.message || err));
      }
    });
  }
}

// 正規表現エスケープ
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}