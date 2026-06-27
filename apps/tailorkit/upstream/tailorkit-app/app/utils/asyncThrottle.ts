import pThrottle from 'p-throttle'

export const asyncThrottle = (
  fn: (...args: any[]) => Promise<any> | any,
  limit: number = 1,
  interval: number = 500
) => {
  const throttled = pThrottle({
    limit,
    interval,
  })

  return throttled(fn)
}
