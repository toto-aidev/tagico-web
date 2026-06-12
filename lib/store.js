// lib/store.js — 進捗の永続化と集計（tagico-studio/v2-store.js の移植）
// localStorage キーは 'tagico-v2-state' 1つに集約（Studio 版とキー互換）。
// 前方互換マージで既存保存を壊さない。SSR では既定値を返す。

import { WORDS } from '@/lib/content';

const STORAGE_KEY = 'tagico-v2-state';

const defaultState = {
  cleared: [], // 全問正解した単語IDの配列
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

// scores: [{ wordId, correct, total, trapHit }]
export function recordScores(state, scores) {
  const today = todayStr();
  const yesterday = yesterdayStr();

  const newHistory = { ...state.history };
  const newCleared = [...state.cleared];
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
    if (score.correct === score.total && !newCleared.includes(score.wordId)) {
      newCleared.push(score.wordId);
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
