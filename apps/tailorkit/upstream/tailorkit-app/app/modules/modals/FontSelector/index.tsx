import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  AutoSelection,
  Checkbox,
  Box,
  Filters,
  Listbox,
  Scrollable,
  Spinner,
  InlineStack,
  EmptySearchResult,
  Grid,
  Modal,
  BlockStack,
  Button,
  Tabs,
  DropZone,
  ProgressBar,
  Text,
  TextField,
  Bleed,
} from '@shopify/polaris'
import type { AppliedFilterInterface } from '@shopify/polaris'
import { SearchIcon } from '@shopify/polaris-icons'
import { useFonts, type IGoogleFont } from '~/modules/TemplateEditor/elements/hooks/useQueryFonts'
import { useDebounce } from '~/utils/hooks/useDebounce'
import { FONT_SOURCE } from './constants'
import { useTranslation } from 'react-i18next'
import type { GoogleFontsFiltersValue } from '~/components/GoogleFontsFilters/GoogleFontsFilters'
import { useGoogleFontsFiltersData } from '~/components/GoogleFontsFilters/useGoogleFontsFiltersData'
import { useStyleFilter, useLanguageFilter } from '~/components/GoogleFontsFilters/hooks'
import { filterGroupsByQuery, useIncrementalOptions } from '~/components/GoogleFontsFilters/components/FilterCombobox'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { useUploadFiles } from '~/modules/TemplateEditor/hooks/useUploadFiles'
import { processFileUpload, validateFiles } from '~/modules/TemplateEditor/modals/FontUploaderModal/fns'
import { ALLOWED_FONT_EXTENSIONS } from '~/constants/dropzone'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { sleep } from '~/utils/sleep'
import { ONE_SECOND } from '~/constants/time'
import { uploadFontStateStore } from '~/modules/TemplateEditor/modals/FontUploaderModal'
import { useStore } from '~/libs/external-store'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { FILE_UPLOAD_EVENTS } from '~/modules/TemplateEditor/constants'

type FontSource = 'google' | 'custom'

export interface FontType {
  _id: string
  family: string
  svgString: string
  src: string
  fontSource: FontSource
}

interface IFontSelectorProps {
  selectedFonts: FontType[]
  onClose: () => void
  onSelectFont: (font: FontType[]) => Promise<void>
}

const MODAL_KEY = MODAL_ID.UPLOAD_FONTS_MODAL
const TAB_INDEX = { GOOGLE: 0, CUSTOM: 1 } as const

interface CustomFontFile {
  _id: string
  nameWithoutExtension: string
  url: string
  svgString?: string
}

export default function FontSelector(props: IFontSelectorProps) {
  const { selectedFonts, onClose, onSelectFont } = props
  const { t } = useTranslation()

  // Modal state - needed early for context access
  const { state: modalState, closeModal, openModal } = useModal()
  const currentContext = modalState[MODAL_KEY]?.data

  // Determine default tab based on selected fonts
  const defaultTab = useMemo(() => {
    if (selectedFonts.length === 0) return TAB_INDEX.GOOGLE
    const allCustomFonts = selectedFonts.every(font => font.fontSource === FONT_SOURCE.CUSTOM)
    return allCustomFonts ? TAB_INDEX.CUSTOM : TAB_INDEX.GOOGLE
  }, [selectedFonts])

  const [searchValue, setSearchValue] = useState('')
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false)
  const [selectedTabIndex, setSelectedTabIndex] = useState<number>(defaultTab)
  const [googleFontsFilters, setGoogleFontsFilters] = useState<GoogleFontsFiltersValue>({
    styleTagPaths: [],
    languageIds: [],
    subsetKeys: [],
  })
  const [fontsSelected, setFontsSelected] = useState<FontType[]>(
    selectedFonts.map(font => ({
      ...font,
      _id: font._id,
    }))
  )

  // Reset tab when modal reopens with different selected fonts
  useEffect(() => {
    // Check if there's a saved tab index in the context (from result modal)
    const savedTabIndex = currentContext?.selectedTabIndex
    if (savedTabIndex !== undefined) {
      setSelectedTabIndex(savedTabIndex)
    } else {
      setSelectedTabIndex(defaultTab)
    }
  }, [defaultTab, currentContext])

  const debouncedQueryString = useDebounce(searchValue, 200)

  // Google Fonts filters data
  const { styles, languages, loading: filtersLoading } = useGoogleFontsFiltersData()
  const styleFilter = useStyleFilter({ styles, value: googleFontsFilters, onChange: setGoogleFontsFilters })
  const languageFilter = useLanguageFilter({ languages, value: googleFontsFilters, onChange: setGoogleFontsFilters })

  // Determine font source based on selected tab
  const fontSource = useMemo(() => {
    if (selectedTabIndex === TAB_INDEX.GOOGLE) return [FONT_SOURCE.GOOGLE]
    if (selectedTabIndex === TAB_INDEX.CUSTOM) return [FONT_SOURCE.CUSTOM]
    return []
  }, [selectedTabIndex])

  const {
    googleFonts,
    customFonts,
    googleFontsLoading,
    customFontsLoading,
    customFontsNextPage,
    googleFontsNextPage,
    handleCustomFontsFetchNextPage,
    handleGoogleFontsFetchNextPage,
    fetchCustomFonts,
  } = useFonts(debouncedQueryString, { googleFontsFilters })

  const [selectingFonts, setSelectingFonts] = useState(false)

  // Upload state
  const uploadFontState = useStore(uploadFontStateStore, state => state)
  const { uploadFiles } = useUploadFiles()
  const { isUploading, invalidFiles, files, fileUploaded } = uploadFontState
  const totalFilesError = useMemo(() => invalidFiles.length, [invalidFiles]) || 0
  const totalFilesUploading = useMemo(() => files.length, [files]) + totalFilesError
  const totalFilesUploaded = useMemo(() => fileUploaded + totalFilesError, [fileUploaded, totalFilesError])

  const active = modalState[MODAL_KEY]?.active
  usePreventPageScroll(!!active)

  const isInitialFonts = useMemo(
    () => (googleFontsLoading || customFontsLoading) && !searchValue,
    [googleFontsLoading, customFontsLoading, searchValue]
  )

  const normalizeGoogleFont = useCallback((font: IGoogleFont): FontType => {
    const firstVariant = font.variants[0]
    return {
      _id: font.family,
      family: font.family,
      svgString: font.svgString,
      src: firstVariant ? font.files[firstVariant] : '',
      fontSource: 'google',
    }
  }, [])

  const normalizeCustomFont = useCallback((font: CustomFontFile): FontType => {
    return {
      _id: font._id,
      family: font.nameWithoutExtension,
      svgString: font.svgString || '',
      src: font.url,
      fontSource: 'custom',
    }
  }, [])

  const normalizedCustomFonts = useMemo(() => customFonts.map(normalizeCustomFont), [customFonts, normalizeCustomFont])
  const normalizedGoogleFonts = useMemo(() => googleFonts.map(normalizeGoogleFont), [googleFonts, normalizeGoogleFont])

  const filteredFonts = useMemo(() => {
    if (fontSource.includes(FONT_SOURCE.GOOGLE)) return normalizedGoogleFonts
    if (fontSource.includes(FONT_SOURCE.CUSTOM)) return normalizedCustomFonts
    return [...normalizedCustomFonts, ...(customFontsNextPage ? [] : normalizedGoogleFonts)]
  }, [normalizedCustomFonts, normalizedGoogleFonts, fontSource, customFontsNextPage])

  const handleFontToggle = useCallback((font: FontType) => {
    setFontsSelected(prevSelected => {
      const fontIndex = prevSelected.findIndex(selected => selected.family === font.family)
      if (fontIndex >= 0) return [...prevSelected.slice(0, fontIndex), ...prevSelected.slice(fontIndex + 1)]
      return [...prevSelected, font]
    })
  }, [])

  const handleFetchMoreFonts = useCallback(async () => {
    if (selectedTabIndex === TAB_INDEX.CUSTOM && customFontsNextPage) {
      await handleCustomFontsFetchNextPage()
      return
    }
    if (selectedTabIndex === TAB_INDEX.GOOGLE && googleFontsNextPage) {
      await handleGoogleFontsFetchNextPage()
    }
  }, [
    selectedTabIndex,
    customFontsNextPage,
    googleFontsNextPage,
    handleCustomFontsFetchNextPage,
    handleGoogleFontsFetchNextPage,
  ])

  const handleScrolledToBottom = useCallback(async () => {
    setIsFetchingNextPage(true)
    await handleFetchMoreFonts()
    setIsFetchingNextPage(false)
  }, [handleFetchMoreFonts])

  const handleSelectFonts = useCallback(async () => {
    setSelectingFonts(true)
    await onSelectFont(fontsSelected)
    setSelectingFonts(false)
    onClose()
  }, [fontsSelected, onSelectFont, onClose])

  const refetchCustomFonts = useCallback(async () => {
    await fetchCustomFonts(1, false, false)
  }, [fetchCustomFonts])

  const handleClose = useCallback(() => {
    closeModal(MODAL_KEY)
  }, [closeModal])

  // Handle file drop for custom fonts tab
  const handleDrop = useCallback(
    async (droppedFiles: File[]) => {
      try {
        Transmitter.trigger(FILE_UPLOAD_EVENTS.UPLOAD)
        uploadFontStateStore.dispatch({ type: 'CLEAR_STATE' })

        const invalidFiles = validateFiles(droppedFiles)

        const validFiles
          = invalidFiles.length > 0
            ? droppedFiles.filter(file => !invalidFiles.some(invalid => invalid.name === file.name))
            : droppedFiles

        if (invalidFiles.length) {
          uploadFontStateStore.dispatch({
            type: 'SET_INVALID_FILES',
            files: invalidFiles,
            message: t('invalid-font-files'),
          })
        }

        if (validFiles.length === 0) {
          Transmitter.trigger(FILE_UPLOAD_EVENTS.UPLOADED)
          return
        }

        uploadFontStateStore.dispatch({ type: 'SET_FILES', files: validFiles })
        uploadFontStateStore.dispatch({ type: 'SET_UPLOADING', isUploading: true })

        const result = await processFileUpload(
          validFiles,
          uploadFiles,
          count => uploadFontStateStore.dispatch({ type: 'SET_UPLOAD_PROGRESS', count }),
          (message, errors) => {
            if (errors) {
              uploadFontStateStore.dispatch({ type: 'SET_INVALID_FILES', files: errors, message })
            } else {
              uploadFontStateStore.dispatch({ type: 'SET_ERROR', message })
            }
          }
        )

        if (result.success) {
          await sleep(ONE_SECOND)
          await refetchCustomFonts()
        }
        Transmitter.trigger(FILE_UPLOAD_EVENTS.UPLOADED)

        uploadFontStateStore.dispatch({ type: 'SET_UPLOADING', isUploading: false })
      } catch (e) {
        console.error(e)
        uploadFontStateStore.dispatch({ type: 'SET_ERROR', message: formatErrorMessage(e) })
        uploadFontStateStore.dispatch({ type: 'SET_UPLOADING', isUploading: false })
      }
    },
    [uploadFiles, t, refetchCustomFonts]
  )

  const handleViewDetailedResult = useCallback(() => {
    closeModal(MODAL_KEY)
    openModal(MODAL_ID.UPLOAD_FONTS_RESULT_MODAL, {
      returnContext: { ...currentContext, selectedTabIndex },
    })
  }, [closeModal, openModal, currentContext, selectedTabIndex])

  // Tabs configuration
  const tabs = useMemo(
    () => [
      { id: 'google-fonts', content: t('google-fonts'), accessibilityLabel: t('google-fonts') },
      { id: 'your-fonts', content: t('your-fonts'), accessibilityLabel: t('your-fonts') },
    ],
    [t]
  )

  const isGoogleTab = selectedTabIndex === TAB_INDEX.GOOGLE
  const isCustomTab = selectedTabIndex === TAB_INDEX.CUSTOM

  const appliedFilters: AppliedFilterInterface[] = useMemo(() => {
    const items: AppliedFilterInterface[] = []

    if (languageFilter.selectedValues.length > 0) {
      const labels = languageFilter.selectedValues
        .map(id => languageFilter.labelMap.get(id) || id)
        .filter(Boolean)
        .join(', ')
      items.push({
        key: 'language',
        label: `${t('language')}: ${labels}`,
        onRemove: () => languageFilter.clear(),
      })
    }

    if (styleFilter.selectedValues.length > 0) {
      const labels = styleFilter.selectedValues
        .map(path => styleFilter.labelMap.get(path) || path)
        .filter(Boolean)
        .join(', ')
      items.push({
        key: 'style',
        label: `${t('style')}: ${labels}`,
        onRemove: () => styleFilter.clear(),
      })
    }

    return items
  }, [languageFilter, styleFilter, t])

  const {
    visibleItems: filteredLanguageOptions,
    hasMore: hasMoreLanguages,
    loadMore: loadMoreLanguages,
  } = useIncrementalOptions({
    items: languageFilter.options,
    query: languageFilter.query,
    getLabel: item => item.label,
    initialDisplay: 50,
    pageSize: 50,
  })

  const filteredStyleGroups = useMemo(() => {
    return filterGroupsByQuery(styleFilter.groups, styleFilter.query)
  }, [styleFilter.groups, styleFilter.query])

  // Upload progress component
  const uploadProgress = useMemo(() => {
    if (totalFilesUploading === 0) return null

    const progress
      = fileUploaded === 0 && totalFilesUploading > 0 ? 10 : (totalFilesUploaded / totalFilesUploading) * 100 || 10

    return (
      <BlockStack gap="200">
        <ProgressBar tone="success" progress={progress} />
        <InlineStack gap="150">
          <Text as="p">
            {isUploading ? t('processing-without-dots') : t('processed')}: {totalFilesUploaded}/{totalFilesUploading}
          </Text>
          {!isUploading && (
            <Button variant="plain" onClick={handleViewDetailedResult}>
              {t('view-detailed-results')}
            </Button>
          )}
        </InlineStack>
      </BlockStack>
    )
  }, [totalFilesUploading, totalFilesUploaded, fileUploaded, isUploading, t, handleViewDetailedResult])

  // Font list component
  const fontList = useMemo(
    () => (
      <Box paddingBlockStart="300">
        <Scrollable
          style={{
            maxHeight: isGoogleTab ? 'calc(100vh - 402px)' : 'calc(100vh - 480px)',
          }}
          onScrolledToBottom={handleScrolledToBottom}
        >
          <Grid columns={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2 }}>
            {filteredFonts.map(font => {
              if (!font) return null

              const { family: fontFamily, svgString } = font
              const fontId = font._id
              const isSelected = fontsSelected.some(selected => selected.family === font.family)

              return (
                <Grid.Cell key={fontId}>
                  <Checkbox
                    label={
                      svgString ? (
                        // eslint-disable-next-line react/no-danger
                        <span dangerouslySetInnerHTML={{ __html: svgString }} />
                      ) : (
                        <span style={font.family ? { fontFamily: font.family } : undefined}>{fontFamily}</span>
                      )
                    }
                    checked={isSelected}
                    onChange={() => handleFontToggle(font)}
                  />
                </Grid.Cell>
              )
            })}
          </Grid>
          {isFetchingNextPage && (
            <InlineStack align="center">
              <Spinner size="small" />
            </InlineStack>
          )}
        </Scrollable>
      </Box>
    ),
    [filteredFonts, fontsSelected, handleFontToggle, handleScrolledToBottom, isFetchingNextPage, isGoogleTab]
  )

  // Empty search result
  const emptySearchResult = useMemo(
    () => (
      <div style={{ height: 232 }}>
        <Box paddingBlockStart="300">
          <EmptySearchResult
            title={t('no-font-found')}
            withIllustration
            description={t('try-changing-the-search-term')}
          />
        </Box>
      </div>
    ),
    [t]
  )

  const isLoading = isInitialFonts && filteredFonts.length === 0
  const hasActiveGoogleFilters
    = isGoogleTab && (languageFilter.selectedValues.length > 0 || styleFilter.selectedValues.length > 0)
  const showEmptyState = !isLoading && (searchValue || hasActiveGoogleFilters) && filteredFonts.length === 0

  const filters = useMemo(() => {
    return [
      {
        key: 'language',
        label: t('language'),
        filter: (
          <Box minWidth="280px">
            <BlockStack gap="200">
              <TextField
                label={t('search-language')}
                labelHidden
                value={languageFilter.query}
                onChange={languageFilter.setQuery}
                placeholder={t('search-language')}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => languageFilter.setQuery('')}
              />
              <Bleed marginInline={'200'}>
                <Scrollable style={{ maxHeight: 220 }} onScrolledToBottom={loadMoreLanguages}>
                  <Listbox autoSelection={AutoSelection.None} onSelect={languageFilter.toggle}>
                    {filteredLanguageOptions.length > 0 ? (
                      filteredLanguageOptions.map(opt => (
                        <Listbox.Option
                          key={opt.value}
                          value={opt.value}
                          selected={languageFilter.selectedValues.includes(opt.value)}
                          accessibilityLabel={opt.label}
                        >
                          <Listbox.TextOption selected={languageFilter.selectedValues.includes(opt.value)}>
                            {opt.label}
                          </Listbox.TextOption>
                        </Listbox.Option>
                      ))
                    ) : (
                      <Box padding="300">
                        <Text as="p" tone="subdued">
                          {t('no-results-found')}
                        </Text>
                      </Box>
                    )}
                    {hasMoreLanguages ? (
                      <Box padding="200">
                        <InlineStack align="center">
                          <Spinner accessibilityLabel="Loading more options" size="small" />
                        </InlineStack>
                      </Box>
                    ) : null}
                  </Listbox>
                </Scrollable>
              </Bleed>
            </BlockStack>
          </Box>
        ),
        shortcut: true,
        pinned: true,
      },
      {
        key: 'style',
        label: t('style'),
        filter: (
          <Box minWidth="280px">
            <BlockStack gap="200">
              <TextField
                label={t('search-style')}
                labelHidden
                value={styleFilter.query}
                onChange={styleFilter.setQuery}
                placeholder={t('search-style')}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => styleFilter.setQuery('')}
              />
              <Bleed marginInline={'200'}>
                <Scrollable style={{ maxHeight: 220 }}>
                  <Listbox autoSelection={AutoSelection.None} onSelect={styleFilter.toggle}>
                    {filteredStyleGroups.length > 0 ? (
                      filteredStyleGroups.map(group => (
                        <Listbox.Section
                          key={group.groupLabel}
                          title={
                            <Box paddingBlock="200" paddingInline="300">
                              <Text as="span" variant="bodyMd" fontWeight="medium">
                                {group.groupLabel}
                              </Text>
                            </Box>
                          }
                        >
                          {group.options.map(opt => (
                            <Listbox.Option
                              key={opt.value}
                              value={opt.value}
                              selected={styleFilter.selectedValues.includes(opt.value)}
                              accessibilityLabel={opt.label}
                            >
                              <Listbox.TextOption selected={styleFilter.selectedValues.includes(opt.value)}>
                                {opt.sampleSvg ? (
                                  <span
                                    // eslint-disable-next-line react/no-danger
                                    dangerouslySetInnerHTML={{ __html: opt.sampleSvg }}
                                    title={opt.label}
                                  />
                                ) : (
                                  opt.label
                                )}
                              </Listbox.TextOption>
                            </Listbox.Option>
                          ))}
                        </Listbox.Section>
                      ))
                    ) : (
                      <Box padding="300">
                        <Text as="p" tone="subdued">
                          {t('no-results-found')}
                        </Text>
                      </Box>
                    )}
                  </Listbox>
                </Scrollable>
              </Bleed>
            </BlockStack>
          </Box>
        ),
        shortcut: true,
        pinned: true,
      },
    ]
  }, [
    filteredLanguageOptions,
    filteredStyleGroups,
    hasMoreLanguages,
    languageFilter,
    loadMoreLanguages,
    styleFilter,
    t,
  ])

  return (
    <Modal
      open={active}
      onClose={handleClose}
      title={t('select-font')}
      primaryAction={{
        content: t('select'),
        onAction: handleSelectFonts,
        loading: selectingFonts,
      }}
      noScroll
    >
      {isLoading ? (
        <div style={{ height: 468 }}>
          <Box padding="2800">
            <InlineStack align="center">
              <Spinner size="large" />
            </InlineStack>
          </Box>
        </div>
      ) : (
        <Modal.Section>
          <BlockStack gap="200">
            {/* Tabs */}
            <Bleed marginInline={'500'} marginBlock={'300'}>
              <Tabs tabs={tabs} selected={selectedTabIndex} onSelect={setSelectedTabIndex} />
            </Bleed>

            {/* Google Fonts filters with Polaris Filters */}
            {isGoogleTab ? (
              <BlockStack gap="300">
                <Bleed marginInline={'400'}>
                  <Filters
                    queryValue={searchValue}
                    queryPlaceholder={t('search-fonts')}
                    closeOnChildOverlayClick
                    filters={filters}
                    appliedFilters={appliedFilters}
                    onQueryChange={setSearchValue}
                    onQueryClear={() => setSearchValue('')}
                    onClearAll={() => {
                      languageFilter.clear()
                      styleFilter.clear()
                      setSearchValue('')
                    }}
                    disabled={filtersLoading}
                  />
                </Bleed>
              </BlockStack>
            ) : (
              <TextField
                label={t('search-fonts')}
                labelHidden
                value={searchValue}
                onChange={setSearchValue}
                placeholder={t('search-fonts')}
                autoComplete="off"
                prefix={<SearchIcon />}
                clearButton
                onClearButtonClick={() => setSearchValue('')}
              />
            )}

            {/* DropZone - only show on Your fonts tab */}
            {isCustomTab && (
              <BlockStack gap="300">
                <DropZone
                  accept={ALLOWED_FONT_EXTENSIONS.join(',')}
                  onDrop={handleDrop}
                  allowMultiple
                  disabled={isUploading}
                >
                  <DropZone.FileUpload actionHint={t('accept-font-formats')} actionTitle={t('upload-fonts')} />
                </DropZone>
                {uploadProgress}
              </BlockStack>
            )}

            {/* Font list */}
            {showEmptyState ? emptySearchResult : fontList}
          </BlockStack>
        </Modal.Section>
      )}
    </Modal>
  )
}
