import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronRight,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  User,
  X,
  Zap,
} from "lucide-react";
import type React from "react";
import { useState } from "react";

type ViewType = "projects" | "new_project" | "editor" | "settings";

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSignOut?: () => void;
  userEmail?: string;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: "projects", label: "Projects", icon: <LayoutGrid size={16} /> },
  { id: "new_project", label: "New Project", icon: <Plus size={16} /> },
  { id: "settings", label: "Settings", icon: <Settings size={16} /> },
];

function ThemeToggleButton({
  theme,
  onToggle,
  ocid,
}: {
  theme: "dark" | "light";
  onToggle: () => void;
  ocid: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-ocid={ocid}
          onClick={onToggle}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarContent({
  currentView,
  onNavigate,
  onClose,
  theme,
  onToggleTheme,
  onSignOut,
  userEmail,
}: {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onClose?: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSignOut?: () => void;
  userEmail?: string;
}) {
  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "oklch(var(--sidebar))" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="logo-img-wrap">
          <img
            src="/assets/generated/devforge-logo-transparent.dim_80x80.png"
            alt="DevForge"
            className="w-7 h-7 object-contain logo-img"
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold tracking-tight text-foreground leading-none">
            DevForge
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            AI Code Editor
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors md:hidden"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest px-2 pt-2 pb-1">
          Menu
        </p>
        {navItems.map((item) => {
          const isActive =
            currentView === item.id ||
            (item.id === "projects" && currentView === "editor");
          return (
            <button
              type="button"
              key={item.id}
              data-ocid={`nav.${item.id}.link`}
              onClick={() => {
                onNavigate(item.id);
                onClose?.();
              }}
              className={[
                "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm w-full text-left transition-all duration-150",
                "nav-item",
                isActive
                  ? "nav-item-active font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              ].join(" ")}
            >
              <span style={isActive ? { color: "oklch(var(--primary))" } : {}}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {isActive && (
                <ChevronRight
                  size={12}
                  className="ml-auto"
                  style={{ color: "oklch(var(--primary))" }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-border space-y-2">
        {/* User info + sign out */}
        {userEmail && (
          <div
            className="flex items-center gap-2 px-2 py-2 rounded-md"
            style={{ background: "oklch(var(--muted) / 0.3)" }}
          >
            <User size={12} className="text-muted-foreground shrink-0" />
            <p className="text-[10px] text-muted-foreground truncate flex-1">
              {userEmail}
            </p>
            {onSignOut && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-ocid="nav.signout.button"
                    onClick={onSignOut}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Sign out"
                  >
                    <LogOut size={12} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Sign out</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        <div
          className="flex items-center gap-2 px-2 py-2 rounded-md"
          style={{ background: "oklch(0.14 0.02 158 / 0.3)" }}
        >
          <Zap size={12} style={{ color: "oklch(var(--primary))" }} />
          <p className="text-[10px] text-muted-foreground leading-tight flex-1">
            Powered by{" "}
            <span
              style={{ color: "oklch(var(--primary))" }}
              className="font-medium"
            >
              Gemini AI
            </span>
          </p>
          <ThemeToggleButton
            theme={theme}
            onToggle={onToggleTheme}
            ocid="nav.theme.toggle"
          />
        </div>
      </div>
    </div>
  );
}

export default function Layout({
  children,
  currentView,
  onNavigate,
  theme,
  onToggleTheme,
  onSignOut,
  userEmail,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-border">
          <SidebarContent
            currentView={currentView}
            onNavigate={onNavigate}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onSignOut={onSignOut}
            userEmail={userEmail}
          />
        </aside>

        {/* Mobile Sheet Sidebar */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[220px] border-r border-border"
            style={{ background: "oklch(var(--sidebar))" }}
          >
            <SidebarContent
              currentView={currentView}
              onNavigate={onNavigate}
              onClose={() => setMobileMenuOpen(false)}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onSignOut={onSignOut}
              userEmail={userEmail}
            />
          </SheetContent>
        </Sheet>

        {/* Mobile Top Header */}
        <div className="flex md:hidden flex-col flex-1 h-full overflow-hidden">
          <header
            className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0"
            style={{ background: "oklch(var(--sidebar))" }}
          >
            <button
              type="button"
              data-ocid="nav.hamburger.button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2">
              <img
                src="/assets/generated/devforge-logo-transparent.dim_80x80.png"
                alt="DevForge"
                className="w-6 h-6 object-contain logo-img"
              />
              <span className="text-sm font-semibold tracking-tight text-foreground">
                DevForge AI
              </span>
            </div>

            <div className="flex items-center gap-1">
              <ThemeToggleButton
                theme={theme}
                onToggle={onToggleTheme}
                ocid="nav.mobile.theme.toggle"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-ocid="nav.settings.link"
                    onClick={() => onNavigate("settings")}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label="Settings"
                  >
                    <Settings size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Settings</TooltipContent>
              </Tooltip>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]">
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          <nav
            className="flex items-center justify-around border-t border-border shrink-0"
            style={{
              background: "oklch(var(--sidebar))",
              paddingBottom: "env(safe-area-inset-bottom)",
              minHeight: "56px",
            }}
          >
            {navItems.map((item) => {
              const isActive =
                currentView === item.id ||
                (item.id === "projects" && currentView === "editor");
              return (
                <button
                  type="button"
                  key={item.id}
                  data-ocid={`nav.bottom.${item.id}.link`}
                  onClick={() => onNavigate(item.id)}
                  className="flex flex-col items-center justify-center gap-1 px-4 py-2 flex-1 min-h-[44px] transition-all duration-150"
                  style={{
                    color: isActive
                      ? "oklch(var(--primary))"
                      : "oklch(var(--muted-foreground))",
                  }}
                >
                  <span
                    className="flex items-center justify-center w-5 h-5"
                    style={{
                      filter: isActive
                        ? "drop-shadow(0 0 6px oklch(0.76 0.16 158 / 0.5))"
                        : "none",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Desktop Main content */}
        <main className="hidden md:flex flex-1 overflow-hidden flex-col">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
