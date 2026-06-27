/**
 * FeatureComparisonTable Type Definitions
 *
 * Generic types for feature comparison table component.
 * Follows SOLID principles for maximum reusability.
 */

import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'

/**
 * Status of a feature for a specific plan
 */
export type FeatureStatus = 'included' | 'excluded' | 'custom'

/**
 * Feature value can be boolean, string, number, or ReactNode for custom rendering
 */
export type FeatureValue = boolean | string | number | ReactNode

/**
 * Feature definition for a single row in the comparison table
 */
export interface FeatureDefinition {
  /**
   * Unique identifier for the feature
   */
  id: string

  /**
   * Display name of the feature (translation key or string)
   */
  label: string

  /**
   * Optional subtitle or additional info (e.g., "Learn more" link)
   */
  subtitle?: ReactNode

  /**
   * Whether this row should have alternate background color
   */
  alternateBackground?: boolean

  /**
   * Whether this row is a group header (section divider, not a data row)
   */
  isGroupHeader?: boolean

  /**
   * Feature values for each plan
   * Key is plan alias (e.g., 'starter', 'growth', 'enterprise')
   */
  values: Record<string, FeatureValue>

  /**
   * Optional custom renderer for feature values
   * If provided, this will be used instead of default rendering
   */
  renderValue?: (value: FeatureValue, planAlias: string) => ReactNode

  /**
   * Optional callback to open a modal
   */
  openModal?: Function
}

/**
 * Plan column definition for header
 */
export interface PlanColumnDefinition {
  /**
   * Plan alias (e.g., 'starter', 'growth', 'enterprise')
   */
  alias: string

  /**
   * Display name of the plan
   */
  name: string

  /**
   * Plan price
   */
  price: number

  /**
   * Price period (e.g., 'month', 'year')
   */
  period?: string
}

/**
 * Props for FeatureComparisonTable component
 */
export interface FeatureComparisonTableProps {
  /**
   * Translation function
   */
  t: TFunction

  /**
   * Header label for the features column
   */
  headerLabel: ReactNode

  /**
   * Plan columns to display
   */
  plans: PlanColumnDefinition[]

  /**
   * Feature rows to display
   */
  features: FeatureDefinition[]

  /**
   * Optional: Maximum width for the table
   */
  maxWidth?: string
}

/**
 * Props for FeatureComparisonHeader component
 */
export interface FeatureComparisonHeaderProps {
  /**
   * Translation function
   */
  t: TFunction

  /**
   * Header label for the features column
   */
  headerLabel: string

  /**
   * Plan columns to display
   */
  plans: PlanColumnDefinition[]
}

/**
 * Props for FeatureComparisonRow component
 */
export interface FeatureComparisonRowProps {
  /**
   * Feature definition
   */
  feature: FeatureDefinition

  /**
   * Plan aliases in display order
   */
  planAliases: string[]
}
