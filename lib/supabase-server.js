// lib/supabase-server.js — service_role クライアント（サーバー専用）
//
// このファイルはサーバーサイド（API Route / Server Component）専用。
// クライアントバンドルに含めないこと（NEXT_PUBLIC_ を使っていないため自動的に除外される）。
//
// SUPABASE_SERVICE_ROLE_KEY は RLS をバイパスして analytics_snapshots へ書き込む。
// 鍵未設定（local dev / ステージング初期）の場合は null を返し、呼び出し元が skip できる設計。
// モジュールロード時に throw しない。

import { createClient } from '@supabase/supabase-js';

/**
 * service_role の Supabase クライアントを返す。
 * NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定なら null。
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: {
      // サーバー専用クライアント: Auth セッションは不要
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
