// Sent on every response. Vercel already adds Strict-Transport-Security.
// A script-level CSP needs per-request nonces (and dynamic rendering), so this
// policy only carries directives that cannot break rendering.
export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  // Older browsers ignore frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Voice memories record audio and photo capture may use the camera here only.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];
