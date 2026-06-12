import { Outfit, Noto_Sans_JP, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

// 計測は Vercel Web Analytics（Cookieレス・個人を追跡しない訪問数/ページビュー計測）。
// <Analytics /> を <body> 末尾に置くだけで、Vercel 本番では自動でページビューを記録し、
// ローカル開発や Vercel 以外の環境では自動的に no-op になる（公開を壊さない）。
// トークン・本名・メール等のコードへの埋め込みは一切不要。スクリプトの配信元・計測の
// 有効化は Vercel ダッシュボード側で完結する。

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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
