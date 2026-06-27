import type { IZoomComponentProps } from '~/components/canvas/Zoom'
import { ZoomComponent } from '~/components/canvas/Zoom'
import { useTools } from '../hooks/useTools'

export const ZoomComponentContainer = (props: IZoomComponentProps) => {
  const { isGrabbing } = useTools()

  return (
    <ZoomComponent {...props} isGrabbing={isGrabbing}>
      {props.children}
    </ZoomComponent>
  )
}
