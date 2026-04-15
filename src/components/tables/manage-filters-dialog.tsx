"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nexusai360/design-system";
import type { SavedFilter } from "@/generated/prisma/client";
import { toast } from "sonner";
import { Loader2, Star, Trash2 } from "lucide-react";
import {
  deleteFilter,
  setDefaultFilter,
  updateFilter,
} from "@/lib/actions/saved-filters";
import type { SavedFilterModuleKey } from "@/lib/actions/saved-filters-schemas";

interface ManageFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleKey: SavedFilterModuleKey;
  list: SavedFilter[];
  onChanged: () => void;
}

export function ManageFiltersDialog({
  open,
  onOpenChange,
  moduleKey,
  list,
  onChanged,
}: ManageFiltersDialogProps) {
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<SavedFilter | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of list) next[f.id] = f.name;
    setDraftNames(next);
  }, [list]);

  function commitRename(f: SavedFilter) {
    const val = (draftNames[f.id] ?? "").trim();
    if (val.length === 0) {
      toast.error("Nome não pode ficar vazio");
      setDraftNames((d) => ({ ...d, [f.id]: f.name }));
      return;
    }
    if (val === f.name) return;
    startTransition(async () => {
      const r = await updateFilter({ id: f.id, name: val });
      if (r.success) {
        toast.success("Filtro renomeado");
        onChanged();
      } else {
        toast.error(r.error || "Erro ao renomear filtro");
        setDraftNames((d) => ({ ...d, [f.id]: f.name }));
      }
    });
  }

  function toggleDefault(f: SavedFilter) {
    startTransition(async () => {
      if (f.isDefault) {
        const r = await updateFilter({ id: f.id, setAsDefault: false });
        if (r.success) {
          toast.success("Padrão removido");
          onChanged();
        } else {
          toast.error(r.error || "Erro ao atualizar padrão");
        }
      } else {
        const r = await setDefaultFilter({ id: f.id, moduleKey });
        if (r.success) {
          toast.success("Filtro definido como padrão");
          onChanged();
        } else {
          toast.error(r.error || "Erro ao definir padrão");
        }
      }
    });
  }

  function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      const r = await deleteFilter(target.id);
      if (r.success) {
        toast.success("Filtro excluído");
        setDeleteTarget(null);
        onChanged();
      } else {
        toast.error(r.error || "Erro ao excluir filtro");
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar filtros salvos</DialogTitle>
            <DialogDescription>
              Renomeie, defina padrão ou exclua seus filtros salvos.
            </DialogDescription>
          </DialogHeader>

          {list.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum filtro salvo ainda.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-[110px]">Padrão</TableHead>
                    <TableHead className="w-[80px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <Input
                          value={draftNames[f.id] ?? f.name}
                          onChange={(e) =>
                            setDraftNames((d) => ({
                              ...d,
                              [f.id]: e.target.value,
                            }))
                          }
                          onBlur={() => commitRename(f)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          maxLength={80}
                          disabled={pending}
                          className="bg-muted/50 border-border text-foreground h-9"
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleDefault(f)}
                          disabled={pending}
                          title={
                            f.isDefault
                              ? "Remover como padrão"
                              : "Definir como padrão"
                          }
                          className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Star
                            className={
                              f.isDefault
                                ? "h-4 w-4 fill-violet-500 text-violet-500"
                                : "h-4 w-4 text-muted-foreground"
                            }
                          />
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => setDeleteTarget(f)}
                          disabled={pending}
                          className="h-9 w-9 p-0 bg-transparent hover:bg-red-500/10 text-red-400 border border-border cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              className="h-10 bg-transparent hover:bg-muted/50 text-muted-foreground border border-border cursor-pointer"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir filtro salvo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o filtro &quot;
              {deleteTarget?.name}&quot;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={pending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
