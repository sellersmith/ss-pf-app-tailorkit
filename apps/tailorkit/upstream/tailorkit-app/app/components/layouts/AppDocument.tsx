import { Links, Meta, Scripts, ScrollRestoration, useNavigate } from '@remix-run/react'
import type { RemixQueryClient } from '~/libs/remix-query/query-client'
import { EnvScriptInjector } from '../EnvScriptInjector'
import { AppProviders } from './AppProviders'
import DevToolsScriptInjector from '../DevToolsScriptInjector'
import { useEffect } from 'react'

interface AppDocumentProps {
  children: React.ReactNode
  apiKey: string
  language: string
  remixQueryClient: RemixQueryClient
  polarisStyles: string
  crispChatStyles: string
  globalStyles: string
  publicEnv: Record<string, unknown>
}

export function AppDocument({
  children,
  apiKey,
  language,
  remixQueryClient,
  polarisStyles,
  crispChatStyles,
  globalStyles,
  publicEnv,
}: AppDocumentProps) {
  const isDevelopment = publicEnv?.NODE_ENV === 'development'
  const enableDevTools = isDevelopment && (publicEnv?.ENABLE_DEVTOOLS as boolean)

  const navigate = useNavigate()

  useEffect(() => {
    const handleNavigate = (event: any) => {
      const href = event.target.getAttribute('href')
      if (href) navigate(href)
    }

    document.addEventListener('shopify:navigate', handleNavigate)
    return () => {
      document.removeEventListener('shopify:navigate', handleNavigate)
    }
  }, [navigate])

  return (
    <html lang={language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preload" href={'/assets/tailorkit_image_placeholder.jpg'} as="image" />
        <link rel="preload" href={'/assets/tailorkit_image_placeholder_white.jpg'} as="image" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link rel="stylesheet" href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css" />
        <link rel="stylesheet" href={polarisStyles} />
        <link rel="stylesheet" href={crispChatStyles} />
        <link rel="stylesheet" href={globalStyles} />
        <script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
        <DevToolsScriptInjector enableDevTools={enableDevTools} />
        <Meta />
        <Links />
      </head>
      <body>
        <AppProviders apiKey={apiKey} remixQueryClient={remixQueryClient}>
          {children}
        </AppProviders>
        <ScrollRestoration />
        <EnvScriptInjector publicEnv={publicEnv} />
        <Scripts />
      </body>
    </html>
  )
}
