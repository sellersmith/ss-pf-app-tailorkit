import { Box, BlockStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import EditorColorPicker from '~/components/common/ColorPicker'
import { DEBOUNCE_REQUEST_MINOR } from '~/constants/debounce'
import { DEFAULT_TEXT_COLOR } from '~/constants/inspector/text'
import { useTourStatus } from '~/utils/hooks/useTourStatus'

interface IStrokeColorProps {
  strokeColor: string
  onChangeStrokeColor: (value: string) => void
}

export const StrokeColor = (props: IStrokeColorProps) => {
  const { t } = useTranslation()
  const { strokeColor, onChangeStrokeColor } = props

  const { tourId, active: tourActive } = useTourStatus()
  const isInTour = !!tourId && tourActive

  // Set the preferred position of the popover
  const preferredPosition = isInTour ? 'above' : 'below'

  return (
    <Box>
      <BlockStack gap={'150'}>
        <Text as="p" variant="bodyMd">
          {t('stroke-color')}
        </Text>
        <EditorColorPicker
          id="stroke-color"
          placeholder={DEFAULT_TEXT_COLOR}
          value={strokeColor}
          preferredPosition={preferredPosition}
          debounceMs={DEBOUNCE_REQUEST_MINOR}
          onChange={color => {
            onChangeStrokeColor(color)
          }}
        />
      </BlockStack>
    </Box>
  )
}
