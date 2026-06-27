// Get the object model from the Mongoose object
export function getObjectModel(object: any) {
  const _object = typeof object?.toObject === 'function' ? object.toObject() : object

  return _object
}
