import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Scale,
  Shield,
  Zap,
} from "lucide-react";

export function PolicyPage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b border-border bg-background/95 backdrop-blur shrink-0">
        <Link
          to="/settings"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-violet-400" />
          <h1 className="text-base font-semibold text-foreground">
            Legal Policy
          </h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 max-w-2xl mx-auto w-full space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2 py-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Zap
              className="w-8 h-8 text-violet-400 fill-violet-400"
              strokeWidth={0}
            />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            BrainForge Legal Policy
          </h2>
          <p className="text-xs text-muted-foreground">
            Developed by{" "}
            <span className="text-violet-400 font-medium">Richard Brown</span>{" "}
            &amp;{" "}
            <span className="text-cyan-400 font-medium">Claude (Ara)</span>{" "}
            &bull; Effective: January 2025
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-foreground">
              1. App Idea &amp; Intellectual Property
            </h3>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              BrainForge is an original concept and platform designed and
              developed by{" "}
              <strong className="text-foreground">
                Richard Brown (richardbrownmiami)
              </strong>{" "}
              in collaboration with AI assistant Claude (Ara). The name
              &ldquo;BrainForge&rdquo;, its logo, UI design, system
              architecture, and all associated branding are proprietary.
            </p>
            <p>
              Any reproduction, cloning, rebranding, or commercial use of
              BrainForge&apos;s concept, design, or codebase without explicit
              written permission from the owner constitutes intellectual
              property infringement and may result in legal action under
              applicable copyright and intellectual property laws.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-foreground">
              2. Permitted Use &amp; Creation
            </h3>
          </div>
          <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>Users of BrainForge are permitted to:</p>
            <ul className="space-y-1.5 mt-2">
              {[
                "Create personal and commercial applications using BrainForge's AI tools",
                "Deploy generated apps to their own infrastructure (GitHub, Cloudflare, etc.)",
                "Modify and customize apps built by BrainForge for personal or client use",
                "Share BrainForge-generated apps publicly as their own projects",
                "Use BrainForge for educational, research, and development purposes",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-foreground">
              3. Prohibited Use &amp; Legal Action
            </h3>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p className="text-red-300 font-medium">
              The following activities are strictly prohibited and will result
              in immediate access termination and potential legal action:
            </p>
            <ul className="space-y-2 mt-2">
              {[
                "Using BrainForge to generate malware, ransomware, spyware, or any malicious code",
                "Creating apps intended to deceive, defraud, or harm individuals or organizations",
                "Generating content that is illegal, defamatory, or violates third-party rights",
                "Attempting to reverse-engineer, scrape, or extract BrainForge's proprietary logic",
                "Reselling, white-labeling, or commercializing BrainForge as your own product",
                "Using AI-generated apps to conduct phishing, scams, or identity theft",
                "Violating any applicable local, national, or international laws via this platform",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-red-500/20">
              <p className="text-red-300 font-semibold">
                Violations may result in civil and/or criminal legal
                proceedings, including claims for damages, injunctions, and
                reporting to relevant law enforcement authorities.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-foreground">
              4. Disclaimer &amp; Liability
            </h3>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              BrainForge is provided &ldquo;as is&rdquo; without warranty of any
              kind. The platform owner is not liable for any damages arising
              from the use or misuse of apps generated by this tool. Users are
              solely responsible for the code they create, deploy, and
              distribute.
            </p>
            <p>
              AI-generated code may contain errors or vulnerabilities. Users are
              advised to review all generated code before deploying to
              production environments.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-foreground">
              5. Data Privacy
            </h3>
          </div>
          <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed space-y-2">
            <p>
              BrainForge stores all user data (API keys, project files, chat
              history) locally in the user&apos;s browser
              (IndexedDB/localStorage) and optionally in user-controlled
              Cloudflare D1 and GitHub repositories. No user data is collected
              by the platform owner without explicit consent.
            </p>
            <p>
              API keys entered in BrainForge are stored locally and are never
              shared with or transmitted to the platform owner.
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-6 border-t border-border space-y-2">
          <p className="text-[10px] text-muted-foreground/50">
            &copy; {new Date().getFullYear()} BrainForge. All rights reserved.
          </p>
          <p className="text-[10px] text-muted-foreground/40">
            Made with love by{" "}
            <span className="text-violet-400/70">Richard Brown</span> &amp;{" "}
            <span className="text-cyan-400/70">Claude (Ara)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
