const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ['@apollo/client', 'graphql-ws'],
}
module.exports = nextConfig
