import React, { useEffect, useRef, useState } from 'react'
import { Banner, BlockStack, Button, InlineStack, Text } from '@shopify/polaris'
import type { AdminAppHost, AppApiClient } from '../../../../../web/core/src/app-platform/admin'
import type { TailorKitThemeConfig } from '../api'
import type { EditorTab } from './route-contract'
import type { TailorKitIntegrationRecord } from '../../domain/product-personalizer'
import type { TailorKitProductEditorSaveRequest } from '../../domain/product-editor-save-payload'
import type { TailorKitProductEditorLoaderData } from '../../domain/product-editor-loader-adapter'
import { TailorKitProductEditorLoaderProvider } from './pagefly-product-editor-loader-context'
import { loadTailorKitProductEditorRuntime } from './runtime-loader'

export const productEditorIslandExecutionMode = 'runtime-loader-preserved' as const
export const productEditorIslandUpstreamEntry = 'app/modules/ProductEditor/index.tsx'
export const productEditorIslandDeprecatedScaffoldEntry = 'apps/tailorkit/src/admin/product-editor-host.tsx'

export interface ProductEditorIslandHostProps {
  item: TailorKitIntegrationRecord
  shopDomain?: string
  initialTab?: EditorTab
  saving?: boolean
  publishing?: boolean
  themeConfig?: TailorKitThemeConfig | null
  onBack(): void
  onSave(id: string, input: TailorKitProductEditorSaveRequest): Promise<void>
  onPublish(id: string): Promise<void>
  onUnpublish(id: string): Promise<void>
  onNavigate?(path: string): void
  onTabChange?(tab: EditorTab): void
  onRefreshThemeConfig?(): Promise<void>
  host?: AdminAppHost
  apiClient?: AppApiClient
  loaderData?: TailorKitProductEditorLoaderData | null
}

/**
 * Dormant ProductEditor migration seam.
 * A future app-level TailorKit compatibility layer may mount this runtime; the active admin shell does not.
 */
export const ProductEditorIslandHost: React.FC<ProductEditorIslandHostProps> = ({
  host,
  apiClient,
  loaderData,
  item,
  onBack,
}) => {
  const runtimeTargetRef = useRef<HTMLDivElement | null>(null)
  const [loadingRuntime, setLoadingRuntime] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const runtimeApiClient = apiClient ?? host?.api

  useEffect(() => {
    if (!host || !runtimeApiClient || !loaderData || !runtimeTargetRef.current) return undefined

    let cancelled = false
    let cleanup: (() => void) | undefined
    setLoadingRuntime(true)
    setLoadError(null)

    void loadTailorKitProductEditorRuntime(host)
      .then(runtime => {
        if (cancelled || !runtimeTargetRef.current) return
        const handle = runtime.renderTailorKitProductEditorIsland(runtimeTargetRef.current, {
          apiClient: runtimeApiClient,
          loaderData,
          route: host.route,
          onNavigate: host.ports.navigation.navigate,
        })
        cleanup = handle.unmount
      })
      .catch(error => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Cannot load TailorKit ProductEditor runtime')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRuntime(false)
      })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [host, loaderData, runtimeApiClient])

  return (
    <TailorKitProductEditorLoaderProvider
      loaderData={loaderData}
      route={host?.route}
      onNavigate={host?.ports.navigation.navigate}
    >
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingLg">
            {item.title || 'Product Personalizer'}
          </Text>
          <Button onClick={onBack}>Back</Button>
        </InlineStack>
        {/* AI generation/effects (image generation, AI effects, remove background, vectorize, and the
            Elva AI assistant) are not wired in the app-platform port yet. Their controls still render
            inside the copied editor runtime, so surface a clear notice above it rather than leave the
            merchant to click controls that silently do nothing. */}
        <Banner tone="info" title="AI features coming soon">
          <Text as="p">
            AI tools — image generation, AI effects, remove background, vectorize, and the Elva AI
            assistant — are being finalized in the new PageFly-integrated app and are not available yet.
            We&apos;ll let you know as soon as they&apos;re ready.
          </Text>
        </Banner>
        {!host || !runtimeApiClient || !loaderData ? (
          <Banner tone="warning" title="ProductEditor runtime unavailable">
            <Text as="p">
              TailorKit ProductEditor needs PageFly app host assets and loader data before the copied runtime island can
              mount.
            </Text>
          </Banner>
        ) : null}
        {loadError ? (
          <Banner tone="critical" title="Cannot load ProductEditor">
            <Text as="p">{loadError}</Text>
          </Banner>
        ) : null}
        {loadingRuntime ? <Text as="p">Loading ProductEditor...</Text> : null}
        <div ref={runtimeTargetRef} />
      </BlockStack>
    </TailorKitProductEditorLoaderProvider>
  )
}
