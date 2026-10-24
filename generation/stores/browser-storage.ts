import { type PersistStorage, type StorageValue } from "zustand/middleware"

import { reportStorageFailure } from "@/lib/studio/storage-warning"

/** Spread into a persist() config. Bump `version` and branch on it in `migrate`
    when a store's saved shape changes, so old browsers upgrade instead of losing data. */
export const persistVersion = {
  version: 1,
  migrate: (saved: unknown) => saved as never,
}

/** Per-call localStorage so persist still works after SSR, where the store
    module evaluates before a Storage exists. */
export function browserStorage<T>(): PersistStorage<T> {
  return {
    getItem: (name) => {
      const raw = read(name)
      if (raw === null) return null
      try {
        return JSON.parse(raw) as StorageValue<T>
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      write(name, JSON.stringify(value))
    },
    removeItem: (name) => {
      write(name, null)
    },
  }
}

function read(name: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage.getItem(name)
  } catch {
    return null
  }
}

function write(name: string, value: string | null): void {
  try {
    if (typeof localStorage === "undefined") return
    if (value === null) localStorage.removeItem(name)
    else localStorage.setItem(name, value)
  } catch {
    reportStorageFailure() // quota, private mode, or a denied store
  }
}
