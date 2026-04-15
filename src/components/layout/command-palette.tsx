"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog, DialogContent } from "@nexusai360/design-system";
import { useSearch } from "@/components/layout/search-context";
import { HighlightMatch } from "@/components/layout/highlight-match";
import {
  SEARCH_ENTITY_ORDER,
  SEARCH_ENTITY_LABELS,
  type SearchEntity,
} from "@/lib/constants/search";
import {
  getRecents,
  addRecent,
  clearRecents,
  type RecentEntry,
} from "@/lib/search/recent";
import {
  Search,
  Loader2,
  Building2,
  Users,
  Target,
  Contact,
  TrendingUp,
  Package,
  CheckSquare,
  Workflow as WorkflowIcon,
  Megaphone,
  Filter,
  Clock,
  X,
} from "lucide-react";

interface SearchItem {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  type: string;
  score?: number;
}

type SearchResponse = Partial<Record<SearchEntity, SearchItem[]>>;

const ICON_MAP: Record<string, React.ElementType> = {
  user: Users,
  company: Building2,
  lead: Target,
  contact: Contact,
  opportunity: TrendingUp,
  product: Package,
  task: CheckSquare,
  workflow: WorkflowIcon,
  campaign: Megaphone,
  segment: Filter,
};

export function CommandPalette() {
  const router = useRouter();
  const { open, setOpen, closeSearch } = useSearch();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (open) setRecents(getRecents());
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  const runSearch = useCallback((term: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (term.trim().length < 2) {
      setResults(null);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(term.trim())}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setResults(null);
          setError(true);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as SearchResponse;
        setResults(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults(null);
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    runSearch(value);
  }

  function handleSelect(href: string, qToStore?: string) {
    const q = (qToStore ?? query).trim();
    if (q.length >= 2) {
      addRecent(q);
      setRecents(getRecents());
    }
    closeSearch();
    setQuery("");
    setResults(null);
    setError(false);
    router.push(href);
  }

  function handleRecentClick(q: string) {
    setQuery(q);
    runSearch(q);
  }

  function handleClearRecents(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    clearRecents();
    setRecents([]);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setResults(null);
      setLoading(false);
      setError(false);
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }

  const groups = results
    ? SEARCH_ENTITY_ORDER.filter(
        (g) => (results[g]?.length ?? 0) > 0,
      )
    : [];
  const hasResults = groups.length > 0;
  const totalResults = groups.reduce(
    (sum, g) => sum + (results?.[g]?.length ?? 0),
    0,
  );

  const showRecents = query.trim().length < 2 && recents.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed top-[10%] left-1/2 -translate-x-1/2 translate-y-0 max-w-[calc(100%-2rem)] sm:max-w-2xl w-[calc(100%-2rem)] p-0 gap-0 sm:top-[12%]"
      >
        <Command
          className="rounded-2xl overflow-hidden"
          shouldFilter={false}
          loop
        >
          <div className="flex items-center gap-3 px-4 border-b border-border">
            {loading ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <Command.Input
              value={query}
              onValueChange={handleQueryChange}
              placeholder="Buscar leads, contatos, oportunidades..."
              aria-label="Busca global"
              className="flex-1 bg-transparent py-4 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {query.length > 0 && (
              <kbd
                aria-hidden="true"
                className="text-[10px] text-muted-foreground bg-muted/50 border border-border rounded px-1.5 py-0.5 font-mono"
              >
                ESC
              </kbd>
            )}
          </div>

          <div role="status" aria-live="polite" aria-atomic="false">
            <Command.List className="max-h-[480px] overflow-y-auto overscroll-contain">
              {query.trim().length < 2 && !showRecents && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Digite para buscar...
                </div>
              )}

              {showRecents && (
                <Command.Group>
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Buscas recentes
                    </span>
                    <button
                      type="button"
                      onClick={handleClearRecents}
                      className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      aria-label="Limpar buscas recentes"
                    >
                      <X className="h-3 w-3" /> Limpar
                    </button>
                  </div>
                  {recents.map((entry) => (
                    <Command.Item
                      key={`recent:${entry.q}`}
                      value={`recent:${entry.q}`}
                      onSelect={() => handleRecentClick(entry.q)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer text-sm transition-none data-[selected=true]:bg-accent/50 hover:bg-accent/50"
                    >
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-foreground">
                        {entry.q}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {query.trim().length >= 2 && error && !loading && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Não foi possível buscar. Tente novamente.
                </div>
              )}

              {query.trim().length >= 2 && !loading && !error && results && !hasResults && (
                <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum resultado para &ldquo;{query}&rdquo;
                </Command.Empty>
              )}

              {!error && results && hasResults && (
                <>
                  {groups.map((group) => {
                    const items = results[group] ?? [];
                    return (
                      <Command.Group
                        key={group}
                        aria-label={`${SEARCH_ENTITY_LABELS[group]} — ${items.length} resultado${items.length !== 1 ? "s" : ""}`}
                        heading={
                          <span className="text-xs font-medium text-muted-foreground px-4 py-2 block">
                            {SEARCH_ENTITY_LABELS[group]} ({items.length})
                          </span>
                        }
                      >
                        {items.map((item) => {
                          const Icon = ICON_MAP[item.type] ?? Search;
                          return (
                            <Command.Item
                              key={`${item.type}:${item.id}`}
                              value={`${item.type}:${item.id}`}
                              onSelect={() => handleSelect(item.href)}
                              className="flex items-center gap-3 px-4 py-3 cursor-pointer text-sm transition-none data-[selected=true]:bg-accent/50 hover:bg-accent/50"
                            >
                              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-foreground truncate">
                                  <HighlightMatch text={item.title} query={query} />
                                </p>
                                {item.subtitle && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    <HighlightMatch text={item.subtitle} query={query} />
                                  </p>
                                )}
                              </div>
                            </Command.Item>
                          );
                        })}
                      </Command.Group>
                    );
                  })}
                </>
              )}
            </Command.List>
          </div>

          {results && hasResults && (
            <div className="border-t border-border px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {totalResults} resultado{totalResults !== 1 ? "s" : ""}
              </span>
              <span>
                <kbd
                  aria-hidden="true"
                  className="bg-muted/50 border border-border rounded px-1 py-0.5 font-mono text-[10px]"
                >
                  ↑↓
                </kbd>{" "}
                navegar{" "}
                <kbd
                  aria-hidden="true"
                  className="bg-muted/50 border border-border rounded px-1 py-0.5 font-mono text-[10px]"
                >
                  ↵
                </kbd>{" "}
                abrir
              </span>
            </div>
          )}
        </Command>
      </DialogContent>
    </Dialog>
  );
}
