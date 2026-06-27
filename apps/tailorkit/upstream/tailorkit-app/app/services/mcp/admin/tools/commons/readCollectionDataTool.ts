/* eslint-disable max-len */
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { MCP_TOOLS } from '~/routes/api.mcp.$tool/constants'
import { SUPPORTED_COLLECTIONS } from '../constants'
import { getCollectionNames, generateSupportedCollectionsDescription } from '../fns.server'

// Tool description for reading collection data
const readCollectionDataToolDescription = `
  Use this tool to READ and QUERY data from any collection in the TailorKit database.

  CRITICAL BEHAVIOR: You must collect ALL required information in ONE conversation turn before calling this tool.

  SUPPORTED COLLECTIONS:
  ${generateSupportedCollectionsDescription()}

  REQUIRED INFORMATION TO COLLECT ALL AT ONCE:
  1. What type of data user wants (templates, layers, images, shop info, etc.)
  2. Shop domain (must end with .myshopify.com)
  3. Any specific criteria (find by name, in specific template, etc.)
  4. How much data to return (optional - reasonable defaults applied)

  EFFICIENT INTERACTION PATTERN:
  - When user requests data, ask for ALL missing information in a SINGLE response using user-friendly terms
  - Example: "To get your data, I need: 1) What you want to see (templates, layers, images, etc.), 2) Your shop domain, 3) Any specific filters (find by name, ID, etc.)"
  - For unclear requests, suggest options: "What would you like to see? Your templates, layers in a template, images, shop settings, or something else?"
  - DO NOT ask for information one by one - collect everything at once
  - Use business terms, not technical database terms
  - Only call this tool when you have ALL required parameters

  USER-FRIENDLY EXAMPLES:
  - "Show me my templates" → collection: Template, filters: all templates
  - "List layers in template ABC" → collection: Layer, filters: by template
  - "Find templates with 'banner' in name" → collection: Template, filters: by name search
  - "Get my shop information" → collection: Shop, filters: by shop domain
  - "Show images I uploaded" → collection: Image, filters: all images

  CONTEXT AWARENESS:
  - If shop domain is mentioned in conversation history, reuse it
  - If data type is clear from user request ("show my templates", "list layers"), don't ask again
  - If specific IDs or names mentioned in conversation history, use them automatically
  - For ambiguous requests like "show my data", ask: "What would you like to see? Templates, layers, images, or shop information?"
  - Only ask for truly missing information

  QUERY EXAMPLES:
  - Find template by ID: { "_id": "template-uuid" }
  - Find layers in template: { "templateId": "template-uuid" }
  - Find all templates: {} (empty object for all)
  - Find by name: { "name": { "$regex": "banner", "$options": "i" } }
  - Find non-deleted: { "deletedAt": null }

  DO NOT use this tool for creation, updates, or deletions - only for reading data.

  This tool performs read operations on the TailorKit database collections.`

const readCollectionDataTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: MCP_TOOLS.READ_COLLECTION_DATA,
    description: readCollectionDataToolDescription,
    parameters: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          enum: getCollectionNames(),
          description:
            'REQUIRED: Map user request to appropriate data type. Templates→Template, layers→Layer, images→Image, shop info→Shop, etc.',
        },
        shopDomain: {
          type: 'string',
          description:
            'REQUIRED: The authorized shop domain ends with .myshopify.com. SECURITY: Must match the domain from system prompt. Check conversation history first.',
        },
        filters: {
          type: 'object',
          description:
            'REQUIRED: Convert user criteria to MongoDB filters. Examples: {"_id": "uuid"} for specific item, {"templateId": "uuid"} for layers in template, {"name": {"$regex": "search", "$options": "i"}} for name search, {} for all items',
          additionalProperties: true,
        },
        fields: {
          type: 'object',
          description:
            'OPTIONAL: Fields to include/exclude in results. MongoDB projection object. Example: {"name": 1, "dimension": 1} or {"settings": 0}',
          additionalProperties: true,
        },
        options: {
          type: 'object',
          description: 'OPTIONAL: Query options like limit, sort, skip, populate',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of documents to return',
              minimum: 1,
              maximum: 1000,
              default: 100,
            },
            skip: {
              type: 'number',
              description: 'Number of documents to skip',
              minimum: 0,
              default: 0,
            },
            sort: {
              type: 'object',
              description: 'Sort order. Example: {"createdAt": -1} for newest first',
              additionalProperties: true,
            },
            populate: {
              type: 'array',
              description: 'Related collections to populate. Available fields vary by collection.',
              items: {
                type: 'string',
                // Dynamic populate fields based on all collections
                enum: [...new Set(Object.values(SUPPORTED_COLLECTIONS).flatMap(c => c.populateFields))],
              },
            },
          },
          additionalProperties: false,
        },
      },
      required: ['collection', 'shopDomain', 'filters'],
      additionalProperties: false,
    },
  },
}

export default readCollectionDataTool
