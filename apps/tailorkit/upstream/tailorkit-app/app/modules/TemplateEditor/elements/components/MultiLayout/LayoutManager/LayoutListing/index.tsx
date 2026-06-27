import { BlockStack, Box, Button, Divider, InlineStack, Text } from '@shopify/polaris'
import { PlusIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { ILayoutManagerProps } from '..'
import LayoutItem from './LayoutItem'
import ButtonAddStaticLayers from './ButtonAddStaticLayers'

function LayoutListing(props: ILayoutManagerProps) {
  const {
    layouts,
    onAddMoreLayout,
    onAddStaticLayers,
    checkExistedLayerHasNoOptionSet,
    onNavigateToOutlineToCreateOptionSet,
    ...otherProps
  } = props

  const { t } = useTranslation()

  return (
    <Box padding={'200'} background="bg" borderRadius="100">
      <BlockStack gap={'200'}>
        <BlockStack gap={'100'}>
          <Text as="h4" variant="bodyMd">
            {t('add-static-layers-to-layouts')}
          </Text>

          <Text as="p" variant="bodyMd" tone="subdued">
            {t('add-static-layers-to-layouts-description')}
          </Text>
          <InlineStack align="end">
            <ButtonAddStaticLayers
              onAddStaticLayers={onAddStaticLayers}
              checkExistedLayerHasNoOptionSet={checkExistedLayerHasNoOptionSet}
              onNavigateToOutlineToCreateOptionSet={onNavigateToOutlineToCreateOptionSet}
            />
          </InlineStack>
          <Divider borderColor="border" />
        </BlockStack>

        <BlockStack gap={'200'}>
          {layouts.map((layout, index) => {
            return <LayoutItem key={layout._id} index={index} {...layout} {...otherProps} />
          })}
        </BlockStack>

        <InlineStack align="end">
          <Button variant="plain" icon={PlusIcon} onClick={onAddMoreLayout}>
            {t('add-layout')}
          </Button>
        </InlineStack>
      </BlockStack>
    </Box>
  )
}

export default LayoutListing
