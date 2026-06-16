// FIXME(次フェーズ/C案): /analytics は本番データ配線の前に必ず Supabase Auth でアクセス制限を付けること。現状は noindex のみでアクセス制御は無い。

// app/analytics/page.jsx — Tagico 改善ダッシュボード（ダミーデータ・デザイン確認用）
// 外部 fetch なし・完全静的・npm 依存追加なし。チャートは自前 SVG/CSS のみ。

import AnalyticsDashboard from './AnalyticsDashboard';

export const metadata = {
  title: 'Tagico 改善ダッシュボード',
  description: 'Tagico の学習分析ダッシュボード（ダミーデータ）',
  robots: { index: false, follow: false },
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
