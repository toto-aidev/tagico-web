-- analytics-setup.sql
-- Supabase SQL Editor で実行する。2テーブル + RLS ポリシーを作成する。
-- 冪等（何度実行しても同じ結果になる）設計。

-- ─── analytics_snapshots ──────────────────────────────────────────
-- Cron が毎日1回 upsert する "latest" 行を保持するテーブル。
-- service_role（Cron）が RLS をバイパスして書き込む。
-- 読み取りは analytics_viewers に登録されたユーザーのみ許可。

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id         text PRIMARY KEY DEFAULT 'latest',
  payload    jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- 閲覧者テーブルに登録されたユーザーのみ SELECT を許可
CREATE POLICY "analytics_viewers can read snapshots"
  ON analytics_snapshots
  FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM analytics_viewers)
  );

-- ─── analytics_viewers ───────────────────────────────────────────
-- /analytics にアクセスできるユーザーの UUID を管理するテーブル。
-- 書き込みは service_role が RLS をバイパスするため、一般ユーザー用ポリシーは不要。

CREATE TABLE IF NOT EXISTS analytics_viewers (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE
);

ALTER TABLE analytics_viewers ENABLE ROW LEVEL SECURITY;

-- 自分の行のみ SELECT 可（他ユーザーの閲覧者リストは見えない）
CREATE POLICY "viewers can read own row"
  ON analytics_viewers
  FOR SELECT
  USING (auth.uid() = user_id);

-- ─── 閲覧者の追加 ────────────────────────────────────────────────
-- あなたの UUID を閲覧許可に追加:
--   1. Supabase ダッシュボード → Authentication → Users からコピー
--   2. 下の <UUID> を置き換えて実行する
--
-- INSERT INTO analytics_viewers(user_id) VALUES ('<UUID>');
