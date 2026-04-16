'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        router.push('/universe')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? 'Invalid credentials')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at center, #0d1117 0%, #020408 100%)' }}>

      {/* Stars background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 80 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              opacity: Math.random() * 0.6 + 0.1,
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{
              background: 'radial-gradient(circle at 35% 35%, #60a5fa, #3b82f6)',
              boxShadow: '0 0 30px 10px rgba(59, 130, 246, 0.4)',
            }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Knowledge Universe</h1>
          <p className="text-sm text-white/50 mt-1">Your mind, visualized</p>
        </div>

        {/* Glass card */}
        <div className="glass p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20
                           text-white placeholder-white/30 outline-none
                           focus:border-blue-400/60 focus:bg-white/15 transition-all"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20
                           text-white placeholder-white/30 outline-none
                           focus:border-blue-400/60 focus:bg-white/15 transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg font-medium text-white transition-all
                         bg-blue-500/80 hover:bg-blue-500 border border-blue-400/30
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
            >
              {loading ? 'Entering universe...' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
