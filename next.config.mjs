/** @type {import('next').NextConfig} */
const nextConfig = {
  // The ECCD Child's Record 2 route fills this Word template at request time;
  // it is read from disk, so it must be traced into that serverless bundle.
  outputFileTracingIncludes: {
    '/api/eccd/report': ['./src/templates/eccd-child-record-2.docx'],
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';

    const securityHeaders = [
      // Prevent MIME type sniffing
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Block the app from being embedded in other pages (clickjacking)
      { key: 'X-Frame-Options', value: 'DENY' },
      // Limit referrer information leaked to third parties
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Disable unused browser features
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      },
      // Content Security Policy. Inline scripts/styles are required by Next.js
      // runtime, so script-src/style-src allow 'unsafe-inline'; everything else
      // is locked to same-origin plus the Supabase project.
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "object-src 'none'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          // 'unsafe-eval' is only needed by the dev-mode React refresh runtime.
          `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
          "worker-src 'self' blob:",
          "frame-src 'self' blob: data:",
          "connect-src 'self' blob: data: https://*.supabase.co wss://*.supabase.co",
        ].join('; '),
      },
    ];

    // Strict Transport Security only over HTTPS production deployments
    if (isProduction) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }

    return [
      // Service worker + manifest must always be fetched fresh so updates
      // reach browsers immediately (never edge/browser-cached).
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
