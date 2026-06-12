/** @type {import('next').NextConfig} */
const nextConfig = {
  // 完全クライアントSPA。Vercel 標準デプロイ・静的エクスポートのどちらでも動く。
  // 静的ホスティング（GitHub Pages 等）に出すときは下の行を有効化して `next build` → out/ を配信。
  // output: 'export',
  reactStrictMode: true,
};

export default nextConfig;
