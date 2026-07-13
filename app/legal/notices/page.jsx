import LegalShell, { LegalTable } from '@/components/LegalShell';

export const metadata = {
  title: 'ライセンス・商標表示 | Tagico',
  description: 'Tagicoで利用するオープンソースソフトウェア、フォント、商標に関する表示です。',
};

const software = [
  ['Supabase JavaScript Client 2.108.2', 'MIT', 'Copyright © 2020 Supabase', 'https://github.com/supabase/supabase-js'],
  ['Vercel Web Analytics 1.6.1', 'MPL 2.0', 'Vercel, Inc.', 'https://github.com/vercel/analytics'],
  ['canvas-confetti 1.9.4', 'ISC', 'Copyright © 2020 Kiril Vatev', 'https://github.com/catdad/canvas-confetti'],
  ['Next.js 15.5.19', 'MIT', 'Copyright © 2025 Vercel, Inc.', 'https://github.com/vercel/next.js'],
  ['PostHog JS 1.386.8', 'Apache 2.0', 'Copyright © 2020 PostHog / Hiberly, Inc.; © 2015 Mixpanel, Inc.', 'https://github.com/PostHog/posthog-js'],
  ['React / React DOM 19.2.7', 'MIT', 'Copyright © Meta Platforms, Inc. and affiliates', 'https://github.com/facebook/react'],
];

const fonts = [
  ['Outfit', 'SIL Open Font License 1.1', 'Copyright © 2021 The Outfit Project Authors', 'https://github.com/google/fonts/tree/main/ofl/outfit'],
  ['Noto Sans JP', 'SIL Open Font License 1.1', 'Copyright © 2014–2021 Adobe; Reserved Font Name “Source”', 'https://github.com/google/fonts/tree/main/ofl/notosansjp'],
  ['JetBrains Mono', 'SIL Open Font License 1.1', 'Copyright © 2020 The JetBrains Mono Project Authors', 'https://github.com/google/fonts/tree/main/ofl/jetbrainsmono'],
];

function linkedRows(rows) {
  return rows.map(([name, license, notice, url]) => [
    name,
    <a key={url} href={url} target="_blank" rel="noreferrer">{license}</a>,
    notice,
  ]);
}
export default function NoticesPage() {
  return (
    <LegalShell title="ライセンス・商標表示" description="Tagicoは、次のオープンソースソフトウェアとフォントを、それぞれのライセンスに従って利用しています。">
      <h2>オープンソースソフトウェア</h2>
      <LegalTable headers={['名称', 'ライセンス・ソース', '著作権表示']} rows={linkedRows(software)} />

      <h2>Webフォント</h2>
      <LegalTable headers={['名称', 'ライセンス・ソース', '著作権表示']} rows={linkedRows(fonts)} />
      <p>フォントは改変せず、Web表示のためにサブセット化された形式で配信します。各フォントを単体で販売することはありません。</p>

      <h2>商標</h2>
      <p>Apple、Appleロゴ、App Store、Sign in with Appleは、米国その他の国や地域で登録されたApple Inc.の商標です。GoogleおよびGoogleロゴはGoogle LLCの商標です。その他の名称は、それぞれの権利者に帰属します。</p>

      <h2>Tagico iOSアプリ</h2>
      <p>iOSアプリ本体はAppleのシステムフレームワークを利用し、現時点で第三者のSwift Packageを組み込んでいません。効果音はアプリ内コードで生成し、外部の音源ファイルを収録していません。</p>
    </LegalShell>
  );
}
