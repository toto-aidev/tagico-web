// lib/store.js — 進捗の永続化と集計（tagico-studio/v2-store.js の移植）
// localStorage キーは 'tagico-v2-state' 1つに集約（Studio 版とキー互換）。
// 前方互換マージで既存保存を壊さない。SSR では既定値を返す。

import { WORDS, LEVELS } from '@/lib/content';

const STORAGE_KEY = 'tagico-v2-state';

// 使用後アンケート（Tally）誘導の URL と「一度きり表示」フラグ用キー。
// 進捗本体（STORAGE_KEY）とは別キーに分離し、既存の保存を一切壊さない。
export const SURVEY_URL = 'https://tally.so/r/Y59K2B';
const SURVEY_FLAG_KEY = 'tagico-v2-survey-prompted';

const defaultState = {
  cleared: [], // 全問正解した単語IDの配列（実績・緑チェック用）
  completed: [], // 完走した単語IDの配列（誤答・答え見含む。次の単語/レベル解禁に使う）
  reviewPool: [], // 間違い復習プール：直近完走で誤答 or 答え見があった単語ID
  history: {}, // wordId -> { correct, total, trapHit, attempts, bestScore }
  bookmarks: [], // ブックマークした単語ID（マイ単語帳）
  savedSenses: [], // 忘れがちな用法：'wordId:senseIdx' の配列
  trapHits: 0, // 罠に掛かった累計
  trapAvoids: 0, // 罠を避けた累計
  days: {}, // dateStr -> その日に完了した単語数
  streakDays: 0,
  lastStudiedDate: '',
};

export function getState() {
  if (typeof window === 'undefined') return { ...defaultState };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const saved = JSON.parse(raw) || {};
    const merged = { ...defaultState, ...saved };
    // 旧スキーマ（cleared がオブジェクト等）からの移行: 型を既定値に合わせて正規化
    if (!Array.isArray(merged.cleared)) merged.cleared = [];
    // 後方互換: 旧データに completed がない場合は cleared を引き継ぐ（全問正解＝完走と見なす）
    if (!Array.isArray(merged.completed)) merged.completed = [...merged.cleared];
    if (!Array.isArray(merged.reviewPool)) merged.reviewPool = [];
    if (typeof merged.history !== 'object' || merged.history === null) merged.history = {};
    if (typeof merged.streakDays !== 'number') merged.streakDays = 0;
    if (typeof merged.lastStudiedDate !== 'string') merged.lastStudiedDate = '';
    if (!Array.isArray(merged.bookmarks)) merged.bookmarks = [];
    if (!Array.isArray(merged.savedSenses)) merged.savedSenses = [];
    if (typeof merged.trapHits !== 'number') merged.trapHits = 0;
    if (typeof merged.trapAvoids !== 'number') merged.trapAvoids = 0;
    if (typeof merged.days !== 'object' || merged.days === null) merged.days = {};
    // 削除された（もう存在しない）単語IDを進捗から掃除
    const ids = WORDS.map((w) => w.id);
    if (ids.length) {
      merged.cleared = merged.cleared.filter((id) => ids.indexOf(id) >= 0);
      merged.completed = merged.completed.filter((id) => ids.indexOf(id) >= 0);
      merged.reviewPool = merged.reviewPool.filter((id) => ids.indexOf(id) >= 0);
      merged.bookmarks = merged.bookmarks.filter((id) => ids.indexOf(id) >= 0);
      merged.savedSenses = merged.savedSenses.filter(
        (k) => ids.indexOf(String(k).split(':')[0]) >= 0
      );
      const h2 = {};
      Object.keys(merged.history).forEach((k) => {
        if (ids.indexOf(k) >= 0) h2[k] = merged.history[k];
      });
      merged.history = h2;
    }
    return merged;
  } catch (e) {
    return { ...defaultState };
  }
}

export function saveState(state) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

// scores: [{ wordId, correct, total, trapHit, seeAnswer? }]
// seeAnswer: 「答えを見る」ボタンを使った場合 true
export function recordScores(state, scores) {
  const today = todayStr();
  const yesterday = yesterdayStr();

  const newHistory = { ...state.history };
  const newCleared = [...state.cleared];
  const newCompleted = [...(state.completed || [])];
  let newReviewPool = [...(state.reviewPool || [])];
  let trapHits = state.trapHits || 0;
  let trapAvoids = state.trapAvoids || 0;
  const newDays = { ...(state.days || {}) };

  for (const score of scores) {
    const prev = newHistory[score.wordId] || {
      correct: 0,
      total: score.total,
      trapHit: false,
      attempts: 0,
      bestScore: 0,
    };
    newHistory[score.wordId] = {
      correct: score.correct,
      total: score.total,
      trapHit: score.trapHit,
      attempts: prev.attempts + 1,
      bestScore: Math.max(prev.bestScore, score.correct),
    };
    // cleared: 全問正解のみ（実績・緑チェック用）
    if (score.correct === score.total && !newCleared.includes(score.wordId)) {
      newCleared.push(score.wordId);
    }
    // completed: 完走したら無条件で追加（誤答・答え見含む。解禁用）
    if (!newCompleted.includes(score.wordId)) {
      newCompleted.push(score.wordId);
    }
    // reviewPool の更新
    const hasError = score.correct < score.total || score.seeAnswer;
    if (hasError) {
      // 誤答 or 答え見あり → プールに入れる（なければ追加）
      if (!newReviewPool.includes(score.wordId)) {
        newReviewPool.push(score.wordId);
      }
    } else {
      // 全問正解かつ答え見なし → プールから除外
      newReviewPool = newReviewPool.filter((id) => id !== score.wordId);
    }
    if (score.trapHit) trapHits += 1;
    else trapAvoids += 1;
  }
  newDays[today] = (newDays[today] || 0) + scores.length;

  // ストリーク: 今日学習済みなら据え置き / 昨日が最終なら+1 / それ以外は1にリセット
  const newStreak =
    state.lastStudiedDate === today
      ? state.streakDays
      : state.lastStudiedDate === yesterday
        ? state.streakDays + 1
        : 1;

  const next = {
    ...state,
    cleared: newCleared,
    completed: newCompleted,
    reviewPool: newReviewPool,
    history: newHistory,
    trapHits,
    trapAvoids,
    days: newDays,
    streakDays: newStreak,
    lastStudiedDate: today,
  };
  saveState(next);
  return next;
}

// ブックマークのトグル（マイ単語帳への追加/削除）
export function toggleBookmark(state, wordId) {
  const bookmarks = state.bookmarks || [];
  const next = {
    ...state,
    bookmarks:
      bookmarks.indexOf(wordId) >= 0
        ? bookmarks.filter((id) => id !== wordId)
        : bookmarks.concat([wordId]),
  };
  saveState(next);
  return next;
}

// 忘れがちな用法（語義カード単位）の保存トグル
export function toggleSavedSense(state, wordId, senseIdx) {
  const key = wordId + ':' + senseIdx;
  const saved = state.savedSenses || [];
  const next = {
    ...state,
    savedSenses:
      saved.indexOf(key) >= 0 ? saved.filter((k) => k !== key) : saved.concat([key]),
  };
  saveState(next);
  return next;
}

// ===== 使用後アンケート（Level 1 完走トリガー）=====
// Level 1（最初のレベル）の全 wordId が cleared（＝全問正解でマスター）か。
export function isLevel1Mastered(state) {
  const level1 = LEVELS && LEVELS[0];
  if (!level1 || !Array.isArray(level1.wordIds) || level1.wordIds.length === 0) return false;
  const cleared = (state && state.cleared) || [];
  return level1.wordIds.every((id) => cleared.indexOf(id) >= 0);
}

// アンケート誘導をすでに一度表示したか（localStorage の専用フラグで判定）。
export function hasSurveyBeenPrompted() {
  if (typeof window === 'undefined') return true; // SSR では出さない
  try {
    return window.localStorage.getItem(SURVEY_FLAG_KEY) === '1';
  } catch (e) {
    return true;
  }
}

// アンケート誘導を表示済みとして記録（以後は再表示しない）。
export function markSurveyPrompted() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SURVEY_FLAG_KEY, '1');
  } catch (e) {
    /* localStorage 不可環境では黙って無視 */
  }
}

// ===== SRS（間隔反復）連携ユーティリティ =====
// SRS 永続化は lib/srs.js の getSrs/saveSrs が担う。
// ここでは「クイズ結果から SRS ミスリストを抽出する」ヘルパーだけを置く。
//
// scores: [{ wordId, correct, total, trapHit, seeAnswer?, senseResults? }]
// senseResults: [{ senseId, correct: bool }] — 語義単位の正誤（Quiz.jsx から渡す）
//
// 返り値: [{ senseId, wordId }] — ミスした語義（SRS に登録すべきもの）
export function extractSrsMisses(scores) {
  const misses = [];
  for (const score of scores) {
    if (!score.senseResults) continue;
    for (const sr of score.senseResults) {
      if (!sr.correct) {
        misses.push({ senseId: sr.senseId, wordId: score.wordId });
      }
    }
  }
  return misses;
}

// ===== プレビュー環境（dev ブランチ）限定：全単語デフォルトアンロック =====
// Vercel preview（NEXT_PUBLIC_VERCEL_ENV=preview）でのみ true を返す。
// production（tagico-web.vercel.app）やローカル（未設定）では false。
// Home.jsx / App.jsx でこのフラグを参照し、completed を全 wordId で上書きする。
export function isPreviewMode() {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';
}

// 単語名で決定論的にシャッフル（毎回同じ並び＝選択肢プールが安定）
export function seededShuffle(arr, seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  let s = Math.abs(hash) || 1;
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
