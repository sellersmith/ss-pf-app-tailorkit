import type { FileRecord, IDB_Database, JSONRecord } from '~/types/index-db'

// Version management for database schema
const DB_VERSION = 3 // Increment this when schema changes

export function openIDBDatabase(dbName: string, storeName: string): Promise<IDB_Database> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION)

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Check if object store already exists before creating
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' })
      }
    }

    request.onsuccess = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Validate that the required object store exists
      if (!db.objectStoreNames.contains(storeName)) {
        // Close the database and try to recreate it with proper schema
        db.close()
        deleteDatabase(dbName)
          .then(() => {
            // Recursively call to recreate database with proper schema
            openIDBDatabase(dbName, storeName).then(resolve).catch(reject)
          })
          .catch(reject)
        return
      }

      resolve(db)
    }

    request.onerror = (event: Event) => {
      reject((event.target as IDBOpenDBRequest).error)
    }

    request.onblocked = (event: Event) => {
      console.warn('Database upgrade blocked. Please close other tabs using this database.')
      reject(new Error('Database upgrade blocked'))
    }
  })
}

// Helper function to delete database
function deleteDatabase(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(dbName)
    deleteRequest.onsuccess = () => resolve()
    deleteRequest.onerror = () => reject(deleteRequest.error)
    deleteRequest.onblocked = () => {
      console.warn('Database deletion blocked. Please close other tabs using this database.')
      reject(new Error('Database deletion blocked'))
    }
  })
}

// Enhanced function to validate object store exists before operations
function validateObjectStore(db: IDB_Database, storeName: string): void {
  if (!db.objectStoreNames.contains(storeName)) {
    throw new Error(
      `Object store '${storeName}' not found in database. Available stores: ${Array.from(db.objectStoreNames).join(', ')}`
    )
  }
}

export async function storeFileToIDB(
  db: IDB_Database,
  storeName: string,
  file: File,
  id: string,
  fileName?: string
): Promise<void> {
  // Validate object store exists
  validateObjectStore(db, storeName)

  const reader = new FileReader()

  return new Promise((resolve, reject) => {
    reader.onload = async (event: ProgressEvent<FileReader>) => {
      try {
        const transaction = db.transaction([storeName], 'readwrite')
        const objectStore = transaction.objectStore(storeName)
        const arrayBuffer = event.target?.result as ArrayBuffer

        const request = objectStore.add({ id, name: fileName || id, data: arrayBuffer })

        request.onsuccess = () => resolve()
        request.onerror = error => reject(error)

        transaction.onerror = error => reject(error)
        transaction.onabort = () => reject(new Error('Transaction aborted'))
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = error => reject(error)
    reader.readAsArrayBuffer(file)
  })
}

export async function storeJSONFileToIDB(db: IDB_Database, storeName: string, jsonObject: object, id: string) {
  // Validate object store exists
  validateObjectStore(db, storeName)

  const jsonString = JSON.stringify(jsonObject)

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readwrite')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.put({ id, data: jsonString })

      request.onsuccess = () => resolve(id)
      request.onerror = error => reject(error)

      transaction.onerror = error => reject(error)
      transaction.onabort = () => reject(new Error('Transaction aborted'))
    } catch (error) {
      reject(error)
    }
  })
}

export async function getFileFromIDB(db: IDB_Database, storeName: string, fileId: string): Promise<FileRecord | null> {
  // Validate object store exists
  validateObjectStore(db, storeName)

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName])
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.get(fileId)

      request.onsuccess = (event: Event) => resolve((event.target as IDBRequest).result)
      request.onerror = error => reject(error)

      transaction.onerror = error => reject(error)
      transaction.onabort = () => reject(new Error('Transaction aborted'))
    } catch (error) {
      reject(error)
    }
  })
}

export async function getJSONFromIDB(db: IDB_Database, storeName: string, id: string): Promise<object | null> {
  // Validate object store exists
  validateObjectStore(db, storeName)

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName])
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.get(id)

      request.onsuccess = (event: Event) => {
        const record = (event.target as IDBRequest).result as JSONRecord
        if (record) {
          const jsonObject = JSON.parse(record.data)
          resolve(jsonObject)
        } else {
          resolve(null)
        }
      }

      request.onerror = error => reject(error)

      transaction.onerror = error => reject(error)
      transaction.onabort = () => reject(new Error('Transaction aborted'))
    } catch (error) {
      reject(error)
    }
  })
}

export async function deleteFileFromIDB(db: IDB_Database, storeName: string, fileId: string): Promise<void> {
  // Validate object store exists
  validateObjectStore(db, storeName)

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readwrite')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.delete(fileId)

      request.onsuccess = () => resolve()
      request.onerror = error => reject(error)

      transaction.onerror = error => reject(error)
      transaction.onabort = () => reject(new Error('Transaction aborted'))
    } catch (error) {
      reject(error)
    }
  })
}

// Additional utility functions for database management

/**
 * Lists all available object stores in the database
 */
export function listObjectStores(db: IDB_Database): string[] {
  return Array.from(db.objectStoreNames)
}

/**
 * Checks if a specific object store exists in the database
 */
export function objectStoreExists(db: IDB_Database, storeName: string): boolean {
  return db.objectStoreNames.contains(storeName)
}

/**
 * Safely opens database with recovery mechanism
 * This function will handle common IndexedDB issues automatically
 */
export async function openIDBDatabaseSafely(
  dbName: string,
  storeName: string,
  options: { retryCount?: number; forceRecreate?: boolean } = {}
): Promise<IDB_Database> {
  const { retryCount = 3, forceRecreate = false } = options

  if (forceRecreate) {
    try {
      await deleteDatabase(dbName)
    } catch (error) {
      console.warn('Failed to delete database during force recreate:', error)
    }
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      return await openIDBDatabase(dbName, storeName)
    } catch (error) {
      lastError = error as Error
      console.warn(`Database open attempt ${attempt + 1} failed:`, error)

      // If it's a schema-related error, try to recreate the database
      if (
        error instanceof Error
        && (error.message.includes('object stores')
          || error.message.includes('NotFoundError')
          || error.name === 'NotFoundError')
      ) {
        try {
          await deleteDatabase(dbName)
          console.log(`Deleted database ${dbName} due to schema error, will retry...`)
        } catch (deleteError) {
          console.warn('Failed to delete corrupted database:', deleteError)
        }
      }

      // Wait before retry (exponential backoff)
      if (attempt < retryCount - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
  }

  throw lastError || new Error(`Failed to open database after ${retryCount} attempts`)
}

/**
 * Get database information for debugging
 */
export async function getDatabaseInfo(dbName: string): Promise<{
  exists: boolean
  version?: number
  objectStores?: string[]
  error?: string
}> {
  try {
    // Try to open the database without version to get current version
    const request = indexedDB.open(dbName)

    return new Promise(resolve => {
      request.onsuccess = event => {
        const db = (event.target as IDBOpenDBRequest).result
        const info = {
          exists: true,
          version: db.version,
          objectStores: Array.from(db.objectStoreNames),
        }
        db.close()
        resolve(info)
      }

      request.onerror = () => {
        resolve({
          exists: false,
          error: request.error?.message || 'Unknown error',
        })
      }
    })
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
