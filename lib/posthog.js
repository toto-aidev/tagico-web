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

// PostHog を初期化する（layout の useEffect から呼ぶ）
export function initPostHog() {
  if (initialized || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
  if (!key) return; // 鍵未設定なら no-op（既存機能に影響しない）
  posthog.init(key, {
    api_host: host,
    capture_pageview: true,              // ページビュー自動送信（Retention の基準イベント）
    capture_pageleave: true,             // 離脱イベント
    persistence: 'localStorage+cookie',  // persistent anonymous ID（ブラウザ再訪で同一ユーザーを追跡）
    autocapture: false,                  // 手動イベントのみ（DOM クリック等のノイズを排除）
    disable_session_recording: true,     // 画面録画・セッションリプレイを完全無効
    respect_dnt: true,                   // Do Not Track ヘッダを尊重（ブラウザ設定でDNT有効なら計測しない）
  });
  initialized = true;
}

// ログイン完了時: 匿名ID とユーザーアカウントを紐付ける
// userId は Supabase が発行する UUID のみ受け取る。email・氏名等の PII は渡してはいけない。
// 以後のイベントはすべてこの userId に紐付けられる（D7 継続率でログインユーザーを識別可能）
export function identifyUser(userId) {
  if (!initialized) return;
  try {
    posthog.identify(userId);
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
