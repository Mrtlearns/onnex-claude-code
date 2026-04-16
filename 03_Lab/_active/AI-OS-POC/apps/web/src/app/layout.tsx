import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/lib/providers"

// Force dynamic rendering -- app is authenticated, no static pre-rendering
export const dynamic = "force-dynamic"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Agency AI-OS",
  description: "Agency operations platform",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
