import { Box } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import ClipartList from './components/ClipartList'
import { ClickContext } from '~/models/ClipartClickEvent'

// Stable categories array to avoid re-renders
const FONT_COMBINATION_CATEGORIES: string[] = ['Font combinations']

/**
 * Font Combination Tool Panel — displays category-filtered font combination
 * cliparts. Reuses the same data pipeline as TextToolPanel but without the
 * text input/add-text controls.
 */
export default function FontCombinationToolPanel() {
  const { t } = useTranslation()

  return (
    <Box padding="400">
      <ClipartList
        trackingContext={ClickContext.EDITOR_TEXT_PANEL_FONTS_COMBINED}
        categories={FONT_COMBINATION_CATEGORIES}
        columns={2}
        gapPx={8}
        showTitle={false}
        showTitleOnHover={true}
        lazy={true}
        emptyStateMessage={t('no-font-combinations-found')}
      />
    </Box>
  )
}
