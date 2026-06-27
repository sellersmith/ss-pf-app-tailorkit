import { useEffect, useState } from 'react'
import { BlockStack, List, Modal, SkeletonBodyText, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { AiCreditsService, type AiCreditPackage } from '~/api/services/ai-credits'

interface AiCreditsInfoModalProps {
  open: boolean
  onClose: () => void
}

export function AiCreditsInfoModal({ open, onClose }: AiCreditsInfoModalProps) {
  const { t } = useTranslation()
  const [packages, setPackages] = useState<AiCreditPackage[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || packages.length > 0) return

    setLoading(true)
    AiCreditsService.getPackages()
      .then(setPackages)
      .finally(() => setLoading(false))
  }, [open, packages.length])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('ai-credits')}
      primaryAction={{ content: t('close'), onAction: onClose }}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" variant="bodyMd">
            {t('ai-credits-tooltip')}
          </Text>

          {loading ? (
            <SkeletonBodyText lines={3} />
          ) : (
            <List type="bullet">
              {packages.map(pkg => (
                <List.Item key={pkg._id}>
                  {t('credits-credits-price', {
                    credits: pkg.credits.toLocaleString(),
                    price: `$${pkg.price.toFixed(2)}`,
                  })}
                </List.Item>
              ))}
            </List>
          )}

          <Text as="p" variant="bodySm" tone="subdued">
            {t('note-any-unused-purchased-ai-credits-will-roll-over-to-the-next-billing-cycle')}
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
