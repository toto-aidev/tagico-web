'use client';

// components/Home.jsx — ホーム（クエスト） / 単語帳（tagico-studio/v2-app.jsx の画面部分の移植）
// 2026-06-14: SRS 復習バナーを追加（srsReviewCount / onSrsReview prop）

import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/Icon';
import { SummaryBody, BookmarkButton, BottomNav } from '@/components/Summary';
import { LEVELS, getWord } from '@/lib/content';
import * as sfx from '@/lib/sfx';

// 効果音オン/オフのトグル（ヘッダー右上・ストリークバッジの隣に最小限で配置）。
// 押すと即ミュート状態を localStorage に永続化。オンに戻した瞬間にだけ確認音を鳴らす。
function SfxToggle() {
  const [muted, setMutedState] = useState(false);
  useEffect(() => { setMutedState(sfx.isMuted()); }, []);
  const onClick = () => {
    const now = sfx.toggleMuted();
    setMutedState(now);
    if (!now) { sfx.unlockAudio(); sfx.play('ui'); } // オンに戻したら鳴ることを確認できる
  };
  return (
    <button
      onClick={onClick}
      aria-label={muted ? '効果音をオンにする' : '効果音をオフにする'}
      className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-slate-600 active:scale-95 transition-all"
    >
      <Icon name={muted ? 'volume-x' : 'volume-2'} size={16} color={muted ? '#cbd5e1' : '#14b8a6'} />
    </button>
  );
}

// 価格タグの形（lucide tag 由来）。"Tag"ico のブランド motif。
const TAG_PATH =
  'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z';

// 重ねたタグ＝多義（1単語に複数の意味）を表すマーク
function TagMark({ size = 30, front = '#ffffff', back = 'rgba(255,255,255,0.38)', hole = '#2DD4BF' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform="rotate(16 12 12) translate(1.4 -1)">
        <path d={TAG_PATH} fill={back} />
      </g>
      <g transform="rotate(-7 12 12)">
        <path d={TAG_PATH} fill={front} />
        <circle cx="7.2" cy="7.2" r="1.55" fill={hole} />
      </g>
    </svg>
  );
}

function TagicoLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl rotate-3 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-teal-400 to-teal-500 shadow-lg shadow-teal-500/30">
          {/* 上面のハイライト（立体感） */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20 pointer-events-none" />
          <TagMark size={30} hole="#2BC0AE" />
        </div>
        {/* ローズのアクセント＋小さなきらめき */}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-rose-400 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="#fff" aria-hidden="true">
            <path d="M5 0 C5.4 3 5.8 3.6 10 5 C5.8 6.4 5.4 7 5 10 C4.6 7 4.2 6.4 0 5 C4.2 3.6 4.6 3 5 0 Z" />
          </svg>
        </div>
      </div>
      <div>
        <div className="flex items-baseline tracking-tighter">
          <span className="text-3xl font-black text-slate-800">Tag</span>
          <span className="text-3xl font-black text-teal-500">ico</span>
        </div>
        <p className="text-[0.62rem] font-bold tracking-[0.22em] text-slate-400 uppercase mt-0.5">Polyseme Quest</p>
      </div>
    </div>
  );
}

// srsReviewCount: 今日の SRS 復習件数（0なら非表示）
// onSrsReview: SRS 復習開始ハンドラ
// rawAppState: プレビューモードの completed 上書き前の実際の進捗（nextLevel/nextWordId 算出に使う）
export function HomeScreen({ appState, rawAppState, onNavigate, srsReviewCount, onSrsReview, authButton }) {
  const allIds = LEVELS.flatMap((l) => l.wordIds);
  const masteredCount = appState.cleared.filter((id) => allIds.indexOf(id) >= 0).length;
  // 完走判定は completed を使う（誤答・答え見含む）
  const completed = appState.completed || appState.cleared;
  // nextLevel/nextWordId の計算はプレビューモードの上書きを受けない実際の進捗で行う。
  // rawAppState がない場合（非プレビュー・通常）は appState と同じ。
  const rawCompleted = rawAppState ? (rawAppState.completed || rawAppState.cleared) : completed;

  const nextLevel = LEVELS.find((l) => l.wordIds.some((id) => !rawCompleted.includes(id)));
  const nextWordId = nextLevel && nextLevel.wordIds.find((id) => !rawCompleted.includes(id));

  // 現在のレベル（次にやるレベル。全完走なら最後のレベル）
  const curLevel = nextLevel || LEVELS[LEVELS.length - 1];
  // 進捗バーは cleared（全問正解）で表示（実績）
  const curCleared = curLevel ? curLevel.wordIds.filter((id) => appState.cleared.includes(id)).length : 0;
  const allDone = !nextLevel;
  const [activeIdx, setActiveIdx] = useState(() => { const i = LEVELS.indexOf(curLevel); return i >= 0 ? i : 0; });

  // モバイルでタブが横スクロール（オーバーフロー）する場合、初期表示の右端を
  // 「解禁済みの最高レベル」タブに合わせる。ロック中のレベルはさらに右へスクロールすれば見える。
  // 解禁が Lv1 のみなら左端（スクロール 0）。デスクトップで全タブが見えているときは実質 no-op。
  const tabScrollRef = useRef(null);
  // 解禁済みの最高レベルの index（level i は i===0 もしくは前レベル全完走で解禁）。
  // 解禁は completed（誤答・答え見含む完走）で判定する。
  let topUnlockedIdx = 0;
  for (let i = 1; i < LEVELS.length; i++) {
    if (LEVELS[i - 1].wordIds.every((id) => completed.includes(id))) topUnlockedIdx = i;
    else break;
  }
  useEffect(() => {
    // レイアウト確定（Webフォント反映・タブ幅確定）後に位置を計算するため rAF を二重にネスト。
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = tabScrollRef.current;
        if (!el) return;
        const tab = el.querySelector('[data-tab-idx="' + topUnlockedIdx + '"]');
        if (!tab) return;
        // 解禁最高レベルのタブの右端を、コンテナの右端に合わせる。
        const target = tab.offsetLeft + tab.offsetWidth - el.clientWidth;
        el.scrollLeft = Math.max(0, target);
      });
    });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [topUnlockedIdx]);

  return (
    <div className="flex-1 flex flex-col max-w-md lg:max-w-[980px] lg:shadow-[0_10px_60px_rgba(15,23,42,0.10)] w-full mx-auto bg-slate-50 min-h-screen relative overflow-hidden">
      {/* 背景の装飾ブラー */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-48 h-48 bg-rose-200/30 rounded-full blur-3xl pointer-events-none" />

      <header className="px-6 pt-12 pb-6 relative z-10">
        <div className="flex items-start justify-between mb-8">
          <TagicoLogo />
          <div className="flex items-center gap-2">
            <SfxToggle />
            {/* 任意ログインボタン（AuthButton）— App.jsx から渡される。未ログイン時は「保存」、ログイン中はアバター */}
            {authButton || null}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-sm border border-slate-100">
              <Icon name="flame" size={16} color={appState.streakDays > 0 ? '#f43f5e' : '#cbd5e1'} />
              <span className={'font-black ' + (appState.streakDays > 0 ? 'text-rose-500' : 'text-slate-400')}>{appState.streakDays}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          {/* 累計マスター数（分母なし。単語が増えても伸び続けるコレクション指標） */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-slate-800">{masteredCount}</span>
                <span className="text-sm font-bold text-slate-400">語 マスター</span>
              </div>
              <p className="text-[0.65rem] font-bold text-slate-400 mt-0.5">
                {allDone ? '全レベル制覇！おめでとう 🎉' : 'あと ' + curLevel.wordIds.filter((id) => !completed.includes(id)).length + ' 語で ' + curLevel.name + ' 完走'}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-500 flex items-center justify-center shrink-0">
              <Icon name="trophy" size={22} />
            </div>
          </div>
          {/* 現在レベルの進捗（分母＝そのレベルの単語数。次レベル解禁という実マイルストーン） */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-wider">{curLevel.name}</span>
            <span className="text-xs font-bold text-slate-400">{curCleared}/{curLevel.wordIds.length}</span>
          </div>
          <div className="flex gap-1.5">
            {curLevel.wordIds.map((wid) => {
              const done = appState.cleared.includes(wid);
              return <div key={wid} className={'h-2.5 flex-1 rounded-full ' + (done ? 'bg-teal-400' : 'bg-slate-100')} />;
            })}
          </div>
        </div>
      </header>

      {nextLevel && (
        <div className="px-6 mb-6 relative z-10">
          <button
            onClick={() => onNavigate({ type: 'quiz', levelId: nextLevel.id, wordIds: nextWordId ? [nextWordId] : undefined })}
            className="w-full flex items-center justify-between px-6 py-5 rounded-3xl bg-teal-400 text-white shadow-[0_8px_0_0_#14b8a6] active:shadow-[0_0px_0_0_#14b8a6] active:translate-y-[8px] transition-all"
          >
            <div className="text-left">
              <p className="text-xs font-bold text-teal-50 uppercase tracking-wider mb-1">Continue Quest</p>
              <p className="font-black text-xl">{nextLevel.name}{nextWordId && getWord(nextWordId) ? <span className="font-bold text-base text-white/70"> · {getWord(nextWordId).word}</span> : null}</p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-full backdrop-blur-sm">
              <Icon name="play" size={20} fill="currentColor" className="ml-1" />
            </div>
          </button>
        </div>
      )}

      {/* SRS 間隔反復の復習バナー（今日の期日が来ている語義がある時のみ） */}
      {srsReviewCount > 0 && onSrsReview && (
        <div className="px-6 mb-4 relative z-10">
          <button
            onClick={onSrsReview}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-amber-50 border-2 border-amber-200 hover:border-amber-300 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Icon name="clock" size={18} />
              </div>
              <div className="text-left">
                <p className="font-black text-base text-amber-800">今日の語義復習</p>
                <p className="text-xs font-bold text-amber-500">
                  過去の自分に勝とう — {srsReviewCount} 語義 が期日です
                </p>
              </div>
            </div>
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-black shrink-0">
              {srsReviewCount}
            </span>
          </button>
        </div>
      )}

      {/* レベルタブ（解禁が増えても1レベルだけ表示＝縦に伸びない） */}
      <div className="px-6 mb-3 relative z-10">
        <div ref={tabScrollRef} className="flex gap-2 overflow-x-auto pb-1">
          {LEVELS.map((l, i) => {
            // レベル解禁は completed（完走）で判定。cleared（全問正解）は不要
            const locked = i > 0 && !LEVELS[i - 1].wordIds.every((id) => completed.includes(id));
            const active = i === activeIdx;
            return (
              <button key={l.id} data-tab-idx={i} onClick={() => { sfx.play('tap'); setActiveIdx(i); }}
                className={'shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition-all active:scale-95 ' + (active ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border-2 border-slate-100 hover:border-slate-200')}>
                {locked && <Icon name="lock" size={12} />}
                {l.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-6 pb-28 lg:pb-10 overflow-y-auto z-10">
        {(() => {
          const levelIdx = activeIdx;
          const level = LEVELS[levelIdx];
          const prevLevel = levelIdx > 0 ? LEVELS[levelIdx - 1] : null;
          // レベルロックも completed で判定
          const levelLocked = prevLevel ? !prevLevel.wordIds.every((id) => completed.includes(id)) : false;
          const globalOffset = LEVELS.slice(0, levelIdx).reduce((s, l) => s + l.wordIds.length, 0);
          return (
            <div>
              <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:content-start">
                {level.wordIds.map((wordId, wIdx) => {
                  const word = getWord(wordId);
                  const isCleared = appState.cleared.includes(wordId);
                  const isCompleted = completed.includes(wordId);
                  // 単語のロック：前の単語が completed（完走）していれば解禁
                  const prevWordId = wIdx > 0 ? level.wordIds[wIdx - 1] : null;
                  const prevWordCompleted = prevWordId ? completed.includes(prevWordId) : true;
                  const isWordLocked = levelLocked || (wIdx > 0 && !prevWordCompleted);
                  const isNext = !isCompleted && !isWordLocked;
                  const isFirstNext =
                    isNext &&
                    level.wordIds.slice(0, wIdx).every((id) => completed.includes(id)) &&
                    levelIdx === LEVELS.findIndex((l) => l.wordIds.some((id) => !completed.includes(id)));
                  const history = appState.history[wordId];
                  const globalNum = globalOffset + wIdx + 1;

                  return (
                    <button
                      key={wordId}
                      disabled={isWordLocked}
                      onClick={() => !isWordLocked && onNavigate({ type: 'quiz', levelId: level.id, wordIds: [wordId] })}
                      className={'w-full flex items-center gap-4 p-4 rounded-2xl transition-all ' + (
                        isCleared ? 'bg-white border-2 border-teal-100 opacity-80'
                          : isCompleted ? 'bg-white border-2 border-slate-200 opacity-80'
                          : isFirstNext ? 'bg-white border-2 border-rose-400 shadow-md'
                          : isWordLocked ? 'bg-slate-100/50 border-2 border-transparent text-slate-400 cursor-not-allowed'
                          : 'bg-white border-2 border-slate-100 shadow-sm hover:border-teal-200'
                      )}
                    >
                      <div className={'w-10 h-10 rounded-xl flex items-center justify-center font-black ' + (
                        isCleared ? 'bg-teal-100 text-teal-600'
                          : isCompleted ? 'bg-slate-100 text-slate-500'
                          : isFirstNext ? 'bg-rose-100 text-rose-500'
                          : isWordLocked ? 'bg-slate-200 text-slate-400'
                          : 'bg-slate-100 text-slate-600'
                      )}>
                        {isCleared ? <Icon name="check-circle" size={20} color="#14b8a6" />
                          : isCompleted ? <Icon name="rotate-ccw" size={16} color="#94a3b8" />
                          : isWordLocked ? <Icon name="lock" size={16} />
                          : globalNum}
                      </div>

                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className={'font-black text-lg ' + (isWordLocked ? 'text-slate-400' : 'text-slate-700')}>{word ? word.word : wordId}</span>
                          {isFirstNext && <span className="bg-rose-500 text-white text-[0.6rem] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Next</span>}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {isCleared && history ? (
                          <div className="flex items-center text-amber-400">
                            {Array.from({ length: 3 }).map((_, si) => (
                              <Icon key={si} name="star" size={12} color={si < (history.bestScore / history.total * 3) ? '#fbbf24' : '#e2e8f0'} fill="currentColor" />
                            ))}
                          </div>
                        ) : !isWordLocked ? (
                          <Icon name="chevron-right" size={20} color="#cbd5e1" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  );
}

export function WordbookScreen({ appState, onToggleBookmark, onToggleSavedSense, onNavigate }) {
  const [expanded, setExpanded] = useState(() => new Set());

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const uniqueIds = [...new Set(LEVELS.flatMap((l) => l.wordIds))];

  return (
    <div className="flex flex-col max-w-md lg:max-w-[980px] lg:shadow-[0_10px_60px_rgba(15,23,42,0.10)] w-full mx-auto bg-slate-50 min-h-screen relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-20%] w-96 h-96 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-4 px-5 py-4 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-100 text-teal-600">
          <Icon name="book-open" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">単語帳</h1>
          <p className="text-xs font-bold text-slate-400">{(appState.completed || appState.cleared).filter((id) => uniqueIds.indexOf(id) >= 0).length} / {uniqueIds.length} 語 解禁</p>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 flex flex-col gap-8 overflow-y-auto relative z-10 pb-28 lg:pb-10">
        {LEVELS.map((level) => (
          <div key={level.id}>
            <div className="flex items-center gap-3 mb-4">
              <span className="font-black text-sm text-slate-400 uppercase tracking-wider">{level.name}</span>
              <div className="flex-1 h-0.5 bg-slate-200 rounded-full" />
            </div>

            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:content-start">
              {level.wordIds.map((id) => {
                const word = getWord(id);
                const isCleared = appState.cleared.includes(id);
                const isOpen = expanded.has(id);
                const history = appState.history[id];
                if (!word) return null;

                return (
                  <div key={id} className={'rounded-3xl overflow-hidden transition-all ' + (isCleared ? 'bg-white border-2 border-teal-100 shadow-sm' : 'bg-slate-100/50 border-2 border-slate-100')}>
                    <button onClick={() => isCleared && toggle(id)} disabled={!isCleared} className="w-full flex items-center gap-4 p-4 text-left focus:outline-none">
                      <div className={'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ' + (isCleared ? 'bg-teal-100 text-teal-600' : 'bg-slate-200 text-slate-400')}>
                        {isCleared ? <Icon name="trophy" size={20} /> : <Icon name="lock" size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={'text-xl font-black ' + (isCleared ? 'text-slate-800' : 'text-slate-400')}>{word.word}</span>
                          <span className="text-[0.6rem] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">{word.faces.length}用法</span>
                        </div>
                        {isCleared && history ? (
                          <p className="text-xs font-bold text-slate-400">ベスト {history.bestScore}/{history.total} ・ {history.attempts}回挑戦</p>
                        ) : (
                          <p className="text-xs font-bold text-slate-400">未解禁</p>
                        )}
                      </div>
                      {isCleared && (
                        <div className={'w-8 h-8 rounded-full flex items-center justify-center transition-colors ' + (isOpen ? 'bg-teal-400 text-white' : 'bg-slate-100 text-slate-400')}>
                          <Icon name="chevron-down" size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
                        </div>
                      )}
                    </button>

                    {isCleared && isOpen && (
                      <div className="tg-fadeup px-4 pb-4 border-t border-slate-100 pt-4">
                        {onToggleBookmark && (
                          <div className="flex items-center gap-2 mb-3">
                            <BookmarkButton active={(appState.bookmarks || []).indexOf(id) >= 0} onClick={() => onToggleBookmark(id)} />
                            <span className="text-xs font-bold text-slate-400">{(appState.bookmarks || []).indexOf(id) >= 0 ? 'マイ単語帳に保存済み' : 'マイ単語帳に保存'}</span>
                          </div>
                        )}
                        <SummaryBody word={word} savedSet={appState.savedSenses} onToggleFace={onToggleSavedSense} showExamples={true} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <BottomNav active="wordbook" onNavigate={onNavigate} />
    </div>
  );
}
