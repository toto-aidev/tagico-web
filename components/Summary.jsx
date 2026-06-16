'use client';

// components/Summary.jsx — 用法まとめの本体（コアイメージ＋用法一覧＋豆知識）
// クイズ後／単語帳／マイ単語帳 で共通利用。豆知識は「💡アイコン」で示し、文言は使わない。

import React from 'react';
import Icon from '@/components/Icon';

// lead・trivia 内の〈〉で囲まれた用法名に軽い強調を付ける（teal/amber アクセント）
// 既存の dangerouslySetInnerHTML と同じ仕組みで <b> タグを使う
function highlightBrackets(text) {
  if (!text || typeof text !== 'string') return text;
  // 〈...〉 → <b class="...">〈...〉</b> に置換
  return text.replace(/〈([^〉]+)〉/g, '<b class="font-black text-teal-600">〈$1〉</b>');
}

// sense.id → sense オブジェクトの Map を作る（SummaryBody 内で例文再掲に使う）
function buildSenseMap(senses) {
  const map = {};
  for (const s of (senses || [])) {
    if (s.id) map[s.id] = s;
  }
  return map;
}

// showExamples=true の場合のみ、各 face の下に設問例文を再掲する
export function SummaryBody({ word, savedSet, onToggleFace, showExamples }) {
  const senseMap = showExamples ? buildSenseMap(word.senses) : {};

  return (
    <React.Fragment>
      <div className="rounded-2xl p-4 mb-4 bg-amber-50/50 border border-amber-100">
        <p className="font-black text-amber-600 text-base mb-1">{word.coreImage.headline}</p>
        <p className="text-amber-700/80 text-sm font-medium leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlightBrackets(word.coreImage.lead) }} />
      </div>

      <div className="flex flex-col gap-3">
        {word.faces.map((face, i) => {
          // この用法に対応する設問例文を収集（face.senseIds がない or showExamples=false なら空）
          const exampleSenses = showExamples && face.senseIds
            ? face.senseIds.map((sid) => senseMap[sid]).filter(Boolean)
            : [];

          return (
          <div key={i} className="relative flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-black text-slate-400 shrink-0 shadow-sm mt-0.5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              {/* 用法名：「忘れがち」ボタンと同行になるため、この行だけ右クリアランスを確保 */}
              <p className={`font-black text-teal-700 text-[0.95rem] leading-snug${onToggleFace ? ' pr-[4.5rem]' : ''}`}>{face.name}</p>
              {/* 訳・型・説明：ボタンより下に来るためフル幅（クリアランス不要） */}
              {/* 訳：次に強調（中ウェイト・やや濃いグレー） */}
              <p className="text-slate-600 text-sm font-semibold mt-0.5 leading-snug">{face.meaning}</p>
              {/* 型：コードっぽく・ミュートカラー */}
              {face.type && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 text-[0.65rem] font-mono tracking-tight">
                  {face.type}
                </span>
              )}
              {/* 説明：補足然と・最もミュート */}
              {face.note && <p className="text-slate-400 text-[0.72rem] font-medium mt-1.5 leading-relaxed">{face.note}</p>}
              {/* 設問例文の再掲（クイズ答え合わせ後のみ：showExamples=true かつ senseIds がある用法のみ）
                  ※ 右パディングなし = コンテンツ列のフル幅まで伸びる */}
              {exampleSenses.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 w-full flex flex-col gap-2">
                  {exampleSenses.map((s) => (
                    <div key={s.id} className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2">
                      <p className="text-slate-600 text-[0.78rem] font-semibold leading-snug italic">{s.en}</p>
                      <p className="text-slate-400 text-[0.72rem] font-medium leading-snug mt-0.5">{s.jpFull}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {onToggleFace && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFace(word.id, i); }}
                className={'absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-bold transition-colors active:scale-95 ' + ((savedSet || []).indexOf(word.id + ':' + i) >= 0 ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400 border border-slate-200 hover:text-amber-500')}
                title="忘れがちな用法として保存"
              >
                <Icon name="bookmark" size={11} fill={(savedSet || []).indexOf(word.id + ':' + i) >= 0 ? 'currentColor' : undefined} /> 忘れがち
              </button>
            )}
          </div>
          );
        })}
      </div>

      {(Array.isArray(word.trivia) ? word.trivia : (word.trivia ? [word.trivia] : [])).filter(Boolean).map((tv, ti) => (
        <div key={ti} className="mt-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex gap-3">
          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center shrink-0">
            <Icon name="lightbulb" size={15} fill="currentColor" />
          </span>
          <p className="text-sm text-indigo-700/80 font-medium leading-relaxed self-center" dangerouslySetInnerHTML={{ __html: highlightBrackets(tv) }} />
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
      <Icon name="tag" size={size} fill={active ? 'currentColor' : undefined} />
    </button>
  );
}

// 下部タブ（Quest / 単語帳 / マイ / 統計）
export function BottomNav({ active, onNavigate }) {
  const items = [
    { key: 'home', label: 'クエスト', icon: 'play', screen: { type: 'home' } },
    { key: 'wordbook', label: '単語帳', icon: 'book-open', screen: { type: 'wordbook' } },
    { key: 'my', label: 'タグ', icon: 'tag', screen: { type: 'my' } },
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
                <Icon name={it.icon} size={22} fill={on && (it.icon === 'play' || it.icon === 'tag') ? 'currentColor' : undefined} />
              </div>
              <span className="text-[0.62rem] font-bold">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
