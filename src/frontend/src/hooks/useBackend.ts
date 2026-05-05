/**
 * useBackend.ts
 * All data stored in localStorage -- no ICP actor dependency.
 * Works on Cloudflare Pages and any static host.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, Settings } from "../backend.d";

const SETTINGS_KEY = "bf_settings";
const PROJECTS_KEY = "bf_projects";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as Settings;
  } catch {}
  return {
    openRouterApiKey: "",
    defaultModel: "qwen/qwen3-coder:free",
    termuxUrl: "",
    githubToken: "",
    githubRepo: "",
    supabaseUrl: "",
    supabaseKey: "",
    cloudflareToken: "",
    cloudflareAccountId: "",
    temperature: 0.7,
    maxTokens: 4096,
    liveSearch: false,
    autoFix: true,
    proactiveAI: false,
    masterAIEnabled: true,
    // AI provider settings
    aiProvider: "auto",
    geminiApiKey: "",
    geminiModel: "gemini-2.0-flash",
    groqApiKey: "",
    groqModel: "llama-3.3-70b-versatile",
    githubModelsKey: "",
    githubModelsModel: "gpt-4o",
  } as unknown as Settings;
}

function saveSettingsToStorage(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (raw) return JSON.parse(raw) as Project[];
  } catch {}
  return [];
}

function saveProjectsToStorage(projects: Project[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: () => loadSettings(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const current = loadSettings();
      const updated = { ...current, ...patch };
      saveSettingsToStorage(updated);
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => loadProjects(),
    staleTime: 30_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const projects = loadProjects();
      if (projects.find((p) => p.name === name)) {
        throw new Error(`Project "${name}" already exists`);
      }
      const newProject: Project = {
        name,
        code: "",
        lastModified: BigInt(Date.now() * 1_000_000),
        aiModel: "",
        liveLink: "",
      } as unknown as Project;
      const updated = [...projects, newProject];
      saveProjectsToStorage(updated);
      return newProject;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const projects = loadProjects().filter((p) => p.name !== name);
      saveProjectsToStorage(projects);
      // Also remove chat history
      localStorage.removeItem(`bf_chat_${name}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// ---- Custom System Prompt ----

const CUSTOM_PROMPT_KEY = "bf_custom_system_prompt";

export function useCustomPrompt() {
  return useQuery<string>({
    queryKey: ["customPrompt"],
    queryFn: () => localStorage.getItem(CUSTOM_PROMPT_KEY) ?? "",
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSaveCustomPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prompt: string) => {
      localStorage.setItem(CUSTOM_PROMPT_KEY, prompt);
      return prompt;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customPrompt"] });
    },
  });
}

export function useClearCustomPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      localStorage.removeItem(CUSTOM_PROMPT_KEY);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customPrompt"] });
    },
  });
}

export function useRenameProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      oldName,
      newName,
    }: { oldName: string; newName: string }) => {
      const projects = loadProjects();
      if (projects.find((p) => p.name === newName)) {
        throw new Error(`Project "${newName}" already exists`);
      }
      const updated = projects.map((p) =>
        p.name === oldName ? { ...p, name: newName } : p,
      );
      saveProjectsToStorage(updated);
      // Move all associated localStorage keys
      const keysToMove = [
        [`bf_chat_${oldName}`, `bf_chat_${newName}`],
        [`bf_memory_${oldName}`, `bf_memory_${newName}`],
        [`bf_rules_${oldName}`, `bf_rules_${newName}`],
        [`bf_snapshots_${oldName}`, `bf_snapshots_${newName}`],
        [`bf_deploy_url_${oldName}`, `bf_deploy_url_${newName}`],
        [`bf_starter_${oldName}`, `bf_starter_${newName}`],
      ];
      for (const [from, to] of keysToMove) {
        const val = localStorage.getItem(from);
        if (val !== null) {
          localStorage.setItem(to, val);
          localStorage.removeItem(from);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
