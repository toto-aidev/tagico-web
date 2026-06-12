// lib/content.js — コンテンツ（多義語データ）の読み込み
//
// 公開Web版はビルトインデータ方式：
//   Tagico Studio のエディタで「エクスポート」した tagico-content.json を
//   data/content.json に上書きコピーすると、ビルド時に焼き込まれる。
// （Studio は localStorage 'tagico-v2-content' に書くが、公開アプリは別オリジンの
//   ため共有できない。よって JSON 同梱がコンテンツの正本となる）
//
// スキーマ:
//   levels: [{ id, name, label?, wordIds: [] }]
//   words:  [{ id, word, trap, senses: [{ en, jpBefore, answer, jpAfter, jpFull, cue, hint? }],
//             coreImage: { headline, lead }, faces: [{ name, meaning, type?, note? }], trivia? }]

import content from '@/data/content.json';

export const WORDS = content.words;
export const LEVELS = content.levels;

export function getWord(id) {
  return WORDS.find((w) => w.id === id);
}

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id);
}
