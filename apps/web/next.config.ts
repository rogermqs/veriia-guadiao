import type { NextConfig } from 'next';
import path from 'node:path';
const exporting = process.env.AGM_STATIC_EXPORT === '1';
const config: NextConfig = {
  devIndicators: false,
  turbopack: { root: path.resolve('../..') },
  ...(exporting ? { output: 'export' as const } : {
    async rewrites() { return [{ source: '/api/:path*', destination: `${process.env.AGM_API_URL || 'http://127.0.0.1:3001'}/api/:path*` }]; },
    async redirects() { return [{ source: '/', destination: '/index.html', permanent: false }]; },
    async headers() { return [{ source: '/:path*', headers: [
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'same-origin'}
    ] }]; }
  })
};
export default config;
