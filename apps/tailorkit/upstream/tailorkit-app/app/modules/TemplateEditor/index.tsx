import { useLoaderData } from '@remix-run/react'
import { useLayoutEffect } from 'react'
import withTourGuide from '~/bootstrap/hoc/withTourGuide'
import type { clientLoader } from '~/routes/templates.$id/route.tsx'
import TemplateEditorLayout from './components/Layout/TemplateEditorLayout'
import TemplateEditorProviders from './components/TemplateEditorProviders'
import type { ITemplate } from './hooks/useInitTemplate'
import { useInitTemplate } from './hooks/useInitTemplate'
import { useTemplateEditor } from './hooks'
import { useCharmModeBootstrap } from './hooks/useCharmModeBootstrap'
import consolidatedStyles from './styles/consolidated.css?url'

import { EActionType } from '~/constants/fetcher-keys'
import { sendMessageToMainApp } from '~/utils/modalEvents'
import { LayerToolMap } from './components/Outline/LayerToolbar/constants'
import { closeTemplateEditorSaveBarAndUpdateSavedStep, resetTemplateEditorStates } from './fns'

export const templateEditorCSS = [{ rel: 'stylesheet', href: consolidatedStyles }]

function TemplateEditor() {
  const { initTemplate, initOptionSetLists } = useInitTemplate()
  // Onboarding flow router: pre-create CHARM_NODE on mount when arriving via
  // ?charmMode=true (set by the dashboard's openCreateFlow consumer).
  useCharmModeBootstrap()

  const loaderData = useLoaderData<typeof clientLoader>()
  const template = loaderData?.template
  // Ignore autoOpenChatBot to prevent automatic opening
  const autoOpenChatBot = false
  const currentConversationId = (
    loaderData?.currentConversationId !== 'undefined' ? loaderData?.currentConversationId : undefined
  ) as string | undefined
  const autoSelectFirstLayer = `${loaderData?.autoSelectFirstLayer}` === 'true'

  useLayoutEffect(() => {
    initTemplate({
      ...(template || {}),
      autoOpenChatBot,
      currentConversationId,
      autoSelectFirstLayer,
    } as ITemplate)
    initOptionSetLists()

    // Send message to main app
    sendMessageToMainApp(JSON.stringify({ type: EActionType.LOADED_TEMPLATE, template }))

    if (loaderData.addAIImage) {
      ;(function addAIImageElement() {
        const btn = document.querySelector(
          `#layer-toolbar-container #${LayerToolMap.AI_IMAGE}, #quick-add-ai-image-btn, #add-ai-image-btn`
        ) as HTMLButtonElement

        if (btn) {
          btn.click()
        } else {
          setTimeout(addAIImageElement, 500)
        }
      })()
    }

    return () => {
      resetTemplateEditorStates()

      // Close ui-save-bar and grant savedStep
      closeTemplateEditorSaveBarAndUpdateSavedStep(true)
    }
  }, [
    initTemplate,
    initOptionSetLists,
    loaderData,
    template,
    autoOpenChatBot,
    currentConversationId,
    autoSelectFirstLayer,
  ])

  // Handle template editor hooks
  useTemplateEditor()

  return (
    <TemplateEditorProviders>
      <TemplateEditorLayout />
    </TemplateEditorProviders>
  )
}

export default withTourGuide(TemplateEditor)
