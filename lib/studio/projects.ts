import { create } from "zustand"
import { persist } from "zustand/middleware"

import { browserStorage } from "@/generation/stores/browser-storage"

import { newId } from "./id"

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

type ProjectsState = {
  projects: Project[]
  create: (name: string) => Project
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  touch: (id: string) => void
}

/** Local-first projects. Swap the storage for a database when the app has accounts. */
export const useProjects = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: [],
      create: (name) => {
        const now = Date.now()
        const project: Project = {
          id: newId(),
          name: name.trim() || "Untitled",
          createdAt: now,
          updatedAt: now,
        }
        set({ projects: [project, ...get().projects] })
        return project
      },
      rename: (id, name) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() }
              : p
          ),
        })),
      remove: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        })),
      touch: (id) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, updatedAt: Date.now() } : p
          ),
        })),
    }),
    { name: "hf.projects.v1", storage: browserStorage() }
  )
)
