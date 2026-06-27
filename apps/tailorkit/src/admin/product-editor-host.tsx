import React from 'react'
import { Banner, BlockStack, Button, InlineStack, Text } from '@shopify/polaris'
import type { TailorKitIntegrationRecord } from '../domain/product-personalizer'
import type { TailorKitProductEditorSaveRequest } from '../domain/product-editor-save-payload'
import type { TailorKitThemeConfig } from './api'
import type { EditorTab } from './product-editor-island/route-contract'

export const productEditorScaffoldHostExecutionMode = 'disabled-copy-first-only' as const

export interface ProductEditorHostProps {
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
}

/**
 * Deprecated scaffold guard.
 * ProductEditor must come from the copied TailorKit upstream island, not from the handwritten PageFly scaffold.
 */
export const ProductEditorHost: React.FC<ProductEditorHostProps> = ({ item, onBack }) => (
  <BlockStack gap="400">
    <InlineStack align="space-between" blockAlign="center">
      <Text as="h2" variant="headingLg">
        {item.title || 'Product Personalizer'}
      </Text>
      <Button onClick={onBack}>Back</Button>
    </InlineStack>
    <Banner tone="warning" title="ProductEditor scaffold disabled">
      <Text as="p">
        This host is disabled by the copy-first migration policy. Use the copied TailorKit ProductEditor upstream
        island through explicit PageFly app-platform adapters.
      </Text>
    </Banner>
  </BlockStack>
)
