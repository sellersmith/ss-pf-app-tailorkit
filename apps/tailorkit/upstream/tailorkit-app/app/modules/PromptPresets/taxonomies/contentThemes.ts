/* eslint-disable max-len */

// ============================================================================
// DIMENSION 3: CONTENT THEME (Subject Matter)
// Defines what the design depicts or represents - independent of style/structure
// ============================================================================

const contentThemes = [
  {
    id: 'personal-identity',
    name: 'Personal Identity',
    type: 'content_theme',
    description: 'Individual names, initials, and personal markers',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Personal_Identity_-_Thumbnail_1.png?v=1759369282',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Personal_Identity_-_Thumbnail_2.png?v=1759369294',
    ],
    instruction:
      'Focus on personal identity elements: names, initials, monograms, or signatures. Typography should be elegant, legible, and timeless. Letterforms should be properly spaced and balanced. If using initials, arrange them harmoniously - typically with larger center initial flanked by smaller first and last initials, or equal sizing for couples. Ensure all text is perfectly legible and well-kerned. Consider hierarchy: primary name or initials dominant, any supporting text (dates, locations) secondary.',
    includes: ['monograms', 'name_art', 'initials', 'signatures'],
    common_use_cases: ['personalized_gifts', 'branding', 'ownership_marking'],
    works_best_with: ['text-layout', 'badge', 'frame'],
  },
  {
    id: 'relationships',
    name: 'Relationships',
    type: 'content_theme',
    description: 'Connections between people - romantic, familial, friendship',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Relationships_-_Thumbnail_1.png?v=1759369306',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Relationships_-_Thumbnail_2.png?v=1759369318',
    ],
    instruction:
      'Depict relationships between people through names, symbols, or connections. For couples: join names with ampersand (&), heart, or "and". Maintain equal visual weight between all parties - NO name should dominate unless specifically requested. For families: show connections through tree structures, grouped names, or unified compositions. For memorial: use respectful dignified approach with appropriate symbols (wings, doves, peaceful imagery). Include relevant dates sensitively. Create sense of connection, unity, or remembrance as appropriate.',
    includes: ['couples', 'family_trees', 'wedding', 'anniversary', 'memorial'],
    common_use_cases: ['wedding_gifts', 'anniversary', 'family_keepsakes'],
    works_best_with: ['text-layout', 'frame', 'data-display'],
  },
  {
    id: 'life-events',
    name: 'Life Events',
    type: 'content_theme',
    description: 'Milestone moments and significant dates',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Life_Events_-_Thumbnail_1.png?v=1759369331',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Life_Events_-_Thumbnail_2.png?v=1759369344',
    ],
    instruction:
      'Commemorate important life milestones and dates through structured information display. For births: present stats (name, date, time, weight, length) in organized clear hierarchy. For graduations: include year, institution, achievement. For anniversaries: feature date prominently with optional years together. Maintain clear data hierarchy: most important information (names, main dates) should be largest and most prominent. Include appropriate celebratory or commemorative elements without overwhelming the data. Ensure all information is perfectly legible and properly formatted.',
    includes: ['birth_stats', 'wedding_dates', 'anniversaries', 'graduations'],
    common_use_cases: ['commemorative_gifts', 'keepsakes', 'announcements'],
    works_best_with: ['data-display', 'text-layout', 'badge'],
  },
  {
    id: 'nature',
    name: 'Nature & Botanical',
    type: 'content_theme',
    description: 'Plants, flowers, landscapes, and natural elements',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Nature___Botanical_-_Thumbnail_1.png?v=1759369357',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Nature___Botanical_-_Thumbnail_2.png?v=1759369369',
    ],
    instruction:
      'Depict natural botanical elements including flowers, leaves, branches, trees, or landscapes. Use natural flowing organic forms that reflect how plants actually grow. For florals: show characteristic petal arrangements, leaves, and stems with botanical accuracy. Maintain elegant natural proportions. Flowers should feel alive and organic, not stiff or artificial. For landscapes: establish clear foreground, midground, background. Use natural perspective and atmospheric depth. Maintain organic flowing lines throughout. Avoid rigid geometric treatment unless specifically combining with geometric style.',
    includes: ['floral', 'botanical', 'leaves', 'trees', 'landscapes', 'seasons'],
    common_use_cases: ['feminine_products', 'home_decor', 'wellness'],
    works_best_with: ['frame', 'pattern', 'full-illustration'],
  },
  {
    id: 'animals',
    name: 'Animals & Pets',
    type: 'content_theme',
    description: 'Domestic pets and wildlife',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Animals___Pets_-_Thumbnail_1.png?v=1759369382',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Animals___Pets_-_Thumbnail_2.png?v=1759369394',
    ],
    instruction:
      'Depict animals with characteristic features and recognizable proportions. Capture essential identifying characteristics: distinctive markings, breed-specific features, characteristic poses. For pets: show personality and individual character when possible. Maintain proper anatomical proportions even when stylizing. Focus on face and expression as primary elements - eyes particularly important for character. Include key identifying features: ear shape, tail, distinctive markings, coat patterns. For silhouettes: ensure breed is recognizable through overall outline alone. Create poses that feel natural and characteristic to the animal.',
    includes: ['dogs', 'cats', 'birds', 'wildlife', 'pet_portraits'],
    common_use_cases: ['pet_memorial', 'pet_owners', 'animal_lovers'],
    works_best_with: ['portrait', 'icon-set', 'badge'],
  },
  {
    id: 'geometric',
    name: 'Geometric & Abstract',
    type: 'content_theme',
    description: 'Shapes, patterns, and non-representational designs',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Geometric___Abstract_-_Thumbnail_1.png?v=1759369407',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Geometric___Abstract_-_Thumbnail_2.png?v=1759369421',
    ],
    instruction:
      "Create geometric or abstract compositions using shapes, patterns, and non-representational forms. For sacred geometry: use precise mathematical relationships - golden ratio, Fibonacci sequences, specific angular relationships. Include traditional sacred forms: flower of life, metatron's cube, sri yantra. For abstract patterns: create balanced compositions with intentional relationships between elements. Use repetition, symmetry, and visual rhythm. For general geometric: maintain precise angles, clean shapes, mathematical precision. Geometric elements should feel precise and purposeful, not random.",
    includes: ['sacred_geometry', 'mandalas', 'abstract_shapes', 'patterns'],
    common_use_cases: ['yoga', 'wellness', 'modern_decor', 'meditation'],
    works_best_with: ['pattern', 'full-illustration', 'icon-set'],
  },
  {
    id: 'celestial',
    name: 'Celestial & Mystical',
    type: 'content_theme',
    description: 'Stars, cosmos, astrology, and spiritual symbols',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Celestial___Mystical_-_Thumbnail_1.png?v=1759369434',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Celestial___Mystical_-_Thumbnail_2.png?v=1759369448',
    ],
    instruction:
      'Depict celestial and mystical elements including zodiac symbols, constellations, stars, moon phases, sun symbols, or spiritual imagery. For zodiac: use traditional constellation patterns and recognizable astrological glyphs. Stars should vary in size to suggest brightness. For star maps: plot constellation positions with astronomical accuracy for specified date/location. Connect constellation stars with thin lines. For moon phases: show accurate lunar phase. For spiritual symbols: use culturally respectful representations. Include labels or coordinates when appropriate for star charts.',
    includes: ['zodiac', 'constellations', 'star_maps', 'moon', 'sun', 'spiritual_symbols'],
    common_use_cases: ['astrology_fans', 'spiritual_products', 'anniversary_gifts'],
    works_best_with: ['map', 'icon-set', 'badge'],
  },
  {
    id: 'hobbies',
    name: 'Hobbies & Activities',
    type: 'content_theme',
    description: 'Sports, recreation, and personal interests',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Hobbies___Activities_-_Thumbnail_1.png?v=1759369462',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Hobbies___Activities_-_Thumbnail_2.png?v=1759369473',
    ],
    instruction:
      'Depict activities, sports, hobbies, or recreational interests through recognizable symbols and imagery. For sports: show characteristic equipment, poses, or symbols (balls, rackets, athletes in action). Capture dynamic movement when applicable. For music: include recognizable instruments or musical symbols. For outdoor activities: show adventure gear, mountains, trails, camping equipment. Keep symbols clear and universally recognizable. Avoid specific team logos or trademarked imagery - use generic representations. Include optional text like team names, player numbers, or motivational phrases.',
    includes: ['sports', 'gaming', 'music', 'adventure', 'fitness', 'crafts'],
    common_use_cases: ['sports_teams', 'hobbyist_merchandise', 'lifestyle_products'],
    works_best_with: ['icon-set', 'badge', 'full-illustration'],
  },
  {
    id: 'food-beverage',
    name: 'Food & Beverage',
    type: 'content_theme',
    description: 'Culinary subjects and drink items',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Food___Beverage_-_Thumbnail_1.png?v=1759369486',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Food___Beverage_-_Thumbnail_2.png?v=1759369500',
    ],
    instruction:
      'Depict food and beverage items with appetizing appeal and recognizable forms. Food should look fresh, appealing, and clearly identifiable. For coffee/drinks: show characteristic containers, steam effects, beverage layers. For food items: capture essential identifying features and appetizing appearance. Use appropriate styling: kawaii/cute with character faces, retro diner with nostalgic treatment, minimalist/gourmet with refined simplicity. Avoid specific brand logos or trademarked food items. Include optional related elements: coffee beans, utensils, decorative flourishes.',
    includes: ['coffee', 'food_items', 'cocktails', 'baking', 'cuisine'],
    common_use_cases: ['kitchen_products', 'restaurant_merchandise', 'foodie_gifts'],
    works_best_with: ['full-illustration', 'icon-set', 'badge'],
  },
  {
    id: 'nostalgic',
    name: 'Nostalgic & Retro',
    type: 'content_theme',
    description: 'Historical periods and vintage culture',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Nostalgic___Retro_-_Thumbnail_1.png?v=1759369512',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Nostalgic___Retro_-_Thumbnail_2.png?v=1759369525',
    ],
    instruction:
      'Depict nostalgic subjects from specific historical periods including vintage technology, retro objects, classic items from past decades. For retro tech (90s-2000s): show period-accurate technology - old computers, cassette tapes, VHS, floppy disks, early mobile phones, dial-up modems, vintage gaming consoles. Include authentic interface elements: Windows 95/98/XP UI, early Mac OS, old browser windows, error messages. For general vintage: capture authentic design elements from the target era. Maintain period accuracy in proportions, details, and styling. Focus on items that evoke specific memories and cultural moments.',
    includes: ['retro_tech', 'y2k', 'vintage_objects', '80s_90s', 'classic_items'],
    common_use_cases: ['nostalgia_products', 'millennial_market', 'vintage_aesthetic'],
    works_best_with: ['full-illustration', 'icon-set', 'badge'],
    best_visual_style: 'retro',
  },
  {
    id: 'culture',
    name: 'Cultural & Subculture',
    type: 'content_theme',
    description: 'Specific cultural movements and communities',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Cultural___Subculture_-_Thumbnail_1.png?v=1759369539',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Cultural___Subculture_-_Thumbnail_2.png?v=1759369553',
    ],
    instruction:
      'Depict elements from specific cultural movements, subcultures, or fan communities. For anime/manga: use characteristic Japanese animation and comic art visual language - large expressive eyes, specific hair styling, cultural elements. For gothic: include dark ornamental motifs - skulls, roses, ravens, Victorian elements, architectural details, dramatic imagery. For bohemian: incorporate free-spirited elements - feathers, dreamcatchers, celestial symbols, organic flowing forms. For kawaii/cute: employ Japanese cute culture elements - rounded forms, pastel colors, character faces. Maintain cultural respect and authenticity.',
    includes: ['anime', 'gaming', 'gothic', 'bohemian', 'punk', 'kawaii'],
    common_use_cases: ['fan_merchandise', 'subculture_products', 'identity_expression'],
    works_best_with: ['full-illustration', 'badge', 'portrait'],
  },
  {
    id: 'humor',
    name: 'Humor & Quotes',
    type: 'content_theme',
    description: 'Funny phrases, jokes, and inspirational text',
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Humor___Quotes_-_Thumbnail_1.png?v=1759369567',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Content_Theme_-_Humor___Quotes_-_Thumbnail_2.png?v=1759369580',
    ],
    instruction:
      'Feature humorous text, jokes, puns, memes, quotes, or sayings as the primary content. Text should be the star - ensure perfect legibility and strong typographic hierarchy. For humor: embrace wit, wordplay, and contemporary internet culture references. For quotes: balance inspiration with avoiding oversaturated generic motivational phrases. Favor hyper-specific niche humor over broad generic sayings. Support text with minimal complementary graphics that enhance rather than compete. Typography should match the tone: playful fonts for humor, bold confident fonts for empowerment. Keep designs family-friendly unless specifically requested otherwise.',
    includes: ['jokes', 'puns', 'memes', 'quotes', 'sayings', 'sarcasm'],
    common_use_cases: ['casual_apparel', 'gift_market', 'novelty_items'],
    works_best_with: ['text-layout', 'badge', 'icon-set'],
  },
]

export { contentThemes }
