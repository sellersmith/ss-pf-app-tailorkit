import type { ReactNode } from 'react'
import styles from '../panels/styles.module.css'

interface ToolPanelWrapperProps {
  /**
   * Optional sticky header content (search, filters, etc.)
   * This will stick to the top when scrolling
   */
  header?: ReactNode
  /**
   * Main scrollable content
   */
  children: ReactNode
  /**
   * Optional custom className for the content area
   */
  contentClassName?: string
}

/**
 * Reusable wrapper for tool sidebar panels
 *
 * This component ensures consistent scrolling behavior across all panels.
 * The parent ToolSidebar container handles the actual scrolling,
 * so this wrapper just provides proper layout structure.
 *
 * @example
 * // Simple panel without sticky header
 * <ToolPanelWrapper>
 *   <YourPanelContent />
 * </ToolPanelWrapper>
 *
 * @example
 * // Panel with sticky header (search, tabs, etc.)
 * <ToolPanelWrapper
 *   header={
 *     <>
 *       <SearchField />
 *       <TabButtons />
 *     </>
 *   }
 * >
 *   <YourScrollableContent />
 * </ToolPanelWrapper>
 */
export function ToolPanelWrapper({ header, children, contentClassName }: ToolPanelWrapperProps) {
  // If no header, just render children directly (parent handles scroll)
  if (!header) {
    return <div className={styles.panelContainer}>{children}</div>
  }

  // With header: use panelContainer layout with sticky header
  return (
    <div className={styles.panelContainer}>
      <div className={styles.stickyHeader}>{header}</div>
      <div className={contentClassName || ''}>{children}</div>
    </div>
  )
}
