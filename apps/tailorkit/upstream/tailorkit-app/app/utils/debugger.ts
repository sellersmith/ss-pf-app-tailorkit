export function debug() {
  function startDebug(key: string) {
    console.log('START DEBUG: ', key, '----------------')
    return performance.now()
  }

  function endDebug(key: string) {
    console.log('END DEBUG: ', key, '----------------')
    return performance.now()
  }

  return {
    startDebug,
    endDebug,
  }
}
