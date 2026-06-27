import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStore } from '~/stores/modules/template'
import { clearAllSelectedLayerStores } from '~/stores/modules/layer-store-selection'
import CardCanvas from './CardCanvas'
import StylingToolBarContainer from './StylingToolBarContainer'
import ButtonExpandOutlineContainer from './ButtonExpandOutlineContainer'
import { useTools } from '../../hooks/useTools'

export default function TemplateEditorCanvas() {
  const extractedLayerStores: TLayerStore[] = useStore(TemplateEditorStore, state => state.extractedLayerStores)

  return (
    <div
      // Clear layer selection when clicking the background area around the canvas.
      // Konva handles deselect for clicks inside the stage; this covers the padding/gutter area
      // that doesn't receive Konva events, so the inspector closes on any canvas-area click.
      // Guard: skip when click lands on the <canvas> element itself (Konva owns that path)
      // or inside the floating styling toolbar (buttons like font family, color, etc.).
      onMouseDown={e => {
        const target = e.target as HTMLElement
        if (target.tagName === 'CANVAS') return
        if (target.closest('#styling-toolbar')) return
        // React portals (Polaris Modal, popovers, etc.) bubble synthetic events through
        // the React component tree, but their DOM nodes live outside this div (on document.body).
        // Skip deselection when the actual DOM click target is outside this container.
        if (!e.currentTarget.contains(target)) return
        clearAllSelectedLayerStores()
      }}
      style={{
        background: 'var(--p-color-bg-fill-disabled)',
        padding: 'var(--p-space-200)',
        height: '100%',
        position: 'relative',
      }}
    >
      <ButtonExpandOutlineContainer />
      <StylingToolBarContainer />
      <CardCanvasContainer>
        <CardCanvas extractedLayerStores={extractedLayerStores} />
      </CardCanvasContainer>
    </div>
  )
}

function CardCanvasContainer(props: { children: React.ReactNode | React.ReactNode[] }) {
  const { isRulerModeVisible } = useTools()

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--p-color-bg-surface)',
        position: 'relative',
        ...(!isRulerModeVisible ? { borderRadius: 'var(--p-border-radius-200)' } : {}),
      }}
    >
      {props.children}
    </div>
  )
}
