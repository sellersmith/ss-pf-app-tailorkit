/* eslint-disable max-len */

const visualStyles = [
  {
    id: 'flat-graphic',
    alias: 'flat_graphic',
    name: 'Flat Graphic',
    type: 'quick_prompt',
    description: 'Bold flat colors with minimal shading',
    instruction:
      'Render in flat graphic style using bold solid color fills with minimal to NO shading. Create depth and form through color choice and shape arrangement rather than gradients or shadows. Each distinct area should be filled with solid flat color.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Flat_Graphic_-_Thumbnail_1.png?v=1759370691',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Flat_Graphic_-_Thumbnail_2.png?v=1759370704',
    ],
    variants: [
      {
        id: 'geometric',
        name: 'Geometric',
        style: 'angular shapes',
      },
      {
        id: 'character',
        name: 'Character Style',
        style: 'cute/cartoon',
      },
      {
        id: 'modern',
        name: 'Modern Flat',
        style: 'contemporary',
      },
    ],
    characteristics: ['clean_edges', 'limited_palette', 'no_texture'],
    ideal_for: ['DTG', 'sublimation', 'digital_printing'],
    avoid_combining_with: ['realistic_rendering', 'complex_gradients'],
  },
  {
    id: 'hand-drawn',
    alias: 'hand_drawn',
    name: 'Hand-Drawn',
    type: 'quick_prompt',
    description: 'Organic imperfect lines with sketch-like quality',
    instruction:
      'Render with organic hand-drawn quality showing natural imperfections and human touch. Lines should have slight variation and organic irregularity - NOT perfectly smooth or mechanical. Create sketch-like quality with visible drawing marks.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Hand_Drawn_-_Thumbnail_1.png?v=1759370781',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Hand_Drawn_-_Thumbnail_2.png?v=1759370795',
    ],
    variants: [
      {
        id: 'sketch',
        name: 'Sketch Style',
        finish: 'rough',
      },
      {
        id: 'doodle',
        name: 'Doodle',
        finish: 'playful',
      },
      {
        id: 'brush',
        name: 'Brush Stroke',
        finish: 'expressive',
      },
    ],
    characteristics: ['organic_imperfection', 'personal_touch', 'casual'],
    ideal_for: ['casual_apparel', 'stickers', 'casual_gifts'],
    avoid_combining_with: ['precise_technical', 'corporate_themes'],
  },
  {
    id: 'line-art',
    alias: 'line_art',
    name: 'Line Art',
    type: 'quick_prompt',
    description: 'Clean continuous lines without fills',
    instruction:
      'Render in clean line art style using continuous single-color lines with absolutely NO fills, gradients, or shading. Create forms and depth purely through line work. All lines must have consistent stroke weight unless specifically varying for artistic effect. Maintain crisp, clean edges without halos or anti-aliasing artifacts.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Line_Art_-_Thumbnail_1.png?v=1759370640',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Line_Art_-_Thumbnail_2.png?v=1759370652',
    ],
    variants: [
      {
        id: 'thin-line',
        name: 'Thin Line',
        weight: 'delicate',
        best_for: 'detailed work',
      },
      {
        id: 'bold-line',
        name: 'Bold Line',
        weight: 'strong',
        best_for: 'visibility',
      },
      {
        id: 'crosshatch',
        name: 'Crosshatch/Stipple',
        weight: 'varied',
        best_for: 'shading',
      },
    ],
    characteristics: ['single_color', 'no_fills', 'crisp_edges'],
    ideal_for: ['engraving', 'vinyl_cutting', 'screen_printing'],
    avoid_combining_with: ['painterly_effects', 'gradients'],
  },
  {
    id: 'pixel-art',
    alias: 'pixel_art',
    name: 'Pixel Art',
    type: 'quick_prompt',
    description: 'Blocky grid-aligned graphics with no anti-aliasing',
    instruction:
      'Render in authentic pixel art style with STRICT pixel grid alignment and absolutely NO anti-aliasing. Every element MUST align to pixel grid - NO diagonal lines unless stepped in pixel increments. Use blocky square pixels with NO smoothing or blur.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Pixel_Art_-_Thumbnail_1.png?v=1759370839',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Pixel_Art_-_Thumbnail_2.png?v=1759370853',
    ],
    variants: [
      {
        id: '8bit',
        name: '8-bit',
        resolution: 'low',
      },
      {
        id: '16bit',
        name: '16-bit',
        resolution: 'medium',
      },
      {
        id: 'isometric',
        name: 'Isometric Pixel',
        perspective: 'angled',
      },
    ],
    characteristics: ['grid_aligned', 'no_smoothing', 'limited_colors'],
    ideal_for: ['gaming_merchandise', 'retro_tech', 'geek_culture'],
    avoid_combining_with: ['organic_shapes', 'photography'],
  },
  {
    id: 'retro',
    alias: 'retro',
    name: 'Retro',
    type: 'quick_prompt',
    description: 'Vintage aesthetic with period-appropriate styling',
    instruction:
      'Render with authentic vintage aesthetic appropriate to specified historical period. Use color palettes, typography, and visual treatments characteristic of the target era. Include period-appropriate design elements: specific graphic styles, color schemes, printing techniques.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Retro_-_Thumbnail_1.png?v=1759370810',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Retro_-_Thumbnail_2.png?v=1759370825',
    ],
    variants: [
      {
        id: 'vintage-poster',
        name: 'Vintage Poster',
        era: '1940s-1960s',
      },
      {
        id: 'pop-art',
        name: 'Pop Art',
        era: '1960s-1970s',
        has_halftone: true,
      },
      {
        id: 'y2k',
        name: 'Y2K/Tech',
        era: '1995-2005',
        has_chrome: true,
      },
    ],
    characteristics: ['nostalgic', 'warm_tones', 'distressed_optional'],
    ideal_for: ['apparel', 'posters', 'nostalgic_products'],
    avoid_combining_with: ['modern_minimalist', 'futuristic_themes'],
  },
  {
    id: 'semi-realistic',
    alias: 'semi_realistic',
    name: 'Semi-Realistic',
    type: 'quick_prompt',
    description: 'Stylized but recognizable with soft shading',
    instruction:
      'Render in semi-realistic style balancing recognizable features with artistic stylization. Create clear likenesses while maintaining illustrated quality. Use soft gradual shading to suggest form and dimension without photorealism.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Semi_Realistic_-_Thumbnail_1.png?v=1759370866',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Semi_Realistic_-_Thumbnail_2.png?v=1759370880',
    ],
    variants: [
      {
        id: 'illustrated-portrait',
        name: 'Illustrated Portrait',
        detail: 'medium',
      },
      {
        id: 'cel-shaded',
        name: 'Cel-Shaded',
        detail: 'anime-style',
      },
      {
        id: 'editorial',
        name: 'Editorial Style',
        detail: 'professional',
      },
    ],
    characteristics: ['recognizable_features', 'soft_shading', 'balanced_detail'],
    ideal_for: ['portraits', 'gifts', 'professional_products'],
    avoid_combining_with: ['abstract_themes', 'geometric_only'],
  },
  {
    id: 'silhouette',
    alias: 'solid_fill_silhouette',
    name: 'Solid Fill / Silhouette',
    type: 'quick_prompt',
    description: 'High-contrast solid shapes without internal detail',
    instruction:
      'Render as high-contrast solid silhouette using single solid color fill with absolutely NO internal details, textures, or gradients. Create recognizable forms purely through outer shape and negative space. Silhouette must be completely filled - NO line work inside the shape.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Solid_Fill___Silhouette_-_Thumbnail_1.png?v=1759370665',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Solid_Fill___Silhouette_-_Thumbnail_2.png?v=1759370677',
    ],
    variants: [
      {
        id: 'pure-silhouette',
        name: 'Pure Silhouette',
        contrast: 'maximum',
      },
      {
        id: 'stencil',
        name: 'Stencil Ready',
        has_bridges: true,
      },
      {
        id: 'cutout',
        name: 'Cutout Style',
        layered: true,
      },
    ],
    characteristics: ['single_color', 'no_gradients', 'bold_shapes'],
    ideal_for: ['vinyl_decals', 'stencils', 'high_contrast_printing'],
    avoid_combining_with: ['detailed_textures', 'subtle_shading'],
  },
  {
    id: 'painterly',
    alias: 'painterly',
    name: 'Painterly',
    type: 'quick_prompt',
    description: 'Soft organic edges with brush-like textures',
    instruction:
      'Render with soft organic painterly aesthetic featuring brush-like edges and color blending. Create forms through paint-like strokes and washes rather than hard edges. Colors should flow and blend into each other with soft transitions.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Painterly_-_Thumbnail_1.png?v=1759370721',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Painterly_-_Thumbnail_2.png?v=1759370735',
    ],
    variants: [
      {
        id: 'watercolor',
        name: 'Watercolor',
        flow: 'fluid washes',
      },
      {
        id: 'gradient-blend',
        name: 'Gradient Blend',
        flow: 'smooth transitions',
      },
      {
        id: 'fluid-art',
        name: 'Fluid Art',
        flow: 'marbling swirls',
      },
    ],
    characteristics: ['soft_edges', 'color_blending', 'organic_texture'],
    ideal_for: ['sublimation', 'canvas_prints', 'full_color_printing'],
    avoid_combining_with: ['crisp_technical', 'small_scale'],
  },
  {
    id: 'ornamental',
    alias: 'ornamental',
    name: 'Ornamental',
    type: 'quick_prompt',
    description: 'Intricate decorative patterns with detailed elements',
    instruction:
      'Render with intricate ornamental decorative style featuring detailed patterns and elaborate elements. Create complex arrangements of decorative motifs with high level of detail. Use symmetry extensively - radial symmetry for mandalas, bilateral symmetry for borders.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Ornamental_-_Thumbnail_1.png?v=1759370751',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Visual_Style_-_Ornamental_-_Thumbnail_2.png?v=1759370766',
    ],
    variants: [
      {
        id: 'mandala',
        name: 'Mandala',
        symmetry: 'radial',
      },
      {
        id: 'filigree',
        name: 'Filigree',
        symmetry: 'flowing curves',
      },
      {
        id: 'geometric-pattern',
        name: 'Geometric Pattern',
        symmetry: 'precise',
      },
    ],
    characteristics: ['high_detail', 'symmetrical', 'repetitive_elements'],
    ideal_for: ['laser_engraving', 'detailed_printing', 'jewelry'],
    avoid_combining_with: ['minimalist_content', 'small_formats'],
  },
  {
    id: 'laser-engraving',
    alias: 'laser_engraving',
    name: 'Laser Engraving',
    type: 'quick_prompt',
    description: 'Single-color, vector-friendly artwork ready for direct laser engraving',
    instruction:
      "Render as laser-engraving-ready artwork in a single solid color (black) on a transparent background. Strictly preserve the original subject's shapes, proportions, and recognizability — do NOT reinterpret, restyle, or add new elements. Eliminate ALL gradients, shading, halftones, drop shadows, glows, anti-aliasing artifacts, and photographic textures. Output flat 2D vector-friendly artwork with crisp, clean edges suitable for direct laser engraving onto physical surfaces. Do NOT generate mockups, materials, lighting, or 3D rendering.",
    thumbnail: [],
    variants: [
      {
        id: 'detailed-line',
        name: 'Detailed Line',
        approach: 'preserve internal structure as thin uniform lines',
        best_for: 'product photos, detailed logos, illustrations',
      },
      {
        id: 'solid-silhouette',
        name: 'Solid Silhouette',
        approach: 'fill outer shape uniformly, no internal detail',
        best_for: 'flat logos, simple icons, monograms',
      },
      {
        id: 'mixed-engraving',
        name: 'Mixed',
        approach: 'auto-decide line vs fill based on input complexity',
        best_for: 'general use when unsure',
      },
    ],
    characteristics: ['single_color', 'vectorizable', 'preserves_subject', 'no_reinterpretation'],
    ideal_for: ['laser_engraving', 'logo_conversion', 'engraved_jewelry', 'engraved_drinkware'],
    avoid_combining_with: ['painterly_effects', 'gradients', 'photorealism'],
  },
]

export { visualStyles }
