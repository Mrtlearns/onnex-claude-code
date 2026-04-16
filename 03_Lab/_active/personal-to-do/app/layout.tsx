import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Knowledge Universe',
  description: 'Glassmorphic knowledge management — visualize your mind',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#020408] text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
