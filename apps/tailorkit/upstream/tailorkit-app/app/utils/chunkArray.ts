export const MAXIMUM_LAYERS_PROCESS = 15

export const chunkArray = (array: any[], size = MAXIMUM_LAYERS_PROCESS) => {
  if (array.length === 0) return []
  if (array.length < size) return [array]

  const chunkedArray = []

  for (let i = 0; i < array.length; i += size) {
    chunkedArray.push(array.slice(i, i + size))
  }

  return chunkedArray
}
