/** @jsxImportSource preact */
import { useState } from 'preact/hooks'
import { Button } from '../button'
import { CustomizerModal } from './customizer-modal'

interface ModalTriggerProps {
  /** Text for the trigger button */
  buttonText?: string
  /** CSS class for the trigger button */
  buttonClass?: string
  /** Container selector for the product image */
  productImageSelector: string
  /** The customizer content element */
  customizerContent: HTMLElement | null
  /** App-controlled actions shown in modal footer */
  showAddToCart?: boolean
  showBuyItNow?: boolean
}

/**
 * Modal Trigger Component
 * Renders a button that opens the customizer modal
 */
export function ModalTrigger({
  buttonText = 'PERSONALIZE DESIGN',
  buttonClass = 'emtlkit-button--fullWidth',
  productImageSelector,
  customizerContent,
  showAddToCart = true,
  showBuyItNow = false,
}: ModalTriggerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleOpenModal = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  return (
    <>
      <Button onClick={handleOpenModal} className={buttonClass}>
        {buttonText}
      </Button>

      <CustomizerModal
        title={buttonText}
        open={isModalOpen}
        onClose={handleCloseModal}
        productImageSelector={productImageSelector}
        customizerContent={customizerContent}
        showAddToCart={showAddToCart}
        showBuyItNow={showBuyItNow}
      />
    </>
  )
}
