/**
 * Zod schemas + OpenAI JSON Schema for ExecutionPlan structured output.
 * Used by generate-options handler for planning-aware generation.
 */

import { z } from 'zod'

/** Zod schema for validating LLM output as ExecutionPlan */
export const PlanStepSchema = z.object({
  id: z.string(),
  order: z.number(),
  label: z.string(),
  elementType: z.enum(['text', 'text_customer', 'image', 'imageless']),
  content: z.string().nullish(),
  fontFamily: z.string().nullish(),
  fontSize: z.number().nullish(),
  textColor: z.string().nullish(),
  textAlign: z.enum(['left', 'center', 'right']).nullish(),
  displayStyle: z.string().nullish(),
  values: z
    .array(
      z.object({
        name: z.string(),
        value: z.string().nullish(),
        pricing: z.number().nullish(),
      })
    )
    .nullish(),
  settings: z
    .object({
      placeholder: z.string().nullish(),
      characterLimit: z.number().nullish(),
      required: z.boolean().nullish(),
      allowMultiLineText: z.boolean().nullish(),
    })
    .nullish(),
  /** Font options as sub-property of text elements (resolved to URLs by server) */
  fontOptions: z.array(z.object({ name: z.string() })).nullish(),
  /** Color options as sub-property of text elements (hex values) */
  colorOptions: z.array(z.object({ name: z.string(), value: z.string() })).nullish(),
  condition: z
    .object({
      dependsOnStep: z.string(),
      whenValue: z.string(),
      action: z.enum(['show', 'hide']),
    })
    .nullish(),
})

export const PlanFlagSchema = z.object({
  stepId: z.string().nullish(),
  type: z.enum(['limitation', 'suggestion', 'manual_required']),
  message: z.string(),
})

export const ExecutionPlanSchema = z.object({
  reasoning: z.string(),
  title: z.string(),
  steps: z.array(PlanStepSchema),
  flags: z.array(PlanFlagSchema),
})

/**
 * OpenAI strict JSON Schema for response_format.
 * All fields must be in `required` with explicit nullable types.
 */
export const EXECUTION_PLAN_JSON_SCHEMA = {
  name: 'execution_plan',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      reasoning: { type: 'string' },
      title: { type: 'string' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            order: { type: 'number' },
            label: { type: 'string' },
            elementType: { type: 'string', enum: ['text', 'text_customer', 'image', 'imageless'] },
            content: { type: ['string', 'null'] },
            fontFamily: { type: ['string', 'null'] },
            fontSize: { type: ['number', 'null'] },
            textColor: { type: ['string', 'null'] },
            textAlign: { type: ['string', 'null'], enum: ['left', 'center', 'right', null] },
            displayStyle: { type: ['string', 'null'] },
            values: {
              type: ['array', 'null'],
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: { type: ['string', 'null'] },
                  pricing: { type: ['number', 'null'] },
                },
                required: ['name', 'value', 'pricing'],
                additionalProperties: false,
              },
            },
            settings: {
              type: ['object', 'null'],
              properties: {
                placeholder: { type: ['string', 'null'] },
                characterLimit: { type: ['number', 'null'] },
                required: { type: ['boolean', 'null'] },
                allowMultiLineText: { type: ['boolean', 'null'] },
              },
              required: ['placeholder', 'characterLimit', 'required', 'allowMultiLineText'],
              additionalProperties: false,
            },
            fontOptions: {
              type: ['array', 'null'],
              items: {
                type: 'object',
                properties: { name: { type: 'string' } },
                required: ['name'],
                additionalProperties: false,
              },
            },
            colorOptions: {
              type: ['array', 'null'],
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['name', 'value'],
                additionalProperties: false,
              },
            },
            condition: {
              type: ['object', 'null'],
              properties: {
                dependsOnStep: { type: 'string' },
                whenValue: { type: 'string' },
                action: { type: 'string', enum: ['show', 'hide'] },
              },
              required: ['dependsOnStep', 'whenValue', 'action'],
              additionalProperties: false,
            },
          },
          required: [
            'id',
            'order',
            'label',
            'elementType',
            'content',
            'fontFamily',
            'fontSize',
            'textColor',
            'textAlign',
            'displayStyle',
            'values',
            'settings',
            'fontOptions',
            'colorOptions',
            'condition',
          ],
          additionalProperties: false,
        },
      },
      flags: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            stepId: { type: ['string', 'null'] },
            type: { type: 'string', enum: ['limitation', 'suggestion', 'manual_required'] },
            message: { type: 'string' },
          },
          required: ['stepId', 'type', 'message'],
          additionalProperties: false,
        },
      },
    },
    required: ['reasoning', 'title', 'steps', 'flags'],
    additionalProperties: false,
  },
} as const
