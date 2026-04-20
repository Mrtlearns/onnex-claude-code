// apps/web/src/app/(portal)/documents/page.tsx
// Client portal: read-only document list with type icons and view links

import { auth } from "@/auth"
import { apiGetPortalDocuments } from "@/lib/api-client"
import { FileText, Folder } from "lucide-react"

export default async function PortalDocumentsPage() {
  const session = await auth()
  let documents: Awaited<ReturnType<typeof apiGetPortalDocuments>>["documents"] = []
  try {
    const data = await apiGetPortalDocuments(session!.user.token)
    documents = data.documents
  } catch {
    // No portal mapping — show empty state
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Your Documents</h2>
      {documents.length === 0 ? (
        <p className="text-muted-foreground">No documents found.</p>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                {doc.document_type === "paperless" ? (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Folder className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium capitalize">
                    {doc.document_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <a
                href={
                  doc.document_type === "paperless"
                    ? `/documents?id=${doc.document_id}`
                    : `/api/bff/nextcloud/${doc.document_id}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline text-sm"
              >
                View
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
