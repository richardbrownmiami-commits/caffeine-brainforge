import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Project {
    created: bigint;
    name: string;
    aiModel: string;
    lastModified: bigint;
}
export interface Settings {
    githubRepo: string;
    githubToken: string;
    customSystemPrompt: string;
    masterAiModel: string;
    openRouterApiKey: string;
    defaultModel: string;
    termuxUrl: string;
}
export interface backendInterface {
    claimMasterModel(modelId: string): Promise<void>;
    createProject(name: string): Promise<void>;
    deleteProject(name: string): Promise<void>;
    getClaimedModels(): Promise<Array<[string, string]>>;
    getCustomPrompt(): Promise<string>;
    getSettings(): Promise<Settings | null>;
    listProjects(): Promise<Array<Project>>;
    saveCustomPrompt(prompt: string): Promise<void>;
    saveSettings(newSettings: Settings): Promise<void>;
    setProjectModel(projectName: string, modelId: string): Promise<void>;
}
