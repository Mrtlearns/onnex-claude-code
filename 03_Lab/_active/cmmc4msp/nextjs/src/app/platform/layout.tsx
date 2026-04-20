import { AppSidebar } from '@/components/AppSidebar'

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar context="platform" />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
