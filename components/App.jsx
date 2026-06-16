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
//
// 2026-06-16: リロード時の現在地保持を追加（改修1）。
//   - screen state を localStorage('tagico-session-v1')に保存し、マウント時に復元する。
//   - ホーム以外の画面（quiz/review/srs-review）にいる場合はリロード後も続きから再開。
//   - 復元した screen が有効なデータを指している場合のみ適用（存在しない wordId は弾く）。

import React, { useState, useEffect } from 'react';
import { HomeScreen, WordbookScreen } from '@/components/Home';
import { QuizScreen, ResultScreen } from '@/components/Quiz';
import { MyWordbookScreen, StatsScreen } from '@/components/Extra';
import { SurveyPrompt } from '@/components/Survey';
import AuthModal from '@/components/AuthModal';
import AuthButton from '@/components/AuthButton';
import AccountSheet from '@/components/AccountSheet';
import { getLevel, WORDS, getWord } from '@/lib/content';
import * as store from '@/lib/store';
import * as sfx from '@/lib/sfx';
import * as srs from '@/lib/srs';
import { clearLocal as clearStoreLocal } from '@/lib/store';
import { clearLocal as clearSrsLocal } from '@/lib/srs';

// ===== リロード保持：セッション画面状態の localStorage 保存・復元 =====
const SESSION_SCREEN_KEY = 'tagico-session-v1';

// screen state を localStorage に保存する（ホーム以外のみ）
function saveSessionScreen(screen) {
  if (typeof window === 'undefined') return;
  try {
    if (!screen || screen.type === 'home' || screen.type === 'result') {
      // ホーム・結果画面はクリア（再開不要）
      window.localStorage.removeItem(SESSION_SCREEN_KEY);
    } else {
      window.localStorage.setItem(SESSION_SCREEN_KEY, JSON.stringify(screen));
    }
  } catch (e) {
    /* localStorage 不可環境では黙って無視 */
  }
}

// 保存済みの screen を読み出して有効性チェックし返す
// 無効（存在しない wordId など）なら null を返す
function loadSessionScreen() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_SCREEN_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || !saved.type) return null;
    // quiz/review/srs-review のみ復元対象
    if (!['quiz', 'review', 'srs-review'].includes(saved.type)) return null;

    // review 型補完フォールバック：
    // handleNavigate が sessionPool と wordIds を補完してから saveSessionScreen を呼ぶ設計のため、
    // 通常このブランチには到達しない（デッドコード）。
    // 将来 sessionPool だけ持つ save パスが追加された場合の安全網として残す。
    if (saved.type === 'review' && (!saved.wordIds || saved.wordIds.length === 0)) {
      const pool = (saved.sessionPool || []).filter((id) => !!getWord(id));
      if (pool.length === 0) return null;
      saved.sessionPool = pool;
      saved.wordIds = [pool[0]];
    }

    // wordIds が有効か確認（存在しない単語IDなら弾く）
    const wordIds = saved.wordIds || [];
    if (wordIds.length === 0) return null;
    const valid = wordIds.every((id) => !!getWord(id));
    if (!valid) return null;
    // sessionPool 内の削除済み wordId をフィルタして返す（指摘B対応）
    // コンテンツ更新で消えた wordId が sessionPool に残ると QuizScreen が固まるため、
    // 復元時点で getWord() が undefined を返す ID を除去しておく。
    if (saved.sessionPool) {
      saved.sessionPool = saved.sessionPool.filter((id) => !!getWord(id));
    }
    // srs-review の sessionWords も同様にフィルタ
    if (saved.sessionWords) {
      saved.sessionWords = saved.sessionWords.filter((w) => !!getWord(w.wordId));
    }
    return saved;
  } catch (e) {
    return null;
  }
}
import { onAuthStateChange, signOut } from '@/lib/auth';
import { pushProgress } from '@/lib/sync';
import { initPostHog, identifyUser, resetPostHog, captureEvent } from '@/lib/posthog';

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

    // リロード保持：保存済み画面状態を復元する（改修1）
    // appState の読み込みより後に実行されるが、setAppState は非同期のため
    // screen の復元は appState 読み込みと同タイミングで問題なし。
    const savedScreen = loadSessionScreen();
    if (savedScreen) {
      setScreen(savedScreen);
    }
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
        // identifyUser には UUID のみ渡す（email 等の PII は渡さない）
        identifyUser(newSession.user.id);
        // SIGNED_IN（新規ログイン）のみ login イベントを発火。
        // INITIAL_SESSION（リロード時のセッション復元）・TOKEN_REFRESHED は送らない。
        // method は "email"（マジックリンク）または "google" を provider 情報から判定。
        if (event === 'SIGNED_IN') {
          const provider = newSession.user?.app_metadata?.provider || 'email';
          const method = provider === 'google' ? 'google' : 'email';
          captureEvent('login', { method });
        }

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

  // screen を更新し、同時に localStorage へ保存する（リロード保持・改修1）
  const updateScreen = (s) => {
    setScreen(s);
    saveSessionScreen(s);
  };

  // handleNavigate: 画面遷移の共通ハンドラ。
  // isUserAction=true のときだけ tab_view を送信する。
  // クイズ/復習/リトライ完了後の自動ホーム復帰など、プログラム起点の遷移では false を渡す。
  const handleNavigate = (s, { isUserAction = false } = {}) => {
    sfx.play('ui'); // タブ/画面遷移の汎用クリック
    // tab_view はユーザーが実際にボトムナビをタップした時のみ送信する。
    // 自動遷移（クイズ完了後のホーム戻り等）では isUserAction=false のため送らない。
    const TAB_SCREENS = ['home', 'wordbook', 'my', 'stats'];
    if (isUserAction && TAB_SCREENS.includes(s.type)) {
      captureEvent('tab_view', { tab: s.type });
    }
    setSessionScores([]);
    // review 型でホームから遷移する場合、sessionPool と wordIds が無い状態で
    // saveSessionScreen が呼ばれると、リロード時に復元できない（wordIds が空で null 返却）。
    // ここで sessionPool（= appState.reviewPool）と先頭 wordId を補完しておく。
    if (s.type === 'review' && !s.sessionPool) {
      const pool = appState ? (appState.reviewPool || []) : [];
      const enriched = { ...s, sessionPool: pool, wordIds: pool.length > 0 ? [pool[0]] : [] };
      updateScreen(enriched);
      return;
    }
    updateScreen(s);
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

  const handleToggleBookmark = (wordId) => {
    setAppState((s) => {
      const next = store.toggleBookmark(s, wordId);
      // toggleBookmark 後の状態でブックマーク有無を判定してイベント送信
      const on = (next.bookmarks || []).includes(wordId);
      captureEvent('bookmark_toggled', { word: wordId, on });
      return next;
    });
  };
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
        // reviewedCount を保存しておき、リロード後のカウンター表示を正しく復元する（指摘1対応）
        updateScreen({ type: 'review', wordIds: [nextReviewId], sessionPool, reviewedCount: accumulated.length });
      } else {
        // 間違い復習セッション完了
        const totalCorrect = accumulated.reduce((s, r) => s + r.correct, 0);
        captureEvent('review_completed', { count: accumulated.length, correct: totalCorrect });
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
        // reviewedCount を保存しておき、リロード後のカウンター表示を正しく復元する（レビュー指摘2対応）
        updateScreen({
          type: 'srs-review',
          wordIds: [nextWord.wordId],
          srsContext: { senseIds: nextWord.senseIds, earliestMiss: nextWord.earliestMiss },
          sessionWords,
          reviewedCount: accumulated.length,
        });
      } else {
        // SRS 復習セッション完了
        const totalCorrect = accumulated.reduce((s, r) => s + r.correct, 0);
        captureEvent('review_completed', { count: accumulated.length, correct: totalCorrect });
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

    // 効果音・level_cleared イベント：この回答でレベルを「今」全完走＝解禁したらファンファーレ。
    // 完走判定は completed で行う（誤答・答え見含む）。replay 中は鳴らさない（既存完走済みのため）。
    if (!isReplay) {
      const newCompleted = newAppState.completed || newAppState.cleared;
      const prevCompleted = appState.completed || appState.cleared;
      const levelNowCompleted =
        allWordIds.length > 0 && allWordIds.every((id) => newCompleted.includes(id));
      const levelWasCompleted =
        allWordIds.length > 0 && allWordIds.every((id) => prevCompleted.includes(id));
      if (levelNowCompleted && !levelWasCompleted) {
        sfx.play('fanfare');
        captureEvent('level_cleared', { level: screen.levelId });
      }
    }

    if (nextWordId) updateScreen({ type: 'quiz', levelId: screen.levelId, wordIds: [nextWordId], replay: isReplay, replayWordIds: isReplay ? replayWordIds : undefined });
    else updateScreen({ type: 'result', levelId: screen.levelId, scores: accumulated });
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
    updateScreen({
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
        // SESSION_SCREEN_KEY を必ず削除する（指摘A対応）
        // clearStoreLocal/clearSrsLocal は SESSION_SCREEN_KEY を触らないため、
        // ここで明示的に消す。flush 成否に関わらず常に消す（別ユーザーへの漏れ防止）。
        try { window.localStorage.removeItem(SESSION_SCREEN_KEY); } catch (_) { /* ignore */ }
        setAppState(store.getState());
        setSrsState(srs.getSrs());
        setScreen({ type: 'home' });
        setSession(null);
        captureEvent('logout');
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
        isReplay={!!screen.replay}
        isRetry={!!screen.isRetry}
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
    // リロード後は sessionScores が [] にリセットされるため、screen.reviewedCount（保存済みのリロード前進捗）を
    // ベースに、リロード後に解いた分（sessionScores.length）を加算する（レビュー指摘1対応）。
    // XOR（どちらかを使う）では、リロード後に次の語に進む際に reviewedCount が accumulated.length で
    // 上書きされて逆戻りする。加算にすることで pre-reload + post-reload 進捗が正しく合算される。
    const reviewIndex = (screen.reviewedCount || 0) + sessionScores.length;

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
    // srs-review も review と同様にリロード後のカウンターを復元する（レビュー指摘2対応）
    const reviewIndex = (screen.reviewedCount || 0) + sessionScores.length;
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
