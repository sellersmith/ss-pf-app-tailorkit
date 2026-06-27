export function copyObjectProperties(obj: any) {
  if (!obj) return obj

  const propertyNames = Object.getOwnPropertyNames(obj)
  const newData: any = {}
  for (const prop of propertyNames) {
    newData[prop] = obj[prop]
  }

  return newData
}
