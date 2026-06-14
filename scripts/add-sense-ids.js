#!/usr/bin/env node
// scripts/add-sense-ids.js
// Studio エクスポート→ content.json 上書き後に実行する。
// 各 sense に id フィールド（決定的スラッグ）を付与 or 補完する。
//
// 使い方:
//   node scripts/add-sense-ids.js
//   node scripts/add-sense-ids.js --check   # 付与済みか確認のみ（変更なし）
//
// sense id の形式: {wordId}__{toSlug(answer)}
// toSlug: 英数字と日本語（ひらがな・カタカナ・漢字）以外を _ に、連続 _ を圧縮

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'content.json');
const CHECK_ONLY = process.argv.includes('--check');

function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9぀-ゟ゠-ヿ一-鿿]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function genSenseId(wordId, answer) {
  return wordId + '__' + toSlug(answer);
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
let addedCount = 0;
let alreadyCount = 0;
const allIds = new Set();
let hasDup = false;

data.words.forEach((w) => {
  w.senses.forEach((s) => {
    const expected = genSenseId(w.id, s.answer);
    if (s.id && s.id === expected) {
      alreadyCount++;
    } else {
      if (!CHECK_ONLY) {
        s.id = expected;
        addedCount++;
      } else {
        console.log(`MISSING: ${w.id} / answer="${s.answer}" → id should be "${expected}"`);
        addedCount++;
      }
    }
    // 重複チェック
    if (allIds.has(expected)) {
      console.error(`DUPLICATE sense id: ${expected}`);
      hasDup = true;
    }
    allIds.add(expected);
  });
});

if (hasDup) {
  console.error('重複 sense id があります。content.json を確認してください。');
  process.exit(1);
}

if (CHECK_ONLY) {
  if (addedCount === 0) {
    console.log(`✓ 全 ${alreadyCount} 件の sense id が正常です。`);
  } else {
    console.log(`⚠ ${addedCount} 件の sense id が欠落または不一致です（${alreadyCount} 件は正常）。`);
    console.log('  node scripts/add-sense-ids.js  で補完できます。');
    process.exit(1);
  }
} else {
  if (addedCount > 0) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
    console.log(`✓ ${addedCount} 件の sense id を付与しました（既存 ${alreadyCount} 件はスキップ）。`);
  } else {
    console.log(`✓ 全 ${alreadyCount} 件の sense id はすでに正常です。変更なし。`);
  }
}
