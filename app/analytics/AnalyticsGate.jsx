'use client';

// app/analytics/AnalyticsGate.jsx — 認証付きデータゲート
//
// analytics_snapshots の id='latest' 行を anon キーで取得する。
// RLS により、analytics_viewers に登録済みのログインユーザーのみ実データが返る。
//
// ★ 壊れない設計:
//   - supabase が null（鍵未設定）           → ダミー表示
//   - テーブル未作成のエラー                 → ダミー表示
//   - 行が無い（Cron 未実行）                → ダミー表示
//   - 未ログイン / RLS で 0 件               → ダミー表示（控えめなログイン案内のみ）
//   - ネットワークエラー等                   → ダミー表示
//   いずれのケースも絶対にエラー画面やクラッシュにしない。

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import AnalyticsDashboard from './AnalyticsDashboard';

export default function AnalyticsGate() {
  const [data, setData] = useState(null);      // null = ダミー表示
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchSnapshot() {
      // supabase が null（鍵未設定）なら即ダミーへ
      if (!supabase) {
        setLoading(false);
        return;
      }

      // ログイン状態の確認（未ログインならダミー表示 + 案内を出す）
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) setIsLoggedIn(!!session?.user);
      } catch (_) {
        // getSession が失敗しても握りつぶす
      }

      // analytics_snapshots から最新スナップショットを取得
      try {
        const { data: row } = await supabase
          .from('analytics_snapshots')
          .select('payload, updated_at')
          .eq('id', 'latest')
          .maybeSingle(); // 行なし → null、エラー → .error に入る（destructure で無視）

        if (!cancelled && row?.payload && typeof row.payload === 'object') {
          setData(row.payload);
        }
      } catch (_) {
        // ネットワークエラー・テーブル未作成等を全て握りつぶしてダミーへ
      }

      if (!cancelled) setLoading(false);
    }

    fetchSnapshot();
    return () => { cancelled = true; };
  }, []);

  // ロード中: 最小限のスピナー（レイアウトを壊さない）
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-teal-400 border-t-transparent animate-spin" aria-label="読み込み中" />
      </div>
    );
  }

  return (
    <>
      {/* 未ログイン時のみ控えめな案内バー（実データ取得には認証が必要） */}
      {!isLoggedIn && !data && (
        <div className="w-full bg-teal-50 border-b border-teal-100 px-4 py-2 text-center">
          <p className="text-xs font-bold text-teal-600">
            実データの表示には自分のアカウントでのログインが必要です
          </p>
        </div>
      )}

      {/* data があれば実データ表示、無ければダミー表示（現状の見た目を完全維持） */}
      <AnalyticsDashboard data={data} />
    </>
  );
}
