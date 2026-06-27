import { Button, Icon, Tooltip } from '@shopify/polaris'
import { ImageMagicIcon } from '@shopify/polaris-icons'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import styles from '~/components/canvas/ToolBar/styles.module.css'
import { useStore } from '~/libs/external-store'
import { SubInspectorStore, subInspectorStoreActions } from '~/stores/canvas/subInspector'
import { isSvgImage } from '~/utils/file-types'

const PANEL_ID = 'ai-image-remix'

interface ImageRemixProps {
  imageUrl?: string
}

export function ImageRemix({ imageUrl }: ImageRemixProps) {
  const { t } = useTranslation()

  const subKey = useStore(SubInspectorStore, state => state.key)
  const subData = useStore(SubInspectorStore, state => state.data)
  const isOpen = subKey === 'styling-inspector' && subData?.panel === PANEL_ID

  const openPanel = useCallback(() => {
    subInspectorStoreActions.openSubInspector('styling-inspector', {
      title: t('remix-image-with-ai'),
      panel: PANEL_ID,
      imageUrl,
    })
  }, [t, imageUrl])

  // Don't show the button if no image URL is provided
  if (!imageUrl || isSvgImage(imageUrl)) {
    return null
  }

  return (
    <div className={styles.ToolItem}>
      <Tooltip content={t('remix-image-with-ai')} active={isOpen ? false : undefined}>
        <Button
          pressed={isOpen}
          variant="tertiary"
          onClick={openPanel}
          icon={<Icon source={ImageMagicIcon} tone="success" />}
        >
          {t('remix')}
        </Button>
      </Tooltip>
    </div>
  )
}
