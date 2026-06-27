import { BlockStack, Box, Button, InlineError, InlineStack } from '@shopify/polaris'
import { ImageMagicIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'

interface GenerateButtonProps {
  isGenerating: boolean
  isDisabled: boolean
  existingImageOptions: boolean
  isPopover: boolean
  errorMessage?: string | null
  disabledMessage?: string
  onClick: () => void
}

export function GenerateButton({
  isGenerating,
  isDisabled,
  existingImageOptions,
  isPopover,
  errorMessage,
  disabledMessage,
  onClick,
}: GenerateButtonProps) {
  const { t } = useTranslation()

  const defaultDisabledMessage = 'AI has generated the maximum number of images.'

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 'var(--p-space-100)',
        zIndex: 21,
        background: 'var(--p-surface-bg, #fff)',
      }}
    >
      <Box padding={'0'} paddingBlockStart={'200'}>
        <BlockStack gap="200">
          {(errorMessage || (isDisabled && !isGenerating && disabledMessage)) && (
            <InlineError
              message={errorMessage || disabledMessage || defaultDisabledMessage}
              fieldID={errorMessage ? 'ai-image-generator-error' : 'ai-image-generator-limit'}
            />
          )}
          <InlineStack wrap={false} gap="100" align="end" blockAlign="center">
            <Box paddingInlineEnd={isPopover ? '200' : '0'}>
              <Button
                icon={ImageMagicIcon}
                variant={existingImageOptions ? 'secondary' : 'primary'}
                loading={isGenerating}
                disabled={isDisabled}
                onClick={onClick}
                fullWidth={!isPopover}
              >
                {t(existingImageOptions ? 'generate-more' : 'generate-image')}
              </Button>
            </Box>
          </InlineStack>
        </BlockStack>
      </Box>
    </div>
  )
}
