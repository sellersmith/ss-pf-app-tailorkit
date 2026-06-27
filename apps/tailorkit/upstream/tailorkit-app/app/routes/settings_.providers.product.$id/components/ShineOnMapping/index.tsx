import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, BlockStack, Text, Divider } from '@shopify/polaris'
import type { ShineOnMapping, ShineOnMappingProps, ShineOnEngravingLineMapping } from './types'
import { EngravingLineMapper } from './EngravingLineMapper'
import { FontMapper } from './FontMapper'
import { SizeMapper } from './SizeMapper'
import { PreviewPanel } from './PreviewPanel'

export function ShineOnMappingComponent({
  mapping,
  engravingConfig,
  textLayers,
  printAreaOptions,
  onChange,
}: ShineOnMappingProps) {
  const { t } = useTranslation()

  const currentMapping = useMemo<ShineOnMapping>(() => {
    if (mapping) {
      return mapping
    }

    // Initialize default mapping from config
    const engravingLines: ShineOnEngravingLineMapping[] = Array.from({ length: engravingConfig.lineCount }, (_, i) => ({
      lineNumber: i + 1,
      layerId: null,
      maxChars: engravingConfig.defaultMaxChars,
    }))

    return {
      engravingLines,
      fontMapping: {
        layerId: null,
        defaultFont: engravingConfig.defaultFonts[0] || '',
        allowedFonts: engravingConfig.defaultFonts,
      },
      sizeMapping: {
        layerId: null,
        optionSetId: null,
      },
      printUrl: {
        source: 'canvas-render',
        printAreaId: printAreaOptions[0]?.id || null,
      },
    }
  }, [mapping, engravingConfig, printAreaOptions])

  const handleEngravingLineChange = useCallback(
    (lineNumber: number, layerId: string | null, maxChars: number) => {
      const updatedLines = currentMapping.engravingLines.map(line =>
        line.lineNumber === lineNumber ? { ...line, layerId, maxChars } : line
      )

      onChange({
        ...currentMapping,
        engravingLines: updatedLines,
      })
    },
    [currentMapping, onChange]
  )

  const handleFontMappingChange = useCallback(
    (fontMapping: ShineOnMapping['fontMapping']) => {
      onChange({
        ...currentMapping,
        fontMapping,
      })
    },
    [currentMapping, onChange]
  )

  const handleSizeMappingChange = useCallback(
    (sizeMapping: ShineOnMapping['sizeMapping']) => {
      onChange({
        ...currentMapping,
        sizeMapping,
      })
    },
    [currentMapping, onChange]
  )

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="400">
          <div>
            <Text as="h2" variant="headingMd" fontWeight="semibold">
              {t('shineon-personalization-mapping')}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {t('map-tailorkit-text-layers-to-shineon-engraving-lines-for-personalized-products')}
            </Text>
          </div>

          <Divider />

          <div>
            <Text as="h3" variant="headingSm" fontWeight="semibold">
              {t('engraving-lines')}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {t('assign-text-layers-to-each-engraving-line-and-set-character-limits')}
            </Text>
          </div>

          <BlockStack gap="300">
            {currentMapping.engravingLines.map(line => (
              <EngravingLineMapper
                key={line.lineNumber}
                lineNumber={line.lineNumber}
                layerId={line.layerId}
                maxChars={line.maxChars}
                textLayers={textLayers}
                onChange={(layerId, maxChars) => handleEngravingLineChange(line.lineNumber, layerId, maxChars)}
              />
            ))}
          </BlockStack>

          <Divider />

          <FontMapper
            fontMapping={currentMapping.fontMapping}
            textLayers={textLayers}
            defaultFonts={engravingConfig.defaultFonts}
            onChange={handleFontMappingChange}
          />

          {engravingConfig.hasSizeOption && (
            <>
              <Divider />
              <SizeMapper
                sizeMapping={currentMapping.sizeMapping}
                textLayers={textLayers}
                onChange={handleSizeMappingChange}
              />
            </>
          )}
        </BlockStack>
      </Card>

      <PreviewPanel mapping={currentMapping} />
    </BlockStack>
  )
}

export type { ShineOnMappingProps, TextLayerOption } from './types'
