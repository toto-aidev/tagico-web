// lib/auth.js — Supabase Auth 操作ラッパ
//
// Supabase が未設定（supabase === null）の場合は安全に早期リターンし、
// 未ログイン状態と同等に扱う（鍵投入前の環境でも動作継続）。
//
// 対応する認証フロー:
//   - メールマジックリンク（パスワード不要・モバイルフレンドリー）
//   - Google OAuth（ポップアップ → リダイレクト方式）
//   - サインアウト
//   - セッション取得（SSR-safe）
//   - Auth 状態変化リスナー（App.jsx でセッション管理に使う）

'use client';

import { supabase } from '@/lib/supabase';

// メールマジックリンク送信
// 送信成功後: ユーザーのメールに届くリンクをクリックするとログイン完了
// Supabase ダッシュボード → Authentication → Email Templates でメール文面を編集可
export async function signInWithEmail(email) {
  if (!supabase) return { error: 'Supabase 未設定（環境変数を確認してください）' };
  const { error } = await supabase.auth.signInWithOtp({ email });
  return { error };
}

// Google OAuth（ポップアップ → コールバックページにリダイレクト）
// Supabase ダッシュボード → Authentication → Providers → Google で設定が必要
export async function signInWithGoogle() {
  if (!supabase) return { error: 'Supabase 未設定（環境変数を確認してください）' };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  return { error };
}

// サインアウト（セッションをクリア）
export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// 現在のセッション取得（SSR-safe: window がなくても null を返す）
export async function getSession() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
  } catch {
    return null;
  }
}

// Auth 状態変化のリスナー登録
// callback は (session: Session | null) => void を受け取る
// 返り値は解除関数（useEffect のクリーンアップで呼ぶ）
export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  try {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return () => subscription.unsubscribe();
  } catch {
    return () => {};
  }
}
