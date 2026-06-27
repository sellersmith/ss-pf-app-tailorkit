/**
 * @important Please be careful!
 * We only initialize the global instance in the server.js file
 * If you are using the global instance in the client, please check the global instance is not initialized before using it
 */

export function getGlobalInstance(instanceName) {
  return global[instanceName]
}

export function setGlobalInstance(instanceName, instance) {
  global[instanceName] = instance
}
