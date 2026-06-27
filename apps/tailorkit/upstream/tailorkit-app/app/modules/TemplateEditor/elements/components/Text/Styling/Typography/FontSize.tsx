import { Button, Icon, InlineStack, Tooltip } from '@shopify/polaris'
import { ArrowsOutHorizontalFilledIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { stretchBoxToFit } from '~/components/canvas/elements/Text/utils/stretchBoxToFit'
import { FlexCenter } from '~/components/common/Flex'
import { NumericStepperField } from '~/components/common/NumericStepperField'
import { DEFAULT_FONT_SIZE, MAXIMUM_FONT_SIZE, MINIMUM_FONT_SIZE } from '~/constants/text-field'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import type { TextSettings } from '~/types/psd'
import { fontLoader } from '../../instances'

export const FontSize = () => {
  const { t } = useTranslation()
  const layerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore) as TLayerStore | undefined
  const storeSettings = useStore(layerStore as TLayerStore, state => state?.settings || {})
  const textShape: TextSettings['textShape'] = (storeSettings?.textShape as any) || 'none'
  const fontSizeFromStore: number = useMemo(
    () => (storeSettings?.fontSize as number) ?? DEFAULT_FONT_SIZE,
    [storeSettings?.fontSize]
  )

  const left = useStore(layerStore as TLayerStore, state => state?.left || 0)
  const top = useStore(layerStore as TLayerStore, state => state?.top || 0)
  const width = useStore(layerStore as TLayerStore, state => state?.width || 0)
  const height = useStore(layerStore as TLayerStore, state => state?.height || 0)
  const rotate = useStore(layerStore as TLayerStore, state => state?.rotate || 0)

  // Handler for font size changes
  const handleFontSizeChange = useCallback(
    (value: number) => {
      if (!layerStore) return

      const newestStoreSettings = layerStore.getState().settings
      const isDifferentSize = newestStoreSettings?.fontSize !== value

      if (isDifferentSize) {
        layerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: { state: { settings: { ...newestStoreSettings, fontSize: value } } },
        })
      }
    },
    [layerStore]
  )

  // Implement onStretchBoxToFit locally
  const handleStretchBoxToFit = useCallback(async () => {
    if (!layerStore) return

    const layer = layerStore.getState()
    const settings = layer.settings || {}
    const { fontFamily, fontSize, content, textAlign, verticalAlign } = settings
    const position = { x: layer.left || 0, y: layer.top || 0 }
    const currentDimension = { width: layer.width || 0, height: layer.height || 0 }
    const rotate = layer.rotate || 0

    try {
      if (fontFamily?.family) {
        await fontLoader.loadFont(fontFamily.family, fontFamily?.src)
      }
    } catch (error) {
      console.error('Error loading font:', error)
    }

    const { width, height, x, y } = stretchBoxToFit({
      text: content || '',
      fontSize: fontSize || DEFAULT_FONT_SIZE,
      fontFamily: fontFamily?.family || 'Arial',
      fontStyle: fontFamily?.style || '',
      textAlign,
      verticalAlign,
      position,
      currentDimension,
      angle: rotate,
    })

    const next: any = { width, height }
    if (x !== undefined && y !== undefined) {
      next.left = x
      next.top = y
      next.rotate = rotate
    }

    layerStore.dispatch({ type: 'UPDATE_LAYER', payload: { state: next } })
  }, [layerStore])

  const isAlreadyFitted = useMemo(() => {
    try {
      const settings = storeSettings || {}
      const { fontFamily, fontSize, content, textAlign, verticalAlign } = settings
      const position = { x: left, y: top }
      const currentDimension = { width, height }

      const {
        width: fittedWidth,
        height: fittedHeight,
        x: fittedX,
        y: fittedY,
      } = stretchBoxToFit({
        text: content || '',
        fontSize: fontSize || DEFAULT_FONT_SIZE,
        fontFamily: fontFamily?.family || 'Arial',
        fontStyle: fontFamily?.style || '',
        textAlign,
        verticalAlign,
        position,
        currentDimension,
        angle: rotate,
      })

      const approxEqual = (a: number | undefined, b: number | undefined) => Math.abs((a ?? 0) - (b ?? 0)) <= 0.5
      const wMatches = approxEqual(fittedWidth, currentDimension.width)
      const hMatches = approxEqual(fittedHeight, currentDimension.height)
      const xMatches = fittedX === undefined || approxEqual(fittedX, position.x)
      const yMatches = fittedY === undefined || approxEqual(fittedY, position.y)
      return wMatches && hMatches && xMatches && yMatches
    } catch {
      return false
    }
  }, [storeSettings, left, top, width, height, rotate])

  const isStretchDisabled = textShape === 'circle' || isAlreadyFitted

  return (
    <InlineStack gap={'200'} wrap={false} blockAlign="center" align="space-between">
      <Tooltip content={t('font-size')}>
        <NumericStepperField
          label={t('font-size')}
          labelHidden
          value={fontSizeFromStore}
          onChange={handleFontSizeChange}
          min={MINIMUM_FONT_SIZE}
          max={MAXIMUM_FONT_SIZE}
          step={1}
        />
      </Tooltip>

      <Tooltip
        preferredPosition="below"
        content={
          textShape === 'circle'
            ? t('auto-fit-disabled-for-circle-text', 'Auto-fit is disabled for circle text')
            : isAlreadyFitted
              ? t('already-fitted', 'Already fitted')
              : t('stretch-box-to-fit')
        }
      >
        <div
          role="button"
          style={{
            cursor: isStretchDisabled ? 'not-allowed' : 'pointer',
            opacity: isStretchDisabled ? 0.5 : 1,
          }}
          onClick={isStretchDisabled ? undefined : handleStretchBoxToFit}
        >
          <FlexCenter>
            <Button
              icon={<Icon source={ArrowsOutHorizontalFilledIcon} />}
              fullWidth
              variant="tertiary"
              disabled={isStretchDisabled}
            />
          </FlexCenter>
        </div>
      </Tooltip>
    </InlineStack>
  )
}
