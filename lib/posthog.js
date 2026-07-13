// lib/posthog.js — PostHog 初期化ラッパ（D1/D7/D30 継続率計測用）
//
// 環境変数（NEXT_PUBLIC_POSTHOG_KEY）が未設定なら no-op。アプリの挙動を一切壊さない。
// 匿名 persistent ID: PostHog が自動生成して localStorage+cookie に保存する distinct_id を使う。
// ログイン時: identifyUser(userId) で匿名ID とユーザーアカウントを紐付け、
//             ログアウト後も同一ブラウザで再ログインすると自動で紐付けが復元される。
// PostHog の Retention 機能でコホート継続率（D1/D7/D30）が確認できる状態を作る最小構成。
//
// プライバシー方針:
//   - identifyUser は userId（UUID）のみ送信。email・氏名等の PII は一切送らない。
//   - disable_session_recording: true  — 画面録画しない
//   - respect_dnt: true                — Do Not Track ヘッダを尊重
//   - autocapture: false               — DOMクリック・キーストロークの自動取得を無効
//
// 使い方:
//   - app/layout.jsx 内の PostHogProvider（client component）から initPostHog() を呼ぶ
//   - ログイン時: identifyUser(session.user.id)  ← email を渡さない
//   - ログアウト時: resetPostHog()
//   - カスタムイベント: captureEvent('quiz_completed', { word: 'get', level: 1, correct: 3, total: 4, all_correct: false })

'use client';

import posthog from 'posthog-js';

let initialized = false;
let analyticsAllowed = false;

// PostHog を初期化する（layout の useEffect から呼ぶ）
export function initPostHog() {
  if (initialized || typeof window === 'undefined') return initialized;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
  if (!key) return false; // 鍵未設定なら no-op（既存機能に影響しない）
  posthog.init(key, {
    api_host: host,
    capture_pageview: analyticsAllowed,  // 同意後だけページビューを送信
    capture_pageleave: analyticsAllowed, // 同意後だけ離脱イベントを送信
    persistence: 'localStorage+cookie',  // persistent anonymous ID（ブラウザ再訪で同一ユーザーを追跡）
    opt_out_capturing_by_default: !analyticsAllowed,
    autocapture: false,                  // 手動イベントのみ（DOM クリック等のノイズを排除）
    disable_session_recording: true,     // 画面録画・セッションリプレイを完全無効
    advanced_disable_decide: true,       // 使用しない機能フラグ用リクエストを無効化
    respect_dnt: true,                   // Do Not Track ヘッダを尊重（ブラウザ設定でDNT有効なら計測しない）
  });
  initialized = true;
  return true;
}

// 利用者の明示同意後だけ初期化し、送信を許可する。
export function enablePostHog() {
  analyticsAllowed = true;
  if (!initPostHog()) return;
  try {
    posthog.opt_in_capturing();
  } catch (_) {}
}

// 同意前・撤回後は送信しない。初期化済みならPostHog側にもオプトアウトを記録する。
export function disablePostHog() {
  analyticsAllowed = false;
  if (initialized) {
    try {
      posthog.opt_out_capturing();
      posthog.reset();
    } catch (_) {}
  }
  purgePersistedPostHogState();
}

// 旧版で作成済みの識別子も、未同意または撤回時にブラウザから削除する。
function purgePersistedPostHogState() {
  if (typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  const prefix = `ph_${key}`;
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const storageKey = window.localStorage.key(index);
      if (storageKey?.startsWith(prefix)) window.localStorage.removeItem(storageKey);
    }
  } catch (_) {}

  try {
    document.cookie
      .split(';')
      .map((entry) => entry.split('=')[0].trim())
      .filter((name) => name.startsWith(prefix))
      .forEach((name) => {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}; SameSite=Lax`;
      });
  } catch (_) {}
}

// ログイン完了時: 匿名ID とユーザーアカウントを紐付ける
// userId は Supabase が発行する UUID のみ受け取る。email・氏名等の PII は渡してはいけない。
// 以後のイベントはすべてこの userId に紐付けられる（D7 継続率でログインユーザーを識別可能）
export function identifyUser(userId) {
  if (!initialized || !analyticsAllowed) return;
  try {
    posthog.identify(userId);
  } catch (_) {}
}

// ログアウト時: 匿名IDに戻す
// 次のセッションは新規匿名として計測されるが、再ログインで再紐付けされる
export function resetPostHog() {
  if (!initialized || !analyticsAllowed) return;
  try {
    posthog.reset();
  } catch (_) {}
}

// カスタムイベント送信（失敗しても握りつぶし、アプリの挙動に影響させない）
export function captureEvent(eventName, props) {
  try {
    if (!initialized || !analyticsAllowed) return;
    posthog.capture(eventName, props || {});
  } catch (_) {}
}
