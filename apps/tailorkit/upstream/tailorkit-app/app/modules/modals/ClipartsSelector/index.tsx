import type { ComplexAction, ModalProps } from '@shopify/polaris'
import { Box, Modal, Spinner, InlineStack, Scrollable } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebounce } from '~/utils/hooks/useDebounce'
import { useCliparts } from './hooks/useCliparts'
// import type { IItem } from '../components/ListItems'
import { LIST_VIEW_TYPE, ListItems } from '../components/ListItems'
// import { useAppHandle } from '~/utils/hooks/useAppHandle'
// import { getMyShopifySubdomainName } from '~/shopify/fns'
import type { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { ClipartFilter } from './components/ClipartFilter'
import EmptySearchMarkup from '../ImageSelector/components/EmptySearchMarkup'
// import { useRootLoaderData } from '~/root'
import { useTourStatus } from '~/utils/hooks/useTourStatus'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { uuid } from '~/utils/uuid'
import { trackClipartClick } from '~/utils/trackClipartClick'
import { ClickContext } from '~/models/ClipartClickEvent'

interface IClipartsSelectorModal {
  active: boolean
  allowMultiple?: boolean
  defaultClipartSource?: TEMPLATE_TYPE
  secondaryActions?: ModalProps['secondaryActions']
  showCheckbox?: boolean
  trackingContext?: ClickContext // Where the modal is opened from
  onClose: () => void
  onSelect: (selectedCliparts: { _id: string; type: TEMPLATE_TYPE }[]) => Promise<void>
}

export const ClipartsSelector = (props: IClipartsSelectorModal) => {
  const {
    active,
    allowMultiple,
    defaultClipartSource,
    secondaryActions,
    showCheckbox = true,
    trackingContext = ClickContext.MODAL_TEMPLATE_SELECTOR_EDITOR,
    onClose,
    onSelect,
  } = props
  const { t } = useTranslation()
  // const { shopData } = useRootLoaderData()

  const { tourId, active: tourActive } = useTourStatus()
  const isInTour = !!tourId && tourActive
  const { trackEvent } = useEventsTracking()

  // Session ID for correlating view/select events
  const sessionId = useMemo(() => `sess_${uuid()}`, [])
  const viewTrackedRef = useRef(false)
  const itemsLoadedTimeRef = useRef(0)

  const [adding, setAdding] = useState(false)
  const [selectedCliparts, setSelectedCliparts] = useState<{ _id: string; type: TEMPLATE_TYPE }[]>([])
  const [queryString, setQueryString] = useState('')
  const [clipartSource, setClipartSource] = useState<TEMPLATE_TYPE[]>(
    defaultClipartSource ? [defaultClipartSource] : []
  )
  const [categories, setCategories] = useState<string[]>([])

  // Prevent page scroll when modal is open
  usePreventPageScroll(active)

  const queryStringDebounced = useDebounce(queryString, 150)

  // const { appHandle } = useAppHandle()
  const { isFetching, isFetchNextPage, clipartsList, fetchNextPage } = useCliparts({
    queryString: queryStringDebounced,
    clipartSource,
    categories,
  })

  // const shopDomain = shopData?.shopDomain
  // const subDomain = getMyShopifySubdomainName(shopDomain || '')
  // const defaultClipartSourceQueryParam = useMemo(() => {
  //   return defaultClipartSource ? `?tab=${defaultClipartSource}` : ''
  // }, [defaultClipartSource])

  const clipartsListFormatted = useMemo(() => {
    return clipartsList.map(clipart => {
      const { _id, name, previewUrl, thumbnailUrl, type, clickCount, productPageUrl } = clipart
      return {
        _id,
        previewUrl: thumbnailUrl || previewUrl,
        alt: name,
        selected: selectedCliparts.some(selected => selected._id === _id),
        type,
        clickCount,
        productPageUrl,
      }
    })
  }, [clipartsList, selectedCliparts])

  const handleClickItem = useCallback(
    (newCheck: boolean, item: any, index?: number) => {
      if (newCheck) {
        // Track clipart selection
        try {
          const timeToSelectSeconds = itemsLoadedTimeRef.current
            ? Math.round((Date.now() - itemsLoadedTimeRef.current) / 1000)
            : undefined

          const selectEventProps = {
            [EVENTS_PARAMETERS_NAME.CLIPART_ID]: item._id,
            [EVENTS_PARAMETERS_NAME.CLIPART_NAME]: item.alt,
            [EVENTS_PARAMETERS_NAME.CLIPART_CATEGORY]: categories.join(',') || 'all',
            [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'clipart_modal',
            [EVENTS_PARAMETERS_NAME.SESSION_ID]: sessionId,
            [EVENTS_PARAMETERS_NAME.SELECTION_POSITION]: index ?? 0,
            ...(timeToSelectSeconds !== undefined && {
              [EVENTS_PARAMETERS_NAME.TIME_TO_SELECT_SECONDS]: timeToSelectSeconds,
            }),
          }
          trackEvent(EVENTS_TRACKING.CLIPART_SELECT, selectEventProps)
        } catch (e) {
          console.error('[ClipartsSelector] Failed to track CLIPART_SELECT', e)
        }

        // Track click count in database with context
        trackClipartClick(item._id, trackingContext, {
          category: categories.join(',') || undefined,
          searchQuery: queryString || undefined,
        }).catch(() => {
          // Silently fail - don't block user interaction
        })

        const newCliparts = allowMultiple
          ? [...(selectedCliparts || []), { _id: item._id, type: item.type }]
          : [{ _id: item._id, type: item.type }]
        setSelectedCliparts(newCliparts)
      } else {
        const filteredCliparts = selectedCliparts?.filter(clipart => clipart._id !== item._id)
        setSelectedCliparts(filteredCliparts)
      }
    },
    [allowMultiple, selectedCliparts, trackEvent, sessionId, categories, trackingContext, queryString]
  )

  // Track clipart view when modal opens and items are loaded
  useEffect(() => {
    if (active && !isFetching && clipartsListFormatted.length > 0 && !viewTrackedRef.current) {
      viewTrackedRef.current = true
      itemsLoadedTimeRef.current = Date.now()

      try {
        const batchId = `batch_${uuid()}`
        const viewEventProps = {
          [EVENTS_PARAMETERS_NAME.CLIPART_IDS]: clipartsListFormatted.slice(0, 35).map(item => item._id),
          [EVENTS_PARAMETERS_NAME.CLIPART_COUNT]: clipartsListFormatted.length,
          [EVENTS_PARAMETERS_NAME.CLIPART_CATEGORY]: categories.join(',') || 'all',
          [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'clipart_modal',
          [EVENTS_PARAMETERS_NAME.BATCH_ID]: batchId,
          [EVENTS_PARAMETERS_NAME.SESSION_ID]: sessionId,
        }
        trackEvent(EVENTS_TRACKING.CLIPART_VIEW, viewEventProps)
      } catch (e) {
        console.error('[ClipartsSelector] Failed to track CLIPART_VIEW', e)
      }
    }
  }, [active, isFetching, clipartsListFormatted, categories, sessionId, trackEvent])

  // Reset view tracking when modal closes or filters change
  useEffect(() => {
    if (!active) {
      viewTrackedRef.current = false
    }
  }, [active, categories, queryStringDebounced])

  const handleSelect = useCallback(async () => {
    setAdding(true)
    await onSelect(selectedCliparts)
    setAdding(false)
    onClose()
  }, [selectedCliparts, onSelect, onClose])

  const handleCancel = useCallback(() => {
    if (isInTour) return

    onClose()
  }, [isInTour, onClose])

  // Use default TemplateGridItem UI from ListItems (no custom components override)

  const renderPrimaryAction: ComplexAction = useMemo(
    () => ({
      id: 'select-clipart-btn',
      loading: adding,
      disabled: selectedCliparts.length === 0,
      content: t('select'),
      onAction: handleSelect,
    }),
    [adding, handleSelect, selectedCliparts.length, t]
  )

  const renderSecondaryActions = useMemo(
    () =>
      secondaryActions || [
        {
          content: t('cancel'),
          onAction: handleCancel,
        },
      ],
    [handleCancel, secondaryActions, t]
  )

  // const renderFooter = useMemo(
  //   () => (
  //     <Link
  //       removeUnderline
  //       target="_blank"
  //       url={`https://admin.shopify.com/store/${subDomain}/apps/${appHandle}/libraries${defaultClipartSourceQueryParam}`}
  //     >
  //       {t('asset-library')}
  //     </Link>
  //   ),
  //   [defaultClipartSourceQueryParam, t, appHandle, subDomain]
  // )

  return (
    <Modal
      open={active}
      title={t('select-cliparts')}
      onClose={handleCancel}
      primaryAction={renderPrimaryAction}
      {...(isInTour
        ? {}
        : {
            secondaryActions: renderSecondaryActions,
            // footer: renderFooter,
          })}
      noScroll
    >
      <Box padding="200">
        <ClipartFilter
          queryString={queryString}
          clipartSource={clipartSource}
          defaultClipartSource={defaultClipartSource}
          setQueryString={setQueryString}
          setClipartSource={setClipartSource}
          categories={categories}
          setCategories={setCategories}
        />

        <Box paddingBlockStart="200"></Box>

        <Scrollable
          style={{ height: 'calc(100vh - 272px)', maxHeight: 'calc(100vh - 272px)' }}
          onScrolledToBottom={fetchNextPage}
        >
          <ListItems
            isLoading={isFetching}
            type={LIST_VIEW_TYPE.GRID}
            items={clipartsListFormatted}
            showCheckbox={showCheckbox}
            showTitle={false}
            showViewDemoButton={true}
            onClickItem={handleClickItem}
            resourceName={'cliparts'}
            queryString={queryString}
            emptyState={
              <EmptySearchMarkup
                resourceName={'cliparts'}
                description={t('no-images-are-found-in-this-store-upload-to-make-a-selection')}
              />
            }
          />
          {isFetchNextPage && (
            <Box padding={'200'}>
              <InlineStack align="center">
                <Spinner size="small" />
              </InlineStack>
            </Box>
          )}
        </Scrollable>
      </Box>
    </Modal>
  )
}
