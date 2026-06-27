import { Button, Tooltip } from '@shopify/polaris'
import { EditIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import styles from '~/components/canvas/ToolBar/styles.module.css'
import { isSvgImage } from '~/utils/file-types'

interface VectorEditProps {
  imageUrl?: string
}

export function VectorEdit({ imageUrl }: VectorEditProps) {
  const { t } = useTranslation()
  const { state: modalState, openModal } = useModal()

  // Determine if the image is SVG or raster
  const isSvg = useMemo(() => isSvgImage(imageUrl), [imageUrl])

  const isThisModalOpen = useMemo(() => {
    return Boolean(modalState[MODAL_ID.VECTOR_EDITOR_MODAL]?.active)
  }, [modalState])

  // Determine button label and tooltip based on image type and saved state
  const tooltipContent = isSvg ? t('edit-vector-graphics-beta') : t('edit-image-with-vector-overlay-beta')

  const handleOpen = useCallback(() => {
    if (!imageUrl) return
    openModal(MODAL_ID.VECTOR_EDITOR_MODAL)
  }, [imageUrl, openModal])

  // Show the button for any valid image URL
  if (!imageUrl) {
    return null
  }

  return (
    <div className={styles.ToolItem}>
      <Tooltip content={tooltipContent} active={isThisModalOpen ? false : undefined}>
        <Button pressed={isThisModalOpen} variant="tertiary" onClick={handleOpen} icon={EditIcon}>
          {t('edit')}
        </Button>
      </Tooltip>
    </div>
  )
}
