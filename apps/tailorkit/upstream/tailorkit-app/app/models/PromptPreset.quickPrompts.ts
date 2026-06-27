/* eslint-disable max-len */
/* eslint-disable max-lines */
import { visualStyles } from '~/modules/PromptPresets/taxonomies/visualStyles'
import valentineDirectPrintEngravePrompts from './PromptPreset.valentinePrompts'
import christmasDirectPrintEngravePrompts from './PromptPreset.christmasPrompts'

// Define default quick prompts utilizing the 3-dimensional framework
// Optimized for TailorKit's ideal customer profile and Q4 OKRs
// Focused on high-converting, personalized jewelry and luxury accessory categories
// Validated against jewelry market data and manufacturing-controlled brand capabilities
const quickPrompts = [
  // Visual styles (top priority)
  ...visualStyles,
  // Valentine prompts
  ...valentineDirectPrintEngravePrompts,
  // Christmas prompts
  ...christmasDirectPrintEngravePrompts,
  // TIER 1 PRIORITY - Core jewelry personalization categories
  {
    name: 'Personalized Monogram Luxury',
    alias: 'monogram_luxury',
    type: 'quick_prompt',
    category: 'engraved',
    instruction:
      'Create a refined monogram for initials "{{initials}}" with optional subtext "{{subtext}}". Template Type: text-layout (centered subtype). Visual Style: line-art (thin-line variant) or ornamental (filigree variant). Content Theme: personal-identity. Ensure single-color, crisp edges, generous negative space, and engraving-safe output. If a reference image is provided, convert it into a subtle line-art crest/medallion watermark at 20–30% opacity behind the monogram (no photo realism). Keep the monogram dominant in bold, crisp lines with optional ornamental flourishes framing the lockup. Output only 2D artwork for engraving/printing (text/line-art/vector paths) on a plain or transparent background. Do not generate any physical objects, materials, products, mockups, chains, rings, bezels, stones, metal, surfaces, hands, models, shadows, or lighting.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Personalized_Monogram_Luxury_-_Thumbnail_1.png?v=1760782330',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Personalized_Monogram_Luxury_-_Thumbnail_2.png?v=1760782346',
    ],
  },
  {
    name: 'Birth Flower Jewelry',
    alias: 'birth_flower_jewelry',
    type: 'quick_prompt',
    category: 'engraved',
    instruction:
      'Create delicate birth-flower engraving artwork for "{{birth_month}}" with optional name "{{name}}" and date "{{date}}". Template Type: botanical-illustration (simplified subtype) or emblem (floral-frame subtype). Visual Style: line-art (botanical-outline variant) or engraving-vector (mono-line variant). Content Theme: nature (botanical) or personal-identity. Use the canonical flower: January (Carnation), February (Violet), March (Daffodil), April (Daisy), May (Lily of the Valley), June (Rose), July (Larkspur), August (Gladiolus), September (Aster), October (Marigold), November (Chrysanthemum), December (Poinsettia/Holly). Produce simplified outlines only (no gradients/shading), with optional month label in elegant script and recipient name/date below. Maintain ≥0.25pt effective stroke weight for micro-engraving legibility. If a reference image is provided, use it only as stylistic inspiration and convert to engraving-safe line-art (no photographic content). Output only 2D artwork for engraving/printing on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Birth_Flower_Jewelry_-_Thumbnail_1.png?v=1760884198',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Birth_Flower_Jewelry_-_Thumbnail_2.png?v=1760884216',
    ],
  },
  {
    name: 'Zodiac Constellation',
    alias: 'zodiac',
    type: 'quick_prompt',
    category: 'engraved',
    instruction:
      'Create zodiac artwork for "{{zodiac_sign}}" including the traditional glyph and a constellation pattern. Template Type: icon-set (single-icon subtype) or badge (circular subtype). Visual Style: line-art or ornamental (mandala variant). Content Theme: celestial (zodiac). Include well-spaced stars with connecting lines and clear hierarchy with the glyph. If a reference image is provided, convert it to a simple line-art silhouette cameo (20–30% opacity) centered within the circular badge (no photographic rendering). Output only 2D artwork for engraving/printing (text/line-art/vector paths) on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Zodiac_Constellation_-_Thumbnail_1.png?v=1760782708',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Zodiac_Constellation_-_Thumbnail_2.png?v=1760782728',
    ],
  },
  {
    name: 'Birthday Celebration',
    alias: 'birthday_celebration',
    type: 'quick_prompt',
    category: 'festive',
    instruction:
      'Produce a festive birthday layout with text "{{your_text}}" and optional age "{{age}}". Template Type: badge (ribbon subtype) or text-layout (stacked subtype). Visual Style: flat-graphic (retro pop/art variant) or painterly (gradient-blend variant) constrained to print-friendly shapes. Content Theme: life-events or humor. Use simple confetti and balloon icons as line-art/flat vector elements with a bold typographic focus. If a reference image is provided, convert the subject into a minimal line-art avatar or silhouette (no photographic content) integrated at 30–40% scale. Output only 2D artwork for engraving/printing on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Birthday_Celebration_-_Thumbnail_1.png?v=1760782636',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Birthday_Celebration_-_Thumbnail_2.png?v=1760782655',
    ],
  },
  {
    name: 'Heartfelt Valentine',
    alias: 'valentine',
    type: 'quick_prompt',
    category: 'festive',
    hot: true,
    instruction:
      'Design a Valentine artwork with text "{{your_text}}". Template Type: text-layout (arched subtype) or frame (wreath subtype, heart-shaped). Visual Style: line-art or painterly (watercolor-like edges simplified to print-friendly shapes). Content Theme: relationships (couples) or nature (floral). Use heart motifs and soft romantic composition with clear legibility. If a reference image is provided, convert the couple/portrait to a minimal line-art cameo or silhouette without photo textures. Output only 2D artwork for engraving/printing on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Heartfelt_Valentine_-_Thumbnail_1.png?v=1760782673',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Heartfelt_Valentine_-_Thumbnail_2.png?v=1760782689',
    ],
  },
  {
    name: 'Memorial Tribute',
    alias: 'memorial_tribute',
    type: 'quick_prompt',
    category: 'festive',
    instruction:
      'Create a respectful memorial artwork for "{{name}}", dates "{{dates}}", and symbol "{{symbol}}". Template Type: text-layout (stacked subtype) or frame (corner-elements subtype). Visual Style: line-art (thin-line) or ornamental (filigree). Content Theme: relationships (memorial). Maintain dignified tone, generous margins, and a clear type hierarchy. If a reference image is provided, render a simplified line-art cameo (no photo realism) framed with subtle filigree. Output only 2D artwork for engraving/printing on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Memorial_Tribute_-_Thumbnail_1.png?v=1760782465',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Memorial_Tribute_-_Thumbnail_2.png?v=1760782482',
    ],
  },

  // TIER 2 PRIORITY - Strategic additions and modifications
  {
    name: 'Coordinate Jewelry Engraving',
    alias: 'coordinate_engraving',
    type: 'quick_prompt',
    category: 'engraved',
    hot: true,
    instruction:
      'Create elegant GPS coordinate engraving artwork with latitude "{{latitude}}" and longitude "{{longitude}}", optional location name "{{location_name}}", and date "{{date}}". Template Type: data-display (coordinate subtype) or emblem (location-marker subtype). Visual Style: engraving-vector (mono-line) or minimalist-modern (geometric). Content Theme: personal-identity or life-events. Use clean serif/sans typography with correct degree/minute/second or decimal formatting. Add a simple line-art location-pin icon if desired. Keep hierarchy clear and legible at small sizes (≥0.25pt effective stroke). If a reference image (e.g., map) is provided, abstract it into minimal line-art contours (no photo tiles). Output only 2D artwork for engraving/printing on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Coordinate_Jewelry_Engraving_-_Thumbnail_1.png?v=1760882672',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Coordinate_Jewelry_Engraving_-_Thumbnail_2.png?v=1760882689',
    ],
  },
  {
    name: 'Wedding Names & Date',
    alias: 'wedding_names',
    type: 'quick_prompt',
    category: 'festive',
    hot: true,
    instruction:
      'Create an elegant wedding artwork with names "{{name1}} & {{name2}}", date "{{date}}", and optional venue "{{venue}}". Template Type: text-layout (stacked subtype) or frame (wreath subtype). Visual Style: line-art or simplified painterly shapes suitable for print. Content Theme: relationships (wedding). Keep equal visual weight between names with clear hierarchy and legibility. Optional decorative floral/wreath elements may frame the typography. If a reference image is provided, convert it to a minimal line-art cameo (no photographic rendering). Output only 2D artwork for engraving/printing on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Wedding_Names___Date_-_Thumbnail_1.png?v=1760782430',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Wedding_Names___Date_-_Thumbnail_2.png?v=1760782448',
    ],
  },
  {
    name: 'Family Tree Layout',
    alias: 'family_tree',
    type: 'quick_prompt',
    category: 'illustrative',
    instruction:
      'Create a family tree artwork with names "{{names_list}}". Template Type: data-display (timeline subtype, vertical orientation). Visual Style: line-art (thin-line) or ornamental (geometric-pattern). Content Theme: relationships (family_trees). Use clear connectors, prevent text collisions, and maintain generational hierarchy. If a reference image is provided, render a small line-art cameo at the root (no photo textures) with branches extending outward. Output only 2D artwork for engraving/printing on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Family_Tree_Layout_-_Thumbnail_1.png?v=1760782568',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Family_Tree_Layout_-_Thumbnail_2.png?v=1760782585',
    ],
  },
  {
    name: 'Decorative Floral Frame',
    alias: 'floral_frame',
    type: 'quick_prompt',
    category: 'illustrative',
    instruction:
      'Design a floral border with reserved center for text "{{your_text}}". Template Type: frame (wreath or full-border). Visual Style: line-art or simplified watercolor-like shapes suitable for print. Content Theme: nature (floral/botanical). Leave 40–50% center clear; balance organic forms and symmetry. If a reference image is provided, convert to a small line-art cameo or omit entirely to keep the center typographic. Output only 2D artwork for engraving/printing on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Decorative_Floral_Frame_-_Thumbnail_1.png?v=1760782814',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Decorative_Floral_Frame_-_Thumbnail_2.png?v=1760782833',
    ],
  },

  // NEW ADDITIONS - Critical missing categories for jewelry market
  {
    name: 'Mother Day Jewelry',
    alias: 'mothers_day',
    type: 'quick_prompt',
    category: 'festive',
    instruction:
      'Create a heartfelt Mother\'s Day artwork with text "{{your_text}}" and optional children names "{{children_names}}". Template Type: text-layout (stacked subtype) or frame (floral-wreath subtype). Visual Style: line-art or simplified painterly shapes suitable for print. Content Theme: relationships (family) or nature (floral). Use warm, gentle motifs (hearts, florals, infinity) and elegant, legible typography. If a reference image is provided, convert subjects into minimal line-art cameos (no photographic rendering). Output only 2D artwork for engraving/printing on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Mother_Day_Jewelry_-_Thumbnail_1.png?v=1760882878',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Mother_Day_Jewelry_-_Thumbnail_2.png?v=1760882896',
    ],
  },
  {
    name: 'Anniversary Celebration',
    alias: 'anniversary',
    type: 'quick_prompt',
    category: 'festive',
    hot: true,
    instruction:
      'Design an anniversary artwork with names "{{name1}} & {{name2}}", date "{{anniversary_date}}", and optional years "{{years_together}}". Template Type: text-layout (centered subtype) or emblem (circular badge). Visual Style: line-art or ornamental (elegant-filigree). Content Theme: relationships (couples) or life-events. Use refined symbols (simple infinity/heart) and a timeless typographic hierarchy. If a reference image is provided, convert to a small line-art cameo (no photo textures). Output only 2D artwork for engraving/printing on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Anniversary_Celebration_-_Thumbnail_1.png?v=1760882915',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Anniversary_Celebration_-_Thumbnail_2.png?v=1760882934',
    ],
  },
  // {
  //   name: 'Graduation Milestone',
  //   alias: 'graduation',
  //   type: 'quick_prompt',
  //   category: 'festive',
  //   instruction:
  //     'Create graduation artwork with name "{{graduate_name}}", year "{{grad_year}}", degree "{{degree}}", and school "{{school_name}}". Template Type: badge (shield subtype) or text-layout (stacked subtype). Visual Style: line-art or flat-graphic (modern) constrained to print-friendly shapes. Content Theme: life-events or personal-identity. Use simple academic symbols (cap, diploma, laurel) as line-art. Keep hierarchy distinguished and legible. If a reference image is provided, render the graduate as a minimal line-art avatar (no photographic rendering). Output only 2D artwork for engraving/printing on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
  //   thumbnail: [
  //     'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Graduation_Milestone_-_Thumbnail_1.png?v=1760882954',
  //     'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Graduation_Milestone_-_Thumbnail_2.png?v=1760882971',
  //   ],
  // },
  {
    name: 'Name Necklace Initial',
    alias: 'name_initial',
    type: 'quick_prompt',
    category: 'engraved',
    instruction:
      'Create engraving artwork for name or initial "{{name_or_initial}}" with optional accent "{{accent_element}}". Template Type: text-layout (flowing-script subtype) or icon-set (single-letter subtype). Visual Style: line-art (elegant-script) or minimalist-modern (sans-serif). Content Theme: personal-identity. For full names (2–8 letters), produce flowing script letterforms; for single initials, produce bold, clean forms. If an accent is provided (e.g., heart, star, birthstone position), depict it as a small line-art glyph positioned harmoniously. Maintain clean negative space and crisp edges suitable for micro-engraving. Output only 2D artwork for engraving/printing (text/line-art/vector paths) on a plain or transparent background. Do not generate any physical products, materials, or mockups.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Name_Necklace_Initial_-_Thumbnail_1.png?v=1760882988',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Name_Necklace_Initial_-_Thumbnail_2.png?v=1760883006',
    ],
  },
]

export default quickPrompts
