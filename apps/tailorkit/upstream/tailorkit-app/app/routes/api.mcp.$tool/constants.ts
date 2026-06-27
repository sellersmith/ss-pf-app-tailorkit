export const MCP_TOOLS = {
  GET_LIST_TEMPLATES: 'get-list-templates',
  GET_DETAIL_TEMPLATE: 'get-detail-template',
  CREATE_TEMPLATE: 'create-template',
  GET_DETAIL_PRODUCT: 'get-detail-product',
  GET_LIST_PRODUCTS: 'get-list-products',
  GET_USER_PREFERENCES: 'get-user-preferences',
  GET_LIST_LAYERS_OF_TEMPLATE: 'get-list-layers-of-template',
  CREATE_LAYER: 'create-layer',
  UPDATE_LAYER: 'update-layer',
  MANAGE_LAYER: 'manage-layer',
  READ_COLLECTION_DATA: 'read-collection-data',
  ASSISTANT: 'assistant',
}

export const MCP_TOOLS_NEED_SEND_NOTIFICATION = [MCP_TOOLS.CREATE_TEMPLATE]

export const MCP_ERROR_CODES_MAP = {
  MISSING_TOOL: {
    code: 'MISSING_TOOL',
    message: 'Tool parameter is required',
    status: 400,
  },
  INVALID_TOOL: {
    code: 'INVALID_TOOL',
    message: 'Invalid tool specified',
    status: 400,
  },
  HANDLER_ERROR: {
    code: 'HANDLER_ERROR',
    message: 'An error occurred while processing the request',
    status: 500,
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later',
    status: 429,
  },
  TEMPLATE_TOOL_ERROR: {
    TEMPLATE_NOT_FOUND: {
      code: 'TEMPLATE_NOT_FOUND',
      message: 'Template not found',
      status: 404,
    },
  },
}

export const MCP_TOOL_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
}

export const MCP_TOOL_NOTIFICATION_MESSAGE = {
  [MCP_TOOLS.GET_LIST_TEMPLATES]: {
    [MCP_TOOL_STATUS.SUCCESS]: 'get-list-templates-notification-success',
    [MCP_TOOL_STATUS.ERROR]: 'get-list-templates-notification-error',
  },
  [MCP_TOOLS.GET_DETAIL_TEMPLATE]: {
    [MCP_TOOL_STATUS.SUCCESS]: 'get-detail-template-notification-success',
    [MCP_TOOL_STATUS.ERROR]: 'get-detail-template-notification-error',
  },
  [MCP_TOOLS.CREATE_TEMPLATE]: {
    [MCP_TOOL_STATUS.SUCCESS]: 'create-template-notification-success',
    [MCP_TOOL_STATUS.ERROR]: 'create-template-notification-error',
  },
  [MCP_TOOLS.GET_LIST_PRODUCTS]: {
    [MCP_TOOL_STATUS.SUCCESS]: 'get-list-products-notification-success',
    [MCP_TOOL_STATUS.ERROR]: 'get-list-products-notification-error',
  },
  [MCP_TOOLS.GET_USER_PREFERENCES]: {
    [MCP_TOOL_STATUS.SUCCESS]: 'get-user-preferences-notification-success',
    [MCP_TOOL_STATUS.ERROR]: 'get-user-preferences-notification-error',
  },
}

export interface MCPToolNotificationMessage {
  _id: string
  timestamp: string
  tool: (typeof MCP_TOOLS)[keyof typeof MCP_TOOLS]
  shopDomain: string
  promptRequest: string
  conversationTitle: string
  message: (typeof MCP_TOOL_NOTIFICATION_MESSAGE)[keyof typeof MCP_TOOL_NOTIFICATION_MESSAGE][keyof typeof MCP_TOOL_STATUS]
  data: any
}
