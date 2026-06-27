import { BlockStack, Box, Button, ButtonGroup } from '@shopify/polaris'
import { EditIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { TextSettings } from '~/types/psd'
import { CircleInverted } from './CircleInverted'
import { CustomPathInverted } from './CustomPathInverted'
import { CurvePeaks } from './CurvePeaks'
import { CurveBend } from './CurveBend'
import { TextShapeSelect } from './TextShapeSelect'
import { NumericSliderField } from '../../Typography/NumericSliderField'

interface ITextShapeProps {
  textShape: TextSettings['textShape']
  circleInverted: boolean
  customPathInverted: boolean
  curvePeaks: number
  curveBend: number
  hasCustomPath?: boolean
  hasFillShape?: boolean
  /** Vertical offset for fill-shape text positioning (-50 to +50 percent) */
  fillShapeVerticalOffset?: number
  /** Vertical scale factor for fill-shape character height (0.5 to 2.0) */
  fillShapeVerticalScale?: number
  /** Horizontal offset for fill-shape text positioning (-50 to +50 percent) */
  fillShapeHorizontalOffset?: number
  /** Horizontal scale factor for fill-shape character width (0.5 to 2.0) */
  fillShapeHorizontalScale?: number
  /** Character spacing adjustment (-50 to +50) */
  fillShapeCharacterSpacing?: number
  onChangeTextShape: (value: TextSettings['textShape']) => void
  onChangeCircleInverted: (value: boolean) => void
  onChangeCustomPathInverted: (value: boolean) => void
  onChangeCurvePeaks: (value: number) => void
  onChangeCurveBend: (value: number) => void
  onOpenCustomPathEditor?: () => void
  onClearCustomPath?: () => void
  onOpenFillShapeEditor?: () => void
  onClearFillShape?: () => void
  onChangeFillShapeVerticalOffset?: (value: number) => void
  onChangeFillShapeVerticalScale?: (value: number) => void
  onChangeFillShapeHorizontalOffset?: (value: number) => void
  onChangeFillShapeHorizontalScale?: (value: number) => void
  onChangeFillShapeCharacterSpacing?: (value: number) => void
}

export const TextShape = (props: ITextShapeProps) => {
  const { t } = useTranslation()
  const {
    textShape,
    circleInverted,
    customPathInverted,
    curvePeaks,
    curveBend,
    hasCustomPath,
    hasFillShape,
    fillShapeVerticalOffset = 0,
    fillShapeVerticalScale = 1.0,
    fillShapeHorizontalOffset = 0,
    fillShapeHorizontalScale = 1.0,
    fillShapeCharacterSpacing = 0,
    onChangeTextShape,
    onChangeCircleInverted,
    onChangeCustomPathInverted,
    onChangeCurvePeaks,
    onChangeCurveBend,
    onOpenCustomPathEditor,
    onClearCustomPath,
    onOpenFillShapeEditor,
    onClearFillShape,
    onChangeFillShapeVerticalOffset,
    onChangeFillShapeVerticalScale,
    onChangeFillShapeHorizontalOffset,
    onChangeFillShapeHorizontalScale,
    onChangeFillShapeCharacterSpacing,
  } = props

  return (
    <BlockStack gap={'400'} align="center">
      <TextShapeSelect
        textShape={textShape}
        hasCustomPath={hasCustomPath}
        hasFillShape={hasFillShape}
        onChangeTextShape={onChangeTextShape}
        onOpenCustomPathEditor={onOpenCustomPathEditor}
        onOpenFillShapeEditor={onOpenFillShapeEditor}
      />

      {textShape === 'circle' && (
        <CircleInverted circleInverted={circleInverted} onChangeCircleInverted={onChangeCircleInverted} />
      )}

      {textShape === 'curve' && (
        <>
          <CurvePeaks curvePeaks={curvePeaks} onChangeCurvePeaks={onChangeCurvePeaks} />
          <CurveBend curveBend={curveBend} onChangeCurveBend={onChangeCurveBend} />
        </>
      )}

      {textShape === 'custom' && (
        <>
          {hasCustomPath && (
            <CustomPathInverted
              customPathInverted={customPathInverted}
              onChangeCustomPathInverted={onChangeCustomPathInverted}
            />
          )}
          <Box width="100%">
            <ButtonGroup fullWidth>
              <Button icon={EditIcon} onClick={onOpenCustomPathEditor}>
                {t('edit-path')}
              </Button>
              {hasCustomPath && (
                <Button tone="critical" onClick={onClearCustomPath}>
                  {t('clear')}
                </Button>
              )}
            </ButtonGroup>
          </Box>
        </>
      )}

      {textShape === 'fill-shape' && (
        <>
          {hasFillShape && onChangeFillShapeVerticalOffset && onChangeFillShapeVerticalScale && (
            <>
              <NumericSliderField
                label={t('vertical-offset')}
                value={fillShapeVerticalOffset}
                min={-50}
                max={50}
                step={1}
                suffix="%"
                onChange={onChangeFillShapeVerticalOffset}
              />
              <NumericSliderField
                label={t('vertical-scale')}
                value={Math.round(fillShapeVerticalScale * 100)}
                min={50}
                max={200}
                step={5}
                suffix="%"
                onChange={v => onChangeFillShapeVerticalScale(v / 100)}
              />
            </>
          )}
          {hasFillShape && onChangeFillShapeHorizontalOffset && onChangeFillShapeHorizontalScale && (
            <>
              <NumericSliderField
                label={t('horizontal-offset')}
                value={fillShapeHorizontalOffset}
                min={-50}
                max={50}
                step={1}
                suffix="%"
                onChange={onChangeFillShapeHorizontalOffset}
              />
              <NumericSliderField
                label={t('horizontal-scale')}
                value={Math.round(fillShapeHorizontalScale * 100)}
                min={50}
                max={200}
                step={5}
                suffix="%"
                onChange={v => onChangeFillShapeHorizontalScale(v / 100)}
              />
            </>
          )}
          {hasFillShape && onChangeFillShapeCharacterSpacing && (
            <NumericSliderField
              label={t('character-spacing')}
              value={fillShapeCharacterSpacing}
              min={-50}
              max={50}
              step={1}
              suffix="%"
              onChange={onChangeFillShapeCharacterSpacing}
            />
          )}

          <Box width="100%">
            <ButtonGroup fullWidth>
              <Button icon={EditIcon} onClick={onOpenFillShapeEditor}>
                {t('edit-shape')}
              </Button>
              {hasFillShape && (
                <Button tone="critical" onClick={onClearFillShape}>
                  {t('clear')}
                </Button>
              )}
            </ButtonGroup>
          </Box>
        </>
      )}
    </BlockStack>
  )
}
