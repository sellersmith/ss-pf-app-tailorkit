import TemplateEditorProviders from '~/modules/TemplateEditor/components/TemplateEditorProviders'
import IntegrationEditorProvider from './IntegrationEditorProvider'

/**
 * Unified Editor Provider
 *
 * This provider wraps the integration editor and template editor providers.
 * It is used to provide the integration editor and template editor providers to the children components.
 *
 * @param {Object} props - The props for the UnifiedEditorProvider component.
 * @param {React.ReactNode} props.children - The children components to be wrapped.
 * @returns {React.ReactNode} The wrapped components.
 */
export default function UnifiedEditorProvider(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <IntegrationEditorProvider>
      <TemplateEditorProviders>{children}</TemplateEditorProviders>
    </IntegrationEditorProvider>
  )
}
