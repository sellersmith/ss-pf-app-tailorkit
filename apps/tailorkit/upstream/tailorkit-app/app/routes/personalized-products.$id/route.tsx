import { type ClientLoaderFunctionArgs, type ShouldRevalidateFunctionArgs } from '@remix-run/react'
import { Fragment, useCallback } from 'react'
import reactQuillStyles from 'react-quill-new/dist/quill.snow.css?url'
import withFeedback from '~/bootstrap/hoc/withFeedback'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import withTourGuide from '~/bootstrap/hoc/withTourGuide'
import richTextEditorStyles from '~/components/.client/RichTextEditor/styles.css?url'
import { linksSortableCSS } from '~/components/common/SortableList'
import { EActionType } from '~/constants/fetcher-keys'
import { SAVE_BAR_ID } from '~/constants/save-bar'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import { linksImageModalCSS } from '~/modules/modals'
import ProductEditor from '~/modules/ProductEditor'
import { OnboardingPricingModal } from '~/modules/ProductEditor/components/OnboardingPricingModal'
import { useAutoPublishOnboarding } from '~/modules/ProductEditor/components/OnboardingPricingModal/useAutoPublishOnboarding'
import integrationEditorStyles from '~/modules/ProductEditor/styles.css?url'
import { templateEditorCSS } from '~/modules/TemplateEditor'
import { HydrateFallback } from '~/routes/dashboard/route'
import { authenticatedFetch } from '~/shopify/fns.client'
import { sendMessageToMainApp } from '~/utils/modalEvents'
import useUnifiedSave from '~/modules/ProductEditor/hooks/useUnifiedSave'
import themeHelperStyles from '../../shared/extensions/tailorkit-src/src/assets/tailorkit.css?url'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { useTranslation } from 'react-i18next'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { Crisp } from 'crisp-sdk-web'
import useDevices from '~/utils/hooks/useDevice'

export { HydrateFallback }

export const links = () => [
  { rel: 'stylesheet', href: themeHelperStyles },
  { rel: 'stylesheet', href: integrationEditorStyles },
  ...linksSortableCSS,
  ...linksImageModalCSS,

  ...templateEditorCSS,
  ...linksImageModalCSS,
  { rel: 'stylesheet', href: reactQuillStyles },
  { rel: 'stylesheet', href: richTextEditorStyles },
]

export const clientLoader = async ({ params, request }: ClientLoaderFunctionArgs) => {
  const id = params.id
  const { searchParams } = new URL(request.url)
  const mockupId = searchParams.get('mockup') || ''
  const tab = searchParams.get('tab') || ''
  const printAreaId = searchParams.get('printAreaId') || ''
  const templateId = searchParams.get('templateId') || ''
  const viewId = searchParams.get('viewId') || ''

  const dataSource = `/api/integrations/${id}?mockup=${mockupId}&populateTemplate=1`
  const integration = await authenticatedFetch(dataSource)

  return { id, mockupId, integration, tab, printAreaId, templateId, viewId }
}

// Prevent re-running loader on search param changes (tab, printAreaId, etc.)
// Only rerun if the integration ID actually changes
export function shouldRevalidate({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  // Only revalidate if the path params changed (integration ID)
  // Don't revalidate for search param changes (tab, printAreaId, templateId, viewId)
  const currentPath = currentUrl.pathname
  const nextPath = nextUrl.pathname

  // If path changed (different integration), revalidate
  if (currentPath !== nextPath) {
    return true
  }

  // Path is same (same integration), don't revalidate
  // Components will read search params directly via useSearchParams()
  return false
}

function Index() {
  const { saveAll } = useUnifiedSave()
  const { t } = useTranslation()
  const { isMobileView } = useDevices()
  useAutoPublishOnboarding()

  const handleSaveIntegration = useCallback(async () => {
    // Show toast
    showToast(t(TOAST.PRODUCT_EDITOR.INTEGRATION_SAVING))

    // Save all
    await saveAll()

    // Notify parent window that save completed
    sendMessageToMainApp(EActionType.SAVED_PRODUCT)
  }, [t, saveAll])

  const handleDiscardIntegration = useCallback(() => {
    // Send message to open discard confirmation modal
    sendMessageToMainApp(EActionType.DISCARD_INTEGRATION)
  }, [])

  const { openChatBox } = useLiveChat()

  const handleChatWithSupport = useCallback(() => {
    // Open chat box
    openChatBox()

    // Set message text
    Crisp.message.setMessageText(t('chat-with-us-message', { nickname: Crisp.user.getNickname() }))
  }, [openChatBox, t])

  return (
    <Fragment>
      <ProductEditor />
      <ui-save-bar id={SAVE_BAR_ID.PERSONALIZED_PRODUCTS_SAVE_BAR} discardConfirmation={'' as any}>
        <button id="save-button" variant="primary" onClick={handleSaveIntegration}></button>
        <button onClick={handleDiscardIntegration}></button>
      </ui-save-bar>
      {!isMobileView && (
        <ui-title-bar>
          <button onClick={handleChatWithSupport}>{t('chat-with-us')}</button>
        </ui-title-bar>
      )}
      <OnboardingPricingModal />
    </Fragment>
  )
}

export default withNavMenu(
  withTourGuide(
    withFeedback(withIdleTracker(withInteractiveChat(Index), 'unified-editor'), FEEDBACK_TYPE.INTEGRATION_FUNCTIONALITY)
  )
)
