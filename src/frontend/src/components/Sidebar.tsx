import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  Bot,
  FolderOpen,
  Globe,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  Sun,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

// Apply theme from localStorage on module load (prevents flash)
function applyStoredTheme() {
  const stored = localStorage.getItem("bf_theme");
  if (stored === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    // Default to dark
    document.documentElement.classList.add("dark");
    if (!stored) localStorage.setItem("bf_theme", "dark");
  }
}
try {
  applyStoredTheme();
} catch {}

function SidebarInner({ onClose }: { onClose?: () => void }) {
  const matchRoute = useMatchRoute();
  const isProjects = !!matchRoute({ to: "/projects" });
  const isSettings = !!matchRoute({ to: "/settings" });
  const isAgent = !!matchRoute({ to: "/agent" });
  const isBrowser = !!matchRoute({ to: "/browser" });
  const isApiTools = !!matchRoute({ to: "/api-tools" });

  const [dark, setDark] = useState(
    () => localStorage.getItem("bf_theme") !== "light",
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("bf_theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "oklch(var(--sidebar))" }}
    >
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Link
          to="/projects"
          className="flex items-center gap-2 group"
          data-ocid="sidebar.link"
          onClick={onClose}
        >
          <img
            src="/assets/generated/brainforge-icon-3d.dim_512x512.png"
            alt="BrainForge"
            className="w-7 h-7 rounded-lg object-cover"
          />
          <span className="font-bold text-base text-foreground tracking-tight group-hover:text-primary transition-colors">
            BrainForge
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <Link
          to="/projects"
          data-ocid="nav.projects.link"
          onClick={onClose}
          className={cn(
            "nav-item flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all",
            isProjects
              ? "nav-item-active text-foreground font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <FolderOpen className="w-4 h-4" />
          Projects
        </Link>
        <Link
          to="/settings"
          data-ocid="nav.settings.link"
          onClick={onClose}
          className={cn(
            "nav-item flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all",
            isSettings
              ? "nav-item-active text-foreground font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
        <Link
          to="/agent"
          data-ocid="nav.agent.link"
          onClick={onClose}
          className={cn(
            "nav-item flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all",
            isAgent
              ? "nav-item-active text-foreground font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <Bot className="w-4 h-4" />
          Agent
        </Link>
        <Link
          to="/browser"
          data-ocid="nav.browser.link"
          onClick={onClose}
          className={cn(
            "nav-item flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all",
            isBrowser
              ? "nav-item-active text-foreground font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <Globe className="w-4 h-4" />
          Browser
        </Link>
        <Link
          to="/api-tools"
          data-ocid="nav.apitools.link"
          onClick={onClose}
          className={cn(
            "nav-item flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all",
            isApiTools
              ? "nav-item-active text-foreground font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <Zap className="w-4 h-4" />
          API Tools
        </Link>
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="nav-item flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground w-full text-left"
          data-ocid="sidebar.feedback.button"
        >
          <MessageSquare className="w-4 h-4" />
          Feedback
        </button>
      </nav>

      <div
        className="px-4 py-4 border-t border-sidebar-border"
        data-ocid="sidebar.status.panel"
      >
        {/* Dark / Light toggle */}
        <button
          type="button"
          onClick={() => setDark((d) => !d)}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors mb-3"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          data-ocid="sidebar.theme.toggle"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="text-xs">{dark ? "Light mode" : "Dark mode"}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">Active</span>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground/50">
          &copy; {new Date().getFullYear()} BrainForge
        </p>
      </div>

      {/* Feedback Modal */}
      {feedbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setFeedbackOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setFeedbackOpen(false)}
        >
          <div
            className="w-80 bg-card border border-border rounded-xl p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Send Feedback
              </h3>
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                data-ocid="feedback.close_button"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Koi suggestion, feedback, ya issue? Batao — admin tak pahuchega.
            </p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Apni baat likho..."
              rows={4}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:border-primary/50"
              data-ocid="feedback.textarea"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="flex-1 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-ocid="feedback.cancel_button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!feedbackText.trim()) return;
                  const existing = JSON.parse(
                    localStorage.getItem("bf_user_feedback") || "[]",
                  );
                  existing.push({
                    text: feedbackText.trim(),
                    time: Date.now(),
                  });
                  localStorage.setItem(
                    "bf_user_feedback",
                    JSON.stringify(existing),
                  );
                  setFeedbackText("");
                  setFeedbackOpen(false);
                  alert("✓ Feedback submit ho gaya! Admin review karega.");
                }}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                data-ocid="feedback.submit_button"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside
        className="hidden md:flex flex-col w-[240px] shrink-0 border-r border-border"
        data-ocid="sidebar.panel"
      >
        <SidebarInner />
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 border-b border-sidebar-border"
        style={{
          background: "oklch(var(--sidebar))",
          paddingTop: "env(safe-area-inset-top, 12px)",
          height: "calc(56px + env(safe-area-inset-top, 0px))",
        }}
      >
        <Link to="/projects" className="flex items-center gap-2">
          <img
            src="/assets/generated/brainforge-icon-3d.dim_512x512.png"
            alt="BrainForge"
            className="w-6 h-6 rounded-md object-cover"
          />
          <span className="font-bold text-sm text-foreground">BrainForge</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-2 text-muted-foreground hover:text-foreground"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-[240px] border-border">
          <SidebarInner onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
