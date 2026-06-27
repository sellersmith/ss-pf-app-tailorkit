import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * Error boundary for the wizard — catches render crashes and displays debug info.
 * Used by WizardInPage.
 */
export class WizardErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WizardErrorBoundary]', error, info.componentStack)
    fetch('/api/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'wizard-crash',
        error: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
      }),
    }).catch(() => {})
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, color: 'red', fontSize: 14, wordBreak: 'break-all' }}>
          <h3>Wizard Crash Caught</h3>
          <p>
            <strong>{this.state.error.message}</strong>
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
