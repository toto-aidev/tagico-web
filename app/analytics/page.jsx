// app/analytics/page.jsx — Tagico 改善ダッシュボード
// Server Component のまま維持。実データの取得は AnalyticsGate（Client Component）が担う。
//
// アクセス制御方針:
//   - noindex で検索エンジン非掲載（現状維持）
//   - 実データ表示は analytics_viewers + Supabase RLS による制限（C案 Supabase 設定後に有効化）
//   - 未ログイン / 権限なし → ダミーデータを表示（クラッシュしない）
//
// FIXME(C案/設定後): Supabase のテーブルとRLSが設定済みであることを確認してから
//   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を Vercel に追加する。
//   それまでは AnalyticsGate が自動的にダミー表示にフォールバックする。

import AnalyticsGate from './AnalyticsGate';

export const metadata = {
  title: 'Tagico 改善ダッシュボード',
  description: 'Tagico の学習分析ダッシュボード',
  robots: { index: false, follow: false },
};

export default function AnalyticsPage() {
  return <AnalyticsGate />;
}
