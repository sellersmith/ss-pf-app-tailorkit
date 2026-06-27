# Integration Preview - Live Template Rendering

This implementation adds live template rendering to the integration preview, allowing users to see instant updates when changing option sets in the inspector.

## Architecture

### Components

1. **TemplateLayerPreview** - Renders template layers dynamically using Konva
2. **TemplateLayerStoresProvider** - Manages template layer stores for live updates
3. **LayersIntegration** - Updated to use live rendering for template layers

### Flow

1. **Template Loading**: Templates are fetched and layer stores are created
2. **Context Setup**: `TemplateLayerStoresProvider` caches layer stores by template ID
3. **Live Rendering**: `TemplateLayerPreview` renders template layers using the same stores as the inspector
4. **Instant Updates**: When options change in the inspector, the canvas updates immediately

## Key Features

### Performance Optimizations

- **Lazy Loading**: Only renders templates that are visible or have active changes
- **Store Caching**: Layer stores are cached to avoid recreation
- **Selective Rendering**: Only template layers use live rendering; image layers remain static

### Live Updates

- **Option Changes**: Instant visual feedback when selecting colors, fonts, text, etc.
- **Conditional Logic**: Supports show/hide layers based on option selections
- **Multi-layout Support**: Handles complex layout switching

### Positioning & Transform

- **Exact Positioning**: Templates render at their exact mockup positions
- **Clipping Masks**: Supports clipping masks for precise template boundaries
- **Rotation & Scaling**: Maintains all transform properties

## Usage

### Basic Setup

```tsx
// Wrap your preview component with the provider
<TemplateLayerStoresProvider templates={templates}>
  <IntegrationCanvasComponent />
</TemplateLayerStoresProvider>
```

### Template Layer Stores

```tsx
// Access template layer stores in components
const { getTemplateLayerStores } = useTemplateLayerStores()
const layerStores = getTemplateLayerStores(templateId)
```

## Benefits

1. **Instant Feedback**: No server round-trips for option changes
2. **WYSIWYG Experience**: What you see is exactly what customers will see
3. **Performance**: Optimized for typical use cases (2-5 templates)
4. **Consistency**: Uses the same rendering logic as the storefront

## Limitations

1. **Browser Performance**: Complex templates with many layers may impact performance
2. **Memory Usage**: Higher memory usage compared to static bitmaps
3. **Mobile Devices**: May need fallback to static rendering on low-end devices

## Future Enhancements

1. **Performance Monitoring**: Add automatic fallback to static rendering
2. **Caching Strategy**: Implement template result caching
3. **Mobile Optimization**: Device-specific rendering strategies
