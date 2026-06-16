'use client';

// components/AccountSheet.jsx — ログイン中ユーザーのアカウント情報シート
//
// AuthButton のアバターをタップすると開く。
// AuthModal と同系統の UI（同じモーダル構造・トーン・カードスタイル）。
//
// 表示項目:
//   1. ログイン中のメールアドレス（アバター + メール）
//   2. 同期状態（Supabase user_progress.updated_at から最終同期日時）
//   3. 進捗データのエクスポート（JSON ダウンロード）
//   4. ログアウトボタン
//
// props:
//   session: Session — Supabase セッション（null の場合は何も表示しない）
//   onLogout: () => void — signOut後に App.jsx の session state をリセット
//   onClose: () => void — シートを閉じる

import React, { useState, useEffect } from 'react';
import Icon from '@/components/Icon';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getState } from '@/lib/store';
import { getSrs } from '@/lib/srs';

export default function AccountSheet({ session, onLogout, onClose }) {
  const [syncStatus, setSyncStatus] = useState('loading'); // 'loading' | 'synced' | 'fallback'
  const [lastSyncedAt, setLastSyncedAt] = useState(null); // Date | null
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  // 進捗 JSON をダウンロード
  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      exportedAt: new Date().toISOString(),
      progress: getState(),
      srs: getSrs(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tagico-progress-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ログアウト処理
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOut();
    if (onLogout) onLogout();
    onClose();
  };

  if (!session || !session.user) return null;

  const userEmail = session.user.email || '';
  const initial = userEmail ? userEmail[0].toUpperCase() : '?';

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

        {/* 1. アバター + メールアドレス */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-12 h-12 rounded-full bg-teal-400 text-white text-base font-black flex items-center justify-center shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{userEmail}</p>
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

        {/* 3. エクスポートボタン */}
        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <Icon name="download" size={16} />
          進捗データをエクスポート
        </button>

        <div className="h-px bg-slate-100 my-4" />

        {/* 4. ログアウトボタン */}
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
