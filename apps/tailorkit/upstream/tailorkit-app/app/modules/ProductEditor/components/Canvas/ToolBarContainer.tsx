import ToolBar from '~/components/canvas/ToolBar'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import MockupDownloadButton from './MockupDownloadButton'

export function ToolBarContainer() {
  const { mode, quickTools, onModeChangeHandler, onQuickToolsChangeHandler } = useTools()

  return (
    <ToolBar
      mode={mode}
      quickTools={quickTools}
      onModeChange={onModeChangeHandler}
      onQuickToolsChange={onQuickToolsChangeHandler}
      extraTools={<MockupDownloadButton />}
    />
  )
}
