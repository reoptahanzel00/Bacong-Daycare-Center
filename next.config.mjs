/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
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
          "img-src 'self' data: https://images.unsplash.com",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
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
