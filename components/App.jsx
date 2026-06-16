'use client';

// components/App.jsx — ルーター（URLは使わず state 1個で管理）
// tagico-studio/v2-app.jsx の App の移植。
// 進捗は localStorage（'tagico-v2-state'）にあるため、SSR とのハイドレーション不一致を
// 避けるべく、マウント後に getState() を読んでから描画する（それまでは背景のみ）。
//
// 2026-06-16: 任意ログイン＋進捗同期（Supabase Auth）＋PostHog 継続率計測を追加。
//   - ログインは任意。未ログインでも全機能を使える（localStorage は変更なし）。
//   - ログイン時: localStorage の進捗を Supabase へ push（マージ）し、以後サーバー優先。
//   - PostHog: 全ユーザー（未ログイン含む）の匿名 ID で D1/D7/D30 継続率を計測。
//   - Supabase / PostHog の鍵が未設定でも動作する（環境変数 = null → no-op）。

import React, { useState, useEffect } from 'react';
import { HomeScreen, WordbookScreen } from '@/components/Home';
import { QuizScreen, ResultScreen } from '@/components/Quiz';
import { MyWordbookScreen, StatsScreen } from '@/components/Extra';
import { SurveyPrompt } from '@/components/Survey';
import AuthModal from '@/components/AuthModal';
import AuthButton from '@/components/AuthButton';
import AccountSheet from '@/components/AccountSheet';
import { getLevel, WORDS } from '@/lib/content';
import * as store from '@/lib/store';
import * as sfx from '@/lib/sfx';
import * as srs from '@/lib/srs';
import { clearLocal as clearStoreLocal } from '@/lib/store';
import { clearLocal as clearSrsLocal } from '@/lib/srs';
import { onAuthStateChange, signOut } from '@/lib/auth';
import { pushProgress } from '@/lib/sync';
import { initPostHog, identifyUser, resetPostHog } from '@/lib/posthog';

export default function App() {
  const [screen, setScreen] = useState({ type: 'home' });
  const [appState, setAppState] = useState(null); // マウント後に localStorage から読む
  const [sessionScores, setSessionScores] = useState([]);
  const [showSurvey, setShowSurvey] = useState(false); // Level 1 完走後アンケート誘導（一度きり）
  const [srsState, setSrsState] = useState(null); // SRS データ（マウント後に読む）
  const [session, setSession] = useState(null); // Supabase Auth セッション（null = 未ログイン）
  const [showAuthModal, setShowAuthModal] = useState(false); // AuthModal 表示フラグ
  const [showAccountSheet, setShowAccountSheet] = useState(false); // AccountSheet 表示フラグ

  useEffect(() => {
    // 基本の初期化（既存処理と変わらない）
    setAppState(store.getState());
    setSrsState(srs.getSrs());
    sfx.initSfx();

    // PostHog 初期化（鍵未設定なら no-op）
    initPostHog();

    // iOS/モバイル Safari の autoplay 対策：最初のユーザー操作で AudioContext を unlock/resume。
    const unlock = () => {
      sfx.unlockAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);

    // Supabase Auth: 初回セッション取得 + Auth 状態変化リスナー登録
    // Supabase が未設定（supabase === null）の場合は onAuthStateChange が no-op を返す
    //
    // イベント名（event）を見てログアウトと匿名ロードを区別する:
    //   SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION(session!=null): ログイン/リフレッシュ
    //   INITIAL_SESSION(session=null): 匿名ユーザーのリロード → localStorage を消さない
    //   SIGNED_OUT: supabase.auth.signOut() が呼ばれた時だけ（ここでは到達しない。
    //               明示ログアウトは onLogout ハンドラで flush → clear する）
    const unsubscribe = onAuthStateChange(async (event, newSession) => {
      setSession(newSession);

      if (newSession && newSession.user) {
        // ログイン / セッション更新: PostHog でユーザーを識別 + 進捗を Supabase へ push（マージ）
        identifyUser(newSession.user.id, { email: newSession.user.email });

        const localState = store.getState();
        const localSrs = srs.getSrs();
        const { mergedState, mergedSrs } = await pushProgress(
          newSession.user.id,
          localState,
          localSrs
        );
        if (mergedState) {
          store.saveState(mergedState);
          setAppState(mergedState);
        } else {
          // mergedState が null のケース:
          //   - 所有者ガード発火（別ユーザーBの初回ログイン）: pushProgress 内で
          //     clearStoreLocal が済んでいるため localStorage は既定値。
          //     React メモリを即同期しないと B の画面に A の進捗が残るので必ず反映する。
          //   - 新規ユーザーB（サーバー行なし）: マウント時の既定値と一致するので no-op 相当。
          setAppState(store.getState());
        }
        if (mergedSrs) {
          srs.saveSrs(mergedSrs);
          setSrsState(mergedSrs);
        } else {
          // 同上（SRS も同じ理由で必ず既定値を反映する）
          setSrsState(srs.getSrs());
        }
      } else {
        // session が null のケース（INITIAL_SESSION(匿名)/TOKEN_REFRESHED失敗/SIGNED_OUT 等）:
        // localStorage は絶対にクリアしない（匿名リロードで進捗が消えるバグを防ぐ）。
        // PostHog の匿名 ID をリセットするのみ。
        // 明示ログアウト時のクリアは onLogout ハンドラで flush 後に行う（下記参照）。
        resetPostHog();
      }
    });

    // supabase-js v2 は onAuthStateChange が INITIAL_SESSION イベントを
    // マウント直後に発火し、現行セッションをコールバックに渡す。
    // そのため getSession().then(pushProgress) は不要（二重発火の原因になる）。
    // リロード時のログイン状態復元・進捗 push は上の onAuthStateChange で完結する。

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (screen.type !== 'quiz' && screen.type !== 'review' && screen.type !== 'srs-review') return;
    const wasLevel1Mastered = store.isLevel1Mastered(appState);
    const newAppState = store.recordScores(appState, scores);
    setAppState(newAppState);

    // SRS: 語義単位ミスを記録
    // SRS 復習モード中の再ミス（「答えを見る」含む）は recordReviewMiss でチェックポイント全リセット
    if (srsState) {
      const today = srs.todayLocalStr();
      const srsMisses = store.extractSrsMisses(scores);
      let newSrsState = srsState;
      if (screen.type === 'srs-review') {
        // 復習中の再ミス: 誤答日起点で +1/+3/+7/+30 を全リセット
        srsMisses.forEach(({ senseId }) => {
          newSrsState = srs.recordReviewMiss(newSrsState, senseId, today);
        });
        // 正解した語義は reviewedOn に記録
        scores.forEach((score) => {
          if (!score.senseResults) return;
          score.senseResults.forEach((sr) => {
            if (sr.correct) {
              newSrsState = srs.recordReview(newSrsState, sr.senseId, today);
            }
          });
        });
      } else {
        // 通常クイズ: 初回ミスを登録
        srsMisses.forEach(({ senseId, wordId }) => {
          newSrsState = srs.recordMiss(newSrsState, senseId, wordId, today);
        });
      }
      srs.saveSrs(newSrsState);
      setSrsState(newSrsState);
    }

    // Level 1（5語）を「今」完走したタイミングで一度だけアンケート誘導を出す
    if (!wasLevel1Mastered && store.isLevel1Mastered(newAppState) && !store.hasSurveyBeenPrompted()) {
      setShowSurvey(true);
    }

    // 間違い復習モード：1セッション（全プール1周）消化後にホームへ戻る
    // このセッションで既に解いた単語（accumulated）を除いた次の語を探す
    if (screen.type === 'review') {
      const accumulated = [...sessionScores, ...scores];
      setSessionScores(accumulated);
      const donIds = new Set(accumulated.map((s) => s.wordId));
      // 今回のセッション開始時点のプールから、まだ解いていない語を次として選ぶ
      const sessionPool = screen.sessionPool || (appState.reviewPool || []);
      const nextReviewId = sessionPool.find((id) => !donIds.has(id));
      if (nextReviewId) {
        setScreen({ type: 'review', wordIds: [nextReviewId], sessionPool });
      } else {
        handleNavigate({ type: 'home' });
      }
      return;
    }

    // SRS 復習モード：今日の期日語義を単語単位で1周
    if (screen.type === 'srs-review') {
      const accumulated = [...sessionScores, ...scores];
      setSessionScores(accumulated);
      const doneWordIds = new Set(accumulated.map((s) => s.wordId));
      const sessionWords = screen.sessionWords || [];
      const nextWord = sessionWords.find((w) => !doneWordIds.has(w.wordId));
      if (nextWord) {
        setScreen({
          type: 'srs-review',
          wordIds: [nextWord.wordId],
          srsContext: { senseIds: nextWord.senseIds, earliestMiss: nextWord.earliestMiss },
          sessionWords,
        });
      } else {
        handleNavigate({ type: 'home' });
      }
      return;
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

    // replay モード（「もう一度」）は completed を無視して replayWordIds 全語を順に回す
    const isReplay = !!screen.replay;
    const replayWordIds = screen.replayWordIds || allWordIds;
    const nextWordId = isReplay
      ? replayWordIds.find((id) => !sessionDone.has(id))
      : allWordIds.find(
          (id) => !sessionDone.has(id) && !(newAppState.completed || newAppState.cleared).includes(id)
        );

    // 効果音：この回答でレベルを「今」全完走＝解禁したらファンファーレ。
    // 完走判定は completed で行う（誤答・答え見含む）。replay 中は鳴らさない（既存完走済みのため）。
    if (!isReplay) {
      const newCompleted = newAppState.completed || newAppState.cleared;
      const prevCompleted = appState.completed || appState.cleared;
      const levelNowCompleted =
        allWordIds.length > 0 && allWordIds.every((id) => newCompleted.includes(id));
      const levelWasCompleted =
        allWordIds.length > 0 && allWordIds.every((id) => prevCompleted.includes(id));
      if (levelNowCompleted && !levelWasCompleted) sfx.play('fanfare');
    }

    if (nextWordId) setScreen({ type: 'quiz', levelId: screen.levelId, wordIds: [nextWordId], replay: isReplay, replayWordIds: isReplay ? replayWordIds : undefined });
    else setScreen({ type: 'result', levelId: screen.levelId, scores: accumulated });
  };

  // 初回マウント前（SSR / ハイドレーション直後）は背景だけのプレースホルダー
  if (!appState) return <div className="min-h-screen bg-slate-50" />;

  // プレビュー環境（VERCEL_ENV=preview）では全単語をデフォルトアンロック扱いにする。
  // ロック判定は appState.completed の有無で行われるため、全 wordId を completed に含めた
  // 仮の appState を下流に渡す。localStorage は書き換えず読み取り専用の上書きにとどめる。
  // production（tagico-web.vercel.app）では isPreviewMode()=false のため効かない。
  const effectiveAppState = store.isPreviewMode()
    ? { ...appState, completed: WORDS.map((w) => w.id) }
    : appState;

  // SRS: 今日の復習件数を計算（srsState が null の間は 0 扱い）
  const todayStr = srs.todayLocalStr();
  const todaySrsItems = srsState ? srs.getTodayReviewItems(srsState, todayStr) : [];
  const srsReviewCount = todaySrsItems.length;

  // SRS 復習開始ハンドラ: 今日の復習語義を単語単位にグループ化してセッション開始
  const handleSrsReview = () => {
    if (!srsState || srsReviewCount === 0) return;
    sfx.play('ui');
    setSessionScores([]);
    const sessionWords = srs.groupReviewByWord(todaySrsItems);
    if (sessionWords.length === 0) return;
    const first = sessionWords[0];
    setScreen({
      type: 'srs-review',
      wordIds: [first.wordId],
      srsContext: { senseIds: first.senseIds, earliestMiss: first.earliestMiss },
      sessionWords,
    });
  };

  const surveyOverlay = showSurvey ? (
    <SurveyPrompt url={store.SURVEY_URL} onDismiss={dismissSurvey} />
  ) : null;

  // AuthButton: ホームヘッダー右上に配置するコンポーネント（他の画面には表示しない）
  const authButton = (
    <AuthButton
      session={session}
      onLogin={() => setShowAuthModal(true)}
      onOpenAccount={() => setShowAccountSheet(true)}
    />
  );

  // AuthModal: ログインモーダル（showAuthModal が true のときのみ表示）
  const authModal = showAuthModal ? (
    <AuthModal onClose={() => setShowAuthModal(false)} />
  ) : null;

  // AccountSheet: ログイン中アバタータップで開くアカウント情報シート
  const accountSheet = showAccountSheet ? (
    <AccountSheet
      session={session}
      onLogout={async () => {
        // 明示ログアウト時のフロー（順序厳守）:
        // 1. ログイン中の有効 JWT でサーバーへ flush（signOut より前に実行することで
        //    RLS の auth.uid() 照合が通る。flush 後に JWT を破棄する）
        // 2. signOut（JWT 破棄）
        // 3. flush が成功した場合のみ clearStoreLocal/clearSrsLocal
        //    （flush 失敗時はローカルに残してデータを守る安全弁）
        // 4. メモリ上の state を既定値にリセット
        const logoutUserId = session && session.user ? session.user.id : null;
        let flushOk = false;
        if (logoutUserId) {
          const localState = store.getState();
          const localSrs = srs.getSrs();
          const { error } = await pushProgress(logoutUserId, localState, localSrs);
          flushOk = !error;
        } else {
          // 未ログイン状態からのログアウト（通常は起きないが念のため）
          flushOk = true;
        }
        await signOut();
        if (flushOk) {
          clearStoreLocal();
          clearSrsLocal();
        }
        setAppState(store.getState());
        setSrsState(srs.getSrs());
        setSession(null);
        resetPostHog();
        setShowAccountSheet(false);
      }}
      onClose={() => setShowAccountSheet(false)}
    />
  ) : null;

  if (screen.type === 'home')
    return (
      <React.Fragment>
        <HomeScreen
          appState={effectiveAppState}
          rawAppState={appState}
          onNavigate={handleNavigate}
          srsReviewCount={srsReviewCount}
          onSrsReview={handleSrsReview}
          authButton={authButton}
        />
        {surveyOverlay}
        {authModal}
        {accountSheet}
      </React.Fragment>
    );

  if (screen.type === 'quiz') {
    const level = getLevel(screen.levelId);
    const allWordIds = (level && level.wordIds) || [];
    const sessionDone = new Set(sessionScores.map((s) => s.wordId));
    const currentWordId = screen.wordIds && screen.wordIds[0];
    if (currentWordId) sessionDone.add(currentWordId);
    const completed = effectiveAppState.completed || effectiveAppState.cleared;

    // replay モード（「もう一度」）：completed を無視して replayWordIds 全語を対象にする
    const isReplay = !!screen.replay;
    const replayWordIds = screen.replayWordIds || allWordIds;
    const hasNext = isReplay
      ? replayWordIds.some((id) => !sessionDone.has(id))
      : allWordIds.some((id) => !sessionDone.has(id) && !completed.includes(id));

    // レベル内位置表示用：replay は全語数、通常は未完走語数ベース
    const isLevelContext = !screen.isRetry && (isReplay ? replayWordIds.length > 0 : allWordIds.some((id) => !completed.includes(id)));
    const levelWordIndex = isLevelContext ? sessionScores.length : null;
    const levelWordCount = isLevelContext
      ? (isReplay ? replayWordIds.length : allWordIds.filter((id) => !completed.includes(id)).length + sessionScores.length)
      : null;

    return (
      <QuizScreen
        key={(screen.wordIds || []).join(',') || screen.levelId}
        levelId={screen.levelId}
        wordIds={screen.wordIds}
        hasNext={hasNext}
        bookmarks={effectiveAppState.bookmarks}
        onToggleBookmark={handleToggleBookmark}
        savedSenses={effectiveAppState.savedSenses}
        onToggleSavedSense={handleToggleSavedSense}
        onDone={handleQuizDone}
        onBack={handleQuizBack}
        levelWordIndex={levelWordIndex}
        levelWordCount={levelWordCount}
      />
    );
  }

  if (screen.type === 'review') {
    // sessionPool: このセッションで消化するプール（開始時点で確定・変化しない）
    const sessionPool = screen.sessionPool || (effectiveAppState.reviewPool || []);
    // 復習する単語ID：screen.wordIds があればそれ、なければプールの先頭
    const wordIds = screen.wordIds || (sessionPool.length > 0 ? [sessionPool[0]] : []);
    const reviewTotal = sessionPool.length;
    // 位置表示：復習モードは「復習 n/N」表示（sessionScores で何問目か）
    const reviewIndex = sessionScores.length;

    const doneInSession = new Set(sessionScores.map((s) => s.wordId));
    if (wordIds[0]) doneInSession.add(wordIds[0]);
    return (
      <QuizScreen
        key={wordIds.join(',') + '-review'}
        levelId={null}
        wordIds={wordIds}
        hasNext={sessionPool.some((id) => !doneInSession.has(id))}
        bookmarks={effectiveAppState.bookmarks}
        onToggleBookmark={handleToggleBookmark}
        savedSenses={effectiveAppState.savedSenses}
        onToggleSavedSense={handleToggleSavedSense}
        onDone={handleQuizDone}
        onBack={handleQuizBack}
        levelWordIndex={reviewTotal > 0 ? reviewIndex : null}
        levelWordCount={reviewTotal > 0 ? reviewTotal : null}
        isReviewMode={true}
      />
    );
  }

  if (screen.type === 'srs-review') {
    // SRS 語義単位の復習モード
    const sessionWords = screen.sessionWords || [];
    const wordIds = screen.wordIds || (sessionWords.length > 0 ? [sessionWords[0].wordId] : []);
    const srsContextForScreen = screen.srsContext || (
      sessionWords.length > 0
        ? { senseIds: sessionWords[0].senseIds, earliestMiss: sessionWords[0].earliestMiss }
        : null
    );
    const reviewTotal = sessionWords.length;
    const reviewIndex = sessionScores.length;
    const doneInSession = new Set(sessionScores.map((s) => s.wordId));
    if (wordIds[0]) doneInSession.add(wordIds[0]);

    return (
      <QuizScreen
        key={wordIds.join(',') + '-srs-review'}
        levelId={null}
        wordIds={wordIds}
        hasNext={sessionWords.some((w) => !doneInSession.has(w.wordId))}
        bookmarks={effectiveAppState.bookmarks}
        onToggleBookmark={handleToggleBookmark}
        savedSenses={effectiveAppState.savedSenses}
        onToggleSavedSense={handleToggleSavedSense}
        onDone={handleQuizDone}
        onBack={handleQuizBack}
        levelWordIndex={reviewTotal > 0 ? reviewIndex : null}
        levelWordCount={reviewTotal > 0 ? reviewTotal : null}
        isReviewMode={true}
        isSrsReview={true}
        srsContext={srsContextForScreen}
      />
    );
  }

  if (screen.type === 'result')
    return (
      <React.Fragment>
        <ResultScreen scores={screen.scores} levelId={screen.levelId} appState={effectiveAppState} onNavigate={handleNavigate} />
        {surveyOverlay}
      </React.Fragment>
    );

  if (screen.type === 'wordbook')
    return <WordbookScreen appState={effectiveAppState} onToggleBookmark={handleToggleBookmark} onToggleSavedSense={handleToggleSavedSense} onNavigate={handleNavigate} />;

  if (screen.type === 'my')
    return <MyWordbookScreen appState={effectiveAppState} onToggleBookmark={handleToggleBookmark} onToggleSavedSense={handleToggleSavedSense} onNavigate={handleNavigate} />;

  if (screen.type === 'stats') return <StatsScreen appState={effectiveAppState} onNavigate={handleNavigate} />;

  return null;
}
