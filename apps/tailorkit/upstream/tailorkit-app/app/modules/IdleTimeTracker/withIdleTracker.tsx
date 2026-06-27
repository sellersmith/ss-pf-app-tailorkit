import IdleTimeTracker from '~/modules/IdleTimeTracker'
import { Bleed, BlockStack, Box, Modal, RadioButton, TextField } from '@shopify/polaris'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback, useLayoutEffect, useMemo, useState, type ComponentClass, type FunctionComponent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { BFS_COMPLIANCE } from '~/constants/bfs-compliance'

// BFS Compliance: Flag to disable auto-opening modals (requirement 4.3.3)
const isIdleModalDisabled = BFS_COMPLIANCE.DISABLE_AUTO_OPENING_MODALS

export default function withIdleTracker(
  Component?: FunctionComponent<any> | ComponentClass<any>,
  initialContext?: string
) {
  return function WithIdleTracker(props: any) {
    const { t } = useTranslation()
    const { liveChatOpened } = useLiveChat()

    // Prepare variables for idle time modal
    const [checked, setChecked] = useState('')
    const [context, setContext] = useState(initialContext || 'default')
    const [requestFeature, setRequestFeature] = useState('')
    const [openIdleTimeModal, setOpenIdleTimeModal] = useState(false)

    const handleCloseIdleTimeModal = useCallback(() => setOpenIdleTimeModal(false), [])
    const handleChange = useCallback((_: boolean, value: string) => setChecked(value), [])

    const handleChatNow = useCallback(() => {
      // Check if Crisp is loaded
      if (window.$crisp) {
        // Open Crisp chat and send an automated message
        window.$crisp.push(['do', 'chat:open'])

        if (checked) {
          const message = requestFeature ? `${checked}: \n\n${requestFeature}` : checked
          window.$crisp.push(['do', 'message:send', ['text', `${window.testIdleTracker ? '[TEST] ' : ''}${message}`]])
        }
      }

      handleCloseIdleTimeModal()
    }, [checked, handleCloseIdleTimeModal, requestFeature])

    const listenIdleTime = useCallback(
      (eventData: { data?: { context: string } }) => {
        if (!liveChatOpened && eventData.data) {
          setOpenIdleTimeModal(true)
          setContext(eventData.data.context)
        }
      },
      [liveChatOpened]
    )

    useLayoutEffect(() => {
      // BFS Compliance: Skip idle tracker initialization when disabled
      if (isIdleModalDisabled) return

      // Initialize idle time tracker
      window.tailorKitIdleTracker = new IdleTimeTracker(context)
    }, [context])

    useLayoutEffect(() => {
      // BFS Compliance: Skip idle time event listener when disabled
      if (isIdleModalDisabled) return

      // Listen to idle time events
      Transmitter.listen('idle-time-occurred', listenIdleTime)

      return () => {
        Transmitter.remove('idle-time-occurred', listenIdleTime)
      }
    }, [listenIdleTime])

    const messages: any = useMemo(
      () => ({
        default: t('it-seems-you-ve-been-inactive-for-a-while-how-can-i-help-you'),
        onboarding: t('it-seems-you-ve-been-inactive-for-a-while-how-can-i-help-you'),
        dashboard: t('it-seems-you-ve-been-inactive-for-a-while-how-can-i-help-you'),
        providers: t('it-seems-you-ve-been-inactive-for-a-while-do-you-need-help-importing-a-product-base'),
        templates: t('it-seems-you-ve-been-inactive-for-a-while-how-can-i-help-you'),
        integrations: t('it-seems-you-ve-been-inactive-for-a-while-how-can-i-help-you'),
        orders: t('it-seems-you-ve-been-inactive-for-a-while-how-can-i-help-you'),
        'unified-editor': t('it-seems-you-ve-been-inactive-for-a-while-how-can-i-help-you'),
      }),
      [t]
    )

    const questions: any = useMemo(
      () => ({
        default: [
          t('what-should-i-do-next-to-set-up-my-store'),
          t('can-you-help-me-personalize-products'),
          t('can-you-explain-tailorkit-s-pricing'),
          t('need-help-with-a-tech-issue'),
          t('i-d-like-to-request-a-new-feature'),
        ],
        onboarding: [
          t('will-i-be-charged-for-doing-this-setup'),
          t('can-you-guide-me-on-what-to-do-next'),
          t('how-do-i-create-my-first-personalized-product'),
          t('need-help-with-a-tech-issue'),
          t('i-d-like-to-request-a-new-feature'),
        ],
        dashboard: [
          t('what-should-i-do-next-to-sell-in-my-store'),
          t('can-you-help-me-personalize-products'),
          t('help-me-customize-a-complex-jewelry-product-e-g-conditional-charm-display'),
          t('can-you-explain-tailorkit-s-pricing'),
          t('need-help-with-a-tech-issue'),
          t('i-d-like-to-request-a-new-feature'),
        ],
        providers: [
          t('i-need-help-with-importing-products'),
          t('can-i-fulfill-orders-manually'),
          t('how-can-i-select-a-fulfillment-provider'),
          t('can-i-use-fulfillment-providers-other-than-printify'),
          t('can-i-integrate-one-template-with-multiple-products'),
          t('i-just-need-someone-to-chat-with'),
        ],
        templates: [
          t('can-you-help-me-create-a-right-design-template-to-personalize-products'),
          t('help-me-customize-a-complex-jewelry-product-e-g-conditional-charm-display'),
          t('what-are-tailorkit-cliparts-are-they-free-of-charge'),
          t('how-do-i-duplicate-or-reuse-a-design-template'),
          t('need-help-with-a-tech-issue'),
          t('i-d-like-to-request-a-new-feature'),
        ],
        integrations: [
          t('can-you-help-me-personalize-products'),
          t('help-me-customize-a-complex-jewelry-product-e-g-conditional-charm-display'),
          t('how-do-i-check-if-my-products-are-set-up-correctly'),
          t('can-you-help-me-improve-my-storefront-mockups'),
          t('need-help-with-a-tech-issue'),
          t('i-d-like-to-request-a-new-feature'),
        ],
        orders: [
          t('how-do-i-view-or-change-personalization-details-for-an-order'),
          t('how-do-i-mark-an-order-as-fulfilled'),
          t('can-i-download-the-design-file-for-fulfillment'),
          t('need-help-with-a-tech-issue'),
          t('i-d-like-to-request-a-new-feature'),
        ],
        'unified-editor': [
          t('i-m-stuck-how-do-i-use-this-tool'),
          t('help-me-add-text-effects-to-my-product'),
          t('help-me-customize-a-complex-jewelry-product-e-g-conditional-charm-display'),
          t('guide-me-on-creating-ai-images-or-adding-ai-filters-to-my-photos'),
          t('how-can-i-create-a-product-mockup'),
          t('need-help-with-a-tech-issue'),
          t('i-d-like-to-request-a-new-feature'),
        ],
      }),
      [t]
    )

    return (
      <>
        {Component && <Component {...props} />}
        {
          /* Modal that shows when user is idle (BFS Compliance: hidden when disabled) */
          !isIdleModalDisabled && messages[context] && questions[context] && (
            <Modal
              title={t('need-help')}
              open={openIdleTimeModal}
              onClose={handleCloseIdleTimeModal}
              primaryAction={{
                content: t('chat-now'),
                onAction: handleChatNow,
              }}
              secondaryActions={[
                {
                  content: t('no-thanks'),
                  onAction: handleCloseIdleTimeModal,
                },
              ]}
            >
              <Box padding="400">
                <BlockStack gap="300">
                  <p>{messages[context]}</p>
                  {questions[context].map((question: string) => (
                    <RadioButton
                      id={question}
                      key={question}
                      name="question"
                      label={question}
                      onChange={handleChange}
                      checked={checked === question}
                    />
                  ))}
                  {checked === t('i-d-like-to-request-a-new-feature') && (
                    <Bleed marginBlockStart="200">
                      <Box paddingInlineStart="600">
                        <TextField
                          label="Request feature"
                          labelHidden={true}
                          autoComplete="off"
                          multiline={3}
                          value={requestFeature}
                          maxHeight={132}
                          placeholder={t('let-s-add-a-new-feature-to-make-this-even-better')}
                          onChange={value => setRequestFeature(value)}
                        />
                      </Box>
                    </Bleed>
                  )}
                </BlockStack>
              </Box>
            </Modal>
          )
        }
      </>
    )
  }
}
