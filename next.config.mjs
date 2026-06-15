/** @type {import('next').NextConfig} */
const nextConfig = {
  // 完全クライアントSPA。Vercel 標準デプロイ・静的エクスポートのどちらでも動く。
  // 静的ホスティング（GitHub Pages 等）に出すときは下の行を有効化して `next build` → out/ を配信。
  // output: 'export',
  reactStrictMode: true,
  // VERCEL_ENV はサーバー専用変数のため、クライアントに渡すには env で明示的にブリッジする。
  // 優先順位:
  //   1. すでに NEXT_PUBLIC_VERCEL_ENV が設定されていればそれを尊重（ローカル .env.preview 等）
  //   2. なければ VERCEL_ENV から引き継ぐ（Vercel ビルド時: preview/production）
  // preview（dev ブランチ）では全単語をデフォルトアンロック。production では従来のレベル制。
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || '',
  },
};

export default nextConfig;
