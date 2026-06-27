import { useSearchParams } from '@remix-run/react'
import {
  BlockStack,
  Box,
  Button,
  Checkbox,
  Divider,
  Form,
  FormLayout,
  InlineGrid,
  Text,
  TextField,
} from '@shopify/polaris'
import { ClipboardIcon } from '@shopify/polaris-icons'
import { ProductPersonalizerCustomizerWebComponentTag } from 'extensions/tailorkit-src/src/assets/constants'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from '~/components/CopyToClipboard/CopyToClipboard'
import GetHelpMessage from '~/components/GetHelpMessage'
import { TOAST } from '~/constants/toasts'
import { DEFAULT_APP_BLOCK_INSTALLATION_SETTINGS } from 'extensions/tailorkit-src/src/assets/constants/app-block'
import type { AppBlockInstallationSettings } from '~/routes/api.app_proxy.product-variant-integration/type'
import { showToast } from '~/utils/toastEvents'

// Define the actual script as a function for better IDE support and type checking
const generateInitFunction = (appHandle: string, settings: AppBlockInstallationSettings) => {
  // This will be converted to string later
  return `
    // Capture the container element immediately — document.currentScript is null once we await,
    // and document.querySelector would race when multiple customizers exist on the same page
    // (e.g. quick-view modal + PDP for the same product).
    const container = document.currentScript && document.currentScript.closest('${ProductPersonalizerCustomizerWebComponentTag}');
    if (!container) return;

    const url = '/apps/${appHandle}/app_proxy/product-variant-integration';

    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        productId: '{{ product.id }}',
        variantId: '{{ product.selected_or_first_available_variant.id }}',
        settings: ${JSON.stringify(settings)}
      })
    });

    if (!response.ok) {
      console.error('===> Error fetching product variant integration:', response.statusText);
      return;
    }

    const data = await response.json();
    const { assets: { html, css, scripts } } = data;

    // Parse the server HTML into a detached element, then replace the original container.
    // Using a template avoids the nested-customizer trap that webComponent.innerHTML = html
    // would create (server HTML includes the outer tag with full metafield attrs).
    const template = document.createElement('template');
    template.innerHTML = html;
    const newEl = template.content.firstElementChild;
    if (!newEl) return;
    container.replaceWith(newEl);

    // INVARIANT: scripts MUST be appended synchronously in order. textContent-inline scripts
    // run immediately on connection; feature bundles (TailorKitKonva etc.) register window
    // globals so tailorkit.js (last) finds them via getWindowFeature() without src detection.
    // Do NOT switch any entry to script.src = ... without reworking the ordering contract.
    (scripts || []).forEach(s => {
      if (!s || !s.content) return;
      newEl.appendChild(document.createElement('script')).textContent = s.content;
    });
    newEl.appendChild(document.createElement('style')).textContent = css;
  `
}

export function VintageThemeTailorKitInstallation(props: { onCloseModal?: () => void }) {
  const { onCloseModal } = props
  const { t } = useTranslation()
  const [codeSnippet, setCodeSnippet] = useState('')
  const [searchParams] = useSearchParams()
  const featureImageContainer = searchParams.get('featureImageContainer')

  const [settings, setSettings] = useState({
    ...DEFAULT_APP_BLOCK_INSTALLATION_SETTINGS,
    ...(featureImageContainer ? { featured_image_container_selector: featureImageContainer } : {}),
  })

  const onChangeSettings = useCallback(
    (partialSettings: Partial<typeof settings>) =>
      setSettings({
        ...settings,
        ...partialSettings,
      }),
    [settings]
  )

  const minifiedScript = useMemo(() => {
    // Get runtime variables before converting to string
    const appHandle = window.PUBLIC_ENV.APP_HANDLE

    // Get the script with variables already interpolated
    const scriptString = generateInitFunction(appHandle, settings)

    // Minify the script.
    // IMPORTANT: strip `//` line comments BEFORE collapsing newlines — otherwise a comment
    // on one line consumes every statement after it when everything becomes single-line,
    // producing a `SyntaxError: Unexpected end of input` on the merchant's theme.
    return scriptString
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\s*([=>(){},:])\s*/g, '$1')
      .replace(/[\r\n]\s*/g, '')
      .replace(/;\s*;/g, ';')
  }, [settings])

  useEffect(() => {
    const snippet = `
      <${ProductPersonalizerCustomizerWebComponentTag}
          data-product-id="{{ product.id }}"
          data-variant-id="{{ product.selected_or_first_available_variant.id }}">
          <script>;(async()=>{${minifiedScript}})();</script>
      </${ProductPersonalizerCustomizerWebComponentTag}>`.trim()

    setCodeSnippet(snippet)
  }, [minifiedScript])

  return (
    <BlockStack gap={'200'}>
      <Text as="p" variant="bodyMd">
        {t('customize-the-settings-on-the-left-and-add-the-snippet-on-the-right-to-your-theme-code')}
      </Text>

      <Box background="bg-surface-secondary" borderRadius={'200'}>
        <InlineGrid columns={['oneThird', 'twoThirds']}>
          <Box
            minHeight={'100%'}
            borderColor="border"
            borderInlineEndWidth="025"
            paddingInlineEnd={'400'}
            padding={'400'}
          >
            <BlockStack gap={'200'}>
              <BlockStack gap={'150'}>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {t('general')}
                </Text>

                <TextField
                  autoComplete="off"
                  label={t('personalized-design-title')}
                  helpText={
                    <Text as="p" variant="bodySm">
                      {t('personalized-design-title-help-text')}
                    </Text>
                  }
                  value={settings.personalized_design_title}
                  onChange={value => onChangeSettings({ personalized_design_title: value })}
                />
              </BlockStack>
              <Divider borderColor="border" />
              <BlockStack gap={'150'}>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {t('advanced')}
                </Text>

                <TextField
                  autoComplete="off"
                  label={t('featured-image-container-selector')}
                  helpText={
                    <Text as="p" variant="bodySm">
                      {t('featured-image-container-selector-help-text')}
                    </Text>
                  }
                  value={settings.featured_image_container_selector}
                  onChange={value => onChangeSettings({ featured_image_container_selector: value })}
                />

                <Checkbox
                  label={t('always-render-live-preview')}
                  checked={settings.always_render_live_preview}
                  onChange={() =>
                    onChangeSettings({ always_render_live_preview: !settings.always_render_live_preview })
                  }
                />
              </BlockStack>
            </BlockStack>
          </Box>
          <Box position="sticky" insetBlockStart="0" padding={'400'}>
            <Form onSubmit={() => {}}>
              <FormLayout>
                <TextField
                  readOnly
                  multiline={8}
                  maxHeight={300}
                  autoComplete="off"
                  value={codeSnippet}
                  label="TailorKit Embed Code"
                  size="slim"
                />
                <CopyToClipboard text={codeSnippet} onCopy={() => showToast(t(TOAST.COMMON.COPIED_TO_CLIPBOARD))}>
                  <Button id={'copy_code'} icon={ClipboardIcon}>
                    {t('copy-code')}
                  </Button>
                </CopyToClipboard>
              </FormLayout>
            </Form>
          </Box>
        </InlineGrid>
      </Box>

      <GetHelpMessage t={t} onOpenChatBoxCallback={onCloseModal} />
    </BlockStack>
  )
}
