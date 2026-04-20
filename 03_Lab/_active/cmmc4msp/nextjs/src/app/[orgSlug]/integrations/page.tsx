'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@apollo/client'
import { GET_ORG_BY_SLUG } from '@/graphql/queries'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  LinkSlashIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'

interface IntegrationsPageProps {
  params: { orgSlug: string }
}

const PROVIDER_META: Record<string, { label: string; description: string; icon: string }> = {
  entra_id:    { label: 'Microsoft Entra ID', description: 'Sync users, MFA status, and conditional access policies.', icon: '🪟' },
  okta:        { label: 'Okta',               description: 'Pull identity and access management evidence.',            icon: '🔐' },
  defender:    { label: 'Microsoft Defender', description: 'Ingest vulnerability scan results and threat alerts.',     icon: '🛡️' },
  crowdstrike: { label: 'CrowdStrike',        description: 'Import EDR detections and device posture data.',           icon: '🦅' },
  o365:        { label: 'Microsoft 365',      description: 'Collect email security and compliance reports.',           icon: '📧' },
  splunk:      { label: 'Splunk',             description: 'Stream audit log events for control evidence.',            icon: '📊' },
}

const STATUS_STYLES: Record<string, { label: string; cls: string; Icon: any }> = {
  active:   { label: 'Active',   cls: 'text-green-600',  Icon: CheckCircleIcon },
  error:    { label: 'Error',    cls: 'text-red-600',    Icon: ExclamationCircleIcon },
  revoked:  { label: 'Revoked',  cls: 'text-gray-400',   Icon: LinkSlashIcon },
  inactive: { label: 'Inactive', cls: 'text-gray-400',   Icon: LinkSlashIcon },
}

export default function IntegrationsPage({ params }: IntegrationsPageProps) {
  const { orgSlug } = params
  const { data: session } = useSession()
  const user = session?.user as any
  const API = process.env.NEXT_PUBLIC_API_URL || ''

  const { data: orgData } = useQuery(GET_ORG_BY_SLUG, { variables: { slug: orgSlug } })
  const org = orgData?.orgs?.[0]
  const orgId = org?.id

  const [integrations, setIntegrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [connectProvider, setConnectProvider] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchIntegrations(id: string) {
    if (!id || !user?.accessToken) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/integrations?org_id=${id}`, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setIntegrations(data.integrations || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (orgId && user?.accessToken) fetchIntegrations(orgId)
  }, [orgId, user?.accessToken])

  async function handleSync(integrationId: string) {
    setSyncing(integrationId)
    try {
      await fetch(`${API}/api/integrations/${integrationId}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.accessToken}` },
      })
      setTimeout(() => fetchIntegrations(orgId), 1500)
    } finally {
      setSyncing(null)
    }
  }

  async function handleRevoke(integrationId: string) {
    if (!confirm('Revoke this integration? The credential will be removed.')) return
    setRevoking(integrationId)
    try {
      await fetch(`${API}/api/integrations/${integrationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.accessToken}` },
      })
      setIntegrations((prev) => prev.filter((i) => i.id !== integrationId))
    } finally {
      setRevoking(null)
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!connectProvider || !apiKey.trim() || !orgId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
        body: JSON.stringify({
          org_id: orgId,
          provider: connectProvider,
          credential_type: 'api_key',
          credential_value: apiKey,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Connection failed')
      }
      setConnectProvider(null)
      setApiKey('')
      await fetchIntegrations(orgId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const connectedProviders = new Set(integrations.map((i) => i.provider))

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">Connect evidence sources to automatically pull compliance artifacts.</p>
      </div>

      {/* Connected integrations */}
      {integrations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Connected</h2>
          <div className="space-y-3">
            {integrations.map((integration) => {
              const meta = PROVIDER_META[integration.provider] || { label: integration.provider, description: '', icon: '🔗' }
              const style = STATUS_STYLES[integration.status] || STATUS_STYLES.inactive
              const { Icon } = style
              return (
                <div key={integration.id} className="bg-white border border-gray-200 rounded-xl px-4 py-4 flex items-center gap-4">
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{meta.label}</span>
                      <span className={`flex items-center gap-1 text-xs font-medium ${style.cls}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {style.label}
                      </span>
                    </div>
                    {integration.last_sync_at && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                      </div>
                    )}
                    {integration.last_error && (
                      <div className="text-xs text-red-500 mt-0.5 truncate">{integration.last_error}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSync(integration.id)}
                      disabled={syncing === integration.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`w-3.5 h-3.5 ${syncing === integration.id ? 'animate-spin' : ''}`} />
                      Sync
                    </button>
                    <button
                      onClick={() => handleRevoke(integration.id)}
                      disabled={revoking === integration.id}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Available integrations */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Available</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(PROVIDER_META).map(([provider, meta]) => {
            const connected = connectedProviders.has(provider)
            return (
              <div
                key={provider}
                className={`bg-white border rounded-xl p-4 flex flex-col gap-3 ${connected ? 'border-green-200 opacity-60' : 'border-gray-200'}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{meta.label}</span>
                      {connected && (
                        <span className="text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Connected</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                  </div>
                </div>
                {!connected && (
                  <button
                    onClick={() => { setConnectProvider(provider); setApiKey(''); setError(null) }}
                    className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Connect
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Connect modal */}
      {connectProvider && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Connect {PROVIDER_META[connectProvider]?.label}
            </h3>
            <p className="text-sm text-gray-500 mb-4">Enter your API key or service credential.</p>
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">API Key / Credential</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste credential here..."
                  required
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setConnectProvider(null)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !apiKey.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
