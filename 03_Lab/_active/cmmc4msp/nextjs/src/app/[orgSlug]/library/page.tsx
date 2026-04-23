'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  FolderIcon,
  FolderOpenIcon,
  DocumentIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline'

const API = process.env.NEXT_PUBLIC_API_URL || ''

interface LibFolder {
  id: string
  name: string
  parent_id: string | null
  created_at: string
}

interface LibFile {
  id: string
  name: string
  folder_id: string | null
  size_bytes: number
  created_at: string
  uploaded_by_email: string | null
}

interface TreeNode {
  folder: LibFolder
  children: TreeNode[]
  files: LibFile[]
}

function buildTree(folders: LibFolder[], files: LibFile[]): { roots: TreeNode[]; rootFiles: LibFile[] } {
  const map = new Map<string, TreeNode>()
  for (const f of folders) map.set(f.id, { folder: f, children: [], files: [] })
  const roots: TreeNode[] = []
  for (const f of folders) {
    const node = map.get(f.id)!
    if (f.parent_id && map.has(f.parent_id)) map.get(f.parent_id)!.children.push(node)
    else roots.push(node)
  }
  const rootFiles: LibFile[] = []
  for (const file of files) {
    if (file.folder_id && map.has(file.folder_id)) map.get(file.folder_id)!.files.push(file)
    else rootFiles.push(file)
  }
  roots.sort((a, b) => a.folder.name.localeCompare(b.folder.name))
  return { roots, rootFiles }
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export default function LibraryPage() {
  const { data: session } = useSession()
  const token = (session?.user as any)?.accessToken || ''
  const role: string = (session?.user as any)?.role ?? 'client_user'
  const isAdmin = role === 'msp_admin' || role === 'super_admin'

  const [folders, setFolders] = useState<LibFolder[]>([])
  const [files, setFiles] = useState<LibFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<LibFile | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [viewerLoading, setViewerLoading] = useState(false)

  // Folder expand state
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Selected folder for upload
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null)
  // New folder form
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null)
  const [folderSaving, setFolderSaving] = useState(false)
  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const authHeader = { Authorization: `Bearer ${token}` }

  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/library/tree`, { headers: authHeader })
      if (res.ok) {
        const data = await res.json()
        setFolders(data.folders)
        setFiles(data.files)
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadTree() }, [loadTree])

  async function openFile(file: LibFile) {
    setSelectedFile(file)
    setViewerUrl(null)
    setViewerLoading(true)
    try {
      const res = await fetch(`${API}/api/library/files/${file.id}/view`, { headers: authHeader })
      if (res.ok) {
        const data = await res.json()
        setViewerUrl(data.url)
      }
    } finally {
      setViewerLoading(false)
    }
  }

  async function deleteFile(file: LibFile, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete "${file.name}"?`)) return
    await fetch(`${API}/api/library/files/${file.id}`, { method: 'DELETE', headers: authHeader })
    if (selectedFile?.id === file.id) { setSelectedFile(null); setViewerUrl(null) }
    loadTree()
  }

  async function deleteFolder(folder: LibFolder, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete folder "${folder.name}" and all its contents?`)) return
    await fetch(`${API}/api/library/folders/${folder.id}`, { method: 'DELETE', headers: authHeader })
    loadTree()
  }

  async function createFolder() {
    if (!newFolderName.trim()) return
    setFolderSaving(true)
    try {
      const res = await fetch(`${API}/api/library/folders`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), parent_id: newFolderParent }),
      })
      if (res.ok) {
        const folder = await res.json()
        setExpanded(prev => { const s = new Set(prev); if (newFolderParent) s.add(newFolderParent); return s })
        setNewFolderName('')
        setShowNewFolder(false)
        setNewFolderParent(null)
        loadTree()
      }
    } finally {
      setFolderSaving(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files
    if (!picked || picked.length === 0) return
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      for (const f of Array.from(picked)) form.append('files', f)
      if (uploadFolderId) form.append('folder_id', uploadFolderId)
      const res = await fetch(`${API}/api/library/upload`, {
        method: 'POST',
        headers: authHeader,
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setUploadError(err.detail || 'Upload failed')
      } else {
        if (uploadFolderId) setExpanded(prev => { const s = new Set(prev); s.add(uploadFolderId!); return s })
        loadTree()
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const { roots, rootFiles } = buildTree(folders, files)

  function FileRow({ file }: { file: LibFile }) {
    const isSelected = selectedFile?.id === file.id
    return (
      <div
        onClick={() => openFile(file)}
        className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
          isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
        }`}
      >
        <DocumentIcon className="w-4 h-4 flex-shrink-0 text-red-400" />
        <span className="flex-1 truncate">{file.name}</span>
        <span className="text-xs text-gray-400 flex-shrink-0 hidden group-hover:block">
          {file.size_bytes ? formatBytes(file.size_bytes) : ''}
        </span>
        {isAdmin && (
          <button
            onClick={(e) => deleteFile(file, e)}
            className="flex-shrink-0 p-0.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  function FolderNode({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
    const isOpen = expanded.has(node.folder.id)
    const hasChildren = node.children.length > 0 || node.files.length > 0
    return (
      <div>
        <div
          onClick={() => {
            setExpanded(prev => {
              const s = new Set(prev)
              if (s.has(node.folder.id)) s.delete(node.folder.id)
              else s.add(node.folder.id)
              return s
            })
            setUploadFolderId(node.folder.id)
          }}
          className="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm hover:bg-gray-100 text-gray-800 font-medium transition-colors"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <span className="flex-shrink-0 text-gray-400 w-3.5">
            {hasChildren ? (
              isOpen ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />
            ) : null}
          </span>
          {isOpen
            ? <FolderOpenIcon className="w-4 h-4 flex-shrink-0 text-amber-400" />
            : <FolderIcon className="w-4 h-4 flex-shrink-0 text-amber-400" />}
          <span className="flex-1 truncate">{node.folder.name}</span>
          {isAdmin && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setNewFolderParent(node.folder.id)
                  setShowNewFolder(true)
                }}
                className="p-0.5 text-gray-300 hover:text-blue-500 transition-colors"
                title="New subfolder"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setUploadFolderId(node.folder.id)
                  fileInputRef.current?.click()
                }}
                className="p-0.5 text-gray-300 hover:text-green-500 transition-colors"
                title="Upload to this folder"
              >
                <ArrowUpTrayIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => deleteFolder(node.folder, e)}
                className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                title="Delete folder"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {isOpen && (
          <div>
            {node.children.map(child => (
              <FolderNode key={child.folder.id} node={child} depth={depth + 1} />
            ))}
            {node.files.map(file => (
              <div key={file.id} style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}>
                <FileRow file={file} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left: Tree panel */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900 text-sm">Library</span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setNewFolderParent(null); setShowNewFolder(true) }}
                className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="New root folder"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setUploadFolderId(null); fileInputRef.current?.click() }}
                disabled={uploading}
                className="p-1 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                title="Upload PDF(s)"
              >
                <ArrowUpTrayIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* New folder form */}
        {showNewFolder && (
          <div className="px-3 py-2 border-b border-gray-200 bg-blue-50">
            <p className="text-xs text-blue-700 mb-1 font-medium">
              {newFolderParent ? 'New subfolder' : 'New root folder'}
            </p>
            <div className="flex gap-1">
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') } }}
                placeholder="Folder name"
                className="flex-1 text-xs border border-blue-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button onClick={createFolder} disabled={folderSaving || !newFolderName.trim()}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                {folderSaving ? '…' : 'Add'}
              </button>
              <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }}
                className="text-xs text-gray-400 hover:text-gray-600 px-1">
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <div className="px-3 py-2 bg-red-50 border-b border-red-200 text-xs text-red-600 flex items-center justify-between">
            {uploadError}
            <button onClick={() => setUploadError(null)}><XMarkIcon className="w-3 h-3" /></button>
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="px-3 py-2 bg-green-50 border-b border-green-200 text-xs text-green-700">
            Uploading…
          </div>
        )}

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-2 px-1">
          {loading ? (
            <p className="text-xs text-gray-400 text-center mt-8">Loading…</p>
          ) : (
            <>
              {roots.map(node => <FolderNode key={node.folder.id} node={node} />)}
              {rootFiles.map(file => <FileRow key={file.id} file={file} />)}
              {roots.length === 0 && rootFiles.length === 0 && (
                <div className="text-center mt-12 px-4">
                  <BookOpenIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Library is empty.</p>
                  {isAdmin && (
                    <p className="text-xs text-gray-400 mt-1">
                      Create a folder or upload PDFs using the buttons above.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: Viewer panel */}
      <div className="flex-1 flex flex-col bg-gray-50 h-full">
        {!selectedFile ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <DocumentIcon className="w-16 h-16 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Select a file from the library to view it</p>
            </div>
          </div>
        ) : (
          <>
            {/* Viewer toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <DocumentIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-800 truncate">{selectedFile.name}</span>
                {selectedFile.size_bytes && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatBytes(selectedFile.size_bytes)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {viewerUrl && (
                  <a
                    href={viewerUrl}
                    download={selectedFile.name}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                  >
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    Download
                  </a>
                )}
                <button
                  onClick={() => { setSelectedFile(null); setViewerUrl(null) }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Viewer body */}
            <div className="flex-1 relative">
              {viewerLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-sm text-gray-400">Loading document…</div>
                </div>
              ) : viewerUrl ? (
                <iframe
                  src={viewerUrl}
                  className="w-full h-full border-0"
                  title={selectedFile.name}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-red-400">Failed to load document.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Hidden multi-file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  )
}
