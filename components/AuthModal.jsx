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
import Link from 'next/link';
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
              className="relative w-full flex items-center justify-center py-3 rounded-2xl border border-[#747775] bg-white text-[#1f1f1f] font-medium text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <img src="/google-g.png" alt="" aria-hidden="true" className="absolute left-3 h-5 w-5 object-contain" />
              Google でログイン
            </button>

            <p className="text-xs text-slate-400 text-center mt-4 leading-relaxed">
              続行することで<Link href="/legal/terms" className="font-bold text-teal-700 underline underline-offset-2">利用規約</Link>と<Link href="/legal/privacy" className="font-bold text-teal-700 underline underline-offset-2">プライバシーポリシー</Link>に同意したものとします。18歳未満の方は、保護者の同意を得てください。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
