/**
 * Filterable skills list for AI Chat.
 * Shows built-in skills with name + description.
 * Supports keyboard navigation (arrow keys + Enter).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Box, Icon, Text, BlockStack, InlineStack } from '@shopify/polaris'
import {
  ListBulletedIcon,
  TextIcon,
  PlusCircleIcon,
  CashDollarIcon,
  SearchIcon,
  ChatIcon,
} from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { BUILT_IN_SKILLS, SKILL_PREFIX, type SkillDefinition } from '../skills/definitions'
import styles from './skills-list.module.css'

/** Icon map for skill icons — maps icon string name to Polaris icon component */
const SKILL_ICON_MAP: Record<string, any> = {
  ListBulletedIcon,
  TextIcon,
  PlusCircleIcon,
  CashDollarIcon,
  SearchIcon,
  ChatIcon,
}

interface SkillsListProps {
  /** Filter string (text typed after /) */
  filter?: string
  /** Called when a skill is selected */
  onSelect: (skill: SkillDefinition) => void
  /** Called when user presses Escape or wants to close */
  onClose?: () => void
  /** Ref to expose keyboard handler to parent */
  onKeyDown?: (handler: (e: React.KeyboardEvent) => void) => void
}

export default function SkillsList({ filter = '', onSelect, onClose, onKeyDown: exposeKeyDown }: SkillsListProps) {
  const { t } = useTranslation()
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const filteredSkills = useMemo(() => {
    if (!filter) return BUILT_IN_SKILLS
    const q = filter.toLowerCase()
    return BUILT_IN_SKILLS.filter(s => s.command.toLowerCase().includes(q) || s.label.toLowerCase().includes(q))
  }, [filter])

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0)
  }, [filter])

  /** Handle keyboard events — called from parent to avoid duplicate listeners */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          setActiveIndex(prev => Math.min(prev + 1, filteredSkills.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          setActiveIndex(prev => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          if (filteredSkills[activeIndex] && filteredSkills[activeIndex].status !== 'coming_soon') {
            onSelect(filteredSkills[activeIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          onClose?.()
          break
      }
    },
    [filteredSkills, activeIndex, onSelect, onClose]
  )

  // Expose keyboard handler to parent component
  useEffect(() => {
    exposeKeyDown?.(handleKeyDown)
  }, [exposeKeyDown, handleKeyDown])

  if (filteredSkills.length === 0) {
    return (
      <div className={styles.SkillsListContainer}>
        <Box padding="300">
          <Text as="p" variant="bodySm" tone="subdued">
            No matching skills
          </Text>
        </Box>
      </div>
    )
  }

  return (
    <div className={styles.SkillsListContainer} ref={listRef}>
      <Box padding="100">
        <BlockStack gap="050">
          {filteredSkills.map((skill, index) => {
            const iconSource = skill.icon ? SKILL_ICON_MAP[skill.icon] : ListBulletedIcon
            const isComingSoon = skill.status === 'coming_soon'
            return (
              <button
                key={skill.id}
                className={`${styles.SkillItem} ${
                  index === activeIndex ? styles.SkillItemActive : ''
                } ${isComingSoon ? styles.SkillItemDisabled : ''}`}
                onClick={() => !isComingSoon && onSelect(skill)}
                onMouseEnter={() => setActiveIndex(index)}
                type="button"
                aria-disabled={isComingSoon}
              >
                <InlineStack gap="200" align="start" blockAlign="center" wrap={false}>
                  <Icon source={iconSource} tone={isComingSoon ? 'subdued' : 'base'} />
                  <BlockStack gap="0">
                    <InlineStack gap="100" blockAlign="center">
                      <Text as="span" variant="bodyMd" fontWeight="medium" tone={isComingSoon ? 'subdued' : undefined}>
                        {SKILL_PREFIX}
                        {skill.command}
                      </Text>
                      {isComingSoon && <Badge tone="info">Coming soon</Badge>}
                    </InlineStack>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t(skill.description)}
                    </Text>
                  </BlockStack>
                </InlineStack>
              </button>
            )
          })}
        </BlockStack>
      </Box>
    </div>
  )
}
