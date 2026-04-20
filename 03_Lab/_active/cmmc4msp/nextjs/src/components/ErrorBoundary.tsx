'use client'
import { Component, ReactNode } from 'react'
import { reportClientError } from '@/lib/client-error-reporter'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    reportClientError({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      component: 'ErrorBoundary',
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-4 text-sm text-red-600 border border-red-200 rounded bg-red-50">
            An error occurred in this section.
          </div>
        )
      )
    }
    return this.props.children
  }
}
