import { useCallback, useState } from 'react'
import { t } from 'i18next'
import { BlockStack, Box, Button, InlineStack, RangeSlider, Text, TextField, Thumbnail } from '@shopify/polaris'
import { DeleteIcon, ImageIcon } from '@shopify/polaris-icons'
import type { TLayerStore } from '~/stores/modules/layer'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { clampDegrees } from '~/utils/canvas/charm-geometry'
import { useCharmNodeActions } from './hooks/useCharmNodeActions'

interface NodeListTableProps {
  layerStore: TLayerStore
  onSelectNode?: (nodeId: string) => void
  /**
   * Optional rotation snap step (degrees) coming from the panel-level "Snap" control.
   * When > 0, free-form rotation input on each slot is rounded to the nearest multiple
   * on blur — so admins setting "Snap to 15°" cannot accidentally enter 17°.
   * 0 / undefined = no snap (free input).
   */
  snapStep?: number
}

export function NodeListTable({ layerStore, snapStep }: NodeListTableProps) {
  const { nodes, updateNode, deleteNode } = useCharmNodeActions(layerStore)
  const { trackAction } = useFeatureTracking('charm_builder')
  const [rotationInputs, setRotationInputs] = useState<Record<string, string>>({})

  const handleSlotLimitChange = useCallback(
    (nodeId: string, value: number) => {
      updateNode(nodeId, { slotLimit: value })
    },
    [updateNode]
  )

  const handleRotationChange = useCallback((nodeId: string, value: string) => {
    setRotationInputs(prev => ({ ...prev, [nodeId]: value }))
  }, [])

  const handleRotationBlur = useCallback(
    (nodeId: string, currentValue: number) => {
      const raw = rotationInputs[nodeId]
      if (raw === undefined) return
      let next = clampDegrees(Number(raw))
      // Apply panel-level snap step on commit so the entered value lines up with the
      // configured cadence (e.g. snapStep=15 → 17 → 15). Skips when snapStep is 0.
      if (snapStep && snapStep > 0) {
        next = clampDegrees(Math.round(next / snapStep) * snapStep)
      }
      if (next !== currentValue) {
        updateNode(nodeId, { rotation: next })
        trackAction('slot_rotation_set', { value: next, source: snapStep ? `snap_${snapStep}` : 'input' })
      }
      setRotationInputs(prev => {
        const remaining = { ...prev }
        delete remaining[nodeId]
        return remaining
      })
    },
    [rotationInputs, updateNode, trackAction, snapStep]
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      deleteNode(nodeId)
    },
    [deleteNode]
  )

  if (nodes.length === 0) {
    return (
      <Box padding="400" background="bg-surface-secondary" borderRadius="200">
        <BlockStack gap="200" align="center">
          <Text as="p" variant="bodySm" tone="subdued" alignment="center">
            {t('no-slots-yet-click-canvas')}
          </Text>
        </BlockStack>
      </Box>
    )
  }

  return (
    <BlockStack gap="200">
      {nodes.map((node, index) => {
        const currentRotation = node.rotation ?? 0
        const inputValue = rotationInputs[node._id] ?? String(currentRotation)
        return (
          <Box
            key={node._id}
            padding="200"
            background="bg-surface-secondary"
            borderRadius="200"
            borderWidth="025"
            borderColor="border"
          >
            <BlockStack gap="150">
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <InlineStack gap="150" blockAlign="center" wrap={false}>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {`#${index + 1}`}
                  </Text>
                  {node.defaultCharm ? (
                    <Thumbnail
                      source={node.defaultCharm.thumbnailUrl}
                      alt={node.defaultCharm.title}
                      size="extraSmall"
                    />
                  ) : (
                    <Thumbnail source={ImageIcon} alt="No charm" size="extraSmall" />
                  )}
                  <Text as="span" variant="bodySm" tone="subdued" truncate>
                    {node.defaultCharm?.title || t('no-charm')}
                  </Text>
                </InlineStack>
                <Button
                  icon={DeleteIcon}
                  variant="plain"
                  tone="critical"
                  onClick={() => handleDeleteNode(node._id)}
                  accessibilityLabel={t('delete-node')}
                />
              </InlineStack>

              <InlineStack gap="200" blockAlign="center" wrap={false}>
                <Box width="100%">
                  <RangeSlider
                    label={`${t('max-charms-per-slot')}: ${node.slotLimit}`}
                    min={1}
                    max={3}
                    step={1}
                    value={node.slotLimit}
                    onChange={value => handleSlotLimitChange(node._id, value as number)}
                  />
                </Box>
              </InlineStack>

              <InlineStack gap="200" blockAlign="center" wrap={false}>
                <Box width="100%">
                  <TextField
                    label={t('rotation')}
                    type="number"
                    inputMode="numeric"
                    suffix="°"
                    min={0}
                    max={359}
                    value={inputValue}
                    onChange={value => handleRotationChange(node._id, value)}
                    onBlur={() => handleRotationBlur(node._id, currentRotation)}
                    autoComplete="off"
                  />
                </Box>
              </InlineStack>
            </BlockStack>
          </Box>
        )
      })}
    </BlockStack>
  )
}
