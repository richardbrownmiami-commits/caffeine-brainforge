// useModelClaims.ts -- Uses Cloudflare Worker, NOT ICP/Motoko
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FREE_MODELS } from "../constants/models";

const WORKER =
  import.meta.env.VITE_CF_WORKER_URL ||
  "https://brainforge-api.richard-brown-miami.workers.dev";

export function useClaimedModels() {
  return useQuery<Map<string, string>>({
    queryKey: ["claimedModels"],
    queryFn: async () => {
      const res = await fetch(`${WORKER}/api/model-claims`);
      if (!res.ok) return new Map();
      const rows: { model_id: string; claimed_by: string }[] = await res.json();
      return new Map(rows.map((r) => [r.model_id, r.claimed_by]));
    },
    staleTime: 10_000,
  });
}

export function useAvailableModels(currentOwner: string) {
  const { data: claimed = new Map() } = useClaimedModels();
  return FREE_MODELS.filter((m) => {
    const owner = claimed.get(m.id);
    return !owner || owner === currentOwner;
  });
}

export function useSetProjectModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectName,
      modelId,
    }: { projectName: string; modelId: string }) => {
      const res = await fetch(`${WORKER}/api/model-claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_id: modelId, claimed_by: projectName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to set model");
      }
      // Also update the project's ai_model field
      await fetch(`${WORKER}/api/projects/${encodeURIComponent(projectName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_model: modelId }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claimedModels"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useClaimMasterModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modelId: string) => {
      const res = await fetch(`${WORKER}/api/model-claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_id: modelId, claimed_by: "master" }),
      });
      // 409 = already claimed by someone else, not a fatal error for master
      if (!res.ok && res.status !== 409) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to claim model");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claimedModels"] });
    },
  });
}
