/**
 * StrokeListItem - Individual stroke row in the SortableList
 *
 * Displays stroke thumbnail, settings popover, and controls
 * for visibility toggle and deletion.
 *
 * @module TemplateEditor/elements/components/Text/Styling/Strokes
 */

import { Box, Button, InlineStack, Popover, Tooltip, Text } from '@shopify/polaris'
import { DeleteIcon, HideIcon, ViewIcon } from '@shopify/polaris-icons'
import type { StrokeConfig, Paint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { SortableList } from '~/components/common/SortableList/SortableList'
import { FlexRow } from '~/components/common/Flex'
import { FillPreview } from '../Fill/FillPreview'
import { StrokeSettings } from './StrokeSettings'

interface StrokeListItemProps {
  /** Stroke configuration */
  stroke: StrokeConfig
  /** Index in the strokes array */
  index: number
  /** Whether the settings popover is open */
  isSettingsOpen: boolean
  /** Toggle settings popover */
  onToggleSettings: () => void
  /** Close settings popover */
  onCloseSettings: () => void
  /** Toggle visibility */
  onToggleVisible: (index: number, visible: boolean) => void
  /** Remove stroke */
  onRemove: (index: number) => void
  /** Update paint */
  onPaintChange: (index: number, paint: Paint) => void
  /** Update weight */
  onWeightChange: (index: number, weight: number) => void
  /** Translation function */
  t: (key: string) => string
  /** Shop domain for asset uploads */
  shopDomain?: string
}

export function StrokeListItem({
  stroke,
  index,
  isSettingsOpen,
  onToggleSettings,
  onCloseSettings,
  onToggleVisible,
  onRemove,
  onPaintChange,
  onWeightChange,
  t,
  shopDomain,
}: StrokeListItemProps) {
  return (
    <SortableList.Item id={stroke._id} className="StrokeRow" styles={{ padding: '0px' }}>
      <Box width="100%" padding="200" shadow="200" borderColor="border" borderWidth="025" borderRadius="200">
        <InlineStack gap="150" blockAlign="center" align="space-between">
          <FlexRow gap="150" style={{ flex: 1 }} align={'center'}>
            <SortableList.DragHandle style={{ visibility: 'visible' }} />

            <Popover
              active={isSettingsOpen}
              onClose={onCloseSettings}
              preferredPosition="below"
              preventCloseOnChildOverlayClick
              activator={
                <div style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
                  <Tooltip content={t('settings')}>
                    <div
                      role="button"
                      tabIndex={0}
                      style={{ cursor: 'pointer', display: 'flex' }}
                      onClick={onToggleSettings}
                      onKeyDown={ev => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          onToggleSettings()
                        }
                      }}
                    >
                      <FillPreview paint={stroke.paint} size="small" />
                    </div>
                  </Tooltip>
                </div>
              }
            >
              <Popover.Section>
                <Box maxWidth="280px">
                  <StrokeSettings
                    stroke={stroke}
                    index={index}
                    onPaintChange={onPaintChange}
                    onWeightChange={onWeightChange}
                    t={t}
                    shopDomain={shopDomain}
                  />
                </Box>
              </Popover.Section>
            </Popover>

            <div style={{ flex: 1 }}>
              <Text as="span" variant="bodySm">
                {t('stroke')} {index + 1}
              </Text>
            </div>
          </FlexRow>

          <InlineStack gap="200" blockAlign="center" align="end">
            <Tooltip content={t('toggle-visibility')}>
              <Button
                icon={stroke.visible ? ViewIcon : HideIcon}
                variant="tertiary"
                onClick={() => onToggleVisible(index, !stroke.visible)}
              />
            </Tooltip>

            <Tooltip content={t('remove')}>
              <Button icon={DeleteIcon} variant="tertiary" onClick={() => onRemove(index)} />
            </Tooltip>
          </InlineStack>
        </InlineStack>
      </Box>
    </SortableList.Item>
  )
}
