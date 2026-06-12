import { Outfit, Noto_Sans_JP, JetBrains_Mono } from 'next/font/google';
import './globals.css';

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
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
