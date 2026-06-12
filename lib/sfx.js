// lib/sfx.js — ポップで気持ちいい効果音（Web Audio API のシンセ生成）
//
// 設計方針:
//   - 音声アセット（mp3 等）を増やさず、oscillator + gain エンベロープで短い「ポップ」を都度生成。
//   - アクション種別ごとに音色・音程を変えてレパートリーを持たせる（4〜6種）。
//   - iOS / モバイル Safari の autoplay ポリシー対策として、最初のユーザー操作で
//     AudioContext を unlock/resume する（unlockAudio()）。これを呼ばないと無音になる。
//   - ミュートは localStorage 'tagico-v2-sfx-muted' に永続化。SSR では何もしない。
//   - 音量は控えめ（master gain 0.18）でうるさすぎないように。

const MUTE_KEY = 'tagico-v2-sfx-muted';

let ctx = null;          // AudioContext（遅延生成）
let masterGain = null;   // 全体音量
let muted = false;       // 初期値は読み込み時に同期

// localStorage からミュート状態を読む（クライアントのみ）。
function readMuted() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch (e) {
    return false;
  }
}

// クライアント側で初期ミュート状態を確定。App マウント時に一度呼ぶ。
export function initSfx() {
  muted = readMuted();
  return muted;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch (e) {
      /* localStorage 不可環境では無視 */
    }
  }
  return muted;
}

export function toggleMuted() {
  return setMuted(!muted);
}

// AudioContext を取得（必要なら生成）。SSR / 非対応環境では null。
function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.18; // 控えめなマスター音量
      masterGain.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
  }
  return ctx;
}

// 最初のユーザー操作で呼ぶ。サスペンド状態の AudioContext を resume してアンロックする。
// iOS/モバイル Safari はユーザー操作起点でないと音が出ない（無音バグの主因）。
export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    c.resume().catch(() => {});
  }
}

// 単音（ポップ）を鳴らす内部ヘルパ。
// freq: 開始周波数 / type: 波形 / dur: 長さ秒 / glideTo: 終端周波数(任意・上昇/下降音用) / vol: 個別音量倍率 / delay: 発音遅延秒
function tone({ freq, type = 'sine', dur = 0.12, glideTo = null, vol = 1, delay = 0 }) {
  const c = getCtx();
  if (!c || !masterGain) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) {
    osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  }
  // パーカッシブなエンベロープ（速いアタック→指数減衰）＝「ポップ」感
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// ===== レパートリー（アクション種別 → 音）=====
// 名前は play(name) で呼ぶ。未知の名前は 'tap' にフォールバック。
const RECIPES = {
  // 選択肢チップのタップ：軽くて短いポップ
  tap: () => tone({ freq: 520, type: 'triangle', dur: 0.07, vol: 0.9 }),

  // 汎用ボタン / タブ切り替え：少し低めの落ち着いたクリック
  ui: () => tone({ freq: 380, type: 'sine', dur: 0.08, vol: 0.7 }),

  // 「次へ」/続行：軽い上昇のひと押し
  next: () => {
    tone({ freq: 440, type: 'triangle', dur: 0.09, glideTo: 620, vol: 0.9 });
  },

  // 正解（全問正解で答え合わせ）：明るい上昇アルペジオ
  correct: () => {
    tone({ freq: 523, type: 'sine', dur: 0.12, vol: 1 });          // C5
    tone({ freq: 659, type: 'sine', dur: 0.12, vol: 1, delay: 0.09 }); // E5
    tone({ freq: 784, type: 'sine', dur: 0.16, vol: 1, delay: 0.18 }); // G5
  },

  // 不正解：柔らかい低めの2音（きつくしない）
  wrong: () => {
    tone({ freq: 320, type: 'sine', dur: 0.14, vol: 0.8 });
    tone({ freq: 247, type: 'sine', dur: 0.18, vol: 0.8, delay: 0.1 });
  },

  // レベルクリア・解禁：少し華やかなファンファーレ
  fanfare: () => {
    tone({ freq: 523, type: 'triangle', dur: 0.12, vol: 1 });           // C5
    tone({ freq: 659, type: 'triangle', dur: 0.12, vol: 1, delay: 0.1 });  // E5
    tone({ freq: 784, type: 'triangle', dur: 0.12, vol: 1, delay: 0.2 });  // G5
    tone({ freq: 1047, type: 'triangle', dur: 0.28, vol: 1, delay: 0.3 }); // C6（伸ばし）
  },
};

// 効果音を鳴らす（公開 API）。ミュート時は無音。AudioContext が無い環境でも安全に no-op。
export function play(name) {
  if (muted) return;
  const recipe = RECIPES[name] || RECIPES.tap;
  try {
    recipe();
  } catch (e) {
    /* 音声非対応・例外時は黙って無視（UX を壊さない） */
  }
}
