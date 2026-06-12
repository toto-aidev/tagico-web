'use client';

// components/App.jsx — ルーター（URLは使わず state 1個で管理）
// tagico-studio/v2-app.jsx の App の移植。
// 進捗は localStorage（'tagico-v2-state'）にあるため、SSR とのハイドレーション不一致を
// 避けるべく、マウント後に getState() を読んでから描画する（それまでは背景のみ）。

import React, { useState, useEffect } from 'react';
import { HomeScreen, WordbookScreen } from '@/components/Home';
import { QuizScreen, ResultScreen } from '@/components/Quiz';
import { MyWordbookScreen, StatsScreen } from '@/components/Extra';
import { getLevel } from '@/lib/content';
import * as store from '@/lib/store';

export default function App() {
  const [screen, setScreen] = useState({ type: 'home' });
  const [appState, setAppState] = useState(null); // マウント後に localStorage から読む
  const [sessionScores, setSessionScores] = useState([]);

  useEffect(() => {
    setAppState(store.getState());
  }, []);

  const handleNavigate = (s) => {
    setSessionScores([]);
    setScreen(s);
  };

  const handleToggleBookmark = (wordId) => setAppState((s) => store.toggleBookmark(s, wordId));
  const handleToggleSavedSense = (wordId, senseIdx) =>
    setAppState((s) => store.toggleSavedSense(s, wordId, senseIdx));

  const handleQuizDone = (scores) => {
    if (screen.type !== 'quiz') return;
    const newAppState = store.recordScores(appState, scores);
    setAppState(newAppState);

    const accumulated = [...sessionScores, ...scores];
    setSessionScores(accumulated);

    const level = getLevel(screen.levelId);
    const allWordIds = (level && level.wordIds) || [];
    const sessionDone = new Set(accumulated.map((s) => s.wordId));
    const nextWordId = allWordIds.find((id) => !sessionDone.has(id) && !newAppState.cleared.includes(id));

    if (nextWordId) setScreen({ type: 'quiz', levelId: screen.levelId, wordIds: [nextWordId] });
    else setScreen({ type: 'result', levelId: screen.levelId, scores: accumulated });
  };

  // 初回マウント前（SSR / ハイドレーション直後）は背景だけのプレースホルダー
  if (!appState) return <div className="min-h-screen bg-slate-50" />;

  if (screen.type === 'home') return <HomeScreen appState={appState} onNavigate={handleNavigate} />;

  if (screen.type === 'quiz') {
    const level = getLevel(screen.levelId);
    const allWordIds = (level && level.wordIds) || [];
    const sessionDone = new Set(sessionScores.map((s) => s.wordId));
    const currentWordId = screen.wordIds && screen.wordIds[0];
    if (currentWordId) sessionDone.add(currentWordId);
    const hasNext = allWordIds.some((id) => !sessionDone.has(id) && !appState.cleared.includes(id));

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
        onBack={() => handleNavigate({ type: 'home' })}
      />
    );
  }

  if (screen.type === 'result')
    return <ResultScreen scores={screen.scores} levelId={screen.levelId} appState={appState} onNavigate={handleNavigate} />;

  if (screen.type === 'wordbook')
    return <WordbookScreen appState={appState} onToggleBookmark={handleToggleBookmark} onToggleSavedSense={handleToggleSavedSense} onNavigate={handleNavigate} />;

  if (screen.type === 'my')
    return <MyWordbookScreen appState={appState} onToggleBookmark={handleToggleBookmark} onToggleSavedSense={handleToggleSavedSense} onNavigate={handleNavigate} />;

  if (screen.type === 'stats') return <StatsScreen appState={appState} onNavigate={handleNavigate} />;

  return null;
}
