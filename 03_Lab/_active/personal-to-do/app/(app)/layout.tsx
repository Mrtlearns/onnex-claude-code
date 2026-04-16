import { getSessionFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import ViewToggle from '@/components/layout/ViewToggle'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-white/80 tracking-wide uppercase">
              Knowledge Universe
            </h1>
          </div>
          <ViewToggle />
        </div>
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </main>
    </div>
  )
}
