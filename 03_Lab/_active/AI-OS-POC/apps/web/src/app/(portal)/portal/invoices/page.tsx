// apps/web/src/app/(portal)/invoices/page.tsx
// Client portal: read-only invoice list with status badges and PDF download links

import { auth } from "@/auth"
import { apiGetPortalInvoices } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"

function getStatusBadgeVariant(
  status: string,
): "default" | "destructive" | "outline" | "secondary" {
  switch (status.toLowerCase()) {
    case "paid":
      return "default"
    case "overdue":
      return "destructive"
    case "sent":
      return "secondary"
    default:
      return "outline"
  }
}

export default async function PortalInvoicesPage() {
  const session = await auth()
  const { invoices } = await apiGetPortalInvoices(session!.user.token)

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Your Invoices</h2>
      {invoices.length === 0 ? (
        <p className="text-muted-foreground">No invoices found.</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-medium">
                  {inv.invoice_number}
                </span>
                <Badge variant={getStatusBadgeVariant(inv.status)}>
                  {inv.status}
                </Badge>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                {inv.due_date && <span>Due {inv.due_date}</span>}
                <span className="font-medium text-foreground">
                  ${inv.total_amount.toFixed(2)}
                </span>
                <a
                  href={`/api/bff/invoices/${inv.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline text-sm"
                >
                  Download PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
