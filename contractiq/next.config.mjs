/** @type {import('next').NextConfig} */

// Baseline security headers applied to every route.
const securityHeaders = [
  // Disallow the app from being framed (clickjacking protection).
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers from MIME-sniffing responses away from the declared type.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Legacy XSS filter for older browsers (harmless where ignored).
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Don't leak full URLs (which can contain ids) to other origins.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Deny access to powerful browser features the app doesn't use.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
