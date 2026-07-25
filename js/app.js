// Prompt MD Editor — エディタ本体。
// 依存: marked (js/vendor/marked.min.js), DOMPurify (js/vendor/purify.min.js), PROMPT_TEMPLATES (js/templates.js)
"use strict";

(() => {
  const STORAGE_KEY_CONTENT = "pme.content";
  const STORAGE_KEY_TITLE = "pme.title";
  const RENDER_DEBOUNCE_MS = 120;
  const SAVE_DEBOUNCE_MS = 500;

  const editor = document.getElementById("editor");
  const preview = document.getElementById("preview");
  const docTitle = document.getElementById("doc-title");
  const saveStatus = document.getElementById("save-status");
  const statChars = document.getElementById("stat-chars");
  const statLines = document.getElementById("stat-lines");

  marked.setOptions({ gfm: true, breaks: true });

  // ---------- プレビュー描画 ----------
  let renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, RENDER_DEBOUNCE_MS);
  }

  function renderPreview() {
    const dirty = marked.parse(editor.value);
    // XSS対策: 生成HTMLは必ずサニタイズしてから挿入する
    preview.innerHTML = DOMPurify.sanitize(dirty);
    updateStats();
  }

  function updateStats() {
    const text = editor.value;
    statChars.textContent = `${text.length.toLocaleString("ja-JP")} 文字`;
    statLines.textContent = `${text.split("\n").length.toLocaleString("ja-JP")} 行`;
  }

  // ---------- 自動保存 (localStorage) ----------
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToStorage, SAVE_DEBOUNCE_MS);
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_CONTENT, editor.value);
      localStorage.setItem(STORAGE_KEY_TITLE, docTitle.value);
      showSaveStatus("保存済み（このブラウザ内）");
    } catch (err) {
      console.error("localStorage save failed:", err);
      showSaveStatus("自動保存に失敗しました");
    }
  }

  let statusTimer = null;
  function showSaveStatus(message) {
    saveStatus.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { saveStatus.textContent = ""; }, 2000);
  }

  function restoreFromStorage() {
    try {
      editor.value = localStorage.getItem(STORAGE_KEY_CONTENT) || "";
      docTitle.value = localStorage.getItem(STORAGE_KEY_TITLE) || "";
    } catch (err) {
      console.error("localStorage restore failed:", err);
    }
  }

  // ---------- テキスト挿入ユーティリティ ----------
  function wrapSelection(before, after, placeholder) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const hadSelection = start !== end;
    const selected = hadSelection ? editor.value.slice(start, end) : placeholder;
    editor.setRangeText(before + selected + after, start, end, "end");
    if (!hadSelection) {
      // プレースホルダを選択状態にして書き換えやすくする
      editor.setSelectionRange(start + before.length, start + before.length + selected.length);
    }
    afterEdit();
  }

  function prefixLines(prefix, numbered) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = end === value.length ? end : (value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end));
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split("\n");
    const replaced = lines
      .map((line, i) => (numbered ? `${i + 1}. ${line}` : prefix + line))
      .join("\n");
    editor.setRangeText(replaced, lineStart, lineEnd, "end");
    afterEdit();
  }

  function insertBlock(text) {
    const start = editor.selectionStart;
    const value = editor.value;
    const needsLeadingNL = start > 0 && value[start - 1] !== "\n";
    editor.setRangeText((needsLeadingNL ? "\n" : "") + text, start, editor.selectionEnd, "end");
    afterEdit();
  }

  function afterEdit() {
    editor.focus();
    scheduleRender();
    scheduleSave();
  }

  // ---------- ツールバー ----------
  const ACTIONS = {
    h1: () => prefixLines("# "),
    h2: () => prefixLines("## "),
    h3: () => prefixLines("### "),
    bold: () => wrapSelection("**", "**", "太字"),
    italic: () => wrapSelection("*", "*", "斜体"),
    strike: () => wrapSelection("~~", "~~", "取り消し"),
    code: () => wrapSelection("`", "`", "code"),
    ul: () => prefixLines("- "),
    ol: () => prefixLines("", true),
    check: () => prefixLines("- [ ] "),
    quote: () => prefixLines("> "),
    codeblock: () => wrapSelection("```\n", "\n```\n", "ここにコード"),
    table: () => insertBlock("| 項目 | 内容 |\n| --- | --- |\n| A | ○ |\n| B | ○ |\n"),
    link: () => wrapSelection("[", "](https://)", "表示名"),
    hr: () => insertBlock("\n---\n\n"),
    xmltag: () => wrapSelection("<context>\n", "\n</context>", "ここに情報を貼る"),
  };

  document.getElementById("toolbar").addEventListener("click", (event) => {
    const action = event.target.closest("button")?.dataset.action;
    if (action && ACTIONS[action]) ACTIONS[action]();
  });

  // ---------- テンプレート ----------
  const templateSelect = document.getElementById("template-select");
  PROMPT_TEMPLATES.forEach((tpl) => {
    const option = document.createElement("option");
    option.value = tpl.id;
    option.textContent = tpl.label;
    templateSelect.appendChild(option);
  });

  templateSelect.addEventListener("change", () => {
    const tpl = PROMPT_TEMPLATES.find((t) => t.id === templateSelect.value);
    templateSelect.value = "";
    if (!tpl) return;
    if (editor.value.trim() === "") {
      editor.value = tpl.body;
    } else if (confirm("現在の内容を置き換えますか？\n（キャンセルすると末尾に追加します）")) {
      editor.value = tpl.body;
    } else {
      editor.value = editor.value.replace(/\n*$/, "\n\n") + tpl.body;
    }
    editor.setSelectionRange(editor.value.length, editor.value.length);
    afterEdit();
  });

  // ---------- .md ダウンロード ----------
  function buildFilename() {
    const title = docTitle.value.trim();
    // ファイル名に使えない文字・制御文字を除去し、空白はアンダースコアに（日本語はそのまま許可）
    const safe = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, "_").slice(0, 80);
    if (safe) return `${safe}.md`;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `prompt-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.md`;
  }

  function downloadMarkdown() {
    const blob = new Blob([editor.value], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildFilename();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showSaveStatus(`${anchor.download} を出力しました`);
  }

  document.getElementById("btn-download").addEventListener("click", downloadMarkdown);

  // ---------- コピー / 全消去 ----------
  document.getElementById("btn-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(editor.value);
      showSaveStatus("クリップボードにコピーしました");
    } catch (err) {
      console.error("clipboard copy failed:", err);
      showSaveStatus("コピーに失敗しました");
    }
  });

  document.getElementById("btn-clear").addEventListener("click", () => {
    if (!confirm("エディタの内容を全て消去します。よろしいですか？")) return;
    editor.value = "";
    afterEdit();
  });

  // ---------- 表示切り替え ----------
  const main = document.getElementById("main");
  const viewButtons = {
    "view-edit": "edit",
    "view-split": "split",
    "view-preview": "preview",
  };
  Object.entries(viewButtons).forEach(([id, mode]) => {
    document.getElementById(id).addEventListener("click", () => {
      main.className = `main ${mode}`;
      Object.keys(viewButtons).forEach((btnId) => {
        document.getElementById(btnId).classList.toggle("active", btnId === id);
      });
    });
  });

  // ---------- 記法ヘルプ ----------
  const helpPanel = document.getElementById("help-panel");
  document.getElementById("btn-help").addEventListener("click", () => {
    helpPanel.hidden = !helpPanel.hidden;
  });
  document.getElementById("btn-help-close").addEventListener("click", () => {
    helpPanel.hidden = true;
  });

  // ---------- キーボードショートカット / Tab ----------
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      editor.setRangeText("  ", editor.selectionStart, editor.selectionEnd, "end");
      afterEdit();
      return;
    }
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "b") { event.preventDefault(); ACTIONS.bold(); }
    if (key === "i") { event.preventDefault(); ACTIONS.italic(); }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      downloadMarkdown();
    }
  });

  editor.addEventListener("input", () => {
    scheduleRender();
    scheduleSave();
  });
  docTitle.addEventListener("input", scheduleSave);

  // ---------- 初期化 ----------
  restoreFromStorage();
  renderPreview();
})();
