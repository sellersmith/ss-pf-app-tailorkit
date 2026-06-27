import { Button } from '@shopify/polaris'
import { WandIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { Fragment } from 'react/jsx-runtime'
import AIMockupModal from './modals/AIMockupModal'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { useCallback, useMemo } from 'react'
import withMockup, { type WithVariantsProps } from '~/modules/ProductEditor/withMockup'

interface IAIMockupProps extends WithVariantsProps {
  viewId?: string
}

function AIMockup(props: IAIMockupProps) {
  const { t } = useTranslation()
  const { openModal } = useModal()
  const { variants, mockupId, viewId } = props

  // Get current view ID
  const currentViewId = useMemo(() => {
    if (viewId) return viewId
    const firstVariant = variants[0]
    const mockup = firstVariant?.mockup
    return mockup?.selectedViewId || mockup?.views?.[0]?._id
  }, [variants, viewId])

  const handleOpenModal = useCallback(() => {
    openModal(MODAL_ID.AI_MOCKUP_MODAL)
  }, [openModal])

  return (
    <Fragment>
      <Button tone="success" fullWidth icon={WandIcon} onClick={handleOpenModal}>
        {t('generate-ai-mockups')}
      </Button>
      <AIMockupModal variants={variants} mockupId={mockupId} viewId={currentViewId} />
    </Fragment>
  )
}

export default withMockup(AIMockup)
