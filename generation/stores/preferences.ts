import { create } from "zustand"
import { persist } from "zustand/middleware"

import { browserStorage, persistVersion } from "./browser-storage"

type PreferencesState = {
  /** Desktop notification when a run finishes while the tab is hidden. */
  notify: boolean
  /** Show the running count / Done / Failed in the tab title. */
  tabTitle: boolean
  /** Play feed videos (muted) on hover. */
  hoverPlay: boolean
  /** Open videos in the viewer with sound off. Feed previews are always silent. */
  mute: boolean
  /** Short chime when any run finishes. */
  chime: boolean
  /** Leave Home for the feed after pressing Generate. */
  jumpToFeed: boolean
  set: (patch: Partial<PreferencesValues>) => void
  reset: () => void
}

export type PreferencesValues = Omit<PreferencesState, "set" | "reset">

const DEFAULTS: PreferencesValues = {
  notify: true,
  tabTitle: true,
  hoverPlay: true,
  mute: true,
  chime: false,
  jumpToFeed: true,
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULTS),
    }),
    {
      name: "hf.preferences.v1",
      storage: browserStorage(),
      ...persistVersion,
      partialize: ({
        notify,
        tabTitle,
        hoverPlay,
        mute,
        chime,
        jumpToFeed,
      }) => ({
        notify,
        tabTitle,
        hoverPlay,
        mute,
        chime,
        jumpToFeed,
      }),
    }
  )
)
