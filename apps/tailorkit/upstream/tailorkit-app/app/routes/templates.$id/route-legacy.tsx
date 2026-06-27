import type { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useNavigate } from '@remix-run/react'
import { json } from '~/bootstrap/fns/fetch.server'
import { useCallback, useEffect, useState } from 'react'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import { MODAL_ID } from '~/constants/modal'
import { SAVE_BAR_ID } from '~/constants/save-bar'
import { TEMPLATE_EDITOR_CTA_IDS } from '~/modules/TemplateEditor/constants'
import { buildUrlWithParams } from '~/utils/buildUrlWithParams'
import { APP_NAME } from '~/constants'
import { isJSON } from 'extensions/tailorkit-src/src/assets/fns/is-json'
import { EActionType } from '~/constants/fetcher-keys'
import { useTranslation } from 'react-i18next'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { id } = params
  const searchParams = new URL(request.url).searchParams
  const source = searchParams.get('source')
  const content = searchParams.get('content')
  const tour = searchParams.get('tour')
  const premadeTemplateId = searchParams.get('premadeTemplateId')
  const fallbackUrl = searchParams.get('fallback-url')
  // Ignore autoOpenChatBot param to prevent auto-opening the chat
  const autoOpenChatBot = 'false'
  const currentConversationId = searchParams.get('currentConversationId')
  const autoSelectFirstLayer = searchParams.get('autoSelectFirstLayer')
  const addAIImage = searchParams.get('add_ai_image')

  return json({
    id,
    source,
    content,
    tour,
    premadeTemplateId,
    fallbackUrl,
    autoOpenChatBot,
    currentConversationId,
    autoSelectFirstLayer,
    addAIImage,
  })
}

const Index = withNavMenu(function Index(props: any) {
  const navigate = useNavigate()
  const {
    id,
    source,
    content,
    tour,
    premadeTemplateId,
    autoOpenChatBot,
    fallbackUrl,
    currentConversationId,
    autoSelectFirstLayer,
    addAIImage,
  } = useLoaderData<typeof loader>()
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  const params = {
    source,
    content,
    tour,
    premadeTemplateId,
    autoOpenChatBot,
    'fallback-url': fallbackUrl,
    currentConversationId,
    autoSelectFirstLayer,
    addAIImage,
  }
  const src = buildUrlWithParams(`/templates/modal/${id}`, params)

  const getEditorWindow = useCallback(() => {
    const editorFrame = document.getElementById(MODAL_ID.TEMPLATE_EDITOR_MODAL) as HTMLIFrameElement
    const editorWindow = editorFrame.contentWindow as Window

    return editorWindow
  }, [])

  const onNavigate = useCallback(() => {
    const urlNavigator
      // @ts-ignore
      = window.shopify.tailorkit?.modals?.[MODAL_ID.TEMPLATE_EDITOR_MODAL]?.urlNavigator || '/templates'

    navigate(urlNavigator)

    // Resets modals state
    // @ts-ignore
    window.shopify.tailorkit = {
      // @ts-ignore
      ...window.shopify.tailorkit,
      modals: {
        // @ts-ignore
        ...window.shopify.tailorkit?.modals,
        [MODAL_ID.TEMPLATE_EDITOR_MODAL]: {
          urlNavigator: '/templates',
        },
      },
    }
  }, [navigate])

  const onSaveTemplate = useCallback(() => {
    const editorWindow = getEditorWindow()
    const saveBtn = editorWindow.document.getElementById(TEMPLATE_EDITOR_CTA_IDS.SAVE_TEMPLATE) as HTMLButtonElement

    saveBtn?.click()
    setIsTemplateSaved(false)
  }, [getEditorWindow])

  const onDiscardTemplate = useCallback(() => {
    const editorWindow = getEditorWindow()
    const discardBtn = editorWindow.document.getElementById(
      TEMPLATE_EDITOR_CTA_IDS.DISCARD_TEMPLATE
    ) as HTMLButtonElement

    discardBtn?.click()
  }, [getEditorWindow])

  const onBackToProduct = useCallback(() => {
    setLoading(true)
    const editorWindow = getEditorWindow()
    const backToProductBtn = editorWindow.document.getElementById(
      TEMPLATE_EDITOR_CTA_IDS.BACK_TO_PRODUCT
    ) as HTMLButtonElement

    backToProductBtn?.click()

    setTimeout(() => {
      setLoading(false)
    }, 50)
  }, [getEditorWindow])

  useEffect(() => {
    const modal = document.getElementById(MODAL_ID.TEMPLATE_EDITOR_MODAL) as any

    // Show modal
    modal?.show()

    // Listen to modal close event
    modal?.addEventListener('hide', onNavigate)

    return () => modal?.removeEventListener('hide', onNavigate)
  }, [onNavigate])

  const [isTemplateSaved, setIsTemplateSaved] = useState(false)
  const [isInactiveTemplate, setIsInactiveTemplate] = useState(true)

  const onSelectProduct = useCallback(() => {
    const editorWindow = getEditorWindow()
    const selectBtn = editorWindow.document.getElementById(TEMPLATE_EDITOR_CTA_IDS.SELECT_PRODUCT) as HTMLButtonElement

    selectBtn?.click()
  }, [getEditorWindow])

  const onViewIntegratedProduct = useCallback(() => {
    const editorWindow = getEditorWindow()
    const viewBtn = editorWindow.document.getElementById(
      TEMPLATE_EDITOR_CTA_IDS.VIEW_INTEGRATED_PRODUCT
    ) as HTMLButtonElement

    viewBtn?.click()
  }, [getEditorWindow])

  useEffect(() => {
    async function handleMessageFromMainApp(ev: MessageEvent) {
      if (isJSON(ev.data)) {
        const data = JSON.parse(ev.data)

        if (data.type === EActionType.NAVIGATE_MAX_MODAL) {
          const url = data.url

          shopify.modal.hide(MODAL_ID.TEMPLATE_EDITOR_MODAL)

          setTimeout(() => {
            navigate(url)
          }, 100)
        } else if (data.type === EActionType.LOADED_TEMPLATE) {
          setIsTemplateSaved(!!data.template?.createdAt)
          setIsInactiveTemplate(data.template?.isCreatingNew || !data.template?.activeVariantIntegration?.length)
        } else if (data.type === EActionType.SAVED_TEMPLATE) {
          setIsTemplateSaved(true)
        }
      }
    }

    window.addEventListener('message', handleMessageFromMainApp)

    return () => window.removeEventListener('message', handleMessageFromMainApp)
  }, [fallbackUrl, navigate, onNavigate])

  return (
    <ui-modal id={MODAL_ID.TEMPLATE_EDITOR_MODAL} variant="max" src={src}>
      <ui-title-bar title={APP_NAME}>
        {fallbackUrl ? (
          <button variant={'primary'} onClick={onBackToProduct} loading={loading ? '' : undefined}>
            {t('back-to-product')}
          </button>
        ) : isInactiveTemplate && isTemplateSaved ? (
          <button variant={'primary'} onClick={onSelectProduct}>
            {t('create-personalized-product')}
          </button>
        ) : !isInactiveTemplate ? (
          <button variant={'primary'} onClick={onViewIntegratedProduct}>
            {t('view-personalized-products')}
          </button>
        ) : null}
      </ui-title-bar>
      <ui-save-bar id={SAVE_BAR_ID.TEMPLATE_EDITOR_SAVE_BAR} discardConfirmation={'' as any}>
        <button id="save-button" variant="primary" onClick={onSaveTemplate}></button>
        <button onClick={onDiscardTemplate}></button>
      </ui-save-bar>
    </ui-modal>
  )
})

export default withInteractiveChat(Index)
