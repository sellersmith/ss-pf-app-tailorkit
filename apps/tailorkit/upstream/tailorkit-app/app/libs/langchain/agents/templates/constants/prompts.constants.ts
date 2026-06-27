/**
 * Prompt templates and constants for AI template generation agents.
 * Contains LangChain prompts for style extraction, image generation, and validation.
 */
/* eslint-disable max-len */
import { ELayerType } from '~/types/psd'

/** AI prompt templates for template generation workflows */
export const STYLE_PROMPTS = {
  /** Main prompt for Canvas Style Designer agent - analyzes requests and creates individual image/text elements */
  CANVAS_STYLE_DESIGNER: `You are an expert Canvas Style Designer.
Analyze the user request and extract ALL distinct visual elements as separate ${ELayerType.IMAGE} or ${ELayerType.TEXT} layers with semantic relationships.

ORIGINAL USER REQUEST:
"{originalRequest}"

INPUT CONTEXT:
{condensedContext}

CORE TASK:
Parse the user request and create individual ${ELayerType.IMAGE} or ${ELayerType.TEXT} elements for EVERY distinct subject mentioned.
Each element must be independently renderable.

CRITICAL OUTPUT REQUIREMENTS:
✓ ONLY ${ELayerType.IMAGE} OR ${ELayerType.TEXT} TYPES (lowercase strings): type must be exactly "${ELayerType.IMAGE}" or "${ELayerType.TEXT}"
✓ INDIVIDUAL SUBJECTS: Create separate elements for each person, animal, object, decoration
✓ SEMANTIC RELATIONSHIPS: Define connectionTo arrays linking related elements
✓ DETAILED IMAGE PROMPTS: Each imagePrompt must be STANDALONE and focus on ONE subject only
✓ PER-TYPE REQUIRED FIELDS (YOU MUST OUTPUT ALL OF THESE):
  - For ${ELayerType.TEXT} styleSettings:
    storefrontLabel (string), content (string), fontFamily (object: { family, src }), fontSize (number >=1),
    textStyle (array of allowed values), textColor (hex), textAlign (enum), textShape (enum: none|circle|curve),
    curvePeaks (number, only when textShape=curve), curveBend (number -100..100, only when textShape=curve),
    circleStartAngle (radians, only when textShape=circle), circleEndAngle (radians, only when textShape=circle),
    opacity (0..1), shadowColor (hex), shadowBlur (>=0), shadowOffset (object: { x, y }),
    autoFitToContainer (boolean, default true), styleCase (enum), verticalAlign (enum), strokeColor (hex), strokeWeight (>=0),
    neonMode (enum), neonIntensity (0..1)
  - For ${ELayerType.IMAGE} styleSettings:
    storefrontLabel (string), imageType (string), imagePrompt (string), imageStyle (string),
    opacity (0..1), shadowColor (hex), shadowBlur (>=0), shadowOffset (object: { x, y })
✓ COLORS: Any color fields MUST be valid hex (e.g., #FF0000). Do NOT emit gradients or CSS expressions in color fields.

ANALYSIS PROCESS:

**SUBJECT IDENTIFICATION:**
Parse the request to identify every distinct visual subject:
- Individual People: Count exactly (two friends = Friend1 + Friend2 elements)
- Individual Animals: Each pet or animal mentioned
- Individual Objects: Each item (gift, bicycle, cake, etc.)
- Individual Decorations: Each type (balloons, flowers, flags, etc.)
- Text Content: Exact quoted phrases or contextual text needs

**SEMANTIC RELATIONSHIP MAPPING:**
For each subject, analyze and describe:
- role: Descriptive role that best represents the subject's purpose (e.g., main_subject, background_element, decorative_detail)
- relationshipType: Nature of relationship with connected elements (e.g., family, professional, thematic)
- connectionTo: Array of element IDs this subject connects with
- spatialHints: Natural language description of:
  * proximityLevel: How close elements should be
  * orientation: How elements face or relate to each other
  * posture: Natural pose or position if applicable
- visualWeight: 0.1-1.0 based on importance in composition

Note: Use natural, descriptive language for roles and relationships. Don't restrict to predefined terms.

**IMAGE PROMPT ENHANCEMENT:**
For EACH INDIVIDUAL SUBJECT, create a STANDALONE prompt that:
- Describes ONLY that specific subject's physical appearance
- EXCLUDES all other subjects and relationships
- Focuses on generating JUST THIS ONE element
- Includes style and technical requirements
 - MUST NOT mention or imply positions relative to other elements (e.g., "next to", "with", "beside", "near", "in front of", "behind").
 - MUST NOT use any labels or IDs of other elements.

**SCENE CONTEXT ANALYSIS:**
Determine overall composition characteristics:
- sceneType: intimate | celebratory | formal | playful | peaceful | dynamic
- spatialArrangement: clustered | linear | circular | scattered | centered
- energyLevel: calm | moderate | energetic | joyful
- dominantMood: Primary emotional descriptors

**TEXT STYLE ENHANCEMENTS (HIGH PRIORITY):**
When generating ${ELayerType.TEXT} elements, proactively enhance typography using the available style fields while keeping production safety and readability:
- Prefer applying at least one enhancement on primary or heading-like ${ELayerType.TEXT} elements, aligned with visualDensity and mood:
  - textShape: use curved text when it fits the theme (e.g., arc/circle/rainbow) to create dynamic layouts
  - neonMode + neonIntensity: subtle glow for emphasis (avoid excessive intensity for readability)
  - strokeColor + strokeWeight: add a clean outline to improve contrast against backgrounds
  - shadowColor + shadowBlur + shadowOffset: subtle shadow to separate text from background
- Keep colors strictly in HEX. Ensure adequate contrast and legibility.
- Avoid combining too many effects at once; 1–2 enhancements per ${ELayerType.TEXT} element is preferred (except minimal density, where use subtle outline or none).

OUTPUT STRUCTURE REQUIREMENTS:
- elements: Array of individual ${ELayerType.IMAGE} or ${ELayerType.TEXT} elements only
- styleCharacteristics: Visual style properties
- compositionGuidelines: Layout guidance
- sceneContext: Overall scene properties (if applicable)

Each element MUST include:
- Unique id string
- type: "${ELayerType.IMAGE}" or "${ELayerType.TEXT}" only (lowercase)
- styleSettings with ALL required fields per type listed above
- designIntent with purpose, visualWeight, preferredPosition, scalingBehavior
- canvasProperties with layerType, zIndexRange, blendMode, allowOverlap
- semanticContext with role and relationship information (if applicable)

FOLLOW THE DEFINED JSON SCHEMA EXACTLY. No deviations from structure.

STRICT JSON OUTPUT:
- Output ONLY raw JSON with no code fences, no comments, and no trailing prose.
- Do not include markdown fences like \u0060\u0060\u0060json.`,

  /** Template for generating standalone image prompts for individual elements */
  IMAGE_PROMPT_TEMPLATE: `Generate a single-subject prompt for only this element.
Subject: {subjectLabel}
Role: {subjectRole}
Style: {visualStyle}
Mood: {subjectMood}

Rules:
- Describe ONLY this subject's appearance and pose
- Do NOT mention, imply, or include any other subjects
- Clean vector-like style, Solid white background, print-ready edges
- Single object as sole dominant subject, scaled to fill entire image height with top and bottom edges touching image borders, perfectly centered, no margins or empty space
- No text, no letters, no numbers, no words, no typography, no characters, no logos, no brands, no trademarks, no products, no mockups
`,

  /** Error message templates for prompt validation */
  VALIDATION_ERRORS: {
    MISSING_PROMPT: 'Missing imagePrompt for image element: {label}',
    CROSS_REFERENCE: 'Image prompt for {label} should not reference other elements: {references}',
  },
} as const
