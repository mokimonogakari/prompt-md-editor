# Prompt MD Editor

## 概要

生成AIのプロンプト作成に特化した、ブラウザ完結型のマークダウンエディタ。
テンプレート挿入・記法ツールバー・ライブプレビュー・.mdファイル出力に対応する。
サーバーへのデータ送信は一切なく、内容はブラウザのlocalStorageにのみ保存される。

公開URL: https://mokimonogakari.github.io/prompt-md-editor/

## 技術スタック

- HTML / CSS / Vanilla JavaScript（ビルド不要・静的サイト）
- [marked](https://github.com/markedjs/marked) v15.0.12 — Markdown→HTML変換（`js/vendor/` に同梱）
- [DOMPurify](https://github.com/cure53/DOMPurify) v3.2.6 — プレビューHTMLのサニタイズ（同上）
- ホスティング: GitHub Pages

## セットアップ

```bash
git clone https://github.com/mokimonogakari/prompt-md-editor.git
cd prompt-md-editor
python3 -m http.server 8000   # 任意のローカルサーバーでOK
# http://localhost:8000 を開く
```

ビルド・依存インストール・環境変数は不要。

## 環境変数

なし（完全静的サイトのため）。

## ディレクトリ構成

```
prompt-md-editor/
├── index.html          # 画面本体
├── css/
│   └── style.css       # スタイル一式
├── js/
│   ├── app.js          # エディタ・プレビュー・出力ロジック
│   ├── templates.js    # プロンプトテンプレート定義（ここに追記して拡張）
│   └── vendor/         # 同梱ライブラリ（marked / DOMPurify）
└── docs/
    ├── infrastructure.md  # インフラ構成図
    └── specification.md   # 仕様書
```

## デプロイ

`main` ブランチへの push で GitHub Pages（ブランチ配信、ルート `/`）が自動反映される。
特別なCI/CDはない。

## テンプレートの追加方法

`js/templates.js` の `PROMPT_TEMPLATES` 配列にオブジェクト（`id` / `label` / `body`）を
追加するだけで、画面のセレクトボックスに反映される。

## ライセンス

MIT License。同梱ライブラリのライセンスは各ファイルヘッダを参照
（marked: MIT / DOMPurify: Apache-2.0 or MPL-2.0）。
