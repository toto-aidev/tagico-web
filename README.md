# Tagico (Web)

多義語を、文脈から見分ける訓練。1単語あたり複数の意味＋1つの罠選択肢でテンポよく学べる、無料の英語トレーナー。

公開デプロイ用の Next.js (App Router) 版。コンテンツ制作は Tagico Studio（Electron・非公開ツール）で行い、本プロジェクトはその成果物（JSON）を焼き込んで配信する。

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

## コンテンツの更新手順（Studio → Web）

公開アプリは Studio と別オリジンのため localStorage を共有しない。コンテンツは
`data/content.json` に焼き込む方式。

1. Tagico Studio のエディタで編集する
2. エディタの「**エクスポート**」ボタンで `tagico-content.json` をダウンロード
3. それを `tagico-web/data/content.json` に上書きコピー

   ```bash
   cp ~/Downloads/tagico-content.json data/content.json
   ```

4. `npm run build`（ローカル確認は `npm run dev`）→ デプロイ

スキーマ（Studio と共通）:

- `levels: [{ id, name, label?, wordIds: [] }]`
- `words: [{ id, word, trap, senses[], coreImage, faces[], trivia? }]`
- `senses[]: { en, jpBefore, answer, jpAfter, jpFull, cue, hint? }`

## 学習進捗について

学習進捗（クリア状況・ブックマーク・ストリーク等）はユーザー端末の
localStorage キー `tagico-v2-state` に保存される（Studio 版とキー互換）。
サーバには何も送らない。

## デプロイ

- **Vercel（推奨）**: リポジトリを import するだけ。設定不要。
- **静的ホスティング**: `next.config.mjs` の `output: 'export'` を有効化 →
  `npm run build` → `out/` を配信（GitHub Pages / Cloudflare Pages 等）。

## Studio 版との差分

- React / Babel standalone / Tailwind の CDN 読み込みを全廃し、事前ビルドに変更
- `window.*` グローバル連携 → ES modules の import/export
- Google Fonts → `next/font`（セルフホスト・CLS なし）
- `?pc=1` の PC プレビュー切替 → 画面幅 1024px 以上で自動適用（`lg:` ブレークポイント）
- コンテンツの localStorage 上書き（`tagico-v2-content`）→ ビルトイン JSON（上記手順）
