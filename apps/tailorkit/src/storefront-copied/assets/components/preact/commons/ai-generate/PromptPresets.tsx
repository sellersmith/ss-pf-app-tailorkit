/** @jsxImportSource preact */
import { APP_PROXY_PATH } from '../../../../constants'
import { translate } from '../../../../libraries/translation'
import { STORE_FRONT_ACTION } from '../../../../constants/app-actions'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import Tooltip from '../../../commons/tooltip'
import GridCarousel from '../grid-carousel'

// Helper function to track storefront events via app proxy
const trackStorefrontEvent = (eventName: string, properties: Record<string, any>) => {
  const formData = new FormData()
  formData.append('action', STORE_FRONT_ACTION.TRACK_EVENT)
  formData.append('eventName', eventName)
  formData.append('properties', JSON.stringify(properties))

  fetch(`${APP_PROXY_PATH}/app_proxy/storefront`, {
    method: 'POST',
    body: formData,
  }).catch(console.error)
}

// Get global session ID from TailorKit personalization session
const getGlobalSessionId = () => (window as any).TailorKitPersonalizationSession?.sessionId || ''

export interface PromptPresetItem {
  name: string
  type: string
  thumbnail: string[]
  description?: unknown
  instruction: string
}

interface PromptPresetsProps {
  type?: string
  label?: string
  layout?: string
  viewAll?: boolean
  multiple?: boolean
  showLabel?: boolean
  itemsPerRow?: number
  selected?: string | string[]
  toggleThumbnailOnMouseOver?: boolean
  filterItems?: (items: PromptPresetItem[]) => PromptPresetItem[]
  onSelect?: (itemName: string[], instruction?: string[]) => void
}

const PromptPresets = ({
  label,
  viewAll,
  onSelect,
  selected,
  filterItems,
  layout = 'grid',
  itemsPerRow = 3,
  multiple = false,
  showLabel = true,
  type = 'quick_prompt',
  toggleThumbnailOnMouseOver = true,
}: PromptPresetsProps) => {
  // Session ID for correlating view/select events (use global session from customizer)
  const sessionId = getGlobalSessionId()
  const viewTrackedRef = useRef(false)
  const itemsLoadedTimeRef = useRef(0)

  const [showAll, setShowAll] = useState(viewAll)
  const [isLoading, setIsLoading] = useState(true)
  const [presets, setPresets] = useState<PromptPresetItem[]>([])
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<string[]>(
    Array.isArray(selected) ? selected : selected ? [selected] : []
  )
  const tooltipRefs = useRef<Map<string, Tooltip>>(new Map())

  const labels: Record<string, string> = useMemo(
    () => ({
      quick_prompt: translate('quick-prompt', 'Quick prompt'),
      template_type: translate('template-type', 'Template type'),
      visual_style: translate('visual-style', 'Visual style'),
      content_theme: translate('content-theme', 'Content theme'),
    }),
    []
  )

  const fetchPresets = useCallback(async () => {
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('action', STORE_FRONT_ACTION.GET_PROMPT_PRESETS)
      formData.append('type', type)

      const response = await fetch(`${APP_PROXY_PATH}/app_proxy/storefront`, {
        method: 'POST',
        body: formData,
      })

      const json = await response.json().catch(() => ({}))

      if (json?.data) {
        const items = filterItems ? filterItems(json.data || []) : json.data || []
        setPresets(items)

        // Auto-select first item when no selection exists
        if (items.length > 0) {
          const firstPreset = items[0]
          const newSelection = [firstPreset.name]
          setSelectedPreset(newSelection)

          if (onSelect) {
            const instructions = [firstPreset.description || firstPreset.instruction]
            onSelect(newSelection, instructions as string[])
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch prompt presets:', error)
    } finally {
      setIsLoading(false)
    }
  }, [filterItems, type, onSelect])

  useEffect(() => {
    fetchPresets()
  }, [fetchPresets])

  useEffect(() => {
    if (onSelect && selected !== undefined) {
      setSelectedPreset(Array.isArray(selected) ? selected : selected ? [selected] : [])
    }
  }, [onSelect, selected, multiple])

  const handleItemClick = useCallback(
    (itemName: string, index?: number) => {
      let newSelection: string[]
      const isCurrentlySelected = selectedPreset.includes(itemName)
      const preset = presets.find(p => p.name === itemName)

      if (isCurrentlySelected) {
        // Remove from selection
        newSelection = selectedPreset.filter(name => name !== itemName)
      } else {
        // Add to selection - track the selection
        newSelection = multiple ? [...selectedPreset, itemName] : [itemName]

        // Track quick prompt selection (storefront)
        try {
          const timeToSelectSeconds = itemsLoadedTimeRef.current
            ? Math.round((Date.now() - itemsLoadedTimeRef.current) / 1000)
            : undefined

          const selectEventProps = {
            prompt_name: itemName,
            prompt_alias: (preset as any)?.alias || '',
            prompt_type: type,
            source_component: `storefront_prompt_presets_${layout}`,
            session_id: sessionId,
            selection_position: index ?? 0,
            ...(timeToSelectSeconds !== undefined && {
              time_to_select_seconds: timeToSelectSeconds,
            }),
          }
          trackStorefrontEvent('storefront_quick_prompt_select', selectEventProps)
        } catch (e) {
          console.error('[TK Analytics] Failed to track storefront_quick_prompt_select', e)
        }
      }

      if (onSelect) {
        const instructions = newSelection.map(name => {
          const p = presets.find(pr => pr.name === name)
          return p?.description || p?.instruction
        })

        onSelect(newSelection, instructions as string[])
      }

      setSelectedPreset(newSelection)
    },
    [onSelect, presets, multiple, selectedPreset, type, layout, sessionId]
  )

  // Track quick prompt view when presets are loaded (storefront)
  useEffect(() => {
    if (!isLoading && presets.length > 0 && !viewTrackedRef.current) {
      viewTrackedRef.current = true
      itemsLoadedTimeRef.current = Date.now()

      try {
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const viewEventProps = {
          prompt_type: type,
          prompt_count: presets.length,
          source_component: `storefront_prompt_presets_${layout}`,
          batch_id: batchId,
          session_id: sessionId,
        }
        trackStorefrontEvent('storefront_quick_prompt_view', viewEventProps)
      } catch (e) {
        console.error('[TK Analytics] Failed to track storefront_quick_prompt_view', e)
      }
    }
  }, [isLoading, presets, type, layout, sessionId])

  const handleToggleView = useCallback(() => {
    setShowAll(prev => !prev)
  }, [])

  const handleMouseEnter = useCallback(
    (itemName: string) => {
      if (toggleThumbnailOnMouseOver) {
        setHoveredItem(itemName)
      }
    },
    [toggleThumbnailOnMouseOver]
  )

  const handleMouseLeave = useCallback(() => {
    if (toggleThumbnailOnMouseOver) {
      setHoveredItem(null)
    }
  }, [toggleThumbnailOnMouseOver])

  // Tooltip ref callback - attaches tooltip to element
  const attachTooltip = useCallback((element: HTMLElement | null, name: string) => {
    if (!element) return

    // Destroy existing tooltip if any
    const existing = tooltipRefs.current.get(name)
    if (existing) {
      existing.destroy()
    }

    // Create new tooltip
    const tooltip = new Tooltip(element, {
      content: name,
      position: 'top',
      delay: 200,
    })
    tooltipRefs.current.set(name, tooltip)
  }, [])

  // Cleanup tooltips on unmount
  useEffect(() => {
    const tooltips = tooltipRefs.current
    return () => {
      tooltips.forEach(tooltip => tooltip.destroy())
      tooltips.clear()
    }
  }, [])

  const getThumbnailUrl = useCallback(
    (item: PromptPresetItem) => {
      const firstThumbnail = item.thumbnail?.[0]
      if (!firstThumbnail?.startsWith('https://')) {
        return null
      }

      if (!toggleThumbnailOnMouseOver || !item.thumbnail?.length) {
        return `${firstThumbnail}${firstThumbnail.indexOf('?') > -1 ? '&' : '?'}width=240`
      }

      const isHovered = hoveredItem === item.name
      const thumbnailIndex = isHovered && item.thumbnail?.length > 1 ? 1 : 0
      const selectedThumbnail = item.thumbnail[thumbnailIndex] || firstThumbnail

      return `${selectedThumbnail}${selectedThumbnail.indexOf('?') > -1 ? '&' : '?'}width=240`
    },
    [toggleThumbnailOnMouseOver, hoveredItem]
  )

  // Prepare items
  const hasMoreItems = !viewAll && presets?.length > itemsPerRow
  const displayedPresets
    = viewAll || !hasMoreItems || showAll
      ? presets
      : presets.slice(0, Math.max(1, itemsPerRow - (['grid', 'carousel'].includes(layout) ? 1 : 0)))

  // Prepare content
  let content = null

  if (isLoading) {
    // Generate skeleton
    switch (layout) {
      case 'inline': {
        content = (
          <div
            className="emtlkit--prompt-presets-inline"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center',
              minHeight: '20px',
            }}
          >
            {Array(itemsPerRow)
              .fill(null)
              .map((_, index) => (
                <span
                  key={index}
                  className="emtlkit--prompt-preset-skeleton-tag"
                  style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    minWidth: '60px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: '#f6f6f7',
                    fontSize: '12px',
                    lineHeight: '16px',
                    color: 'transparent',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Loading...
                </span>
              ))}
          </div>
        )
        break
      }

      case 'list': {
        content = (
          <div className="emtlkit--prompt-presets-list">
            {Array(itemsPerRow)
              .fill(null)
              .map((_, index) => (
                <div
                  key={index}
                  className="emtlkit--prompt-preset-card"
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    className="emtlkit--prompt-preset-list-skeleton"
                    style={{ display: 'flex', alignItems: 'flex-start' }}
                  >
                    <div
                      className="emtlkit--prompt-preset-skeleton-checkbox"
                      style={{
                        width: '16px',
                        height: '16px',
                        background: '#f6f6f7',
                        borderRadius: '4px',
                        marginRight: '12px',
                      }}
                    />
                    <div className="emtlkit--prompt-preset-skeleton-content" style={{ flex: 1 }}>
                      <div
                        className="emtlkit--prompt-preset-skeleton-title"
                        style={{
                          height: '16px',
                          background: '#f6f6f7',
                          borderRadius: '4px',
                          marginBottom: '8px',
                          width: '60%',
                        }}
                      />
                      <div
                        className="emtlkit--prompt-preset-skeleton-description"
                        style={{
                          height: '20px',
                          background: '#f6f6f7',
                          borderRadius: '4px',
                          width: '80%',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )
        break
      }

      case 'carousel': {
        content = (
          <GridCarousel gap="0.5rem" showDots={true} itemsPerSlide={itemsPerRow}>
            {Array(3)
              .fill(null)
              .map((_, index) => (
                <div
                  key={index}
                  className="emtlkit--carousel__item emtlkit--prompt-preset-item emtlkit--prompt-preset-skeleton"
                  style={{
                    width: '100%',
                    height: '90px',
                    background: '#f6f6f7',
                    borderRadius: '8px',
                    minWidth: '80px',
                    display: 'block',
                  }}
                />
              ))}
          </GridCarousel>
        )
        break
      }

      default: {
        content = (
          <div className="emtlkit--prompt-presets-container">
            <div
              className="emtlkit--prompt-presets-grid"
              style={{ gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)` }}
            >
              {Array(itemsPerRow)
                .fill(null)
                .map((_, index) => (
                  <div
                    key={index}
                    className="emtlkit--prompt-preset-item emtlkit--prompt-preset-skeleton"
                    style={{
                      width: '100%',
                      height: '90px',
                      background: '#f6f6f7',
                      borderRadius: '8px',
                      minWidth: '80px',
                      display: 'block',
                    }}
                  ></div>
                ))}
            </div>
          </div>
        )
      }
    }
  } else if (presets?.length) {
    // Generate content
    switch (layout) {
      case 'inline': {
        content = (
          <div className="emtlkit--quick-prompt-container">
            {displayedPresets.map((preset, index) => {
              const isSelected = Array.isArray(selectedPreset) && selectedPreset.includes(preset.name)
              return (
                <button
                  key={preset.name}
                  onClick={() => handleItemClick(preset.name, index)}
                  className={`emtlkit--quick-prompt-button ${isSelected ? 'selected' : ''}`}
                >
                  {preset.name}
                </button>
              )
            })}

            {hasMoreItems && (
              <button
                onClick={handleToggleView}
                className={`emtlkit--item-list-show-all-button emtlkit-button-can-open ${showAll ? 'up' : 'down'}`}
              >
                {showAll ? translate('view-less', 'View less') : translate('view-more', 'View more')}
              </button>
            )}
          </div>
        )
        break
      }

      case 'list': {
        content = (
          <div className="emtlkit--prompt-presets-list">
            {displayedPresets.map((preset, index) => {
              const isSelected = Array.isArray(selectedPreset) && selectedPreset.includes(preset.name)

              return (
                <div
                  key={preset.name}
                  className="emtlkit--prompt-preset-card"
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div
                    className="emtlkit--prompt-preset-list-item"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}
                  >
                    <input
                      type="checkbox"
                      name={type}
                      value={preset.name}
                      checked={isSelected}
                      onChange={e => {
                        e.stopPropagation()
                        handleItemClick(preset.name, index)
                      }}
                    />
                    <div className="emtlkit--prompt-preset-list-content" style={{ flex: 1 }}>
                      <div
                        className="emtlkit--prompt-preset-list-label"
                        style={{ fontWeight: '600', marginBottom: '4px' }}
                      >
                        {preset.name}
                      </div>
                      {preset.instruction && (
                        <div
                          className="emtlkit--prompt-preset-list-instruction"
                          style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.4' }}
                        >
                          {preset.instruction}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {hasMoreItems && (
              <div className="emtlkit--prompt-preset-list-view-more">
                <button
                  onClick={handleToggleView}
                  className={`emtlkit--item-list-show-all-button emtlkit-button-can-open ${showAll ? 'up' : 'down'}`}
                >
                  {showAll ? translate('view-less', 'View less') : translate('view-more', 'View more')}
                </button>
              </div>
            )}
          </div>
        )
        break
      }

      case 'carousel': {
        content = (
          <GridCarousel gap="0.5rem" showDots={true} itemsPerSlide={itemsPerRow}>
            {displayedPresets.map((preset, index) => {
              const thumbnailUrl = getThumbnailUrl(preset)
              const isHovered = hoveredItem === preset.name
              const isSelected = Array.isArray(selectedPreset) && selectedPreset.includes(preset.name)

              return (
                <div
                  key={preset.name}
                  ref={el => attachTooltip(el, preset.name)}
                  style={{ height: '100%' }}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleItemClick(preset.name, index)}
                  onMouseEnter={() => handleMouseEnter(preset.name)}
                  className={`emtlkit--carousel__item emtlkit--prompt-preset-item ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                >
                  <div className="emtlkit--prompt-preset-content">
                    {thumbnailUrl && (
                      <img alt={preset.name} src={thumbnailUrl} className="emtlkit--prompt-preset-thumbnail" />
                    )}
                  </div>
                  <div className="emtlkit--prompt-preset-checkbox">
                    <input
                      {...(isSelected
                        ? {
                            style: {
                              accentColor: 'var(--emtlkit-option-border-active-color)',
                            },
                          }
                        : {})}
                      type="checkbox"
                      name={type}
                      value={preset.name}
                      checked={isSelected}
                    />
                  </div>
                </div>
              )
            })}
            {hasMoreItems && (
              <div className="emtlkit--prompt-preset-item emtlkit--prompt-preset-view-more">
                <button
                  onClick={handleToggleView}
                  className={`emtlkit--item-list-show-all-button emtlkit-button-can-open ${showAll ? 'up' : 'down'}`}
                >
                  {showAll ? translate('view-less', 'View less') : translate('view-more', 'View more')}
                </button>
              </div>
            )}
          </GridCarousel>
        )
        break
      }

      default: {
        content = (
          <div className="emtlkit--prompt-presets-container">
            <div
              className="emtlkit--prompt-presets-grid"
              style={{ gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)` }}
            >
              {displayedPresets.map((preset, index) => {
                const thumbnailUrl = getThumbnailUrl(preset)
                const isHovered = hoveredItem === preset.name
                const isSelected = Array.isArray(selectedPreset) && selectedPreset.includes(preset.name)

                return (
                  <div
                    key={preset.name}
                    ref={el => attachTooltip(el, preset.name)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleItemClick(preset.name, index)}
                    onMouseEnter={() => handleMouseEnter(preset.name)}
                    className={`emtlkit--prompt-preset-item ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                  >
                    <div className="emtlkit--prompt-preset-content">
                      {thumbnailUrl && (
                        <img alt={preset.name} src={thumbnailUrl} className="emtlkit--prompt-preset-thumbnail" />
                      )}
                    </div>
                    <div className="emtlkit--prompt-preset-checkbox">
                      <input type="checkbox" name={type} value={preset.name} checked={isSelected} />
                    </div>
                  </div>
                )
              })}

              {hasMoreItems && (
                <div className="emtlkit--prompt-preset-item emtlkit--prompt-preset-view-more">
                  <button
                    onClick={handleToggleView}
                    className={`emtlkit--item-list-show-all-button emtlkit-button-can-open ${showAll ? 'up' : 'down'}`}
                  >
                    {showAll ? translate('view-less', 'View less') : translate('view-more', 'View more')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }
    }
  } else {
    // Generate empty message
    content = (
      <div className="emtlkit--prompt-presets-empty">
        <span>{translate('no-presets-found-for-this-type', 'No presets found for this type')}</span>
      </div>
    )
  }

  return (
    <div className="emtlkit--prompt-presets">
      {showLabel && <div className="emtlkit--prompt-presets-label">{label || labels[type]}</div>}
      {content}
      <input type="hidden" name={`selected-${type}`} value={selectedPreset[0]} />
    </div>
  )
}

export default PromptPresets
