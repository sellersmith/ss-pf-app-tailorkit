import { Button, Tooltip } from '@shopify/polaris'
import { SaveIcon } from '@shopify/polaris-icons'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import { exportCanvasAsImage } from '~/modules/TemplateEditor/utilities/canvas'
import { sleep } from '~/utils/sleep'

export default function ButtonSaveCanvasAsImage() {
  const { t } = useTranslation()
  const [trickyLoading, setTrickyLoading] = useState('')

  const stageRef = useStore(TemplateEditorStore, state => state.stageRef)

  const handleSaveCanvasAsImage = useCallback(async () => {
    try {
      setTrickyLoading('processing')
      await sleep(50)

      const stage = stageRef?.current

      if (!stage) {
        showGenericErrorToast()

        return
      }

      const templateEditorState = TemplateEditorStore.getState()
      const dimension = templateEditorState.dimension

      if (!dimension) {
        showGenericErrorToast()
        return
      }

      const _width = dimension.width || 0
      const _height = dimension.height || 0

      // Convert the width and height to pixels
      const width = lengthUnitToPixels(_width, dimension.measurementUnit, dimension.resolution)
      const height = lengthUnitToPixels(_height, dimension.measurementUnit, dimension.resolution)

      const base64Image = await exportCanvasAsImage(stage, width, height)

      if (typeof base64Image !== 'string') {
        throw new Error('Failed to export canvas as image')
      }

      // Download the image
      const a = document.createElement('a')
      a.href = base64Image
      a.download = `${templateEditorState.name}`
      a.click()
    } catch (error) {
      console.error(error)
      showGenericErrorToast()
    } finally {
      setTrickyLoading('')
    }
  }, [stageRef])

  // Temporary disable because we have "download mockup" button in the header
  return null

  return (
    <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }}>
      <Tooltip content={t('save-image-as')}>
        {trickyLoading === 'processing' ? (
          <Button disabled icon={SaveIcon} onClick={handleSaveCanvasAsImage}>
            {t('processing')}
          </Button>
        ) : (
          <Button icon={SaveIcon} onClick={handleSaveCanvasAsImage} />
        )}
      </Tooltip>
    </div>
  )
}
