export const MCP_ERROR_AUTH_ERRORS_MAP = {
  MISSING_TOKEN: {
    code: 'MISSING_TOKEN',
    message: 'Missing authentication token',
    status: 401,
  },
  MISSING_SHOP_DOMAIN: {
    code: 'MISSING_SHOP_DOMAIN',
    message: 'Shop domain is required',
    status: 400,
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    message: 'Invalid authentication token',
    status: 401,
  },
  MISMATCHED_SHOP: {
    code: 'MISMATCHED_SHOP',
    message: 'Token does not match provided shop domain',
    status: 403,
  },
  EXPIRED_TOKEN: {
    code: 'EXPIRED_TOKEN',
    message: 'Authentication token has expired',
    status: 401,
  },
  INVALID_REQUEST_BODY: {
    code: 'INVALID_REQUEST_BODY',
    message: 'Invalid request body format',
    status: 400,
  },
}

export const MCP_TOOLS_EVENT_MARKDOWN_KEY = 'event: '

export const MCP_TOOLS_DATA_MARKDOWN_VALUE = 'data: '
