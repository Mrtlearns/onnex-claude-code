'use client'
import { useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.cmmc4msp.on-nex.us'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    fetch(`${API_URL}/api/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        component: 'global-error',
      }),
    }).catch(() => {}) // swallow — avoid infinite loops
  }, [error])

  return (
    <html>
      <body>
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            This error has been reported automatically.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
