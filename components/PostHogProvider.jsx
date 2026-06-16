'use client';

// components/PostHogProvider.jsx — PostHog 初期化 Provider（Client Component）
//
// Next.js App Router の layout.jsx は Server Component のため useEffect が使えない。
// このコンポーネントを layout.jsx の <body> 内に置くことで、クライアントサイドで
// PostHog を一度だけ初期化する。
//
// 初期化後: すべての子コンポーネントから captureEvent() を呼べる状態になる。
// 鍵未設定（NEXT_PUBLIC_POSTHOG_KEY が空）なら no-op。アプリの挙動を一切壊さない。

import { useEffect } from 'react';
import { initPostHog } from '@/lib/posthog';

export default function PostHogProvider({ children }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return children;
}
