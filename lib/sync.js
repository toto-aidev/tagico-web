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
import { OWNER_UID_KEY, clearLocal as clearStoreLocal } from '@/lib/store';
import { clearLocal as clearSrsLocal } from '@/lib/srs';

// pushProgress の in-flight ガード（モジュールレベル）
// onAuthStateChange が複数回発火しても read-merge-write が重複しないようにする。
// union/max で冪等なので競合しても値は壊れないが、余分な upsert を抑制する。
let _pushInFlight = false;

// ローカル進捗をサーバーに push（初回ログイン＋随時同期）
// - サーバーに既存データがあれば union マージしてから upsert する
// - 返り値: { error, mergedState, mergedSrs } — App.jsx で state を更新するために使う
export async function pushProgress(userId, localState, localSrs) {
  if (!supabase || !userId) return { error: 'skip' };
  if (_pushInFlight) return { error: 'in-flight' };
  _pushInFlight = true;

  // ===== クロスユーザー汚染防止（所有者 UID ガード）=====
  // localStorage に記録されている所有者 UID を確認し、
  //   - 所有者タグなし（匿名 or 初回） → そのままマージしてよい（オンボーディング継続）
  //   - 所有者 == ログイン UID    → 通常統合
  //   - 所有者 != ログイン UID    → 前ユーザーの残存進捗をサーバーへ統合しない。
  //                                  ローカルをリセットしてサーバーから pull のみ行う。
  //                                  所有者タグを今のユーザーに更新する。
  try {
    if (typeof window !== 'undefined') {
      const ownerUid = window.localStorage.getItem(OWNER_UID_KEY);
      if (ownerUid && ownerUid !== userId) {
        // 別ユーザーの残存進捗がある → ローカルをサーバーへ混入させない
        // 前ユーザーの残骸を消去してからサーバーデータを pull のみして返す
        // （新規ユーザーBでサーバー行なし = mergedState が null の場合、
        //   App.jsx 側の saveState が走らないため、ここで必ずクリアする）
        clearStoreLocal();
        clearSrsLocal();
        const { data: existingOther } = await supabase
          .from('user_progress')
          .select('state_json, srs_json')
          .eq('user_id', userId)
          .single();
        // 所有者タグを今のユーザーに更新
        window.localStorage.setItem(OWNER_UID_KEY, userId);
        return {
          error: null,
          mergedState: existingOther?.state_json || null,
          mergedSrs: existingOther?.srs_json || null,
        };
      }
      // 所有者を今のユーザーにセット（初回ログイン・通常統合どちらも）
      window.localStorage.setItem(OWNER_UID_KEY, userId);
    }

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
  } finally {
    _pushInFlight = false;
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

  // history: wordId ごとにフィールド単位でマージ（bestScore 後退防止）
  // attempts/correct/total/trapHit はそれぞれ Math.max で最大値を採用する。
  // 丸ごと一方を捨てると、別端末で進んだ学習実績が消える。
  const localHistory = local.history || {};
  const serverHistory = server.history || {};
  const allHistoryIds = new Set([
    ...Object.keys(localHistory),
    ...Object.keys(serverHistory),
  ]);
  const mergedHistory = {};
  allHistoryIds.forEach((wordId) => {
    const l = localHistory[wordId];
    const s = serverHistory[wordId];
    if (!l) { mergedHistory[wordId] = s; return; }
    if (!s) { mergedHistory[wordId] = l; return; }
    mergedHistory[wordId] = {
      correct:   Math.max(l.correct   || 0, s.correct   || 0),
      total:     Math.max(l.total     || 0, s.total     || 0),
      trapHit:   l.trapHit || s.trapHit,
      attempts:  Math.max(l.attempts  || 0, s.attempts  || 0),
      bestScore: Math.max(l.bestScore || 0, s.bestScore || 0),
    };
  });
  merged.history = mergedHistory;

  return merged;
}

// srs.js の srsState オブジェクトをフィールド単位でマージする
// 旧実装は missedOn の最新日が新しい方を丸ごと採用していたため、別端末で進んだ
// reviewedOn/checkpoints が消えて復習済みが再出題される問題があった。
// 新実装: 各 senseId について
//   - missedOn   : union（重複排除・ソート）
//   - reviewedOn : union（重複排除・ソート）
//   - checkpoints: union（重複排除・ソート）で将来期日を保持
//   - wordId     : どちらかの値を採用（通常一致するが念のためローカル優先）
function mergeSrs(local, server) {
  if (!server || !server.records) return local;
  if (!local || !local.records) return server;

  const unionDates = (a, b) =>
    Array.from(new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]))
      .sort();

  const allSenseIds = new Set([
    ...Object.keys(local.records || {}),
    ...Object.keys(server.records || {}),
  ]);

  const mergedRecords = {};
  allSenseIds.forEach((senseId) => {
    const l = (local.records || {})[senseId];
    const s = (server.records || {})[senseId];
    if (!l) { mergedRecords[senseId] = s; return; }
    if (!s) { mergedRecords[senseId] = l; return; }
    mergedRecords[senseId] = {
      wordId:      l.wordId || s.wordId,
      missedOn:    unionDates(l.missedOn,    s.missedOn),
      reviewedOn:  unionDates(l.reviewedOn,  s.reviewedOn),
      checkpoints: unionDates(l.checkpoints, s.checkpoints),
    };
  });

  return { records: mergedRecords };
}
