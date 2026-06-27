/* eslint-disable max-len */
import type { TFunction } from 'i18next'
import type { VectorConversionParameters, ShapeSelection, VectorResult } from '../../types'
import styles from '../../styles.module.css'
import ParameterControls from '../ParameterControls'
import { GridCarousel } from '~/components/GridCarousel'
import { Trans } from 'react-i18next'
import { BlockStack, InlineGrid, InlineStack, Spinner, Text, Banner, Button, Card } from '@shopify/polaris'
import useDevices from '~/utils/hooks/useDevice'
import { UploadIcon, EditIcon } from '@shopify/polaris-icons'
import { useState } from 'react'

interface ResultViewProps {
  // Image data
  vectorResults?: VectorResult[] // New: array of SVG results

  // Processing parameters
  processingParameters: VectorConversionParameters
  shapeSelections: ShapeSelection[]
  showAdvancedSettings: boolean

  // State
  isReprocessing: boolean

  // Actions
  updateParameter: (key: keyof VectorConversionParameters, value: any) => void
  onQualityPresetChange?: (preset: 'low' | 'medium' | 'high') => void
  onApply?: (results: VectorResult[]) => void
  onUpdateVectorResult?: (shapeId: string, editedSvgDataUri: string) => void
  onEditResult?: (result: VectorResult) => void // Callback to trigger editing in parent

  // Translation
  t: TFunction
}

export default function ResultView({
  vectorResults = [],
  processingParameters,
  shapeSelections,
  showAdvancedSettings,
  isReprocessing,
  updateParameter,
  onQualityPresetChange,
  onApply,
  onUpdateVectorResult,
  onEditResult,
  t,
}: ResultViewProps) {
  const { isMobileView } = useDevices()
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  // Validate data URI format
  const isValidDataUri = (dataUri: string | undefined): boolean => {
    if (!dataUri) return false
    return dataUri.startsWith('data:image/') && dataUri.includes('base64,')
  }

  // Validate SVG result has valid image source
  const hasValidImageSource = (result: VectorResult): boolean => {
    const hasValidDataUri = isValidDataUri(result.svgDataUri)
    const hasValidUrl = result.svgUrl && result.svgUrl.startsWith('http')
    return hasValidDataUri || !!hasValidUrl
  }

  // Generate stable key for React rendering
  const getStableKey = (result: VectorResult, index: number): string => {
    // Prefer shapeId if available, otherwise use a stable fallback
    return result.shapeId || `vector-result-${index}`
  }

  // Handle image load error
  const handleImageError = (shapeId: string, result: VectorResult) => {
    console.error('Failed to load SVG image:', {
      shapeId,
      svgDataUri: `${result.svgDataUri?.substring(0, 100)}...`,
      svgUrl: result.svgUrl,
    })
    setFailedImages(prev => new Set(prev).add(shapeId))
  }

  // Download individual SVG
  const downloadSvg = (svgDataUri: string, filename: string) => {
    const link = document.createElement('a')
    link.href = svgDataUri
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Mobile layout
  if (isMobileView) {
    return (
      <div className={styles.mobileResultContainer}>
        {/* Sticky Preview at top */}
        <div className={styles.mobileResultPreview}>
          {vectorResults.length === 0 ? (
            <div className={styles.imageLoading}>
              <Spinner size="large" />
              <Text variant="bodyMd" as="p">
                {t('processing-vectors')}
              </Text>
            </div>
          ) : (
            <GridCarousel itemsPerSlide={1} showDots={true}>
              {vectorResults.map((result, index) => (
                <div
                  key={getStableKey(result, index)}
                  style={{
                    gap: '0.5rem',
                    display: 'flex',
                    padding: '1rem',
                    textAlign: 'center',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  {result.error ? (
                    <Banner tone="critical">
                      <Text variant="bodyMd" as="p">
                        {t('error')}: {result.error}
                      </Text>
                    </Banner>
                  ) : !hasValidImageSource(result) ? (
                    <Banner tone="critical">
                      <Text variant="bodyMd" as="p">
                        {t('invalid-svg-data-uri')}
                      </Text>
                    </Banner>
                  ) : failedImages.has(getStableKey(result, index)) ? (
                    <Banner tone="warning">
                      <Text variant="bodyMd" as="p">
                        {t('failed-to-load-svg-image')}
                      </Text>
                    </Banner>
                  ) : (
                    <>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          src={result.svgDataUri || result.svgUrl}
                          alt={`Vector ${index + 1}`}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '300px',
                            objectFit: 'contain',
                          }}
                          onError={() => handleImageError(getStableKey(result, index), result)}
                        />
                      </div>
                      <InlineStack gap="200" align="center" blockAlign="center">
                        {result.svgDataUri && onEditResult && (
                          <Button size="slim" icon={EditIcon} onClick={() => onEditResult(result)}>
                            Edit
                          </Button>
                        )}
                        <Button
                          size="slim"
                          icon={UploadIcon}
                          onClick={() => downloadSvg(result.svgDataUri || result.svgUrl!, `vector-${index + 1}.svg`)}
                        >
                          Download
                        </Button>
                      </InlineStack>
                    </>
                  )}
                </div>
              ))}
            </GridCarousel>
          )}
          {isReprocessing && (
            <div className={styles.reprocessImage}>
              <Spinner size="large" />
            </div>
          )}
        </div>

        {/* Scrollable controls */}
        <div className={styles.mobileResultControls}>
          <BlockStack gap="400">
            <Banner tone="success">
              <Text variant="bodyMd" as="p">
                {t('vectors-generated-review-and-adjust')}
              </Text>
            </Banner>

            <ParameterControls
              processingParameters={processingParameters}
              shapeSelections={shapeSelections}
              showAdvancedSettings={showAdvancedSettings}
              updateParameter={updateParameter}
              onQualityPresetChange={onQualityPresetChange}
              t={t}
            />
          </BlockStack>
        </div>
      </div>
    )
  }

  // Desktop layout
  return (
    <BlockStack gap="400">
      <Banner tone="success">
        <Trans t={t} components={{ b: <strong /> }}>
          {t('vectors-generated-review-and-adjust')}
        </Trans>
      </Banner>

      <InlineGrid columns={{ xs: 1, sm: '1fr 1fr' }} gap="400">
        {/* SVG Results Section */}
        <div className={styles.stickyImageColumn}>
          {vectorResults.length === 0 ? (
            <div className={styles.imageLoading}>
              <Spinner size="large" />
              <Text variant="bodyMd" as="p">
                {t('processing-vectors')}
              </Text>
            </div>
          ) : (
            <GridCarousel itemsPerSlide={1} showDots={true} gap="1rem">
              {vectorResults.map((result, index) => (
                <Card key={getStableKey(result, index)}>
                  <div
                    style={{
                      gap: '0.25rem',
                      display: 'flex',
                      textAlign: 'center',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: vectorResults.length > 1 ? 'calc(100vh - 316px)' : 'calc(100vh - 290px)',
                    }}
                  >
                    {result.error ? (
                      <Banner tone="critical">
                        <Text variant="bodyMd" as="p">
                          {result.error}
                        </Text>
                      </Banner>
                    ) : !hasValidImageSource(result) ? (
                      <Banner tone="critical">
                        <Text variant="bodyMd" as="p">
                          {t('invalid-svg-data-uri')}
                        </Text>
                      </Banner>
                    ) : failedImages.has(getStableKey(result, index)) ? (
                      <Banner tone="warning">
                        <Text variant="bodyMd" as="p">
                          {t('failed-to-load-svg-image')}
                        </Text>
                      </Banner>
                    ) : (
                      <>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img
                            src={result.svgDataUri || result.svgUrl}
                            alt={`Vector ${index + 1}`}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '200px',
                              objectFit: 'contain',
                            }}
                            onError={() => handleImageError(getStableKey(result, index), result)}
                          />
                        </div>
                        <InlineStack gap="200" align="center" blockAlign="center">
                          {result.svgDataUri && onEditResult && (
                            <Button size="slim" icon={EditIcon} onClick={() => onEditResult(result)}>
                              Edit
                            </Button>
                          )}
                          <Button
                            size="slim"
                            icon={UploadIcon}
                            onClick={() => downloadSvg(result.svgDataUri || result.svgUrl!, `vector-${index + 1}.svg`)}
                          >
                            Download
                          </Button>
                        </InlineStack>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </GridCarousel>
          )}

          {isReprocessing && (
            <div className={styles.reprocessImage}>
              <Spinner size="large" />
            </div>
          )}
        </div>

        {/* Settings Section */}
        <div className={styles.scrollableSettingsColumn}>
          <BlockStack gap="400">
            <ParameterControls
              processingParameters={processingParameters}
              shapeSelections={shapeSelections}
              showAdvancedSettings={showAdvancedSettings}
              updateParameter={updateParameter}
              onQualityPresetChange={onQualityPresetChange}
              t={t}
            />
          </BlockStack>
        </div>
      </InlineGrid>
    </BlockStack>
  )
}
