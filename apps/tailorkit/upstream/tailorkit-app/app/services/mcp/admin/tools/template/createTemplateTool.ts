/* eslint-disable max-len */
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { MCP_TOOLS } from '~/routes/api.mcp.$tool/constants'
import { UUID_PATTERN } from '../constants'

// Enhanced tool description with clearer execution flow
const createTemplateToolDescription = `
  Use this tool ONLY when the user explicitly requests to CREATE, GENERATE, BUILD, or MAKE a new template
  AND when ALL required information has been provided by the user.

  EXECUTION CRITERIA - MINIMUM requirements before calling this tool:
  ✓ User has explicitly requested template creation
  ✓ Shop domain is available (from context or user input)
  ✓ Template name is provided or can be inferred from request

  INFORMATION GATHERING STRATEGY:
  1. Check conversation history for shop domain first
  2. Only ask for missing critical information (shop domain, template name)
  3. Use smart defaults for dimensions and resolution unless user specifies otherwise
  4. Call tool immediately when minimum requirements are met

  REQUIRED INFORMATION (ask only if missing):
  - Shop domain (must end with .myshopify.com) - CRITICAL, must ask if missing
  - Template name - CRITICAL, must ask if missing or unclear

  OPTIONAL INFORMATION (use defaults if not specified):
  - Dimensions: Default 1000x1000px (suggest alternatives but don't require)
  - Unit: Default px (suggest alternatives but don't require)
  - Resolution: Default 300 DPI (suggest alternatives but don't require)

  ANTI-PATTERNS TO AVOID:
  - Do NOT call this tool multiple times for the same request
  - Do NOT call this tool if information is incomplete
  - Do NOT ask for information piece by piece
  - Do NOT assume user confirmation without explicit approval

  SUCCESS PATTERN:
  User: "Create template Test"
  Assistant: Gets shop domain from context, uses defaults (1000x1000px, 300dpi), calls tool ONCE

  User: "Create template Test 1000x1000px 300dpi"
  Assistant: Gets shop domain, uses specified dimensions, calls tool ONCE
`

const createTemplateTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: MCP_TOOLS.CREATE_TEMPLATE,
    description: createTemplateToolDescription,
    parameters: {
      type: 'object',
      properties: {
        templateId: {
          type: 'string',
          description: 'Auto-generate a valid UUID for the template identifier using crypto.randomUUID() or similar.',
          pattern: UUID_PATTERN,
        },
        shopDomain: {
          type: 'string',
          description:
            'REQUIRED: The shop domain ending with .myshopify.com. Must be obtained from user or conversation context.',
          pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\\.myshopify\\.com$',
        },
        name: {
          type: 'string',
          description: 'REQUIRED: User-specified template name. Do not use default if user provided a specific name.',
          minLength: 1,
          maxLength: 100,
        },
        dimension: {
          type: 'object',
          description: 'Template dimensions with smart defaults. Use defaults unless user specifies otherwise.',
          properties: {
            width: {
              type: 'number',
              description: 'Template width. Default 1000px is used if not specified by user.',
              minimum: 1,
              maximum: 10000,
              default: 1000,
            },
            height: {
              type: 'number',
              description: 'Template height. Default 1000px is used if not specified by user.',
              minimum: 1,
              maximum: 10000,
              default: 1000,
            },
            measurementUnit: {
              type: 'string',
              description: 'Measurement unit. Default px is used if not specified by user.',
              enum: ['px', 'inch', 'mm', 'cm', 'm'],
              default: 'px',
            },
            resolution: {
              type: 'number',
              description: 'Resolution in DPI. Default 300 DPI is used if not specified by user.',
              enum: [300, 150, 72, 36],
              default: 300,
            },
          },
          required: ['width', 'height', 'measurementUnit', 'resolution'],
          additionalProperties: false,
        },
      },
      required: ['shopDomain', 'name', 'dimension', 'templateId'],
      additionalProperties: false,
    },
  },
}

export default createTemplateTool
