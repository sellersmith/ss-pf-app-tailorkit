import { Button, InlineStack, Tooltip } from '@shopify/polaris'
import { RedoIcon, UndoIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { isMacOS } from '~/bootstrap/fns/os'
import { useUndoRedo } from './hooks/useUndoRedo'

const UndoRedo = () => {
  const isMac = isMacOS()
  const { t } = useTranslation()
  const { canRedo, canUndo, onUndo, onRedo } = useUndoRedo()

  return (
    <InlineStack gap="200" blockAlign="center" align="center">
      <Tooltip content={`${t('undo')} (${isMac ? '⌘' : 'Ctrl'} + Z)`} preferredPosition="above">
        <InlineStack blockAlign="center">
          <Button
            id="pf-undo-btn"
            data-testid="pf-undo-btn"
            variant="tertiary"
            icon={UndoIcon}
            disabled={!canUndo}
            onClick={onUndo}
          />
        </InlineStack>
      </Tooltip>
      <Tooltip preferredPosition="above" content={`${t('redo')} (${isMac ? '⌘ + ⇧' : 'Ctrl + Shift'} + Z)`}>
        <InlineStack blockAlign="center">
          <Button
            id="pf-redo-btn"
            data-testid="pf-redo-btn"
            variant="tertiary"
            icon={RedoIcon}
            disabled={!canRedo}
            onClick={onRedo}
          />
        </InlineStack>
      </Tooltip>
    </InlineStack>
  )
}

export default UndoRedo
