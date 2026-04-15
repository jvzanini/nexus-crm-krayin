"use client";

/**
 * Fase 5 T14/34 — AlertDialog de confirmação de exclusão.
 *
 * Chama `deleteCustomAttribute(id)` — a action já agenda o job `purge-values`
 * em background (spec v3 §3.8/CR-1). O parâmetro `purgeValues:true` do spec é
 * implícito: a server action sempre purga; não há modo "keep values" no MVP.
 */

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@nexusai360/design-system";
import { toast } from "sonner";
import { deleteCustomAttribute } from "@/lib/actions/custom-attributes";
import type { CustomAttribute } from "@/lib/custom-attributes/types";

interface Props {
  target: CustomAttribute | null;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void | Promise<void>;
}

export function DeleteConfirmDialog({
  target,
  onOpenChange,
  onSuccess,
}: Props) {
  const [acting, startActing] = useTransition();

  function handleConfirm() {
    if (!target) return;
    startActing(async () => {
      const res = await deleteCustomAttribute(target.id);
      if (res.success) {
        toast.success(
          "Exclusão agendada. Valores serão removidos em background.",
        );
        await onSuccess();
      } else {
        toast.error(res.error ?? "Erro ao excluir atributo");
      }
    });
  }

  return (
    <AlertDialog open={!!target} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir atributo {target?.label ? `"${target.label}"` : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Remover este atributo e todos os valores associados? Esta ação
            agenda job de purge em background e não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={acting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={acting}
            className="bg-destructive hover:bg-destructive/90 text-white gap-2"
          >
            {acting && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
