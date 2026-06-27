import { BlockStack, Box, Button, Divider, InlineStack, Popover, Select, Tooltip, Text } from '@shopify/polaris'
import { DeleteIcon, HideIcon, PlusIcon, ViewIcon } from '@shopify/polaris-icons'
import { FlexRow } from '~/components/common/Flex'
import { SortableList } from '~/components/common/SortableList/SortableList'
import type { EffectConfig } from '~/modules/TemplateEditor/elements/effects/types'
import type TemplateElement from '../../..'
import { ShadowThumbnail } from './ShadowThumbnail'
import { ShadowEffectSettings } from './ShadowEffectSettings'
import { EffectPresets } from './EffectPresets'
import { PresetSettings } from './PresetSettings'
import { useEffectsManager } from './hooks/useEffectsManager'
import type { TLayerStore } from '~/stores/modules/layer'

interface EffectsStackProps {
  element: TemplateElement<any, any>
  clickedLayerStore?: TLayerStore | null
  t: (key: string) => string
  hideList?: boolean
}

export function EffectsStack({ element, clickedLayerStore, t, hideList }: EffectsStackProps) {
  const {
    // State
    effects,
    effectStyle,
    textColor,
    fontSize,
    strokeWeight,
    strokeColor,
    applyColorOverlay,
    fill,

    // UI State
    settingsOpen,
    showAdvanced,
    toggleSettingsOpen,
    closeSettings,
    setShowAdvanced,

    // Effect handlers
    handleAddEffect,
    handleToggleVisible,
    handleChangeType,
    handleRemove,
    handleUpdateEffect,
    handleReorder,

    // Preset handlers
    handleSelectPreset,
    handlePresetParamChange,
    handleApplyColorOverlayChange,
    handleOverlayColorChange,
    handleNeonColorChange,
    handleStrokeWeightChange,
    handleStrokeColorChange,
    handleEdgeStyleChange,
    handleFillChange,

    // Computed values
    neonIntensity,
    embossDirection,
    embossDepth,
    edgeStyle,
    embroiderySheen,
    embroideryDepth,
    embroideryDirection,
  } = useEffectsManager({ element, clickedLayerStore })

  return (
    <Box>
      <BlockStack gap="300">
        <Text as="p" variant="bodyMd" fontWeight="semibold">
          {t('style')}
        </Text>

        <EffectPresets appliedPreset={effectStyle} onApplyPreset={handleSelectPreset} t={t} />

        <PresetSettings
          effectStyle={effectStyle}
          neonIntensity={neonIntensity}
          onNeonIntensityChange={v => handlePresetParamChange('intensity', v)}
          neonColor={textColor}
          onNeonColorChange={handleNeonColorChange}
          direction={effectStyle === 'embroidery' ? embroideryDirection : embossDirection}
          depth={effectStyle === 'embroidery' ? embroideryDepth : embossDepth}
          onDirectionChange={v => handlePresetParamChange('direction', v)}
          onDepthChange={v => handlePresetParamChange('depth', v)}
          applyColorOverlay={applyColorOverlay}
          onApplyColorOverlayChange={handleApplyColorOverlayChange}
          onOverlayColorChange={handleOverlayColorChange}
          edgeStyle={edgeStyle}
          onEdgeStyleChange={handleEdgeStyleChange}
          strokeWeight={strokeWeight}
          strokeColor={strokeColor}
          onStrokeWeightChange={handleStrokeWeightChange}
          onStrokeColorChange={handleStrokeColorChange}
          embroiderySheen={embroiderySheen}
          onEmbroiderySheenChange={v => handlePresetParamChange('sheen', v)}
          fill={fill}
          onFillChange={handleFillChange}
          t={t}
        />

        {!hideList && (
          <InlineStack align="end">
            <Button variant="plain" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? t('hide-advanced') : t('advanced')}
            </Button>
          </InlineStack>
        )}

        {!hideList && showAdvanced && (
          <>
            <Divider />
            <InlineStack align="space-between">
              <Text as="h4" variant="headingSm">
                {t('custom-effects')}
              </Text>
              <Button icon={PlusIcon} variant="tertiary" onClick={() => handleAddEffect('DROP_SHADOW', true)}>
                {t('add-effect')}
              </Button>
            </InlineStack>
            <SortableList
              items={effects.map((e, i) => ({ id: `${(e as any)._id || i}`, index: i, payload: e }))}
              onChange={handleReorder}
              renderItem={item => {
                const idx = (item as any).index as number
                const e = (item as any).payload as EffectConfig
                const effId = `${item.id}`
                const isOpen = settingsOpen[effId] ?? false

                return (
                  <SortableList.Item id={item.id} className="EffectRow" styles={{ padding: '0px' }}>
                    <Box
                      width="100%"
                      padding="200"
                      shadow="200"
                      borderColor="border"
                      borderWidth="025"
                      borderRadius="200"
                    >
                      <InlineStack gap="150" blockAlign="center" align="space-between">
                        <FlexRow gap="150" style={{ flex: 1 }}>
                          <SortableList.DragHandle style={{ visibility: 'visible' }} />

                          <Popover
                            active={isOpen}
                            onClose={() => closeSettings(effId)}
                            preferredPosition="below"
                            preventCloseOnChildOverlayClick
                            activator={
                              <div style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
                                <Tooltip content={t('settings')}>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    style={{ cursor: 'pointer', display: 'flex' }}
                                    onClick={() => toggleSettingsOpen(effId)}
                                    onKeyDown={ev => {
                                      if (ev.key === 'Enter' || ev.key === ' ') {
                                        ev.preventDefault()
                                        toggleSettingsOpen(effId)
                                      }
                                    }}
                                  >
                                    <ShadowThumbnail effect={e} textColor={textColor} />
                                  </div>
                                </Tooltip>
                              </div>
                            }
                          >
                            <Popover.Section>
                              <Box maxWidth="280px">
                                <ShadowEffectSettings
                                  effect={e}
                                  index={idx}
                                  fontSize={fontSize}
                                  onUpdate={handleUpdateEffect}
                                  t={t}
                                />
                              </Box>
                            </Popover.Section>
                          </Popover>

                          <div style={{ flex: 1 }}>
                            <Select
                              labelHidden
                              label="effect-type"
                              options={[
                                { label: t('drop-shadow'), value: 'DROP_SHADOW' },
                                { label: t('inner-shadow'), value: 'INNER_SHADOW' },
                              ]}
                              value={e.type}
                              onChange={val => handleChangeType(idx, val as EffectConfig['type'])}
                            />
                          </div>
                        </FlexRow>

                        <InlineStack gap="200" blockAlign="center" align="end">
                          <Tooltip content={t('toggle-visibility')}>
                            <Button
                              icon={(e as any).visible ? ViewIcon : HideIcon}
                              variant="tertiary"
                              onClick={() => handleToggleVisible(idx, !(e as any).visible)}
                            />
                          </Tooltip>

                          <Tooltip content={t('remove')}>
                            <Button icon={DeleteIcon} variant="tertiary" onClick={() => handleRemove(idx)} />
                          </Tooltip>
                        </InlineStack>
                      </InlineStack>
                    </Box>
                  </SortableList.Item>
                )
              }}
            />
          </>
        )}
      </BlockStack>
    </Box>
  )
}
