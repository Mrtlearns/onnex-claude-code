'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function ViewToggle() {
  const router = useRouter()
  const pathname = usePathname()
  const isUniverse = pathname === '/universe'

  return (
    <div className="flex items-center glass-sm rounded-lg p-1 gap-1">
      <button
        onClick={() => router.push('/universe')}
        className={`
          px-3 py-1.5 rounded-md text-xs font-medium transition-all
          ${isUniverse
            ? 'bg-white/20 text-white'
            : 'text-white/40 hover:text-white/70'}
        `}
      >
        🌐 Universe
      </button>
      <button
        onClick={() => router.push('/mindmap')}
        className={`
          px-3 py-1.5 rounded-md text-xs font-medium transition-all
          ${!isUniverse
            ? 'bg-white/20 text-white'
            : 'text-white/40 hover:text-white/70'}
        `}
      >
        🗺 Mindmap
      </button>
    </div>
  )
}
