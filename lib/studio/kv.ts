/** Tiny IndexedDB key/value store. Falls back to memory during SSR/tests. */
export type Kv = {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
}

const DB_NAME = "studio"
const STORE = "kv"

/** One connection for the page's life; opening per call leaked a handle each time. */
let connection: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      // Another tab is deleting or upgrading the database: let go so it can.
      db.onversionchange = db.onclose = () => {
        db.close()
        connection = undefined
      }
      resolve(db)
    }
    req.onerror = () => {
      connection = undefined
      reject(req.error)
    }
  })
  return connection
}

/** Releases the connection (needed before the database can be deleted). */
export async function closeKv(): Promise<void> {
  const open = connection
  connection = undefined
  if (open) (await open.catch(() => undefined))?.close()
}

function run<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>
) {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = op(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(req.result)
        tx.onabort = () => reject(tx.error ?? req.error)
        tx.onerror = () => reject(tx.error ?? req.error)
      })
  )
}

function memoryKv(): Kv {
  const map = new Map<string, unknown>()
  return {
    async get<T>(key: string) {
      return map.get(key) as T | undefined
    },
    async set(key, value) {
      map.set(key, value)
    },
    async del(key) {
      map.delete(key)
    },
  }
}

let browser: Kv | undefined

export function defaultKv(): Kv {
  if (typeof indexedDB === "undefined") return memoryKv()
  browser ??= {
    get: <T>(key: string) =>
      run("readonly", (s) => s.get(key)) as Promise<T | undefined>,
    set: async (key, value) => {
      await run("readwrite", (s) => s.put(value, key))
    },
    del: async (key) => {
      await run("readwrite", (s) => s.delete(key))
    },
  }
  return browser
}
