import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import './globals.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Load client-only providers without SSR to prevent Apollo/React context conflict.
// Navbar is rendered inside Providers because it uses useSession and Apollo.
const Providers = dynamic(
  () => import('./providers').then((m) => ({ default: m.Providers })),
  { ssr: false }
)

export const metadata: Metadata = {
  title: 'CMMC Compliance OS',
  description: 'CMMC Level 2 Compliance Management Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <Providers>
          {/* Navbar lives inside Providers — needs session + Apollo context */}
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  )
}
