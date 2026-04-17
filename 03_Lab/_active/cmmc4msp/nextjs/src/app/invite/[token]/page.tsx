'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const API = process.env.NEXT_PUBLIC_API_URL || ''

interface InviteContext {
  email: string
  role: string
  org_name: string
  invited_by: string
  expires_at: string
}

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'error'

const ROLE_LABELS: Record<string, string> = {
  client_admin: 'Client Admin',
  contributor: 'Contributor',
  viewer: 'Viewer',
}

export default function InvitePage({ params }: { params: { token: string } }) {
  const { token } = params
  const router = useRouter()

  const [state, setState] = useState<PageState>('loading')
  const [ctx, setCtx] = useState<InviteContext | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    fetch(`${API}/api/invites/${token}/validate`)
      .then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(e.detail || 'Invalid invite'))
        return r.json()
      })
      .then((data) => {
        setCtx(data)
        setState('ready')
      })
      .catch((msg) => {
        setErrorMsg(typeof msg === 'string' ? msg : 'This invite is invalid or has expired')
        setState('error')
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setErrorMsg('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters')
      return
    }
    setErrorMsg('')
    setState('submitting')

    try {
      const r = await fetch(`${API}/api/invites/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, password }),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.detail || 'Failed to create account')
      }
      setState('success')
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong')
      setState('ready')
    }
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md w-full text-center shadow-sm">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Invite Not Found</h1>
          <p className="text-sm text-gray-500">{errorMsg}</p>
          <p className="text-xs text-gray-400 mt-4">Invites expire after 72 hours and can only be used once.</p>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-green-200 rounded-xl p-8 max-w-md w-full text-center shadow-sm">
          <ShieldCheckIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Account Created!</h1>
          <p className="text-sm text-gray-600 mb-6">
            Welcome to <span className="font-medium">{ctx?.org_name}</span>. Your account is ready.
          </p>
          <button
            onClick={() => router.push('/api/auth/signin')}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Sign In to Your Account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 rounded-lg p-2">
            <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">You're invited!</h1>
            <p className="text-xs text-gray-500">
              {ctx?.invited_by} invited you to join <span className="font-medium">{ctx?.org_name}</span>
            </p>
          </div>
        </div>

        {/* Context card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-blue-700 font-medium">Organization</span>
            <span className="text-blue-900">{ctx?.org_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-700 font-medium">Role</span>
            <span className="text-blue-900">{ROLE_LABELS[ctx?.role || ''] || ctx?.role}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-700 font-medium">Email</span>
            <span className="text-blue-900 font-mono text-xs">{ctx?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-700 font-medium">Expires</span>
            <span className="text-blue-900 text-xs">
              {ctx ? new Date(ctx.expires_at).toLocaleString() : ''}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={state === 'submitting'}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {state === 'submitting' ? 'Creating account…' : 'Accept Invite & Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
