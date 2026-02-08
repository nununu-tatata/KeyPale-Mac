// js/parser.js
// Tekey構文の解析ロジック

/** @param {Object} [options] @param {boolean} [options.showEffectNotation] 演出表記（@の後の[name]:/#以外）を薄い色で表示する */
export function parseTekeySyntax(text, externalVariables = {}, options = {}) {
  if (!text) return "";
  const showEffectNotation = !!options.showEffectNotation;

  let mergedVariables = new Map(Object.entries(externalVariables));

  const lines = text.split(/\r?\n/);
  lines.forEach(line => {
    const match = line.trim().match(/^\/\/([^=]+)=(.+)/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      if (key) mergedVariables.set(key, val);
    }
  });

  let processedText = text;
  const sortedKeys = Array.from(mergedVariables.keys()).sort((a, b) => b.length - a.length);
  
  sortedKeys.forEach(key => {
    const val = mergedVariables.get(key);
    const pattern = new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g');
    processedText = processedText.replace(pattern, val);
  });

  const processedLines = processedText.split(/\r?\n/);
  let html = '';

  // プルダウンは2つセットで有効。閉じは「直前に開いた同じ種類」とペア（LIFO）
  const pairedLines = new Set();
  const parentOpenStack = [];
  const childOpenStack = [];
  processedLines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('# ')) return;
    if (t === '###') {
      if (parentOpenStack.length > 0) {
        const openIdx = parentOpenStack.pop();
        pairedLines.add(openIdx);
        pairedLines.add(i);
      }
      return;
    }
    if (t === '####') {
      if (childOpenStack.length > 0) {
        const openIdx = childOpenStack.pop();
        pairedLines.add(openIdx);
        pairedLines.add(i);
      }
      return;
    }
    if (/^###(?!#)\s*.+/.test(t)) parentOpenStack.push(i);
    else if (/^####(?!#)\s*.+/.test(t)) childOpenStack.push(i);
  });

  let inParent = false;
  let inChild = false;

  // 動的に要素を取得
  const defaultNameEl = document.getElementById('default-name');
  const colorCodeEl = document.getElementById('default-color-code');
  const globalName = defaultNameEl ? defaultNameEl.value : "KP";
  const globalColor = colorCodeEl ? colorCodeEl.value : "#FFFFFF";

  processedLines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('# ')) return;

    if (trimmedLine === '###') {
      if (pairedLines.has(lineIndex) && inParent) {
        html += '</details>';
        inParent = false;
      } else if (!pairedLines.has(lineIndex)) {
        html += `<div class="chat-line"><span class="chat-body">${escapeHtml(line)}</span></div>`;
      }
      return;
    }

    if (trimmedLine === '####') {
      if (pairedLines.has(lineIndex) && inChild) {
        html += '</details>';
        inChild = false;
      } else if (!pairedLines.has(lineIndex)) {
        html += `<div class="chat-line"><span class="chat-body">${escapeHtml(line)}</span></div>`;
      }
      return;
    }

    const childStart = trimmedLine.match(/^####(?!#)\s*(.+)/);
    if (childStart) {
      if (pairedLines.has(lineIndex)) {
        if (inChild) { html += '</details>'; inChild = false; }
        const title = escapeHtml(childStart[1]);
        html += `<details class="tekey-child" open><summary>${title}</summary>`;
        inChild = true;
      } else {
        html += `<div class="chat-line"><span class="chat-body">${escapeHtml(line)}</span></div>`;
      }
      return;
    }

    const parentStart = trimmedLine.match(/^###(?!#)\s*(.+)/);
    if (parentStart) {
      if (pairedLines.has(lineIndex)) {
        if (inParent) { html += '</details>'; inParent = false; }
        const title = escapeHtml(parentStart[1]);
        html += `<details class="tekey-parent" open><summary>${title}</summary>`;
        inParent = true;
      } else {
        html += `<div class="chat-line"><span class="chat-body">${escapeHtml(line)}</span></div>`;
      }
      return;
    }

    if (!trimmedLine) { 
        html += '<div class="chat-line" style="height:1em;"></div>'; 
        return; 
    }
    
    let content = line; 
    let name = globalName; 
    let color = globalColor;
    const effectParts = [];

    // 末尾の @ コマンドを連結対応で解析（@[name]:値 / @#RRGGBB / @演出名 など。演出はスペース含む ex: @03 Vagabond）
    const trailingRegex = /(@(?:\[name\]:[^@]*|#[a-fA-F0-9]{6}|[^@]+))+\s*$/;
    const commandMatch = content.match(trailingRegex);
    if (commandMatch) {
      const contentEnd = commandMatch.index;
      // \n+スペース+@コマンド のときも改行するため、trimEnd は使わず末尾の空白はそのまま
      content = content.substring(0, contentEnd);
      const fullCommand = commandMatch[0];
      const commandStrings = fullCommand.match(/@(?:\[name\]:[^@]*|#[a-fA-F0-9]{6}|[^@]+)/g) || [];
      commandStrings.forEach(cmd => {
        if (cmd.startsWith('@[name]:')) {
          name = cmd.replace(/^@\[name\]:/, ''); // スペースは省略しない
        } else if (cmd.match(/^@#[a-fA-F0-9]{6}$/i)) {
          color = cmd.slice(1); // #RRGGBB のみ（@ を除く）
        } else {
          effectParts.push(cmd);
        }
      });
    }

    content = escapeHtml(content);
    name = escapeHtml(name);
    const effectDisplay = effectParts.join(' ');
    const isHrLine = /^[―\-]+$/.test(content.trim());

    content = content.replace(/\|(.*?)(?:《(.*?)(?:》|$)|([\(（])(.*?)(?:[\)）]|$))/g, (match, p1, p2, paren, p3) => {
        const reading = p2 || p3;
        return `<ruby>${p1}<rt>${reading}</rt></ruby>`;
    });

    // コマンド未使用の行はここで \n を <br> に（コマンドありの行は上で既に置換済み）
    content = content.replace(/\\n/g, '<br>');
    content = content.replace(/\{([^}]+)\}/g, '<span class="tekey-variable">{$1}</span>');

    const styleAttr = color ? `style="color: ${color};"` : '';
    const namePart = `<span class="chat-name">${name ? escapeHtml(name) : ''}：</span>`;
    const effectSpan = showEffectNotation && effectDisplay
      ? ` <span class="tekey-effect-notation">${escapeHtml(effectDisplay)}</span>`
      : '';
    // Tekey 仕様: \n 改行後も左寄せ。1行目は「名前 + 本文」、2行目以降は「名前から始まる所」（1列目）から始める（grid の両列をまたぐ）
    const segments = content.split('<br>');
    const nameText = name ? escapeHtml(name) : '';
    const nameWithColon = nameText ? `${nameText}：` : '：';
    const blockClass = isHrLine ? 'chat-body-block tekey-hr' : 'chat-body-block';
    let gridRowsHtml = '';
    segments.forEach((seg, i) => {
      const row = i + 1;
      const lineContent = i === 0 && effectSpan ? `${seg}${effectSpan}` : seg;
      if (i === 0) {
        gridRowsHtml += `<span class="chat-name" style="grid-column:1;grid-row:${row}">${nameWithColon}</span>`;
        gridRowsHtml += `<div class="chat-body-line" style="grid-column:2;grid-row:${row}">${lineContent}</div>`;
      } else {
        gridRowsHtml += `<div class="chat-body-line chat-body-line-continue" style="grid-column:1 / -1;grid-row:${row}">${lineContent}</div>`;
      }
    });
    html += `<div class="chat-line chat-line-grid ${blockClass}" data-line="${lineIndex}" ${styleAttr}>${gridRowsHtml}</div>`;
  });

  if (inChild) html += '</details>';
  if (inParent) html += '</details>';

  return html;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(string) {
  if(typeof string !== 'string') return string;
  return string.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}