import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // 토스 증권 종목 로고 CDN — StockLogo 컴포넌트에서 사용.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static.toss.im',
        pathname: '/png-icons/**',
      },
    ],
  },
};

export default nextConfig;
