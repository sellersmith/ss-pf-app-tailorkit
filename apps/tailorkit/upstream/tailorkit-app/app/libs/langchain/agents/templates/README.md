# Enhanced Template Agent Subsystem

This enhanced subsystem powers sophisticated AI-driven template creation for TailorKit. It translates detailed user design requests into high-quality, professionally composed templates with advanced visual elements, strategic positioning, and product-aware optimization.

## Recent Enhancements (v2.0)

### 🎨 **Improved Design Interpretation**

- **Direct User Intent Parsing**: Analyzes specific user requests (e.g., "two best friends", "cute pet", "balloons") and creates targeted visual elements
- **Advanced Style Translation**: Enhanced Canvas Style Engine with sophisticated design interpretation strategy
- **Character-Specific Generation**: Creates detailed prompts for human characters, pets, and specific decorative elements

### 🎯 **Professional Composition System**

- **Golden Ratio Positioning**: Uses mathematical principles for aesthetically pleasing element placement
- **Rule of Thirds Layout**: Strategic positioning at visual intersection points
- **Visual Hierarchy Management**: Primary, secondary, and decorative element classification with appropriate sizing
- **Balanced Composition**: Advanced algorithms ensure visual weight distribution across canvas quadrants

### 🖼️ **Enhanced Image Generation**

- **Layer-by-Layer Approach**: Inspired by ChatGPT's methodology, creates specific elements for each design component
- **Detailed Character Prompts**: Generates specific descriptions for people (clothing, pose, expressions)
- **Contextual Object Creation**: Creates thematically appropriate pets, decorative items, and backgrounds
- **Style Consistency**: Ensures all generated elements work cohesively together

### ✍️ **Richer Prompts & Safer Validation**

- **Richer Single-Subject Image Prompts**: `buildImagePrompt` now composes medium, framing, lighting, background, and detail level purely from available context (no hardcoded assumptions). It filters out sentences that mention other subjects and appends a concise single-subject constraint.
- **Background Layer Preservation**: When an IMAGE layer has `settings.imageType` containing `background`, background removal is disabled during generation to keep the designed backdrop intact.
- **Safe Cross-Reference Validation**: Image prompt validation escapes regex tokens and matches on word boundaries to avoid invalid regular expressions and false positives.
- **Text Style Frequency Boost**: The style designer prompt encourages tasteful use of text effects (e.g., `textShape` curves/arc/circle, `neonMode` + `neonIntensity`, `strokeColor` + `strokeWeight`, `shadowColor` + `shadowBlur` + `shadowOffset`) with HEX colors and readability constraints.

### 🔍 **Advanced Design Validation**

- **Quality Assurance Checks**: Validates visual hierarchy, element distribution, text readability
- **Composition Balance Analysis**: Detects clustering, poor distribution, and unbalanced layouts
- **Overlap Detection**: Identifies and reports element overlaps for better spacing
- **Production Safety**: Ensures elements meet print quality and sizing requirements

## Architecture & Structure

### Core Files

- `template.agent.ts`: Main AI agent coordinating template operations and supervisor integration
- `TemplateIntentAnalyzer.ts`: Classifies user requests into operation types with confidence scoring
- `TemplateOperationParameterExtractor.ts`: Extracts structured parameters from natural language requests
- `types.ts`: Core type definitions for template operations and data structures

### Services (`services/`)

- `TemplateComposer.ts`: High-level composition orchestrator (context → style → product → layers)
- `CanvasStyleEngine.ts`: Translates abstract styles into canvas-ready elements with caching
- `ProductCanvasAdapter.ts`: Adapts styles to product constraints and production requirements
- `TemplateReview.ts`: Quality validation and clarification system
- `FontService.ts`: Google Fonts resolution and management with singleton pattern
- `LayerExecuteService.ts`: Layer operation execution adapter
- `OptionExecuteService.ts`: Option set management for customization variants

### Core Processing (`core/`)

- `EditOrchestrator.ts`: Orchestrates template editing operations from intent to execution
- `Formatters.ts`: Result formatting utilities for consistent response structure
- **Executors (`core/executors/`)**:
  - `TemplateExecutor.ts`: Template-level operations with simulation support
  - `LayerExecutor.ts`: Layer operations including AI image generation
  - `OptionSetExecutor.ts`: Option set management for layer customization

### Context & Analysis (`context/`)

- `ContextAnalyzer.ts`: Extracts product/style/purpose context from prompts with dimension normalization
- `TemplateContextProvider.ts`: Template context provider without database dependencies

### Schema System (`schemas/`)

- `schema-registry.ts`: Centralized schema factory with pre-configured validation schemas
- `schema-builders.ts`: Centralized exports for consistent schema imports
- `layer.ts`: Layer validation schemas for AI agent operations
- `optionsSet.ts`: Option set schemas for customizable layer variants
- `templates.ts`: Template schema builders for visual elements and composition
- `common.ts`: Reusable validation primitives and complex objects

### Utilities (`utils/`)

- `prompt.ts`: JSON response parsing and formatting for LLM I/O
- `error-handling.ts`: Comprehensive error management with structured reporting
- `LRUCache.ts`: In-memory caching with TTL support and factory functions
- `retry.ts`: Retry mechanisms with exponential backoff and error context
- `textLayout.ts`: Text measurement and fitting utilities for canvas-free operations
- `buildTemplatePreviewBlock.ts`: Template preview block builder for AI chat interface
- `imagePromptBuilder.ts`: AI image prompt builder with size optimization and safety validation
- `sanitization.ts`: Security-focused input sanitization utilities

### Constants (`constants/`)

- `prompts.constants.ts`: AI prompt templates and constants for consistent LLM communication
- `style.constants.ts`: Style constants, configuration, and semantic context definitions
- `schema-enums.ts`: Centralized validation enums for schema consistency

## Processing Flow

### Template Creation Pipeline

1. **Intent Analysis**: `TemplateIntentAnalyzer.analyzeTemplateIntent` classifies user requests
2. **Template Creation** (`template_create` intent):
   - **Review Gate**: `TemplateReview.ensureContextOrClarify` validates context sufficiency
   - **Composition Pipeline**: `TemplateComposer.createTemplate`
     - Context extraction via `ContextAnalyzer.analyzeContext`
     - Style mapping via `CanvasStyleEngine.mapStyleToCanvasElements`
     - Product adaptation via `ProductCanvasAdapter.composeForProduct`
     - Layer finalization and metadata mapping
3. **Editing Operations** (`layer_modify`/`option_set_modify` intents):
   - **Orchestration**: `EditOrchestrator.handleEditOperation`
   - **Parameter Extraction**: `TemplateOperationParameterExtractor.extractParameters`
   - **Execution**: Via appropriate executors (`LayerExecutor`, `OptionSetExecutor`, `TemplateExecutor`)
   - **Result Formatting**: `Formatters.formatEditResponse`

### Data Flow

```
User Request → Intent Analysis → Context Extraction → Style Mapping →
Product Adaptation → Layer Generation → Validation → Response Formatting
```

## Public APIs (selected)

- `TemplateAgent.canHandle(query, context?) => Promise<boolean>`
- `TemplateAgent.process({ query, conversationHistory?, context? }) => Promise<string>`
- `TemplateAgent.streamProcess({ query, conversationHistory?, context?, onChunk }) => Promise<string>`

- `TemplateIntentAnalyzer.analyzeTemplateIntent(query, history?) => Promise<{
  intentType: 'template_create'|'layer_modify'|'option_set_modify'|'general_template'|'unknown',
  confidence: number, operation: string, needsContext: boolean, contextLevel: 'none'|'partial'|'sufficient'
}>`

- `ContextAnalyzer.analyzeContext(prompt, history?) => Promise<TemplateContext>`
  - Returns product/style/purpose with `printableAreas` normalized to px at `resolution=300`.

- `TemplateComposer.createTemplate(prompt, onChunk?, history?) => Promise<string>`

## Usage

```ts
import { TemplateAgent } from '~/libs/langchain/agents/templates/template.agent'

const agent = new TemplateAgent()

const can = await agent.canHandle(userQuery, { conversationHistory })
if (can) {
  const result = await agent.process({ query: userQuery, conversationHistory })
  // or streaming:
  // const result = await agent.streamProcess({ query: userQuery, conversationHistory, onChunk })
}
```

## Design notes

- Lightweight in-memory caches for intents; per-process, auto-expiring.
- Dimensions normalized to px for consistent canvas operations; default resolution=300.
- Clear separation of concerns: context → style → product → composition → review.
- Streaming supported; review gate prevents heavy composition if context is missing.

## Testing

- Place tests under `tests/libs/langchain/agents/templates/**` (Vitest).
- Cover: intent classification (EP/BVA), context extraction, style mapping, product adaptation, and full composition paths.

## Related docs

- See `docs/multi-agent-supervisor.md` (router returns: onboarding | template | general) and the Mermaid diagram in `docs/diagrams/multi-agent-supervisor.md`.

Environment: requires `OPENAI_API_KEY`.

## Utilities

Text layout helpers for canvas-free estimation and fitting. These are pure functions and easy to unit test.

- `utils/textLayout.ts`
  - `estimateTextDimensions(content, fontSize, maxWidth, settings?)`
    - Returns `{ width, height, lines }` with width capped to `maxWidth` if constrained
  - `adjustTextFontSizeToFit({ transform: { width, height }, settings })`
    - Returns a font size that fits the bounding box using binary search

Recommendations:

- Use these utilities anywhere text needs approximate measurement without DOM/canvas
- Keep inputs minimal (content, font size, width/height, basic style flags)
