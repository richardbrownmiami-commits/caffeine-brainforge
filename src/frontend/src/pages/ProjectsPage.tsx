import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Clock,
  ExternalLink,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useRenameProject,
} from "../hooks/useBackend";

function formatTime(ts: bigint): string {
  try {
    const ms = Number(ts) / 1_000_000;
    if (ms === 0) return "Just now";
    return new Date(ms).toLocaleDateString();
  } catch {
    return "—";
  }
}

const TEMPLATES = [
  {
    id: "blank",
    icon: "⚡",
    label: "Blank",
    desc: "Start from scratch",
    prompt: "",
  },
  {
    id: "landing",
    icon: "🌐",
    label: "Landing Page",
    desc: "Hero, features, CTA",
    prompt:
      "Build a modern landing page with a hero section, features section, and call-to-action button. Use a dark design with gradient accents and smooth animations.",
  },
  {
    id: "dashboard",
    icon: "📊",
    label: "Dashboard",
    desc: "Stats, charts, tables",
    prompt:
      "Build an analytics dashboard with stat cards at the top, a bar chart, a line chart, and a data table. Dark professional theme.",
  },
  {
    id: "game",
    icon: "🎮",
    label: "Game",
    desc: "Interactive browser game",
    prompt:
      "Build a fun browser game using HTML canvas. Include a start screen, game loop with score, and game over screen.",
  },
  {
    id: "chat",
    icon: "💬",
    label: "Chat App",
    desc: "Messaging UI",
    prompt:
      "Build a chat app UI with a contacts sidebar, message bubbles, and a message input. Dark theme, mobile-friendly.",
  },
] as const;

export function ProjectsPage() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading, error } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const renameProject = useRenameProject();
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createProject.mutateAsync(name);
      setNewName("");
      setDialogOpen(false);
      setPendingName(name);
      setTemplateOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to create project");
    }
  };

  const handleTemplateSelect = (prompt: string) => {
    setTemplateOpen(false);
    if (prompt) localStorage.setItem(`bf_starter_${pendingName}`, prompt);
    toast.success(`Project "${pendingName}" created`);
    navigate({
      to: "/editor/$projectName",
      params: { projectName: pendingName },
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject.mutateAsync(deleteTarget);
      toast.success(`Project "${deleteTarget}" deleted`);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete project");
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await renameProject.mutateAsync({
        oldName: renameTarget,
        newName: renameValue.trim(),
      });
      toast.success(`Renamed to "${renameValue.trim()}"`);
      setRenameTarget(null);
      setRenameValue("");
    } catch (e: any) {
      toast.error(e.message || "Failed to rename");
    }
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      data-ocid="projects.page"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              data-ocid="projects.create.open_modal_button"
            >
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent
            className="bg-card border-border"
            data-ocid="projects.create.dialog"
          >
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="my-awesome-app"
              className="bg-background border-border"
              data-ocid="projects.name.input"
              autoFocus
            />
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                data-ocid="projects.create.cancel_button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || createProject.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                data-ocid="projects.create.confirm_button"
              >
                {createProject.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Template Picker Dialog */}
      <Dialog
        open={templateOpen}
        onOpenChange={(o) => {
          if (!o) handleTemplateSelect("");
        }}
      >
        <DialogContent
          className="bg-card border-border max-w-md"
          data-ocid="projects.template.dialog"
        >
          <DialogHeader>
            <DialogTitle>Choose a starting template</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            Pick a template or choose Blank to start fresh.
          </p>
          <div className="grid gap-2 mt-1">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTemplateSelect(t.prompt)}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                data-ocid={`projects.template.${t.id}`}
              >
                <span className="text-2xl shrink-0">{t.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div
            className="flex items-center justify-center py-16"
            data-ocid="projects.loading_state"
          >
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div
            className="text-center py-16 text-destructive"
            data-ocid="projects.error_state"
          >
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Failed to load projects</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16" data-ocid="projects.empty_state">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No projects yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Create your first project to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                data-ocid={`projects.item.${i + 1}`}
              >
                <button
                  type="button"
                  className="group w-full text-left bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all"
                  onClick={() =>
                    navigate({
                      to: "/editor/$projectName",
                      params: { projectName: project.name },
                    })
                  }
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                      <FolderOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTarget(project.name);
                          setRenameValue(project.name);
                        }}
                        title="Rename project"
                        aria-label="Rename project"
                        data-ocid={`projects.edit_button.${i + 1}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(project.name);
                        }}
                        title="Delete project"
                        aria-label="Delete project"
                        data-ocid={`projects.delete_button.${i + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="font-medium text-sm text-foreground truncate">
                    {project.name}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatTime(project.lastModified)}
                  </div>
                  {(() => {
                    const url = localStorage.getItem(
                      `bf_deploy_url_${project.name}`,
                    );
                    return url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 mt-1 text-[10px] text-green-400 hover:underline"
                      >
                        <ExternalLink className="w-2.5 h-2.5" /> Live
                      </a>
                    ) : null;
                  })()}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent
          className="bg-card border-border"
          data-ocid="projects.delete.dialog"
        >
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong className="text-foreground">{deleteTarget}</strong>? This
            cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              data-ocid="projects.delete.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteProject.isPending}
              data-ocid="projects.delete.confirm_button"
            >
              {deleteProject.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent
          className="bg-card border-border"
          data-ocid="projects.rename.dialog"
        >
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Rename "{renameTarget}"
          </p>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            placeholder="New project name"
            className="bg-background border-border"
            data-ocid="projects.rename.input"
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRenameTarget(null)}
              data-ocid="projects.rename.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameValue.trim() || renameProject.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              data-ocid="projects.rename.confirm_button"
            >
              {renameProject.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova floating assistant */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setNovaOpen((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-medium shadow-lg shadow-violet-500/30 transition-all hover:scale-105 active:scale-95"
          data-ocid="projects.nova.button"
        >
          <Zap className="w-4 h-4" />
          <span>Nova</span>
        </button>
        {novaOpen && (
          <div
            className="w-72 rounded-xl border border-violet-500/30 bg-card shadow-xl p-4 space-y-3"
            data-ocid="projects.nova.panel"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <p className="text-sm font-semibold text-foreground">Nova</p>
              </div>
              <button
                type="button"
                onClick={() => setNovaOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                data-ocid="projects.nova.close_button"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Main Nova hoon — BrainForge ka sharp assistant. Koi dikkat? Batao.
            </p>
            <div className="space-y-1.5">
              {[
                {
                  q: "Free API key kaise milegi?",
                  a: "OpenRouter.ai pe jao → Sign up → Free key milegi. Settings → API Keys mein daalo.",
                },
                {
                  q: "App kaise deploy karein?",
                  a: "Project kholo → Preview → Deploy button → GitHub ya Cloudflare choose karo.",
                },
                {
                  q: "AI kaam nahi kar raha?",
                  a: "Settings → API Keys check karo. Model naam sahi hai? OpenRouter key valid hai?",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="text-xs border border-border rounded-lg"
                >
                  <summary className="px-3 py-2 cursor-pointer text-foreground hover:bg-muted/30 rounded-lg">
                    {item.q}
                  </summary>
                  <p className="px-3 py-2 text-muted-foreground border-t border-border">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
