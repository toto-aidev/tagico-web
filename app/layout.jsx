import { Outfit, Noto_Sans_JP, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import PostHogProvider from '@/components/PostHogProvider';
import './globals.css';

// 計測は二層構造:
//   1. Vercel Web Analytics（Cookieレス・PV/UU 自動計測）— <Analytics /> で設定済み
//   2. PostHog（継続率計測 D1/D7/D30 / カスタムイベント）— <PostHogProvider> で初期化
//      NEXT_PUBLIC_POSTHOG_KEY が未設定なら PostHog は no-op（公開を壊さない）。
// どちらも Vercel 本番・ローカル・プレビューで挙動が変わらず安全。

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const notoSansJp = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Tagico',
  description:
    '多義語を、文脈から見分ける訓練。1単語あたり複数の意味＋1つの罠選択肢でテンポよく学べる、無料の英語トレーナー。',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tagico',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'Tagico',
    description: '多義語を、文脈から見分ける訓練。',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary',
    site: '@toto_aidev',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2DD4BF',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className={`${outfit.variable} ${notoSansJp.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
