export type TemplateElementProps<T extends keyof JSX.IntrinsicElements | ComponentType<any> = 'div'> =
  ComponentProps<T> & {
    // Layer store associated with the element
    layerStore: TLayerStore
    // Type of layer
    type?: LayerType
    // Is preview mode
    previewMode?: boolean
    // The context in which the element is rendered
    renderContext?: 'outline' | 'canvas' | 'inspector'
    // The function to render the option inspector if need override
    renderOptionSetInspector?: () => React.ReactNode
    // The scrollable height of the inspector container
    inspectorContainerHeight?: number | string
    // Callback function that will be executed when data of the element changed
    onChange?: (id: string, data: LayerDocument) => void
    // Callback function that will be executed when data validation fails
    onValidation?: (id: string, dataKey: string, message: Error | null) => void
  }

export type TemplateElementState = ComponentState &
  LayerDocument & {
    error?: Error
  }

export type InspectorControlComponentProps = {
  value?: any
  dataKey?: string
  onChange: (key: string | object, value?: any) => void
}
