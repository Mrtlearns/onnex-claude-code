import { Sidebar } from '@/components/Sidebar'

export default function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar orgSlug={params.orgSlug} />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
