import { BlockStack, Box, Button, Divider, InlineStack, Text } from '@shopify/polaris'
import { XIcon } from '@shopify/polaris-icons'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ISubInspector {
  /**
   * The title displayed at the top of the panel.
   */
  title: string

  /**
   * A boolean indicating whether the drawer is open (`true`) or closed (`false`).
   * Controls the visibility and opacity of the drawer.
   */
  isOpen: boolean

  /**
   * The content to be displayed inside the panel.
   */
  children: ReactNode

  /**
   * The primary action button, rendered at the bottom of the panel.
   * Contains:
   * - `action`: The text to be displayed on the button.
   * - `onAction`: A function that gets executed when the button is clicked.
   * - `disabled`: Disabled button.
   */
  primaryAction?: { action: string | string[]; onAction: () => void; disabled?: boolean }

  /**
   * The secondary action button, rendered at the bottom of the panel.
   * Contains:
   * - `action`: The text to be displayed on the button.
   * - `onAction`: A function that gets executed when the button is clicked.
   */
  secondaryAction?: { action: string | string[]; onAction: () => void }

  /**
   * A function that gets called to close Modal
   */
  onClose: () => void

  /**
   * The id of the wrapper element where the panel should be rendered using `createPortal`.
   */
  wrapperAttr?: string

  /**
   * The styles for the panel
   */
  styles?: CSSProperties
}

export const SubInspector = (props: ISubInspector) => {
  const {
    title,
    isOpen,
    primaryAction,
    secondaryAction,
    children,
    onClose,
    // Default to inner content column so LayerToolbar (left rail) stays visible when SubInspector opens.
    wrapperAttr = '.template-inspector-content',
    ...restProps
  } = props

  // Intelligent portal target detection with fallback hierarchy
  // 1. First check for desktop inspector content column (.template-inspector-content)
  // 2. If not found, check for mobile inspector container (#mobile-inspector-container)
  // 3. Finally fallback to document.body
  const inspectorContainer = typeof document !== 'undefined' ? document.querySelector(wrapperAttr) : null
  const mobileContainer
    = !inspectorContainer && typeof document !== 'undefined'
      ? document.querySelector('#mobile-inspector-container')
      : null

  const portalTarget = (inspectorContainer || mobileContainer || document.body) as Element

  if (!isOpen) {
    return null
  }

  return createPortal(
    <div
      id="sub-inspector-container"
      style={{
        height: '100%',
        position: inspectorContainer || mobileContainer ? 'absolute' : 'fixed',
        zIndex: '510',
        opacity: '1',
        transition: 'all .1s',
        visibility: 'visible',
        inset: 0,
        background: 'var(--p-color-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...restProps.styles,
      }}
    >
      {/* Sticky Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          background: 'var(--p-color-bg-surface)',
        }}
      >
        <BlockStack>
          <div
            style={{
              height: '48px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0px 12px',
            }}
          >
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="bodyMd" as="p" fontWeight="semibold">
                {title}
              </Text>
              <Button icon={XIcon} onClick={onClose} variant="tertiary" />
            </InlineStack>
          </div>
          <Divider />
        </BlockStack>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>

      {/* Sticky Footer */}
      {primaryAction || secondaryAction ? (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 1,
            background: 'var(--p-color-bg-surface)',
          }}
        >
          <BlockStack>
            <Divider />
            <Box padding={'300'}>
              <InlineStack align="end" gap={'200'}>
                {secondaryAction && (
                  <Button id={secondaryAction.action.toString().toLowerCase()} onClick={secondaryAction.onAction}>
                    {secondaryAction.action}
                  </Button>
                )}
                {primaryAction && (
                  <Button
                    id={primaryAction.action.toString().toLowerCase()}
                    variant="primary"
                    onClick={primaryAction.onAction}
                    disabled={primaryAction.disabled}
                  >
                    {primaryAction.action}
                  </Button>
                )}
              </InlineStack>
            </Box>
          </BlockStack>
        </div>
      ) : null}
    </div>,
    portalTarget
  )
}
