import { BlockStack, Box, Button, Image, InlineStack } from '@shopify/polaris'
import { useCallback, useMemo } from 'react'
import { EXTRA_ICONS } from '~/constants/assets-url'
import { HeightTransformation } from '~/modules/TemplateEditor/components/Inspector/Transformation/HeightTransformation'
import { RotationTransformation } from '~/modules/TemplateEditor/components/Inspector/Transformation/RotationTransformation'
import { WidthTransformation } from '~/modules/TemplateEditor/components/Inspector/Transformation/WidthTransformation'
import { XTransformation } from '~/modules/TemplateEditor/components/Inspector/Transformation/XTransformation'
import { YTransformation } from '~/modules/TemplateEditor/components/Inspector/Transformation/YTransformation'
import type TemplateElement from '../..'
import {
  convertDegreesToRadians,
  getCenterPivotPoint,
  getCorner,
  getOriginalPoint,
  normalizeAngleToPositiveValue,
} from '~/utils/angle-fns'
import { syncDimensionMutation } from '~/utils/canvas/syncDimensionMutation'

interface TransformationPanelProps {
  element: TemplateElement<any, any>
  t: (key: string) => string
}

export function TransformationPanel({ element, t }: TransformationPanelProps) {
  const { width, height, left, top, rotate, constrainProportions, proportions } = element?.state || {}

  const syncIconState = useMemo(
    () =>
      constrainProportions
        ? {
            source: EXTRA_ICONS.SYNC_ICON,
            alt: t('sync-icon'),
          }
        : {
            source: EXTRA_ICONS.UN_SYNC_ICON,
            alt: t('un-sync-icon'),
          },
    [constrainProportions, t]
  )

  const setData = useCallback(
    (key: string | object, value?: any) => {
      element.setData(key, value)
    },
    [element]
  )

  const onSyncIconClick = useCallback(() => {
    if (constrainProportions) {
      setData({
        constrainProportions: false,
        proportions: null,
      })
    } else {
      setData({
        constrainProportions: true,
        proportions: width / height,
      })
    }
  }, [constrainProportions, setData, height, width])

  const onWidthTransformationChange = useCallback(
    (_key: string | object, value?: any) => {
      const key = _key as string
      const _width = Number(value)

      // Return if constrain proportions is false
      if (!constrainProportions || !proportions) {
        setData(key, _width)

        return
      }

      const dimension = syncDimensionMutation(
        {
          mutationMetric: _width,
          type: 'WIDTH',
        },
        proportions
      )

      setData(dimension)
    },
    [constrainProportions, proportions, setData]
  )

  const onLeftTransformationChange = useCallback(
    (_key: string | object, value?: any) => {
      const key = _key as string

      setData(key, Number(value))
    },
    [setData]
  )

  const onRotateTransformationChange = useCallback(
    (_key: string | object, value?: any) => {
      const _rotation = normalizeAngleToPositiveValue(+(value as string))

      const pivotPoint = getCenterPivotPoint(
        {
          x: left,
          y: top,
        },
        { width, height },
        rotate || 0
      )

      const originalPoint = getOriginalPoint(pivotPoint, { width, height })

      const topLeftCorner = getCorner(
        pivotPoint,
        { x: originalPoint.x, y: originalPoint.y },
        convertDegreesToRadians(_rotation || 0)
      )

      const updatedLeft = +topLeftCorner.x.toFixed(2)
      const updatedTop = +topLeftCorner.y.toFixed(2)

      setData({
        rotate: _rotation,
        top: updatedTop,
        left: updatedLeft,
      })
    },
    [height, left, rotate, top, width, setData]
  )

  const onHeightTransformationChange = useCallback(
    (_key: string | object, value?: any) => {
      const key = _key as string
      const _height = Number(value)

      // Return if constrain proportions is false
      if (!constrainProportions || !proportions) {
        setData({
          [key]: _height,
        })
        return
      }

      const dimension = syncDimensionMutation(
        {
          mutationMetric: _height,
          type: 'HEIGHT',
        },
        proportions
      )

      setData(dimension)
    },
    [constrainProportions, proportions, setData]
  )

  const onTopTransformationChange = useCallback(
    (_key: string | object, value?: any) => {
      const key = _key as string

      setData({
        [key]: Number(value),
      })
    },
    [setData]
  )

  return (
    <InlineStack gap={'200'} wrap={false} align="center">
      <InlineStack gap={'200'} wrap={false}>
        <BlockStack gap={'200'}>
          <WidthTransformation dataKey="width" value={width} onChange={onWidthTransformationChange} />
          <XTransformation dataKey="left" value={left} onChange={onLeftTransformationChange} />
          <RotationTransformation dataKey="rotate" value={rotate} onChange={onRotateTransformationChange} />
        </BlockStack>
        <BlockStack gap={'200'}>
          <HeightTransformation dataKey="height" value={height} onChange={onHeightTransformationChange} />
          <YTransformation dataKey="top" value={top} onChange={onTopTransformationChange} />
        </BlockStack>
      </InlineStack>
      <Box paddingBlockStart={'150'}>
        <Button
          icon={<Image source={syncIconState.source} alt={syncIconState.alt} style={{ display: 'block' }} />}
          variant="tertiary"
          onClick={onSyncIconClick}
        />
      </Box>
    </InlineStack>
  )
}
