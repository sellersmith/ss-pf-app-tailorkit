import type { ReactNode } from 'react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Flex, FlexCenter } from '~/components/common/Flex'
import { PreviewCanvasLayout, PreviewInspectorLayout, PreviewMainLayout } from '~/components/layouts/Canvas/Preview'
import BlockLoading from '~/components/loading/BlockLoading'
import { useStore } from '~/libs/external-store'
import { type TLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStore } from '~/stores/modules/template'
import { ELayerType } from '~/types/psd'
import useCanvasDimension from '~/utils/hooks/useCanvasDimension'
import useDevices from '~/utils/hooks/useDevice'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import { useInitTemplate } from '../../hooks/useInitTemplate'
import { CanvasContainer, LayerContainer } from '../Editor/CardCanvas'
import { InspectorCard } from './components/Inspector'
import { BlockStack, Box, InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

interface PreviewTemplateProps {
  canWheel?: boolean
  showSaveButton?: boolean
  scaleUpStageViewPort?: boolean
  showPlaceHolder?: boolean
  showInspector?: boolean
  customHeight?: string
  renderPersonalizeButton?: () => ReactNode
  skipViewportDispatch?: boolean
}

export const PreviewTemplate = (props?: PreviewTemplateProps) => {
  const { t } = useTranslation()

  const {
    canWheel = true,
    showSaveButton = true,
    scaleUpStageViewPort = false,
    showPlaceHolder = true,
    showInspector = false,
    customHeight = '100%',
    renderPersonalizeButton,
    skipViewportDispatch = false,
  } = props || {}

  const [isInitializingWebComponent, setIsInitializingWebComponent] = useState(true)
  const dimension = useStore(TemplateEditorStore, state => state.dimension)!
  const extractedLayerStores: TLayerStore[] = useStore(TemplateEditorStore, state => state.extractedLayerStores)

  const reversedExtractedLayerStores = useMemo(
    () => [...extractedLayerStores].reverse().filter(layerStore => layerStore.getState().type !== ELayerType.GROUP),
    [extractedLayerStores]
  )

  const { widthByPixels, heightByPixels } = useCanvasDimension()

  const { evaluateTemplateViewPort } = useInitTemplate()
  const { isSmallDesktopView } = useDevices()

  // Tablet-optimized canvas container options
  const canvasOptions = useMemo(
    () => ({
      canWheel,
      previewMode: true,
      showPlaceHolder,
      scaleUpStageViewPort: isSmallDesktopView ? true : scaleUpStageViewPort, // Scale up on tablets for better visibility
    }),
    [canWheel, showPlaceHolder, isSmallDesktopView, scaleUpStageViewPort]
  )

  const scaleFactor = isSmallDesktopView ? 0.8 : 1 // Increased scale factor for bigger canvas on tablets

  // Tablet-optimized canvas dimensions - make canvas actually bigger on tablets
  const canvasDimensions = useMemo(() => {
    if (isSmallDesktopView) {
      // On tablets, increase canvas size significantly for better visibility
      return {
        width: Math.floor(widthByPixels * scaleFactor),
        height: Math.floor(heightByPixels * scaleFactor),
      }
    }

    return {
      width: widthByPixels,
      height: heightByPixels,
    }
  }, [widthByPixels, heightByPixels, isSmallDesktopView, scaleFactor])

  useLayoutEffect(() => {
    if (skipViewportDispatch) return

    // Convert the dimension to pixel unit
    const dimensionInPixelUnit = {
      width: lengthUnitToPixels(dimension.width, dimension.measurementUnit, dimension.resolution),
      height: lengthUnitToPixels(dimension.height, dimension.measurementUnit, dimension.resolution),
    }

    // For tablets, use larger dimensions for viewport calculation
    const viewportDimension = isSmallDesktopView
      ? {
          width: dimensionInPixelUnit.width * scaleFactor,
          height: dimensionInPixelUnit.height * scaleFactor,
        }
      : dimensionInPixelUnit

    const viewport = evaluateTemplateViewPort(viewportDimension, scaleUpStageViewPort || isSmallDesktopView)

    TemplateEditorStore.dispatch({
      type: 'SET_VIEW_PORT',
      payload: {
        viewport,
      },
      skipTrace: true,
    })
  }, [dimension, evaluateTemplateViewPort, scaleUpStageViewPort, isSmallDesktopView, scaleFactor, skipViewportDispatch])

  useEffect(() => {
    import('extensions/tailorkit-src/src/shared/components/registerOptionSetElements').then(() => {
      setIsInitializingWebComponent(false)
    })
  }, [])

  // Enhanced custom height for tablet view to give more space
  const enhancedCustomHeight = useMemo(() => {
    if (isSmallDesktopView) {
      return customHeight || '80%'
    }
    return customHeight
  }, [customHeight, isSmallDesktopView])

  // Use grid layout if showInspector is true
  // Grid.Cell for each child

  // Improved columnSpan logic that considers tablet view
  const Wrapper = showInspector ? PreviewMainLayout : Fragment
  const WrapperItem = Fragment

  if (isInitializingWebComponent) {
    return (
      <PreviewCanvasLayout showSaveButton={false} height={'35vh'}>
        <Flex justify="center" align="center" height="100%">
          <BlockLoading />
        </Flex>
      </PreviewCanvasLayout>
    )
  }

  return (
    <Wrapper {...(showInspector ? { customHeight: enhancedCustomHeight } : {})}>
      <WrapperItem>
        <FlexCenter style={{ height: '100%', minHeight: '200px', minWidth: 0, flexDirection: 'column' }}>
          <PreviewCanvasLayout showSaveButton={showSaveButton}>
            <CanvasContainer
              canvasWidth={canvasDimensions.width}
              canvasHeight={canvasDimensions.height}
              options={canvasOptions}
            >
              {reversedExtractedLayerStores.map((extractedLayerStore, _index) => (
                <LayerContainer extractedLayerStore={extractedLayerStore} key={extractedLayerStore.getState()._id} />
              ))}
            </CanvasContainer>
          </PreviewCanvasLayout>
          {renderPersonalizeButton ? (
            <Box paddingBlockEnd="400">
              <BlockStack gap="200">
                <InlineStack align="center">{renderPersonalizeButton?.()}</InlineStack>
                <Text as="p" variant="bodyLg" alignment="center">
                  {t('get-it-done-in-3-quick-steps-just-minutes')}
                </Text>
              </BlockStack>
            </Box>
          ) : null}
        </FlexCenter>
      </WrapperItem>
      {showInspector && (
        <WrapperItem>
          <div style={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
            <PreviewInspector showInfoBanner={false} customHeight={'100%'} />
          </div>
        </WrapperItem>
      )}
    </Wrapper>
  )
}

export const PreviewInspector = (props: { showInfoBanner?: boolean; customHeight?: string }) => {
  const { showInfoBanner = true, customHeight } = props || {}
  const extractedLayerStores: TLayerStore[] = useStore(TemplateEditorStore, state => state.extractedLayerStores)
  const layerStoreGroups = useMemo(
    () => [{ layerStores: extractedLayerStores, allLayerStores: extractedLayerStores }],
    [extractedLayerStores]
  )

  return (
    <PreviewInspectorLayout>
      <InspectorCard layerStoreGroups={layerStoreGroups} showInfoBanner={showInfoBanner} customHeight={customHeight} />
    </PreviewInspectorLayout>
  )
}
