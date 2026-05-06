import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lazy } from "react";
import { OnboardingWizard, useOnboarding } from "./components/OnboardingWizard";
import { Sidebar } from "./components/Sidebar";
import { EditorPage } from "./pages/EditorPage";
import { PolicyPage } from "./pages/PolicyPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SettingsPage } from "./pages/SettingsPage";

const AgentPage = lazy(() => import("./pages/AgentPage"));
const BrowserPage = lazy(() => import("./pages/BrowserPage"));
const ApiToolsPage = lazy(() => import("./pages/ApiToolsPage"));
const MasterAgentPage = lazy(() => import("./pages/MasterAgentPage"));

// ---- PIN Lock Component ----
function PinLock({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const s = JSON.parse(localStorage.getItem("bf_settings") || "{}");
    if (!s.pinEnabled || !s.pinCode) return;
    const last = Number(localStorage.getItem("bf_last_unlock") || "0");
    const timeout = (s.sessionTimeout || 30) * 60 * 1000;
    if (Date.now() - last > timeout) {
      setLocked(true);
    }
    // Track activity to reset timeout
    const resetTimer = () =>
      localStorage.setItem("bf_last_unlock", Date.now().toString());
    window.addEventListener("pointerdown", resetTimer);
    window.addEventListener("keydown", resetTimer);
    return () => {
      window.removeEventListener("pointerdown", resetTimer);
      window.removeEventListener("keydown", resetTimer);
    };
  }, []);

  const tryUnlock = () => {
    const s = JSON.parse(localStorage.getItem("bf_settings") || "{}");
    if (pin === s.pinCode) {
      localStorage.setItem("bf_last_unlock", Date.now().toString());
      setLocked(false);
      setErr("");
    } else {
      setErr("Wrong PIN. Try again.");
      setPin("");
    }
  };

  if (!locked) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "oklch(0.05 0.02 280)" }}
    >
      <div className="w-72 p-6 rounded-2xl border border-red-500/30 bg-red-500/5 space-y-4 shadow-2xl">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-3 text-2xl">
            🔒
          </div>
          <h2 className="text-base font-semibold text-foreground">
            BrainForge Locked
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Enter your PIN to continue
          </p>
        </div>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
          placeholder="• • • •"
          maxLength={6}
          className="w-full bg-black/40 border border-red-500/30 rounded-lg px-3 py-2.5 text-center text-2xl tracking-[0.5em] text-foreground focus:outline-none focus:border-red-400/60 transition-colors"
        />
        {err && <p className="text-xs text-red-400 text-center">{err}</p>}
        <button
          type="button"
          onClick={tryUnlock}
          disabled={pin.length < 4}
          className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
        >
          Unlock
        </button>
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <PinLock>
      <div
        className="flex bg-background overflow-hidden"
        style={{ height: "100dvh" }}
      >
        <Sidebar />
        <main className="hidden md:flex flex-1 overflow-hidden flex-col h-full">
          <Outlet />
        </main>
        <main
          className="md:hidden flex flex-1 overflow-hidden flex-col"
          style={{
            paddingTop: "calc(56px + env(safe-area-inset-top, 0px))",
            height: "100%",
          }}
        >
          <Outlet />
        </main>
        <Toaster />
      </div>
    </PinLock>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/projects" });
  },
  component: () => null,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  component: ProjectsPage,
});

const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/editor/$projectName",
  component: EditorPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const policyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/policy",
  component: PolicyPage,
});

const agentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agent",
  component: AgentPage,
});

const browserRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/browser",
  component: BrowserPage,
});

const apiToolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api-tools",
  component: ApiToolsPage,
});

const masterAgentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/master",
  component: MasterAgentPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  projectsRoute,
  editorRoute,
  settingsRoute,
  policyRoute,
  agentRoute,
  browserRoute,
  apiToolsRoute,
  masterAgentRoute,
]);
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  const { showWizard, setShowWizard } = useOnboarding();
  return (
    <>
      <RouterProvider router={router} />
      {showWizard && (
        <OnboardingWizard onComplete={() => setShowWizard(false)} />
      )}
    </>
  );
}
