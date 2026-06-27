import { BlockStack, Box, Button, InlineStack, Popover, Tooltip } from '@shopify/polaris'
import { MeasurementSizeIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useTourGuide } from '~/bootstrap/hoc/withTourGuide'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { FlexCenter } from '~/components/common/Flex'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import { HeightTextField } from '~/routes/templates._index/components/ModalCreateTemplate/HeightTextField'
import { MeasurementUnits } from '~/routes/templates._index/components/ModalCreateTemplate/MeasurementUnit'
import { ResolutionField } from '~/routes/templates._index/components/ModalCreateTemplate/ResolutionField'
import { WidthTextField } from '~/routes/templates._index/components/ModalCreateTemplate/WidthTextField'
import { validateTemplateHeight, validateTemplateWidth } from '~/routes/templates._index/fns'
import { TemplateEditorStore } from '~/stores/modules/template'
import useCanvasDimension from '~/utils/hooks/useCanvasDimension'
import useDevices from '~/utils/hooks/useDevice'

const TEMPLATE_DIMENSION_DEBOUNCE_TIME = 300

export function TemplateDimension() {
  const [popoverActive, setPopoverActive] = useState(false)
  const { isMobileView } = useDevices()
  const { t } = useTranslation()

  const { width, height, measurementUnit } = useCanvasDimension()

  const { tour } = useTourGuide()

  const togglePopoverActive = useCallback(
    (e?: Event) => {
      tour && typeof e?.stopPropagation === 'function' && e.stopPropagation()

      setPopoverActive(popoverActive => !popoverActive)
    },
    [tour]
  )

  const activator = (
    <Tooltip content={t('template-dimensions')}>
      <FlexCenter>
        {isMobileView ? (
          <Button onClick={togglePopoverActive} icon={MeasurementSizeIcon} />
        ) : (
          <Button
            onClick={togglePopoverActive}
            variant="tertiary"
            id="template-dimensions-btn"
            icon={MeasurementSizeIcon}
          >
            {width?.toString().replace('.', ',')} x {height?.toString().replace('.', ',')} {measurementUnit}
          </Button>
        )}
      </FlexCenter>
    </Tooltip>
  )

  return (
    // @ts-ignore
    <Popover active={popoverActive} activator={activator} autofocusTarget="first-node" onClose={togglePopoverActive}>
      <Box padding={'400'} id="popover-dimension">
        <BlockStack gap={'200'}>
          <InlineStack gap={'200'}>
            <WidthCanvasInputField />
            <HeightCanvasInputField />
          </InlineStack>
          <InlineStack gap={'200'}>
            <MeasurementUnitCanvasInputField />
            <ResolutionCanvasInputField />
          </InlineStack>
        </BlockStack>
      </Box>
      {/* Hidden button for toggle popover when user is in tour */}
      <div style={{ visibility: 'hidden', position: 'absolute', top: 0, left: 0 }}>
        <Button onClick={() => togglePopoverActive()} variant="tertiary" id="hidden-template-dimension-btn" />
      </div>
    </Popover>
  )
}

function WidthCanvasInputField() {
  const { t } = useTranslation()
  const { width, measurementUnit, ...otherConfigs } = useCanvasDimension()
  const { trackEvent } = useEventsTracking()

  // Local state for immediate feedback
  const [localWidth, setLocalWidth] = useState(width)
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state with store when store changes
  useEffect(() => {
    setLocalWidth(width)
  }, [width])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
    }
  }, [])

  const updateWidth = useCallback(
    (val: number) => {
      // Update local state immediately for responsive UI
      setLocalWidth(val)

      // Clear any pending timeouts
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }

      // Create a new timeout for store update
      const newTimeoutId = setTimeout(() => {
        trackEvent(EVENTS_TRACKING.EDIT_DIMENSION_AND_RESOLUTION, {
          [EVENTS_PARAMETERS_NAME.NEW_WIDTH]: val,
          [EVENTS_PARAMETERS_NAME.MEASUREMENT_UNIT]: measurementUnit,
        })

        TemplateEditorStore.dispatch({
          type: 'SET_DIMENSION',
          payload: {
            dimension: {
              ...otherConfigs,
              measurementUnit,
              width: val,
            },
          },
          skipTrace: !!validateTemplateWidth(val, measurementUnit),
        })
      }, TEMPLATE_DIMENSION_DEBOUNCE_TIME) // TEMPLATE_DIMENSION_DEBOUNCE_TIMEms debounce

      timeoutIdRef.current = newTimeoutId
    },
    [trackEvent, measurementUnit, otherConfigs]
  )

  return <WidthTextField measurementUnit={measurementUnit} t={t} value={localWidth} setValue={updateWidth} />
}

function HeightCanvasInputField() {
  const { t } = useTranslation()
  const { height, measurementUnit, ...otherConfigs } = useCanvasDimension()
  const { trackEvent } = useEventsTracking()

  // Local state for immediate feedback
  const [localHeight, setLocalHeight] = useState(height)
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state with store when store changes
  useEffect(() => {
    setLocalHeight(height)
  }, [height])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
    }
  }, [])

  const updateHeight = useCallback(
    (val: number) => {
      // Update local state immediately for responsive UI
      setLocalHeight(val)

      // Clear any pending timeouts
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }

      // Create a new timeout for store update
      const newTimeoutId = setTimeout(() => {
        trackEvent(EVENTS_TRACKING.EDIT_DIMENSION_AND_RESOLUTION, {
          [EVENTS_PARAMETERS_NAME.NEW_HEIGHT]: val,
          [EVENTS_PARAMETERS_NAME.MEASUREMENT_UNIT]: measurementUnit,
        })

        TemplateEditorStore.dispatch({
          type: 'SET_DIMENSION',
          payload: {
            dimension: {
              ...otherConfigs,
              measurementUnit,
              height: val,
            },
          },
          skipTrace: !!validateTemplateHeight(val, measurementUnit),
        })
      }, TEMPLATE_DIMENSION_DEBOUNCE_TIME) // TEMPLATE_DIMENSION_DEBOUNCE_TIMEms debounce

      timeoutIdRef.current = newTimeoutId
    },
    [trackEvent, otherConfigs, measurementUnit]
  )

  return <HeightTextField measurementUnit={measurementUnit} t={t} value={localHeight} setValue={updateHeight} />
}

function MeasurementUnitCanvasInputField() {
  const { t } = useTranslation()
  const { measurementUnit } = useCanvasDimension()
  const { trackEvent } = useEventsTracking()

  // Local state for immediate feedback
  const [localUnit, setLocalUnit] = useState<MEASUREMENT_UNIT>(measurementUnit)
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state with store when store changes
  useEffect(() => {
    setLocalUnit(measurementUnit)
  }, [measurementUnit])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
    }
  }, [])

  const updateMeasurementUnit = useCallback(
    (val: MEASUREMENT_UNIT) => {
      // Update local state immediately for responsive UI
      setLocalUnit(val)

      // Clear any pending timeouts
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }

      // Create a new timeout for store update
      const newTimeoutId = setTimeout(() => {
        trackEvent(EVENTS_TRACKING.EDIT_DIMENSION_AND_RESOLUTION, {
          [EVENTS_PARAMETERS_NAME.MEASUREMENT_UNIT]: val,
        })

        TemplateEditorStore.dispatch({
          type: 'SET_MEASUREMENT_UNIT',
          payload: {
            fromUnit: measurementUnit,
            toUnit: val,
          },
        })
      }, TEMPLATE_DIMENSION_DEBOUNCE_TIME) // TEMPLATE_DIMENSION_DEBOUNCE_TIMEms debounce

      timeoutIdRef.current = newTimeoutId
    },
    [measurementUnit, trackEvent]
  )

  return <MeasurementUnits t={t} value={localUnit} setValue={updateMeasurementUnit} />
}

function ResolutionCanvasInputField() {
  const { t } = useTranslation()
  const { resolution } = useCanvasDimension()
  const { trackEvent } = useEventsTracking()

  // Local state for immediate feedback
  const [localResolution, setLocalResolution] = useState(resolution)
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state with store when store changes
  useEffect(() => {
    setLocalResolution(resolution)
  }, [resolution])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
    }
  }, [])

  const updateResolution = useCallback(
    (val: number) => {
      // Update local state immediately for responsive UI
      setLocalResolution(val)

      // Clear any pending timeouts
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }

      // Create a new timeout for store update
      const newTimeoutId = setTimeout(() => {
        trackEvent(EVENTS_TRACKING.EDIT_DIMENSION_AND_RESOLUTION, {
          [EVENTS_PARAMETERS_NAME.NEW_RESOLUTION]: val,
        })

        TemplateEditorStore.dispatch({
          type: 'SET_RESOLUTION',
          payload: {
            toResolution: val,
          },
        })
      }, TEMPLATE_DIMENSION_DEBOUNCE_TIME) // TEMPLATE_DIMENSION_DEBOUNCE_TIMEms debounce

      timeoutIdRef.current = newTimeoutId
    },
    [trackEvent]
  )

  return <ResolutionField t={t} value={localResolution} setValue={updateResolution} />
}
