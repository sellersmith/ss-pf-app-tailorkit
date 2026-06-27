import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { BlockStack, TextField, Button, Text, Box, Card } from '@shopify/polaris'
import type { ShineOnMapping } from './types'

interface PreviewPanelProps {
  mapping: ShineOnMapping | null
}

function buildPreviewPayload(mapping: ShineOnMapping, sampleTexts: Record<number, string>): Record<string, string> {
  const payload: Record<string, string> = {}

  for (const line of mapping.engravingLines) {
    if (line.layerId && sampleTexts[line.lineNumber]) {
      const text = sampleTexts[line.lineNumber]
      const truncated = line.maxChars > 0 ? text.slice(0, line.maxChars) : text
      payload[`Engraving Line ${line.lineNumber}`] = truncated
    }
  }

  if (mapping.fontMapping?.defaultFont) {
    payload['Engraving Font'] = mapping.fontMapping.defaultFont
  }

  if (mapping.printUrl?.printAreaId) {
    payload['print_url'] = 'https://cdn.example.com/rendered-artwork.png'
  }

  return payload
}

export function PreviewPanel({ mapping }: PreviewPanelProps) {
  const { t } = useTranslation()
  const [sampleTexts, setSampleTexts] = useState<Record<number, string>>({})
  const [showPreview, setShowPreview] = useState(false)

  const handleTextChange = useCallback((lineNumber: number, value: string) => {
    setSampleTexts(prev => ({
      ...prev,
      [lineNumber]: value,
    }))
  }, [])

  const handlePreview = useCallback(() => {
    setShowPreview(true)
  }, [])

  if (!mapping) {
    return null
  }

  const mappedLines = mapping.engravingLines.filter(line => line.layerId !== null)
  const previewPayload = showPreview ? buildPreviewPayload(mapping, sampleTexts) : null

  return (
    <Card>
      <BlockStack gap="400">
        <div>
          <Text as="h3" variant="headingSm" fontWeight="semibold">
            {t('test-payload-preview')}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {t('enter-sample-text-to-preview-the-shineon-order-payload')}
          </Text>
        </div>

        {mappedLines.length > 0 ? (
          <BlockStack gap="300">
            {mappedLines.map(line => (
              <TextField
                key={line.lineNumber}
                label={`${t('sample-text-for-line')} ${line.lineNumber}`}
                value={sampleTexts[line.lineNumber] || ''}
                onChange={value => handleTextChange(line.lineNumber, value)}
                autoComplete="off"
                maxLength={line.maxChars > 0 ? line.maxChars : undefined}
                showCharacterCount={line.maxChars > 0}
              />
            ))}
          </BlockStack>
        ) : (
          <Text as="p" variant="bodySm" tone="subdued">
            {t('no-engraving-lines-mapped-yet')}
          </Text>
        )}

        <Button onClick={handlePreview} disabled={mappedLines.length === 0}>
          {t('preview-payload')}
        </Button>

        {showPreview && previewPayload && (
          <Box
            padding="400"
            background="bg-surface-secondary"
            borderRadius="200"
            borderColor="border"
            borderWidth="025"
          >
            <Text as="h4" variant="headingXs" fontWeight="semibold">
              {t('shineon-order-payload')}
            </Text>
            <Box paddingBlockStart="200">
              <pre
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0,
                }}
              >
                {JSON.stringify(previewPayload, null, 2)}
              </pre>
            </Box>
          </Box>
        )}
      </BlockStack>
    </Card>
  )
}
