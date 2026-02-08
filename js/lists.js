// js/lists.js
// スニペットと変数のリスト管理

import { els } from './dom.js';

export const userVariables = {}; 
let savedSnippets = [];          
let savedManualVars = [];        

const defaultSnippets = [
  { label: 'ルビ振り', content: '|《》', shortcut: '' },
  { label: '改行', content: '\\n', shortcut: '' },
  { label: '親プルダウン', content: '###', shortcut: '' },
  { label: '子プルダウン', content: '####', shortcut: '' },
  { label: '名前変更', content: '@[name]:', shortcut: '' },
  { label: '全停止', content: '@全停止', shortcut: '' },
  { label: '立ち絵オフ', content: '@[portrait]:off', shortcut: '' },
  { label: 'タブ指定', content: '@[tab]:{タブ名}', shortcut: '' },
  { label: '秘話', content: '@[secret]:{ユーザー名}', shortcut: '' },
  { label: '白色文字', content: '@#FFFFFF', shortcut: '' },
  { label: '暗色文字', content: '@#424242', shortcut: '' }
];

// 動的に要素を取得するヘルパー（Golden Layout で生成される要素用）
function getEl(id) {
  return document.getElementById(id);
}

export function initLists(insertCallback, updatePreviewCallback, getContentCallback, focusCallback) {
  loadData();

  // 初期データ投入
  if (savedSnippets.length === 0) {
    savedSnippets = JSON.parse(JSON.stringify(defaultSnippets)); 
    saveData();
  }

  renderSnippets(insertCallback);

  // スニペットを初期に戻す（⋮メニューから呼ばれる）
  document.addEventListener('keypale-reset-snippets', () => {
    localStorage.removeItem('keypale_snippets');
    savedSnippets.length = 0;
    savedSnippets.push(...JSON.parse(JSON.stringify(defaultSnippets)));
    saveData();
    renderSnippets(insertCallback);
  });

  // 動的に要素を取得
  const snippetList = getEl('snippet-list');
  const variableList = getEl('variable-list');
  const addSnippetBtn = getEl('open-add-snippet-btn');
  const addVariableBtn = getEl('open-add-variable-btn');

  if(snippetList) setupDragAndDrop(snippetList);
  if(variableList) setupDragAndDrop(variableList);

  // 追加ボタン
  if(addSnippetBtn) {
    addSnippetBtn.onclick = () => {
      openModal(els.modals.snippet, (label, content, shortcut) => {
        savedSnippets.push({ label, content, shortcut: shortcut || '' });
        saveData();
        renderSnippets(insertCallback);
      });
    };
  }

  if(addVariableBtn) {
    addVariableBtn.onclick = () => {
      openModal(els.modals.variable, (key, value, shortcut) => {
        savedManualVars.push({ key, value, shortcut: shortcut || '' });
        saveData();
        userVariables[key] = value;
        renderVariables(getContentCallback ? getContentCallback() : '');
      });
    };
  }

  // 削除コールバック
  const deleteCallback = (type, index) => {
    if (type === 'snippet') {
      savedSnippets.splice(index, 1);
      saveData();
      renderSnippets(insertCallback);
    } else if (type === 'variable') {
      savedManualVars.splice(index, 1);
      saveData();
      renderVariables(getContentCallback ? getContentCallback() : '');
    }
  };
  
  // 編集コールバック
  const editCallback = (type, index) => {
    if (type === 'snippet') {
      const item = savedSnippets[index];
      if (!item) return;
      openEditModal(els.modals.snippet, item.label, item.content, item.shortcut || '', (label, content, shortcut) => {
        savedSnippets[index] = { label, content, shortcut: shortcut || '' };
        saveData();
        renderSnippets(insertCallback);
      });
    } else if (type === 'variable') {
      const item = savedManualVars[index];
      if (!item) return;
      openEditModal(els.modals.variable, item.key, item.value, item.shortcut || '', (key, value, shortcut) => {
        // 古いキーを削除
        delete userVariables[item.key];
        savedManualVars[index] = { key, value, shortcut: shortcut || '' };
        userVariables[key] = value;
        saveData();
        renderVariables(getContentCallback ? getContentCallback() : '');
      });
    }
  };
  
  setupContextMenu(deleteCallback, editCallback);
  
  if(els.exportVarBtn) {
    els.exportVarBtn.onclick = () => {
      let text = "";
      for (const [key, val] of Object.entries(userVariables)) {
        text += `//${key}=${val}\n`;
      }
      navigator.clipboard.writeText(text).then(() => {
        alert('現在の変数をクリップボードにコピーしました');
      });
    };
  }

  // ▼▼▼ ドロップダウンメニューの制御 (これが抜けていた) ▼▼▼
  
  // 1. スニペットメニュー
  if(els.snippetMenuBtn) {
    els.snippetMenuBtn.onclick = (e) => {
      e.stopPropagation();
      if(els.snippetDropdown) els.snippetDropdown.classList.toggle('hidden');
      if(els.variableDropdown) els.variableDropdown.classList.add('hidden');
    };
  }
  
  // 2. 変数メニュー
  if(els.variableMenuBtn) {
    els.variableMenuBtn.onclick = (e) => {
      e.stopPropagation();
      if(els.variableDropdown) els.variableDropdown.classList.toggle('hidden');
      if(els.snippetDropdown) els.snippetDropdown.classList.add('hidden');
    };
  }
  
  // 3. 外部クリックで閉じる
  document.addEventListener('click', (e) => {
    if(els.snippetDropdown && !els.snippetDropdown.contains(e.target) && e.target !== els.snippetMenuBtn) {
      els.snippetDropdown.classList.add('hidden');
    }
    if(els.variableDropdown && !els.variableDropdown.contains(e.target) && e.target !== els.variableMenuBtn) {
      els.variableDropdown.classList.add('hidden');
    }
  });

  // 4. メニューアイテムの動作
  if(els.snippetExportItem) {
    els.snippetExportItem.onclick = () => {
      exportJSON(savedSnippets, 'KeyPale-Snippets');
      els.snippetDropdown.classList.add('hidden');
    };
  }
  if(els.snippetImportItem) {
    els.snippetImportItem.onclick = () => {
      importJSON('keypale_snippets', (data) => {
        savedSnippets = data;
        saveData();
        renderSnippets(insertCallback);
      });
      els.snippetDropdown.classList.add('hidden');
    };
  }

  if(els.variableExportItem) {
    els.variableExportItem.onclick = () => {
      exportJSON(savedManualVars, 'KeyPale-Variables');
      els.variableDropdown.classList.add('hidden');
    };
  }
  if(els.variableImportItem) {
    els.variableImportItem.onclick = () => {
      importJSON('keypale_variables', (data) => {
        savedManualVars = Array.isArray(data) ? data.map(v => ({ ...v, shortcut: v.shortcut != null ? v.shortcut : '' })) : [];
        saveData();
        alert('変数を読み込みました。エディタ操作でリストが更新されます。');
      });
      els.variableDropdown.classList.add('hidden');
    };
  }
}

// --- JSON処理 ---
function exportJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importJSON(expectedType, callback) {
  const input = els.fileImportInput;
  if(!input) return;
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (Array.isArray(data)) {
          if(confirm('現在のリストを上書きして読み込みますか？')) {
            callback(data);
          }
        } else {
          alert('ファイル形式が正しくありません');
        }
      } catch (err) {
        alert('読み込みに失敗しました');
        console.error(err);
      }
      input.value = ''; 
    };
    reader.readAsText(file);
  };
  input.click(); 
}

// --- データ保存・読み込み ---
function loadData() {
  try {
    const sJson = localStorage.getItem('keypale_snippets');
    if (sJson) {
      const parsed = JSON.parse(sJson);
      savedSnippets = Array.isArray(parsed) ? parsed.map(s => ({ ...s, shortcut: s.shortcut != null ? s.shortcut : '' })) : [];
    }
    const vJson = localStorage.getItem('keypale_manual_vars');
    if (vJson) {
      const parsed = JSON.parse(vJson);
      savedManualVars = Array.isArray(parsed) ? parsed.map(v => ({ ...v, shortcut: v.shortcut != null ? v.shortcut : '' })) : [];
    }
  } catch (e) {
    console.error("Data Load Error:", e);
  }
}

/** ショートカットが設定されているスニペットの一覧（エディタでキー挿入用） */
export function getSnippetShortcuts() {
  return savedSnippets
    .filter(s => s.shortcut && String(s.shortcut).trim())
    .map(s => ({ shortcut: String(s.shortcut).trim(), content: s.content }));
}

/** ショートカットが設定されている変数の一覧（エディタで {key} 挿入用） */
export function getVariableShortcuts() {
  return savedManualVars
    .filter(v => v.shortcut && String(v.shortcut).trim())
    .map(v => ({ shortcut: String(v.shortcut).trim(), key: v.key }));
}

function saveData() {
  localStorage.setItem('keypale_snippets', JSON.stringify(savedSnippets));
  localStorage.setItem('keypale_manual_vars', JSON.stringify(savedManualVars));
}

// --- リスト描画 ---
function renderSnippets(insertCallback) {
  const snippetList = getEl('snippet-list');
  if(!snippetList) return;
  snippetList.innerHTML = '';
  savedSnippets.forEach((snip, index) => {
    const el = document.createElement('div');
    el.className = 'snippet-item';
    el.draggable = true;
    el.dataset.type = 'snippet';
    el.dataset.index = index;
    el.innerHTML = `
      <div class="snippet-text-container">
        <span class="snippet-label-text">${escapeHtml(snip.label)}</span>
        <span class="snippet-code-text">${escapeHtml(snip.content)}</span>
      </div>
    `;
    el.onclick = () => insertCallback(snip.content);
    setupItemEvents(el);
    snippetList.appendChild(el);
  });
}

export function renderVariables(text) {
  const variableList = getEl('variable-list');
  if(!variableList) return;
  for (const key in userVariables) delete userVariables[key];
  savedManualVars.forEach(v => { userVariables[v.key] = v.value; });

  const lines = (text || "").split(/\r?\n/);
  const editorVars = [];
  lines.forEach(line => {
    const match = line.trim().match(/^\/\/([^=]+)=(.+)/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      userVariables[key] = val; 
      editorVars.push({ key, value: val });
    }
  });

  variableList.innerHTML = '';
  savedManualVars.forEach((v, index) => createVariableElement(variableList, v.key, v.value, false, index));
  editorVars.forEach(v => createVariableElement(variableList, v.key, v.value, true, null));
}

function createVariableElement(variableList, key, value, isFromEditor, index) {
  const el = document.createElement('div');
  el.className = `variable-item ${isFromEditor ? 'from-editor' : ''}`;
  el.draggable = true;
  if (!isFromEditor) { el.dataset.type = 'variable'; el.dataset.index = index; }
  el.innerHTML = `<span class="variable-key">${escapeHtml(key)}</span><span class="variable-value">${escapeHtml(value)}</span>`;
  el.onclick = () => {
    if(window.cmInstance) { window.cmInstance.focus(); window.cmInstance.replaceSelection(`{${key}}`); }
  };
  setupItemEvents(el);
  variableList.appendChild(el);
}

// --- モーダル・イベント ---
function openModal(modalEls, onSave) {
  if(!modalEls.overlay) return;
  modalEls.overlay.classList.remove('hidden');
  if(modalEls.label) modalEls.label.value = "";
  if(modalEls.content) modalEls.content.value = "";
  if(modalEls.shortcut) modalEls.shortcut.value = "";
  if(modalEls.key) modalEls.key.value = "";
  if(modalEls.value) modalEls.value.value = "";
  
  // タイトル更新
  if(modalEls.title) {
    if(modalEls.label) modalEls.title.textContent = 'スニペット追加';
    else if(modalEls.key) modalEls.title.textContent = '変数追加';
  }
  
  modalEls.save.onclick = () => {
    if (modalEls.label && modalEls.content) {
      if(modalEls.label.value) onSave(modalEls.label.value, modalEls.content.value, modalEls.shortcut ? modalEls.shortcut.value.trim() : '');
    } else if (modalEls.key && modalEls.value) {
      if(modalEls.key.value) onSave(modalEls.key.value, modalEls.value.value, modalEls.shortcut ? modalEls.shortcut.value.trim() : '');
    }
    modalEls.overlay.classList.add('hidden');
  };
  modalEls.cancel.onclick = () => modalEls.overlay.classList.add('hidden');
}

// 編集用モーダル（スニペット・変数とも field3 にショートカット、onSave が5番目）
function openEditModal(modalEls, field1Value, field2Value, field3ValueOrOnSave, maybeOnSave) {
  const hasShortcut = !!modalEls.shortcut;
  const onSave = hasShortcut ? maybeOnSave : field3ValueOrOnSave;
  const shortcutValue = hasShortcut ? (field3ValueOrOnSave || '') : '';
  if(!modalEls.overlay) return;
  modalEls.overlay.classList.remove('hidden');
  
  // 既存の値をセット
  if(modalEls.label) modalEls.label.value = field1Value || "";
  if(modalEls.content) modalEls.content.value = field2Value || "";
  if(modalEls.shortcut) modalEls.shortcut.value = shortcutValue;
  if(modalEls.key) modalEls.key.value = field1Value || "";
  if(modalEls.value) modalEls.value.value = field2Value || "";
  
  // タイトル更新
  if(modalEls.title) {
    if(modalEls.label) modalEls.title.textContent = 'スニペット編集';
    else if(modalEls.key) modalEls.title.textContent = '変数編集';
  }
  
  modalEls.save.onclick = () => {
    if (modalEls.label && modalEls.content) {
      if(modalEls.label.value) onSave(modalEls.label.value, modalEls.content.value, modalEls.shortcut ? modalEls.shortcut.value.trim() : '');
    } else if (modalEls.key && modalEls.value) {
      if(modalEls.key.value) onSave(modalEls.key.value, modalEls.value.value, modalEls.shortcut ? modalEls.shortcut.value.trim() : '');
    }
    modalEls.overlay.classList.add('hidden');
  };
  modalEls.cancel.onclick = () => modalEls.overlay.classList.add('hidden');
}

function setupItemEvents(el) {
  el.addEventListener('dragstart', (e) => {
    let content = "";
    if (el.classList.contains('snippet-item')) {
      content = el.querySelector('.snippet-code-text').textContent;
    } else {
      content = `{${el.querySelector('.variable-key').textContent}}`;
    }
    e.dataTransfer.setData('text/plain', content);
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); window.showContextMenu(e, el); });
}

function setupDragAndDrop(listEl) {
  listEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(listEl, e.clientY);
    const draggable = document.querySelector('.dragging');
    if (draggable) {
      if (afterElement == null) listEl.appendChild(draggable);
      else listEl.insertBefore(draggable, afterElement);
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.draggable:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
    else return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function setupContextMenu(deleteCallback, editCallback) {
  const menu = document.getElementById('snippet-context-menu');
  const ctxEdit = document.getElementById('ctx-edit');
  const ctxDelete = document.getElementById('ctx-delete');
  
  document.addEventListener('click', () => { if(menu) menu.classList.add('hidden'); });
  let targetEl = null;
  
  window.showContextMenu = (e, el) => {
    if (el.classList.contains('from-editor')) return;
    targetEl = el;
    if(menu) { menu.style.top = `${e.clientY}px`; menu.style.left = `${e.clientX}px`; menu.classList.remove('hidden'); }
  };
  
  if(ctxEdit) {
    ctxEdit.onclick = () => {
      if(targetEl) {
        const type = targetEl.dataset.type; 
        const index = targetEl.dataset.index;
        if (type && index !== undefined) editCallback(type, parseInt(index, 10));
        if(menu) menu.classList.add('hidden');
      }
    };
  }
  
  if(ctxDelete) {
    ctxDelete.onclick = () => {
      if(targetEl) {
        const type = targetEl.dataset.type; 
        const index = targetEl.dataset.index;
        if (type && index !== undefined) deleteCallback(type, parseInt(index, 10));
        if(menu) menu.classList.add('hidden');
      }
    };
  }
}

function escapeHtml(string) {
  if(typeof string !== 'string') return string;
  return string.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
