// middleware.js — ルートのアクセス制御
//
// /analytics（社内デザイン確認用ダッシュボード・現状ダミーデータ）は、
// 本番(公開β / VERCEL_ENV=production)では一般ユーザーがURL直打ちで閲覧できないよう 404 にする。
// dev プレビュー(VERCEL_ENV=preview)・ローカルでは従来どおり表示し、デザイン確認に使う。
//
// 2026-06-16 宇月さん指示：「他のユーザーも普通に確認できるなら外して」。
//   /analytics は noindex だがURLを知れば誰でも閲覧できる状態だったため、本番だけ塞ぐ。
//   将来 /analytics を正式公開する場合は、この本番ガードを外す（または閲覧権限制御に置き換える）。

import { NextResponse } from 'next/server';

export function middleware(request) {
  // 本番（公開β）でのみ /analytics を非公開（404）にする。
  if (process.env.VERCEL_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  // /analytics と配下のみを対象にする（他ルートは素通り）
  matcher: ['/analytics', '/analytics/:path*'],
};
