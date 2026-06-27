/* eslint-disable max-len */

const templateTypes = [
  {
    id: 'text-layout',
    name: 'Text Layout',
    type: 'template_type',
    description: 'Typography-focused designs with hierarchical text arrangements',
    instruction:
      'Create a typographic layout with clear text hierarchy. All text elements should be properly spaced, aligned, and sized to create visual organization. Maintain generous negative space around text for breathing room and emphasis.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Text_Layout_-_Thumbnail_1.png?v=1759369841',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Text_Layout_-_Thumbnail_2.png?v=1759369853',
    ],
    subtypes: [
      {
        id: 'centered',
        name: 'Centered',
        use_cases: ['monograms', 'names', 'quotes'],
        instruction:
          'Create a centered typographic layout. All text elements must be center-aligned with clear hierarchy: primary text large and dominant, secondary text smaller and supporting. Maintain generous negative space around all text. Use balanced top and bottom margins. Ensure readability at all sizes. Position all elements along vertical center axis.',
      },
      {
        id: 'arched',
        name: 'Arched',
        use_cases: ['curved text', 'circular badges'],
        instruction:
          'Create an arched text layout where primary text follows a gentle upward curve (15-30 degree arc). Text should flow naturally along the arc path. Secondary text can be straight beneath or follow a complementary downward arc. Maintain consistent letter spacing along curves. Center the composition with balanced negative space.',
      },
      {
        id: 'stacked',
        name: 'Stacked',
        use_cases: ['multi-line names', 'event details'],
        instruction:
          'Create a stacked multi-line text layout with clear vertical hierarchy. Arrange text elements in distinct horizontal bands stacked vertically. Vary text sizes to create visual hierarchy (largest for primary, medium for secondary, smallest for tertiary). Maintain consistent alignment across all lines. Use adequate line spacing.',
      },
    ],
    compatible_with: ['all_styles', 'all_themes'],
    best_for: ['engraving', 'vinyl_cutting', 'screen_printing', 'DTG'],
  },
  {
    id: 'frame',
    name: 'Decorative Frame',
    type: 'template_type',
    description: 'Border structures with empty center for content placement',
    instruction:
      'Create a decorative border or frame structure. The frame must surround a clear empty center area reserved for user content. Frame elements should be balanced and symmetrical. Leave at least 40-50% of canvas as empty center space.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Decorative_Frame_-_Thumbnail_1.png?v=1759369867',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Decorative_Frame_-_Thumbnail_2.png?v=1759369881',
    ],
    subtypes: [
      {
        id: 'corner-elements',
        name: 'Corner Elements',
        use_cases: ['minimal frames'],
        instruction:
          'Create decorative corner elements in all four corners of the composition. Each corner should have matching ornamental details that frame the design. Leave the center 60-70% of canvas completely empty for content placement. Corner elements should be balanced and symmetrical. Ensure decorative elements do not extend too far into the usable center area.',
      },
      {
        id: 'full-border',
        name: 'Full Border',
        use_cases: ['complete surrounds'],
        instruction:
          'Create a complete decorative border around the entire perimeter of the canvas. Border should form a continuous frame with consistent thickness (10-15% of canvas width). Leave clear empty rectangular center area for content placement. Border elements should flow continuously around all edges. Maintain even spacing and visual weight around all sides.',
      },
      {
        id: 'wreath',
        name: 'Wreath Style',
        use_cases: ['circular natural frames'],
        instruction:
          'Create a circular wreath-style decorative frame. Elements should flow in a natural circular or oval arrangement forming a continuous ring. Leave clear empty center area (40-50% of canvas diameter) for content placement. Wreath should have organic flowing arrangement with elements following the circular path. Maintain consistent density of decorative elements around entire circumference.',
      },
    ],
    compatible_with: ['line-art', 'ornamental', 'hand-drawn', 'floral_theme'],
    best_for: ['certificates', 'invitations', 'laser_engraving'],
  },
  {
    id: 'badge',
    name: 'Badge & Seal',
    type: 'template_type',
    description: 'Self-contained emblems with integrated text and graphics',
    instruction:
      'Design a self-contained badge or emblem. All elements (text, graphics, borders) must be integrated within a unified boundary shape. Badge should feel complete and balanced as a single graphic unit.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Badge___Seal_-_Thumbnail_1.png?v=1759369894',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Badge___Seal_-_Thumbnail_2.png?v=1759369907',
    ],
    subtypes: [
      {
        id: 'circular',
        name: 'Circular Badge',
        use_cases: ['logos', 'seals'],
        instruction:
          'Create a circular badge design. Outer boundary must be a clean circle. Integrate text and graphic elements within the circular format - text can follow the circular edge or be centered within. Include optional border ring with consistent spacing from edge. Balance all elements within the circular constraint. Maintain circular symmetry.',
      },
      {
        id: 'shield',
        name: 'Shield',
        use_cases: ['crests', 'emblems'],
        instruction:
          'Create a shield-shaped badge with classic heraldic proportions. Shield should have pointed bottom and rounded or flat top. Integrate text and visual elements within the shield boundary. Include optional border outline. Ensure traditional shield aesthetic while maintaining modern clarity. Balance all elements within the shield format.',
      },
      {
        id: 'ribbon',
        name: 'Ribbon Banner',
        use_cases: ['awards', 'labels'],
        instruction:
          'Create a ribbon banner badge with flowing banner shape. Ribbon should have characteristic curves and folded ends. Integrate text within the banner ribbon, following its flow. Include ribbon fold details for dimensionality. Text should flow naturally with ribbon shape. Maintain balanced composition with optional elements above or below ribbon.',
      },
    ],
    compatible_with: ['all_styles', 'identity_themes', 'hobby_themes'],
    best_for: ['stickers', 'patches', 'merchandise'],
  },
  {
    id: 'portrait',
    name: 'Portrait & Character',
    type: 'template_type',
    description: 'Subject-focused illustrations with figure as primary element',
    instruction:
      'Create a portrait-focused composition with the subject as the dominant element. Subject should occupy 50-80% of canvas and be the clear focal point. Use minimal background to keep focus on the subject.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Portrait___Character_-_Thumbnail_1.png?v=1759369919',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Portrait___Character_-_Thumbnail_2.png?v=1759369930',
    ],
    subtypes: [
      {
        id: 'head-only',
        name: 'Head/Face Only',
        use_cases: ['pet portraits', 'profile pics'],
        instruction:
          'Create a portrait showing only the head and face of the subject. Crop composition tightly around the head, including top of head down to shoulders/neck. Subject should occupy 60-80% of canvas. Position face centered or slightly offset. Capture characteristic features and proportions. Maintain clean background separation.',
      },
      {
        id: 'bust',
        name: 'Bust/Upper Body',
        use_cases: ['person portraits'],
        instruction:
          'Create a bust portrait showing head, neck, and upper torso down to mid-chest or shoulders. Subject should occupy 50-70% of canvas height. Position subject centered or with slight offset. Show characteristic posture and upper body details. Ensure clear silhouette and recognizable features.',
      },
      {
        id: 'full-figure',
        name: 'Full Figure',
        use_cases: ['character designs'],
        instruction:
          'Create a full figure portrait showing the complete subject from head to feet. Subject should occupy 60-80% of canvas height, positioned centrally with balanced negative space. Capture full body proportions and characteristic pose. Show complete silhouette and stance. Position figure with adequate space around all sides.',
      },
    ],
    compatible_with: ['semi-realistic', 'line-art', 'silhouette', 'cel-shaded'],
    best_for: ['canvas_prints', 'custom_gifts', 'apparel'],
  },
  {
    id: 'icon-set',
    name: 'Icon & Symbol Set',
    type: 'template_type',
    description: 'Single or grouped symbolic graphics',
    instruction:
      'Create iconic symbols or graphics that are clear, recognizable, and simplified to essential elements. Icons should work at small and large scales. Maintain universal visual language and balanced proportions.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Icon___Symbol_Set_-_Thumbnail_1.png?v=1759369943',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Icon___Symbol_Set_-_Thumbnail_2.png?v=1759369955',
    ],
    subtypes: [
      {
        id: 'single-icon',
        name: 'Single Icon',
        use_cases: ['simple marks', 'logos'],
        instruction:
          'Create a single iconic symbol or graphic. Icon should be clear, recognizable, and simplified to essential elements. Center the icon with generous negative space. Icon should occupy 40-60% of canvas for optimal clarity. Use universal visual language - shapes should be immediately understandable. Keep details minimal and functional.',
      },
      {
        id: 'icon-group',
        name: 'Icon Group',
        use_cases: ['multiple related symbols'],
        instruction:
          'Create a group of 2-5 related icons arranged in balanced composition. Each icon should be similar in visual weight and complexity. Arrange icons in grid, linear, or circular layout with consistent spacing. All icons should share unified style and level of detail. Maintain clear negative space between icons.',
      },
      {
        id: 'pictogram',
        name: 'Pictogram',
        use_cases: ['universal symbols'],
        instruction:
          'Create a universal pictogram symbol using simplified geometric shapes. Pictogram should communicate meaning through pure visual form without text. Use minimal details - only essential elements for recognition. Maintain high contrast and clear silhouette. Ensure instant recognition at any size.',
      },
    ],
    compatible_with: ['line-art', 'silhouette', 'flat-graphic', 'pixel-art'],
    best_for: ['small_scale', 'laser_engraving', 'vinyl', 'screen_printing'],
  },
  {
    id: 'pattern',
    name: 'Pattern Fill',
    type: 'template_type',
    description: 'Repeating or scattered design elements for backgrounds',
    instruction:
      'Create a pattern design with repeating or distributed elements. Pattern should fill the entire canvas edge-to-edge. Maintain consistent spacing and visual balance throughout.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Pattern_Fill_-_Thumbnail_1.png?v=1759369967',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Pattern_Fill_-_Thumbnail_2.png?v=1759369981',
    ],
    subtypes: [
      {
        id: 'seamless-repeat',
        name: 'Seamless Repeat',
        use_cases: ['wallpapers', 'textiles'],
        instruction:
          'Create a seamless repeating pattern that tiles perfectly on all edges. Pattern elements should align precisely at canvas boundaries so left edge matches right edge and top matches bottom. Distribute elements with consistent spacing and density. Avoid obvious seams or alignment issues when tiled. Pattern should feel continuous and infinite when repeated.',
      },
      {
        id: 'border-pattern',
        name: 'Border Pattern',
        use_cases: ['edges', 'frames'],
        instruction:
          'Create a decorative border pattern designed to run along edges. Pattern should be horizontal or vertical strip with repeating elements. Design for linear repetition - pattern should tile seamlessly when placed end-to-end. Elements should flow continuously along the border line. Optimize for use as frame, edge decoration, or divider.',
      },
      {
        id: 'scattered',
        name: 'Scattered',
        use_cases: ['random placement'],
        instruction:
          'Create a scattered pattern with elements distributed across canvas. Vary element sizes and rotation for natural organic feel. Maintain overall visual balance - no large empty areas or dense clusters. Elements should not overlap unless intentional. Create sense of casual randomness while maintaining even distribution.',
      },
    ],
    compatible_with: ['geometric', 'floral_theme', 'abstract_theme'],
    best_for: ['textiles', 'wallpaper', 'wrapping_paper'],
  },
  {
    id: 'data-display',
    name: 'Data Display',
    type: 'template_type',
    description: 'Structured information presentation with labels and values',
    instruction:
      'Create a structured information display with clear organization and hierarchy. All data fields, labels, and values must be highly legible and properly aligned. Prioritize clarity and readability above all aesthetic concerns.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Data_Display_-_Thumbnail_1.png?v=1759369994',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Data_Display_-_Thumbnail_2.png?v=1759370008',
    ],
    subtypes: [
      {
        id: 'stats-grid',
        name: 'Stats Grid',
        use_cases: ['birth stats', 'metrics'],
        instruction:
          'Create a structured grid layout for displaying labeled statistics. Arrange data in clear rows or columns with consistent formatting. Each data point should have: label (smaller text) and value (larger prominent text). Maintain uniform spacing between all data fields. Use alignment to create visual organization. Ensure high legibility for both labels and values.',
      },
      {
        id: 'timeline',
        name: 'Timeline',
        use_cases: ['dates', 'events'],
        instruction:
          'Create a timeline layout showing chronological information. Display dates or events along a horizontal or vertical timeline axis. Include clear markers or nodes for each timeline point. Connect points with line or axis. Label each point with date and optional description. Maintain consistent spacing and alignment. Timeline should clearly show progression and sequence.',
      },
      {
        id: 'labeled-diagram',
        name: 'Labeled Diagram',
        use_cases: ['annotated visuals'],
        instruction:
          'Create a diagram with integrated labels and annotations. Central visual element should be primary focus with supporting labels positioned around it. Connect labels to diagram elements with clean lines or pointers. Maintain clear hierarchy: diagram dominant, labels supporting. Ensure no label overlaps or confusion. All text must be highly legible.',
      },
    ],
    compatible_with: ['minimalist', 'clean_styles'],
    best_for: ['infographics', 'keepsakes', 'educational'],
  },
  {
    id: 'map',
    name: 'Map & Coordinate',
    type: 'template_type',
    description: 'Geographic or celestial position representations',
    instruction:
      'Create a stylized map or chart showing location information. Use simplified forms and clear labeling. Maps should be clean and easy to read with essential features emphasized.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Map___Coordinate_-_Thumbnail_1.png?v=1759370021',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Map___Coordinate_-_Thumbnail_2.png?v=1759370034',
    ],
    subtypes: [
      {
        id: 'location-pin',
        name: 'Location Pin',
        use_cases: ['travel markers'],
        instruction:
          'Create a simplified map showing a specific location marked with a pin or marker. Map should show essential geographic features (roads, coastlines, landmarks) in simplified form. Mark target location with clear pin or circle marker. Include location name and optional coordinates as labels. Map should be stylized and clean, not photorealistic.',
      },
      {
        id: 'route',
        name: 'Route/Path',
        use_cases: ['journey maps'],
        instruction:
          'Create a map showing a path or route between multiple points. Display simplified geographic context with essential features. Mark start and end points clearly. Show route as continuous line connecting points. Include optional waypoint markers along route. Route line should be prominent and easy to follow.',
      },
      {
        id: 'star-chart',
        name: 'Star Chart',
        use_cases: ['astronomy', 'night sky'],
        instruction:
          'Create a celestial star chart showing constellation positions. Display stars as small dots with size variation for brightness. Connect constellation stars with thin lines to show traditional patterns. Include optional constellation names or symbols. Use circular boundary for sky view. Mark cardinal directions or celestial coordinates. Keep background dark. Ensure constellation patterns are recognizable.',
      },
    ],
    compatible_with: ['line-art', 'minimalist', 'travel_theme', 'astronomy_theme'],
    best_for: ['wall_art', 'keepsakes', 'gifts'],
  },
  {
    id: 'full-illustration',
    name: 'Full Illustration',
    type: 'template_type',
    description: 'Complete scene or subject without structural constraints',
    instruction:
      'Create a complete freeform illustration without specific structural constraints. Composition should serve the subject matter and artistic vision. Focus on creating a cohesive artistic statement.',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Full_Illustration_-_Thumbnail_1.png?v=1759370047',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Template_Type_-_Full_Illustration_-_Thumbnail_2.png?v=1759370060',
    ],
    subtypes: [
      {
        id: 'scene',
        name: 'Scene',
        use_cases: ['landscapes', 'environments'],
        instruction:
          'Create a complete illustrated scene with environment and context. Include foreground, midground, and background elements to create depth. Establish clear focal point while supporting with environmental details. Use atmospheric perspective if applicable. Compose elements to guide viewer eye through the scene. Maintain clear composition with intentional element placement.',
      },
      {
        id: 'object-study',
        name: 'Object Study',
        use_cases: ['food', 'products'],
        instruction:
          'Create a focused illustration of a specific object or subject. Object should be the sole focus occupying 50-80% of canvas. Show object from characteristic or flattering angle. Include sufficient detail to make object recognizable and appealing. Use minimal or no background - keep focus entirely on the object. Position object with balanced negative space.',
      },
      {
        id: 'abstract-composition',
        name: 'Abstract Composition',
        use_cases: ['non-representational'],
        instruction:
          'Create an abstract non-representational composition using shapes, colors, lines, and forms. Focus on visual balance, rhythm, and flow rather than depicting recognizable subjects. Arrange elements to create visual interest and movement. Use repetition, variation, and contrast intentionally. Maintain balanced composition with intentional positive and negative space.',
      },
    ],
    compatible_with: ['all_styles', 'all_themes'],
    best_for: ['wall_art', 'posters', 'canvas', 'apparel'],
  },
]

export { templateTypes }
