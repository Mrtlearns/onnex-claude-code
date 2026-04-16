'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUniverseStore } from '@/store/universe'
import NodeForm from '@/components/node/NodeForm'

export default function Sidebar() {
  const pathname = usePathname()
  const { nodes, trashedArtifacts, setShowTrash, fetchTrash } = useUniverseStore()
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetchTrash()
  }, [fetchTrash])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const typeCounts = nodes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <>
      <aside className="w-56 flex flex-col h-screen border-r border-white/10 bg-black/30 backdrop-blur-sm">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex-shrink-0"
              style={{
                background: 'radial-gradient(circle at 35% 35%, #60a5fa, #3b82f6)',
                boxShadow: '0 0 12px rgba(59,130,246,0.5)',
              }}
            />
            <span className="font-semibold text-sm text-white">Knowledge Universe</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItem href="/universe" label="Universe" icon="🌐" active={pathname === '/universe'} />
          <NavItem href="/mindmap" label="Mindmap" icon="🗺" active={pathname === '/mindmap'} />

          <div className="pt-4 pb-2">
            <p className="text-xs font-medium text-white/30 uppercase tracking-wider px-2">Types</p>
          </div>

          {[
            { type: 'note', icon: '📝' },
            { type: 'task', icon: '✅' },
            { type: 'idea', icon: '💡' },
            { type: 'reference', icon: '🔗' },
            { type: 'person', icon: '👤' },
            { type: 'project', icon: '📁' },
          ].map(({ type, icon }) => (
            <div key={type} className="flex items-center justify-between px-2 py-1.5 text-sm text-white/50 hover:text-white/80 transition-colors">
              <span>{icon} {type}</span>
              <span className="text-xs bg-white/10 rounded-full px-1.5 py-0.5">{typeCounts[type] ?? 0}</span>
            </div>
          ))}

          <div className="pt-4">
            <div className="flex items-center justify-between px-2 py-1 text-xs text-white/30">
              <span>Total nodes</span>
              <span className="font-medium text-white/60">{nodes.length}</span>
            </div>
          </div>
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-white/10 space-y-2">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-2 px-3 rounded-lg text-sm font-medium
                       bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30
                       text-blue-300 transition-all"
          >
            + New Node
          </button>

          {/* Trash */}
          <button
            onClick={() => setShowTrash(true)}
            className="w-full py-2 px-3 rounded-lg text-sm text-white/40 hover:text-white/70
                       hover:bg-white/10 transition-all flex items-center justify-between"
          >
            <span>🗑️ Trash</span>
            {trashedArtifacts.length > 0 && (
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5' }}
              >
                {trashedArtifacts.length}
              </span>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-lg text-sm text-white/40 hover:text-white/70
                       hover:bg-white/10 transition-all"
          >
            Sign out
          </button>
        </div>
      </aside>

      {showCreate && (
        <NodeForm onClose={() => setShowCreate(false)} />
      )}
    </>
  )
}

function NavItem({ href, label, icon, active }: {
  href: string; label: string; icon: string; active: boolean
}) {
  return (
    <Link
      href={href}
      className={`
        flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium transition-all
        ${active
          ? 'bg-white/15 text-white'
          : 'text-white/50 hover:text-white/80 hover:bg-white/10'}
      `}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
