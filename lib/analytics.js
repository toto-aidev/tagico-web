// lib/analytics.js — 匿名・プライバシー配慮型のカスタムイベント計測ラッパ
//
// 計測基盤は Vercel Web Analytics（Cookieレス・サーバ側で個人を追跡しない）。
// ページビュー/訪問数の自動計測は app/layout.jsx の <Analytics /> が担う。本ファイルは
// 「クイズ開始」などの意味のあるカスタムイベント送信用の薄いラッパ。
//
// 重要:
//  - カスタムイベント（track）は Vercel の Pro/Enterprise プランでのみ集計される。
//    Hobby（無料）プランや Vercel 以外の環境では track() は安全に no-op になり、
//    アプリの挙動には一切影響しない（公開を絶対に壊さない）。
//  - トークン・本名・メール等の個人情報はこのコードに一切含めない。

import { track as vercelTrack } from '@vercel/analytics';

// 意味のあるカスタムイベントを Vercel Web Analytics に送る。
// 失敗しても握りつぶし、アプリの挙動に影響させない。
export function track(eventName, props) {
  try {
    vercelTrack(eventName, props || {});
  } catch (_) {
    // 計測の失敗がアプリの挙動に影響してはならない。常に握りつぶす。
  }
}

// 計測したい意味のあるイベント名（タイプミス防止のため集約）。
export const EVENTS = {
  QUIZ_START: 'quiz_start', // クイズ開始（導線の入口）
  QUIZ_RESULT: 'quiz_result', // 結果画面に到達（1セッション完了）
};
