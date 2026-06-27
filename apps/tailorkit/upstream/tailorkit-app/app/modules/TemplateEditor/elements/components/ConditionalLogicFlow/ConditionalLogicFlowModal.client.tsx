import { lazy, Suspense, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Spinner } from '@shopify/polaris'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import type { ConditionalLogicFlowModalProps } from './types'
import styles from './styles.module.css'

const ConditionalLogicFlow = lazy(() => import('./ConditionalLogicFlow.client'))

/**
 * Modal wrapper for the per-layer Conditional Logic Flow Builder.
 * Uses Polaris Modal (size="large") for design system consistency.
 * Lazy-loads ReactFlow to keep it out of the main bundle.
 *
 * Accepts per-layer props: conditions, action, options, allLayers, controllerMap, onSave.
 * The controllerMap enables downstream indicators on target-layer chips inside the flow.
 */
export function ConditionalLogicFlowModal({
  layerStore,
  allLayers,
  options,
  action,
  conditions,
  controllerMap,
  onSave,
}: ConditionalLogicFlowModalProps) {
  const { t } = useTranslation()
  const { state, closeModal } = useModal()
  const tracking = useFeatureTracking('conditional_logic_flow')
  const openedAtRef = useRef<number | null>(null)

  const isOpen = Boolean(state[MODAL_ID.CONDITIONAL_LOGIC_FLOW_MODAL]?.active)

  // Track when modal opens
  useEffect(() => {
    if (isOpen) {
      openedAtRef.current = Date.now()
      tracking.trackStarted()
    }
  }, [isOpen, tracking])

  const handleClose = useCallback(() => {
    if (openedAtRef.current) {
      tracking.trackAbandoned('modal_closed')
      openedAtRef.current = null
    }
    closeModal(MODAL_ID.CONDITIONAL_LOGIC_FLOW_MODAL)
  }, [closeModal, tracking])

  const handleSave = useCallback(
    (
      results: {
        controllerId: string
        action: 'show' | 'hide'
        conditions: { ifOptionSelected: string; thenShowOrHideLayers: string[] }[]
      }[]
    ) => {
      const durationSeconds = openedAtRef.current ? Math.round((Date.now() - openedAtRef.current) / 1000) : undefined
      tracking.trackCompleted('saved', durationSeconds)
      // Clear ref before handleClose to prevent it from also firing trackAbandoned
      openedAtRef.current = null
      onSave(results)
      handleClose()
    },
    [onSave, handleClose, tracking]
  )

  /* Clean up modal state when component unmounts (e.g. layer deselected) */
  useEffect(() => {
    return () => {
      closeModal(MODAL_ID.CONDITIONAL_LOGIC_FLOW_MODAL)
    }
  }, [closeModal])

  const controllerId = layerStore.getState()._id

  return (
    <Modal size="large" open={isOpen} onClose={handleClose} title={t('conditional-logic')}>
      <div className={styles.modalBody}>
        <Suspense
          fallback={
            <div className={styles.spinnerContainer}>
              <Spinner size="large" />
            </div>
          }
        >
          {isOpen && (
            <ConditionalLogicFlow
              conditions={conditions}
              action={action}
              options={options}
              allLayers={allLayers}
              controllerId={controllerId}
              controllerMap={controllerMap}
              onSave={handleSave}
              onClose={handleClose}
            />
          )}
        </Suspense>
      </div>
    </Modal>
  )
}
