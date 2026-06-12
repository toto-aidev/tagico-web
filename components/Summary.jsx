'use client';

// components/Summary.jsx — 用法まとめの本体（コアイメージ＋用法一覧＋豆知識）
// クイズ後／単語帳／マイ単語帳 で共通利用。豆知識は「💡アイコン」で示し、文言は使わない。

import React from 'react';
import Icon from '@/components/Icon';

export function SummaryBody({ word, savedSet, onToggleFace }) {
  return (
    <React.Fragment>
      <div className="rounded-2xl p-4 mb-4 bg-amber-50/50 border border-amber-100">
        <p className="font-black text-amber-600 text-base mb-1">{word.coreImage.headline}</p>
        <p className="text-amber-700/80 text-sm font-medium leading-relaxed">{word.coreImage.lead}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {word.faces.map((face, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-black text-slate-400 shrink-0 shadow-sm">{i + 1}</span>
            <div className="flex-1 min-w-0 pt-0.5">
              <span className="font-black text-slate-700">{face.name}</span>
              <p className="text-slate-500 text-sm font-medium mt-0.5">{face.meaning}</p>
              {face.type && <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[0.65rem] font-bold">{face.type}</span>}
              {face.note && <p className="text-slate-400 text-xs font-medium mt-1.5">{face.note}</p>}
            </div>
            {onToggleFace && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFace(word.id, i); }}
                className={'shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-bold transition-colors active:scale-95 self-start ' + ((savedSet || []).indexOf(word.id + ':' + i) >= 0 ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400 border border-slate-200 hover:text-amber-500')}
                title="忘れがちな用法として保存"
              >
                <Icon name="bookmark" size={11} fill={(savedSet || []).indexOf(word.id + ':' + i) >= 0 ? 'currentColor' : undefined} /> 忘れがち
              </button>
            )}
          </div>
        ))}
      </div>

      {(Array.isArray(word.trivia) ? word.trivia : (word.trivia ? [word.trivia] : [])).filter(Boolean).map((tv, ti) => (
        <div key={ti} className="mt-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex gap-3">
          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center shrink-0">
            <Icon name="lightbulb" size={15} fill="currentColor" />
          </span>
          <p className="text-sm text-indigo-700/80 font-medium leading-relaxed self-center" dangerouslySetInnerHTML={{ __html: tv }} />
        </div>
      ))}
    </React.Fragment>
  );
}

// ブックマーク（マイ単語帳）ボタン
export function BookmarkButton({ active, onClick, size = 18 }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={'flex items-center justify-center w-9 h-9 rounded-full transition-all active:scale-90 ' + (active ? 'bg-rose-100 text-rose-500' : 'bg-slate-100 text-slate-400 hover:text-slate-600')}
      aria-label="マイ単語帳に保存"
      title={active ? 'マイ単語帳から外す' : 'マイ単語帳に保存'}
    >
      <Icon name="bookmark" size={size} fill={active ? 'currentColor' : undefined} />
    </button>
  );
}

// 下部タブ（Quest / 単語帳 / マイ / 統計）
export function BottomNav({ active, onNavigate }) {
  const items = [
    { key: 'home', label: 'クエスト', icon: 'play', screen: { type: 'home' } },
    { key: 'wordbook', label: '単語帳', icon: 'book-open', screen: { type: 'wordbook' } },
    { key: 'my', label: 'マイ', icon: 'bookmark', screen: { type: 'my' } },
    { key: 'stats', label: '統計', icon: 'bar-chart', screen: { type: 'stats' } },
  ];
  return (
    <nav className="tg-nav fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/85 backdrop-blur-md border-t border-slate-100 pb-safe pt-2 px-3 z-50">
      <div className="flex justify-around pb-3">
        {items.map((it) => {
          const on = active === it.key;
          return (
            <button key={it.key} onClick={() => onNavigate(it.screen)} className={'flex flex-col items-center gap-1 transition-colors ' + (on ? 'text-teal-500' : 'text-slate-400 hover:text-slate-600')}>
              <div className={'px-3 py-1.5 rounded-xl ' + (on ? 'bg-teal-50' : '')}>
                <Icon name={it.icon} size={22} fill={on && (it.icon === 'play' || it.icon === 'bookmark') ? 'currentColor' : undefined} />
              </div>
              <span className="text-[0.62rem] font-bold">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
