import { BlockStack, Button, Popover, Select, Text } from '@shopify/polaris'
import type { Stage } from 'konva/lib/Stage'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TOAST } from '~/constants/toasts'
import {
  downloadBlob,
  exportLayersAsBlob,
  generateExportFilename,
  type ExportLayerOptions,
} from '~/modules/TemplateEditor/utilities/exportLayers'
import type { TLayerStore } from '~/stores/modules/layer'
import { showToast } from '~/utils/toastEvents'

interface ExportLayersPopoverProps {
  open: boolean
  anchor: { x: number; y: number }
  layerStores: TLayerStore[]
  stageRef: React.RefObject<Stage | null>
  onClose: () => void
}

const FORMAT_OPTIONS = [
  { label: 'PNG', value: 'png' },
  { label: 'JPG', value: 'jpg' },
]

const SCALE_OPTIONS = [
  { label: '1x', value: '1' },
  { label: '2x', value: '2' },
  { label: '3x', value: '3' },
]

/** Horizontal offset to prevent overlap with context menu */
const POPOVER_HORIZONTAL_OFFSET = 130

export function ExportLayersPopover({ open, anchor, layerStores, stageRef, onClose }: ExportLayersPopoverProps) {
  const { t } = useTranslation()
  const [format, setFormat] = useState<ExportLayerOptions['format']>('png')
  const [scale, setScale] = useState<ExportLayerOptions['scale']>(2)
  const [loading, setLoading] = useState(false)

  const handleExport = useCallback(async () => {
    if (!stageRef.current || !layerStores.length) return

    setLoading(true)
    try {
      const layerIds = layerStores.map(ls => ls.getState()._id)
      const layerStates = layerStores.map(ls => ls.getState())

      const blob = await exportLayersAsBlob(stageRef.current, layerIds, layerStates, { format, scale })

      const layerNames = layerStates.map(s => s.label || 'layer')
      const filename = generateExportFilename(layerNames, format, scale)

      downloadBlob(blob, filename)
      showToast(t(TOAST.COMMON.EXPORTED))
      onClose()
    } catch (error) {
      console.error('Export failed:', error)
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    } finally {
      setLoading(false)
    }
  }, [stageRef, layerStores, format, scale, t, onClose])

  // Hidden activator at click position (same pattern as CanvasContextMenu)
  const activator = (
    <div
      role="presentation"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: anchor.y,
        left: anchor.x + POPOVER_HORIZONTAL_OFFSET,
        width: 0,
        height: 0,
        zIndex: 9999,
      }}
    />
  )

  const title = layerStores.length > 1 ? t('export-layers') : t('export-layer')

  return (
    <Popover active={open} activator={activator} onClose={onClose} preferredPosition="mostSpace">
      <Popover.Section>
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm">
            {title}
          </Text>

          <Select
            label={t('format')}
            options={FORMAT_OPTIONS}
            value={format}
            onChange={v => setFormat(v as ExportLayerOptions['format'])}
          />

          <Select
            label={t('scale')}
            options={SCALE_OPTIONS}
            value={String(scale)}
            onChange={v => setScale(Number(v) as ExportLayerOptions['scale'])}
          />

          <Button variant="primary" onClick={handleExport} loading={loading}>
            {t('export')}
          </Button>
        </BlockStack>
      </Popover.Section>
    </Popover>
  )
}
