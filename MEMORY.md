# MEMORY.md — セッション間の学び

- 2026-07-25 初版作成（Fable 5）。完全静的構成・ライブラリはjs/vendor/同梱・CDN不使用。CSPはmetaタグで設定。
- テンプレート追加は js/templates.js の PROMPT_TEMPLATES に追記するだけ（app.jsの変更不要）。
- デプロイはmainへのpushのみ（Pages legacy build, branch=main, path=/）。CI/CDなし。
