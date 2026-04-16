// Nextcloud file browser — WebDAV PROPFIND via BFF proxy at /api/documents
// Parses WebDAV XML client-side using DOMParser. No external deps beyond lucide-react.

import { useState, useEffect } from 'react'
import { documentsApi } from '@/lib/documentsApi'
import { FolderIcon, FileIcon, ChevronRightIcon, CheckSquareIcon, SquareIcon, Trash2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

export interface NextcloudFile {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  lastModified: string
}

interface NextcloudBrowserProps {
  onSelectFile?: (file: NextcloudFile) => void
  onPathChange?: (path: string) => void
  refreshKey?: number
  onRefresh?: () => void
}

function parseWebDavXml(xml: string, currentPath: string): NextcloudFile[] {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'application/xml')
    const responses = Array.from(doc.querySelectorAll('response'))
    const results: NextcloudFile[] = []

    for (const response of responses) {
      const href = response.querySelector('href')?.textContent ?? ''
      // Extract path after /remote.php/dav/files/{user}/ (no ^ anchor — handles any prefix)
      const match = href.match(/\/remote\.php\/dav\/files\/[^/]+\/(.*)/)
      if (!match) continue
      const filePath = decodeURIComponent(match[1]).replace(/\/$/, '')

      // Skip the current directory entry itself
      if (filePath === currentPath || filePath === '') continue

      const displayName =
        response.querySelector('displayname')?.textContent ??
        filePath.split('/').pop() ??
        ''
      const isCollection = response.querySelector('collection') !== null
      const sizeText = response.querySelector('getcontentlength')?.textContent ?? '0'
      const lastModifiedText = response.querySelector('getlastmodified')?.textContent ?? ''

      results.push({
        name: displayName,
        path: filePath,
        type: isCollection ? 'directory' : 'file',
        size: parseInt(sizeText, 10) || 0,
        lastModified: lastModifiedText,
      })
    }
    return results
  } catch {
    return []
  }
}

export default function NextcloudBrowser({ onSelectFile, onPathChange, refreshKey, onRefresh }: NextcloudBrowserProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [files, setFiles] = useState<NextcloudFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function navigateTo(path: string) {
    setCurrentPath(path)
    onPathChange?.(path)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading guard
    setLoading(true)
    setError(false)
    documentsApi.list(currentPath)
      .then(xml => {
        setFiles(parseWebDavXml(xml, currentPath))
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [currentPath, refreshKey])

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : []

  function toggleSelect(path: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function handleItemClick(item: NextcloudFile) {
    if (selectMode) {
      toggleSelect(item.path)
      return
    }
    if (item.type === 'directory') {
      navigateTo(item.path)
    } else if (onSelectFile) {
      onSelectFile(item)
    } else {
      window.open(`/api/documents/${item.path}?download=1`, '_blank')
    }
  }

  function handleDeleteClick() {
    const allInDeleted = [...selected].every(p => p.startsWith('_deleted/'))
    if (allInDeleted) {
      setConfirmOpen(true)
    } else {
      void performDelete()
    }
  }

  async function performDelete() {
    setDeleting(true)
    for (const path of selected) {
      await documentsApi.delete(path)
    }
    setSelected(new Set())
    setSelectMode(false)
    setDeleting(false)
    onRefresh?.()
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col h-full p-2 space-y-2">
      {/* Selection toolbar */}
      <div className="flex items-center gap-1">
        <button
          title={selectMode ? 'Exit selection mode' : 'Select files'}
          className={cn(
            'p-1 rounded transition-colors',
            selectMode
              ? 'bg-muted text-foreground'
              : 'hover:bg-muted/50 text-muted-foreground',
          )}
          onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
        >
          {selectMode
            ? <CheckSquareIcon className="h-3.5 w-3.5" />
            : <SquareIcon className="h-3.5 w-3.5" />}
        </button>
        {selectMode && selected.size > 0 && (
          <button
            title={`Delete ${selected.size} item(s)`}
            disabled={deleting}
            className="flex items-center gap-1 px-1.5 py-1 rounded text-xs text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            onClick={handleDeleteClick}
          >
            <Trash2Icon className="h-3.5 w-3.5" />
            <span>{selected.size}</span>
          </button>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
        <button
          className="hover:text-foreground transition-colors"
          onClick={() => navigateTo('')}
        >
          Root
        </button>
        {breadcrumbs.map((segment, idx) => {
          const path = breadcrumbs.slice(0, idx + 1).join('/')
          return (
            <span key={path} className="flex items-center gap-1">
              <ChevronRightIcon className="h-3 w-3" />
              <button
                className="hover:text-foreground transition-colors"
                onClick={() => navigateTo(path)}
              >
                {segment}
              </button>
            </span>
          )
        })}
      </div>

      {/* States */}
      {loading && (
        <div className="space-y-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={cn('h-8 rounded bg-muted animate-pulse', i % 2 === 0 ? 'w-full' : 'w-4/5')}
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="text-sm text-muted-foreground text-center py-4">
          Could not connect to Nextcloud
        </div>
      )}

      {!loading && !error && files.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">
          Empty folder
        </div>
      )}

      {!loading && !error && files.length > 0 && (
        <div className="space-y-0.5 overflow-auto">
          {files.map(item => (
            <div
              key={item.path}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted/50 transition-colors cursor-pointer',
                selectMode && selected.has(item.path) && 'bg-muted/70',
              )}
              onClick={() => handleItemClick(item)}
            >
              {selectMode && (
                <input
                  type="checkbox"
                  readOnly
                  checked={selected.has(item.path)}
                  className="shrink-0 pointer-events-none"
                />
              )}
              {item.type === 'directory' ? (
                <FolderIcon className="h-4 w-4 text-yellow-500 shrink-0" />
              ) : (
                <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="truncate">{item.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hard-delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete?</DialogTitle>
            <DialogDescription>
              These items will be permanently removed from storage and cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded border text-sm hover:bg-muted/50 transition-colors">
                Cancel
              </button>
            </DialogClose>
            <button
              disabled={deleting}
              className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              onClick={() => {
                setConfirmOpen(false)
                void performDelete()
              }}
            >
              Delete Forever
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
