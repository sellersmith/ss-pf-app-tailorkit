import { BlockStack, Box } from '@shopify/polaris'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AccordionList } from '~/components/Accordion'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import withMockup from '~/modules/ProductEditor/withMockup'
import { PrintAreaTemplateItem } from './PrintAreaTemplateItem'

interface IPrintAreaTemplateProps extends WithVariantsProps {}

function PrintAreaTemplate(props: IPrintAreaTemplateProps) {
  const { variants, mockupId } = props
  const { t } = useTranslation()

  const firstVariant = useMemo(() => variants[0], [variants])
  const selectedViewId = firstVariant.mockup.selectedViewId || firstVariant.mockup.views?.[0]?._id || ''

  // Get print areas of variant
  const printAreas = useMemo(() => firstVariant.printAreas, [firstVariant.printAreas])

  return (
    <AccordionList
      items={[
        {
          open: true,
          id: 'print-area-template-inspector',
          label: t('template-manager'),
          content: (
            <Box borderBlockStartWidth="025" borderColor="border" paddingBlockStart={'100'}>
              <BlockStack gap={'400'}>
                {printAreas.map(printArea => {
                  return (
                    <Box key={printArea._id} borderBlockEndWidth="025" borderColor="border" paddingBlockEnd={'150'}>
                      <PrintAreaTemplateItem
                        productVariant={firstVariant}
                        mockupId={mockupId}
                        printArea={printArea}
                        viewId={selectedViewId}
                      />
                    </Box>
                  )
                })}
              </BlockStack>
            </Box>
          ),
        },
      ]}
    />
  )
}

export default withMockup(PrintAreaTemplate)
