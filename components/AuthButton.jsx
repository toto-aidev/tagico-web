'use client';

// components/AuthButton.jsx — ホームヘッダー右上の最小ログインボタン
//
// 未ログイン時: 「保存」の小ボタン → AuthModal を開く
// ログイン中:  メールの頭文字アバター → タップで AccountSheet を開く
//
// props:
//   session: Session | null — Supabase セッション（null = 未ログイン）
//   onLogin: () => void — ボタンを押したら AuthModal を開く
//   onOpenAccount: () => void — アバタータップで AccountSheet を開く（ログイン中のみ）

import React from 'react';

export default function AuthButton({ session, onLogin, onOpenAccount }) {
  if (!session) {
    // 未ログイン: 「保存」ボタン
    return (
      <button
        onClick={onLogin}
        aria-label="進捗を保存（ログイン）"
        className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-white shadow-sm border border-slate-100 text-teal-500 hover:text-teal-600 hover:border-teal-200 active:scale-95 transition-all text-xs font-bold"
      >
        {/* クラウド保存のシンプルなアイコン（SVG インライン） */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2a6 6 0 0 1 5.664 4.01A4.5 4.5 0 1 1 16.5 15H6a4 4 0 1 1 .5-7.97A6 6 0 0 1 12 2z" />
        </svg>
        保存
      </button>
    );
  }

  // ログイン中: 頭文字アバター → タップで AccountSheet を開く
  const userEmail = session.user?.email || '';
  const initial = userEmail ? userEmail[0].toUpperCase() : '?';

  return (
    <button
      onClick={onOpenAccount}
      aria-label={`ログイン中: ${userEmail}（タップでアカウント情報を表示）`}
      className="w-9 h-9 flex items-center justify-center rounded-full bg-teal-400 text-white text-xs font-black shadow-sm active:scale-95 transition-all"
    >
      {initial}
    </button>
  );
}
