"use client";

import { useState } from "react";
import { Button } from "@nexusai360/design-system";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SavedFilter } from "@/generated/prisma/client";
import {
  BookmarkPlus,
  Filter,
  Settings2,
  Star,
} from "lucide-react";
import type { SavedFilterModuleKey } from "@/lib/actions/saved-filters-schemas";
import { SaveFilterDialog } from "./save-filter-dialog";
import { ManageFiltersDialog } from "./manage-filters-dialog";

interface SavedFiltersMenuProps {
  moduleKey: SavedFilterModuleKey;
  currentFilters: Record<string, string>;
  savedList: SavedFilter[];
  onApply: (filters: Record<string, string>) => void;
  onListChange: () => void;
}

export function SavedFiltersMenu({
  moduleKey,
  currentFilters,
  savedList,
  onApply,
  onListChange,
}: SavedFiltersMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);

  function handleApply(f: SavedFilter) {
    const filters = (f.filters ?? {}) as Record<string, string>;
    onApply(filters);
    setMenuOpen(false);
  }

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          render={(props) => (
            <Button
              {...props}
              className="h-10 gap-2 bg-transparent hover:bg-muted/50 text-foreground border border-border cursor-pointer"
            >
              <Filter className="h-4 w-4" />
              Filtros salvos
              {savedList.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({savedList.length})
                </span>
              )}
            </Button>
          )}
        />
        <PopoverContent className="w-80 p-0">
          <div className="p-2">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Filtros salvos
            </div>
            {savedList.length === 0 ? (
              <div className="px-2 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum filtro salvo ainda.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure filtros e clique em Salvar.
                </p>
              </div>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {savedList.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => handleApply(f)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer text-left"
                    >
                      <Star
                        className={
                          f.isDefault
                            ? "h-3.5 w-3.5 fill-violet-500 text-violet-500 shrink-0"
                            : "h-3.5 w-3.5 text-muted-foreground/40 shrink-0"
                        }
                      />
                      <span className="text-sm text-foreground truncate">
                        {f.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border p-2 space-y-1">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSaveDialogOpen(true);
              }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <BookmarkPlus className="h-4 w-4 text-violet-500" />
              <span className="text-sm text-foreground">
                Salvar filtros atuais
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setManageDialogOpen(true);
              }}
              disabled={savedList.length === 0}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">
                Gerenciar filtros salvos
              </span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <SaveFilterDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        moduleKey={moduleKey}
        currentFilters={currentFilters}
        onSaved={onListChange}
      />
      <ManageFiltersDialog
        open={manageDialogOpen}
        onOpenChange={setManageDialogOpen}
        moduleKey={moduleKey}
        list={savedList}
        onChanged={onListChange}
      />
    </>
  );
}
