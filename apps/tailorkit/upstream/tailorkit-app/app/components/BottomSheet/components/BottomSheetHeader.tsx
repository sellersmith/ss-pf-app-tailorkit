import { Box, Button, InlineStack } from '@shopify/polaris'
import { ExitIcon } from '@shopify/polaris-icons'
import { isValidElement, memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useHeaderActions } from '../hooks/useHeaderActions'
import type { ActionProps, BottomSheetDrawerProps } from '../types'
import styles from './bottomSheet.module.css'

interface IBottomSheetHeader extends BottomSheetDrawerProps {
  onToggleDrawer?: () => void
  onTouchStart: (event: React.TouchEvent) => void
  onTouchMove: (event: React.TouchEvent) => void
  onTouchEnd: (event: React.TouchEvent) => void
  actions?: React.ReactNode
}

/**
 * BottomSheetHeader Component
 * Renders the header section of the BottomSheet with optional actions, title, and event handlers for gestures.
 *
 * Props:
 * - `title`: Title displayed in the center of the header.
 * - `primaryAction`: Primary button/action to display in the header.
 * - `secondaryAction`: Secondary button/action to display in the header.
 * - `footer`: Footer section, displayed if `showFooter` is true.
 * - `actions`: Custom actions to render in the header.
 * - `onBack`: Callback triggered when the "Back" button is clicked.
 * - `onToggleDrawer`: Toggles the BottomSheet state.
 * - `onTouchStart`, `onTouchMove`, `onTouchEnd`: Handlers for touch gestures.
 */
export const BottomSheetHeader = memo(function BottomSheetHeader(props: IBottomSheetHeader) {
  const { t } = useTranslation()
  const {
    title,
    primaryAction,
    secondaryAction,
    footer,
    showFooter,
    actions,
    onBack,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onToggleDrawer,
    goBackOnTapHeader = false,
  } = props

  const { actions: headerActions } = useHeaderActions(props)

  /**
   * Renders a button or custom action based on the type ('primaryAction' or 'secondaryAction').
   */
  const renderAction = (type: 'primaryAction' | 'secondaryAction' = 'primaryAction') => {
    const actionProp = props[type] || (headerActions as any)?.[type]
    if (!actionProp) return null

    // Check if the action is a valid React element
    if (isValidElement(actionProp)) return actionProp

    const { action, loading, disabled, icon } = (actionProp || {}) as ActionProps
    const handleClick = typeof action === 'function' ? action : actionProp?.['onAction']

    return (
      <Box width="fit-content">
        <Button onClick={handleClick} loading={loading} disabled={disabled} icon={icon || undefined} variant="tertiary">
          {typeof actionProp?.['content'] === 'string'
            ? t(actionProp?.['content'] as string)
            : t(action?.toString() as string)}
        </Button>
      </Box>
    )
  }

  /**
   * Handles drawer toggle and back navigation.
   */
  const handleToggleDrawer = useCallback(
    (e: React.MouseEvent) => {
      onToggleDrawer?.()
      goBackOnTapHeader && onBack?.()
    },
    [onToggleDrawer, goBackOnTapHeader, onBack]
  )

  return (
    <div
      className={styles.BottomSheetHeader}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Drag handle */}
      <div className={styles.BottomSheetHandle} onClick={handleToggleDrawer} />

      <Box width="100%">
        <InlineStack gap="300" align="start" blockAlign="center" wrap={false}>
          {/* <InlineGrid gap="200" columns={['oneThird', 'twoThirds', 'oneThird']} alignItems="center"> */}
          {/* Left Section (Back or Secondary Action) */}
          {onBack ? (
            <Box width="fit-content" zIndex="800">
              {/* <Button onClick={onBack} variant="tertiary">
                {t('back')}
              </Button> */}
              <Button onClick={onBack} variant="monochromePlain" icon={ExitIcon} />
            </Box>
          ) : (
            <Box width="fit-content" zIndex="800">
              {renderAction('secondaryAction')}
            </Box>
          )}

          {/* Center Section (Title) */}
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onClick={handleToggleDrawer}
          >
            {typeof title === 'string' ? <h3 className={styles.BottomSheetTitle}>{t(title!)} </h3> : title}
          </div>

          {/* Right Section (Actions or Footer) */}
          {!!actions || showFooter ? (
            <InlineStack gap="100" align="end" blockAlign="center" wrap={false}>
              {!!actions && actions}
              {showFooter
                ? footer || (
                    <InlineStack gap="200" align="end" wrap={false}>
                      {secondaryAction && renderAction('secondaryAction')}
                      {primaryAction && renderAction('primaryAction')}
                    </InlineStack>
                  )
                : renderAction('primaryAction')}
            </InlineStack>
          ) : null}
        </InlineStack>
        {/* </InlineGrid> */}
      </Box>
    </div>
  )
})

// /**
//  * StyledWrapperHeader - Wrapper for the BottomSheet header.
//  */
// const StyledWrapperHeader = styled.div`
//   height: ${HEADER_HEIGHT}px;
//   padding: 16px 16px 12px;
//   text-align: center;
//   background: #ffffff;
//   cursor: pointer;
//   user-select: none;
//   touch-action: none;
//   display: flex;
//   align-items: center;
//   justify-content: space-between;
//   flex-direction: column;
//   width: 100%;
// `

// /**
//  * StyledTitle - Title styles for the BottomSheet header.
//  */
// const StyledTitle = styled.h3`
//   color: rgba(48, 48, 48, 1);
//   text-align: center;
//   font-size: 14px !important;
//   font-style: normal;
//   font-weight: 650;
//   line-height: 20px;
//   white-space: nowrap;
//   overflow: hidden;
//   text-overflow: ellipsis;
// `
// /**
//  * StyledHandle - Drag handle at the top of the BottomSheet header.
//  */
// const StyledHandle = styled.div`
//   width: 48px;
//   height: 4px;
//   border-radius: 2px;
//   background: #0000000d;
// `
