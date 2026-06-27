import { type ClientLoaderFunctionArgs, useLoaderData, useNavigate } from '@remix-run/react'
import { isJSON } from 'extensions/tailorkit-src/src/assets/fns/is-json'
import { useCallback, useEffect, useState } from 'react'
import { json } from '~/bootstrap/fns/fetch.server'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import { APP_NAME } from '~/constants'
import { EActionType } from '~/constants/fetcher-keys'
import { MODAL_ID } from '~/constants/modal'
import { SAVE_BAR_ID } from '~/constants/save-bar'
import { getIntegrationById } from '~/models/Integration.server'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import { authenticate } from '~/shopify/app.server'
import { authenticatedFetch } from '~/shopify/fns.client'
import { buildUrlWithParams } from '~/utils/buildUrlWithParams'
import { sendMessageToModal } from '~/utils/modalEvents'
import { useSuccessMessageUrlParam } from '~/hooks/useSuccessMessageUrlParam'

export const loader = async ({ params, request }: ClientLoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const integrationId = params.id || ''
  const { searchParams } = new URL(request.url)
  const previewMode = searchParams.get('previewMode') || ''
  const mockupId = searchParams.get('mockup')
  const tour = searchParams.get('tour')

  const integrationData = await getIntegrationById(integrationId, shopDomain)

  return json({
    id: integrationId,
    integration: integrationData,
    mockupId,
    previewMode: `${previewMode}`,
    tour,
  })
}

const NAVIGATOR_URL = '/personalized-products'

const Index = withNavMenu(function Index(props: WithTranslationProps) {
  const { t } = props
  const navigate = useNavigate()
  const loaderData = useLoaderData<typeof loader>()
  const { id, mockupId, integration: loaderIntegrationData, previewMode, tour } = loaderData

  const [integration, setIntegration] = useState(loaderIntegrationData)
  const [loading, setLoading] = useState(false)

  // Handle success message URL parameter
  const { passSuccessMessage } = useSuccessMessageUrlParam()

  const params = {
    mockup: mockupId,
    tour,
    previewMode,
    ...(passSuccessMessage && { showSuccessMessage: 'true' }),
  }
  const src = buildUrlWithParams(`/integrations/modal/${id}`, params)

  const onNavigate = useCallback(() => {
    const tailorkit = (window.shopify as any).tailorkit
    const urlNavigator = tailorkit?.modals?.[MODAL_ID.INTEGRATION_EDITOR_MODAL]?.urlNavigator || NAVIGATOR_URL

    navigate(urlNavigator)

    // Resets modals state
    ;(window.shopify as any).tailorkit = {
      ...tailorkit,
      modals: {
        ...tailorkit?.modals,
        [MODAL_ID.INTEGRATION_EDITOR_MODAL]: {
          urlNavigator: NAVIGATOR_URL,
        },
      },
    }
  }, [navigate])

  const onRefetchIntegration = useCallback(() => {
    ;(async () => {
      try {
        // Refetch integration
        const _integration = await authenticatedFetch(`/api/integrations/${id}`)

        setIntegration(_integration)
      } catch (e) {
        console.error(e)
      }
    })()
  }, [id])

  const handleSaveIntegration = useCallback(
    () => sendMessageToModal(MODAL_ID.INTEGRATION_EDITOR_MODAL, EActionType.SAVE_PRODUCT),
    []
  )

  const handleDiscardIntegration = useCallback(
    () => sendMessageToModal(MODAL_ID.INTEGRATION_EDITOR_MODAL, EActionType.DISCARD_INTEGRATION),
    []
  )

  useEffect(() => {
    const modal = document.getElementById(MODAL_ID.INTEGRATION_EDITOR_MODAL) as any

    // Show modal
    typeof modal?.show === 'function' && modal?.show()

    // Listen to modal close event
    modal?.addEventListener('hide', onNavigate)

    return () => modal?.removeEventListener('hide', onNavigate)
  }, [onNavigate])

  useEffect(() => {
    async function handleMessageFromMainApp(ev: MessageEvent) {
      try {
        if (ev.data === EActionType.SAVED_PRODUCT) {
          // Refetch integration
          onRefetchIntegration()
        }

        if (ev.data === EActionType.PUBLISHED_PRODUCT) {
          // Refetch integration

          setLoading(true)
        }

        if (ev.data === EActionType.PUBLISHED_PRODUCT) {
          setLoading(false)

          onRefetchIntegration()
        }

        if (ev.data === EActionType.UNPUBLISHED_PRODUCT) {
          setLoading(false)

          onRefetchIntegration()
        }
        if (ev.data === EActionType.SAVE_PRODUCT) {
          handleSaveIntegration()
        }

        if (ev.data === EActionType.ABORT_ACTION) {
          setLoading(false)
        }

        if (isJSON(ev.data)) {
          const data = JSON.parse(ev.data)

          if (data.type === EActionType.NAVIGATE_MAX_MODAL) {
            const url = data.url

            shopify.modal.hide(MODAL_ID.INTEGRATION_EDITOR_MODAL)

            setTimeout(() => {
              navigate(url)
            }, 100)
          }
        }
      } catch (e) {
        console.error(e)
      }
    }

    window.addEventListener('message', handleMessageFromMainApp)

    return () => window.removeEventListener('message', handleMessageFromMainApp)
  }, [handleSaveIntegration, id, navigate, onRefetchIntegration])

  const isIntegrationUpdated = new Date(integration.updatedAt) > new Date(integration.publishedAt)
  const isAnyTemplateUpdated = integration?.isAnyTemplateUpdated
  // Check if integration should republish or normal publish
  const shouldRepublish = integration?.publishedAt && (isIntegrationUpdated || isAnyTemplateUpdated)

  return (
    <ui-modal variant="max" id={MODAL_ID.INTEGRATION_EDITOR_MODAL} src={src}>
      <ui-title-bar title={APP_NAME}>
        {integration
          && (integration.publishedAt && !shouldRepublish ? (
            <button
              onClick={() => {
                sendMessageToModal(MODAL_ID.INTEGRATION_EDITOR_MODAL, EActionType.UNPUBLISH_PRODUCT)
              }}
              loading={loading ? '' : undefined}
            >
              {t('unpublish')}
            </button>
          ) : (
            <button
              variant={'primary'}
              onClick={() => {
                setLoading(true)

                sendMessageToModal(MODAL_ID.INTEGRATION_EDITOR_MODAL, EActionType.PUBLISHED_PRODUCT)
              }}
              loading={loading ? '' : undefined}
            >
              {t(`${shouldRepublish ? 'republish' : 'publish'}`)}
            </button>
          ))}
      </ui-title-bar>

      <ui-save-bar id={SAVE_BAR_ID.PERSONALIZED_PRODUCTS_SAVE_BAR} discardConfirmation={'' as any}>
        <button id="save-button" variant="primary" onClick={handleSaveIntegration}></button>

        <button onClick={handleDiscardIntegration}></button>
      </ui-save-bar>
    </ui-modal>
  )
})

export default withInteractiveChat(Index)
