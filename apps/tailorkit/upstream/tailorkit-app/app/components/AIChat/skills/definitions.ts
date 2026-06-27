/**
 * Built-in skill definitions for TailorKit AI Chat.
 * Skills are explicit, named AI capabilities that merchants invoke via /command.
 * Architecture designed for custom skills later — not hardcoded to built-in only.
 */

/** Skill definition for the UI skills menu */
export interface SkillDefinition {
  /** Unique skill identifier */
  id: string
  /** Command name (without /), e.g., 'generate-options' */
  command: string
  /** Display label shown in skill menu */
  label: string
  /** One-line description of what the skill does */
  description: string
  /** Polaris icon component name (optional) */
  icon?: string
  /** Whether this skill is active or still under development */
  status: 'active' | 'coming_soon'
  /** Whether this skill requires template context to be available */
  requiresTemplate?: boolean
}

/** Built-in skills shipped with TailorKit */
export const BUILT_IN_SKILLS: SkillDefinition[] = [
  {
    id: 'customize',
    command: 'customize',
    label: 'skill-customize-label',
    description: 'skill-customize-description',
    icon: 'ListBulletedIcon',
    status: 'active',
    requiresTemplate: true,
  },
  {
    id: 'docs',
    command: 'docs',
    label: 'skill-docs-label',
    description: 'skill-docs-description',
    icon: 'SearchIcon',
    status: 'active',
  },
  {
    id: 'feedback',
    command: 'feedback',
    label: 'skill-feedback-label',
    description: 'skill-feedback-description',
    icon: 'ChatIcon',
    status: 'active',
  },
]

/** Get a skill by command name */
export function getSkillByCommand(command: string): SkillDefinition | undefined {
  return BUILT_IN_SKILLS.find(s => s.command === command)
}

/** Filter skills by partial command/label match */
export function filterSkills(query: string): SkillDefinition[] {
  const q = query.toLowerCase()
  return BUILT_IN_SKILLS.filter(s => s.command.toLowerCase().includes(q) || s.label.toLowerCase().includes(q))
}

/** Skill command prefix used in chat input */
export const SKILL_PREFIX = '/'
