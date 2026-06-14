'use client';

// components/Quiz.jsx — クイズ画面 ＋ 結果画面（Pop テーマ / Polyseme Quest）
// tagico-studio/v2-quiz.jsx の移植。挙動は同一、confetti は npm パッケージに置換。
// 2026-06-14: SRS 復習モード対応（isSrsReview / srsContext prop）
//   - handleNext で senseResults（語義別正誤）を score に追加し App.jsx へ渡す
//   - isSrsReview=true 時: カードの上部に「過去の自分」演出バナーを表示
//     （より凝った案: sense ごとのカードをグレーアウト＋过去の誤答日を蛍光ハイライト等、
//      TODO: srsContext.senseIds でフィルタして「今回復習対象の語義」だけ強調する）

import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import Icon from '@/components/Icon';
import { SummaryBody, BookmarkButton } from '@/components/Summary';
import { getWord, getLevel, LEVELS } from '@/lib/content';
import { seededShuffle } from '@/lib/store';
import * as sfx from '@/lib/sfx';

const IRREGULAR = {
  bear: ['bears', 'bore', 'borne', 'bearing'],
  run: ['runs', 'ran', 'running'],
  mean: ['means', 'meant', 'meaning'],
  lie: ['lies', 'lay', 'lain', 'lying', 'lied'],
  break: ['breaks', 'broke', 'broken', 'breaking'],
  hold: ['holds', 'held', 'holding'],
  leave: ['leaves', 'left', 'leaving'],
  draw: ['draws', 'drew', 'drawn', 'drawing'],
  get: ['gets', 'got', 'gotten', 'getting'],
  will: ["won't", 'wills', 'willing'],
  take: ['takes', 'took', 'taken', 'taking'],
  know: ['knows', 'knew', 'known', 'knowing'],
  have: ['has', 'had', 'having'],
  find: ['finds', 'found', 'finding'],
  deny: ['denies', 'denied', 'denying'],
};

function splitAtWord(sentence, baseWord) {
  const variants = [
    baseWord, ...(IRREGULAR[baseWord] || []),
    baseWord + 's', baseWord + 'es', baseWord + 'ed', baseWord + 'ing',
    baseWord.replace(/e$/, '') + 'ing', baseWord.replace(/e$/, '') + 'ed',
  ];
  for (const v of variants) {
    const re = new RegExp('\\b(' + v + ')\\b', 'i');
    const m = re.exec(sentence);
    if (m) return [sentence.slice(0, m.index), m[0], sentence.slice(m.index + m[0].length)];
  }
  return null;
}

function HighlightedSentence({ sentence, word }) {
  const parts = splitAtWord(sentence, word);
  if (!parts) return <span className="text-slate-700 text-lg leading-relaxed font-medium">{sentence}</span>;
  const [before, match, after] = parts;
  return (
    <span className="text-slate-700 text-lg leading-relaxed font-medium">
      <span className="opacity-60">{before}</span>
      <span className="bg-teal-100 text-teal-700 font-bold px-1.5 py-0.5 rounded-lg border-b-2 border-teal-200">{match}</span>
      <span className="opacity-60">{after}</span>
    </span>
  );
}

function getChipPool(word) {
  const answers = word.senses.map((s) => s.answer);
  return seededShuffle([...answers, word.trap], word.id);
}

function fireConfetti() {
  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#2DD4BF', '#FF6B6B', '#FCD34D', '#FFFFFF'] });
}

// isSrsReview: true なら SRS 語義単位の復習モード（「過去の自分」演出を表示）
// srsContext: { senseIds: string[], earliestMiss: string|null } — 今回復習対象の情報
export function QuizScreen({ levelId, wordIds: propWordIds, hasNext, bookmarks, onToggleBookmark, savedSenses, onToggleSavedSense, onDone, onBack, levelWordIndex, levelWordCount, isReviewMode, isSrsReview, srsContext }) {
  const level = getLevel(levelId);
  const wordIds = propWordIds || (level && level.wordIds) || [];

  const [wordIdx, setWordIdx] = useState(0);
  const [states, setStates] = useState(() => wordIds.map(() => ({ assignments: {}, focused: 0, phase: 'quiz', trapHit: false, seeAnswer: false })));
  const [scores, setScores] = useState([]);

  const currentId = wordIds[wordIdx];
  const word = currentId ? getWord(currentId) : undefined;
  const ws = states[wordIdx] || { assignments: {}, focused: 0, phase: 'quiz', trapHit: false };

  const scrollContainerRef = useRef(null);
  const cardRefs = useRef([]);
  const summaryRef = useRef(null);

  useEffect(() => {
    // クイズ中のみ：フォーカスしたカードへスクロール。revealed フェーズでは発火しない
    if (ws.phase !== 'quiz') return;
    if (ws.focused === null || !scrollContainerRef.current) return;
    const card = cardRefs.current[ws.focused];
    if (!card) return;
    scrollContainerRef.current.scrollTo({ top: card.offsetTop - 80, behavior: 'smooth' });
  }, [ws.focused, ws.phase]);

  // 答え合わせ後（revealed）に画面先頭（問題01）へジャンプ。
  // ユーザーが上から正誤を確認しながら下の用法まとめへスクロールできる流れにする。
  // クイズ入力中（phase='quiz'）のチップ選択では発火しない。
  useEffect(() => {
    if (ws.phase !== 'revealed') return;
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({ top: 0 });
  }, [ws.phase]);

  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTo({ top: 0 });
  }, [wordIdx]);

  // 答え合わせ後（revealed）に画面先頭（問題01）へジャンプ
  useEffect(() => {
    if (ws.phase !== 'revealed') return;
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({ top: 0 });
  }, [ws.phase]);

  const chipPool = word ? getChipPool(word) : [];
  const usedChips = new Set(Object.values(ws.assignments));
  const allFilled = word ? Object.keys(ws.assignments).length === word.senses.length : false;

  const updateWs = useCallback((patch) => {
    setStates((prev) => {
      const next = [...prev];
      next[wordIdx] = { ...next[wordIdx], ...patch };
      return next;
    });
  }, [wordIdx]);

  const handleCardClick = (senseIdx) => {
    if (ws.phase !== 'quiz') return;
    // 既にチップが配置されているスロットを再タップ → 解除してプールに戻す（トグル）
    // フォーカスが同スロットに当たっている場合も解除する
    if (ws.assignments[senseIdx] !== undefined) {
      const newAssign = { ...ws.assignments };
      delete newAssign[senseIdx];
      sfx.play('tap');
      updateWs({ assignments: newAssign, focused: senseIdx });
    } else {
      // 未配置スロット → フォーカスするだけ
      updateWs({ focused: senseIdx });
    }
  };

  const handleChipClick = (chip) => {
    if (ws.phase !== 'quiz') return;
    sfx.play('tap'); // 選択肢チップのタップ：軽いポップ
    const newAssign = { ...ws.assignments };
    for (const [k, v] of Object.entries(newAssign)) {
      if (v === chip) delete newAssign[Number(k)];
    }
    if (ws.focused !== null) {
      newAssign[ws.focused] = chip;
      const nextEmpty = word ? word.senses.findIndex((_, i) => i !== ws.focused && newAssign[i] === undefined) : -1;
      updateWs({ assignments: newAssign, focused: nextEmpty >= 0 ? nextEmpty : null });
    }
  };

  const handleReveal = () => {
    if (!word) return;
    const correctCount = word.senses.filter((s, i) => ws.assignments[i] === s.answer).length;
    if (correctCount === word.senses.length) {
      fireConfetti();
      sfx.play('correct'); // 全問正解：明るい上昇音
    } else {
      sfx.play('wrong'); // 一部不正解：柔らかい低めの音
    }
    const trapHit = Object.values(ws.assignments).includes(word.trap);
    updateWs({ phase: 'revealed', trapHit });
  };

  const handleRevealAnswers = () => {
    if (!word) return;
    sfx.play('ui'); // 「答えを見る」：汎用クリック
    const auto = {};
    word.senses.forEach((s, i) => { auto[i] = s.answer; });
    updateWs({ assignments: auto, phase: 'revealed', trapHit: false, seeAnswer: true });
  };

  const handleNext = () => {
    if (!word) return;
    // 最後の単語＝「結果を見る」はファンファーレ判定が App 側で走るので、ここでは中間遷移のみ鳴らす。
    if (wordIdx < wordIds.length - 1) sfx.play('next'); // 次の単語へ：軽い上昇のひと押し
    const correct = word.senses.filter((s, i) => ws.assignments[i] === s.answer).length;
    // senseResults: 語義単位の正誤（SRS に渡すため sense.id を含める）
    const senseResults = word.senses.map((s, i) => ({
      senseId: s.id || (word.id + ':' + i), // id がない場合はフォールバック（移行期対策）
      correct: ws.assignments[i] === s.answer,
    }));
    const newScores = [...scores, { wordId: word.id, correct, total: word.senses.length, trapHit: ws.trapHit, seeAnswer: ws.seeAnswer || false, senseResults }];
    setScores(newScores);
    if (wordIdx < wordIds.length - 1) setWordIdx((i) => i + 1);
    else onDone(newScores);
  };

  // 戻る（左上の矢印）。現在の単語をすでに「答え合わせ済み（revealed）」なら、
  // その結果を未確定のまま捨てずに記録してから離脱する。
  // これにより「1単語だけ解いて即ホームに戻る」操作でも cleared に永続化され、
  // 次の単語が確実に解禁される（タスクA: 解禁が効かない不具合の修正）。
  const handleBack = () => {
    const revealedScores = states
      .map((st, i) => ({ st, w: getWord(wordIds[i]) }))
      .filter(({ st, w }) => w && st.phase === 'revealed')
      .map(({ st, w }) => ({
        wordId: w.id,
        correct: w.senses.filter((s, i) => st.assignments[i] === s.answer).length,
        total: w.senses.length,
        trapHit: st.trapHit,
        seeAnswer: st.seeAnswer || false,
        // handleNext と同様に語義単位の正誤を含める（SRS 復習モードで「戻る」を押しても
        // reviewedOn / checkpoints に正誤が記録されるようにするため）
        senseResults: w.senses.map((s, i) => ({
          senseId: s.id || (w.id + ':' + i),
          correct: st.assignments[i] === s.answer,
        })),
      }));
    onBack(revealedScores);
  };

  if (!word || (!level && !isReviewMode)) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-50"><p className="text-slate-400">Loading...</p></div>;
  }

  const correctCount = word.senses.filter((s, i) => ws.assignments[i] === s.answer).length;
  const perfectScore = ws.phase === 'revealed' && correctCount === word.senses.length;

  return (
    <div className="flex flex-col max-w-md lg:max-w-[980px] lg:shadow-[0_10px_60px_rgba(15,23,42,0.10)] w-full mx-auto bg-slate-50 h-[100dvh] overflow-hidden relative">
      {/* トップバー */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-md border-b border-slate-100 z-10">
        <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 transition-all">
          <Icon name="arrow-left" size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">
            {isReviewMode ? '復習' : (level && level.name)}
            {levelWordIndex !== null && levelWordCount !== null && (
              <span className="ml-1.5 normal-case">
                &middot; {levelWordIndex + 1}/{levelWordCount}語目
              </span>
            )}
          </p>
          <p className="text-xl font-black text-slate-800 tracking-tight">{word.word}</p>
        </div>
        {ws.phase === 'revealed' && (
          <div className={'tg-pop flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm ' + (perfectScore ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500')}>
            {perfectScore && <Icon name="check" size={14} strokeWidth={3} />}
            {correctCount}/{word.senses.length}
          </div>
        )}
      </div>

      {/* 語義カード */}
      <div ref={scrollContainerRef} className="relative flex-1 min-h-0 px-5 py-6 flex flex-col gap-4 overflow-y-auto">
        {/* SRS 復習モード：「過去の自分」演出バナー */}
        {isSrsReview && srsContext && srsContext.earliestMiss && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
            <Icon name="clock" size={18} color="#d97706" />
            <div className="min-w-0">
              <p className="text-xs font-black text-amber-700">
                {srsContext.earliestMiss} に間違えた問題
              </p>
              <p className="text-[0.7rem] font-medium text-amber-600 mt-0.5">
                過去の自分に勝とう
              </p>
              {/* TODO（改善余地）: srsContext.senseIds を使って「今回復習対象の語義」だけを
                   強調表示する（対象外の語義カードをグレーアウト等）。
                   また、過去の誤答チップ名を小さく表示する（recordMiss 時に wrongAnswer も保存する）。 */}
            </div>
          </div>
        )}
        {word.senses.map((sense, i) => {
          const assigned = ws.assignments[i];
          const isFocused = ws.focused === i && ws.phase === 'quiz';
          const isCorrect = ws.phase === 'revealed' && assigned === sense.answer;
          const isWrong = ws.phase === 'revealed' && assigned !== undefined && assigned !== sense.answer;
          return (
            <div
              key={i}
              ref={(el) => { cardRefs.current[i] = el; }}
              onClick={() => handleCardClick(i)}
              className={
                'rounded-3xl p-5 transition-all ' +
                // クイズフェーズのカードは長押しサブメニューを抑制（revealed後は解説テキストをコピーできるよう外す）
                (ws.phase === 'quiz' ? 'quiz-interactive ' : '') +
                (isCorrect ? 'tg-pop ' : isWrong ? 'tg-shake ' : '') +
                (ws.phase === 'revealed'
                  ? isCorrect ? 'bg-teal-50 border-2 border-teal-200'
                    : isWrong ? 'bg-rose-50 border-2 border-rose-200'
                    : 'bg-white border-2 border-slate-100 opacity-60'
                  : isFocused ? 'bg-white border-2 border-teal-400 shadow-[0_4px_16px_rgba(45,212,191,0.2)]'
                    : 'bg-white border-2 border-slate-100 shadow-sm') +
                (ws.phase === 'quiz' ? ' cursor-pointer' : ' cursor-default')
              }
            >
              <div className="flex items-center gap-2 mb-4">
                <span className={'w-6 h-6 flex items-center justify-center rounded-full text-xs font-black text-white ' + (
                  isFocused ? 'bg-teal-400' : ws.phase === 'revealed' ? (isCorrect ? 'bg-teal-500' : isWrong ? 'bg-rose-500' : 'bg-slate-300') : 'bg-slate-300'
                )}>{i + 1}</span>
              </div>

              <div className="mb-4">
                <HighlightedSentence sentence={sense.en} word={word.word} />
                {sense.hint && <p className="mt-2 text-xs font-medium text-slate-400">*{sense.hint}</p>}
              </div>

              <div className="flex items-center gap-3">
                {assigned ? (
                  <span className={'tg-pop flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm ' + (
                    ws.phase === 'revealed' ? (isCorrect ? 'bg-teal-500 text-white shadow-sm' : 'bg-rose-500 text-white shadow-sm') : 'bg-slate-800 text-white shadow-sm'
                  )}>
                    {ws.phase === 'revealed' && (isCorrect ? <Icon name="check" size={16} strokeWidth={3} /> : <Icon name="x" size={16} strokeWidth={3} />)}
                    {assigned}
                  </span>
                ) : (
                  <span className={'px-4 py-2 rounded-xl font-bold text-sm border-2 border-dashed ' + (isFocused ? 'border-teal-300 text-teal-500 bg-teal-50/50' : 'border-slate-200 text-slate-400')}>
                    {isFocused ? '意味を選ぶ…' : '未選択'}
                  </span>
                )}
                {ws.phase === 'revealed' && sense.cue && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold">{sense.cue}</span>
                )}
              </div>

              {ws.phase === 'revealed' && sense.jpFull && (
                <div className="mt-4 pt-4 border-t border-slate-200/60">
                  <p className="text-slate-600 text-sm leading-relaxed font-medium">{sense.jpFull}</p>
                </div>
              )}

              {isWrong && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs font-bold text-rose-500">正解</span>
                  <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm font-bold">{sense.answer}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* 用法まとめ */}
        {ws.phase === 'revealed' && (
          <div ref={summaryRef} className="flex flex-col gap-4">
            {/* SRS 復習・全問正解時の「克服！」演出 */}
            {isSrsReview && perfectScore && (
              <div className="tg-pop flex items-center gap-3 px-4 py-3 rounded-2xl bg-teal-400 text-white">
                <Icon name="check-circle" size={20} color="#fff" />
                <div>
                  <p className="text-sm font-black">克服！</p>
                  <p className="text-[0.7rem] font-medium text-teal-50">過去の自分に勝ちました 🎉</p>
                </div>
              </div>
            )}
            {/* 罠の結果（用法まとめブロックの上に配置） */}
            <div className={'tg-fadeup flex items-start gap-3 p-4 rounded-2xl ' + (ws.trapHit ? 'bg-rose-50 border border-rose-100' : 'bg-teal-50 border border-teal-100')}>
              {ws.trapHit ? <Icon name="alert-triangle" size={20} color="#f43f5e" /> : <Icon name="check" size={20} color="#14b8a6" strokeWidth={3} />}
              <p className={'text-sm font-bold ' + (ws.trapHit ? 'text-rose-700' : 'text-teal-700')}>
                {ws.trapHit ? '罠「' + word.trap + '」を使ってしまいました。' : '罠「' + word.trap + '」を回避しました！'}
              </p>
            </div>

            {/* 用法まとめ */}
            <div className="tg-fadeup rounded-3xl p-5 bg-white border-2 border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center">
                <Icon name="lightbulb" size={18} fill="currentColor" />
              </div>
              <h3 className="font-black text-slate-700 text-lg">用法まとめ</h3>
              {onToggleBookmark && <div className="ml-auto"><BookmarkButton active={(bookmarks || []).indexOf(word.id) >= 0} onClick={() => onToggleBookmark(word.id)} /></div>}
            </div>
            <SummaryBody word={word} savedSet={savedSenses} onToggleFace={onToggleSavedSense} />
            </div>
          </div>
        )}
        <div className="h-4" />
      </div>

      {/* 選択肢プール ＋ 操作ボタン（flex の子として下部に固定→本文は常にこの上に収まる） */}
      {/* quiz-interactive: チップ・ボタンの長押しサブメニュー／テキスト選択を抑制 */}
      <div className="quiz-interactive shrink-0 bg-white/90 backdrop-blur-md border-t border-slate-100 p-5 pb-safe pt-4 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {ws.phase === 'quiz' && (
          <div className="tg-fadeup">
            <div className="flex flex-wrap gap-2.5 mb-4 justify-center">
              {chipPool.map((chip) => {
                const isUsed = usedChips.has(chip);
                return (
                  <button
                    key={chip}
                    onClick={() => handleChipClick(chip)}
                    disabled={isUsed && ws.focused === null}
                    className={'px-5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95 ' + (
                      isUsed ? 'bg-slate-100 text-slate-300 border-2 border-transparent' : 'bg-white text-slate-700 border-2 border-slate-200 shadow-sm hover:border-teal-300 hover:text-teal-600'
                    )}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={handleRevealAnswers} className="px-4 py-3.5 rounded-2xl bg-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                <Icon name="eye" size={18} />
              </button>
              <button
                onClick={handleReveal}
                disabled={!allFilled}
                className={'flex-1 py-3.5 rounded-2xl font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-2 ' + (
                  allFilled ? 'bg-teal-400 text-white shadow-[0_6px_0_0_#14b8a6] active:shadow-[0_0px_0_0_#14b8a6] active:translate-y-[6px]' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                )}
              >
                答え合わせ
              </button>
            </div>
          </div>
        )}

        {ws.phase === 'revealed' && (
          <button
            onClick={handleNext}
            className="tg-fadeup w-full py-4 rounded-2xl bg-rose-400 text-white font-black text-lg shadow-[0_6px_0_0_#f43f5e] active:shadow-[0_0px_0_0_#f43f5e] active:translate-y-[6px] transition-all flex items-center justify-center gap-2"
          >
            {hasNext ? <React.Fragment>次の単語へ <Icon name="chevron-right" size={20} strokeWidth={3} /></React.Fragment>
                     : <React.Fragment>結果を見る <Icon name="chevron-right" size={20} strokeWidth={3} /></React.Fragment>}
          </button>
        )}
      </div>
    </div>
  );
}

export function ResultScreen({ scores, levelId, appState, onNavigate }) {
  const level = getLevel(levelId);
  const currentLevelIndex = LEVELS.findIndex((l) => l.id === levelId);
  const nextLevel = currentLevelIndex >= 0 && currentLevelIndex < LEVELS.length - 1 ? LEVELS[currentLevelIndex + 1] : null;
  const totalCorrect = scores.reduce((s, r) => s + r.correct, 0);
  const totalQuestions = scores.reduce((s, r) => s + r.total, 0);
  const pct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const isPerfect = totalCorrect === totalQuestions;
  const trapHitCount = scores.filter((s) => s.trapHit).length;

  useEffect(() => {
    if (!isPerfect) return;
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const rand = (min, max) => Math.random() * (max - min) + min;
    const interval = setInterval(function () {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: rand(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#2DD4BF', '#FF6B6B', '#FCD34D'] });
      confetti({ ...defaults, particleCount, origin: { x: rand(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#2DD4BF', '#FF6B6B', '#FCD34D'] });
    }, 250);
    return () => clearInterval(interval);
  }, [isPerfect]);

  const circumference = 2 * Math.PI * 54;
  const strokeOffset = circumference - (pct / 100) * circumference;
  const ringColor = isPerfect ? '#2DD4BF' : pct >= 60 ? '#FCD34D' : '#FF6B6B';

  return (
    <div className="flex flex-col max-w-md lg:max-w-[980px] lg:shadow-[0_10px_60px_rgba(15,23,42,0.10)] w-full mx-auto bg-slate-50 h-[100dvh] relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-20%] w-96 h-96 bg-teal-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="px-6 pt-16 pb-8 flex flex-col items-center relative z-10">
        <div className="tg-pop relative flex items-center justify-center mb-6">
          <svg width={140} height={140} className="drop-shadow-sm">
            <circle cx={70} cy={70} r={54} fill="none" stroke="#F1F5F9" strokeWidth={12} />
            <circle cx={70} cy={70} r={54} fill="none" stroke={ringColor} strokeWidth={12} strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={strokeOffset} transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={'text-4xl font-black ' + (isPerfect ? 'text-teal-500' : pct >= 60 ? 'text-amber-500' : 'text-rose-500')}>{pct}</span>
            <span className="text-sm font-bold text-slate-400">%</span>
          </div>
          {isPerfect && (
            <div className="absolute -bottom-2 -right-2 bg-amber-400 w-10 h-10 rounded-full flex items-center justify-center border-4 border-slate-50 shadow-md">
              <Icon name="star" size={16} color="#fff" fill="currentColor" />
            </div>
          )}
        </div>

        {isPerfect ? (
          <div className="text-center">
            <h1 className="text-2xl font-black text-teal-500 mb-1">全問正解！</h1>
            <p className="text-teal-600/80 font-bold text-sm">すべての語義をマスター</p>
          </div>
        ) : (
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-700 mb-1">クエスト達成</h1>
            <p className="text-slate-500 font-bold text-sm">{totalQuestions}問中 {totalCorrect}問正解</p>
          </div>
        )}

        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
          {level && level.name}
        </p>
      </div>

      <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col gap-4 overflow-y-auto relative z-10">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">単語別スコア</h2>

        {scores.map((score) => {
          const word = getWord(score.wordId);
          if (!word) return null;
          const isFullScore = score.correct === score.total;
          const isCleared = appState.cleared.includes(score.wordId);
          const hasError = !isFullScore;
          return (
            <div
              key={score.wordId}
              onClick={hasError ? () => onNavigate({ type: 'quiz', levelId, wordIds: [score.wordId], isRetry: true }) : undefined}
              className={'tg-fadeup rounded-3xl p-5 bg-white border-2 shadow-sm transition-all ' + (hasError ? 'border-rose-200 cursor-pointer hover:border-rose-300 active:scale-[0.98]' : 'border-slate-100')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg font-black text-slate-700">{word.word}</span>
                  {isCleared && (
                    <span className="px-2 py-0.5 rounded flex items-center gap-1 bg-amber-100 text-amber-600 text-[0.6rem] font-bold uppercase tracking-wider">
                      <Icon name="trophy" size={10} /> 卒業
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasError && (
                    <span className="text-[0.65rem] font-bold text-rose-400 flex items-center gap-1">
                      <Icon name="rotate-ccw" size={11} strokeWidth={3} /> やり直し
                    </span>
                  )}
                  <span className={'flex items-center gap-1 px-2.5 py-1 rounded-xl text-sm font-bold ' + (isFullScore ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500')}>
                    {isFullScore ? <Icon name="check" size={14} strokeWidth={3} /> : <Icon name="x" size={14} strokeWidth={3} />}
                    {score.correct}/{score.total}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                {word.senses.map((_, j) => (
                  <div key={j} className={'h-2.5 flex-1 rounded-full ' + (j < score.correct ? (isFullScore ? 'bg-teal-400' : 'bg-amber-400') : 'bg-slate-100')} />
                ))}
              </div>

              {score.trapHit && (
                <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100">
                  <Icon name="alert-triangle" size={14} color="#f43f5e" />
                  <span className="text-xs font-bold text-rose-600">罠「{word.trap}」を使ってしまいました</span>
                </div>
              )}
            </div>
          );
        })}

        {trapHitCount === 0 && scores.length > 0 && (
          <div className="tg-fadeup flex items-center gap-2 p-4 rounded-2xl bg-teal-50 border border-teal-100 shadow-sm">
            <div className="w-6 h-6 rounded-full bg-teal-400 text-white flex items-center justify-center shrink-0">
              <Icon name="check" size={14} strokeWidth={3} />
            </div>
            <p className="text-sm font-bold text-teal-700">すべての罠を回避しました！</p>
          </div>
        )}
      </div>

      <div className="shrink-0 bg-white/90 backdrop-blur-md border-t border-slate-100 p-5 pb-safe z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {nextLevel && (
          <button
            onClick={() => onNavigate({ type: 'quiz', levelId: nextLevel.id, wordIds: [nextLevel.wordIds[0]] })}
            className="w-full flex items-center justify-center gap-2 py-4 mb-3 rounded-2xl bg-rose-400 text-white font-black text-lg shadow-[0_6px_0_0_#f43f5e] active:shadow-[0_0px_0_0_#f43f5e] active:translate-y-[6px] transition-all"
          >
            次のレベルへ <Icon name="chevron-right" size={20} strokeWidth={3} />
          </button>
        )}
        <div className="flex gap-3 mb-3">
          <button onClick={() => { const lv = getLevel(levelId); const all = (lv && lv.wordIds) || []; onNavigate({ type: 'quiz', levelId, wordIds: all.length > 0 ? [all[0]] : [], replayWordIds: all, replay: true }); }} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-teal-400 text-white font-bold text-sm shadow-[0_4px_0_0_#14b8a6] active:shadow-[0_0px_0_0_#14b8a6] active:translate-y-[4px] transition-all">
            <Icon name="rotate-ccw" size={16} strokeWidth={3} /> もう一度
          </button>
          <button onClick={() => onNavigate({ type: 'home' })} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-800 text-white font-bold text-sm shadow-[0_4px_0_0_#1e293b] active:shadow-[0_0px_0_0_#1e293b] active:translate-y-[4px] transition-all">
            ホーム <Icon name="chevron-right" size={16} />
          </button>
        </div>
        <button onClick={() => onNavigate({ type: 'wordbook' })} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border-2 border-slate-200 text-slate-600 font-bold text-sm hover:border-slate-300 transition-all active:scale-95">
          <Icon name="book-open" size={16} /> 単語帳
        </button>
      </div>
    </div>
  );
}
