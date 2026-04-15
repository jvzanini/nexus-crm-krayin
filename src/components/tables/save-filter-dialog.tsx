"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@nexusai360/design-system";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { saveFilter } from "@/lib/actions/saved-filters";
import type { SavedFilterModuleKey } from "@/lib/actions/saved-filters-schemas";

interface SaveFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleKey: SavedFilterModuleKey;
  currentFilters: Record<string, string>;
  onSaved: () => void;
}

function summarizeFilters(filters: Record<string, string>): string {
  const entries = Object.entries(filters).filter(
    ([, v]) => v !== undefined && v !== null && String(v).length > 0,
  );
  if (entries.length === 0) return "Nenhum filtro ativo.";
  const count = entries.length;
  const preview = entries
    .slice(0, 4)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const suffix = entries.length > 4 ? "…" : "";
  return `${count} filtro${count === 1 ? "" : "s"} ativo${count === 1 ? "" : "s"}: ${preview}${suffix}`;
}

export function SaveFilterDialog({
  open,
  onOpenChange,
  moduleKey,
  currentFilters,
  onSaved,
}: SaveFilterDialogProps) {
  const [name, setName] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [saving, startSaving] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setSetAsDefault(false);
    }
    onOpenChange(next);
  }

  function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error("Informe um nome para o filtro");
      return;
    }
    if (trimmed.length > 80) {
      toast.error("Nome deve ter no máximo 80 caracteres");
      return;
    }
    startSaving(async () => {
      const r = await saveFilter({
        moduleKey,
        name: trimmed,
        filters: currentFilters,
        setAsDefault,
      });
      if (r.success) {
        toast.success("Filtro salvo com sucesso");
        onSaved();
        handleOpenChange(false);
      } else {
        toast.error(r.error || "Erro ao salvar filtro");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar filtros atuais</DialogTitle>
          <DialogDescription>
            Dê um nome para reaplicar este conjunto de filtros depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nome</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Leads em qualificação"
              maxLength={80}
              className="bg-muted/50 border-border text-foreground"
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              {name.trim().length}/80 caracteres
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="saved-filter-default"
              checked={setAsDefault}
              onCheckedChange={(v) => setSetAsDefault(Boolean(v))}
              disabled={saving}
            />
            <label
              htmlFor="saved-filter-default"
              className="text-sm text-foreground cursor-pointer select-none"
            >
              Usar como padrão
            </label>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              {summarizeFilters(currentFilters)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => handleOpenChange(false)}
            className="h-10 bg-transparent hover:bg-muted/50 text-muted-foreground border border-border cursor-pointer"
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-10 gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
