# Analytics ダッシュボード 導入チェックリスト

/analytics に実データを流すための初期設定手順。
**秘密鍵（API Key / service_role / CRON_SECRET）はリポジトリやクライアントに絶対に置かない。**

---

## (1) PostHog Personal API Key を取得する

1. PostHog（https://us.posthog.com）にログインする
2. 左サイドバー → **Settings** → **Personal API keys** を開く
3. **Create personal API key** をクリック
4. 名前（例: `tagico-cron`）を入力し、スコープは **Query read** だけ選択（最小権限）
5. 生成されたキーをコピーして次のステップで使う

---

## (2) Vercel 環境変数に鍵を追加する

Vercel ダッシュボード → tagico-web プロジェクト → **Settings** → **Environment Variables** を開き、  
以下の3変数を **Production と Preview の両方に** 追加する。

| 変数名 | 値 | 注意 |
|---|---|---|
| `POSTHOG_PERSONAL_API_KEY` | 上でコピーしたキー | NEXT_PUBLIC_ を付けない（サーバー専用） |
| `CRON_SECRET` | 任意の長い文字列（例: `openssl rand -hex 32` で生成） | NEXT_PUBLIC_ を付けない |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role キー | NEXT_PUBLIC_ を付けない（RLS をバイパスする強力な鍵）|

- `SUPABASE_SERVICE_ROLE_KEY` はクライアント（ブラウザ）に絶対に露出させない。
- `NEXT_PUBLIC_` 接頭辞を付けるとクライアントバンドルに含まれてしまう。
- 変数を追加したら Vercel でリデプロイが必要（Redeploy ボタン）。

---

## (3) Supabase でテーブルを作成する

1. Supabase ダッシュボード → プロジェクトを開く → 左サイドバー **SQL Editor**
2. `docs/analytics-setup.sql` の内容をコピーして貼り付け → **Run** を実行する
3. `analytics_snapshots` と `analytics_viewers` の2テーブルが作成され RLS が有効になる

---

## (4) 自分の UUID を analytics_viewers に追加する

**UUID の調べ方：**

1. Supabase ダッシュボード → **Authentication** → **Users**
2. 自分のメールアドレスの行を探し、**User UID** 列の UUID をコピー

**追加方法（SQL Editor で実行）：**

```sql
INSERT INTO analytics_viewers(user_id) VALUES ('ここにUUIDを貼り付け');
```

これで /analytics にログイン状態でアクセスすると実データが表示される。

---

## (5) Cron の動作確認

**自動実行：** 毎日 JST 18:30（UTC 09:30）に Vercel Cron が自動で叩く。

**手動確認：**

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://tagico-web-git-dev-toto-aidevs-projects.vercel.app/api/cron/analytics
```

成功すると `{"ok":true, "generatedAt":"...", "counts":{...}}` が返る。

| レスポンス | 意味 |
|---|---|
| `{"ok":true}` | 成功。Supabase に保存された |
| `{"skipped":true}` | 鍵未設定（dev 環境）。問題なし |
| `{"ok":false}` | Supabase 書き込みエラー。テーブル未作成の可能性あり |
| 401 | CRON_SECRET が合っていない |

---

## 注意事項

- `POSTHOG_PERSONAL_API_KEY` は PostHog にアクセスできるサーバー側でのみ使う。絶対にリポジトリに commit しない。
- `SUPABASE_SERVICE_ROLE_KEY` は Row Level Security をバイパスする強力な鍵。Git 管理外で保管する。
- **⚠️ `CRON_SECRET` は必ず設定する。** 未設定だと `/api/cron/analytics` が **無認証で誰でも叩ける公開エンドポイント** になり、外部からの連打で PostHog のクエリ用クォータを消費させられる恐れがある。route 側は「CRON_SECRET が設定されている時だけ Authorization ヘッダを検証する」実装なので、`POSTHOG_PERSONAL_API_KEY` を入れるなら **CRON_SECRET も必ずセットで** 設定すること。値は長くランダムに（`openssl rand -hex 32`）。
- Vercel Cron（Hobby プラン）は **1ジョブにつき最短1日1回** まで（本構成は毎日1回なので無料の Hobby でそのまま動く）。1日に複数回更新したくなった場合のみ Pro（$20/月）が必要。

---

## トラブルシューティング

| 症状 | 確認箇所 |
|---|---|
| /analytics がダミーのまま | Supabase に行がある？ → SQL Editor で `SELECT * FROM analytics_snapshots;` 確認 |
| Cron が 401 を返す | `CRON_SECRET` の値が Vercel 環境変数と curl コマンドで一致しているか確認 |
| Supabase に保存されるが /analytics に実データが出ない | `analytics_viewers` に自分の UUID が入っているか確認。ログインしているか確認 |
| `{"ok":false}` でテーブルが無いエラー | `analytics-setup.sql` を SQL Editor で実行済みか確認 |
