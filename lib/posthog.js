// lib/posthog.js — PostHog 初期化ラッパ（D1/D7/D30 継続率計測用）
//
// 環境変数（NEXT_PUBLIC_POSTHOG_KEY）が未設定なら no-op。アプリの挙動を一切壊さない。
// 匿名 persistent ID: PostHog が自動生成して localStorage+cookie に保存する distinct_id を使う。
// ログイン時: identifyUser(userId) で匿名ID とユーザーアカウントを紐付け、
//             ログアウト後も同一ブラウザで再ログインすると自動で紐付けが復元される。
// PostHog の Retention 機能でコホート継続率（D1/D7/D30）が確認できる状態を作る最小構成。
//
// 使い方:
//   - app/layout.jsx 内の PostHogProvider（client component）から initPostHog() を呼ぶ
//   - ログイン時: identifyUser(session.user.id, { email: session.user.email })
//   - ログアウト時: resetPostHog()
//   - カスタムイベント: captureEvent('quiz_complete', { word: 'get' })

'use client';

import posthog from 'posthog-js';

let initialized = false;

// PostHog を初期化する（layout の useEffect から呼ぶ）
export function initPostHog() {
  if (initialized || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
  if (!key) return; // 鍵未設定なら no-op（既存機能に影響しない）
  posthog.init(key, {
    api_host: host,
    capture_pageview: true,             // ページビュー自動送信（Retention の基準イベント）
    capture_pageleave: true,            // 離脱イベント
    persistence: 'localStorage+cookie', // persistent anonymous ID（ブラウザ再訪で同一ユーザーを追跡）
    autocapture: false,                 // 手動イベントのみ（DOM クリック等のノイズを排除）
  });
  initialized = true;
}

// ログイン完了時: 匿名ID とユーザーアカウントを紐付ける
// 以後のイベントはすべてこの userId に紐付けられる（D7 継続率でログインユーザーを識別可能）
export function identifyUser(userId, props) {
  if (!initialized) return;
  try {
    posthog.identify(userId, props || {});
  } catch (_) {}
}

// ログアウト時: 匿名IDに戻す
// 次のセッションは新規匿名として計測されるが、再ログインで再紐付けされる
export function resetPostHog() {
  if (!initialized) return;
  try {
    posthog.reset();
  } catch (_) {}
}

// カスタムイベント送信（失敗しても握りつぶし、アプリの挙動に影響させない）
export function captureEvent(eventName, props) {
  try {
    if (!initialized) return;
    posthog.capture(eventName, props || {});
  } catch (_) {}
}
