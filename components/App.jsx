'use client';

// components/App.jsx — ルーター（URLは使わず state 1個で管理）
// tagico-studio/v2-app.jsx の App の移植。
// 進捗は localStorage（'tagico-v2-state'）にあるため、SSR とのハイドレーション不一致を
// 避けるべく、マウント後に getState() を読んでから描画する（それまでは背景のみ）。

import React, { useState, useEffect } from 'react';
import { HomeScreen, WordbookScreen } from '@/components/Home';
import { QuizScreen, ResultScreen } from '@/components/Quiz';
import { MyWordbookScreen, StatsScreen } from '@/components/Extra';
import { SurveyPrompt } from '@/components/Survey';
import { getLevel } from '@/lib/content';
import * as store from '@/lib/store';
import * as sfx from '@/lib/sfx';

export default function App() {
  const [screen, setScreen] = useState({ type: 'home' });
  const [appState, setAppState] = useState(null); // マウント後に localStorage から読む
  const [sessionScores, setSessionScores] = useState([]);
  const [showSurvey, setShowSurvey] = useState(false); // Level 1 完走後アンケート誘導（一度きり）

  useEffect(() => {
    setAppState(store.getState());
    sfx.initSfx(); // ミュート状態を localStorage から同期

    // iOS/モバイル Safari の autoplay 対策：最初のユーザー操作で AudioContext を unlock/resume。
    // pointerdown / keydown / touchstart のいずれか最初の1回で解放（以後はリスナー解除）。
    const unlock = () => {
      sfx.unlockAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  const dismissSurvey = () => {
    store.markSurveyPrompted(); // 「答える」「あとで」どちらでも以後は再表示しない
    setShowSurvey(false);
  };

  const handleNavigate = (s) => {
    sfx.play('ui'); // タブ/画面遷移の汎用クリック
    setSessionScores([]);
    setScreen(s);
  };

  // クイズ画面で「戻る」を押したときの離脱処理。
  // 答え合わせ済み（revealed）だが「次へ」で確定していない単語のスコアを記録してから
  // ホームへ戻る。これで「1単語だけ解いて戻る」操作でも cleared が永続化され、
  // 次の単語が解禁される（タスクA）。
  const handleQuizBack = (revealedScores) => {
    if (revealedScores && revealedScores.length > 0) {
      const merged = store.recordScores(appState, revealedScores);
      setAppState(merged);
    }
    handleNavigate({ type: 'home' });
  };

  const handleToggleBookmark = (wordId) => setAppState((s) => store.toggleBookmark(s, wordId));
  const handleToggleSavedSense = (wordId, senseIdx) =>
    setAppState((s) => store.toggleSavedSense(s, wordId, senseIdx));

  const handleQuizDone = (scores) => {
    if (screen.type !== 'quiz') return;
    const wasLevel1Mastered = store.isLevel1Mastered(appState);
    const newAppState = store.recordScores(appState, scores);
    setAppState(newAppState);

    // Level 1（5語）を「今」完走したタイミングで一度だけアンケート誘導を出す
    if (!wasLevel1Mastered && store.isLevel1Mastered(newAppState) && !store.hasSurveyBeenPrompted()) {
      setShowSurvey(true);
    }

    // リトライ（結果画面の誤答クリック）から来た場合は完了後ホームへ戻る
    if (screen.isRetry) {
      handleNavigate({ type: 'home' });
      return;
    }

    const accumulated = [...sessionScores, ...scores];
    setSessionScores(accumulated);

    const level = getLevel(screen.levelId);
    const allWordIds = (level && level.wordIds) || [];
    const sessionDone = new Set(accumulated.map((s) => s.wordId));
    const nextWordId = allWordIds.find((id) => !sessionDone.has(id) && !newAppState.cleared.includes(id));

    // 効果音：この回答でレベルを「今」全クリア＝解禁したらファンファーレ。
    // 単語ごとの正解/不正解音は答え合わせ時（Quiz の handleReveal）で鳴らす。
    const levelNowCleared =
      allWordIds.length > 0 && allWordIds.every((id) => newAppState.cleared.includes(id));
    const levelWasCleared =
      allWordIds.length > 0 && allWordIds.every((id) => appState.cleared.includes(id));
    if (levelNowCleared && !levelWasCleared) sfx.play('fanfare');

    if (nextWordId) setScreen({ type: 'quiz', levelId: screen.levelId, wordIds: [nextWordId] });
    else setScreen({ type: 'result', levelId: screen.levelId, scores: accumulated });
  };

  // 初回マウント前（SSR / ハイドレーション直後）は背景だけのプレースホルダー
  if (!appState) return <div className="min-h-screen bg-slate-50" />;

  const surveyOverlay = showSurvey ? (
    <SurveyPrompt url={store.SURVEY_URL} onDismiss={dismissSurvey} />
  ) : null;

  if (screen.type === 'home')
    return (
      <React.Fragment>
        <HomeScreen appState={appState} onNavigate={handleNavigate} />
        {surveyOverlay}
      </React.Fragment>
    );

  if (screen.type === 'quiz') {
    const level = getLevel(screen.levelId);
    const allWordIds = (level && level.wordIds) || [];
    const sessionDone = new Set(sessionScores.map((s) => s.wordId));
    const currentWordId = screen.wordIds && screen.wordIds[0];
    if (currentWordId) sessionDone.add(currentWordId);
    const hasNext = allWordIds.some((id) => !sessionDone.has(id) && !appState.cleared.includes(id));

    // レベル内位置表示用：未クリア語を順に解いている文脈でのみ渡す
    const levelUncleared = allWordIds.filter((id) => !appState.cleared.includes(id));
    const isLevelContext = levelUncleared.length > 0 && !screen.isRetry;
    const levelWordIndex = isLevelContext ? sessionScores.length : null;
    const levelWordCount = isLevelContext ? levelUncleared.length + sessionScores.length : null;

    return (
      <QuizScreen
        key={(screen.wordIds || []).join(',') || screen.levelId}
        levelId={screen.levelId}
        wordIds={screen.wordIds}
        hasNext={hasNext}
        bookmarks={appState.bookmarks}
        onToggleBookmark={handleToggleBookmark}
        savedSenses={appState.savedSenses}
        onToggleSavedSense={handleToggleSavedSense}
        onDone={handleQuizDone}
        onBack={handleQuizBack}
        levelWordIndex={levelWordIndex}
        levelWordCount={levelWordCount}
      />
    );
  }

  if (screen.type === 'result')
    return (
      <React.Fragment>
        <ResultScreen scores={screen.scores} levelId={screen.levelId} appState={appState} onNavigate={handleNavigate} />
        {surveyOverlay}
      </React.Fragment>
    );

  if (screen.type === 'wordbook')
    return <WordbookScreen appState={appState} onToggleBookmark={handleToggleBookmark} onToggleSavedSense={handleToggleSavedSense} onNavigate={handleNavigate} />;

  if (screen.type === 'my')
    return <MyWordbookScreen appState={appState} onToggleBookmark={handleToggleBookmark} onToggleSavedSense={handleToggleSavedSense} onNavigate={handleNavigate} />;

  if (screen.type === 'stats') return <StatsScreen appState={appState} onNavigate={handleNavigate} />;

  return null;
}
