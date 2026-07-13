# Tagico (Web)

多義語を、文脈から見分ける訓練。1単語あたり複数の意味＋1つの罠選択肢でテンポよく学べる、無料の英語トレーナー。

公開デプロイ用の Next.js (App Router) 版。コンテンツは `tagico-web/data/content.json` に焼き込んで配信する。

by **toto** ([@toto_aidev](https://x.com/toto_aidev))

## 構成

```
tagico-web/
├── app/
│   ├── layout.jsx        # メタデータ・next/font（Outfit / Noto Sans JP / JetBrains Mono）
│   ├── page.jsx          # エントリ（App を描画）
│   ├── globals.css       # Tailwind + アニメーション + PC幅レイアウト
│   └── icon.svg          # ファビコン
├── components/
│   ├── App.jsx           # ルーター（state 1個で画面遷移）
│   ├── Home.jsx          # ホーム（クエスト）/ 単語帳
│   ├── Quiz.jsx          # クイズ / 結果
│   ├── Extra.jsx         # マイ単語帳 / 統計
│   ├── Summary.jsx       # 用法まとめ / ブックマーク / ボトムナビ
│   └── Icon.jsx          # lucide 互換の最小アイコンセット
├── lib/
│   ├── content.js        # コンテンツ読み込み（data/content.json を import）
│   └── store.js          # 進捗の永続化（localStorage 'tagico-v2-state'）
└── data/
    └── content.json      # 多義語データ（words / levels）— コンテンツの正本
```

## 開発・ビルド

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 本番ビルド
npm run start   # 本番サーバ起動
```

## コンテンツの更新

`tagico-web/data/content.json` を直接編集し、ビルド・デプロイする。

スキーマ:

- `levels: [{ id, name, label?, wordIds: [] }]`
- `words: [{ id, word, trap, senses[], coreImage, faces[], trivia? }]`
- `senses[]: { en, jpBefore, answer, jpAfter, jpFull, cue, hint? }`

## データ保存とプライバシー

学習進捗（クリア状況・ブックマーク・ストリーク等）は、まずユーザー端末の
localStorage キー `tagico-v2-state` に保存する。任意ログインを利用した場合は、
別端末同期のためSupabaseにも保存する。

Vercel Web AnalyticsとPostHogは、利用者が明示的に同意した後だけ初期化する。
同意前は分析用の識別子を作成・送信せず、設定は
`tagico.analytics.consent-v1` に保存する。公開時は法務ページと実装を同時に更新すること。

## デプロイ

- **Vercel（推奨）**: リポジトリを import するだけ。設定不要。
- **静的ホスティング**: `next.config.mjs` の `output: 'export'` を有効化 →
  `npm run build` → `out/` を配信（GitHub Pages / Cloudflare Pages 等）。
