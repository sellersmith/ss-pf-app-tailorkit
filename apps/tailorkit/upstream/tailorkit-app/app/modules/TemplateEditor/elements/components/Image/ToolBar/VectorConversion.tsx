import { Button, Tooltip } from '@shopify/polaris'
import { WandIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import styles from '~/components/canvas/ToolBar/styles.module.css'
import { isSvgImage } from '~/utils/file-types'

interface VectorConversionProps {
  imageUrl?: string
}

export function VectorConversion({ imageUrl }: VectorConversionProps) {
  const { t } = useTranslation()
  const { state: modalState, openModal } = useModal()

  const isThisModalOpen = useMemo(() => {
    return Boolean(modalState[MODAL_ID.VECTOR_WIZARD_MODAL]?.active)
  }, [modalState])

  const handleOpen = useCallback(() => {
    if (!imageUrl) return
    openModal(MODAL_ID.VECTOR_WIZARD_MODAL)
  }, [imageUrl, openModal])

  // Don't show the button if no image URL is provided or image is already SVG
  if (!imageUrl || isSvgImage(imageUrl)) {
    return null
  }

  return (
    <div className={styles.ToolItem}>
      <Tooltip content={t('try-vector-wizard-beta')} active={isThisModalOpen ? false : undefined}>
        <Button pressed={isThisModalOpen} variant="tertiary" onClick={handleOpen} icon={WandIcon}>
          {t('vectorize')}
        </Button>
      </Tooltip>
    </div>
  )
}
