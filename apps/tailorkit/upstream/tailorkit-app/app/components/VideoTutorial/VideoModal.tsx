/* eslint-disable max-len */
import { Button, Icon, useBreakpoints } from '@shopify/polaris'
import { XIcon, DragHandleIcon, MaximizeIcon, MinimizeIcon } from '@shopify/polaris-icons'
import type { PropsWithChildren } from 'react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import videoModalStyles from './style.module.css'
import { useModal } from '~/utils/hooks/useModal'

interface VideoModalProps {
  id: string
  maximumWidth?: number
  minimumWidth?: number
}

/**
 * VideoModal component
 * A modal that displays video content with draggable and resizable capabilities.
 * Renders as a portal to document.body for proper z-index layering.
 */
const VideoModal = (props: PropsWithChildren<VideoModalProps>) => {
  const { id, maximumWidth = 720, minimumWidth = 300 } = props
  const { closeModal, state } = useModal()
  const isActive = state?.[id]?.active
  const { mdDown } = useBreakpoints()
  const [mode, setMode] = useState<'maximum' | 'minimum'>('maximum')
  const [isClient, setIsClient] = useState(false)

  // Set isClient to true on mount for SSR safety
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Lock body scroll when modal is open in maximum mode
  useEffect(() => {
    if (isActive && mode === 'maximum') {
      // Save original body overflow
      const originalOverflow = document.body.style.overflow
      // Lock scroll
      document.body.style.overflow = 'hidden'

      // Cleanup: restore original overflow on unmount or when modal closes
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isActive, mode])

  // Don't render on server-side or if document is not available
  if (!isClient || typeof document === 'undefined') {
    return null
  }

  const modalElement = document.getElementById(id)

  let x1 = 0,
    y1 = 0,
    x2 = 0,
    y2 = 0
  const toggleMode = () => {
    setMode(mode === 'maximum' ? 'minimum' : 'maximum')
    if (modalElement) {
      modalElement.style.removeProperty('top')
      modalElement.style.removeProperty('left')
    }
  }

  /**
   * Closes the modal and resets to maximum mode
   */
  const onCloseModal = () => {
    closeModal(id)
    setMode('maximum')
  }

  /**
   * Handles backdrop click to close modal (only in maximum mode)
   * @param e - Mouse event
   */
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking directly on the backdrop (not the container)
    if (mode === 'maximum' && e.target === e.currentTarget) {
      onCloseModal()
    }
  }
  const onMouseDown = (e: any) => {
    x1 = e.clientX
    y1 = e.clientY
    document.onmouseup = cancelDragElement
    document.onmousemove = dragElement
  }
  const dragElement = (e: any) => {
    if (!modalElement) return

    e.preventDefault()
    x2 = x1 - e.clientX
    y2 = y1 - e.clientY
    x1 = e.clientX
    y1 = e.clientY
    const newTop = modalElement.offsetTop - y2
    const newLeft = modalElement.offsetLeft - x2
    const maxTop = window.innerHeight - modalElement.offsetHeight
    const maxLeft = window.innerWidth - modalElement.offsetWidth
    const isOverTop = newTop < 0
    const isOverBottom = newTop > maxTop
    const isOverLeft = newLeft < 0
    const isOverRight = newLeft > maxLeft
    modalElement.style.top = `${isOverTop ? 0 : isOverBottom ? maxTop : newTop}px`
    modalElement.style.left = `${isOverLeft ? 0 : isOverRight ? maxLeft : newLeft}px`
  }
  const cancelDragElement = () => {
    document.onmouseup = null
    document.onmousemove = null
  }

  const modalContent = (
    <div
      id={id}
      className={`${videoModalStyles.videoModal} ${mdDown ? videoModalStyles.maximum : videoModalStyles[mode]} ${isActive ? videoModalStyles.open : videoModalStyles.close}`}
      onClick={handleBackdropClick}
    >
      <div
        className={videoModalStyles.videoModalContainer}
        style={{ width: mode === 'maximum' ? `${maximumWidth}px` : `${minimumWidth}px` }}
      >
        <div className={videoModalStyles.videoModalContent}>{isActive && props.children}</div>
        <div className={videoModalStyles.videoModalAction}>
          <div className={videoModalStyles.videoModalActionLeft}>
            {!mdDown && mode === 'minimum' && (
              <Button
                variant="plain"
                icon={<Icon source={DragHandleIcon} />}
                onPointerDown={onMouseDown}
                id={'drag-btn'}
              />
            )}
          </div>
          <div className={videoModalStyles.videoModalActionRight}>
            {!mdDown && (
              <Button
                variant="plain"
                icon={<Icon source={mode === 'maximum' ? MinimizeIcon : MaximizeIcon} />}
                onClick={toggleMode}
              />
            )}
            <Button variant="plain" icon={<Icon source={XIcon} />} onClick={onCloseModal} />
          </div>
        </div>
      </div>
    </div>
  )

  // Render modal using portal to document.body for proper z-index handling
  return createPortal(modalContent, document.body)
}
export default VideoModal
