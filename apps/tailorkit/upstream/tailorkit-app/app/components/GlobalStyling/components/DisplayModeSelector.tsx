import { BlockStack, Box, Card, Icon, InlineStack, Scrollable, Text } from '@shopify/polaris'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import type { DisplayMode, GlobalStyling } from '~/types/global-styling'
import { createLayerStore, type TLayerStore } from '~/stores/modules/layer'
import type { ILayerStoreGroup } from '~/modules/TemplateEditor/components/Preview/components/Inspector/Personalized'
import { Personalized } from '~/modules/TemplateEditor/components/Preview/components/Inspector/Personalized'
import dummyElements from '~/components/GlobalStyling/dummy-elements.json'
import { applyGlobalStylingToContainer } from '~/components/GlobalStyling/utils/applyGlobalStyling'
import GlobalStylingMode from './modes'
import useDevices from '~/utils/hooks/useDevice'
import { MobileIcon, DesktopIcon } from '@shopify/polaris-icons'

export interface DisplayModeSelectorProps {
  /** Current display mode */
  displayMode: DisplayMode
  /** Callback when display mode changes */
  onDisplayModeChange: (mode: DisplayMode) => void
  /** Full styling config used to render the live preview */
  styling: GlobalStyling
}

/**
 * Component for selecting display mode (Inline, Modal Desktop, Modal Mobile)
 */
function DisplayModeSelectorImpl({ displayMode, onDisplayModeChange, styling }: DisplayModeSelectorProps) {
  const { t } = useTranslation()
  const [webComponentsReady, setWebComponentsReady] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const mounted = useRef(false)

  // Ensure TailorKit web components are registered for OptionSet previews
  useEffect(() => {
    mounted.current = true
    import('extensions/tailorkit-src/src/shared/components/registerOptionSetElements')
      .then(() => {
        if (mounted.current) setWebComponentsReady(true)
      })
      .catch(() => setWebComponentsReady(true))

    return () => {
      mounted.current = false
    }
  }, [])

  // Build layer store groups from dummy JSON data
  const layerStoreGroups: ILayerStoreGroup[] = useMemo(() => {
    try {
      // dummyElements format: Array<Array<LayerDocument>>
      const groups = (dummyElements as unknown as any[][]) || []
      return groups.map((group, index) => {
        const layerStores: TLayerStore[] = group.map(layer => createLayerStore(layer))
        return {
          groupId: `dummy-group-${index}`,
          groupName: t('personalization-area'),
          layerStores,
          allLayerStores: layerStores,
        }
      })
    } catch (e) {
      return []
    }
  }, [t])

  // Apply styles whenever styling changes or components become ready
  useEffect(() => {
    applyGlobalStylingToContainer(styling, previewRef.current || (undefined as any))
  }, [styling, webComponentsReady])

  const { isMobileView } = useDevices()

  const previewContent = useMemo(
    () => (
      <Card>
        <Scrollable style={{ maxHeight: 'calc(100vh - 150px)' }}>
          <BlockStack gap="400">
            <MultipleButtonToggle
              multiple={false}
              selected={[displayMode]}
              options={[
                {
                  value: 'inline',
                  label: (
                    <Text as="p" variant="bodyLg" fontWeight="bold">
                      {t('inline-box')}
                    </Text>
                  ),
                },
                {
                  value: 'modal_desktop',
                  label: (
                    <InlineStack align="center" blockAlign="center" gap="200">
                      <Text as="p" variant="bodyLg" fontWeight="bold">
                        {t('modal')}
                      </Text>
                      <Box>
                        <Icon source={DesktopIcon} />
                      </Box>
                    </InlineStack>
                  ),
                },
                {
                  value: 'modal_mobile',
                  label: (
                    <InlineStack align="center" blockAlign="center" gap="200">
                      <Text as="p" variant="bodyLg" fontWeight="bold">
                        {t('modal')}
                      </Text>
                      <Box>
                        <Icon source={MobileIcon} />
                      </Box>
                    </InlineStack>
                  ),
                },
              ]}
              onClick={selected => {
                const mode = selected[0] as DisplayMode
                if (!mode || mode === displayMode) return

                onDisplayModeChange(mode)
              }}
            />

            <InlineStack align="center">
              <Box width="100%">
                <InlineStack align="center">
                  <div
                    ref={previewRef}
                    style={{ width: '100%', backgroundColor: '#f5f5f5', padding: '16px', borderRadius: '8px' }}
                  >
                    {webComponentsReady && (
                      <GlobalStylingMode
                        mode={displayMode}
                        title={styling.heading.text}
                        content={
                          <Personalized
                            layerStoreGroups={layerStoreGroups}
                            showInfoBanner={false}
                            titleText={styling.heading.text}
                            hiddenTitle={displayMode !== 'inline'}
                            {...(displayMode !== 'inline' && isMobileView && { wrapperStyle: { maxHeight: 'none' } })}
                          />
                        }
                      />
                    )}
                  </div>
                </InlineStack>
              </Box>
            </InlineStack>
          </BlockStack>
        </Scrollable>
      </Card>
    ),
    [displayMode, isMobileView, layerStoreGroups, onDisplayModeChange, styling.heading.text, t, webComponentsReady]
  )

  return previewContent
}

export const DisplayModeSelector = memo(DisplayModeSelectorImpl)
