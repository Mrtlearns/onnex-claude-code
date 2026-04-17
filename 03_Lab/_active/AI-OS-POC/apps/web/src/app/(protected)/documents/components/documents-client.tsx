"use client"
// apps/web/src/app/(protected)/documents/components/documents-client.tsx
// Orchestrator Client Component — manages selectedDocument state, renders two-column layout

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Session } from "next-auth"
import type { PaperlessDocument, NextcloudFile } from "@/types/api"
import { PaperlessBrowser } from "./paperless-browser"
import { NextcloudBrowser } from "./nextcloud-browser"
import { DocumentViewer } from "./document-viewer"
import { UploadButton } from "./upload-button"

interface DocumentsClientProps {
  session: Session | null
}

export function DocumentsClient({ session: _session }: DocumentsClientProps) {
  const [selectedDoc, setSelectedDoc] = useState<PaperlessDocument | null>(null)
  const [selectedNcFile, setSelectedNcFile] = useState<NextcloudFile | null>(null)

  const handleSelectPaperless = (doc: PaperlessDocument) => {
    setSelectedDoc(doc)
    setSelectedNcFile(null)
  }

  const handleSelectNextcloud = (file: NextcloudFile) => {
    setSelectedNcFile(file)
    setSelectedDoc(null)
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top bar: title + upload action */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <UploadButton />
      </div>

      {/* Two-panel layout */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-4 flex-1">
        {/* Left panel: Paperless + Nextcloud tabs */}
        <Tabs defaultValue="nextcloud" className="flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="nextcloud" className="flex-1">Nextcloud</TabsTrigger>
            <TabsTrigger value="paperless" className="flex-1">Paperless</TabsTrigger>
          </TabsList>
          <TabsContent value="nextcloud" className="flex-1 overflow-auto mt-0">
            <NextcloudBrowser onSelectFile={handleSelectNextcloud} />
          </TabsContent>
          <TabsContent value="paperless" className="flex-1 overflow-auto mt-0">
            <PaperlessBrowser onSelect={handleSelectPaperless} />
          </TabsContent>
        </Tabs>

        {/* Right panel: PDF viewer */}
        <DocumentViewer
          documentId={selectedDoc?.id ?? null}
          title={selectedDoc?.title ?? selectedNcFile?.name ?? ""}
          nextcloudPath={selectedNcFile?.path ?? null}
        />
      </div>
    </div>
  )
}
