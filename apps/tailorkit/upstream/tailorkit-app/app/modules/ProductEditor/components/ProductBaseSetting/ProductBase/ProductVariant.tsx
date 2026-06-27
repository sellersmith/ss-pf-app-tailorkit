import { Box, Divider } from '@shopify/polaris'
import type { VariantIntegration } from '~/types/integration'
import type { IProductBaseContainerProps } from '.'
import PreviewIntegration from '../../Preview/index.client'
import { SectionWrapper } from '../../SectionWrapper'
import MockupViewsManager from '../../IntegrationInspector/Integrate/MockupViewsManager'
import { useEditorParams } from '~/modules/ProductEditor/hooks'

interface IProductVariantProps {
  variants: VariantIntegration[]
}

function ProductVariant(props: IProductVariantProps & IProductBaseContainerProps) {
  const { variants, previewMode } = props

  const firstVariant = variants[0]

  const mockupId = firstVariant.mockup._id

  const { mockupId: mockupIdFromParams } = useEditorParams()

  const isActive = mockupId === mockupIdFromParams

  return (
    <s-box>
      {!previewMode && (
        <>
          <Divider />

          {isActive && (
            <s-box>
              {/* <ProductActiveSetting /> */}
              {/* <Accordion
                id="create-personalization"
                label={t('create-personalization')}
                open={true}
                content={<PrintAreasContainer />}
              /> */}

              {/* <Accordion
                id="set-up-mockup"
                label={t('set-up-mockup')}
                open={false}
                content={ */}
              <Box paddingInline={'300'}>
                <SectionWrapper>
                  <MockupViewsManager />
                </SectionWrapper>
              </Box>
              {/* }
              /> */}
            </s-box>
          )}
        </>
      )}

      {previewMode && (
        <>
          <Divider />
          <PreviewIntegration />
        </>
      )}
    </s-box>
  )
}

export default ProductVariant
