// lib/sync.js — localStorage ↔ Supabase 進捗同期
//
// テーブル設計（supabase-setup.sql 参照）:
//   user_progress (
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
//     state_json JSONB NOT NULL DEFAULT '{}',
//     srs_json JSONB NOT NULL DEFAULT '{}',
//     updated_at TIMESTAMPTZ DEFAULT now()
//   )
//   RLS: user_id = auth.uid() の行のみ SELECT/INSERT/UPDATE 可
//
// 同期の原則:
//   - 「ローカルが負ける」ことはしない。マージは常に union / 大きい方採用
//   - 既存ユーザーの localStorage 進捗を初回ログイン時にそのままサーバーへ移行する
//   - 未ログイン時は従来通り localStorage のみで動作（この関数は呼ばれない）
//   - supabase が null（鍵未設定）なら全関数が skip を返す

'use client';

import { supabase } from '@/lib/supabase';

// ローカル進捗をサーバーに push（初回ログイン＋随時同期）
// - サーバーに既存データがあれば union マージしてから upsert する
// - 返り値: { error, mergedState, mergedSrs } — App.jsx で state を更新するために使う
export async function pushProgress(userId, localState, localSrs) {
  if (!supabase || !userId) return { error: 'skip' };

  try {
    // サーバーの既存データを読む（新規ユーザーは PGRST116 エラー → existing = null）
    const { data: existing } = await supabase
      .from('user_progress')
      .select('state_json, srs_json')
      .eq('user_id', userId)
      .single();

    const serverState = existing?.state_json || {};
    const serverSrs = existing?.srs_json || {};

    const mergedState = mergeState(localState, serverState);
    const mergedSrs = mergeSrs(localSrs, serverSrs);

    const { error } = await supabase
      .from('user_progress')
      .upsert(
        {
          user_id: userId,
          state_json: mergedState,
          srs_json: mergedSrs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    return { error, mergedState, mergedSrs };
  } catch (e) {
    return { error: e };
  }
}

// サーバーから進捗を pull（別端末同期・ログイン後の読み込み）
// 返り値: { state, srs } | null
export async function pullProgress(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('state_json, srs_json')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return { state: data.state_json, srs: data.srs_json };
  } catch {
    return null;
  }
}

// ===== マージ関数（エクスポートしない・内部のみ） =====

// store.js の state オブジェクトをマージする
// 原則: ローカル ∪ サーバー で最大値を採用（ローカルが失われない）
function mergeState(local, server) {
  if (!server || Object.keys(server).length === 0) return local;
  if (!local || Object.keys(local).length === 0) return server;

  const unionArr = (a, b) =>
    Array.from(new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]));

  const merged = { ...local };

  // 配列フィールド: union（どちらかに入っていれば残す）
  merged.cleared = unionArr(local.cleared, server.cleared);
  merged.completed = unionArr(local.completed, server.completed);
  merged.reviewPool = unionArr(local.reviewPool, server.reviewPool);
  merged.bookmarks = unionArr(local.bookmarks, server.bookmarks);
  merged.savedSenses = unionArr(local.savedSenses, server.savedSenses);

  // 数値フィールド: 大きい方を採用
  merged.trapHits = Math.max(local.trapHits || 0, server.trapHits || 0);
  merged.trapAvoids = Math.max(local.trapAvoids || 0, server.trapAvoids || 0);
  merged.streakDays = Math.max(local.streakDays || 0, server.streakDays || 0);

  // lastStudiedDate: 新しい日付を採用
  const localDate = local.lastStudiedDate || '';
  const serverDate = server.lastStudiedDate || '';
  merged.lastStudiedDate = localDate >= serverDate ? localDate : serverDate;

  // days: 各日付のカウントは大きい方
  const localDays = local.days || {};
  const serverDays = server.days || {};
  const mergedDays = { ...serverDays };
  Object.keys(localDays).forEach((d) => {
    mergedDays[d] = Math.max(localDays[d] || 0, serverDays[d] || 0);
  });
  merged.days = mergedDays;

  // history: wordId ごとに attempts が多い方を採用（より多く学習したデータを残す）
  const localHistory = local.history || {};
  const serverHistory = server.history || {};
  const mergedHistory = { ...serverHistory };
  Object.entries(localHistory).forEach(([wordId, localRec]) => {
    const serverRec = serverHistory[wordId];
    if (!serverRec || (localRec.attempts || 0) >= (serverRec.attempts || 0)) {
      mergedHistory[wordId] = localRec;
    }
  });
  merged.history = mergedHistory;

  return merged;
}

// srs.js の srsState オブジェクトをマージする
// 各 senseId について: 最後に missedOn が記録された日が新しい方のレコードを採用
function mergeSrs(local, server) {
  if (!server || !server.records) return local;
  if (!local || !local.records) return server;

  const merged = { records: { ...(server.records || {}) } };

  Object.entries(local.records || {}).forEach(([senseId, localRec]) => {
    const serverRec = merged.records[senseId];
    if (!serverRec) {
      // サーバーにないレコード: ローカルを追加
      merged.records[senseId] = localRec;
    } else {
      // 両方にある: missedOn の最新日が新しい方を採用
      const localLatest = [...(localRec.missedOn || [])].sort().pop() || '';
      const serverLatest = [...(serverRec.missedOn || [])].sort().pop() || '';
      merged.records[senseId] = localLatest >= serverLatest ? localRec : serverRec;
    }
  });

  return merged;
}
