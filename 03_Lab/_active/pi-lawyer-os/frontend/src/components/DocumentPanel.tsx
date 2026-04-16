import { useRef, useState } from 'react';
import { Upload, Download, Trash2, File, Sparkles, Loader2, Share2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDocuments, useUploadDocument, useDeleteDocument, getDocumentDownloadUrl } from '@/hooks/useDocuments';
import { useDocumentAnalysis, useAnalyzeDocument, useClassifyDocument } from '@/hooks/useAiAnalysis';
import { apiPatch, apiPost } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { documentKeys } from '@/hooks/useDocuments';
import type { Document, DocType } from '@/types';

const DOC_TYPE_LABEL: Record<DocType, string> = {
  retainer: 'Retainer',
  medical: 'Medical Records',
  pleading: 'Pleading',
  correspondence: 'Correspondence',
  settlement: 'Settlement',
  other: 'Other',
};

const DOC_TYPE_COLOR: Record<DocType, string> = {
  retainer: 'bg-green-100 text-green-700',
  medical: 'bg-blue-100 text-blue-700',
  pleading: 'bg-purple-100 text-purple-700',
  correspondence: 'bg-yellow-100 text-yellow-700',
  settlement: 'bg-indigo-100 text-indigo-700',
  other: 'bg-gray-100 text-gray-600',
};

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ANALYSIS_STATUS_COLOR: Record<string, string> = {
  pending:    'bg-gray-100 text-gray-500',
  processing: 'bg-blue-100 text-blue-600',
  complete:   'bg-green-100 text-green-700',
  error:      'bg-red-100 text-red-600',
};

interface DocumentRowProps {
  doc: Document;
  onDelete: () => void;
  onToggleShare: () => void;
  shareLoading: boolean;
}

function DocumentRow({ doc, onDelete, onToggleShare, shareLoading }: DocumentRowProps) {
  const { data: analysis } = useDocumentAnalysis(doc.id);
  const analyze = useAnalyzeDocument();

  const analysisStatus = analysis?.status;
  const isAnalyzable = doc.doc_type === 'medical' || doc.doc_type === 'other';

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 py-2.5 text-sm">
        <File className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{doc.name}</p>
          {doc.file_size && (
            <p className="text-xs text-gray-500">{formatBytes(doc.file_size)}</p>
          )}
        </div>
        <span className={['text-xs font-medium rounded-full px-2 py-0.5 shrink-0', DOC_TYPE_COLOR[doc.doc_type]].join(' ')}>
          {DOC_TYPE_LABEL[doc.doc_type]}
        </span>
        {analysisStatus && (
          <span className={['text-xs rounded-full px-2 py-0.5 shrink-0', ANALYSIS_STATUS_COLOR[analysisStatus] ?? ''].join(' ')}>
            {analysisStatus === 'complete' ? 'AI analyzed' : analysisStatus}
          </span>
        )}
        {isAnalyzable && !analysisStatus && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 shrink-0 gap-1"
            onClick={() => analyze.mutate({ document_id: doc.id })}
            disabled={analyze.isPending}
            title="Analyze with AI"
          >
            {analyze.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Analyze
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className={[
            'h-7 w-7 p-0 shrink-0',
            doc.shared_with_client
              ? 'text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50'
              : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50',
          ].join(' ')}
          onClick={onToggleShare}
          disabled={shareLoading}
          title={doc.shared_with_client ? 'Shared with client — click to unshare' : 'Share with client'}
        >
          <Share2 className="w-3.5 h-3.5" />
        </Button>
        <a href={getDocumentDownloadUrl(doc.id)} download={doc.name} className="shrink-0">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
            <Download className="w-3.5 h-3.5 text-gray-400" />
          </Button>
        </a>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface DocumentPanelProps {
  caseId: string;
  firmId: string;
}

interface SearchChunk {
  chunk_index: number;
  content: string;
  document_name: string;
  similarity: number;
}

export default function DocumentPanel({ caseId }: DocumentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocType>('other');
  const [dragOver, setDragOver] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchChunk[] | null>(null);
  const [searching, setSearching] = useState(false);

  const queryClient = useQueryClient();
  const { data: documents, isLoading } = useDocuments(caseId);
  const upload = useUploadDocument();
  const deleteDoc = useDeleteDocument();
  const classify = useClassifyDocument();

  async function toggleShare(doc: Document) {
    setSharingId(doc.id);
    try {
      await apiPatch(`/api/documents?id=eq.${doc.id}`, {
        shared_with_client: !doc.shared_with_client,
      });
      queryClient.invalidateQueries({ queryKey: documentKeys.byCase(caseId) });
    } finally {
      setSharingId(null);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const results = await apiPost<SearchChunk[]>('/ai/search-documents', {
        query: searchQuery,
        case_id: caseId,
        limit: 5,
      });
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const uploaded = await upload.mutateAsync({ file, case_id: caseId, doc_type: docType });
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Auto-classify asynchronously (fire and forget — don't block UX)
    if (uploaded?.id) {
      classify.mutate({ document_id: uploaded.id });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Documents</h3>
        <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.entries(DOC_TYPE_LABEL) as [DocType, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
          upload.isPending ? 'opacity-50 pointer-events-none' : '',
        ].join(' ')}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.txt"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
        {upload.isPending ? (
          <p className="text-sm text-gray-500">Uploading…</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">Drop file here or click to upload</p>
            <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX, JPG, PNG · max 50MB</p>
          </>
        )}
      </div>

      {upload.isError && (
        <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-2">{upload.error?.message}</p>
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading documents…</p>}

      {!isLoading && documents?.length === 0 && (
        <p className="text-sm text-gray-400 py-2 text-center">No documents uploaded yet.</p>
      )}

      {documents && documents.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 px-3">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onDelete={() => deleteDoc.mutate({ id: doc.id, case_id: caseId })}
              onToggleShare={() => toggleShare(doc)}
              shareLoading={sharingId === doc.id}
            />
          ))}
        </div>
      )}

      {/* Semantic document search */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Semantic Search</p>
        <div className="flex gap-2">
          <Input
            className="h-8 text-sm flex-1"
            placeholder="Search documents by meaning…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button size="sm" variant="outline" className="h-8 px-3 gap-1" onClick={handleSearch} disabled={searching}>
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          </Button>
        </div>
        {searchResults !== null && searchResults.length === 0 && (
          <p className="text-xs text-gray-400">No matching content found.</p>
        )}
        {searchResults && searchResults.length > 0 && (
          <div className="space-y-2 mt-1">
            {searchResults.map((chunk, i) => (
              <div key={i} className="bg-gray-50 rounded p-2 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-700 truncate">{chunk.document_name}</span>
                  <span className="text-gray-400 shrink-0">{Math.round(chunk.similarity * 100)}% match</span>
                </div>
                <p className="text-gray-600 line-clamp-3">{chunk.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
