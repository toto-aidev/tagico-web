// lib/srs.js — 語義単位の間隔反復（SRS）ロジック
//
// データモデル（localStorage キー: 'tagico-v2-srs'）:
//   {
//     records: {
//       [senseId]: {
//         missedOn:    string[]  // 間違えた日付（YYYY-MM-DD）の配列
//         checkpoints: string[]  // 復習期日（YYYY-MM-DD）の配列（仕様: A+1, A+3, A+7, A+30）
//         reviewedOn:  string[]  // 復習を実施した日付の配列
//         wordId:      string    // 親単語の id
//       }
//     }
//   }
//
// 仕様（オーナー確定・変更不可）:
//   - 記録単位: 語義（sense）単位（word 単位ではない）
//   - 間隔: 間違えた日 A の翌日 A+1, A+3, A+7, A+30 を復習期日として追加
//   - 復習中に再ミス: +1日後の期日を1個足す（全リセットしない）
//   - 4チェックポイントは連続正解でもスキップしない（全部出す）
//   - 復習0件の日: 何も出さない（ホームのバナーを表示しないだけ）

const SRS_STORAGE_KEY = 'tagico-v2-srs';

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

// 間違えた sense を SRS に登録（または既存エントリに期日を追加）
// senseId: string, wordId: string, dateStr: string (YYYY-MM-DD)
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

  const newCheckpoints = [
    addDays(dateStr, 1),
    addDays(dateStr, 3),
    addDays(dateStr, 7),
    addDays(dateStr, 30),
  ];

  records[senseId] = {
    ...prev,
    missedOn: [...prev.missedOn, dateStr],
    // 既存期日と新期日をマージ（重複排除・ソート済み）
    checkpoints: Array.from(new Set([...prev.checkpoints, ...newCheckpoints])).sort(),
    wordId,
  };
  return { ...srsState, records };
}

// 復習中の再ミス: +1日後の期日を1件追加（全リセットしない）
export function recordReviewMiss(srsState, senseId, dateStr) {
  const records = { ...(srsState.records || {}) };
  const prev = records[senseId];
  if (!prev) return srsState;

  const extraDate = addDays(dateStr, 1);
  records[senseId] = {
    ...prev,
    checkpoints: Array.from(new Set([...prev.checkpoints, extraDate])).sort(),
  };
  return { ...srsState, records };
}

// 復習完了（正解）: reviewedOn に追加（checkpoints は消さない＝仕様通り全チェックポイント出す）
export function recordReview(srsState, senseId, dateStr) {
  const records = { ...(srsState.records || {}) };
  const prev = records[senseId];
  if (!prev) return srsState;

  records[senseId] = {
    ...prev,
    reviewedOn: Array.from(new Set([...(prev.reviewedOn || []), dateStr])),
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

// ===== 語義→単語のグループ化 =====

// 今日の復習アイテムを単語ごとにグループ化して返す
// 返り値: [{ wordId, senseIds: string[], missedOn: string[] (最古の miss 日) }]
// senseIds は同一単語の複数語義をまとめる
export function groupReviewByWord(reviewItems) {
  const map = new Map(); // wordId -> { senseIds, earliestMiss }
  reviewItems.forEach((item) => {
    if (!map.has(item.wordId)) {
      map.set(item.wordId, { senseIds: [], earliestMiss: null });
    }
    const group = map.get(item.wordId);
    group.senseIds.push(item.senseId);
    // 最古の miss 日を記録（「過去の自分」演出に使う）
    const missDate = item.missedOn[0] || null;
    if (!group.earliestMiss || (missDate && missDate < group.earliestMiss)) {
      group.earliestMiss = missDate;
    }
  });

  return Array.from(map.entries()).map(([wordId, g]) => ({
    wordId,
    senseIds: g.senseIds,
    earliestMiss: g.earliestMiss,
  }));
}

// ===== テスト用ユーティリティ =====

// デバッグ・手動テスト向け: 指定日付に「今日」を偽装した復習リストを取得する
// 本番コードは todayLocalStr() を使うこと
export function getTodayReviewItemsAs(srsState, dateStr) {
  return getTodayReviewItems(srsState, dateStr);
}
