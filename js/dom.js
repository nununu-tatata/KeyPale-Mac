// js/dom.js

export const els = {
  // ウィンドウ
  minBtn: document.getElementById('min-btn'),
  maxBtn: document.getElementById('max-btn'),
  closeBtn: document.getElementById('close-btn'),
  
  // エディタ
  editor: document.getElementById('editor'),
  preview: document.getElementById('preview-content'),
  defaultName: document.getElementById('default-name'),
  defaultLabel: document.getElementById('default-label'),
  
  // テーマ
  settingsBtn: document.getElementById('theme-panel-btn'), 
  settingsPanel: document.getElementById('settings-panel'),
  
  // メニュー
  appMenuBtn: document.getElementById('app-menu-btn'),
  appMenuDropdown: document.getElementById('app-menu-dropdown'),
  menuOptions: document.getElementById('menu-options'),
  menuSave: document.getElementById('menu-save'),
  menuSaveAs: document.getElementById('menu-save-as'),
  menuOpen: document.getElementById('menu-open'),
  menuNewTab: document.getElementById('menu-new-tab'),
  menuToggleSnippet: document.getElementById('menu-toggle-snippet'),
  menuToggleVariable: document.getElementById('menu-toggle-variable'),
  menuTogglePreview: document.getElementById('menu-toggle-preview'),
  menuSaveTekeyTab: document.getElementById('menu-save-tekey-tab'),
  menuSaveTekeyAll: document.getElementById('menu-save-tekey-all'),

  // オプションモーダル
  optionModal: document.getElementById('option-modal-overlay'),
  optionClose: document.getElementById('option-modal-close'),
  
  // 色設定
  pdParentColorPicker: document.getElementById('pd-parent-color-picker'),
  pdChildColorPicker: document.getElementById('pd-child-color-picker'),
  resetThemeBtn: document.getElementById('reset-theme-btn'),
  currentThemeName: document.getElementById('current-theme-name'),
  
  // ハイライト設定用
  syntaxBoldColor: document.getElementById('syntax-bold-color'),
  syntaxLinkColor: document.getElementById('syntax-link-color'),
  syntaxQuoteColor: document.getElementById('syntax-quote-color'),
  syntaxCodeColor: document.getElementById('syntax-code-color'),
  
  hlKeywordInput: document.getElementById('hl-keyword-input'),
  hlTextColor: document.getElementById('hl-text-color'),
  hlBgColor: document.getElementById('hl-bg-color'),
  hlBgTransparent: document.getElementById('hl-bg-transparent'),
  hlAddBtn: document.getElementById('hl-add-btn'),
  highlightList: document.getElementById('highlight-list'),

  // リスト関連
  snippetList: document.getElementById('snippet-list'),
  variableList: document.getElementById('variable-list'),
  addSnippetBtn: document.getElementById('open-add-snippet-btn'),
  addVariableBtn: document.getElementById('open-add-variable-btn'),
  exportVarBtn: document.getElementById('export-variable-btn'),
  variableGlobalSwitch: document.getElementById('variable-global-switch'),
  
  // リストメニュー
  snippetMenuBtn: document.getElementById('snippet-menu-btn'),
  snippetDropdown: document.getElementById('snippet-dropdown'),
  snippetImportItem: document.getElementById('snippet-import-item'),
  snippetExportItem: document.getElementById('snippet-export-item'),
  variableMenuBtn: document.getElementById('variable-menu-btn'),
  variableDropdown: document.getElementById('variable-dropdown'),
  variableImportItem: document.getElementById('variable-import-item'),
  variableExportItem: document.getElementById('variable-export-item'),
  fileImportInput: document.getElementById('file-import-input'),

  // 開閉・リサイズ
  snippetToggle: document.getElementById('snippet-toggle-btn'),
  variableToggle: document.getElementById('variable-toggle-btn'),
  previewToggle: document.getElementById('preview-toggle-btn'),
  container: document.getElementById('main-container'),
  snippetPane: document.getElementById('snippet-pane'),
  variablePane: document.getElementById('variable-pane'),
  editorPane: document.getElementById('editor-pane'),
  previewPane: document.getElementById('preview-pane'),
  snippetResizer: document.getElementById('snippet-resizer'),
  variableResizer: document.getElementById('variable-resizer'),
  previewResizer: document.getElementById('preview-resizer'),
  
  // ステータスバー
  cursorPosLabel: document.getElementById('cursor-pos-label'),
  charCountLabel: document.getElementById('char-count-label'),

  // モーダル
  modals: {
    snippet: {
      overlay: document.getElementById('snippet-modal-overlay'),
      title: document.getElementById('snippet-modal-title'),
      label: document.getElementById('snippet-modal-label'),
      content: document.getElementById('snippet-modal-content'),
      shortcut: document.getElementById('snippet-modal-shortcut'),
      save: document.getElementById('snippet-modal-save'),
      cancel: document.getElementById('snippet-modal-cancel')
    },
    variable: {
      overlay: document.getElementById('variable-modal-overlay'),
      title: document.getElementById('variable-modal-title'),
      key: document.getElementById('variable-modal-key'),
      value: document.getElementById('variable-modal-value'),
      shortcut: document.getElementById('variable-modal-shortcut'),
      save: document.getElementById('variable-modal-save'),
      cancel: document.getElementById('variable-modal-cancel')
    }
  },
  
  // その他
  snippetMenu: document.getElementById('snippet-context-menu'),
  ctxEdit: document.getElementById('ctx-edit'),
  ctxDelete: document.getElementById('ctx-delete'),
  colorCode: document.getElementById('default-color-code'),
  colorPicker: document.getElementById('default-color-picker'),
  paletteBtn: document.getElementById('palette-btn'),
  palettePopup: document.getElementById('color-palette-popup'),
  
  searchPanel: document.getElementById('search-panel'),
  searchInput: document.getElementById('search-input'),
  findPrev: document.getElementById('find-prev-btn'),
  findNext: document.getElementById('find-next-btn'),
  closeSearch: document.getElementById('close-search-btn'),
  replaceRow: document.getElementById('replace-row'),
  replaceInput: document.getElementById('replace-input'),
  replaceBtn: document.getElementById('replace-btn'),
  replaceAllBtn: document.getElementById('replace-all-btn'),
  
  fontSizeSlider: document.getElementById('font-size-slider'),
  fontSizeValue: document.getElementById('font-size-value'),
  lineHeightSlider: document.getElementById('line-height-slider'),
  lineHeightValue: document.getElementById('line-height-value'),
  bgToggleBtn: document.getElementById('bg-toggle-btn'),
  
  themeBtns: document.querySelectorAll('.theme-btn'),
  accentColorPicker: document.getElementById('accent-color-picker'),
  accentColorValue: document.getElementById('accent-color-value')
};