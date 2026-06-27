import { BlockStack, InlineStack, Spinner, Text } from '@shopify/polaris'
import React from 'react'

interface TailorKitCopiedRouteLoadingProps {
  label?: string
}

const loadingSurfaceStyle: React.CSSProperties = {
  display: 'grid',
  minHeight: 320,
  padding: 'var(--p-space-800) var(--p-space-400)',
  placeItems: 'center',
}

const loadingContentStyle: React.CSSProperties = {
  maxWidth: 360,
  width: '100%',
}

export function TailorKitCopiedRouteLoading({
  label = 'Loading TailorKit...',
}: TailorKitCopiedRouteLoadingProps) {
  return (
    <div aria-busy="true" aria-live="polite" style={loadingSurfaceStyle}>
      <div style={loadingContentStyle}>
        <BlockStack align="center" gap="300">
          <InlineStack align="center">
            <Spinner accessibilityLabel={label} size="large" />
          </InlineStack>
          <Text as="p" alignment="center" tone="subdued">
            {label}
          </Text>
        </BlockStack>
      </div>
    </div>
  )
}
