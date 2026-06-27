import React, { useCallback, useRef, useMemo, Fragment, useState, useEffect } from 'react'
import { Popover, Button, Tooltip } from '@shopify/polaris'
import { MentionIcon } from '@shopify/polaris-icons'
import type { TemplateMentionData } from '~/hooks/useTemplateMention'
import { useTranslation } from 'react-i18next'
import { useMentionManager } from '~/components/common/Mention/useMentionManager'
import InternalMentionCardUI from './InternalMentionCard'

interface BaseMentionItem {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
}

interface MentionSource<T extends BaseMentionItem = BaseMentionItem> {
  type: 'categories' | 'custom'
  items: T[]
  onItemSelect?: (item: T) => void
  onSearch?: (query: string) => Promise<T[]> | T[]
  renderItem?: (item: T) => React.ReactNode
  searchPlaceholder?: string
  emptyMessage?: string
  allowMultiple?: boolean
}

// Generic interface for any input component that can work with mentions
interface InputComponentProps {
  value: string
  onChange: (value: string) => void
}

// Configuration options for the HOC
interface WithMentionOptions<T extends BaseMentionItem = BaseMentionItem> {
  // Trigger characters (default: ['@'])
  triggers?: string[]
  // Custom mention component (default: MentionCard)
  MentionComponent?: React.ComponentType<MentionComponentProps>
  // Position strategy
  position?: 'absolute' | 'relative' | 'fixed'
  // Z-index for popover
  zIndex?: number
  // Custom trigger detection logic
  shouldShowMention?: (value: string, triggers: string[]) => boolean
  // Custom cleanup logic after selection
  cleanupInput?: (value: string, trigger: string) => string
  // Whether to show mention icon button (default: true)
  showMentionButton?: boolean
  // Custom mention button renderer
  renderMentionButton?: (onClick: () => void, disabled: boolean, isActive: boolean) => React.ReactNode
  // Mention data sources configuration
  mentionSources?: MentionSource<T>[]
  // Mode: 'categories' (default Sidekick-like), 'direct' (show sources directly), or 'templates' (TailorKit - go directly to templates)
  mode?: 'categories' | 'direct' | 'templates'
  // Default allow multiple behavior for built-in templates (backward compatibility)
  defaultAllowMultiple?: boolean
  // Whether to hide the mention card (default: false)
  hidden?: boolean
}

// Props that the mention component should accept
interface MentionComponentProps {
  onTemplateSelect?: (template: TemplateMentionData, allowMultiple?: boolean) => void
  onLayerSelect?: (layer: LayerItem, template: TemplateMentionData) => void
  activator?: React.ReactNode
  isOpen?: boolean
  onToggle?: (isOpen: boolean) => void
  onClose?: () => void
  mentionSources?: MentionSource[]
  mode?: 'categories' | 'direct' | 'templates'
  defaultAllowMultiple?: boolean
}

// Props injected by the HOC
interface WithMentionInjectedProps {
  onTemplateSelect?: (template: TemplateMentionData, allowMultiple?: boolean) => void
  onLayerSelect?: (payload: { layerId: string; layerName: string; templateId: string; cardId: string }) => void
  mentionOptions?: WithMentionOptions
  // Injected mention button for action fields
  mentionButton?: React.ReactNode
}

// Default implementations
const defaultShouldShowMention = (value: string, triggers: string[]): boolean => {
  return triggers.some(trigger => value.endsWith(trigger))
}

const defaultCleanupInput = (value: string, trigger: string): string => {
  return value.endsWith(trigger) ? value.slice(0, -trigger.length) : value
}

// Internal MentionCard component (merged from separate file)
interface LayerItem {
  id: string
  label: string
  type?: string
}

/**
 * Higher-Order Component that adds mention functionality to any input component
 *
 * @template P - Props type of the wrapped component
 * @param WrappedComponent - Component to enhance with mention functionality
 * @param defaultOptions - Default configuration options
 */
export function withMentionCard<P extends InputComponentProps>(
  WrappedComponent: React.ComponentType<P>,
  defaultOptions: WithMentionOptions = {}
) {
  const WithMentionComponent = React.forwardRef<any, P & WithMentionInjectedProps>((props, ref) => {
    const { onTemplateSelect, onLayerSelect, mentionOptions = {}, value, onChange, ...restProps } = props

    // Get current conversation for mention button state
    const { t } = useTranslation()

    // Merge options with defaults (memoized for performance)
    const options: Required<WithMentionOptions> = useMemo(
      () => ({
        triggers: ['@'],
        MentionComponent: InternalMentionCardUI,
        position: 'relative',
        zIndex: 6000,
        shouldShowMention: defaultShouldShowMention,
        cleanupInput: defaultCleanupInput,
        showMentionButton: true,
        renderMentionButton: (onClick: () => void, disabled: boolean, isActive: boolean) => (
          <Fragment>
            {options.hidden ? (
              <Fragment />
            ) : (
              <Tooltip zIndexOverride={569} content={t('mention')}>
                <Button
                  variant="monochromePlain"
                  icon={MentionIcon}
                  onClick={(e?: any) => {
                    e?.stopPropagation()
                    onClick()
                  }}
                  disabled={disabled}
                  pressed={isActive}
                />
              </Tooltip>
            )}
          </Fragment>
        ),
        mentionSources: [],
        mode: 'templates', // TailorKit default: go directly to templates
        defaultAllowMultiple: false, // Single selection only per requirements
        ...defaultOptions,
        ...mentionOptions,
        // Ensure a concrete boolean for Required<WithMentionOptions>["hidden"]
        hidden: mentionOptions.hidden ?? defaultOptions.hidden ?? false,
      }),
      [mentionOptions, t]
    )

    const manager = useMentionManager({ triggers: options.triggers })
    const activeType = useRef<'trigger' | 'manual' | null>(null)
    const [contentReady, setContentReady] = useState<boolean>(false)

    // Enhanced onChange handler
    const enhancedOnChange = useCallback(
      (newValue: string) => {
        manager.onChangeWrapper(newValue, onChange)
      },
      [onChange, manager]
    )

    // Handle template selection
    const handleTemplateSelect = useCallback(
      (template: TemplateMentionData, allowMultiple?: boolean) => {
        // Clean up input if triggered by typing trigger characters (not manual button click)
        if (activeType.current === 'trigger') {
          const cleanedValue = manager.cleanup(value)
          onChange(cleanedValue)
        }
        // Note: Don't clean input when triggered by manual button click (activeType === 'manual')

        // Call original handler with allowMultiple information
        if (onTemplateSelect) {
          onTemplateSelect(template, allowMultiple)
        }

        // Keep popover open and move to layers view is handled inside InternalMentionCard
      },
      [value, onChange, onTemplateSelect, manager]
    )

    const handleLayerSelect = useCallback(
      (layer: { id: string; label: string }, template: TemplateMentionData) => {
        // Do NOT insert any text into input; only attach selection metadata
        const ctxBefore = manager.getContext()
        if (ctxBefore) {
          // Remove the trigger and query text (e.g., "@abc")
          const cleaned = manager.cleanup(value)
          onChange(cleaned)
          // Place caret at trigger start position
          manager.setNextCursorPosition(ctxBefore.triggerIndex)
        } else {
          // Fallback: remove the last '@' if context is missing
          const lastAt = value.lastIndexOf('@')
          if (lastAt !== -1) {
            const cleaned = value.slice(0, lastAt) + value.slice(lastAt + 1)
            onChange(cleaned)
            manager.setNextCursorPosition(lastAt)
          }
        }

        // propagate selected template (single selection only)
        onTemplateSelect?.(template, false)

        // bubble layer selection for request payload
        onLayerSelect?.({
          layerId: layer.id,
          layerName: layer.label,
          templateId: template.templateId,
          cardId: template.cardId,
        })

        // Close popover and restore caret
        manager.close()
        activeType.current = null
        setTimeout(manager.restoreCursor, 0)
      },
      [manager, onTemplateSelect, onLayerSelect, onChange, value]
    )

    // Handle mention button click (toggle behavior)
    const handleMentionButtonClick = useCallback(() => {
      if (manager.isOpen && activeType.current === 'manual') {
        manager.close()
        activeType.current = null
        // Restore focus and cursor position after closing
        setTimeout(manager.restoreCursor, 0)
      } else {
        // Save cursor position before opening
        manager.saveCursor(value.length)
        // Defer opening to next frame to avoid blocking click cycle
        requestAnimationFrame(() => {
          manager.open()
          activeType.current = 'manual'
        })
      }
    }, [manager, value.length])

    // Close handler
    const handleClose = useCallback(() => {
      manager.close()
      activeType.current = null
      // Restore focus and cursor position when closing
      setTimeout(manager.restoreCursor, 0)
    }, [manager])

    // Create mention button
    const mentionButton = useMemo(() => {
      if (!options.showMentionButton) return null

      const isButtonTriggered = manager.isOpen && activeType.current === 'manual'

      return options.renderMentionButton(handleMentionButtonClick, false, isButtonTriggered)
    }, [options, handleMentionButtonClick, manager.isOpen])

    // Defer heavy content mount by one frame after popover becomes open
    useEffect(() => {
      if (manager.isOpen) {
        setContentReady(false)
        const raf = requestAnimationFrame(() => setContentReady(true))
        return () => cancelAnimationFrame(raf)
      }
      setContentReady(false)
      return
    }, [manager.isOpen])

    if (options.hidden) {
      return (
        <WrappedComponent
          {...(restProps as unknown as P)}
          ref={ref}
          value={value}
          onChange={enhancedOnChange}
          mentionButton={mentionButton}
        />
      )
    }

    // Create activator element for the popover
    const activatorElement = (
      <div
        {...manager.getActivatorProps({
          position: options.position,
        })}
      >
        <WrappedComponent
          {...(restProps as unknown as P)}
          ref={ref}
          value={value}
          onChange={enhancedOnChange}
          mentionButton={mentionButton}
        />
      </div>
    )

    const { MentionComponent } = options

    return manager.isOpen ? (
      <Popover
        activator={activatorElement}
        active={manager.isOpen}
        onClose={handleClose}
        preferInputActivator={true}
        zIndexOverride={options.zIndex}
        // portalled
        activatorWrapper="div"
        fullWidth
      >
        <Popover.Pane>
          {contentReady ? (
            <MentionComponent
              onTemplateSelect={handleTemplateSelect}
              onLayerSelect={handleLayerSelect}
              onClose={handleClose}
              mentionSources={options.mentionSources}
              mode={options.mode}
              defaultAllowMultiple={options.defaultAllowMultiple}
            />
          ) : (
            <Fragment />
          )}
        </Popover.Pane>
      </Popover>
    ) : (
      activatorElement
    )
  })

  WithMentionComponent.displayName = `withMentionCard(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`

  return WithMentionComponent
}

// Utility function to create mention-enabled components with pre-configured options
export function createMentionComponent<P extends InputComponentProps>(
  Component: React.ComponentType<P>,
  options?: WithMentionOptions
) {
  return withMentionCard(Component, options)
}

// Export types for consumers
export type { WithMentionOptions, MentionComponentProps, WithMentionInjectedProps }
