const COMMON_ERROR = {
  NotFound: { status: 404, message: 'Not found', type: 'NOT_FOUND' },
  MissingParameter: { status: 422, message: 'Missing parameter', type: 'MISSING_PARAMETER' },
}

const SERVER_ERROR = {
  DefaultError: { status: 500, message: 'Server error', type: 'SERVER_ERROR' },
}

export { SERVER_ERROR, COMMON_ERROR }
