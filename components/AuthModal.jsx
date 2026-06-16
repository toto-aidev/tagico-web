'use client';

// components/AuthModal.jsx — 任意ログインのモーダル UI
//
// 邪魔にならない設計:
//   - 背景オーバーレイをクリックで閉じられる
//   - メールマジックリンク（パスワード不要）または Google OAuth
//   - 送信後に「メールを確認してください」の確認メッセージを表示
//   - Supabase が未設定（鍵未投入）でも動くが「現在ご利用できません」と表示する
//
// props:
//   onClose: () => void — モーダルを閉じる
//   onSuccess?: (session) => void — ログイン完了後のコールバック（AuthStateChange が呼ぶため通常は不要）

import React, { useState } from 'react';
import Icon from '@/components/Icon';
import { signInWithEmail, signInWithGoogle } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function AuthModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    const { error } = await signInWithEmail(email.trim());
    if (error) {
      setErrorMsg(typeof error === 'string' ? error : 'エラーが発生しました。もう一度お試しください。');
      setStatus('error');
    } else {
      setStatus('sent');
    }
  };

  const handleGoogle = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      setErrorMsg(typeof error === 'string' ? error : 'Google ログインに失敗しました。');
      setStatus('error');
    }
    // Google OAuth は リダイレクトするのでここに戻ってこない
  };

  // Supabase 未設定の場合は設定手順を案内する
  if (!supabase) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tg-auth-title"
      >
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="tg-pop relative w-full max-w-sm bg-white rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.25)] border border-slate-100 p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="閉じる"
          >
            <Icon name="x" size={16} strokeWidth={2.5} />
          </button>
          <h2 id="tg-auth-title" className="text-lg font-black text-slate-800 mb-3 pr-8">
            現在ご利用できません
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            ログイン機能はまだ設定中です。setup-guide.md の手順に従って Supabase の鍵を設定してください。
          </p>
          <button
            onClick={onClose}
            className="w-full mt-5 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tg-auth-title"
    >
      {/* 背景オーバーレイ（クリックで閉じる） */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="tg-pop relative w-full max-w-sm bg-white rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.25)] border border-slate-100 p-6">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="閉じる"
        >
          <Icon name="x" size={16} strokeWidth={2.5} />
        </button>

        {status === 'sent' ? (
          /* 送信完了 */
          <div className="text-center py-2">
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-2xl bg-teal-100 text-teal-500">
              <Icon name="check-circle" size={28} />
            </div>
            <h2 className="text-lg font-black text-slate-800 mb-2">メールを確認してください</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              <span className="font-semibold text-slate-700">{email}</span> にログインリンクを送りました。メールのリンクをクリックするとログインできます。
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors"
            >
              閉じる
            </button>
          </div>
        ) : (
          <>
            <h2 id="tg-auth-title" className="text-lg font-black text-slate-800 mb-1 pr-8">
              進捗を保存する
            </h2>
            <p className="text-sm text-slate-500 mb-5 leading-relaxed">
              ログインすると学習進捗・復習の記録が端末をまたいで同期されます。ログインなしでも全機能を使えます。
            </p>

            {/* エラー表示 */}
            {status === 'error' && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm flex items-start gap-2">
                <Icon name="alert-triangle" size={16} className="mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* メールフォーム */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-teal-400 text-white font-black text-sm shadow-[0_4px_0_0_#14b8a6] active:shadow-[0_0px_0_0_#14b8a6] active:translate-y-[4px] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {status === 'sending' ? '送信中…' : 'ログイン用リンクをメールで送る'}
              </button>
            </form>

            {/* 区切り線 */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400 font-medium">または</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* Google ログイン */}
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              {/* Google SVG ロゴ（ライセンスフリー・ブランドガイドライン準拠形） */}
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                <path d="M3.964 10.705A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.705V4.963H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.037l3.007-2.332z" fill="#FBBC05" />
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.963L3.964 7.295C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
              </svg>
              Google でログイン
            </button>

            <p className="text-xs text-slate-400 text-center mt-4 leading-relaxed">
              ログインすることで個人情報は Supabase に安全に保管されます。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
