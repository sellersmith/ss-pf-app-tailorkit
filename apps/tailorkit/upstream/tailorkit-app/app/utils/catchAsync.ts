import { SERVER_ERROR } from '~/constants/status'
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'

/**
 * Higher-order function to catch async errors in route loaders/actions
 * @param fn - The async function to wrap
 * @returns A wrapped function that handles errors and redirects
 */
export const catchAsync = function (fn: Function) {
  return async function (this: unknown, ...args: any[]) {
    try {
      const result = await fn.apply(this, args)
      // If the result is a Response (redirect/json), return it directly
      if (result instanceof Response) {
        return result
      }
      return result
    } catch (err: unknown) {
      // If the error is a Response (redirect), return it
      if (err instanceof Response) {
        return err
      }

      const { message: _message } = SERVER_ERROR.DefaultError
      const message = err instanceof Error ? err.message : String(err) || _message

      console.error(`Catch async error at fn: ${fn.name} with err: ${err}`)

      return json({
        success: false,
        message,
      })
    }
  }
}

/**
 * Higher-order function specifically for Remix action/loader functions
 * @param fn - The action/loader function to wrap
 * @returns A wrapped function that handles errors and redirects
 */
export const catchAsyncActionLoader = function (fn: Function) {
  return async (args: ActionFunctionArgs) => {
    try {
      const result = await fn(args)
      // If the result is a Response (redirect/json), return it directly
      if (result instanceof Response) {
        return result
      }
      return result
    } catch (err: unknown) {
      // If the error is a Response (redirect), return it
      if (err instanceof Response) {
        return err
      }

      const { message: _message } = SERVER_ERROR.DefaultError
      const message = err instanceof Error ? err.message : String(err) || _message

      console.error(`Catch async error at fn: ${fn.name} with message: ${message}`)

      return json({
        success: false,
        message,
      })
    }
  }
}
