/* eslint-disable max-len */
const valentineDirectPrintEngravePrompts = [
  {
    hot: true,
    name: 'Our Story Timeline',
    alias: 'our_story_timeline',
    type: 'quick_prompt',
    category: 'engraved',
    instruction: `Generate relationship timeline design template.
Milestones:
- First Met: "{{Date_1}}"
- First Date: "{{Date_2}}"
- Said "I Love You": "{{Date_3}}"
- Engaged/Married: "{{Date_4}}"
- "{{Custom_Milestone}}": "{{Date_5}}"
Style specifications:
- Vertical or horizontal timeline layout
- Milestone markers (hearts, dots, or stars)
- Dates in clean typography
- Milestone labels in elegant script
- Connecting line between events
- Romantic storytelling aesthetic
- Single color: black on white background
Output: Relationship timeline design, solid white background.
MUST-FOLLOW: Never change provided milestones and do not include "\\{\\{Custom_Milestone\\}\\}" and "\\{\\{Date_5\\}\\}" in the output.`,
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Our_Story_Timeline_-_Thumbnail_1.png?v=1768378947',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Our_Story_Timeline_-_Thumbnail_2.png?v=1768379668',
    ],
  },
  {
    hot: true,
    name: 'Heart Variations',
    alias: 'heart_variations',
    type: 'quick_prompt',
    category: 'engraved',
    instruction: `Generate a heart design in "{{Style_(either_of_CLASSIC,_ANATOMICAL,_GEOMETRIC,_FINGERPRINT,_MINIMALIST,_DOUBLE,_HEARTBEAT,_INFINITY_HEART,_CELTIC,_ARROW)}}" variation with an optional message "{{Message}}".
Style options:
- CLASSIC: Traditional symmetrical heart outline
- ANATOMICAL: Realistic human heart line drawing
- GEOMETRIC: Heart made of geometric shapes/triangles
- FINGERPRINT: Heart shape filled with fingerprint lines
- MINIMALIST: Ultra-simple single-line heart
- DOUBLE: Two hearts intertwined or overlapping
- HEARTBEAT: Heart with EKG/pulse line through it
- INFINITY HEART: Heart shape merged with infinity symbol
- CELTIC: Heart with Celtic knot patterns
- ARROW: Heart with arrow through it (cupid style)
Style specifications:
- Clean line art rendering of chosen heart style
- Suitable for jewelry engraving scale
- Single color: black on white background
- Balanced, centered composition
Output: Heart design, centered, solid white background.
MUST FOLLOW: If message is not provided or is empty or is matching "\\{\\{Message\\}\\}", generate a design with no message.`,
    thumbnail: [
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Heart_Variations_-_Thumbnail_1.png?v=1768380901',
      'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/Quick_Prompt_-_Heart_Variations_-_Thumbnail_2.png?v=1768380539',
    ],
  },
]

export default valentineDirectPrintEngravePrompts
