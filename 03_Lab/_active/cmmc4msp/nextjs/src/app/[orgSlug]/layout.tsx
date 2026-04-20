import { AppSidebar } from '@/components/AppSidebar'

export default function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar context="org" orgSlug={params.orgSlug} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
