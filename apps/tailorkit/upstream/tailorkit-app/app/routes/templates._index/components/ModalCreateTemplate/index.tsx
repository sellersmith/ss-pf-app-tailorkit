import { useNavigate } from '@remix-run/react'
import { BlockStack, Box, Checkbox, Divider, InlineStack, Modal } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { COMMON_HEIGHT_VALUE, COMMON_WIDTH_VALUE } from '~/constants/text-field'
import { DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import type { Dimension, TemplateDimension } from '~/types/template'
import { lengthUnitToLengthUnit /*, resizeDimensionFromResolutionToResolution*/ } from '~/utils/lengthUnitToPixels'
import { HeightTextField } from './HeightTextField'
import { MeasurementUnits } from './MeasurementUnit'
import { ResolutionField } from './ResolutionField'
import { TemplateTitle } from './TemplateTitle'
import { WidthTextField } from './WidthTextField'
import isInteger from 'lodash/isInteger'
import isEqual from 'lodash/isEqual'
import { BLANK_TEMPLATE, type TEMPLATE_TYPES } from '~/constants/template'
import { ImportedProductsSelector } from './ImportedProductsSelector'
import { DimensionFromImportedProductSelector } from './DimensionFromImportedProductSelector'
import type { IVariant } from '~/types/shopify-product'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { MAX_TEMPLATE_NAME_SIZE } from '~/constants/canvas'
import { createTemplateFromFormData } from '../../fns'

interface IModalCreateTemplate {
  active: boolean
  toggleModalCreateTemplate: (type: TEMPLATE_TYPES) => void
  t: any
}

export default function ModalCreateTemplate(props: IModalCreateTemplate) {
  const { active, toggleModalCreateTemplate, t } = props
  const navigate = useNavigate()

  const handleChange = useCallback(() => toggleModalCreateTemplate(BLANK_TEMPLATE), [toggleModalCreateTemplate])
  const [templateTitle, setTemplateTitle] = useState('Untitled')
  const [selectedVariants, setSelectedVariants] = useState<IVariant[]>([])
  const [selectPrintAreasFromProviders, setSelectPrintAreasFromProviders] = useState(false)
  const [dimensionSelected, setDimensionSelected] = useState<{ position: string; dimension: Dimension } | null>(null)

  const [{ width, height, measurementUnit, resolution }, setTemplateDimension] = useState<TemplateDimension>({
    width: COMMON_WIDTH_VALUE,
    height: COMMON_HEIGHT_VALUE,
    measurementUnit: DEFAULT_TEMPLATE_DIMENSION.measurementUnit,
    resolution: DEFAULT_TEMPLATE_DIMENSION.resolution,
  })

  const trimmedTemplateTitle = templateTitle.trim()
  const isValid
    = trimmedTemplateTitle && width > 0 && height > 0 && measurementUnit === 'px'
      ? isInteger(height) && isInteger(width)
      : true

  const onChangeDimension = useCallback(
    (type: keyof TemplateDimension, val: any) => {
      switch (type) {
        case 'width': {
          setTemplateDimension(pre => ({
            ...pre,
            width: val,
          }))
          break
        }

        case 'height': {
          setTemplateDimension(pre => ({
            ...pre,
            height: val,
          }))
          break
        }

        case 'measurementUnit': {
          // Re-evaluate the width & height
          const _width = lengthUnitToLengthUnit(measurementUnit, val, width, resolution)
          const _height = lengthUnitToLengthUnit(measurementUnit, val, height, resolution)

          setTemplateDimension(pre => ({
            ...pre,
            measurementUnit: val,
            width: _width,
            height: _height,
          }))
          break
        }

        case 'resolution': {
          /* Re-evaluate the width & height
          const _width = resizeDimensionFromResolutionToResolution(resolution, val, width, measurementUnit)
          const _height = resizeDimensionFromResolutionToResolution(resolution, val, height, measurementUnit)*/

          setTemplateDimension(pre => ({
            ...pre,
            resolution: val,
            /*width: _width,
            height: _height,*/
          }))
          break
        }
      }
    },
    [height, measurementUnit, resolution, width]
  )

  const handleSelectPrintAreasFromProviders = useCallback((newCheck: boolean) => {
    setSelectPrintAreasFromProviders(newCheck)
    setSelectedVariants([])
    setDimensionSelected(null)
  }, [])

  const setWidth = useCallback(
    (val: number, resetDimension = true) => {
      onChangeDimension('width', val)

      if (selectPrintAreasFromProviders && resetDimension) {
        handleSelectPrintAreasFromProviders(false)
      }
    },
    [handleSelectPrintAreasFromProviders, onChangeDimension, selectPrintAreasFromProviders]
  )

  const setHeight = useCallback(
    (val: number, resetDimension = true) => {
      onChangeDimension('height', val)

      if (selectPrintAreasFromProviders && resetDimension) {
        handleSelectPrintAreasFromProviders(false)
      }
    },
    [handleSelectPrintAreasFromProviders, onChangeDimension, selectPrintAreasFromProviders]
  )

  const setMeasurementUnit = useCallback(
    (val: string) => {
      onChangeDimension('measurementUnit', val)
    },
    [onChangeDimension]
  )

  const setResolution = useCallback(
    (val: number) => {
      onChangeDimension('resolution', val)
    },
    [onChangeDimension]
  )

  const setSelectedVariantsDone = useCallback(
    (variants: IVariant[]) => {
      const isChanged = !isEqual(selectedVariants, variants)

      if (isChanged) {
        setDimensionSelected(null)
        setSelectedVariants(variants)
      }
    },
    [selectedVariants]
  )

  const setSelectedDimensionDone = useCallback(
    (args: { position: string; dimension: Dimension }) => {
      const {
        position,
        dimension: { width, height },
      } = args
      const selectedVariant = selectedVariants[0] || {}
      const { title: variantTitle = 'Untitled', product = { title: 'Untitled' } } = selectedVariant
      const productTitle = product.title
      const dimensionLabel = `${position}: ${width} x ${height} px`
      const templateName = `${productTitle} - ${variantTitle} - ${dimensionLabel}`

      setTemplateTitle(templateName.substring(0, MAX_TEMPLATE_NAME_SIZE))
      setMeasurementUnit('px')
      setWidth(width, false)
      setHeight(height, false)
      setDimensionSelected(args)
    },
    [selectedVariants, setHeight, setMeasurementUnit, setWidth]
  )

  const onCreateTemplateFromPSDFile = useCallback(async () => {
    const formData = {
      title: templateTitle,
      width,
      height,
      measurementUnit,
      resolution,
    }

    const templatePath = await createTemplateFromFormData(formData)
    navigate(templatePath)

    handleChange()
  }, [templateTitle, width, height, measurementUnit, resolution, navigate, handleChange])

  usePreventPageScroll(active)

  return (
    <Modal
      open={active}
      onClose={handleChange}
      title={t('create-new-template')}
      primaryAction={{
        content: t('create'),
        disabled: !isValid,
        onAction: onCreateTemplateFromPSDFile,
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: handleChange,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          <TemplateTitle value={templateTitle} setValue={setTemplateTitle} t={t} />

          <InlineStack align="space-between" gap={'200'}>
            <WidthTextField measurementUnit={measurementUnit} value={width} setValue={setWidth} t={t} />
            <HeightTextField measurementUnit={measurementUnit} value={height} setValue={setHeight} t={t} />
          </InlineStack>

          <InlineStack align="space-between" gap={'200'}>
            <MeasurementUnits value={measurementUnit} setValue={setMeasurementUnit} t={t} />
            <ResolutionField value={resolution} setValue={setResolution} t={t} />
          </InlineStack>

          <Box paddingBlockStart={'300'}>
            <BlockStack gap={'200'}>
              <Divider borderColor="border" borderWidth="025" />
              <Checkbox
                label={t('select-print-areas-from-providers')}
                checked={selectPrintAreasFromProviders}
                onChange={(newCheck: boolean) => {
                  handleSelectPrintAreasFromProviders(newCheck)

                  if (!newCheck && dimensionSelected) {
                    setWidth(500)
                    setHeight(500)
                    setTemplateTitle('Untitled')
                  }
                }}
              />
              <InlineStack align="space-between" gap={'200'}>
                <div style={{ flex: 1 }}>
                  <ImportedProductsSelector
                    selectedVariants={selectedVariants}
                    setSelectedVariants={setSelectedVariantsDone}
                    disabled={!selectPrintAreasFromProviders}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <DimensionFromImportedProductSelector
                    variantId={selectedVariants[0]?.id}
                    dimensionSelected={dimensionSelected}
                    setDimensionSelected={setSelectedDimensionDone}
                    disabled={!selectPrintAreasFromProviders}
                  />
                </div>
              </InlineStack>
            </BlockStack>
          </Box>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
