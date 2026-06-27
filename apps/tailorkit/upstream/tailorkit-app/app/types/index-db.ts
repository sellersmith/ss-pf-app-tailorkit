interface FileRecord {
  id: string
  name: string
  data: ArrayBuffer
}

interface JSONRecord {
  id: string
  data: string // Storing JSON as a string
}

type IDB_Database = IDBDatabase
type IDB_Transaction = IDBTransaction
type IDB_ObjectStore = IDBObjectStore

export type { JSONRecord, FileRecord, IDB_Database, IDB_Transaction, IDB_ObjectStore }
