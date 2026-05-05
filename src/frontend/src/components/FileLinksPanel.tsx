import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

interface FileLink {
  id: string;
  label: string;
  url: string;
}

interface FileLinksProps {
  projectId: string;
  open: boolean;
}

function storageKey(projectId: string) {
  return `devforge_links_${projectId}`;
}

function loadLinks(projectId: string): FileLink[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(projectId)) ?? "[]");
  } catch {
    return [];
  }
}

function saveLinks(projectId: string, links: FileLink[]) {
  localStorage.setItem(storageKey(projectId), JSON.stringify(links));
}

export default function FileLinksPanel({ projectId, open }: FileLinksProps) {
  const [links, setLinks] = useState<FileLink[]>(() => loadLinks(projectId));
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    setLinks(loadLinks(projectId));
  }, [projectId]);

  const addLink = () => {
    const trimmedLabel = label.trim();
    const trimmedUrl = url.trim();
    if (!trimmedLabel || !trimmedUrl) return;
    const normalized =
      trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")
        ? trimmedUrl
        : `https://${trimmedUrl}`;
    const updated: FileLink[] = [
      ...links,
      { id: `${Date.now()}`, label: trimmedLabel, url: normalized },
    ];
    setLinks(updated);
    saveLinks(projectId, updated);
    setLabel("");
    setUrl("");
  };

  const removeLink = (id: string) => {
    const updated = links.filter((l) => l.id !== id);
    setLinks(updated);
    saveLinks(projectId, updated);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-hidden border-b border-border"
          style={{ background: "oklch(var(--card))" }}
          data-ocid="file_links.panel"
        >
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <Link2 size={13} className="text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                File Links
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {links.length} link{links.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Existing links */}
            {links.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {links.map((link, idx) => (
                  <div
                    key={link.id}
                    data-ocid={`file_links.item.${idx + 1}`}
                    className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs max-w-[200px] group"
                    style={{ background: "oklch(var(--background))" }}
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 min-w-0 hover:text-primary transition-colors"
                      title={link.url}
                    >
                      <ExternalLink size={10} className="shrink-0 opacity-60" />
                      <span className="truncate max-w-[120px]">
                        {link.label}
                      </span>
                    </a>
                    <button
                      type="button"
                      data-ocid={`file_links.delete_button.${idx + 1}`}
                      onClick={() => removeLink(link.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors ml-1 opacity-0 group-hover:opacity-100"
                      title="Remove link"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add link form */}
            <div className="flex gap-2 items-center">
              <Input
                data-ocid="file_links.input"
                placeholder="Label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="h-7 text-xs max-w-[110px]"
                onKeyDown={(e) => e.key === "Enter" && addLink()}
              />
              <Input
                data-ocid="file_links.input"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => e.key === "Enter" && addLink()}
              />
              <Button
                data-ocid="file_links.primary_button"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={addLink}
                disabled={!label.trim() || !url.trim()}
                title="Add link"
              >
                <Plus size={13} />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
