/**
 * Pure utility functions for manipulating ExecutionPlan state.
 * No side effects — all functions return new plan objects.
 */

import type { ExecutionPlan, PlanStep } from '~/libs/langchain/skills/types'

/** Remove a step and cascade-delete conditions referencing it. Re-numbers remaining steps. */
export function removePlanStep(plan: ExecutionPlan, stepId: string): ExecutionPlan {
  const filteredSteps = plan.steps
    .filter(s => s.id !== stepId)
    .map((s, i) => {
      // Drop conditions that referenced the removed step
      const condition = s.condition?.dependsOnStep === stepId ? null : s.condition
      return { ...s, order: i + 1, condition }
    })

  // Drop flags that belonged to the removed step
  const filteredFlags = plan.flags.filter(f => f.stepId !== stepId)

  return { ...plan, steps: filteredSteps, flags: filteredFlags }
}

/** Update a single step by merging partial updates. */
export function updatePlanStep(plan: ExecutionPlan, stepId: string, updates: Partial<PlanStep>): ExecutionPlan {
  const steps = plan.steps.map(s => (s.id === stepId ? { ...s, ...updates } : s))
  return { ...plan, steps }
}

/** Find all steps whose condition.dependsOnStep === stepId. */
export function getDependentSteps(plan: ExecutionPlan, stepId: string): PlanStep[] {
  return plan.steps.filter(s => s.condition?.dependsOnStep === stepId)
}

/** Count steps that have a condition. */
export function countConditions(plan: ExecutionPlan): number {
  return plan.steps.filter(s => s.condition !== null).length
}
