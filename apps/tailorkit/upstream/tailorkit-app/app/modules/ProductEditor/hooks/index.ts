// Main composable hook - use this in ProductEditor component
export { useUnifiedEditor } from './useUnifiedEditor'

// Individual hooks - exported for testing or custom composition
export { useIntegrationInitialization } from './useIntegrationInitialization'
export { useUnifiedEditorCleanup } from './useUnifiedEditorCleanup'
export { useUnifiedInspectorWidth } from './useUnifiedInspectorWidth'

// Existing hooks
export { default as useInitIntegration } from './useInitIntegration'
export { default as useDesignPreview } from './useDesignPreview'
export { useEditorParams } from './useEditorParams'
export { default as useSaveIntegration } from './useSaveIntegration'
export { default as useUnifiedDiscard } from './useUnifiedDiscard'
export { default as useUnifiedSave } from './useUnifiedSave'
export { default as useViewport } from './useViewport'
export { useVariantSelectionModal } from './useVariantSelectionModal'
