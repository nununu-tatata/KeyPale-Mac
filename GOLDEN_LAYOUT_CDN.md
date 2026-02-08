# Golden Layout 2.6.0 — 正しい CDN パス（jsDelivr）

**注意:** このパッケージには `goldenlayout.min.js` のような UMD バンドルは**ありません**。利用できるのは ESM と CJS のみです。

## 存在するファイル（確認済み）

### JavaScript（ESM・ブラウザでは import で使用）
| 用途 | URL |
|------|-----|
| ESM エントリ | `https://cdn.jsdelivr.net/npm/golden-layout@2.6.0/dist/esm/index.js` |

### CSS
| 用途 | URL |
|------|-----|
| ベース | `https://cdn.jsdelivr.net/npm/golden-layout@2.6.0/dist/css/goldenlayout-base.css` |
| ダークテーマ | `https://cdn.jsdelivr.net/npm/golden-layout@2.6.0/dist/css/themes/goldenlayout-dark-theme.css` |
| ライトテーマ | `https://cdn.jsdelivr.net/npm/golden-layout@2.6.0/dist/css/themes/goldenlayout-light-theme.css` |
| ボーダーレスダーク | `https://cdn.jsdelivr.net/npm/golden-layout@2.6.0/dist/css/themes/goldenlayout-borderless-dark-theme.css` |
| ソーダ | `https://cdn.jsdelivr.net/npm/golden-layout@2.6.0/dist/css/themes/goldenlayout-soda-theme.css` |
| トランスルーセント | `https://cdn.jsdelivr.net/npm/golden-layout@2.6.0/dist/css/themes/goldenlayout-translucent-theme.css` |

### 存在しないパス（404 になる）
- `.../dist/goldenlayout.min.js` — 配布されていない
- `.../dist/goldenlayout.js` — 同様になし

## 使い方の例
- **ESM**: `import { GoldenLayout } from 'https://cdn.jsdelivr.net/npm/golden-layout@2.6.0/dist/esm/index.js'` または動的 `import(...)` で上記 URL を指定
- **CSS**: `<link rel="stylesheet" href="上記のCSSのURL">`
