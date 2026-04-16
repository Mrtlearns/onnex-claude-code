/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pino', 'pino-pretty'],
  },
};

export default nextConfig;
