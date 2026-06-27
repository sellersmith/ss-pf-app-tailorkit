/**
 * Interceptor interface:
 * - `request` (optional): Modify the request before it is sent.
 * - `response` (optional): Modify the response after it is received.
 */
export interface FetchInterceptor {
  /**
   * request(input, init):
   *   Return a tuple of [newInput, newInit] if you want to change them.
   *   Otherwise, return the original or nothing.
   */
  request?(
    input: RequestInfo,
    init?: RequestInit
  ): void | [RequestInfo, RequestInit] | [RequestInfo] | Promise<void | [RequestInfo, RequestInit] | [RequestInfo]>

  /**
   * response(response):
   *   Return a new or modified Response (or a Promise of one).
   */
  response?: (
    response: Response,
    { input, init }: { input: RequestInfo; init?: RequestInit }
  ) => Response | Promise<Response>
}
