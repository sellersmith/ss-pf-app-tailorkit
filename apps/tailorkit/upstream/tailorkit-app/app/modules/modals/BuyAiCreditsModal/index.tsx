import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banner, BlockStack, InlineGrid, Modal, Select, SkeletonBodyText, Text, TextField } from '@shopify/polaris'
import { useRevalidator } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { AiCreditsService, type AiCreditPackage } from '~/api/services/ai-credits'
import { openInNewTab } from '~/utils/openInNewTab'

export function BuyAiCreditsModal() {
  const { t } = useTranslation()
  const { state, closeModal } = useModal()
  const { revalidate } = useRevalidator()
  const modalState = state[MODAL_ID.BUY_AI_CREDITS_MODAL]
  const isOpen = modalState?.active ?? false

  const [packages, setPackages] = useState<AiCreditPackage[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    closeModal(MODAL_ID.BUY_AI_CREDITS_MODAL)
    setError(null)
  }, [closeModal])

  useEffect(() => {
    if (!isOpen || packages.length > 0) return

    setLoading(true)
    AiCreditsService.getPackages()
      .then(pkgs => {
        setPackages(pkgs)
        if (pkgs.length > 0) {
          setSelectedPackageId(pkgs[0]._id)
        }
      })
      .catch(() => setError(t('failed-to-load-ai-credit-packages')))
      .finally(() => setLoading(false))
  }, [isOpen, packages.length, t])

  const selectOptions = useMemo(() => packages.map(pkg => ({ label: String(pkg.credits), value: pkg._id })), [packages])

  const selectedPackage = useMemo(
    () => packages.find(pkg => pkg._id === selectedPackageId),
    [packages, selectedPackageId]
  )

  const totalPrice = selectedPackage ? selectedPackage.price.toFixed(2) : '0.00'

  const handlePurchase = useCallback(async () => {
    if (!selectedPackageId) return

    setPurchasing(true)
    setError(null)

    try {
      const data = await AiCreditsService.purchase(selectedPackageId)

      if (data.success) {
        if (data.autoCharged) {
          handleClose()
          revalidate()
        } else if (data.confirmationUrl) {
          openInNewTab(data.confirmationUrl)
        }
      } else if (data.requirePlanSelection) {
        setError(t('please-select-a-pricing-plan-before-purchasing-ai-credits'))
      } else {
        setError(data.message || t('purchase-failed-please-try-again'))
      }
    } catch {
      setError(t('purchase-failed-please-try-again'))
    } finally {
      setPurchasing(false)
    }
  }, [selectedPackageId, handleClose, revalidate, t])

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={t('buy-ai-credits')}
      primaryAction={{
        content: t('buy-ai-credits'),
        onAction: handlePurchase,
        loading: purchasing,
        disabled: loading || !selectedPackageId,
      }}
      secondaryActions={[{ content: t('cancel'), onAction: handleClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {error && (
            <Banner tone="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          )}

          <Text as="p" variant="bodyMd">
            {t('ai-credits-tooltip')}
          </Text>

          {loading ? (
            <SkeletonBodyText lines={2} />
          ) : (
            <InlineGrid columns={2} gap="300">
              <Select
                label={t('credits-to-purchase')}
                options={selectOptions}
                value={selectedPackageId}
                onChange={setSelectedPackageId}
              />
              <TextField label={t('total')} value={totalPrice} readOnly autoComplete="off" prefix="$" />
            </InlineGrid>
          )}

          <Text as="p" variant="bodyMd" tone="subdued">
            {t('note-any-unused-purchased-ai-credits-will-roll-over-to-the-next-billing-cycle')}
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
