import { AppSidebar } from '@/components/AppSidebar'

export default function MspLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar context="msp" />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
