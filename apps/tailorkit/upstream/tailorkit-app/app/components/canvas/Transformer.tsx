import type Konva from 'konva'
import type { ComponentProps, RefObject } from 'react'
import { Transformer } from 'react-konva'
import { Fragment } from 'react/jsx-runtime'
import { LAYER_STROKE_COLOR, LAYER_STROKE_WIDTH, ROTATION_SNAPS } from '~/constants/canvas'

interface ITransformerToolProps {
  trRef: RefObject<Konva.Transformer | null>
  interactive?: boolean
}

type TransformerProps = ComponentProps<typeof Transformer>

/**
 * This component is served for displaying and interacting with layer elements
 *
 * @param props ITransformerToolProps
 * @returns {React.ReactElement}
 */

export default function TransformerTool(props: ITransformerToolProps & TransformerProps) {
  const { trRef, interactive, ...otherProps } = props

  return (
    <Fragment>
      <Transformer
        ref={trRef}
        visible={interactive}
        anchorCornerRadius={20}
        anchorFill={LAYER_STROKE_COLOR}
        borderStroke={LAYER_STROKE_COLOR}
        borderStrokeWidth={LAYER_STROKE_WIDTH}
        ignoreStroke={true}
        boundBoxFunc={(oldBox, newBox) => {
          // limit resize
          if (newBox.width < 5 || newBox.height < 5) {
            return oldBox
          }
          return newBox
        }}
        onTransform={(evt: any) => {
          if (!trRef.current) return

          const isShiftKey = evt.evt.shiftKey

          if (isShiftKey) {
            trRef.current.rotationSnaps(ROTATION_SNAPS)
          } else {
            trRef.current.rotationSnaps([])
          }
        }}
        {...otherProps}
      />
    </Fragment>
  )
}
