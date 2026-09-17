import { create } from "zustand";

export type ProjectMode = "Detect" | "Enforce";

export interface ProjectItem {
  id: string;
  name: string;
  mode: ProjectMode;
  policy: string;
  application?: string;
  model?: string;
  customTags: Record<string, string>;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  mode?: ProjectMode;
  policy?: string;
  application?: string;
  model?: string;
  customTags?: Record<string, string>;
}

interface ProjectsState {
  projects: ProjectItem[];
  selectedProjectId: string; // "all" | "none" | project.id
  addProject: (input: string | CreateProjectInput) => ProjectItem;
  removeProject: (id: string) => void;
  setSelectedProject: (id: string) => void;
  loadProjects: () => void;
}

const STORAGE_KEY = "artsa_user_projects";

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  selectedProjectId: "all",

  loadProjects: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set({ projects: parsed });
        }
      }
    } catch {
      // ignore storage errors
    }
  },

  addProject: (input: string | CreateProjectInput) => {
    const isString = typeof input === "string";
    const name = isString ? input.trim() : input.name.trim();
    const mode = isString ? "Detect" : input.mode ?? "Detect";
    const policy = isString ? "ARTSA Default Policy" : input.policy ?? "ARTSA Default Policy";
    const application = isString ? undefined : input.application?.trim() || undefined;
    const model = isString ? undefined : input.model?.trim() || undefined;
    const customTags = isString ? {} : input.customTags ?? {};

    const newProject: ProjectItem = {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      mode,
      policy,
      application,
      model,
      customTags,
      createdAt: new Date().toISOString(),
    };

    const updated = [...get().projects.filter((p) => p.id !== newProject.id), newProject];
    set({ projects: updated, selectedProjectId: newProject.id });

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
    }
    return newProject;
  },

  removeProject: (id: string) => {
    const updated = get().projects.filter((p) => p.id !== id);
    set({
      projects: updated,
      selectedProjectId: get().selectedProjectId === id ? "all" : get().selectedProjectId,
    });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
    }
  },

  setSelectedProject: (id: string) => {
    set({ selectedProjectId: id });
  },
}));
