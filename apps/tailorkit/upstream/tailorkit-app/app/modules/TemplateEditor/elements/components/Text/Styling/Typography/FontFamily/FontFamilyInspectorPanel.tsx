import {
  Bleed,
  BlockStack,
  Box,
  Button,
  Divider,
  EmptySearchResult,
  Icon,
  InlineStack,
  Select,
  Spinner,
  Text,
  TextField,
  Tooltip,
} from '@shopify/polaris'
import { InfoIcon, SearchIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { FONT_KIND, useFonts } from '~/modules/TemplateEditor/elements/hooks/useQueryFonts'
import { useDebounce } from '~/utils/hooks/useDebounce'
import { useModal } from '~/utils/hooks/useModal'
import type TemplateElement from '../../../..'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { FILE_UPLOAD_EVENTS } from '~/modules/TemplateEditor/constants'
import { GoogleFontsFilters } from '~/components/GoogleFontsFilters/GoogleFontsFilters'
import type { GoogleFontsFiltersValue } from '~/components/GoogleFontsFilters/GoogleFontsFilters'
import styles from './FontFamilyInspectorPanel.module.css'
import { Accordion } from '~/components/Accordion'
import type { TLayerStore } from '~/stores/modules/layer'

interface FontFamilyPanelProps {
  element?: TemplateElement<any, any>
  clickedLayerStore?: TLayerStore | null
  t?: (key: string) => string
  // Legacy props for backward compatibility
  fontFamily?: { family: string; src: string }
  onChangeFontFamily?: (args: { family: string; src: string }) => void
}

export function FontFamilyInspectorPanel(props: FontFamilyPanelProps) {
  // Handle both new panel format and legacy format
  const { element, clickedLayerStore } = props
  const { t, i18n } = useTranslation()

  // Determine target layer store (for nested elements in multi-layout)
  const targetLayerStore = useMemo(() => {
    if (clickedLayerStore && element && clickedLayerStore.getState()._id !== element.state._id) {
      return clickedLayerStore
    }
    return element?.props.layerStore
  }, [clickedLayerStore, element])

  const fontFamily = useMemo(
    () => props.fontFamily || targetLayerStore?.getState()?.settings?.fontFamily || { family: 'Arial', src: '' },
    [props.fontFamily, targetLayerStore]
  )

  const onChangeFontFamily = useCallback(
    (args: { family: string; src: string }) => {
      if (!targetLayerStore) return

      const currentSettings = targetLayerStore.getState().settings || {}
      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...currentSettings,
              fontFamily: args,
            },
          },
        },
      })
      element?.updateTransformer()
    },
    [targetLayerStore, element]
  )

  const [queryString, setQueryString] = useState('')
  const [loading, setLoading] = useState(false)

  // Initialize from saved layer data
  const savedPreferences = targetLayerStore?.getState()?.settings?.metadata?.fontFilterPreferences
  const [fontKind, setFontKind] = useState(savedPreferences?.fontKind || FONT_KIND.GOOGLE_FONTS)
  const [selectedFamily, setSelectedFamily] = useState(fontFamily.family)
  const [googleFontsFilters, setGoogleFontsFilters] = useState<GoogleFontsFiltersValue>({
    styleTagPaths: savedPreferences?.googleFontsFilters?.styleTagPaths || [],
    languageIds: savedPreferences?.googleFontsFilters?.languageIds || [],
    subsetKeys: savedPreferences?.googleFontsFilters?.subsetKeys || [],
  })
  const timeoutIdRef = useRef<NodeJS.Timeout>()
  const { openModal } = useModal()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Hover preview state
  const [isHovering, setIsHovering] = useState(false)
  const hoveringFontRef = useRef<string | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout>()
  const hoverOutTimeoutRef = useRef<NodeJS.Timeout>()

  // Track if any filter popover is active (disable hover preview when filtering)
  const [isFilterPopoverActive, setIsFilterPopoverActive] = useState(false)

  /**
   * Debounced hover-out handler - clear preview font after delay
   * Debouncing prevents clearing preview when moving between fonts
   * Only clears if no new hover starts within the delay period
   */
  const handleFontHoverOut = useCallback(() => {
    // Clear any pending hover timeout first
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = undefined
    }

    // Clear any pending hover-out timeout
    if (hoverOutTimeoutRef.current) {
      clearTimeout(hoverOutTimeoutRef.current)
      hoverOutTimeoutRef.current = undefined
    }

    if (!isHovering) {
      return
    }

    // Debounce the preview clear (50ms) to prevent flash when moving between fonts
    hoverOutTimeoutRef.current = setTimeout(() => {
      // Safety check: verify targetLayerStore still exists before dispatch
      if (!targetLayerStore) {
        return
      }

      setIsHovering(false)
      hoveringFontRef.current = null

      const currentSettings = targetLayerStore.getState().settings || {}

      // Clear _previewFontFamily with skipTrace to avoid polluting undo history
      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...currentSettings,
              _previewFontFamily: undefined,
            },
          },
        },
        skipTrace: true,
      })

      element?.updateTransformer()
    }, 50)
  }, [targetLayerStore, element, isHovering])

  /**
   * Immediate hover-out handler for listbox mouse leave
   * Clears preview immediately when user leaves the font list entirely
   */
  const handleListboxMouseLeave = useCallback(() => {
    // Clear all pending timeouts immediately
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = undefined
    }
    if (hoverOutTimeoutRef.current) {
      clearTimeout(hoverOutTimeoutRef.current)
      hoverOutTimeoutRef.current = undefined
    }

    setIsHovering(false)
    hoveringFontRef.current = null

    // Clear preview font immediately
    if (targetLayerStore) {
      const currentSettings = targetLayerStore.getState().settings || {}

      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...currentSettings,
              _previewFontFamily: undefined,
            },
          },
        },
        skipTrace: true,
      })

      element?.updateTransformer()
    }
  }, [targetLayerStore, element])

  /**
   * Debounced hover handler - preview font on canvas
   * Debouncing prevents excessive state updates during rapid mouse movements
   * and allows fonts to load properly before switching to the next one
   */
  const handleFontHover = useCallback(
    (fontItem: { family: string; src: string } | null) => {
      // Don't show preview when filter popover is active
      if (isFilterPopoverActive || !fontItem || !targetLayerStore) {
        return
      }

      // Skip if already hovering this exact font (deduplication)
      if (hoveringFontRef.current === fontItem.family) {
        return
      }

      // Cancel hover-out timeout IMMEDIATELY to prevent clearing preview
      // This is critical to prevent flash when moving between fonts
      if (hoverOutTimeoutRef.current) {
        clearTimeout(hoverOutTimeoutRef.current)
        hoverOutTimeoutRef.current = undefined
      }

      // Clear any pending hover update
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }

      // Debounce the preview update (50ms) to prevent race conditions
      hoverTimeoutRef.current = setTimeout(() => {
        // Safety check: verify targetLayerStore still exists before dispatch
        if (!targetLayerStore) {
          return
        }

        setIsHovering(true)
        hoveringFontRef.current = fontItem.family

        const currentSettings = targetLayerStore.getState().settings || {}

        // Set preview font in separate field WITHOUT affecting fontFamily
        // This way ToolBar and other UI components won't be affected
        targetLayerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              settings: {
                ...currentSettings,
                _previewFontFamily: fontItem, // Preview only!
                // fontFamily stays unchanged
              },
            },
          },
          skipTrace: true,
        })

        element?.updateTransformer()
      }, 50)
    },
    [targetLayerStore, element, isFilterPopoverActive]
  )

  // Sync local state when switching between layers
  useEffect(() => {
    // Clear all pending timeouts when layer changes
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = undefined
    }
    if (hoverOutTimeoutRef.current) {
      clearTimeout(hoverOutTimeoutRef.current)
      hoverOutTimeoutRef.current = undefined
    }

    // Clear hover state when layer changes
    handleFontHoverOut()

    const savedPreferences = targetLayerStore?.getState()?.settings?.metadata?.fontFilterPreferences
    if (savedPreferences) {
      if (savedPreferences.fontKind) {
        setFontKind(savedPreferences.fontKind)
      }
      if (savedPreferences.googleFontsFilters) {
        setGoogleFontsFilters({
          styleTagPaths: savedPreferences.googleFontsFilters.styleTagPaths || [],
          languageIds: savedPreferences.googleFontsFilters.languageIds || [],
          subsetKeys: savedPreferences.googleFontsFilters.subsetKeys || [],
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLayerStore?.getState()._id]) // Only re-run when layer changes, not when preferences change

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = undefined
      }
      if (hoverOutTimeoutRef.current) {
        clearTimeout(hoverOutTimeoutRef.current)
        hoverOutTimeoutRef.current = undefined
      }
    }
  }, [])

  const onQueryStringChange = useCallback((value: string) => {
    setLoading(true)
    setQueryString(value)
    clearTimeout(timeoutIdRef.current)
    timeoutIdRef.current = setTimeout(() => {
      setLoading(false)
    }, 500)
  }, [])

  const onChangeFontKind = useCallback(
    (value: string) => {
      // Clear hover state when switching font source
      handleFontHoverOut()

      onQueryStringChange('')
      setFontKind(value)

      // Persist to layer metadata
      if (targetLayerStore) {
        const currentSettings = targetLayerStore.getState().settings || {}
        const currentMetadata = currentSettings.metadata || {}
        const currentPreferences = currentMetadata.fontFilterPreferences || {}

        targetLayerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              settings: {
                ...currentSettings,
                metadata: {
                  ...currentMetadata,
                  fontFilterPreferences: {
                    ...currentPreferences,
                    fontKind: value,
                  },
                },
              },
            },
          },
        })
      }
    },
    [onQueryStringChange, targetLayerStore, handleFontHoverOut]
  )

  // Wrapper to persist Google Fonts filters to layer data
  const handleGoogleFontsFiltersChange = useCallback(
    (newFilters: GoogleFontsFiltersValue) => {
      setGoogleFontsFilters(newFilters)

      // Persist to layer metadata
      if (targetLayerStore) {
        const currentSettings = targetLayerStore.getState().settings || {}
        const currentMetadata = currentSettings.metadata || {}
        const currentPreferences = currentMetadata.fontFilterPreferences || {}

        targetLayerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              settings: {
                ...currentSettings,
                metadata: {
                  ...currentMetadata,
                  fontFilterPreferences: {
                    ...currentPreferences,
                    googleFontsFilters: {
                      styleTagPaths: newFilters.styleTagPaths,
                      languageIds: newFilters.languageIds,
                      subsetKeys: newFilters.subsetKeys,
                    },
                  },
                },
              },
            },
          },
        })
      }
    },
    [targetLayerStore]
  )

  // Handle filter popover active state change
  const handleFilterPopoverActiveChange = useCallback(
    (isActive: boolean) => {
      setIsFilterPopoverActive(isActive)
      // Also clear any existing hover preview when popover opens
      if (isActive) {
        // Clear all pending timeouts to prevent late preview application
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current)
          hoverTimeoutRef.current = undefined
        }
        if (hoverOutTimeoutRef.current) {
          clearTimeout(hoverOutTimeoutRef.current)
          hoverOutTimeoutRef.current = undefined
        }

        setIsHovering(false)
        hoveringFontRef.current = null

        // Also clear the preview font from layer state immediately
        if (targetLayerStore) {
          const currentSettings = targetLayerStore.getState().settings || {}

          // Clear _previewFontFamily to restore original font
          targetLayerStore.dispatch({
            type: 'UPDATE_LAYER',
            payload: {
              state: {
                settings: {
                  ...currentSettings,
                  _previewFontFamily: undefined,
                },
              },
            },
            skipTrace: true,
          })

          element?.updateTransformer()
        }
      }
    },
    [targetLayerStore, element]
  )

  const debouncedQueryString = useDebounce(queryString, 200)

  const {
    googleFonts,
    customFonts,
    customFontsFetched,
    googleFontsLoading,
    handleCustomFontsFetchNextPage,
    handleGoogleFontsFetchNextPage,
    customFontsNextPage,
    googleFontsNextPage,
    totalFilteredGoogleFonts,
    fetchCustomFonts,
  } = useFonts(debouncedQueryString, { googleFontsFilters })

  const isCustomFonts = fontKind === FONT_KIND.CUSTOM_FONTS
  const isGoogleFonts = fontKind === FONT_KIND.GOOGLE_FONTS

  const fetchNextPage = useMemo(() => {
    return isGoogleFonts ? googleFontsNextPage : customFontsNextPage
  }, [isGoogleFonts, googleFontsNextPage, customFontsNextPage])

  const isEmptyGoogleFonts = googleFonts.length === 0
  const isInitFetchingGoogleFonts = googleFontsLoading && isEmptyGoogleFonts && !queryString
  // const isEmptyCustomFonts = isCustomFonts && customFonts.length === 0 && !loading && customFontsFetched
  // derived emptiness states (kept for parity, may be used in future UX tweaks)
  // const isEmptyFilterCustomFontsResult = !loading && isEmptyCustomFonts && !!queryString
  // const isEmptyFilterGoogleFontsResult = !loading && isEmptyGoogleFonts && !!queryString

  const loadingState = (
    <Box width="100%" padding={'500'} minHeight="180px">
      <InlineStack align="center">
        <Spinner size="small" />
      </InlineStack>
    </Box>
  )

  const fontOptions = useMemo(() => {
    const fonts = isGoogleFonts ? googleFonts : customFonts
    return fonts.map((font, index) => {
      const { family, nameWithoutExtension, svgString, variants, files, url, _id } = font as typeof font & {
        _id?: string
      }

      const fontFamily = family || nameWithoutExtension
      const fontUrl = variants ? files[variants[0]] : url
      // Use _id if available (custom fonts), otherwise use index + value for uniqueness
      const uniqueKey = _id || `${index}-${fontFamily}`

      return {
        key: uniqueKey,
        value: fontFamily,
        fontUrl,
        label: svgString ? (
          <span
            className="emtlkit--d-flex emtlkit--flex-center emtlkit--gap-4"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svgString }}
          />
        ) : (
          <span style={{ fontFamily: `"${fontFamily}"` }}>{nameWithoutExtension}</span>
        ),
      }
    })
  }, [isGoogleFonts, googleFonts, customFonts])

  const handleFontChange = useCallback(
    (selected: string[]) => {
      // Clear all pending timeouts when user clicks to select
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = undefined
      }
      if (hoverOutTimeoutRef.current) {
        clearTimeout(hoverOutTimeoutRef.current)
        hoverOutTimeoutRef.current = undefined
      }

      // Clear hover state when user clicks to select
      setIsHovering(false)
      hoveringFontRef.current = null

      const selectedFontName = selected[0]
      const fonts = isGoogleFonts ? googleFonts : customFonts
      const fontSelected = fonts.find(f => f.family === selectedFontName || f.nameWithoutExtension === selectedFontName)
      if (fontSelected) {
        const fontFamilyName = fontSelected.family || fontSelected.nameWithoutExtension
        const fontUrl = fontSelected.variants ? fontSelected.files[fontSelected.variants[0]] : fontSelected.url

        setSelectedFamily(fontFamilyName)
        onChangeFontFamily({ family: fontFamilyName, src: fontUrl })
      }
    },
    [customFonts, googleFonts, isGoogleFonts, onChangeFontFamily]
  )

  const options = useMemo(
    () => [
      { label: t(FONT_KIND.GOOGLE_FONTS), value: FONT_KIND.GOOGLE_FONTS },
      { label: t(FONT_KIND.CUSTOM_FONTS), value: FONT_KIND.CUSTOM_FONTS },
    ],
    [t]
  )

  useEffect(() => {
    const updateProgress = () => {
      setLoading(true)
    }
    const handleResponse = () => {
      setLoading(false)
      fetchCustomFonts(1, false, false)
    }
    Transmitter.listen(FILE_UPLOAD_EVENTS.UPLOAD, updateProgress)
    Transmitter.listen(FILE_UPLOAD_EVENTS.UPLOADED, handleResponse)

    return () => {
      Transmitter.remove(FILE_UPLOAD_EVENTS.UPLOAD, updateProgress)
      Transmitter.remove(FILE_UPLOAD_EVENTS.UPLOADED, handleResponse)
    }
  }, [fetchCustomFonts])

  // Handle scroll to bottom for infinite scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const threshold = 50 // pixels from bottom

    if (scrollHeight - scrollTop - clientHeight < threshold) {
      if (isGoogleFonts) {
        handleGoogleFontsFetchNextPage()
      } else {
        handleCustomFontsFetchNextPage()
      }
    }
  }, [isGoogleFonts, handleGoogleFontsFetchNextPage, handleCustomFontsFetchNextPage])

  return (
    <div className={styles.panelRoot}>
      <Box minWidth="100px">
        <InlineStack align="space-between">
          <InlineStack gap={'100'}>
            <Text as="p" variant="bodyMd">
              {t('font-family')}
            </Text>
            {(!fontFamily.family || !fontFamily.src) && (
              <Tooltip content={t('missing-font-family')}>
                <Icon source={InfoIcon} tone="warning" />
              </Tooltip>
            )}
          </InlineStack>

          <Button variant="plain" onClick={() => openModal(MODAL_ID.UPLOAD_FONTS_MODAL, { context: 'upload-only' })}>
            {t('add-font')}
          </Button>
        </InlineStack>

        {!customFontsFetched || isInitFetchingGoogleFonts ? (
          loadingState
        ) : (
          <div ref={scrollContainerRef} className={styles.scrollContainer} onScroll={handleScroll}>
            <div className={styles.filtersSection}>
              <BlockStack gap={'150'}>
                <TextField
                  prefix={<Icon source={SearchIcon} />}
                  onChange={onQueryStringChange}
                  label={t('fonts')}
                  labelHidden
                  value={queryString}
                  placeholder={t('search-fonts')}
                  autoComplete="off"
                />
                <Divider borderColor="border" />
                <Select
                  label="Select font kind"
                  labelHidden
                  value={fontKind}
                  options={options}
                  onChange={onChangeFontKind}
                />
                <Bleed>
                  <Divider borderColor="border" />
                </Bleed>
                {isGoogleFonts ? (
                  <Bleed marginInline={'200'}>
                    <Accordion
                      id={'google-fonts-filters'}
                      label={t('advanced-filters')}
                      open={true}
                      content={
                        <Bleed marginBlockStart={'200'}>
                          <GoogleFontsFilters
                            value={googleFontsFilters}
                            onChange={handleGoogleFontsFiltersChange}
                            disabled={false}
                            locale={i18n.language}
                            totalFilteredFonts={totalFilteredGoogleFonts}
                            isLoadingFonts={googleFontsLoading || loading}
                            onFilterPopoverActiveChange={handleFilterPopoverActiveChange}
                          />
                        </Bleed>
                      }
                    />
                  </Bleed>
                ) : null}
              </BlockStack>
            </div>

            {isCustomFonts && customFonts.length === 0 && !loading && customFontsFetched ? (
              <Box padding={'500'}>
                <EmptySearchResult
                  title={t('no-font-found')}
                  withIllustration
                  description={t('try-changing-the-search-term')}
                />
              </Box>
            ) : (
              <div role="listbox" className={styles.fontListbox} onMouseLeave={handleListboxMouseLeave}>
                {fontOptions.map(option => (
                  <div
                    key={option.key}
                    role="option"
                    tabIndex={0}
                    aria-selected={selectedFamily === option.value}
                    aria-label={`${option.value} font`}
                    className={`${styles.fontOption} ${selectedFamily === option.value ? styles.selected : ''}`}
                    onMouseEnter={() => handleFontHover({ family: option.value, src: option.fontUrl })}
                    onMouseLeave={handleFontHoverOut}
                    onClick={() => handleFontChange([option.value])}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleFontChange([option.value])
                      }
                    }}
                  >
                    {option.label}
                  </div>
                ))}
                {(fetchNextPage || loading) && (
                  <Box paddingBlock="200">
                    <InlineStack align="center">
                      <Spinner size="small" />
                    </InlineStack>
                  </Box>
                )}
              </div>
            )}
          </div>
        )}
      </Box>
    </div>
  )
}
