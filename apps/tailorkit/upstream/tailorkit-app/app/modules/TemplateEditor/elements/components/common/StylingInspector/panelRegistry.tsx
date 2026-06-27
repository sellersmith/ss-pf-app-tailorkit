import React from 'react'
import { BlockStack, Box, Divider, Text } from '@shopify/polaris'
import type TemplateElement from '../..'
import { TextColorPanel } from '../../Text/Styling/Effects/TextColorPanel'
import { FillPanel } from '../../Text/Styling/Fill/FillPanel'
import { EffectsPanel } from '../../Text/Styling/Effects/EffectsPanel'
import { EffectsStack } from '../../Text/Styling/Effects/EffectsStack'
import { AdvancedTypographyPanel } from '../../Text/Styling/Typography/AdvancedTypographyPanel'
import { FontFamilyInspectorPanel } from '../../Text/Styling/Typography/FontFamily/FontFamilyInspectorPanel'
import { TransformationPanel } from './TransformationPanel'
import { AIImageInspectorPanel } from './AIImageInspectorPanel'
import { AIImageRemixPanel } from './AIImageRemixPanel'
import { BackgroundRemovalPanel } from './BackgroundRemovalPanel'
import { PromptPresetSelectorPanel } from './PromptPresetSelectorPanel'
import type { TLayerStore } from '~/stores/modules/layer'
import { EffectsTutorialBanner } from '../../Text/Styling/Effects/EffectsTutorialBanner'

/**
 * Panel registry that defines how to render each inspector panel
 * This allows us to render panels with fresh props without storing JSX content
 */

interface PanelRenderContext {
  element: TemplateElement<any, any> // The current template element instance
  t: (key: string) => string // Translation function
  clickedLayerStore: TLayerStore | null | undefined
  // Additional data can be passed through the store
  data?: any
}

type PanelRenderer = (context: PanelRenderContext) => React.ReactNode

/**
 * Helper function to check if a panel supports the current element type
 * Returns a fallback message if not supported, null if supported
 *
 * For nested elements (e.g., text inside multi-layout), prioritizes clickedLayerStore
 * to validate against the clicked child element rather than the parent
 */
function checkElementTypeSupport(
  element: any,
  clickedLayerStore: TLayerStore | null | undefined,
  supportedTypes: string[],
  panelName: string,
  t: (key: string, replacements?: Record<string, string>) => string
): React.ReactNode | null {
  // Prioritize clickedLayerStore for nested elements (e.g., text in multi-layout)
  // Falls back to element.state for regular elements
  const targetElement = clickedLayerStore?.getState() || element?.state
  const elementType = targetElement?.type || 'unknown'

  if (!supportedTypes.includes(elementType)) {
    return (
      <BlockStack gap={'200'}>
        <Text as="p" variant="bodyMd">
          {panelName}
        </Text>
        <Text as="p" variant="bodySm">
          {t('panelname-is-only-available-for-supportedtypes-elements', {
            panelName,
            supportedTypes: supportedTypes.join(', '),
          })}
        </Text>
      </BlockStack>
    )
  }

  return null // Element type is supported
}

export const PANEL_REGISTRY: Record<string, PanelRenderer> = {
  // New unified fill panel (supports solid, image, gradient)
  fill: ({ element, clickedLayerStore, t }) => {
    // Check element type support first
    const unsupportedMessage = checkElementTypeSupport(element, clickedLayerStore, ['text'], 'Fill', t)
    if (unsupportedMessage) return unsupportedMessage

    return <FillPanel element={element} clickedLayerStore={clickedLayerStore} />
  },

  // Legacy text-color panel (kept for backward compatibility)
  'text-color': ({ element, clickedLayerStore, t }) => {
    // Check element type support first
    const unsupportedMessage = checkElementTypeSupport(element, clickedLayerStore, ['text'], 'Text Color', t)
    if (unsupportedMessage) return unsupportedMessage

    return <TextColorPanel element={element} t={t} />
  },

  effects: ({ element, clickedLayerStore, t }) => {
    // Check element type support first
    const unsupportedMessage = checkElementTypeSupport(element, clickedLayerStore, ['text'], 'Effects', t)
    if (unsupportedMessage) return unsupportedMessage

    return (
      <Box paddingBlockEnd="400">
        <BlockStack gap="400">
          <EffectsTutorialBanner />
          <EffectsStack element={element} clickedLayerStore={clickedLayerStore} t={t} hideList={false} />
          <Divider />
          <EffectsPanel element={element} clickedLayerStore={clickedLayerStore} />
          <Divider />
          <BlockStack gap="300">
            <Text as="p" variant="headingSm">
              {t('other-settings')}
            </Text>
            <AdvancedTypographyPanel element={element} clickedLayerStore={clickedLayerStore} t={t} />
          </BlockStack>
        </BlockStack>
      </Box>
    )
  },

  'font-family': ({ element, clickedLayerStore, t }) => {
    // Check element type support first
    const unsupportedMessage = checkElementTypeSupport(element, clickedLayerStore, ['text'], 'Font Family', t)
    if (unsupportedMessage) return unsupportedMessage

    return <FontFamilyInspectorPanel element={element} clickedLayerStore={clickedLayerStore} t={t} />
  },

  transformation: ({ element, t }) => {
    return <TransformationPanel element={element} t={t} />
  },

  'ai-image-generator': () => {
    return <AIImageInspectorPanel />
  },

  'ai-image-remix': ({ data }) => {
    return <AIImageRemixPanel imageUrl={data?.imageUrl} />
  },

  'remove-background': ({ element, t }) => {
    return <BackgroundRemovalPanel element={element} t={t} />
  },

  'quick-prompt-selector': ({ data }) => {
    return (
      <PromptPresetSelectorPanel type="quick_prompt" onSelect={data?.onSelect} selected={data?.enabledQuickPrompts} />
    )
  },

  'template-type-selector': ({ data }) => {
    return (
      <PromptPresetSelectorPanel type="template_type" onSelect={data?.onSelect} selected={data?.enabledTemplateTypes} />
    )
  },

  'visual-style-selector': ({ data }) => {
    return (
      <PromptPresetSelectorPanel
        type="visual_style"
        onSelect={data?.onSelect}
        selected={data?.enabledVisualStyles}
        required={true}
      />
    )
  },

  'content-theme-selector': ({ data }) => {
    return (
      <PromptPresetSelectorPanel type="content_theme" onSelect={data?.onSelect} selected={data?.enabledContentThemes} />
    )
  },
}

/**
 * Renders a panel by ID with fresh context
 * Each panel is responsible for its own element type validation
 */
export function renderPanel(panelId: string, context: PanelRenderContext): React.ReactNode {
  const renderer = PANEL_REGISTRY[panelId]

  if (!renderer) {
    return (
      <BlockStack gap={'200'}>
        <Text as="p" variant="bodyMd">
          Unknown Panel
        </Text>
        <Text as="p" variant="bodySm">
          Panel "{panelId}" not found in registry.
        </Text>
      </BlockStack>
    )
  }

  try {
    return renderer(context)
  } catch (error) {
    console.error(`[PanelRegistry] Error rendering panel ${panelId}:`, error)
    return (
      <BlockStack gap={'200'}>
        <Text as="p" variant="bodyMd">
          Panel Error
        </Text>
        <Text as="p" variant="bodySm">
          Failed to render panel "{panelId}".
        </Text>
      </BlockStack>
    )
  }
}
