export const STORAGE_FAILED_EVENT = "studio-storage-failed"
export const STORAGE_FAILED_MESSAGE =
  "Browser storage is full or blocked, so recent work may not be saved. Export your history, then delete old runs."

/** Tells the studio a save did not land (quota or blocked storage). */
export function reportStorageFailure(): void {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(STORAGE_FAILED_EVENT))
}
