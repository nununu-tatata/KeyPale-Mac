/**
 * golden-layout を1ファイルにバンドルするスクリプト
 * 実行: node build-golden-layout.js
 * 出力: golden-layout-bundle.js（プロジェクト直下）
 */
const esbuild = require('esbuild');
const path = require('path');

const entry = path.join(__dirname, 'node_modules', 'golden-layout', 'dist', 'esm', 'index.js');
const outfile = path.join(__dirname, 'golden-layout-bundle.js');

esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  outfile,
  platform: 'browser',
  target: ['es2020'],
  minify: false,
  sourcemap: false,
}).then(() => {
  console.log('OK: ' + outfile);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
