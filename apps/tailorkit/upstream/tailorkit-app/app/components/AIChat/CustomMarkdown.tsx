import { BlockStack, Box, Text } from '@shopify/polaris'
import React from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { CUSTOM_AI_ASSISTANT_MARKDOWN_FORMAT } from '~/routes/api.ai-assistant/constants'
import ImageMessage from './ImageMessage'
import ImageLoadingSkeleton from '../skeleton/ImageLoading'

const createImageRegExp = () => {
  const startMarkdown = `${CUSTOM_AI_ASSISTANT_MARKDOWN_FORMAT.IMAGE_GENERATION_START}\\s*\\n*`
  const endMarkdown = `${CUSTOM_AI_ASSISTANT_MARKDOWN_FORMAT.IMAGE_GENERATION_END}`

  return new RegExp(`${startMarkdown}([^\\n]+)\\s*\\n*${endMarkdown}`)
}

const CustomMarkdown = React.memo(function CustomMarkdown({ children }: { children: string }) {
  const { t } = useTranslation()

  const imageParts = children.split(CUSTOM_AI_ASSISTANT_MARKDOWN_FORMAT.GENERATED_IMAGE)
  if (imageParts.length > 1) {
    const imageMatch = children.match(createImageRegExp())
    if (imageMatch && imageMatch[1]) {
      const imageUrl = imageMatch[1].trim()
      const cleanContent = imageParts[0].replace(CUSTOM_AI_ASSISTANT_MARKDOWN_FORMAT.GENERATING_IMAGE, '').trim()
      return (
        <BlockStack gap={'200'}>
          <ReactMarkdown>{cleanContent}</ReactMarkdown>
          <Box borderRadius="200" overflowX="hidden" overflowY="hidden" width="100%">
            <BlockStack gap={'200'}>
              <ImageMessage
                style={{ display: 'block', width: '100%', borderRadius: 'var(--p-space-100)' }}
                source={imageUrl}
                alt="AI generated image"
              />
              <Text variant="bodySm" as="p" tone="subdued">
                {t('image-only-exists-few-hours')}
              </Text>
            </BlockStack>
          </Box>
        </BlockStack>
      )
    }
  }

  const generatingParts = children.split(CUSTOM_AI_ASSISTANT_MARKDOWN_FORMAT.GENERATING_IMAGE)
  if (generatingParts.length > 1) {
    return (
      <BlockStack gap={'200'}>
        <ReactMarkdown>{generatingParts[0]}</ReactMarkdown>
        <Box position="relative" borderRadius="200" overflowX="hidden" overflowY="hidden" width="100%">
          <ImageLoadingSkeleton width="100%" height="130px" />
        </Box>
      </BlockStack>
    )
  }

  return <ReactMarkdown>{children}</ReactMarkdown>
})

export default CustomMarkdown
