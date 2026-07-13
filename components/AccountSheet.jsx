'use client';

// components/AccountSheet.jsx — ログイン中ユーザーのアカウント情報シート
//
// AuthButton のアバターをタップすると開く。
// AuthModal と同系統の UI（同じモーダル構造・トーン・カードスタイル）。
//
// 表示項目:
//   1. ログイン中のニックネーム（未設定ならメールアドレス）+ アバター（ニックネームの頭文字）
//   2. 同期状態（Supabase user_progress.updated_at から最終同期日時）
//   3. ニックネーム設定（入力欄 + 保存ボタン）
//   4. Google アカウント連携（連携済み / 未連携 の表示と操作ボタン）
//   5. ログアウトボタン
//
// props:
//   session: Session — Supabase セッション（null の場合は何も表示しない）
//   onLogout: () => Promise<void> — flush → signOut → clear の順序を担保する非同期コールバック（App.jsx 実装）
//   onClose: () => void — シートを閉じる

import React, { useState, useEffect } from 'react';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';

export default function AccountSheet({ session, onLogout, onClose }) {
  const [syncStatus, setSyncStatus] = useState('loading'); // 'loading' | 'synced' | 'fallback'
  const [lastSyncedAt, setLastSyncedAt] = useState(null); // Date | null
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ニックネーム
  const [nickname, setNickname] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameSaved, setNicknameSaved] = useState(false); // 一時的な保存完了表示
  const [nicknameError, setNicknameError] = useState('');

  // Google 連携
  const [googleLinking, setGoogleLinking] = useState(false);
  const [googleLinkError, setGoogleLinkError] = useState('');
  const [googleUnlinking, setGoogleUnlinking] = useState(false);

  // ユーザーメタデータからニックネームを初期化
  useEffect(() => {
    if (session?.user?.user_metadata?.nickname) {
      setNickname(session.user.user_metadata.nickname);
    }
  }, [session]);

  // 最終同期日時を Supabase から取得
  useEffect(() => {
    if (!session || !session.user) {
      setSyncStatus('fallback');
      return;
    }
    if (!supabase) {
      setSyncStatus('fallback');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_progress')
          .select('updated_at')
          .eq('user_id', session.user.id)
          .single();
        if (cancelled) return;
        if (error || !data || !data.updated_at) {
          setSyncStatus('fallback');
        } else {
          setLastSyncedAt(new Date(data.updated_at));
          setSyncStatus('synced');
        }
      } catch {
        if (!cancelled) setSyncStatus('fallback');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // ニックネームを auth user_metadata に保存
  const handleNicknameSave = async () => {
    if (!supabase) {
      setNicknameError('保存できませんでした（接続エラー）');
      return;
    }
    setNicknameSaving(true);
    setNicknameError('');
    setNicknameSaved(false);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { nickname: nickname.trim() },
      });
      if (error) {
        setNicknameError('保存に失敗しました。もう一度お試しください。');
      } else {
        setNicknameSaved(true);
        setTimeout(() => setNicknameSaved(false), 2500);
      }
    } catch {
      setNicknameError('保存に失敗しました。もう一度お試しください。');
    } finally {
      setNicknameSaving(false);
    }
  };

  // Google アカウントを連携
  const handleGoogleLink = async () => {
    if (!supabase) {
      setGoogleLinkError('Google連携はまだ準備中です');
      return;
    }
    setGoogleLinking(true);
    setGoogleLinkError('');
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) {
        // プロバイダ未設定・機能未有効などの場合も優しいエラーに吸収
        setGoogleLinkError('Google連携はまだ準備中です');
      }
    } catch {
      setGoogleLinkError('Google連携はまだ準備中です');
    } finally {
      setGoogleLinking(false);
    }
  };

  // Google アカウントの連携を解除
  const handleGoogleUnlink = async () => {
    if (!supabase) {
      setGoogleLinkError('操作できませんでした（接続エラー）');
      return;
    }
    // identities から google の identity を特定
    const googleIdentity = (session?.user?.identities || []).find(
      (id) => id.provider === 'google'
    );
    if (!googleIdentity) return;

    setGoogleUnlinking(true);
    setGoogleLinkError('');
    try {
      const { error } = await supabase.auth.unlinkIdentity(googleIdentity);
      if (error) {
        setGoogleLinkError('連携解除に失敗しました。もう一度お試しください。');
      }
      // 成功時はページリロードで identities が更新される（Supabase の仕様）
    } catch {
      setGoogleLinkError('連携解除に失敗しました。もう一度お試しください。');
    } finally {
      setGoogleUnlinking(false);
    }
  };

  // ログアウト処理
  // onLogout が flush → signOut → clear の順序を担保する（App.jsx 参照）。
  // ここでは await してから onClose するだけ。
  const handleLogout = async () => {
    setIsLoggingOut(true);
    if (onLogout) await onLogout();
    onClose();
  };

  if (!session || !session.user) return null;

  const userEmail = session.user.email || '';
  // ニックネームがあればその頭文字、なければメールの頭文字
  const displayName = session.user.user_metadata?.nickname || nickname || userEmail;
  const initial = displayName ? displayName[0].toUpperCase() : '?';

  // Google 連携状態
  const identities = session.user.identities || [];
  const isGoogleLinked = identities.some((id) => id.provider === 'google');
  const canUnlink = identities.length >= 2; // 2つ以上あれば解除可能

  // 最終同期日時のフォーマット（YYYY/MM/DD HH:mm）
  const syncLabel = (() => {
    if (syncStatus === 'loading') return '同期状態を確認中…';
    if (syncStatus === 'fallback' || !lastSyncedAt) return '学習進捗は同期されています';
    const y = lastSyncedAt.getFullYear();
    const mo = String(lastSyncedAt.getMonth() + 1).padStart(2, '0');
    const d = String(lastSyncedAt.getDate()).padStart(2, '0');
    const h = String(lastSyncedAt.getHours()).padStart(2, '0');
    const mi = String(lastSyncedAt.getMinutes()).padStart(2, '0');
    return `最終同期: ${y}/${mo}/${d} ${h}:${mi}`;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="アカウント情報"
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

        {/* 1. アバター + 表示名 + メールアドレス */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-12 h-12 rounded-full bg-teal-400 text-white text-base font-black flex items-center justify-center shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {nickname || userEmail}
            </p>
            {nickname && (
              <p className="text-xs text-slate-400 truncate">{userEmail}</p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">ログイン中</p>
          </div>
        </div>

        <div className="h-px bg-slate-100 my-4" />

        {/* 2. 同期状態 */}
        <div className="flex items-center gap-2">
          {syncStatus === 'loading' ? (
            <span className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-teal-400 animate-spin shrink-0" />
          ) : (
            <Icon name="check-circle" size={16} className="text-teal-500 shrink-0" />
          )}
          <span className="text-xs text-slate-500">{syncLabel}</span>
        </div>

        <div className="h-px bg-slate-100 my-4" />

        {/* 3. ニックネーム設定 */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">ニックネーム</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setNicknameSaved(false);
                setNicknameError('');
              }}
              placeholder="表示名を入力"
              maxLength={30}
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400 transition-colors"
            />
            <button
              onClick={handleNicknameSave}
              disabled={nicknameSaving || nickname.trim() === (session.user.user_metadata?.nickname || '')}
              className="px-3 py-2 rounded-xl bg-teal-500 text-white text-xs font-bold hover:bg-teal-600 active:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {nicknameSaving ? '保存中…' : '保存'}
            </button>
          </div>
          {nicknameSaved && (
            <p className="text-xs text-teal-500 mt-1.5 flex items-center gap-1">
              <Icon name="check" size={12} /> 保存しました
            </p>
          )}
          {nicknameError && (
            <p className="text-xs text-red-500 mt-1.5">{nicknameError}</p>
          )}
        </div>

        <div className="h-px bg-slate-100 my-4" />

        {/* 4. Google アカウント連携 */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">アカウント連携</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/google-g.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
              <span className="text-sm text-slate-700">Google</span>
            </div>
            {isGoogleLinked ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-teal-600 font-semibold">連携済み</span>
                {canUnlink && (
                  <button
                    onClick={handleGoogleUnlink}
                    disabled={googleUnlinking}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {googleUnlinking ? '解除中…' : '解除'}
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleGoogleLink}
                disabled={googleLinking}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLinking ? '連携中…' : '連携する'}
              </button>
            )}
          </div>
          {googleLinkError && (
            <p className="text-xs text-slate-500 mt-1.5">{googleLinkError}</p>
          )}
        </div>

        <div className="h-px bg-slate-100 my-4" />

        {/* 5. ログアウトボタン */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full py-3 rounded-2xl bg-red-50 text-red-500 font-bold text-sm hover:bg-red-100 border border-red-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoggingOut ? 'ログアウト中…' : 'ログアウト'}
        </button>

      </div>
    </div>
  );
}
