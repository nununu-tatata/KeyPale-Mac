# 開発者ツールで確認する項目

## 1. プレビュー「2行目が右に寄る」場合

### 1-1. 該当する行の HTML を確認する

1. 開発者ツールを開く（F12 または 右クリック → 検証）
2. **Elements**（要素）タブで、プレビュー欄の「窓に近づくと、」のあとにある **2行目** の要素をクリックして選ぶ
3. 次のどちらの形か確認する：

**期待する形（\n で改行している場合）**
```html
<div class="chat-line chat-line-grid" data-line="…">
  <span class="chat-name" style="grid-column:1;grid-row:1">KP：</span>
  <div class="chat-body-line" style="grid-column:2;grid-row:1">窓に近づくと、</div>
  <div class="chat-body-line chat-body-line-continue" style="grid-column:1 / -1;grid-row:2">ぼんやりと外が明るい。</div>
</div>
```
→ 1行目は「名前 + 本文」の2列。2行目は **1列目から始まる**（grid-column: 1 / -1 で名前と同じ左端から）

**別の形（実際の改行で分かれている場合）**
```html
<div class="chat-line">…<span class="chat-body">窓に近づくと、</span></div>
<div class="chat-line">…<span class="chat-body">ぼんやりと外が明るい。</span></div>
```
→ `.chat-line-grid` が付いておらず、`.chat-body-line` もない

- **期待する形でない** → エディタで「\n」が**バックスラッシュ + 英字 n の2文字**になっているか確認する（Enter の改行になっていないか）

---

### 1-2. 2行目要素に効いている CSS を確認する

1. 上で見つけた **2行目の** `.chat-body-line` を選択する
2. 右側の **Styles** パネルで、次の値を確認する：

| プロパティ | 期待する値 | 確認すること |
|-----------|------------|--------------|
| `padding-left` | 0 | 別の CSS で上書きされていないか |
| `margin-left` | 0 | 同上 |
| `text-indent` | 0 | 同上 |
| その要素の `style` または Computed の `grid-column` | 2 | 本文が2列目になっているか |
| その要素の `grid-row` | 2 | 2行目なら row 2 になっているか |

3. **Computed** タブを開き、同じ要素の `padding-left` / `margin-left` が **0px** になっているか確認する
4. 親の `.chat-line.chat-line-grid` を選び、**Styles** で次を確認する：
   - `display`: **grid** になっているか
   - `white-space`: **normal** になっているか（`pre-wrap` のままなら別の CSS が効いている）

---

### 1-3. 2行目の「文字」自体を確認する

1. Elements で 2行目の `.chat-body-line` を選んだ状態で、**中身のテキスト**を見る
2. 「ぼんやりと」の**直前**に、半角スペースや全角スペース（　）が入っていないか確認する
   - 入っている → 見た目が右に寄って見えるので、エディタで 2行目先頭のスペースを消すと揃う

---

## 2. パネルが2つになったり挙動がおかしい場合

### 2-1. 同じ種類のパネルがいくつあるか数える（Console が使えない場合）

**Elements の検索だけで確認する方法：**

1. **Elements** タブを開く
2. **Ctrl+F**（または Command+F）で検索ボックスを出し、次の文字列で検索する
3. 検索結果の**件数**を確認する（検索ボックスに「○ of △」のように出ます）：
   - `id="preview-content"` → **1 of 1** が正常（2 of 2 ならプレビューが2つ）
   - `id="variable-global-switch"` → **1 of 1** が正常（2 以上なら変数パネルが重複）
   - `id="dropdown-toc-list"` → **1 of 1** が正常
4. **Console にコマンドを貼れない場合**（Electron などで貼り付けが無効なことがあります）：
   - 上のように Elements の検索で件数を見る
   - または 1 行だけ手入力する：`document.querySelectorAll('[id="variable-global-switch"]').length` と打って Enter → 表示された数字が **1** なら正常

---

### 2-2. Golden Layout の DOM 構造を確認する

1. **Elements** で、`class="lm_root"` または `class="lm_items"` を検索する（Golden Layout のルート）
2. その中身を開いて、**縦に並んでいるパネル**（`.lm_stack` や `.lm_item`) の数を確認する
   - 左列に「プルダウン目次」「スニペット」「変数」がある場合、`.lm_stack` が 1 つで、その中に 3 つのタブがあるのが正常
   - 同じ名前のタブが**別の .lm_stack に2つ**ある → パネルが二重に追加されている

---

### 2-3. 非表示→表示の前後で Console エラーが出ていないか

1. **Console** タブを開いた状態にする
2. メニューから「〇〇を非表示」→「〇〇を表示」を数回繰り返す
3. その間に **赤いエラー** や **addPanel failed** などのメッセージが出ないか確認する
   - 出ている → そのメッセージとスタックをメモすると原因を絞りやすい

---

### 2-4. 退避したパネル（hiddenPanels）の状態を確認する（上級者向け）

1. ウィンドウメニューで **1 つ**パネルを「非表示」にする
2. **Console** で次を実行する（docking が読み込まれている前提）：
   ```javascript
   // 通常は参照できないため、addPanel を 1 回「表示」で呼んだ直後に
   // ブレークポイントを置いて hiddenPanels を見るか、
   // 暫定的に window.__hiddenPanels を docking.js で export していれば確認可能
   ```
   - コード側で `hiddenPanels` を一時的に `window.__hiddenPanels = hiddenPanels` のように公開している場合、非表示後に `window.__hiddenPanels` の中身（どの componentType が退避されているか）を確認できる

---

## 3. 報告するときにあると助かる情報

- **プレビュー**：「2行目が右に寄る」行の、Elements で選択した **HTML のスクショ** またはコピー
- **プレビュー**：その `.chat-body-line` の **Computed** の `padding-left` / `margin-left` の値
- **パネル**：`id="variable-global-switch"` などの検索結果が **2 以上**だった場合の、Elements の該当部分のスクショ
- **Console**：非表示・表示の操作中に出た **エラー全文**（スタックトレース付き）
