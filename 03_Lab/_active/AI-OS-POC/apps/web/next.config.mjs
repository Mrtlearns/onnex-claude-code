/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  // Prevent 308 redirects that strip trailing slashes before rewrites run.
  // Authentik's authorize endpoint requires the trailing slash (/application/o/authorize/).
  // Without this, Next.js normalizes the URL before the proxy rewrite can intercept it.
  skipTrailingSlashRedirect: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
    NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:9000"
  },
  // Proxy Authentik SSO paths to the internal authentik-server container.
  // Required because external traffic hits aios-web directly (port-forwarded),
  // bypassing Traefik's router rules. These paths must reach authentik-server:9000.
  async rewrites() {
    const authentikBase = "http://authentik-server:9000"
    return {
      beforeFiles: [
        // NOTE: Next.js strips trailing slashes internally before passing to rewrites.
        // Authentik endpoints require trailing slashes (Django APPEND_SLASH not active).
        // Workaround: explicitly append "/" to all Authentik proxy destinations.

        // OIDC / OAuth2 authorization endpoints (/application/o/authorize/ etc.)
        { source: "/application/:path*", destination: `${authentikBase}/application/:path*/` },
        // Authentik 2024.10+ authentication flow redirect target (/flows/-/default/authentication/)
        { source: "/flows/:path*", destination: `${authentikBase}/flows/:path*/` },
        // Authentik flow UI SPA (/if/flow/<slug>/)
        { source: "/if/:path*", destination: `${authentikBase}/if/:path*/` },
        // Authentik REST API (/api/v3/core/users/me/ etc.)
        { source: "/api/v3/:path*", destination: `${authentikBase}/api/v3/:path*/` },
        // OIDC discovery (/.well-known/openid-configuration)
        { source: "/.well-known/:path*", destination: `${authentikBase}/.well-known/:path*/` },
        // Authentik static assets — no trailing slash needed for file paths
        { source: "/static/:path*", destination: `${authentikBase}/static/:path*` },
      ],
    }
  },
};

export default nextConfig;
