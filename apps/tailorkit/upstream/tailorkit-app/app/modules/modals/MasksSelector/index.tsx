import { useState, useMemo, useCallback } from 'react'
import { Box, Scrollable, Spinner, InlineStack, EmptySearchResult, Bleed } from '@shopify/polaris'
import { useMasks } from '~/modules/TemplateEditor/elements/hooks/useQueryMasks'
import { useDebounce } from '~/utils/hooks/useDebounce'
import { useTranslation } from 'react-i18next'
import { MaskSelectorSearchField } from './components/MaskSelectorSearchField'
import MaskUploaderModal from './components/MaskUploaderModal'
import ListMediaGrid from '../ImageSelector/components/ListMediaGrid'
import type { IImageQuery } from '~/types/shopify-files'
import type { MaskShape } from '~/bootstrap/constants/mask-option-sets'
import { PRE_MADE_MASK_OPTION_SET_RATIO } from '~/bootstrap/constants/mask-option-sets'

interface IMaskSelectorProps {
  selectedMasks?: MaskShape[]
  onClose: () => void
  onSelectMask: (masks: IImageQuery[]) => Promise<void>
}

/**
 * Get ratio label from ratio value
 * @param ratio - Ratio value (e.g., '1:1', '4:3')
 * @returns Ratio label (e.g., 'Square', 'Landscape (4:3)')
 */
function getRatioLabel(ratio: string): string {
  const ratioConfig = Object.values(PRE_MADE_MASK_OPTION_SET_RATIO).find(config => config.value === ratio)
  return ratioConfig?.keyLabel || ratio
}

export default function MaskSelector(props: IMaskSelectorProps) {
  const { selectedMasks = [], onClose, onSelectMask } = props
  const normalizedSelectedMasks: IImageQuery[] = useMemo(() => {
    return selectedMasks
      ? selectedMasks.map(mask => {
          const { src, name, _id, ratio } = mask

          return {
            id: _id,
            alt: name,
            image: {
              originalSrc: src,
              width: 100,
              height: 100,
            },
            customImageType: ratio ? getRatioLabel(ratio) : undefined, // Show ratio label for selected masks if available
          }
        })
      : []
  }, [selectedMasks])

  const { t } = useTranslation()

  const [searchValue, setSearchValue] = useState('')
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false)
  const [ratioSelected, setRatioSelected] = useState<string[]>([])
  const [masksSelected, setMasksSelected] = useState<IImageQuery[]>(normalizedSelectedMasks)

  const debouncedQueryString = useDebounce(searchValue, 200)

  // Extract ratio filters for pre-made masks (exclude 'custom-masks' option)
  const ratioFilters = useMemo(() => {
    return ratioSelected.filter(ratio => ratio !== 'custom-masks')
  }, [ratioSelected])

  const {
    preMadeMasks,
    customMasks,
    preMadeMasksLoading,
    customMasksLoading,
    customMasksNextPage,
    preMadeMasksNextPage,
    handleCustomMasksFetchNextPage,
    handlePreMadeMasksFetchNextPage,
    fetchCustomMasks,
  } = useMasks({
    textFieldValue: debouncedQueryString,
    ratioFilters,
  })

  const [selectingMasks, setSelectingMasks] = useState(false)

  const isInitialMasks = useMemo(
    () => (preMadeMasksLoading || customMasksLoading) && !searchValue,
    [preMadeMasksLoading, customMasksLoading, searchValue]
  )

  /**
   * Normalize pre-made masks to match our interface
   */
  const normalizePreMadeMask = useCallback(
    (mask: MaskShape): IImageQuery => ({
      id: mask._id,
      alt: mask.name,
      image: {
        originalSrc: mask.src,
        width: 100,
        height: 100,
      },
      customImageType: getRatioLabel(mask.ratio), // Show ratio for pre-made masks
    }),
    []
  )

  /**
   * Normalize custom masks to match our interface
   */
  const normalizeCustomMask = useCallback(
    (mask: any): IImageQuery => ({
      id: mask._id,
      alt: mask.name,
      image: {
        originalSrc: mask.url,
        width: 100,
        height: 100,
      },
      // customImageType: undefined - Don't show ratio for uploaded masks
    }),
    []
  )

  const normalizedCustomMasks = useMemo(() => customMasks.map(normalizeCustomMask), [customMasks, normalizeCustomMask])
  const normalizedPreMadeMasks = useMemo(
    () => preMadeMasks.map(normalizePreMadeMask),
    [preMadeMasks, normalizePreMadeMask]
  )

  /**
   * Combine and filter masks based on selected ratios
   * Pre-made masks are already filtered by ratio in the hook
   */
  const filteredMasks = useMemo(() => {
    const result: IImageQuery[] = []

    const includeCustomMasks = ratioSelected.length === 0 || ratioSelected.includes('custom-masks')
    const includePreMadeMasks = ratioSelected.length === 0 || ratioFilters.length > 0

    // Include custom masks based on filter selection
    if (includeCustomMasks) {
      result.push(...normalizedCustomMasks)
    }

    // Include pre-made masks (already filtered by ratio in the hook)
    // Only show pre-made masks if no custom masks pagination in progress
    if (!customMasksNextPage && includePreMadeMasks) {
      result.push(...normalizedPreMadeMasks)
    }

    return result
  }, [normalizedCustomMasks, normalizedPreMadeMasks, ratioSelected, customMasksNextPage, ratioFilters])

  /**
   * Handle fetching more masks
   * Priority: Custom masks -> Pre-made masks
   */
  const handleFetchMoreMasks = useCallback(async () => {
    if (customMasksNextPage) {
      await handleCustomMasksFetchNextPage()
      return
    }

    if (preMadeMasksNextPage) {
      await handlePreMadeMasksFetchNextPage()
    }
  }, [customMasksNextPage, preMadeMasksNextPage, handleCustomMasksFetchNextPage, handlePreMadeMasksFetchNextPage])

  const handleScrolledToBottom = useCallback(async () => {
    setIsFetchingNextPage(true)
    await handleFetchMoreMasks()
    setIsFetchingNextPage(false)
  }, [handleFetchMoreMasks])

  const handleSelectMasks = useCallback(async () => {
    setSelectingMasks(true)
    const masksSelectedFormatted = masksSelected.map(mask => ({
      ...mask,
      alt: `${mask.alt} ${mask.customImageType ? `(${mask.customImageType})` : ''}`,
    }))
    await onSelectMask(masksSelectedFormatted)
    setSelectingMasks(false)
    onClose()
  }, [masksSelected, onSelectMask, onClose])

  const refetchCustomMasks = useCallback(async () => {
    await fetchCustomMasks(1, false, false)
  }, [fetchCustomMasks])

  // Empty search state
  const emptySearchResult = useMemo(
    () => (
      <div style={{ height: 232 }}>
        <Box paddingBlockStart={'300'}>
          <EmptySearchResult
            title={t('no-masks-found')}
            withIllustration
            description={t('try-changing-the-search-term')}
          />
        </Box>
      </div>
    ),
    [t]
  )

  // Render mask list
  const maskList = useMemo(
    () => (
      <Box paddingBlockStart={'300'}>
        <Scrollable
          style={{
            height: 300,
          }}
          onScrolledToBottom={handleScrolledToBottom}
        >
          <ListMediaGrid
            isLoading={isInitialMasks && filteredMasks.length === 0}
            files={filteredMasks}
            imagesSelected={masksSelected}
            setImagesSelected={setMasksSelected}
            allowMultiple={true}
            showFilenameFromAlt={true}
          />
          {isFetchingNextPage && (
            <InlineStack align="center">
              <Spinner size="small" />
            </InlineStack>
          )}
        </Scrollable>
      </Box>
    ),
    [filteredMasks, handleScrolledToBottom, isFetchingNextPage, isInitialMasks, masksSelected]
  )

  // Filters component
  const filtersComponent = useMemo(
    () => (
      <Bleed marginBlockStart={'200'}>
        <MaskSelectorSearchField
          queryString={searchValue}
          ratioSelected={ratioSelected}
          setQueryString={setSearchValue}
          setRatioSelected={setRatioSelected}
        />
      </Bleed>
    ),
    [searchValue, ratioSelected]
  )

  // Primary action
  const primaryAction = useMemo(
    () => ({
      content: t('select'),
      onAction: handleSelectMasks,
      loading: selectingMasks,
    }),
    [t, handleSelectMasks, selectingMasks]
  )

  const secondaryActions = useMemo(
    () => [
      {
        content: t('close'),
        onAction: onClose,
      },
    ],
    [t, onClose]
  )

  /**
   * Handle after masks are uploaded successfully
   */
  const onAfterUploaded = useCallback(
    async (masksUploaded: any[]) => {
      await refetchCustomMasks()
    },
    [refetchCustomMasks]
  )

  return (
    <MaskUploaderModal
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      filtersComponent={filtersComponent}
      masksListComponent={searchValue && filteredMasks.length === 0 ? emptySearchResult : maskList}
      onAfterUploaded={onAfterUploaded}
    />
  )
}
