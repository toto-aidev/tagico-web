'use client';

// components/Survey.jsx — 使用後アンケート（Tally）誘導
//   - SurveyPrompt: Level 1（5語）完走時に一度だけ出すモーダル
//   - FeedbackLink:  マイ画面に常設する控えめなフィードバックリンク
// アプリは完全静的・localStorage のみ。アンケートは Tally 側で完結し、
// ここではサーバー送信も個人情報収集も一切行わない。

import React from 'react';
import Icon from '@/components/Icon';

// Level 1 完走後に一度だけ表示するモーダル。
// 「答える」= Tally を新タブで開く / 「あとで」= 閉じる。どちらも onDismiss を呼び、以後は再表示しない。
export function SurveyPrompt({ url, onDismiss }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tg-survey-title"
    >
      {/* 背景オーバーレイ（タップで閉じる＝「あとで」と同じ） */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onDismiss} />

      <div className="tg-pop relative w-full max-w-sm bg-white rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.25)] border border-slate-100 p-6">
        <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-100 text-amber-500">
          <Icon name="sparkles" size={28} fill="currentColor" />
        </div>

        <h2 id="tg-survey-title" className="text-xl font-black text-slate-800 text-center mb-2">
          Level 1 クリア！おめでとう 🎉
        </h2>
        <p className="text-sm font-medium text-slate-500 text-center leading-relaxed mb-6">
          ここまで使ってみてどうでしたか？よかった点も気になった点も、ひとことだけ聞かせてもらえると今後の改善にすごく役立ちます。
        </p>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDismiss}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-teal-400 text-white font-black text-base shadow-[0_6px_0_0_#14b8a6] active:shadow-[0_0px_0_0_#14b8a6] active:translate-y-[6px] transition-all"
        >
          感想を送る <Icon name="chevron-right" size={20} strokeWidth={3} />
        </a>
        <button
          onClick={onDismiss}
          className="w-full mt-3 py-2.5 rounded-2xl text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
        >
          あとで
        </button>
      </div>
    </div>
  );
}

// マイ画面などに常設する控えめなフィードバックリンク。タップで Tally を新タブで開く。
export function FeedbackLink({ url }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border-2 border-slate-100 text-slate-500 font-bold text-sm hover:border-teal-200 hover:text-teal-600 transition-all active:scale-95"
    >
      <Icon name="sparkles" size={16} />
      フィードバックを送る
    </a>
  );
}
