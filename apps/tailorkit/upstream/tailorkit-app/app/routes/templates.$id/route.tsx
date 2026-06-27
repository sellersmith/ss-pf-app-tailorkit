import { type ClientLoaderFunctionArgs } from '@remix-run/react'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import { linksSortableCSS } from '~/components/common/SortableList'
import { linksImageModalCSS } from '~/modules/modals/ImageSelector'
import TemplateEditor, { templateEditorCSS } from '~/modules/TemplateEditor/index'
import { TemplatesService } from '~/api/services/templates'
import { HydrateFallback } from '~/routes/dashboard/route'
import { Fragment } from 'react/jsx-runtime'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import reactQuillStyles from 'react-quill-new/dist/quill.snow.css?url'
import richTextEditorStyles from '~/components/.client/RichTextEditor/styles.css?url'
import { SAVE_BAR_ID } from '~/constants/save-bar'
import { useCallback } from 'react'
import { TEMPLATE_EDITOR_CTA_IDS } from '~/modules/TemplateEditor/constants'

export { HydrateFallback }

export const links = () => [
  ...linksSortableCSS,
  ...templateEditorCSS,
  ...linksImageModalCSS,
  { rel: 'stylesheet', href: reactQuillStyles },
  { rel: 'stylesheet', href: richTextEditorStyles },
]

export const clientLoader = async ({ params, request }: ClientLoaderFunctionArgs) => {
  const { searchParams } = new URL(request.url)
  const premadeTemplateId = searchParams.get('premadeTemplateId')
  // Ignore autoOpenChatBot param to prevent auto-opening the chat
  const autoOpenChatBot = 'false'
  const currentConversationId = searchParams.get('currentConversationId')
  const autoSelectFirstLayer = searchParams.get('autoSelectFirstLayer')
  const addAIImage = searchParams.get('addAIImage') || searchParams.get('add_ai_image')

  // Get template data
  const response = await TemplatesService.getById(
    `${params.id}${premadeTemplateId ? `?premadeTemplateId=${premadeTemplateId}` : ''}`
  )
  return { template: response, autoOpenChatBot, currentConversationId, autoSelectFirstLayer, addAIImage }
}

function Index() {
  // const hydrated = useHydrateMaxModal()

  const onSaveTemplate = useCallback(() => {
    const saveBtn = document.getElementById(TEMPLATE_EDITOR_CTA_IDS.SAVE_TEMPLATE) as HTMLButtonElement

    saveBtn?.click()
    // setIsTemplateSaved(false)
  }, [])

  const onDiscardTemplate = useCallback(() => {
    const discardBtn = document.getElementById(TEMPLATE_EDITOR_CTA_IDS.DISCARD_TEMPLATE) as HTMLButtonElement

    discardBtn?.click()
  }, [])

  return (
    <Fragment>
      <TemplateEditor />
      <ui-save-bar id={SAVE_BAR_ID.TEMPLATE_EDITOR_SAVE_BAR} discardConfirmation={'' as any}>
        <button id="save-button" variant="primary" onClick={onSaveTemplate}></button>
        <button onClick={onDiscardTemplate}></button>
      </ui-save-bar>
    </Fragment>
  )
}

export default withNavMenu(withIdleTracker(withInteractiveChat(Index), 'unified-editor'))
