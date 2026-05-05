export const OPENROUTER_MODELS = [
  { id: "qwen/qwen3-coder:free", name: "Qwen3 Coder 480B" },
  { id: "openai/gpt-oss-120b:free", name: "GPT-OSS 120B" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B" },
  { id: "google/gemma-3-27b-it:free", name: "Google Gemma 27B" },
  {
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    name: "Mistral Small 24B",
  },
  { id: "openrouter/auto", name: "Auto (Best available)" },
] as const;

export const GEMINI_MODELS = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite" },
] as const;

export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
  { id: "qwen-qwq-32b", name: "Qwen QwQ 32B" },
  { id: "moonshotai/kimi-k2-instruct", name: "Kimi K2" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Fast)" },
] as const;

export const GITHUB_MODELS = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "DeepSeek-V3", name: "DeepSeek V3" },
  { id: "Phi-4", name: "Phi-4" },
] as const;

export const FREE_MODELS = OPENROUTER_MODELS;

export type AIProvider = "openrouter" | "gemini" | "groq" | "github" | "auto";

export const DEFAULT_MODEL_ID = "qwen/qwen3-coder:free";

export function getModelName(id: string): string {
  const all = [
    ...OPENROUTER_MODELS,
    ...GEMINI_MODELS,
    ...GROQ_MODELS,
    ...GITHUB_MODELS,
  ];
  return all.find((m) => m.id === id)?.name ?? id;
}

export function shortModelName(id: string): string {
  const name = getModelName(id);
  if (name.length > 20) return `${name.slice(0, 18)}\u2026`;
  return name;
}
