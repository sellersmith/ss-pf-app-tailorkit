import { type ReactNode } from 'react'
import { TEMPLATE_EDITOR_CANVAS_CONTAINER } from '~/constants/canvas'
import ButtonSaveCanvasAsImage from '~/modules/TemplateEditor/components/Preview/components/ButtonSaveCanvasAsImage'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import useDevices from '~/utils/hooks/useDevice'

export function PreviewMainLayout(props: { children: ReactNode; customHeight?: string }) {
  const { isSmallDesktopView } = useDevices()
  return (
    //  1 column on extra small screens
    //  2 columns on other screens
    <div style={{ width: '100%', height: props.customHeight, minHeight: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isSmallDesktopView ? '1fr' : 'minmax(0, 1fr) clamp(280px, 28vw, 420px)',
          // gap: 'var(--p-space-300)',
          alignItems: 'stretch',
          height: '100%',
        }}
      >
        {props.children}
      </div>
    </div>
  )
}

export function PreviewCanvasLayout(props: { children: ReactNode; showSaveButton?: boolean; height?: string }) {
  const { isRulerModeVisible } = useTools()
  const { showSaveButton = true, children } = props || {}
  const { isSmallDesktopView } = useDevices()

  return (
    <div
      style={{
        width: '100%',
        height: isSmallDesktopView ? props.height || '100%' : '100%',
        minHeight: '200px',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--p-color-bg-surface)',
          ...(!isRulerModeVisible ? { borderRadius: 'var(--p-border-radius-200)' } : {}),
        }}
      >
        <div
          className={TEMPLATE_EDITOR_CANVAS_CONTAINER}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          {showSaveButton && <ButtonSaveCanvasAsImage />}
          {children}
        </div>
      </div>
    </div>
  )
}

export function PreviewInspectorLayout(props: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'var(--p-color-bg)',
      }}
    >
      {props.children}
    </div>
  )
}
