/**
 * Filter Preset Icons
 * SVG icons for path and image filter presets
 */

/**
 * Image filter preset thumbnail icons
 */
export function ImageFilterPresetIcon({ presetId, cssPreview }: { presetId: string; cssPreview: string }) {
  const iconSize = 40

  switch (presetId) {
    case 'silhouette':
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <rect x="0" y="0" width="24" height="24" fill="white" rx="2" />
          <path
            d="M12 4c-2.2 0-4 1.8-4 4 0 1.4.7 2.6 1.8 3.3C7.5 12.3 6 14.5 6 17v1h12v-1c0-2.5-1.5-4.7-3.8-5.7 1.1-.7 1.8-2 1.8-3.3 0-2.2-1.8-4-4-4z"
            fill="black"
          />
        </svg>
      )

    case 'vintage':
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <defs>
            <linearGradient id="vintage-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4a574" />
              <stop offset="50%" stopColor="#c4956a" />
              <stop offset="100%" stopColor="#a87d5a" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="22" height="22" rx="2" fill="url(#vintage-grad)" />
          <circle cx="8" cy="8" r="3" fill="#f5e6d3" opacity="0.7" />
          <path d="M6 16l4-5 3 4 5-7v10H6z" fill="#8b6914" opacity="0.5" />
        </svg>
      )

    case 'pop-art':
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <rect x="0" y="0" width="24" height="24" fill="#fff200" rx="2" />
          <circle cx="8" cy="8" r="5" fill="#ff0066" />
          <circle cx="16" cy="8" r="4" fill="#00ccff" />
          <circle cx="12" cy="16" r="5" fill="#ff6600" />
          <circle cx="18" cy="16" r="3" fill="#9933ff" />
        </svg>
      )

    case 'pencil-sketch':
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <rect x="0" y="0" width="24" height="24" fill="white" rx="2" />
          <g stroke="#333" strokeWidth="1" fill="none" strokeLinecap="round">
            <path d="M4 6c4 2 8-1 12 1" />
            <path d="M5 10c3-1 6 2 10 0" />
            <path d="M4 14c5 1 7-2 12 0" />
            <path d="M6 18c3 0 6 1 9-1" />
          </g>
          <path d="M18 4l2 2-8 8-2.5.5.5-2.5z" fill="#666" stroke="#333" strokeWidth="0.5" />
        </svg>
      )

    default:
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true" style={{ filter: cssPreview }}>
          <circle cx="12" cy="12" r="10" fill="currentColor" />
        </svg>
      )
  }
}

/**
 * Path filter preset thumbnail icons for printing techniques
 * Each icon visually represents the physical printing technique
 */
export function PathFilterPresetIcon({ presetId }: { presetId: string }) {
  const iconSize = 40

  switch (presetId) {
    case 'debossing':
      // Pressed-in effect - shows indented/sunken surface with shadow inside
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <defs>
            <linearGradient id="deboss-shadow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5C4033" />
              <stop offset="100%" stopColor="#8B7355" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="22" height="22" rx="2" fill="#8B7355" />
          {/* Pressed-in heart shape with inner shadow */}
          <path
            d="M12 18l-5.5-5.5c-1.5-1.5-1.5-4 0-5.5s4-1.5 5.5 0l0 0c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L12 18z"
            fill="url(#deboss-shadow)"
          />
          {/* Top-left highlight to show depth */}
          <path
            d="M12 17l-4.8-4.8c-1.2-1.2-1.2-3.2 0-4.4s3.2-1.2 4.4 0l.4.4.4-.4c1.2-1.2 3.2-1.2 4.4 0"
            fill="none"
            stroke="#A08060"
            strokeWidth="0.5"
          />
        </svg>
      )

    case 'embossing':
      // Raised effect - shows elevated surface with highlight on top
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <defs>
            <linearGradient id="emboss-highlight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C4A87C" />
              <stop offset="100%" stopColor="#8B7355" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="22" height="22" rx="2" fill="#8B7355" />
          {/* Raised heart shape with top highlight */}
          <path
            d="M12 18l-5.5-5.5c-1.5-1.5-1.5-4 0-5.5s4-1.5 5.5 0l0 0c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L12 18z"
            fill="url(#emboss-highlight)"
          />
          {/* Bottom-right shadow to show elevation */}
          <path d="M12 19l-6-6c-1.7-1.7-1.7-4.5 0-6.2" fill="none" stroke="#5C4033" strokeWidth="0.8" opacity="0.5" />
        </svg>
      )

    case 'hot-foil-stamping':
      // Metallic foil effect - shiny gold/metallic surface
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <defs>
            <linearGradient id="foil-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFE55C" />
              <stop offset="25%" stopColor="#FFD700" />
              <stop offset="50%" stopColor="#FFC125" />
              <stop offset="75%" stopColor="#FFD700" />
              <stop offset="100%" stopColor="#B8860B" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="22" height="22" rx="2" fill="#8B7355" />
          {/* Shiny metallic heart */}
          <path
            d="M12 18l-5.5-5.5c-1.5-1.5-1.5-4 0-5.5s4-1.5 5.5 0l0 0c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L12 18z"
            fill="url(#foil-gold)"
          />
          {/* Shine highlight */}
          <ellipse cx="9" cy="9" rx="1.5" ry="1" fill="#FFF8DC" opacity="0.6" />
        </svg>
      )

    case 'laser-engraving':
      // Burnt/etched effect - shows burned marking on surface
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <rect x="1" y="1" width="22" height="22" rx="2" fill="#A0826D" />
          {/* Burnt heart shape */}
          <path
            d="M12 18l-5.5-5.5c-1.5-1.5-1.5-4 0-5.5s4-1.5 5.5 0l0 0c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L12 18z"
            fill="#3D2817"
          />
          {/* Burn edge glow */}
          <path
            d="M12 18l-5.5-5.5c-1.5-1.5-1.5-4 0-5.5s4-1.5 5.5 0l0 0c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L12 18z"
            fill="none"
            stroke="#5C3D2E"
            strokeWidth="0.5"
          />
        </svg>
      )

    case 'diamond-drag':
      // Scratched/engraved shiny lines on metal
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <defs>
            <linearGradient id="metal-surface" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E8E8E8" />
              <stop offset="50%" stopColor="#C0C0C0" />
              <stop offset="100%" stopColor="#A0A0A0" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="22" height="22" rx="2" fill="url(#metal-surface)" />
          {/* Diamond-scratched heart outline with shine */}
          <path
            d="M12 18l-5.5-5.5c-1.5-1.5-1.5-4 0-5.5s4-1.5 5.5 0l0 0c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L12 18z"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
          <path
            d="M12 18l-5.5-5.5c-1.5-1.5-1.5-4 0-5.5s4-1.5 5.5 0l0 0c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L12 18z"
            fill="none"
            stroke="#D0D0D0"
            strokeWidth="0.5"
          />
        </svg>
      )

    case 'laser-annealing':
      // Dark oxidized mark on metal (no material removal)
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <defs>
            <linearGradient id="annealing-surface" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#D8D8D8" />
              <stop offset="100%" stopColor="#B0B0B0" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="22" height="22" rx="2" fill="url(#annealing-surface)" />
          {/* Dark oxidized heart - flat, no depth */}
          <path
            d="M12 18l-5.5-5.5c-1.5-1.5-1.5-4 0-5.5s4-1.5 5.5 0l0 0c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L12 18z"
            fill="#2C3E50"
          />
        </svg>
      )

    case 'deep-laser-engraving':
      // Deep carved effect - shows significant depth/groove
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <defs>
            <linearGradient id="deep-engrave" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#606060" />
              <stop offset="100%" stopColor="#404040" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="22" height="22" rx="2" fill="#A8A8A8" />
          {/* Deep carved heart with strong shadow */}
          <path
            d="M12 18l-5.5-5.5c-1.5-1.5-1.5-4 0-5.5s4-1.5 5.5 0l0 0c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L12 18z"
            fill="url(#deep-engrave)"
          />
          {/* Inner edge highlight showing depth */}
          <path
            d="M12 16.5l-4.5-4.5c-1.2-1.2-1.2-3.2 0-4.4s3.2-1.2 4.4 0l.1.1.1-.1c1.2-1.2 3.2-1.2 4.4 0"
            fill="none"
            stroke="#888"
            strokeWidth="0.5"
          />
        </svg>
      )

    case 'enamel-fill':
      // Glossy colored fill in engraved area
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <defs>
            <linearGradient id="enamel-gloss" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF6B6B" />
              <stop offset="50%" stopColor="#E74C3C" />
              <stop offset="100%" stopColor="#C0392B" />
            </linearGradient>
            <linearGradient id="enamel-metal" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E0E0E0" />
              <stop offset="100%" stopColor="#B0B0B0" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="22" height="22" rx="2" fill="url(#enamel-metal)" />
          {/* Glossy enamel-filled heart */}
          <path
            d="M12 18l-5.5-5.5c-1.5-1.5-1.5-4 0-5.5s4-1.5 5.5 0l0 0c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L12 18z"
            fill="url(#enamel-gloss)"
          />
          {/* Glossy shine highlight */}
          <ellipse cx="9" cy="9" rx="2" ry="1.2" fill="#FFFFFF" opacity="0.4" />
        </svg>
      )

    default:
      return (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden="true">
          <rect x="1" y="1" width="22" height="22" rx="2" fill="#888" />
          <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fff">
            ?
          </text>
        </svg>
      )
  }
}
