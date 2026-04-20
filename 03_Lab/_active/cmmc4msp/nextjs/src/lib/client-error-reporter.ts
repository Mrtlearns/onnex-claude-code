const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.cmmc4msp.on-nex.us'

export interface ClientErrorOpts {
  message: string
  stack?: string
  componentStack?: string
  route?: string
  component?: string
}

export async function reportClientError(opts: ClientErrorOpts): Promise<void> {
  try {
    await fetch(`${API_URL}/api/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: opts.message,
        stack: opts.stack,
        component_stack: opts.componentStack,
        route: opts.route ?? (typeof window !== 'undefined' ? window.location.pathname : ''),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        component: opts.component ?? 'unknown',
      }),
    })
  } catch {
    // Never let the reporter crash the app
  }
}
