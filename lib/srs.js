// lib/srs.js — 語義単位の間隔反復（SRS）ロジック
//
// データモデル（localStorage キー: 'tagico-srs-v2'）:
//   {
//     records: {
//       [sense.id]: {          // キー = content.json の sense.id (slug: 'word__訳語キー')
//         missedOn:    string[]  // 間違えた日付（YYYY-MM-DD）の配列
//         checkpoints: string[]  // 復習期日（YYYY-MM-DD）の配列（仕様: A+1, A+3, A+7, A+30）
//         reviewedOn:  string[]  // 復習を実施した日付の配列（checkpoints を1件ずつ消化）
//         wordId:      string    // 親単語の id
//       }
//     }
//   }
//
// 仕様（オーナー確定 2026-06-16）:
//   - 記録単位: 語義（sense）単位（word 単位ではない）
//   - キー:     sense.id（slug 形式: 'word__訳語キー'）。位置番号 senseIdx は使わない
//   - 間隔:     間違えた日 A の翌日 A+1, A+3, A+7, A+30 を復習期日として設定
//   - 復習中に再ミス: 誤答日を起点に +1/+3/+7/+30 を全リセット（既存残チェックポイントは破棄）
//   - 復習中に正解: checkpoints の最古の期日を1件消化（残りは生かす）
//   - 復習順序:  インターリーブ（単語ごとにブロックせず語義を交互に出す）
//   - 復習0件の日: 何も出さない（ホームのバナーを表示しないだけ）
//
// 旧キー 'tagico-v2-srs' は読まない（v2 をスキップして v3 とも異なる命名は避け
// 'tagico-srs-v2' という分かりやすい形に統一）。公開ベータに SRS 未デプロイのため移行不要。

const SRS_STORAGE_KEY = 'tagico-srs-v2';

// ===== 日付ユーティリティ =====

// ローカル日付を YYYY-MM-DD で返す（タイムゾーン依存を排除）
export function todayLocalStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// YYYY-MM-DD に N 日を加算して返す
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00'); // ローカル午前0時でパース
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// YYYY-MM-DD が今日以前か（期日到来の判定に使う）
export function isDue(dateStr, todayStr) {
  return dateStr <= todayStr;
}

// ===== SRS ストア =====

function defaultSrs() {
  return { records: {} };
}

export function getSrs() {
  if (typeof window === 'undefined') return defaultSrs();
  try {
    const raw = window.localStorage.getItem(SRS_STORAGE_KEY);
    if (!raw) return defaultSrs();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.records !== 'object') return defaultSrs();
    return parsed;
  } catch {
    return defaultSrs();
  }
}

export function saveSrs(srsState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(srsState));
}

// ===== 間違い記録 =====

// 間違えた sense を SRS に登録（初回ミス）
// senseId: sense.id (slug), wordId: string, dateStr: string (YYYY-MM-DD)
export function recordMiss(srsState, senseId, wordId, dateStr) {
  const records = { ...(srsState.records || {}) };
  const prev = records[senseId] || {
    missedOn: [],
    checkpoints: [],
    reviewedOn: [],
    wordId,
  };

  // 同日の重複 miss は1件に絞る（1日複数回ミスしても期日は1セット）
  if (prev.missedOn.includes(dateStr)) {
    return { ...srsState, records };
  }

  // 初回ミス: 誤答日起点で4チェックポイントを新規設定
  // 既存の checkpoints があれば追加ではなく新規に上書きする（再開始）
  const newCheckpoints = [
    addDays(dateStr, 1),
    addDays(dateStr, 3),
    addDays(dateStr, 7),
    addDays(dateStr, 30),
  ].sort();

  records[senseId] = {
    ...prev,
    missedOn: [...prev.missedOn, dateStr],
    checkpoints: newCheckpoints,
    // 初回登録時は reviewedOn をリセット（やり直し）
    reviewedOn: [],
    wordId,
  };
  return { ...srsState, records };
}

// 復習中の再ミス: 誤答日起点で +1/+3/+7/+30 を全リセット（旧: +1日追加）
export function recordReviewMiss(srsState, senseId, dateStr) {
  const records = { ...(srsState.records || {}) };
  const prev = records[senseId];
  if (!prev) return srsState;

  // 既存の残チェックポイントを破棄し、再ミス日から全サイクルを張り直す
  const newCheckpoints = [
    addDays(dateStr, 1),
    addDays(dateStr, 3),
    addDays(dateStr, 7),
    addDays(dateStr, 30),
  ].sort();

  records[senseId] = {
    ...prev,
    missedOn: [...prev.missedOn, dateStr],
    checkpoints: newCheckpoints,
    reviewedOn: [], // 消化済み記録もリセット
  };
  return { ...srsState, records };
}

// 復習完了（正解）: 最古の未消化チェックポイント1件を消化（reviewedOn に追加）
// 残りの将来チェックポイントは生かす
export function recordReview(srsState, senseId, dateStr) {
  const records = { ...(srsState.records || {}) };
  const prev = records[senseId];
  if (!prev) return srsState;

  records[senseId] = {
    ...prev,
    reviewedOn: [...(prev.reviewedOn || []), dateStr],
  };
  return { ...srsState, records };
}

// ===== 今日の復習リスト取得 =====

// 今日が期日の sense エントリを返す
// 返り値: [{ senseId, wordId, missedOn, checkpoints, reviewedOn }]
// 同日復習済みのものは除外しない（仕様: 早めに正解しても4チェックポイント全部出す→
//   reviewedOn で「今日の同一チェックポイント」を二重表示しない程度の制御）
export function getTodayReviewItems(srsState, todayStr) {
  const today = todayStr || todayLocalStr();
  const records = srsState.records || {};
  const result = [];

  Object.entries(records).forEach(([senseId, rec]) => {
    // 今日以前の期日が1個でも未完了（= 今日の復習対象）か確認
    // 「未完了」の定義: その期日がまだ reviewedOn にない
    const dueCheckpoints = (rec.checkpoints || []).filter((cp) => isDue(cp, today));
    if (dueCheckpoints.length === 0) return;

    // 今日すでに全ての期日分を復習済みか
    const reviewedToday = (rec.reviewedOn || []).filter((d) => d === today).length;
    // 今日が期日のチェックポイント数（重複排除）
    const dueTodayCount = dueCheckpoints.filter((cp) => cp === today).length;
    // 今日以前の期日のうち、まだ reviewedOn に対応がない件数があれば対象
    // シンプルに: 未消化チェックポイント数 > 今日の復習実施数 なら対象
    const totalDue = dueCheckpoints.length;
    const totalReviewed = (rec.reviewedOn || []).length;
    if (totalDue <= totalReviewed) return; // 全期日消化済み

    result.push({
      senseId,
      wordId: rec.wordId,
      missedOn: rec.missedOn || [],
      checkpoints: rec.checkpoints || [],
      reviewedOn: rec.reviewedOn || [],
    });
  });

  // 期日（最古のチェックポイント）が早いもの順にソート
  result.sort((a, b) => {
    const aEarliest = a.checkpoints[0] || '9999';
    const bEarliest = b.checkpoints[0] || '9999';
    return aEarliest < bEarliest ? -1 : aEarliest > bEarliest ? 1 : 0;
  });

  return result;
}

// ===== 語義→単語のグループ化（インターリーブ版）=====

// 今日の復習アイテムを「インターリーブ」形式で単語リストにして返す
// 同じ単語の複数語義を連続させず、単語を跨いで交互に出す順序にする
//
// アルゴリズム:
//   1. 各 reviewItem（語義単位）を wordId ごとにバケツに分ける
//   2. バケツを「最古の checkpoints[0]」でソート（期日が古い単語を優先）
//   3. 各バケツから1語義ずつラウンドロビンで取り出し、インターリーブ済みリストを構築
//   4. Quiz は単語単位で進むため、最終的に「どの単語からどの senseIds を復習するか」を
//      単語単位にまとめた sessionWords 形式で返す
//
// 返り値: [{ wordId, senseIds: string[], earliestMiss: string|null }]
// ※ この配列の順序が出題順（インターリーブ済み）
export function groupReviewByWord(reviewItems) {
  // Step1: wordId → { senseIds, earliestCheckpoint, earliestMiss } のマップ
  const map = new Map();
  reviewItems.forEach((item) => {
    if (!map.has(item.wordId)) {
      map.set(item.wordId, { senseIds: [], earliestCheckpoint: null, earliestMiss: null });
    }
    const g = map.get(item.wordId);
    g.senseIds.push(item.senseId);
    const cp = item.checkpoints[0] || null;
    if (!g.earliestCheckpoint || (cp && cp < g.earliestCheckpoint)) g.earliestCheckpoint = cp;
    const md = item.missedOn[0] || null;
    if (!g.earliestMiss || (md && md < g.earliestMiss)) g.earliestMiss = md;
  });

  // Step2: バケツを期日順にソート
  const buckets = Array.from(map.entries())
    .sort(([, a], [, b]) => {
      const ac = a.earliestCheckpoint || '9999';
      const bc = b.earliestCheckpoint || '9999';
      return ac < bc ? -1 : ac > bc ? 1 : 0;
    })
    .map(([wordId, g]) => ({
      wordId,
      senseIds: g.senseIds,
      earliestMiss: g.earliestMiss,
      // 各バケツから「1語義ずつ」取り出すカーソル（インターリーブ用）
      cursor: 0,
    }));

  // Step3: ラウンドロビンで senseId を取り出し、どの wordId に属するかを記録
  // 最終的には単語単位で返す必要があるため、senseId の出現順を保ちながら wordId 配列を構築
  const interleavedWordIds = []; // 語義を跨いで並んだ wordId の列（重複あり）
  let remaining = buckets.reduce((s, b) => s + b.senseIds.length, 0);
  let round = 0;
  while (remaining > 0) {
    let anyProgress = false;
    for (const bucket of buckets) {
      if (bucket.cursor < bucket.senseIds.length) {
        interleavedWordIds.push(bucket.wordId);
        bucket.cursor++;
        remaining--;
        anyProgress = true;
      }
    }
    // 安全弁（無限ループ防止）
    if (!anyProgress) break;
    round++;
  }

  // Step4: interleavedWordIds の初出順で単語をまとめて sessionWords を作る
  // 出題順は wordId の「最初の登場順」で決まる
  const seen = new Set();
  const result = [];
  interleavedWordIds.forEach((wordId) => {
    if (!seen.has(wordId)) {
      seen.add(wordId);
      const bucket = buckets.find((b) => b.wordId === wordId);
      result.push({
        wordId,
        senseIds: bucket ? bucket.senseIds : [],
        earliestMiss: bucket ? bucket.earliestMiss : null,
      });
    }
  });

  return result;
}

// ===== テスト用ユーティリティ =====

// デバッグ・手動テスト向け: 指定日付に「今日」を偽装した復習リストを取得する
// 本番コードは todayLocalStr() を使うこと
export function getTodayReviewItemsAs(srsState, dateStr) {
  return getTodayReviewItems(srsState, dateStr);
}
