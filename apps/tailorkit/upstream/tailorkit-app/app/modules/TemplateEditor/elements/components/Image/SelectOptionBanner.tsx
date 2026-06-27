/**
 * Banner component to guide users to select an option before editing image.
 * - Outer image banner: ALWAYS shows when in individual mode without selection (transforms are blocked)
 * - Inner image banner: Shows when user double-clicks to edit crop (triggered by flag)
 */

import { Banner, Card, Text } from '@shopify/polaris'
import { t } from 'i18next'
import { useStore } from '~/libs/external-store'
import { SubInspectorStore, subInspectorStoreActions } from '~/stores/canvas/subInspector'
import type { TLayerStore } from '~/stores/modules/layer'
import { EOptionSet, optionSetDataKeys, type ImageOptionSet } from '~/types/psd'

export interface SelectOptionBannerProps {
  layerStore: TLayerStore
}

export function SelectOptionBanner({ layerStore }: SelectOptionBannerProps) {
  const subInspectorData = useStore(SubInspectorStore, s => s.data)
  const showInnerBanner = subInspectorData?.showSelectInnerOptionBanner === true

  const editingMode = useStore(layerStore, s => {
    const imageOptionSet = s.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)
    return ((imageOptionSet as any)?.editingMode as 'sync' | 'individual') || 'sync'
  })

  const hasSelection = useStore(layerStore, s => {
    const imageOptionSet = s.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)
    if (!imageOptionSet) return false
    const dataKey = optionSetDataKeys[EOptionSet.IMAGE_OPTION]
    const files: ImageOptionSet[] = (imageOptionSet.data as Record<string, any>)?.[dataKey] || []
    return files.some(f => f.selecting)
  })

  const isIndividualWithoutSelection = editingMode === 'individual' && !hasSelection

  // Outer banner: ALWAYS show when individual mode + no selection (transforms are blocked)
  // Inner banner: Only show when flag is set (user double-clicked to edit crop)
  const shouldShowInner = showInnerBanner && isIndividualWithoutSelection
  const shouldShowOuter = !shouldShowInner && isIndividualWithoutSelection

  if (!shouldShowOuter && !shouldShowInner) {
    return null
  }

  // Determine which banner to show (inner takes priority)
  const isInnerEdit = shouldShowInner
  const title = isInnerEdit ? t('select-an-option-to-edit-inner-image') : t('select-an-option-to-edit-outer-image')
  const description = isInnerEdit
    ? t('in-individual-mode-select-an-option-first-to-edit-its-crop-position-within-the-mask')
    : t('in-individual-mode-select-an-option-first-to-resize-move-or-rotate-the-image')

  const handleDismiss = () => {
    if (isInnerEdit) {
      subInspectorStoreActions.updateData({ showSelectInnerOptionBanner: false })
    }
    // Outer banner cannot be dismissed - it's always shown when conditions are met
  }

  return (
    <Card padding="0">
      <Banner title={title} tone="info" onDismiss={isInnerEdit ? handleDismiss : undefined}>
        <Text as="p" variant="bodyMd">
          {description}
        </Text>
      </Banner>
    </Card>
  )
}
