// lib/achievements.js — ティア制実績システム定義と判定ロジック
// 各系統は ACHIEVEMENT_GROUPS に定義。判定は localStorage フラグなし（appState から毎回計算）。

// ─── 系統定義 ────────────────────────────────────────────────────────────────

// コレクター系統はティアごとに参照フィールドが切り替わる（案B: 分割ティア）。
// bookmarks: appState.bookmarks の長さ
// savedSenses: appState.savedSenses の長さ
const COLLECTOR_TIERS = [
  { label: 'I',   threshold: 1,  field: 'bookmarks',   desc: '単語を1語ブックマーク' },
  { label: 'II',  threshold: 5,  field: 'savedSenses', desc: '「忘れがち」用法を5件保存' },
  { label: 'III', threshold: 10, field: 'bookmarks',   desc: '単語を10語ブックマーク' },
  { label: 'IV',  threshold: 20, field: 'savedSenses', desc: '「忘れがち」用法を20件保存' },
  { label: 'V',   threshold: 50, field: 'bookmarks',   desc: '単語を50語ブックマーク' },
];

export const ACHIEVEMENT_GROUPS = [
  {
    id: 'vocab',
    label: '語彙マスター',
    icon: 'star',       // 最終ティアのみ trophy に切り替える（判定ロジック側で処理）
    color: 'amber',
    tiers: [
      { label: 'I',   threshold: 1,   desc: '1語クリア' },
      { label: 'II',  threshold: 10,  desc: '10語クリア' },
      { label: 'III', threshold: 30,  desc: '30語クリア' },
      { label: 'IV',  threshold: 75,  desc: '75語クリア' },
      { label: 'V',   threshold: 150, desc: '150語クリア' },
      { label: 'VI',  threshold: 300, desc: '300語クリア' },
    ],
    getValue: (appState) => (appState.cleared || []).length,
  },
  {
    id: 'streak',
    label: '連続学習',
    icon: 'flame',
    color: 'rose',
    tiers: [
      { label: 'I',   threshold: 3,   desc: '3日連続' },
      { label: 'II',  threshold: 7,   desc: '7日連続' },
      { label: 'III', threshold: 14,  desc: '14日連続' },
      { label: 'IV',  threshold: 30,  desc: '30日連続' },
      { label: 'V',   threshold: 60,  desc: '60日連続' },
      { label: 'VI',  threshold: 100, desc: '100日連続' },
    ],
    getValue: (appState) => appState.streakDays || 0,
  },
  {
    id: 'trap',
    label: '罠ハンター',
    icon: 'sparkles',
    color: 'teal',
    tiers: [
      { label: 'I',   threshold: 5,   desc: '罠5回回避' },
      { label: 'II',  threshold: 20,  desc: '罠20回回避' },
      { label: 'III', threshold: 50,  desc: '罠50回回避' },
      { label: 'IV',  threshold: 100, desc: '罠100回回避' },
      { label: 'V',   threshold: 250, desc: '罠250回回避' },
      { label: 'VI',  threshold: 500, desc: '罠500回回避' },
    ],
    getValue: (appState) => appState.trapAvoids || 0,
  },
  {
    id: 'collector',
    label: 'コレクター',
    icon: 'bookmark',
    color: 'indigo',
    tiers: COLLECTOR_TIERS,
    // コレクターは getValue を持たず、getStatus 内でティアごとに field を参照する。
    getValue: null,
  },
  {
    id: 'attempts',
    label: '挑戦者',
    icon: 'check-circle',
    color: 'slate',
    tiers: [
      { label: 'I',   threshold: 1,    desc: '初チャレンジ' },
      { label: 'II',  threshold: 10,   desc: '10回挑戦' },
      { label: 'III', threshold: 50,   desc: '50回挑戦' },
      { label: 'IV',  threshold: 200,  desc: '200回挑戦' },
      { label: 'V',   threshold: 500,  desc: '500回挑戦' },
      { label: 'VI',  threshold: 1000, desc: '1000回挑戦' },
    ],
    getValue: (appState) =>
      Object.values(appState.history || {}).reduce((s, v) => s + (v.attempts || 0), 0),
  },
];

// ─── カラーマップ ─────────────────────────────────────────────────────────────

export const GROUP_COLOR = {
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-500',  ring: 'ring-amber-200',  bar: 'bg-amber-400' },
  rose:   { bg: 'bg-rose-100',   text: 'text-rose-500',   ring: 'ring-rose-200',   bar: 'bg-rose-400' },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-500',   ring: 'ring-teal-200',   bar: 'bg-teal-400' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-500', ring: 'ring-indigo-200', bar: 'bg-indigo-400' },
  slate:  { bg: 'bg-slate-100',  text: 'text-slate-500',  ring: 'ring-slate-200',  bar: 'bg-slate-400' },
};

// ─── 判定ロジック ─────────────────────────────────────────────────────────────

/**
 * getGroupStatus(group, appState)
 *   group    : ACHIEVEMENT_GROUPS の要素
 *   appState : lib/store.js の getState() が返すオブジェクト
 *
 * 返り値:
 *   {
 *     earnedIndices: number[],  // 獲得済みティアのインデックス配列（0-based）。[] = 1つも未獲得
 *     earnedIdx: number,        // 後方互換: 獲得済みの最大インデックス。-1 = 未獲得
 *     nextTier:  object|null,   // 進行中ティア。null = 全コンプリート
 *     nextValue: number,        // 進行中ティアの現在値（進捗バー用）
 *     nextThreshold: number,    // 進行中ティアの閾値
 *   }
 *
 * コレクター系統は各ティアを独立判定する（並行獲得可）。
 * 進行中は未獲得のうち最もインデックスが小さいティア1つ。
 */
export function getGroupStatus(group, appState) {
  const tiers = group.tiers;

  if (group.id === 'collector') {
    // コレクターはティアごとに参照フィールドが異なる。各ティアを独立して判定（並行獲得可）。
    const earnedIndices = [];
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const val = tier.field === 'bookmarks'
        ? (appState.bookmarks || []).length
        : (appState.savedSenses || []).length;
      if (val >= tier.threshold) {
        earnedIndices.push(i);
      }
    }
    const earnedIdx = earnedIndices.length > 0 ? earnedIndices[earnedIndices.length - 1] : -1;

    // 未獲得のうち最もインデックスが小さいティアを「進行中」にする
    const unearnedIndices = tiers.map((_, i) => i).filter((i) => !earnedIndices.includes(i));
    if (unearnedIndices.length === 0) {
      // 全コンプリート
      return { earnedIndices, earnedIdx, nextTier: null, nextValue: tiers[tiers.length - 1].threshold, nextThreshold: tiers[tiers.length - 1].threshold };
    }
    const nextIdx = unearnedIndices[0];
    const nextTier = tiers[nextIdx];
    const nextValue = nextTier.field === 'bookmarks'
      ? (appState.bookmarks || []).length
      : (appState.savedSenses || []).length;
    return { earnedIndices, earnedIdx, nextTier, nextValue, nextThreshold: nextTier.threshold };
  }

  // 通常系統（getValue が存在）
  const value = group.getValue(appState);
  let earnedIdx = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (value >= tiers[i].threshold) {
      earnedIdx = i;
    }
  }
  const earnedIndices = earnedIdx >= 0 ? tiers.slice(0, earnedIdx + 1).map((_, i) => i) : [];
  const nextIdx = earnedIdx + 1;
  if (nextIdx >= tiers.length) {
    return { earnedIndices, earnedIdx, nextTier: null, nextValue: value, nextThreshold: tiers[tiers.length - 1].threshold };
  }
  return {
    earnedIndices,
    earnedIdx,
    nextTier: tiers[nextIdx],
    nextValue: value,
    nextThreshold: tiers[nextIdx].threshold,
  };
}
