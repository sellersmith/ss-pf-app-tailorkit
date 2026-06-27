import { Text } from '@shopify/polaris'
import { isRouteErrorResponse, useRouteError } from '@remix-run/react'
import React from 'react'

export function ErrorBoundary(props?: { error: Error }) {
  const error = useRouteError() || props?.error

  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <Text as="h1" variant="headingLg">
          {error.status} {error.statusText}
        </Text>
        <Text as="p" variant="headingMd">
          {error.data}
        </Text>
      </div>
    )
  }

  if (error instanceof Error) {
    return (
      <div>
        <Text as="h1" variant="headingLg">
          Error
        </Text>
        <Text as="p" variant="headingMd">
          {error.message}
        </Text>
        <Text as="p" variant="headingMd">
          The stack trace is:
        </Text>
        <pre>{error.stack}</pre>
      </div>
    )
  }

  return (
    <Text as="h1" variant="headingLg">
      Unknown Error
    </Text>
  )
}

export function ErrorBoundaryFallback() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      <div style={{ maxWidth: '800px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" style={{ maxWidth: '100px' }}>
          <path d="M10 6.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 1 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75Z" />
          <path d="M11 13.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
          <path
            fillRule="evenodd"
            // eslint-disable-next-line max-len
            d="M10 3.5c-1.045 0-1.784.702-2.152 1.447a449.26 449.26 0 0 1-2.005 3.847l-.028.052a403.426 403.426 0 0 0-2.008 3.856c-.372.752-.478 1.75.093 2.614.57.863 1.542 1.184 2.464 1.184h7.272c.922 0 1.895-.32 2.464-1.184.57-.864.465-1.862.093-2.614-.21-.424-1.113-2.147-2.004-3.847l-.032-.061a429.497 429.497 0 0 1-2.005-3.847c-.368-.745-1.107-1.447-2.152-1.447Zm-.808 2.112c.404-.816 1.212-.816 1.616 0 .202.409 1.112 2.145 2.022 3.88a418.904 418.904 0 0 1 2.018 3.875c.404.817 0 1.633-1.212 1.633h-7.272c-1.212 0-1.617-.816-1.212-1.633.202-.408 1.113-2.147 2.023-3.883a421.932 421.932 0 0 0 2.017-3.872Z"
          />
        </svg>

        <div style={{ display: 'flex', margin: '0', flexDirection: 'column', gap: '8px' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', letterSpacing: '-0.0125em', lineHeight: '1.5rem' }}>
            There’s a problem loading this page{' '}
          </h1>
          <p style={{ margin: '0', fontSize: '0.875rem', lineHeight: '1.25rem', color: '#667085' }}>
            There’s a technical problem with TailorKit that has prevented this page from loading.
            <span style={{ fontWeight: 'bold', color: '#101828' }}>Try reloading this page</span> or going to another
            page. If that doesn’t work,{' '}
            <a href="https://ecomate.co/pages/tailorkit" target="_blank" rel="noopener noreferrer">
              contact our support team
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Component-level error boundary to catch rendering errors in child components.
 * Usage:
 * <ComponentErrorBoundary>
 *   <PotentiallyErrorProneComponent />
 * </ComponentErrorBoundary>
 */
export class ComponentErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for diagnostics/observability
    console.error('ComponentErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorBoundaryFallback />
    }

    return this.props.children
  }
}
